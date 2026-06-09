"use client";
import { useEffect, useRef } from "react";
import { useStudio } from "@/lib/store";
import { OVERLAYS } from "@/lib/overlays/registry";

const MAX_W = 1100;

export function CanvasStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { image, pose, overlays, viewFilters } = useStudio();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const scale = Math.min(1, MAX_W / image.naturalWidth);
    const w = Math.round(image.naturalWidth * scale);
    const h = Math.round(image.naturalHeight * scale);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    // Apply view filters only to the photo draw, not to overlays
    ctx.filter = viewFilters.grayscale ? "grayscale(1)" : "none";
    ctx.drawImage(image, 0, 0, w, h);
    ctx.filter = "none";

    const scaledPose = pose
      ? {
          ...pose,
          landmarks: pose.landmarks.map((p) => ({ x: p.x * scale, y: p.y * scale, z: p.z * scale })),
          bbox: { cx: pose.bbox.cx * scale, cy: pose.bbox.cy * scale, size: pose.bbox.size * scale },
          imageWidth: w,
          imageHeight: h,
        }
      : null;

    for (const overlay of OVERLAYS) {
      const state = overlays[overlay.id];
      if (!state?.enabled) continue;
      if (overlay.requiresFace && !scaledPose) continue;
      try {
        overlay.render({ ctx, image, pose: scaledPose, width: w, height: h, params: state.params });
      } catch (e) {
        console.warn(`overlay ${overlay.id} failed`, e);
      }
    }
  }, [image, pose, overlays, viewFilters]);

  if (!image) return null;
  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800 bg-black">
      <canvas ref={canvasRef} className="block max-w-full h-auto" />
    </div>
  );
}
