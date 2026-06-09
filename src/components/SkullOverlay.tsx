"use client";
import { useEffect, useRef } from "react";
import { useStudio } from "@/lib/store";
import { mountSkullScene, type SkullScene } from "@/lib/skull/scene";

/**
 * Skull rendered on top of the live source canvas, scaled and positioned to
 * match the detected face bounding box. Used in layout="overlay" so the
 * underlying skull lines up over the student's actual head at the same
 * scale and orientation.
 *
 * Positioning strategy: pose.bbox.{cx,cy,size} are in source-canvas-pixel
 * coords; pose.imageWidth/Height tell us the source canvas's internal pixel
 * dimensions. We convert both to percentages of the wrapping parent (which
 * shares its size with the displayed source canvas), so the overlay stays
 * pinned to the face regardless of CSS scaling (max-w-full / h-auto).
 */
export function SkullOverlay({ opacity = 0.55 }: { opacity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SkullScene | null>(null);
  const pose = useStudio((s) => s.pose);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scene = mountSkullScene(canvas);
    sceneRef.current = scene;
    scene.resize(256, 256);
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current && pose && pose.matrix.length >= 16) {
      sceneRef.current.setRotation(pose.matrix);
    }
  }, [pose]);

  // Keep the three.js render resolution in sync with the displayed CSS size.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sceneRef.current) return;
    const ro = new ResizeObserver(() => {
      const r = canvas.getBoundingClientRect();
      const w = Math.max(40, Math.floor(r.width));
      const h = Math.max(40, Math.floor(r.height));
      sceneRef.current?.resize(w, h);
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  if (!pose) return null;

  // Percentage-based positioning so we stay aligned through CSS scaling.
  const leftPct = (pose.bbox.cx / pose.imageWidth) * 100;
  const topPct = (pose.bbox.cy / pose.imageHeight) * 100;
  const widthPct = (pose.bbox.size / pose.imageWidth) * 100;
  // bbox is square; convert width pct in source units to height pct via the
  // wrapper's aspect ratio (we use the same source-pixel size both ways).
  const heightPct = (pose.bbox.size / pose.imageHeight) * 100;

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute"
      style={{
        opacity,
        left: `${leftPct - widthPct / 2}%`,
        top: `${topPct - heightPct / 2}%`,
        width: `${widthPct}%`,
        height: `${heightPct}%`,
      }}
    />
  );
}
