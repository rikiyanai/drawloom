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
  catmullRomOpen,
  catmullRomLoop,
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
// chin / sternal notch) match the labelled stack on the Khang Ta sheet.
// Sternal-notch line only appears when the user has enabled body pose
// (MediaPipe Pose Landmarker) and shoulders are visible — it draws at the
// midpoint between the left/right shoulder landmarks.

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
  name: "Reilly rhythms",
  category: "construction",
  description:
    "Reilly rhythm shapes (left/right eye-cheek C, central feature lozenge, jaw ovoid) modeled on the Khang Ta 'Rhythms of the Head' reference sheet. For the Loomis cranium + side disks + great-circles, enable the dedicated 'Loomis head' overlay — it owns that geometry as a projected 3D construction.",
  requiresFace: true,
  params: [
    { key: "centerline", label: "Centerline", type: "toggle", default: true },
    { key: "eyeCheekC", label: "Eye-cheek C (left + right)", type: "toggle", default: true },
    { key: "featureLozenge", label: "Central feature lozenge", type: "toggle", default: true },
    { key: "jawOvoid", label: "Jaw ovoid (ear → chin → ear)", type: "toggle", default: true },
    { key: "propLabels", label: "Proportion labels", type: "toggle", default: false },
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 0.8 },
  ],
  render({ ctx, pose, bodyPose, params }) {
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
    const showCenter = (params.centerline as boolean) ?? true;
    const showEyeCheekC = (params.eyeCheekC as boolean) ?? true;
    const showLozenge = (params.featureLozenge as boolean) ?? true;
    const showJawOvoid = (params.jawOvoid as boolean) ?? true;
    const showPropLabels = (params.propLabels as boolean) ?? false;

    const halfWidth = Math.hypot(rightEar.x - leftEar.x, rightEar.y - leftEar.y) / 2;
    const totalHeight = chin.y - top.y;
    const { roll } = pose.angles;
    const rollRad = (roll * Math.PI) / 180;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.lineWidth = 1.5;

    // -------- Centerline (true central contour, not a 3-point polyline) --------
    if (showCenter) {
      // Trace the actual midline landmarks so the centerline curves through
      // the brow/nose/lip ridge instead of cutting straight from top->tip->chin.
      const CENTERLINE_IDXS = [10, 151, 9, 168, 6, 197, 195, 1, 19, 164, 0, 17, 200, 152];
      const pts = CENTERLINE_IDXS.map((i) => lms[i]).filter(Boolean) as { x: number; y: number }[];
      if (pts.length >= 3) {
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[i - 1] ?? pts[i];
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const p3 = pts[i + 2] ?? p2;
          const c1x = p1.x + (p2.x - p0.x) / 6;
          const c1y = p1.y + (p2.y - p0.y) / 6;
          const c2x = p2.x - (p3.x - p1.x) / 6;
          const c2y = p2.y - (p3.y - p1.y) / 6;
          ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
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

      // Sternal-notch line — only when MediaPipe Pose Landmarker is active
      // and both shoulders are reasonably visible (visibility >= 0.5).
      if (bodyPose && bodyPose.landmarks.length >= 13) {
        const lShoulder = bodyPose.landmarks[11];
        const rShoulder = bodyPose.landmarks[12];
        if (lShoulder && rShoulder && lShoulder.visibility >= 0.5 && rShoulder.visibility >= 0.5) {
          // Sternal notch sits just above the shoulder midpoint, ~10% of
          // shoulder-width upward (toward the throat).
          const sCx = (lShoulder.x + rShoulder.x) / 2;
          const sCy = (lShoulder.y + rShoulder.y) / 2;
          const shoulderWidth = Math.hypot(rShoulder.x - lShoulder.x, rShoulder.y - lShoulder.y);
          const notchY = sCy - shoulderWidth * 0.1;
          // Only draw if the notch is actually below the chin — otherwise
          // the body model has picked up the head and would draw garbage.
          if (notchY > chin.y) {
            const sxL = Math.min(lShoulder.x, rShoulder.x) - 10;
            const sxR = Math.max(lShoulder.x, rShoulder.x) + 10;
            labelLine(ctx, notchY, sxL, sxR, "sternal notch");
          }
        }
      }

      ctx.setLineDash([]);
    }

    // -------- Reilly: eye-cheek "C" rhythms --------
    // Traced through actual MediaPipe landmarks per side and smoothed with a
    // Catmull-Rom open curve. Path: outer brow -> outer eye corner -> ear
    // (temple) -> jaw-side -> mouth corner -> nose-side -> inner brow. That
    // sequence wraps the eye+cheek mass with the open side facing center,
    // which is what Khang Ta's C-rhythm encloses.
    if (showEyeCheekC && leftMouth && rightMouth) {
      ctx.strokeStyle = "#fb7185";
      ctx.lineWidth = 1.6;
      // LEFT C — landmarks confirmed on the left perimeter of the eye-cheek mass.
      const leftCPath: Pt[] = [70, 33, 234, 132, 61, 102, 105]
        .map((i) => lms[i])
        .filter(Boolean) as Pt[];
      if (leftCPath.length >= 3) catmullRomOpen(ctx, leftCPath, 0.5);
      // RIGHT C — mirror set.
      const rightCPath: Pt[] = [300, 263, 454, 361, 291, 331, 334]
        .map((i) => lms[i])
        .filter(Boolean) as Pt[];
      if (rightCPath.length >= 3) catmullRomOpen(ctx, rightCPath, 0.5);
    }

    // -------- Reilly: central feature lozenge --------
    // Traced as a Catmull-Rom loop through real perimeter landmarks
    // (glabella, brow ends, mouth corners, chin) instead of bezier control
    // points with magic offsets from halfWidth.
    if (showLozenge && leftMouth && rightMouth) {
      ctx.strokeStyle = "#fb7185";
      ctx.lineWidth = 1.5;
      // Glabella (9) anchors the top; if missing, fall back to midpoint of brow tips.
      const glabella = lms[9] ?? {
        x: ((lms[105]?.x ?? top.x) + (lms[334]?.x ?? top.x)) / 2,
        y: ((lms[105]?.y ?? top.y) + (lms[334]?.y ?? top.y)) / 2,
      };
      const lBrow = lms[105];
      const rBrow = lms[334];
      const loopPath: Pt[] = [
        glabella,
        ...(lBrow ? [lBrow] : []),
        leftMouth,
        chin,
        rightMouth,
        ...(rBrow ? [rBrow] : []),
      ];
      if (loopPath.length >= 4) catmullRomLoop(ctx, loopPath, 0.5);
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
