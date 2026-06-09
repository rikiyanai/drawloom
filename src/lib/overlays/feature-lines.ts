import type { Overlay } from "./types";
import {
  LEFT_EYE,
  RIGHT_EYE,
  LIPS_OUTER,
  NOSE_BRIDGE,
  CHIN,
  LEFT_PUPIL,
  RIGHT_PUPIL,
  LEFT_MOUTH_CORNER,
  RIGHT_MOUTH_CORNER,
  LEFT_EAR,
  RIGHT_EAR,
  TOP_OF_FOREHEAD,
  NOSE_TIP,
  indicesToPts,
  drawJawLine,
  catmullRomOpen,
  type Pt,
} from "../pose/landmarks";

// Sight-size measurement guides and thin sliver curves for facial features.
// Replaces the previous "muscles" overlay which used vague filled polygons.
// Every guide here is either a single line, a single thin curve, or a small
// landmark dot — nothing filled, nothing approximated.

function vLine(ctx: CanvasRenderingContext2D, x: number, yTop: number, yBot: number) {
  ctx.beginPath();
  ctx.moveTo(x, yTop);
  ctx.lineTo(x, yBot);
  ctx.stroke();
}

function hLine(ctx: CanvasRenderingContext2D, y: number, xL: number, xR: number) {
  ctx.beginPath();
  ctx.moveTo(xL, y);
  ctx.lineTo(xR, y);
  ctx.stroke();
}

// Catmull-Rom spline through pts. Was previously midpoint-quadratic
// smoothing, which rounded corners and flattened the cupid's bow / eye
// corners. Catmull-Rom uses neighbor-tangent control points so the curve
// passes through every landmark and preserves sharper transitions.
function smoothOpenCurve(ctx: CanvasRenderingContext2D, pts: Pt[]) {
  catmullRomOpen(ctx, pts, 0.5);
}

// Eye contour landmark INDICES, split into upper and lower lid halves.
// MediaPipe LEFT_EYE = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7]
// Upper lid traces 33 -> 246 -> 161 -> 160 -> 159 -> 158 -> 157 -> 173 -> 133
// Lower lid traces 33 -> 7 -> 163 -> 144 -> 145 -> 153 -> 154 -> 155 -> 133
const LEFT_EYE_UPPER = [33, 246, 161, 160, 159, 158, 157, 173, 133];
const LEFT_EYE_LOWER = [33, 7, 163, 144, 145, 153, 154, 155, 133];
const RIGHT_EYE_UPPER = [263, 466, 388, 387, 386, 385, 384, 398, 362];
const RIGHT_EYE_LOWER = [263, 249, 390, 373, 374, 380, 381, 382, 362];

// Cupid's bow gullwing — upper lip top edge only (the M-shape).
// LIPS_OUTER goes around the whole mouth; the upper-lip top half is indices
// 61 -> 185 -> 40 -> 39 -> 37 -> 0 -> 267 -> 269 -> 270 -> 409 -> 291.
const CUPIDS_BOW = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291];

// Nose underside gullwing — the small M-curve where nostrils meet septum.
// Approximate with the nostril-base indices.
const NOSE_GULLWING = [98, 97, 2, 326, 327];

// Brow ridge curves
const LEFT_BROW_CURVE = [70, 63, 105, 66, 107];
const RIGHT_BROW_CURVE = [336, 296, 334, 293, 300];

