import type { Overlay } from "./types";
import {
  FACE_OVAL,
  LEFT_EYE,
  RIGHT_EYE,
  NOSE_BRIDGE,
  NOSE_BOTTOM,
  LEFT_EAR,
  RIGHT_EAR,
  CHIN,
  TOP_OF_FOREHEAD,
  LEFT_PUPIL,
  RIGHT_PUPIL,
  indicesToPts,
  smoothRingPath,
  type Pt,
} from "../pose/landmarks";

// Detailed skull underlay: cranium, eye orbits, nasal aperture, zygomatic
// arches, mandible. Anchored to MediaPipe landmarks. Approximate by design —
// this is a study aid for understanding the form beneath the face, not a
// medical-grade reconstruction.
//
// Strategy: derive each bone region by EXPANDING soft-tissue landmarks outward
// from a relevant center (orbits expand from eye contour, nasal aperture
// derived from nose bridge + bottom). Pure index-picking produced misshapen
// rings; this expansion approach gives reliable bone-like shapes.

function expandRing(pts: Pt[], pivot: Pt, factor: number): Pt[] {
  return pts.map((p) => ({
    x: pivot.x + (p.x - pivot.x) * factor,
    y: pivot.y + (p.y - pivot.y) * factor,
  }));
}

function centroid(pts: Pt[]): Pt {
  let x = 0, y = 0;
  for (const p of pts) { x += p.x; y += p.y; }
  return { x: x / pts.length, y: y / pts.length };
}

function strokePoly(ctx: CanvasRenderingContext2D, pts: Pt[], close: boolean) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (close) ctx.closePath();
  ctx.stroke();
}

// MANDIBLE — explicit jaw chain from face oval
const MANDIBLE = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152,
                  377, 400, 378, 379, 365, 397, 288, 361, 323, 454];

