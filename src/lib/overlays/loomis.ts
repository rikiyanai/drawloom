import type { Overlay } from "./types";
import { getOffscreenLoomis, ensureLoomisSize } from "../loomis/offscreen";

// Projected 3D Loomis construction.
//
// Replaces the prior 2D ellipse approximation entirely. The renderer in
// src/lib/loomis/scene.ts holds real 3D primitives (sphere silhouette,
// median + brow + eye great-circles, two side-plane disks at the correct
// cut-plane offset, jaw quad, neck) which are rotated by MediaPipe's
// head pose matrix and projected through a perspective camera. We then
// blit the offscreen canvas into the 2D overlay context at the face bbox.

// 0x22d3ee = cyan-400 (Tailwind), default ink color.
const COLOR_PRESETS: Record<string, number> = {
  cyan: 0x22d3ee,
  white: 0xffffff,
  black: 0x111111,
  amber: 0xfbbf24,
};

export const loomisOverlay: Overlay = {
  id: "loomis",
  name: "Loomis head",
  category: "construction",
  description:
    "Projected 3D Loomis construction: cranium silhouette, two temporal side-plane disks at the cut plane (not the silhouette), median + brow + eye great-circles, jaw block, neck. Rotates with detected head pose.",
  requiresFace: true,
  params: [
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 0.9 },
    { key: "showBrow", label: "Brow great-circle", type: "toggle", default: true },
    { key: "showEye", label: "Eye great-circle", type: "toggle", default: true },
    { key: "showMedian", label: "Median great-circle", type: "toggle", default: true },
    { key: "showSide", label: "Side-plane disks", type: "toggle", default: true },
    { key: "showJaw", label: "Jaw block", type: "toggle", default: true },
    { key: "showNeck", label: "Neck", type: "toggle", default: false },
    { key: "sizeMultiplier", label: "Size × face bbox", type: "slider", min: 0.6, max: 2.0, step: 0.05, default: 1.25 },
    // Color preset cycle: 0=cyan 1=white 2=black 3=amber.
    { key: "colorPreset", label: "Color (0=cyan 1=white 2=black 3=amber)", type: "slider", min: 0, max: 3, step: 1, default: 0 },
  ],
  render({ ctx, pose, params }) {
    if (!pose || pose.matrix.length < 16) return;
    const off = getOffscreenLoomis();
    if (!off) return;

    off.scene.setVisibility({
      brow: (params.showBrow as boolean) ?? true,
      eye: (params.showEye as boolean) ?? true,
      median: (params.showMedian as boolean) ?? true,
      side: (params.showSide as boolean) ?? true,
      jaw: (params.showJaw as boolean) ?? true,
      neck: (params.showNeck as boolean) ?? false,
    });

    const presetIdx = Math.round((params.colorPreset as number) ?? 0);
    const presetKey = ["cyan", "white", "black", "amber"][presetIdx] ?? "cyan";
    off.scene.setColor(COLOR_PRESETS[presetKey]);

    off.scene.setRotation(pose.matrix);

    const opacity = (params.opacity as number) ?? 0.9;
    const sizeMul = (params.sizeMultiplier as number) ?? 1.25;
    const size = Math.max(40, Math.round(pose.bbox.size * sizeMul));
    ensureLoomisSize(size, size);

    // Force a synchronous render so the next drawImage picks up the current
    // rotation/visibility/color, not the previous RAF frame.
    off.scene.renderNow();

    const x = pose.bbox.cx - size / 2;
    const y = pose.bbox.cy - size / 2;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(off.canvas, x, y, size, size);
    ctx.restore();
  },
};
