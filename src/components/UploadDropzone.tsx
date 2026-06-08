"use client";
import { useCallback, useRef } from "react";
import { useStudio } from "@/lib/store";
import { detectPose } from "@/lib/pose/detect";

export function UploadDropzone() {
  const { setImage, setPose, setStatus, status } = useStudio();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setStatus("loading");
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = url;
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej(new Error("Could not load image"));
      });
      setImage(img, url);
      try {
        const pose = await detectPose(img);
        setPose(pose);
      } catch (err) {
        setStatus("error", err instanceof Error ? err.message : "Detection failed");
      }
    },
    [setImage, setPose, setStatus]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onClick={() => inputRef.current?.click()}
      className="cursor-pointer border-2 border-dashed border-zinc-700 hover:border-cyan-400 rounded-xl p-10 text-center text-zinc-400 transition-colors"
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <p className="text-lg">
        {status === "loading" || status === "detecting" ? "Analyzing…" : "Drop a portrait or click to upload"}
      </p>
      <p className="text-xs mt-2 opacity-60">JPG / PNG / WebP · processed entirely in your browser</p>
    </div>
  );
}
