import type { Overlay } from "./types";

// MediaPipe landmark indices for a simplified skull approximation.
// These are landmarks roughly mapping to skull/jaw structural points.
const SKULL_OUTLINE_INDICES = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365,
  379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
  234, 127, 162, 21, 54, 103, 67, 109,
];

const JAW_INDICES = [
  234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152,
  377, 400, 378, 379, 365, 397, 288, 361, 323, 454,
];

const EYE_SOCKET_L = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const EYE_SOCKET_R = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466];
const NOSE_BRIDGE = [168, 6, 197, 195, 5, 4];

function poly(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], close = true) {
  if (pts.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  if (close) ctx.closePath();
  ctx.stroke();
}

export const anatomyOverlay: Overlay = {
  id: "anatomy",
  name: "Skeleton + muscles",
  category: "anatomy",
  description: "Approximate skull + jaw + eye-socket structure warped to detected landmarks. (Muscle layer: TODO)",
  requiresFace: true,
  params: [
    { key: "skull", label: "Skull", type: "toggle", default: true },
    { key: "jaw", label: "Jaw", type: "toggle", default: true },
    { key: "sockets", label: "Eye sockets", type: "toggle", default: true },
    { key: "nose", label: "Nose bridge", type: "toggle", default: true },
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 0.75 },
  ],
  render({ ctx, pose, params }) {
    if (!pose) return;
    const lms = pose.landmarks;
    const opacity = (params.opacity as number) ?? 0.75;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = "#fafafa";
    ctx.lineWidth = 1.6;
    ctx.shadowColor = "#000";
    ctx.shadowBlur = 2;

    const getPts = (idxs: number[]) => idxs.map((i) => lms[i]).filter(Boolean) as { x: number; y: number }[];

    if ((params.skull as boolean) ?? true) poly(ctx, getPts(SKULL_OUTLINE_INDICES));
    if ((params.jaw as boolean) ?? true) {
      ctx.strokeStyle = "#fbbf24";
      poly(ctx, getPts(JAW_INDICES), false);
    }
    if ((params.sockets as boolean) ?? true) {
      ctx.strokeStyle = "#fafafa";
      poly(ctx, getPts(EYE_SOCKET_L));
      poly(ctx, getPts(EYE_SOCKET_R));
    }
    if ((params.nose as boolean) ?? true) {
      ctx.strokeStyle = "#fafafa";
      poly(ctx, getPts(NOSE_BRIDGE), false);
    }

    ctx.restore();
  },
};
