import type { Overlay } from "./types";
import {
  FACE_OVAL,
  LEFT_EYE,
  RIGHT_EYE,
  LIPS_OUTER,
  LEFT_BROW,
  RIGHT_BROW,
  NOSE_BRIDGE,
  indicesToPts,
  smoothRingPath,
  type Pt,
} from "../pose/landmarks";

// Anatomical-region landmark groupings. These approximate the visible
// superficial muscles of the face by anchoring polygons to MediaPipe Face Mesh
// landmarks. Not anatomically perfect — intended as a study overlay for
// understanding form, not as a medical reference.

// Frontalis — forehead, broad sheet from brows to hairline.
const FRONTALIS = [109, 67, 103, 54, 21, 162, 127, 234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454, 356, 389, 251, 284, 332, 297, 338];
// Subset closer to actual frontalis (above brows up to forehead top)
const FRONTALIS_SHAPE = [109, 67, 103, 54, 68, 71, 9, 8, 285, 334, 296, 336, 9, 151, 10, 109];

// Zygomaticus major (smile muscle) — from cheekbone toward mouth corner
const ZYGO_LEFT = [123, 50, 205, 36, 142, 203, 165, 92, 186, 57, 43];
const ZYGO_RIGHT = [352, 280, 425, 266, 371, 423, 391, 322, 410, 287, 273];

// Masseter — jaw muscle, side of cheek over the mandible
const MASSETER_LEFT = [127, 234, 93, 132, 58, 172, 136, 150];
const MASSETER_RIGHT = [356, 454, 323, 361, 288, 397, 365, 379];

// Mentalis — chin
const MENTALIS = [194, 201, 200, 421, 418, 175, 199, 194];

// Buccinator-ish region (cheek hollow)
const CHEEK_LEFT = [216, 206, 203, 36, 142, 209, 49, 131];
const CHEEK_RIGHT = [436, 426, 423, 266, 371, 429, 279, 360];

function drawFilledRegion(
  ctx: CanvasRenderingContext2D,
  lms: Pt[],
  idxs: number[],
  fillStyle: string,
  strokeStyle: string,
  lineWidth: number,
  label?: string
) {
  const pts = indicesToPts(idxs, lms);
  if (pts.length < 3) return;
  smoothRingPath(ctx, pts);
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.strokeStyle = strokeStyle;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  if (label) {
    let cx = 0, cy = 0;
    for (const p of pts) { cx += p.x; cy += p.y; }
    cx /= pts.length; cy /= pts.length;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, cx, cy);
  }
}

