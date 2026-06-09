"use client";
import { useEffect, useRef } from "react";
import { useStudio } from "@/lib/store";
import { mountSkullScene, type SkullScene } from "@/lib/skull/scene";

export function SkullPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SkullScene | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pose = useStudio((s) => s.pose);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const scene = mountSkullScene(canvas);
    sceneRef.current = scene;

    const ro = new ResizeObserver(() => {
      const r = wrap.getBoundingClientRect();
      scene.resize(Math.floor(r.width), Math.floor(r.height));
    });
    ro.observe(wrap);
    const r = wrap.getBoundingClientRect();
    scene.resize(Math.floor(r.width), Math.floor(r.height));

    return () => {
      ro.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current && pose && pose.matrix.length >= 16) {
      sceneRef.current.setRotation(pose.matrix);
    }
  }, [pose]);

  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900 relative">
      <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/60 text-zinc-300 text-xs font-mono z-10">
        skull · live
      </div>
      <div ref={wrapRef} className="w-full aspect-square">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
    </div>
  );
}
