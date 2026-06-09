import type { Overlay } from "./types";
import {
  FACE_OVAL,
  LEFT_EAR,
  RIGHT_EAR,
  CHIN,
  TOP_OF_FOREHEAD,
  indicesToPts,
  smoothRingPath,
  type Pt,
} from "../pose/landmarks";

// Detailed skull underlay: cranium, orbits, zygomatic arches, nasal aperture,
// maxilla, mandible angle. Anchored to MediaPipe landmarks. Approximate by
// design — this is a study aid for understanding the form beneath the face,
// not a medical-grade reconstruction.

// Eye-socket (orbit) ring — expanded outward from eye landmarks since the
// actual bony orbit is larger than the visible eyelid opening.
const LEFT_ORBIT = [156, 70, 63, 105, 66, 107, 55, 193, 245, 188, 174, 198, 209, 49, 131];
const RIGHT_ORBIT = [383, 300, 293, 334, 296, 336, 285, 417, 465, 412, 399, 420, 429, 279, 360];

// Nasal aperture (pyriform opening) — heart-shaped opening of the skull at the nose
const NASAL_APERTURE = [193, 245, 188, 174, 217, 198, 209, 49, 131, 134, 51, 5, 281, 363, 360, 279, 429, 420, 399, 412, 465, 417];

// Zygomatic arch — bony arch from temple area forward to cheekbone
const ZYGO_ARCH_LEFT = [54, 21, 162, 127, 234, 93, 132, 215, 138, 192, 213, 147, 123, 50];
const ZYGO_ARCH_RIGHT = [284, 251, 389, 356, 454, 323, 361, 435, 367, 416, 433, 376, 352, 280];

// Mandible (jaw bone) — explicit jaw chain
const MANDIBLE = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152,
                  377, 400, 378, 379, 365, 397, 288, 361, 323, 454];

// Mandible ramus + angle — the vertical part of the jaw bone behind the molars
const MANDIBLE_RAMUS_LEFT = [234, 93, 132, 215];
const MANDIBLE_RAMUS_RIGHT = [454, 323, 361, 435];

function strokePath(ctx: CanvasRenderingContext2D, pts: Pt[], close: boolean) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (close) ctx.closePath();
  ctx.stroke();
}

export const skeletonOverlay: Overlay = {
  id: "skeleton",
  name: "Skeleton underlay (skull)",
  category: "anatomy",
  description:
    "Detailed skull bones beneath the skin: cranium, eye orbits, nasal aperture, zygomatic arch, mandible. Approximated from MediaPipe landmark groups.",
  requiresFace: true,
  params: [
    { key: "cranium", label: "Cranium / face oval", type: "toggle", default: true },
    { key: "orbits", label: "Eye orbits", type: "toggle", default: true },
    { key: "nasal", label: "Nasal aperture", type: "toggle", default: true },
    { key: "zygo", label: "Zygomatic arch", type: "toggle", default: true },
    { key: "mandible", label: "Mandible", type: "toggle", default: true },
    { key: "fill", label: "Bone tint fill", type: "toggle", default: false },
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 0.8 },
  ],
  render({ ctx, pose, params }) {
    if (!pose) return;
    const lms = pose.landmarks;
    const opacity = (params.opacity as number) ?? 0.8;
    const fill = (params.fill as boolean) ?? false;
    const top = lms[TOP_OF_FOREHEAD];
    const chin = lms[CHIN];
    const leftEar = lms[LEFT_EAR];
    const rightEar = lms[RIGHT_EAR];

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = "rgba(0,0,0,0.6)";
    ctx.shadowBlur = 2;

    const boneStroke = "#fafaf9";
    const boneFill = "rgba(250, 250, 249, 0.10)";

    // Cranium — face oval upper half emphasized
    if ((params.cranium as boolean) ?? true) {
      const pts = indicesToPts(FACE_OVAL, lms);
      smoothRingPath(ctx, pts);
      if (fill) {
        ctx.fillStyle = boneFill;
        ctx.fill();
      }
      ctx.strokeStyle = boneStroke;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Brow ridge (frontal bone) — across landmark 9 / 10
      if (top && leftEar && rightEar) {
        const browY = top.y + (chin ? (chin.y - top.y) * 0.32 : 50);
        ctx.beginPath();
        ctx.moveTo(leftEar.x + (top.x - leftEar.x) * 0.2, browY);
        ctx.quadraticCurveTo(top.x, browY - 6, rightEar.x - (rightEar.x - top.x) * 0.2, browY);
        ctx.strokeStyle = boneStroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Orbits
    if ((params.orbits as boolean) ?? true) {
      ctx.strokeStyle = boneStroke;
      ctx.lineWidth = 1.5;
      const leftOrbit = indicesToPts(LEFT_ORBIT, lms);
      const rightOrbit = indicesToPts(RIGHT_ORBIT, lms);
      if (leftOrbit.length > 4) {
        smoothRingPath(ctx, leftOrbit);
        if (fill) { ctx.fillStyle = boneFill; ctx.fill(); }
        ctx.stroke();
      }
      if (rightOrbit.length > 4) {
        smoothRingPath(ctx, rightOrbit);
        if (fill) { ctx.fillStyle = boneFill; ctx.fill(); }
        ctx.stroke();
      }
    }

    // Nasal aperture
    if ((params.nasal as boolean) ?? true) {
      const pts = indicesToPts(NASAL_APERTURE, lms);
      if (pts.length > 5) {
        smoothRingPath(ctx, pts);
        if (fill) { ctx.fillStyle = boneFill; ctx.fill(); }
        ctx.strokeStyle = boneStroke;
        ctx.lineWidth = 1.3;
        ctx.stroke();
      }
    }

    // Zygomatic arches (cheekbones)
    if ((params.zygo as boolean) ?? true) {
      ctx.strokeStyle = boneStroke;
      ctx.lineWidth = 1.4;
      strokePath(ctx, indicesToPts(ZYGO_ARCH_LEFT, lms), false);
      strokePath(ctx, indicesToPts(ZYGO_ARCH_RIGHT, lms), false);
    }

    // Mandible — jaw bone with ramus emphasis at the angle
    if ((params.mandible as boolean) ?? true) {
      ctx.strokeStyle = boneStroke;
      ctx.lineWidth = 1.8;
      strokePath(ctx, indicesToPts(MANDIBLE, lms), false);
      ctx.lineWidth = 1.4;
      strokePath(ctx, indicesToPts(MANDIBLE_RAMUS_LEFT, lms), false);
      strokePath(ctx, indicesToPts(MANDIBLE_RAMUS_RIGHT, lms), false);
    }

    ctx.restore();
  },
};
