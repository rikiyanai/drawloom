// MediaPipe Face Mesh canonical landmark groups.
// Source: github.com/google-ai-edge/mediapipe (FACEMESH_* constants),
// translated from point pairs to ordered rings.

export const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365,
  379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
  234, 127, 162, 21, 54, 103, 67, 109,
];

export const LIPS_OUTER = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409,
  291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
];

export const LIPS_INNER = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415,
  308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
];

export const LEFT_EYE = [
  33, 246, 161, 160, 159, 158, 157, 173,
  133, 155, 154, 153, 145, 144, 163, 7,
];

export const RIGHT_EYE = [
  263, 466, 388, 387, 386, 385, 384, 398,
  362, 382, 381, 380, 374, 373, 390, 249,
];

export const LEFT_BROW = [70, 63, 105, 66, 107];
export const RIGHT_BROW = [336, 296, 334, 293, 300];

export const NOSE_BRIDGE = [168, 6, 197, 195, 5, 4];
export const NOSE_BOTTOM = [129, 64, 98, 97, 2, 326, 327, 294, 358];

// Iris (only present when iris refinement is on — default in face_landmarker.task)
export const LEFT_IRIS = [468, 469, 470, 471, 472];
export const RIGHT_IRIS = [473, 474, 475, 476, 477];

// Single useful anchors
export const TOP_OF_FOREHEAD = 10;
export const CHIN = 152;
export const NOSE_TIP = 1;
export const LEFT_EAR = 234;
export const RIGHT_EAR = 454;
export const LEFT_PUPIL = 468;
export const RIGHT_PUPIL = 473;
export const LEFT_MOUTH_CORNER = 61;
export const RIGHT_MOUTH_CORNER = 291;
export const LEFT_NOSTRIL = 219;
export const RIGHT_NOSTRIL = 439;

export type Pt = { x: number; y: number; z?: number };

/** Draw a smooth ring through pts (Bezier control points at every other landmark). */
export function smoothRingPath(ctx: CanvasRenderingContext2D, pts: Pt[]): void {
  if (pts.length < 3) return;
  const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  ctx.beginPath();
  const start = mid(pts[pts.length - 1], pts[0]);
  ctx.moveTo(start.x, start.y);
  for (let i = 0; i < pts.length; i++) {
    const next = pts[(i + 1) % pts.length];
    const m = mid(pts[i], next);
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, m.x, m.y);
  }
}

export function indicesToPts(idxs: number[], lms: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const i of idxs) {
    const p = lms[i];
    if (p) out.push(p);
  }
  return out;
}