export const anatomyOverlay: Overlay = {
  id: "anatomy",
  name: "Skeleton + muscles",
  category: "anatomy",
  description:
    "Skull outline + major superficial face muscles (frontalis, orbicularis oculi/oris, zygomaticus, masseter, mentalis) approximated from MediaPipe landmark groups.",
  requiresFace: true,
  params: [
    { key: "skull", label: "Skull / face oval", type: "toggle", default: true },
    { key: "muscles", label: "Muscle groups", type: "toggle", default: true },
    { key: "labels", label: "Muscle labels", type: "toggle", default: false },
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 0.55 },
  ],
  render({ ctx, pose, params }) {
    if (!pose) return;
    const lms = pose.landmarks;
    const opacity = (params.opacity as number) ?? 0.55;
    const showSkull = (params.skull as boolean) ?? true;
    const showMuscles = (params.muscles as boolean) ?? true;
    const labels = (params.labels as boolean) ?? false;

    ctx.save();
    ctx.globalAlpha = opacity;

    if (showSkull) {
      // Skull / face oval as a bone-white outline
      const pts = indicesToPts(FACE_OVAL, lms);
      smoothRingPath(ctx, pts);
      ctx.strokeStyle = "#f5f5f4";
      ctx.lineWidth = 2;
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Jaw shadow line for skull depth
      const jaw = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152,
                   377, 400, 378, 379, 365, 397, 288, 361, 323, 454];
      const jawPts = indicesToPts(jaw, lms);
      if (jawPts.length > 2) {
        ctx.beginPath();
        ctx.moveTo(jawPts[0].x, jawPts[0].y);
        for (let i = 1; i < jawPts.length; i++) ctx.lineTo(jawPts[i].x, jawPts[i].y);
        ctx.strokeStyle = "#d6d3d1";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    if (showMuscles) {
      // Each muscle group: warm tint fill + slightly darker outline
      const muscleFill = "rgba(239, 68, 68, 0.32)";
      const muscleStroke = "rgba(220, 38, 38, 0.85)";

      // Frontalis (forehead sheet)
      drawFilledRegion(ctx, lms, FRONTALIS_SHAPE, "rgba(244, 114, 182, 0.28)", "rgba(219, 39, 119, 0.85)", 1, labels ? "frontalis" : undefined);

      // Orbicularis oculi (around each eye)
      drawFilledRegion(ctx, lms, LEFT_EYE, muscleFill, muscleStroke, 1, labels ? "orb. oculi" : undefined);
      drawFilledRegion(ctx, lms, RIGHT_EYE, muscleFill, muscleStroke, 1, labels ? "orb. oculi" : undefined);

      // Brow corrugator (approx with brow ring)
      drawFilledRegion(ctx, lms, LEFT_BROW, "rgba(168, 85, 247, 0.28)", "rgba(126, 34, 206, 0.85)", 1, labels ? "corrugator" : undefined);
      drawFilledRegion(ctx, lms, RIGHT_BROW, "rgba(168, 85, 247, 0.28)", "rgba(126, 34, 206, 0.85)", 1, undefined);

      // Orbicularis oris (around mouth)
      drawFilledRegion(ctx, lms, LIPS_OUTER, "rgba(251, 113, 133, 0.34)", "rgba(225, 29, 72, 0.85)", 1, labels ? "orb. oris" : undefined);

      // Zygomaticus major (smile sling, cheekbone → mouth corner)
      drawFilledRegion(ctx, lms, ZYGO_LEFT, "rgba(249, 115, 22, 0.28)", "rgba(194, 65, 12, 0.85)", 1, labels ? "zygomaticus" : undefined);
      drawFilledRegion(ctx, lms, ZYGO_RIGHT, "rgba(249, 115, 22, 0.28)", "rgba(194, 65, 12, 0.85)", 1, undefined);

      // Masseter (jaw)
      drawFilledRegion(ctx, lms, MASSETER_LEFT, "rgba(132, 204, 22, 0.22)", "rgba(77, 124, 15, 0.85)", 1, labels ? "masseter" : undefined);
      drawFilledRegion(ctx, lms, MASSETER_RIGHT, "rgba(132, 204, 22, 0.22)", "rgba(77, 124, 15, 0.85)", 1, undefined);

      // Buccinator / cheek hollow
      drawFilledRegion(ctx, lms, CHEEK_LEFT, "rgba(56, 189, 248, 0.18)", "rgba(2, 132, 199, 0.6)", 1, undefined);
      drawFilledRegion(ctx, lms, CHEEK_RIGHT, "rgba(56, 189, 248, 0.18)", "rgba(2, 132, 199, 0.6)", 1, undefined);

      // Mentalis (chin)
      drawFilledRegion(ctx, lms, MENTALIS, "rgba(234, 179, 8, 0.32)", "rgba(161, 98, 7, 0.85)", 1, labels ? "mentalis" : undefined);

      // Nose bridge (procerus / nasalis area as a stroked line)
      const nose = indicesToPts(NOSE_BRIDGE, lms);
      if (nose.length > 1) {
        ctx.beginPath();
        ctx.moveTo(nose[0].x, nose[0].y);
        for (let i = 1; i < nose.length; i++) ctx.lineTo(nose[i].x, nose[i].y);
        ctx.strokeStyle = "rgba(244, 114, 182, 0.9)";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Silence unused var lint
    void FRONTALIS;
    ctx.restore();
  },
};
