import type { Overlay } from "./types";
import { FACE_OVAL, indicesToPts, smoothRingPath } from "../pose/landmarks";

// Egg/ovoid silhouette of the face — traces MediaPipe's actual FACE_OVAL ring
// with a smooth curve. Replaces the earlier two-half-ellipse approximation,
// which produced a visible seam and did not follow the real outline.
export const ovoidOverlay: Overlay = {
  id: "ovoid",
  name: "Ovoid silhouette (a.k.a. doveline)",
  category: "construction",
  description:
    "Egg-shape outline of the whole face, traced from the actual face-perimeter landmarks.",
  requiresFace: true,
  params: [
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 0.85 },
    { key: "lineWidth", label: "Line width", type: "slider", min: 1, max: 6, step: 0.5, default: 2.5 },
    { key: "fill", label: "Fill (tint)", type: "toggle", default: false },
    { key: "showAnchors", label: "Anchor dots", type: "toggle", default: false },
  ],
  render({ ctx, pose, params }) {
    if (!pose) return;
    const pts = indicesToPts(FACE_OVAL, pose.landmarks);
    if (pts.length < 8) return;

    const opacity = (params.opacity as number) ?? 0.85;
    const lineWidth = (params.lineWidth as number) ?? 2.5;
    const fill = (params.fill as boolean) ?? false;
    const showAnchors = (params.showAnchors as boolean) ?? false;

    ctx.save();
    ctx.globalAlpha = opacity;
    smoothRingPath(ctx, pts);
    if (fill) {
      ctx.fillStyle = "rgba(244, 114, 182, 0.18)";
      ctx.fill();
    }
    ctx.strokeStyle = "#f472b6";
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    if (showAnchors) {
      ctx.fillStyle = "#f472b6";
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  },
};
