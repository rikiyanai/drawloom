import type { Overlay } from "./types";

export const horizonOverlay: Overlay = {
  id: "horizon",
  name: "Horizon + plumb + grid",
  category: "geometry",
  description: "Eye-level horizon, plumb lines through key landmarks, rule-of-thirds grid.",
  requiresFace: false,
  params: [
    { key: "horizon", label: "Horizon line", type: "toggle", default: true },
    { key: "plumb", label: "Plumb lines", type: "toggle", default: true },
    { key: "grid", label: "Thirds grid", type: "toggle", default: false },
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 0.6 },
  ],
  render({ ctx, pose, width, height, params }) {
    const showHorizon = (params.horizon as boolean) ?? true;
    const showPlumb = (params.plumb as boolean) ?? true;
    const showGrid = (params.grid as boolean) ?? false;
    const opacity = (params.opacity as number) ?? 0.6;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = "#f59e0b";
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;

    if (showHorizon) {
      let horizonY = height / 2;
      if (pose) {
        // pupils ≈ landmarks 468 (right iris) and 473 (left iris) when iris refinement is on
        const r = pose.landmarks[468];
        const l = pose.landmarks[473];
        if (r && l) horizonY = (r.y + l.y) / 2;
      }
      ctx.beginPath();
      ctx.moveTo(0, horizonY);
      ctx.lineTo(width, horizonY);
      ctx.stroke();
    }

    if (showPlumb && pose) {
      const noseTip = pose.landmarks[1];
      const chin = pose.landmarks[152];
      ctx.strokeStyle = "#10b981";
      [noseTip, chin].forEach((p) => {
        if (!p) return;
        ctx.beginPath();
        ctx.moveTo(p.x, 0);
        ctx.lineTo(p.x, height);
        ctx.stroke();
      });
    }

    if (showGrid) {
      ctx.strokeStyle = "#a78bfa";
      ctx.setLineDash([2, 4]);
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo((width / 3) * i, 0);
        ctx.lineTo((width / 3) * i, height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, (height / 3) * i);
        ctx.lineTo(width, (height / 3) * i);
        ctx.stroke();
      }
    }
    ctx.restore();
  },
};
