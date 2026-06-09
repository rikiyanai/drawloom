import type { Overlay } from "./types";
import {
  LEFT_EAR,
  RIGHT_EAR,
  CHIN,
  TOP_OF_FOREHEAD,
  NOSE_TIP,
  LEFT_MOUTH_CORNER,
  RIGHT_MOUTH_CORNER,
  LEFT_PUPIL,
  RIGHT_PUPIL,
  type Pt,
} from "../pose/landmarks";

// Combined Loomis-Reilly construction underlay.
//
// Loomis half: cranium sphere, side-plane cut, brow line, jaw stub, all
// rotated by the detected yaw/pitch/roll.
// Reilly half: rhythm lines that flow across the surface of the face —
// brow-to-jaw rhythm, mouth-corner-to-nose-corner-to-brow-ridge cheek
// rhythm, fat-pad oval, zygomatic arch curve.
//
// The two systems are complementary: Loomis gives you the 3D mass,
// Reilly gives you the surface flow.

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export const loomisReillyOverlay: Overlay = {
  id: "loomis-reilly",
  name: "Loomis + Reilly construction",
  category: "construction",
  description:
    "Underlay combining Loomis volumetric construction (sphere + cut plane) with Reilly surface rhythm lines (cheek rhythm, fat-pad oval, zygomatic arch).",
  requiresFace: true,
  params: [
    { key: "loomis", label: "Loomis sphere + cut", type: "toggle", default: true },
    { key: "centerline", label: "Centerline + thirds", type: "toggle", default: true },
    { key: "reilly", label: "Reilly rhythm lines", type: "toggle", default: true },
    { key: "fatpad", label: "Cheek fat-pad oval", type: "toggle", default: true },
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 0.8 },
  ],
  render({ ctx, pose, params }) {
    if (!pose) return;
    const lms = pose.landmarks;
    const top = lms[TOP_OF_FOREHEAD];
    const chin = lms[CHIN];
    const leftEar = lms[LEFT_EAR];
    const rightEar = lms[RIGHT_EAR];
    const noseTip = lms[NOSE_TIP];
    const leftMouth = lms[LEFT_MOUTH_CORNER];
    const rightMouth = lms[RIGHT_MOUTH_CORNER];
    const leftPupil = lms[LEFT_PUPIL];
    const rightPupil = lms[RIGHT_PUPIL];
    if (!top || !chin || !leftEar || !rightEar) return;

    const opacity = (params.opacity as number) ?? 0.8;
    const showLoomis = (params.loomis as boolean) ?? true;
    const showCenter = (params.centerline as boolean) ?? true;
    const showReilly = (params.reilly as boolean) ?? true;
    const showFatPad = (params.fatpad as boolean) ?? true;

    const cx = (leftEar.x + rightEar.x) / 2;
    const cy = (leftEar.y + rightEar.y) / 2;
    const halfWidth = Math.hypot(rightEar.x - leftEar.x, rightEar.y - leftEar.y) / 2;
    const totalHeight = chin.y - top.y;
    const radius = totalHeight * 0.42;
    const { yaw, pitch, roll } = pose.angles;
    const yawRad = (yaw * Math.PI) / 180;
    const pitchRad = (pitch * Math.PI) / 180;
    const rollRad = (roll * Math.PI) / 180;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.lineWidth = 1.5;

    // -------- LOOMIS --------
    if (showLoomis) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rollRad);
      ctx.strokeStyle = "#22d3ee";

      // Sphere outline
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Side-plane cut (Loomis flattens the temple)
      const cutOffset = radius * Math.sin(yawRad) * 0.7;
      ctx.beginPath();
      ctx.ellipse(cutOffset, 0, radius * 0.2, radius * Math.cos(yawRad) * 0.95, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Brow line (horizontal great circle tilted by pitch)
      ctx.beginPath();
      ctx.ellipse(0, radius * Math.sin(pitchRad) * 0.35, radius * Math.cos(yawRad), radius * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Jaw stub extending below the sphere down to chin
      const jawY = radius * 0.85;
      const jawW = radius * 0.6;
      ctx.beginPath();
      ctx.moveTo(-jawW + cutOffset, jawY * 0.4);
      ctx.quadraticCurveTo(cutOffset, jawY * 1.7, jawW + cutOffset, jawY * 0.4);
      ctx.stroke();

      ctx.restore();
    }

    // -------- Loomis thirds + centerline (anchored to real landmarks, no rotation math) --------
    if (showCenter && noseTip) {
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      // Centerline through nose tip (top of forehead to chin)
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(noseTip.x, noseTip.y);
      ctx.lineTo(chin.x, chin.y);
      ctx.stroke();

      // Loomis thirds: hairline -> brow, brow -> nose base, nose base -> chin
      // Use pupils as proxy for brow line height
      if (leftPupil && rightPupil) {
        const browY = (leftPupil.y + rightPupil.y) / 2 - halfWidth * 0.15;
        const noseBaseY = noseTip.y + halfWidth * 0.05;
        for (const y of [browY, noseBaseY]) {
          ctx.beginPath();
          ctx.moveTo(leftEar.x, y);
          ctx.lineTo(rightEar.x, y);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }

    // -------- REILLY rhythms --------
    if (showReilly && noseTip && leftMouth && rightMouth) {
      ctx.strokeStyle = "#fb7185";
      ctx.lineWidth = 1.6;

      // Brow-ridge anchors (use mediapipe brow corners 105/334 if present, fallback to interpolation)
      const browL = lms[105] ?? lerp(leftPupil ?? leftEar, top, 0.5);
      const browR = lms[334] ?? lerp(rightPupil ?? rightEar, top, 0.5);

      // Left cheek rhythm: mouth corner -> side of nose -> brow ridge -> side of head
      const leftNoseSide = lms[129] ?? lerp(noseTip, leftMouth, 0.4);
      ctx.beginPath();
      ctx.moveTo(leftMouth.x, leftMouth.y);
      ctx.quadraticCurveTo(leftNoseSide.x, leftNoseSide.y, browL.x, browL.y);
      ctx.stroke();

      // Right cheek rhythm: mirror
      const rightNoseSide = lms[358] ?? lerp(noseTip, rightMouth, 0.4);
      ctx.beginPath();
      ctx.moveTo(rightMouth.x, rightMouth.y);
      ctx.quadraticCurveTo(rightNoseSide.x, rightNoseSide.y, browR.x, browR.y);
      ctx.stroke();

      // Zygomatic arch curves: from below-ear forward to cheekbone, sweeping up
      const leftCheekBone = lms[123] ?? lerp(leftEar, noseTip, 0.4);
      ctx.beginPath();
      ctx.moveTo(leftEar.x, leftEar.y - halfWidth * 0.05);
      ctx.quadraticCurveTo(
        (leftEar.x + leftCheekBone.x) / 2,
        leftEar.y - halfWidth * 0.1,
        leftCheekBone.x,
        leftCheekBone.y
      );
      ctx.stroke();

      const rightCheekBone = lms[352] ?? lerp(rightEar, noseTip, 0.4);
      ctx.beginPath();
      ctx.moveTo(rightEar.x, rightEar.y - halfWidth * 0.05);
      ctx.quadraticCurveTo(
        (rightEar.x + rightCheekBone.x) / 2,
        rightEar.y - halfWidth * 0.1,
        rightCheekBone.x,
        rightCheekBone.y
      );
      ctx.stroke();

      // Jaw rhythm: ear -> jaw angle -> chin, a single flowing line each side
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(leftEar.x, leftEar.y);
      ctx.quadraticCurveTo(leftEar.x + (chin.x - leftEar.x) * 0.3, chin.y - totalHeight * 0.08, chin.x, chin.y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(rightEar.x, rightEar.y);
      ctx.quadraticCurveTo(rightEar.x + (chin.x - rightEar.x) * 0.3, chin.y - totalHeight * 0.08, chin.x, chin.y);
      ctx.stroke();
    }

    // -------- Reilly fat-pad oval (the egg-shape rhythm following cheek pads down to jowls) --------
    if (showFatPad && leftMouth && rightMouth) {
      const padCx = (leftMouth.x + rightMouth.x) / 2;
      const padCy = (leftMouth.y + rightMouth.y) / 2 + totalHeight * 0.05;
      const padW = Math.hypot(rightMouth.x - leftMouth.x, rightMouth.y - leftMouth.y) * 1.4;
      const padH = totalHeight * 0.42;
      ctx.strokeStyle = "#fb7185";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.ellipse(padCx, padCy, padW, padH, rollRad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  },
};
