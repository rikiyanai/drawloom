import type { Overlay } from "./types";

export const loomisOverlay: Overlay = {
  id: "loomis",
  name: "Loomis head",
  category: "construction",
  description: "Sphere + cut-plane construction rotated to detected head angle.",
  requiresFace: true,
  params: [
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 0.7 },
    { key: "showCenterline", label: "Centerline", type: "toggle", default: true },
  ],
  render({ ctx, pose, params }) {
    if (!pose) return;
    const { bbox, angles } = pose;
    const opacity = (params.opacity as number) ?? 0.7;
    const showCenterline = (params.showCenterline as boolean) ?? true;
    const radius = bbox.size * 0.35;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2;

    // Sphere outline (front view ellipse based on yaw)
    const yawRad = (angles.yaw * Math.PI) / 180;
    const pitchRad = (angles.pitch * Math.PI) / 180;
    const rollRad = (angles.roll * Math.PI) / 180;

    ctx.translate(bbox.cx, bbox.cy);
    ctx.rotate(rollRad);

    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    // Side-plane cut (Loomis side cut at ~radius * 0.7 from center, perpendicular to yaw)
    const cutOffset = radius * Math.sin(yawRad) * 0.7;
    ctx.beginPath();
    ctx.ellipse(cutOffset, 0, radius * 0.18, radius * Math.cos(yawRad) * 0.95, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Brow line (horizontal great circle, tilted by pitch)
    ctx.beginPath();
    ctx.ellipse(0, radius * Math.sin(pitchRad) * 0.3, radius * Math.cos(yawRad), radius * 0.18, 0, 0, Math.PI * 2);
    ctx.stroke();

    // Jaw stub (downward from sphere)
    const jawY = radius * 0.85;
    const jawW = radius * 0.55;
    ctx.beginPath();
    ctx.moveTo(-jawW + cutOffset, jawY * 0.4);
    ctx.quadraticCurveTo(cutOffset, jawY * 1.6, jawW + cutOffset, jawY * 0.4);
    ctx.stroke();

    // Centerline
    if (showCenterline) {
      ctx.beginPath();
      ctx.moveTo(cutOffset, -radius);
      ctx.lineTo(cutOffset, jawY * 1.6);
      ctx.stroke();
    }

    ctx.restore();
  },
};
