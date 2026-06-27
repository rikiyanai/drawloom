#!/usr/bin/env node
// Diff two FramePacket JSON dumps.
//
// Usage:
//   node scripts/compare-packets.mjs a.json b.json
//
// Useful pairings:
//   - two ARKit captures from the same session (sanity / jitter check)
//   - an ARKit packet vs a MediaPipe packet, once drawloom has a matching export
//
// Matrix convention: both shapes store column-major 4x4 transforms in a flat
// 16-float array. m[12..14] is translation; m[0..2,4..6,8..10] is the upper
// 3x3 rotation in column-major order. Same convention MediaPipe FaceLandmarker
// returns from pose.matrix, so the diff is apples-to-apples there too.

import { readFileSync } from "node:fs";

const [, , aPath, bPath] = process.argv;
if (!aPath || !bPath) {
    console.error("usage: compare-packets.mjs <a.json> <b.json>");
    process.exit(2);
}

const a = JSON.parse(readFileSync(aPath, "utf8"));
const b = JSON.parse(readFileSync(bPath, "utf8"));

function decompose(flat) {
    const tx = flat[12], ty = flat[13], tz = flat[14];
    const trace = flat[0] + flat[5] + flat[10];
    const cosTheta = Math.max(-1, Math.min(1, (trace - 1) / 2));
    const angleDeg = (Math.acos(cosTheta) * 180) / Math.PI;
    return { t: [tx, ty, tz], angleDeg };
}

function mat3FromColumnMajor4(flat) {
    return [
        [flat[0], flat[4], flat[8]],
        [flat[1], flat[5], flat[9]],
        [flat[2], flat[6], flat[10]],
    ];
}

function transpose3(m) {
    return [
        [m[0][0], m[1][0], m[2][0]],
        [m[0][1], m[1][1], m[2][1]],
        [m[0][2], m[1][2], m[2][2]],
    ];
}

function mul3(a, b) {
    return a.map((row) => b[0].map((_, c) => row[0] * b[0][c] + row[1] * b[1][c] + row[2] * b[2][c]));
}

function relativeAngleDeg(aFlat, bFlat) {
    const ra = mat3FromColumnMajor4(aFlat);
    const rb = mat3FromColumnMajor4(bFlat);
    const rel = mul3(rb, transpose3(ra));
    const trace = rel[0][0] + rel[1][1] + rel[2][2];
    const cosTheta = Math.max(-1, Math.min(1, (trace - 1) / 2));
    return (Math.acos(cosTheta) * 180) / Math.PI;
}

function diffPose(label, mA, mB) {
    const dA = decompose(mA);
    const dB = decompose(mB);
    const dT = dA.t.map((v, i) => (dB.t[i] - v) * 100);
    const dist = Math.hypot(...dT);
    console.log(`${label}:`);
    console.log(`  A pos       ${dA.t.map((v) => (v * 100).toFixed(2).padStart(7)).join(" ")} cm   angle ${dA.angleDeg.toFixed(2)}°`);
    console.log(`  B pos       ${dB.t.map((v) => (v * 100).toFixed(2).padStart(7)).join(" ")} cm   angle ${dB.angleDeg.toFixed(2)}°`);
    console.log(`  delta pos   ${dT.map((v) => v.toFixed(2).padStart(7)).join(" ")} cm   dist ${dist.toFixed(2)} cm`);
    console.log(`  relative rotation ${relativeAngleDeg(mA, mB).toFixed(2)}°`);
}

function diffVertices(aPacket, bPacket) {
    const va = aPacket.vertices;
    const vb = bPacket.vertices;
    if (!va || !vb) return console.log("vertices: missing on one side");
    if (aPacket.topology && bPacket.topology && aPacket.topology !== bPacket.topology) {
        return console.log(`vertices: topology mismatch (${aPacket.topology} vs ${bPacket.topology}) — skipping raw index L2`);
    }
    if (va.length !== vb.length) {
        return console.log(`vertices: count mismatch (${va.length} vs ${vb.length}) — skipping`);
    }
    let sum = 0, maxD = 0, maxI = 0;
    for (let i = 0; i < va.length; i++) {
        const dx = vb[i].x - va[i].x;
        const dy = vb[i].y - va[i].y;
        const dz = vb[i].z - va[i].z;
        const d = Math.hypot(dx, dy, dz);
        sum += d;
        if (d > maxD) { maxD = d; maxI = i; }
    }
    const mean = sum / va.length;
    console.log(`vertices (${va.length}):`);
    console.log(`  mean delta  ${(mean * 1000).toFixed(3)} mm`);
    console.log(`  max  delta  ${(maxD * 1000).toFixed(3)} mm at index ${maxI}`);
}

