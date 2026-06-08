"use client";
import { UploadDropzone } from "./UploadDropzone";
import { CanvasStage } from "./CanvasStage";
import { OverlayPanel } from "./OverlayPanel";
import { useStudio } from "@/lib/store";

export function Studio() {
  const { image, reset, status, errorMsg } = useStudio();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">
            drawloom <span className="text-zinc-500 font-normal text-sm">— form-first drawing overlays</span>
          </h1>
        </div>
        {image && (
          <button
            onClick={reset}
            className="text-xs px-3 py-1.5 rounded border border-zinc-700 hover:border-cyan-500 hover:text-cyan-400"
          >
            new image
          </button>
        )}
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <section className="min-w-0">
          {!image ? (
            <div className="max-w-xl mx-auto pt-16">
              <p className="text-center text-zinc-400 mb-6 text-sm leading-relaxed">
                Upload a portrait. drawloom detects the head angle and overlays Loomis construction, value reduction,
                anatomical structure, proportion measurements, and shape-simplification exercises — all in your browser.
              </p>
              <UploadDropzone />
              {errorMsg && status === "error" && (
                <p className="text-center mt-4 text-rose-400 text-sm">{errorMsg}</p>
              )}
            </div>
          ) : (
            <CanvasStage />
          )}
        </section>
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <OverlayPanel />
        </aside>
      </main>
    </div>
  );
}