export const skeletonOverlay: Overlay = {
  id: "skeleton",
  name: "Skeleton underlay (skull)",
  category: "anatomy",
  description:
    "Detailed skull bones beneath the skin: cranium, eye orbits, nasal aperture, zygomatic arches, mandible. Approximated from MediaPipe landmark groups.",
  requiresFace: true,
  params: [
    { key: "cranium", label: "Cranium / face oval", type: "toggle", default: true },
    { key: "orbits", label: "Eye orbits", type: "toggle", default: true },
    { key: "nasal", label: "Nasal aperture", type: "toggle", default: true },
    { key: "zygo", label: "Zygomatic arch", type: "toggle", default: true },
    { key: "mandible", label: "Mandible", type: "toggle", default: true },
    { key: "darkSockets", label: "Dark orbit sockets", type: "toggle", default: true },
    { key: "fill", label: "Bone tint fill", type: "toggle", default: false },
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 0.55 },
  ],
  render({ ctx, pose, params }) {
    if (!pose) return;
    const lms = pose.landmarks;
    const opacity = (params.opacity as number) ?? 0.85;
    const fill = (params.fill as boolean) ?? false;
    const top = lms[TOP_OF_FOREHEAD];
    const chin = lms[CHIN];
    const leftEar = lms[LEFT_EAR];
    const rightEar = lms[RIGHT_EAR];
    const leftPupil = lms[LEFT_PUPIL];
    const rightPupil = lms[RIGHT_PUPIL];

    const boneStroke = "#fafaf9";
    const boneFill = "rgba(250, 250, 249, 0.12)";

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 3;

    // Cranium — smooth face oval ring
    if ((params.cranium as boolean) ?? true) {
      const pts = indicesToPts(FACE_OVAL, lms);
      if (pts.length > 6) {
        smoothRingPath(ctx, pts);
        if (fill) { ctx.fillStyle = boneFill; ctx.fill(); }
        ctx.strokeStyle = boneStroke;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Brow ridge (frontal bone arch over both eyes)
      if (top && chin && leftEar && rightEar) {
        const browY = leftPupil && rightPupil
          ? (leftPupil.y + rightPupil.y) / 2 - Math.hypot(rightEar.x - leftEar.x, rightEar.y - leftEar.y) * 0.07
          : top.y + (chin.y - top.y) * 0.3;
        ctx.beginPath();
        ctx.moveTo(leftEar.x + (top.x - leftEar.x) * 0.25, browY);
        ctx.quadraticCurveTo(top.x, browY - 8, rightEar.x - (rightEar.x - top.x) * 0.25, browY);
        ctx.strokeStyle = boneStroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Eye orbits — expand eye contour outward; orbits are MUCH larger than
    // the visible eyelid opening (especially vertically, going above the brow).
    if ((params.orbits as boolean) ?? true) {
      const leftEye = indicesToPts(LEFT_EYE, lms);
      const rightEye = indicesToPts(RIGHT_EYE, lms);
      const dark = (params.darkSockets as boolean) ?? true;
      for (const eyePts of [leftEye, rightEye]) {
        if (eyePts.length <= 4) continue;
        const c = centroid(eyePts);
        // Asymmetric expansion: more vertical than horizontal so the orbit reads
        // as a bony socket (taller than the lid opening).
        const orbit = eyePts.map((p) => ({
          x: c.x + (p.x - c.x) * 1.75,
          y: c.y + (p.y - c.y) * 2.1,
        }));
        smoothRingPath(ctx, orbit);
        if (dark) {
          // Dark shadow inside the socket — simulates the recessed cavity
          ctx.fillStyle = "rgba(0,0,0,0.45)";
          ctx.fill();
        } else if (fill) {
          ctx.fillStyle = boneFill;
          ctx.fill();
        }
        ctx.strokeStyle = boneStroke;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
    }

    // Nasal aperture — triangular/heart-shaped pyriform opening of the skull.
    // Apex at upper bridge, two nostril-edge anchors at bottom, slight dip in middle.
    if ((params.nasal as boolean) ?? true) {
      const bridge = indicesToPts(NOSE_BRIDGE, lms);
      const bottom = indicesToPts(NOSE_BOTTOM, lms);
      const leftNostril = lms[219] ?? bottom[0];
      const rightNostril = lms[439] ?? bottom[bottom.length - 1];
      const noseSeptumLow = lms[2]; // base of nose between nostrils
      if (bridge.length > 1 && leftNostril && rightNostril && noseSeptumLow) {
        const apex = bridge[1] ?? bridge[0]; // a bit below the very top for a real aperture
        ctx.beginPath();
        ctx.moveTo(apex.x, apex.y);
        // Down to left nostril edge
        ctx.quadraticCurveTo(
          apex.x - (apex.x - leftNostril.x) * 0.3,
          (apex.y + leftNostril.y) / 2,
          leftNostril.x,
          leftNostril.y
        );
        // Bottom dip across the septum
        ctx.quadraticCurveTo(
          noseSeptumLow.x,
          noseSeptumLow.y + 4,
          rightNostril.x,
          rightNostril.y
        );
        // Up to apex
        ctx.quadraticCurveTo(
          apex.x + (rightNostril.x - apex.x) * 0.3,
          (apex.y + rightNostril.y) / 2,
          apex.x,
          apex.y
        );
        ctx.closePath();
        if (fill) { ctx.fillStyle = boneFill; ctx.fill(); }
        else { ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fill(); }
        ctx.strokeStyle = boneStroke;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }

    // Zygomatic arch — explicit arc from temple to cheekbone on each side
    if (((params.zygo as boolean) ?? true) && top && leftEar && rightEar) {
      // Anchors: ear top (temple) and a cheekbone point under the eye
      // Use landmark 50/280 area for cheekbone, fall back to interpolation
      const leftCheekBone = lms[50] ?? lms[123] ?? { x: (leftEar.x + (top?.x ?? 0)) / 2, y: leftEar.y };
      const rightCheekBone = lms[280] ?? lms[352] ?? { x: (rightEar.x + (top?.x ?? 0)) / 2, y: rightEar.y };
      ctx.strokeStyle = boneStroke;
      ctx.lineWidth = 1.6;
      // Left arch: sweep up and forward from ear to cheekbone
      ctx.beginPath();
      ctx.moveTo(leftEar.x, leftEar.y - 6);
      ctx.quadraticCurveTo(
        (leftEar.x + leftCheekBone.x) / 2,
        Math.min(leftEar.y, leftCheekBone.y) - 14,
        leftCheekBone.x,
        leftCheekBone.y
      );
      ctx.stroke();
      // Right arch
      ctx.beginPath();
      ctx.moveTo(rightEar.x, rightEar.y - 6);
      ctx.quadraticCurveTo(
        (rightEar.x + rightCheekBone.x) / 2,
        Math.min(rightEar.y, rightCheekBone.y) - 14,
        rightCheekBone.x,
        rightCheekBone.y
      );
      ctx.stroke();
    }

    // Mandible (jaw bone) — explicit jaw chain + ramus segments going up to the ear
    if ((params.mandible as boolean) ?? true) {
      const jawPts = indicesToPts(MANDIBLE, lms);
      ctx.strokeStyle = boneStroke;
      ctx.lineWidth = 1.8;
      strokePoly(ctx, jawPts, false);

      // Ramus — vertical segment from jaw angle up to ear on each side
      if (leftEar && rightEar && jawPts.length > 4) {
        const leftAngle = jawPts[2]; // approx jaw angle on left side
        const rightAngle = jawPts[jawPts.length - 3]; // jaw angle on right side
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(leftEar.x, leftEar.y);
        ctx.lineTo(leftAngle.x, leftAngle.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(rightEar.x, rightEar.y);
        ctx.lineTo(rightAngle.x, rightAngle.y);
        ctx.stroke();
      }
    }

    ctx.restore();
  },
};