// Maps both ARKit _L/_R names and MediaPipe Left/Right names to a single canonical
// Left/Right namespace so either packet format can be compared against the other.
const BLENDSHAPE_ALIASES = new Map([
    // ARKit _L / _R → canonical
    ["browDown_L",         "browDownLeft"],
    ["browDown_R",         "browDownRight"],
    ["browInnerUp",        "browInnerUp"],
    ["browOuterUp_L",      "browOuterUpLeft"],
    ["browOuterUp_R",      "browOuterUpRight"],
    ["cheekPuff",          "cheekPuff"],
    ["cheekSquint_L",      "cheekSquintLeft"],
    ["cheekSquint_R",      "cheekSquintRight"],
    ["eyeBlink_L",         "eyeBlinkLeft"],
    ["eyeBlink_R",         "eyeBlinkRight"],
    ["eyeLookDown_L",      "eyeLookDownLeft"],
    ["eyeLookDown_R",      "eyeLookDownRight"],
    ["eyeLookIn_L",        "eyeLookInLeft"],
    ["eyeLookIn_R",        "eyeLookInRight"],
    ["eyeLookOut_L",       "eyeLookOutLeft"],
    ["eyeLookOut_R",       "eyeLookOutRight"],
    ["eyeLookUp_L",        "eyeLookUpLeft"],
    ["eyeLookUp_R",        "eyeLookUpRight"],
    ["eyeSquint_L",        "eyeSquintLeft"],
    ["eyeSquint_R",        "eyeSquintRight"],
    ["eyeWide_L",          "eyeWideLeft"],
    ["eyeWide_R",          "eyeWideRight"],
    ["jawForward",         "jawForward"],
    ["jawLeft",            "jawLeft"],
    ["jawOpen",            "jawOpen"],
    ["jawRight",           "jawRight"],
    ["mouthClose",         "mouthClose"],
    ["mouthDimple_L",      "mouthDimpleLeft"],
    ["mouthDimple_R",      "mouthDimpleRight"],
    ["mouthFrown_L",       "mouthFrownLeft"],
    ["mouthFrown_R",       "mouthFrownRight"],
    ["mouthFunnel",        "mouthFunnel"],
    ["mouthLeft",          "mouthLeft"],
    ["mouthLowerDown_L",   "mouthLowerDownLeft"],
    ["mouthLowerDown_R",   "mouthLowerDownRight"],
    ["mouthPress_L",       "mouthPressLeft"],
    ["mouthPress_R",       "mouthPressRight"],
    ["mouthPucker",        "mouthPucker"],
    ["mouthRight",         "mouthRight"],
    ["mouthRollLower",     "mouthRollLower"],
    ["mouthRollUpper",     "mouthRollUpper"],
    ["mouthShrugLower",    "mouthShrugLower"],
    ["mouthShrugUpper",    "mouthShrugUpper"],
    ["mouthSmile_L",       "mouthSmileLeft"],
    ["mouthSmile_R",       "mouthSmileRight"],
    ["mouthStretch_L",     "mouthStretchLeft"],
    ["mouthStretch_R",     "mouthStretchRight"],
    ["mouthUpperUp_L",     "mouthUpperUpLeft"],
    ["mouthUpperUp_R",     "mouthUpperUpRight"],
    ["noseSneer_L",        "noseSneerLeft"],
    ["noseSneer_R",        "noseSneerRight"],
    // MediaPipe Left/Right pass-through
    ["browDownLeft",       "browDownLeft"],
    ["browDownRight",      "browDownRight"],
    ["browOuterUpLeft",    "browOuterUpLeft"],
    ["browOuterUpRight",   "browOuterUpRight"],
    ["cheekSquintLeft",    "cheekSquintLeft"],
    ["cheekSquintRight",   "cheekSquintRight"],
    ["eyeBlinkLeft",       "eyeBlinkLeft"],
    ["eyeBlinkRight",      "eyeBlinkRight"],
    ["eyeLookDownLeft",    "eyeLookDownLeft"],
    ["eyeLookDownRight",   "eyeLookDownRight"],
    ["eyeLookInLeft",      "eyeLookInLeft"],
    ["eyeLookInRight",     "eyeLookInRight"],
    ["eyeLookOutLeft",     "eyeLookOutLeft"],
    ["eyeLookOutRight",    "eyeLookOutRight"],
    ["eyeLookUpLeft",      "eyeLookUpLeft"],
    ["eyeLookUpRight",     "eyeLookUpRight"],
    ["eyeSquintLeft",      "eyeSquintLeft"],
    ["eyeSquintRight",     "eyeSquintRight"],
    ["eyeWideLeft",        "eyeWideLeft"],
    ["eyeWideRight",       "eyeWideRight"],
    ["mouthDimpleLeft",    "mouthDimpleLeft"],
    ["mouthDimpleRight",   "mouthDimpleRight"],
    ["mouthFrownLeft",     "mouthFrownLeft"],
    ["mouthFrownRight",    "mouthFrownRight"],
    ["mouthLowerDownLeft", "mouthLowerDownLeft"],
    ["mouthLowerDownRight","mouthLowerDownRight"],
    ["mouthPressLeft",     "mouthPressLeft"],
    ["mouthPressRight",    "mouthPressRight"],
    ["mouthSmileLeft",     "mouthSmileLeft"],
    ["mouthSmileRight",    "mouthSmileRight"],
    ["mouthStretchLeft",   "mouthStretchLeft"],
    ["mouthStretchRight",  "mouthStretchRight"],
    ["mouthUpperUpLeft",   "mouthUpperUpLeft"],
    ["mouthUpperUpRight",  "mouthUpperUpRight"],
    ["noseSneerLeft",      "noseSneerLeft"],
    ["noseSneerRight",     "noseSneerRight"],
]);

