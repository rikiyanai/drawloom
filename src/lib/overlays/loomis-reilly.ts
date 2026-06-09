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
// Loomis half: cranium sphere, side-plane cut, brow great-circle, jaw stub —
// all rotated by the detected head angle.
//
// Reilly half: rewritten to match Khang Ta's "Rhythms of the Head" reference
// sheet. Three repeating shapes:
//   1. Left + right eye-cheek "C" — a large C-curve wrapping each eye-and-
//      cheek mass, opening toward the centerline.
//   2. Central feature lozenge — a vertical almond shape down the middle
//      of the face, enclosing brow / nose / mouth.
//   3. Jaw ovoid — a single ellipse from ear to ear via the chin, enclosing
//      the lower-face mass.
//
// Optional proportion-label horizontals (top / hair / brow / eye / nose /
// chin) match the labelled stack on the Khang Ta sheet. Sternal notch is
// omitted — needs body pose, not face landmarks.

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function labelLine(
  ctx: CanvasRenderingContext2D,
  y: number,
  xL: number,
  xR: number,
  label: string
) {
  ctx.beginPath();
  ctx.moveTo(xL, y);
  ctx.lineTo(xR, y);
  ctx.stroke();
  ctx.fillText(label, xR + 6, y + 3);
}

export const loomisReillyOverlay: Overlay = {
  id: "loomis-reilly",
  name: "Loomis + Reilly construction",
  category: "construction",
  description:
    "Loomis volumetric cranium + Reilly rhythm shapes (left/right eye-cheek C, central feature lozenge, jaw ovoid) modeled on the Khang Ta 'Rhythms of the Head' reference sheet.",
  requiresFace: true,
  params: [
    { key: "loomis", label: "Loomis sphere + cut", type: "toggle", default: true },
    { key: "centerline", label: "Centerline", type: "toggle", default: true },
    { key: "eyeCheekC", label: "Eye-cheek C (left + right)", type: "toggle", default: true },
    { key: "featureLozenge", label: "Central feature lozenge", type: "toggle", default: true },
    { key: "jawOvoid", label: "Jaw ovoid (ear → chin → ear)", type: "toggle", default: true },
    { key: "propLabels", label: "Proportion labels", type: "toggle", default: false },
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
    const showEyeCheekC = (params.eyeCheekC as boolean) ?? true;
    const showLozenge = (params.featureLozenge as boolean) ?? true;
    const showJawOvoid = (params.jawOvoid as boolean) ?? true;
    const showPropLabels = (params.propLabels as boolean) ?? false;

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

    // -------- LOOMIS sphere block --------
    if (showLoomis) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rollRad);
      ctx.strokeStyle = "#22d3ee";

      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();

      const cutOffset = radius * Math.sin(yawRad) * 0.7;
      ctx.beginPath();
      ctx.ellipse(cutOffset, 0, radius * 0.2, radius * Math.cos(yawRad) * 0.95, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.ellipse(0, radius * Math.sin(pitchRad) * 0.35, radius * Math.cos(yawRad), radius * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();

      const jawY = radius * 0.85;
      const jawW = radius * 0.6;
      ctx.beginPath();
      ctx.moveTo(-jawW + cutOffset, jawY * 0.4);
      ctx.quadraticCurveTo(cutOffset, jawY * 1.7, jawW + cutOffset, jawY * 0.4);
      ctx.stroke();

      ctx.restore();
    }

    // -------- Centerline + proportion labels --------
    if (showCenter && noseTip) {
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(noseTip.x, noseTip.y);
      ctx.lineTo(chin.x, chin.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (showPropLabels && leftPupil && rightPupil && noseTip) {
      ctx.strokeStyle = "#fde68a";
      ctx.fillStyle = "#fde68a";
      ctx.lineWidth = 1;
      ctx.font = "11px system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.setLineDash([6, 4]);
      const xL = leftEar.x - 10;
      const xR = rightEar.x + 10;
      const browY = (leftPupil.y + rightPupil.y) / 2 - halfWidth * 0.15;
      const eyeY = (leftPupil.y + rightPupil.y) / 2;
      const noseBaseY = noseTip.y + halfWidth * 0.05;
      // Hair/top approximated from forehead landmark + small offset upward
      const hairY = top.y + totalHeight * 0.08;
      labelLine(ctx, top.y, xL, xR, "top of head");
      labelLine(ctx, hairY, xL, xR, "hair");
      labelLine(ctx, browY, xL, xR, "brow");
      labelLine(ctx, eyeY, xL, xR, "eye");
      labelLine(ctx, noseBaseY, xL, xR, "nose");
      labelLine(ctx, chin.y, xL, xR, "chin");
      ctx.setLineDash([]);
    }

    // -------- Reilly: eye-cheek "C" rhythms --------
    if (showEyeCheekC && leftPupil && rightPupil && leftMouth && rightMouth) {
      ctx.strokeStyle = "#fb7185";
      ctx.lineWidth = 1.6;

      // LEFT C — wraps left eye + left cheek mass, opens to the right (toward center).
      // Top anchor: above + outside the left brow. Outer anchor: outside cheekbone.
      // Bottom anchor: below cheek toward mouth corner. Inner anchor: nose side.
      const lTop = { x: leftPupil.x - halfWidth * 0.15, y: leftPupil.y - halfWidth * 0.35 };
      const lOuter = { x: leftEar.x + halfWidth * 0.1, y: leftPupil.y + halfWidth * 0.1 };
      const lBottom = { x: leftMouth.x - halfWidth * 0.05, y: leftMouth.y - halfWidth * 0.05 };
      const lInner = { x: noseTip ? noseTip.x - halfWidth * 0.18 : lTop.x, y: noseTip ? noseTip.y : lTop.y };
      ctx.beginPath();
      ctx.moveTo(lTop.x, lTop.y);
      ctx.bezierCurveTo(
        lTop.x - halfWidth * 0.25, lTop.y + halfWidth * 0.1,
        lOuter.x, lOuter.y - halfWidth * 0.15,
        lOuter.x, lOuter.y
      );
      ctx.bezierCurveTo(
        lOuter.x, lOuter.y + halfWidth * 0.3,
        lBottom.x + halfWidth * 0.1, lBottom.y,
        lBottom.x, lBottom.y
      );
      // Inner sweep (the open inner side of the C)
      ctx.bezierCurveTo(
        lInner.x + halfWidth * 0.1, lBottom.y - halfWidth * 0.1,
        lInner.x, lInner.y - halfWidth * 0.05,
        lInner.x, lInner.y - halfWidth * 0.3
      );
      ctx.stroke();

      // RIGHT C — mirror
      const rTop = { x: rightPupil.x + halfWidth * 0.15, y: rightPupil.y - halfWidth * 0.35 };
      const rOuter = { x: rightEar.x - halfWidth * 0.1, y: rightPupil.y + halfWidth * 0.1 };
      const rBottom = { x: rightMouth.x + halfWidth * 0.05, y: rightMouth.y - halfWidth * 0.05 };
      const rInner = { x: noseTip ? noseTip.x + halfWidth * 0.18 : rTop.x, y: noseTip ? noseTip.y : rTop.y };
      ctx.beginPath();
      ctx.moveTo(rTop.x, rTop.y);
      ctx.bezierCurveTo(
        rTop.x + halfWidth * 0.25, rTop.y + halfWidth * 0.1,
        rOuter.x, rOuter.y - halfWidth * 0.15,
        rOuter.x, rOuter.y
      );
      ctx.bezierCurveTo(
        rOuter.x, rOuter.y + halfWidth * 0.3,
        rBottom.x - halfWidth * 0.1, rBottom.y,
        rBottom.x, rBottom.y
      );
      ctx.bezierCurveTo(
        rInner.x - halfWidth * 0.1, rBottom.y - halfWidth * 0.1,
        rInner.x, rInner.y - halfWidth * 0.05,
        rInner.x, rInner.y - halfWidth * 0.3
      );
      ctx.stroke();
    }

    // -------- Reilly: central feature lozenge --------
    if (showLozenge && noseTip && leftMouth && rightMouth) {
      ctx.strokeStyle = "#fb7185";
      ctx.lineWidth = 1.5;
      const browL = lms[105] ?? lerp(leftPupil ?? leftEar, top, 0.5);
      const browR = lms[334] ?? lerp(rightPupil ?? rightEar, top, 0.5);
      const browMid = { x: (browL.x + browR.x) / 2, y: (browL.y + browR.y) / 2 };
      const mouthMid = { x: (leftMouth.x + rightMouth.x) / 2, y: (leftMouth.y + rightMouth.y) / 2 };
      const widthAtNose = halfWidth * 0.55;
      const widthAtMouth = Math.hypot(rightMouth.x - leftMouth.x, rightMouth.y - leftMouth.y) * 0.65;
      ctx.beginPath();
      // Top apex (above brows)
      ctx.moveTo(browMid.x, browMid.y - halfWidth * 0.05);
      // Down left side: brow -> nose-tip-left -> mouth-corner-left -> chin
      ctx.bezierCurveTo(
        browMid.x - widthAtNose * 0.5, (browMid.y + noseTip.y) / 2,
        noseTip.x - widthAtNose, noseTip.y,
        mouthMid.x - widthAtMouth, mouthMid.y
      );
      ctx.bezierCurveTo(
        mouthMid.x - widthAtMouth * 0.6, (mouthMid.y + chin.y) / 2,
        chin.x - halfWidth * 0.15, chin.y - halfWidth * 0.05,
        chin.x, chin.y
      );
      // Up right side: chin -> mouth-corner-right -> nose-tip-right -> brow
      ctx.bezierCurveTo(
        chin.x + halfWidth * 0.15, chin.y - halfWidth * 0.05,
        mouthMid.x + widthAtMouth * 0.6, (mouthMid.y + chin.y) / 2,
        mouthMid.x + widthAtMouth, mouthMid.y
      );
      ctx.bezierCurveTo(
        noseTip.x + widthAtNose, noseTip.y,
        browMid.x + widthAtNose * 0.5, (browMid.y + noseTip.y) / 2,
        browMid.x, browMid.y - halfWidth * 0.05
      );
      ctx.stroke();
    }

    // -------- Reilly: jaw ovoid --------
    if (showJawOvoid) {
      ctx.strokeStyle = "#fb7185";
      ctx.lineWidth = 1.3;
      ctx.setLineDash([5, 5]);
      // Ellipse centered between ears, vertically positioned around the jaw mid.
      const jawCx = (leftEar.x + rightEar.x) / 2;
      const jawCy = ((leftEar.y + rightEar.y) / 2 + chin.y) / 2 + totalHeight * 0.06;
      const jawHalfW = halfWidth * 0.95;
      const jawHalfH = Math.abs(chin.y - jawCy) * 1.05;
      ctx.beginPath();
      ctx.ellipse(jawCx, jawCy, jawHalfW, jawHalfH, rollRad, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  },
};
