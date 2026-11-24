"use client";
import { useCallback, useRef } from "react";
import { useStudio } from "@/lib/store";
import { detectPose } from "@/lib/pose/detect";
import { removeImageBackground } from "@/lib/pose/segmenter";

export function UploadDropzone() {
  const { setImage, setPose, setStatus, setBackground, setRemoveBackground, removeBackground, status, imageUrl } = useStudio();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setStatus("loading");
      const url = URL.createObjectURL(file);
      let img = new Image();
      img.src = url;
      try {
        await new Promise<void>((res, rej) => {
          img.onload = () => res();
          img.onerror = () => rej(new Error("Could not load image"));
        });
      } catch (err) {
        URL.revokeObjectURL(url);
        setStatus("error", err instanceof Error ? err.message : "Image load failed");
        return;
      }
      // Background first: detection, overlays and the export all read the cut-out. If segmentation cannot run,
      // the photo is used as is and the state says so.
      let imgUrl = url;
      let background: "removed" | "kept" = "kept";
      if (useStudio.getState().removeBackground) {
        try {
          const cut = await removeImageBackground(img);
          URL.revokeObjectURL(url);
          img = cut;
          imgUrl = cut.src;
          background = "removed";
        } catch (err) {
          console.warn("background removal failed; using the photo as is", err);
        }
      }
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setImage(img, imgUrl);
      setBackground(background);
      try {
        const pose = await detectPose(img);
        setPose(pose);
      } catch (err) {
        setStatus("error", err instanceof Error ? err.message : "Detection failed");
      }
    },
    [setImage, setPose, setStatus, setBackground, imageUrl]
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
      <label className="inline-flex items-center gap-2 text-xs mt-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          aria-label="Remove background on upload"
          checked={removeBackground}
          onChange={(e) => setRemoveBackground(e.target.checked)}
        />
        Remove background first
      </label>
    </div>
  );
}