function normalizeBlendShapes(packet) {
    const input = packet.blendShapes ?? {};
    const out = {};
    const unmapped = [];
    for (const [k, v] of Object.entries(input)) {
        const mapped = BLENDSHAPE_ALIASES.get(k);
        if (mapped) out[mapped] = v;
        else unmapped.push(k);
    }
    return { out, unmapped };
}

function diffBlendShapes(ba, bb) {
    if (!ba || !bb) return console.log("blendShapes: missing on one side");
    const keys = new Set([...Object.keys(ba), ...Object.keys(bb)]);
    let sum = 0, count = 0, maxD = 0, maxK = "";
    const onlyA = [], onlyB = [];
    for (const k of keys) {
        if (!(k in bb)) onlyA.push(k);
        if (!(k in ba)) onlyB.push(k);
        const va = ba[k] ?? 0;
        const vb = bb[k] ?? 0;
        const d = Math.abs(vb - va);
        sum += d;
        count++;
        if (d > maxD) { maxD = d; maxK = k; }
    }
    console.log(`blendShapes (${count} keys union):`);
    console.log(`  mean abs delta ${(sum / count).toFixed(3)}`);
    console.log(`  max  abs delta ${maxD.toFixed(3)} (${maxK})`);
    if (onlyA.length) console.log(`  only in A: ${onlyA.length} (${onlyA.slice(0, 4).join(", ")}${onlyA.length > 4 ? ", …" : ""})`);
    if (onlyB.length) console.log(`  only in B: ${onlyB.length} (${onlyB.slice(0, 4).join(", ")}${onlyB.length > 4 ? ", …" : ""})`);
}

function diffDepth(da, db) {
    const fmtStats = (d) => d ? `${d.w}x${d.h}${d.x0 == null ? "" : ` roi(${d.x0},${d.y0})-(${d.x1},${d.y1})`}  ${d.minMeters.toFixed(3)}-${d.maxMeters.toFixed(3)} m  mean ${d.meanMeters.toFixed(3)} m  (${d.sampleCount} samples)` : "none";
    const fmt = (d) => {
        if (!d) return "none";
        if (d.fullFrame) return `full ${fmtStats(d.fullFrame)}; face ${fmtStats(d.faceROI)}`;
        return fmtStats(d);
    };
    console.log(`depth: A=${fmt(da)}  |  B=${fmt(db)}`);
}

console.log(`schema     A=${a.schema}  B=${b.schema}`);
console.log(`timestamp  A=${a.timestampMs?.toFixed?.(1) ?? a.timestampMs} ms  B=${b.timestampMs?.toFixed?.(1) ?? b.timestampMs} ms  Δ=${(b.timestampMs - a.timestampMs).toFixed(1)} ms`);
console.log(`image      A=${a.imageW}x${a.imageH}  B=${b.imageW}x${b.imageH}`);
console.log();

if (a.modelToCamera && b.modelToCamera) {
    diffPose("modelToCamera", a.modelToCamera.m, b.modelToCamera.m);
    console.log();
}
if (a.faceTransform && b.faceTransform) {
    diffPose("faceTransform", a.faceTransform.m, b.faceTransform.m);
    console.log();
}

console.log(`topology   A=${a.topology ?? "unknown"}  B=${b.topology ?? "unknown"}`);
console.log();

diffVertices(a, b);
console.log();
const aBlend = normalizeBlendShapes(a);
const bBlend = normalizeBlendShapes(b);
diffBlendShapes(aBlend.out, bBlend.out);
if (aBlend.unmapped.length) console.log(`  unmapped in A: ${aBlend.unmapped.length} (${aBlend.unmapped.slice(0, 6).join(", ")}${aBlend.unmapped.length > 6 ? ", ..." : ""})`);
if (bBlend.unmapped.length) console.log(`  unmapped in B: ${bBlend.unmapped.length} (${bBlend.unmapped.slice(0, 6).join(", ")}${bBlend.unmapped.length > 6 ? ", ..." : ""})`);
console.log();
diffDepth(a.depth, b.depth);
