import type { Overlay } from "./types";
import { getOffscreenSkull, ensureOffscreenSize } from "../skull/offscreen";

// Skeleton underlay — replaced the previous 2D approximation (cranium ring,
// expanded eye contours as orbits, bezier nasal triangle, single-curve
// zygomatic arch, etc.) with a 2D blit of the actual 3D skull mesh,
// rotated to match the head and positioned at the face bbox.
//
// Why: every part of the previous overlay was a landmark-expansion hack.
// We now have a real photogrammetric skull mesh loaded via public/skull.glb,
// so the honest fix is to project it. Composes cleanly with other 2D
// overlays (grayscale/blur ctx.filter passes apply to it like any image).

export const skeletonOverlay: Overlay = {
  id: "skeleton",
  name: "Skeleton underlay (skull)",
  category: "anatomy",
  description:
    "Real skull mesh (Khronos CC0 ScatteringSkull) rotated to match your head and scaled to the face bounding box. Composites into the 2D layer.",
  requiresFace: true,
  params: [
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 0.55 },
    { key: "sizeMultiplier", label: "Size × face bbox", type: "slider", min: 0.6, max: 1.6, step: 0.05, default: 1.0 },
    { key: "tintHue", label: "Tint hue (0–360, 0 = none)", type: "slider", min: 0, max: 360, step: 5, default: 0 },
  ],
  render({ ctx, pose, params }) {
    if (!pose || pose.matrix.length < 16) return;
    const off = getOffscreenSkull();
    if (!off) return;
    off.scene.setRotation(pose.matrix);

    const opacity = (params.opacity as number) ?? 0.55;
    const sizeMul = (params.sizeMultiplier as number) ?? 1.0;
    const hue = Math.round((params.tintHue as number) ?? 0);

    const size = Math.max(40, Math.round(pose.bbox.size * sizeMul));
    ensureOffscreenSize(size, size);

    const x = pose.bbox.cx - size / 2;
    const y = pose.bbox.cy - size / 2;

    ctx.save();
    ctx.globalAlpha = opacity;
    if (hue > 0) {
      // Apply a hue rotation to the bone-colored skull so the underlay
      // reads as diagrammatic rather than photographic.
      ctx.filter = `hue-rotate(${hue}deg)`;
    }
    ctx.drawImage(off.canvas, x, y, size, size);
    ctx.filter = "none";
    ctx.restore();
  },
};