export const featureLinesOverlay: Overlay = {
  id: "feature-lines",
  name: "Feature lines (sight-size guides)",
  category: "anatomy",
  description:
    "Precise measurement aids: vertical lines through eye corners, mouth corners, nostrils; horizontal lines at brow / pupils / nose-base / lip / chin; thin sliver curves for the cupid's bow and nose gullwing.",
  requiresFace: true,
  params: [
    { key: "eyeVerts", label: "Eye corner verticals (×4)", type: "toggle", default: true },
    { key: "eyeLids", label: "Eye lid curves", type: "toggle", default: true },
    { key: "browCurves", label: "Brow ridge curves", type: "toggle", default: true },
    { key: "noseCenter", label: "Nose centerline", type: "toggle", default: true },
    { key: "noseGull", label: "Nose underside gullwing", type: "toggle", default: true },
    { key: "cupidBow", label: "Cupid's bow gullwing", type: "toggle", default: true },
    { key: "lipLine", label: "Lip line (mouth opening)", type: "toggle", default: true },
    { key: "jawLine", label: "Jaw line (ear → chin → ear)", type: "toggle", default: false },
    { key: "mouthVerts", label: "Mouth corner verticals", type: "toggle", default: false },
    { key: "browHoriz", label: "Brow horizontal", type: "toggle", default: false },
    { key: "pupilHoriz", label: "Pupil horizontal", type: "toggle", default: false },
    { key: "noseBaseHoriz", label: "Nose-base horizontal", type: "toggle", default: false },
    { key: "lipHoriz", label: "Lip horizontal", type: "toggle", default: false },
    { key: "chinHoriz", label: "Chin horizontal", type: "toggle", default: false },
    { key: "lineWidth", label: "Line width", type: "slider", min: 0.5, max: 3, step: 0.25, default: 1.25 },
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 0.85 },
  ],
  render({ ctx, pose, width, height, params }) {
    if (!pose) return;
    const lms = pose.landmarks;
    const opacity = (params.opacity as number) ?? 0.85;
    const lineWidth = (params.lineWidth as number) ?? 1.25;

    const leftEye = indicesToPts(LEFT_EYE, lms);
    const rightEye = indicesToPts(RIGHT_EYE, lms);
    const lips = indicesToPts(LIPS_OUTER, lms);
    const noseBridge = indicesToPts(NOSE_BRIDGE, lms);
    const chin = lms[CHIN];
    const leftPupil = lms[LEFT_PUPIL];
    const rightPupil = lms[RIGHT_PUPIL];
    const leftMouth = lms[LEFT_MOUTH_CORNER];
    const rightMouth = lms[RIGHT_MOUTH_CORNER];
    const leftEar = lms[LEFT_EAR];
    const rightEar = lms[RIGHT_EAR];
    const top = lms[TOP_OF_FOREHEAD];
    const noseTip = lms[NOSE_TIP];

    const guideColor = "#fde68a"; // soft amber for measurement guides
    const sliverColor = "#fb7185"; // pink for feature slivers

    const xL = leftEar ? leftEar.x - 30 : 0;
    const xR = rightEar ? rightEar.x + 30 : width;
    const yT = top ? top.y - 30 : 0;
    const yB = chin ? chin.y + 30 : height;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = guideColor;

    // EYE CORNER VERTICALS — 4 vertical lines through the inner/outer eye corners
    if ((params.eyeVerts as boolean) ?? true) {
      const eyeAnchors: (Pt | undefined)[] = [
        leftEye[0],                              // left eye outer (33)
        leftEye[8],                              // left eye inner (133)
        rightEye[8],                             // right eye inner (362)
        rightEye[0],                             // right eye outer (263)
      ];
      for (const p of eyeAnchors) if (p) vLine(ctx, p.x, yT, yB);
    }

    // MOUTH CORNER VERTICALS
    if ((params.mouthVerts as boolean) ?? false) {
      for (const p of [leftMouth, rightMouth]) if (p) vLine(ctx, p.x, yT, yB);
    }

    // HORIZONTAL REFERENCE LINES
    if ((params.browHoriz as boolean) ?? false) {
      const browPts = indicesToPts([...LEFT_BROW_CURVE, ...RIGHT_BROW_CURVE], lms);
      if (browPts.length) {
        const browY = browPts.reduce((s, p) => s + p.y, 0) / browPts.length;
        hLine(ctx, browY, xL, xR);
      }
    }
    if (((params.pupilHoriz as boolean) ?? false) && leftPupil && rightPupil) {
      hLine(ctx, (leftPupil.y + rightPupil.y) / 2, xL, xR);
    }
    if ((params.noseBaseHoriz as boolean) ?? false) {
      const noseBase = lms[2];
      if (noseBase) hLine(ctx, noseBase.y, xL, xR);
    }
    if (((params.lipHoriz as boolean) ?? false) && leftMouth && rightMouth) {
      hLine(ctx, (leftMouth.y + rightMouth.y) / 2, xL, xR);
    }
    if (((params.chinHoriz as boolean) ?? false) && chin) {
      hLine(ctx, chin.y, xL, xR);
    }

    // NOSE CENTERLINE
    if (((params.noseCenter as boolean) ?? true) && noseTip && top) {
      ctx.beginPath();
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(noseTip.x, noseTip.y);
      ctx.stroke();
    }

    // FEATURE SLIVER CURVES
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = sliverColor;

    if ((params.eyeLids as boolean) ?? true) {
      smoothOpenCurve(ctx, indicesToPts(LEFT_EYE_UPPER, lms));
      smoothOpenCurve(ctx, indicesToPts(LEFT_EYE_LOWER, lms));
      smoothOpenCurve(ctx, indicesToPts(RIGHT_EYE_UPPER, lms));
      smoothOpenCurve(ctx, indicesToPts(RIGHT_EYE_LOWER, lms));
    }

    if ((params.browCurves as boolean) ?? true) {
      smoothOpenCurve(ctx, indicesToPts(LEFT_BROW_CURVE, lms));
      smoothOpenCurve(ctx, indicesToPts(RIGHT_BROW_CURVE, lms));
    }

    if ((params.cupidBow as boolean) ?? true) {
      smoothOpenCurve(ctx, indicesToPts(CUPIDS_BOW, lms));
    }

    if ((params.noseGull as boolean) ?? true) {
      smoothOpenCurve(ctx, indicesToPts(NOSE_GULLWING, lms));
    }

    if ((params.jawLine as boolean) ?? false) {
      ctx.strokeStyle = sliverColor;
      ctx.lineWidth = lineWidth + 0.4;
      drawJawLine(ctx, lms);
    }

    if (((params.lipLine as boolean) ?? true) && lips.length > 8) {
      // Gullwing lip-closure line: traces the bottom edge of the upper lip
      // (which is the seam where the lips meet from the outside view). This
      // produces the classic M-shape — peaks at the cupid's bow on the
      // tubercles, dip at the philtrum notch, sweep down to the corners.
      //
      // Landmarks taken from the top half of LIPS_INNER (MediaPipe convention:
      // upper-lip-bottom edge, corner to corner, left to right).
      const GULLWING_IDXS = [61, 76, 184, 74, 73, 72, 11, 302, 303, 304, 408, 306, 291];
      const pts = GULLWING_IDXS.map((i) => lms[i]).filter(Boolean) as Pt[];
      if (pts.length >= 3) {
        // Catmull-Rom through the lip-closure landmarks for a smooth M-curve.
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
      }
    }

    void noseBridge;
    ctx.restore();
  },
};
