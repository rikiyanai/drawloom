"use client";
import { useEffect } from "react";
import { StudyBoard } from "./StudyBoard";
import { useStudies } from "@/lib/capture/study-store";
import { UploadDropzone } from "./UploadDropzone";
import { CanvasStage } from "./CanvasStage";
import { WebcamStage } from "./WebcamStage";
import { OverlayPanel } from "./OverlayPanel";
import { SkullPanel } from "./SkullPanel";
import { useStudio } from "@/lib/store";
import { installConsoleFilter } from "@/lib/console-filter";
import { downloadMediaPipeFramePacket } from "@/lib/pose/packet";

export function Studio() {
  const { image, reset, status, errorMsg, mode, setMode, layout, setLayout, pose } = useStudio();

  // Mute MediaPipe/TFLite INFO lines that ride on console.error and trip
  // Next's error overlay — must run before any detection call.
  useEffect(() => {
    installConsoleFilter();
    void useStudies.getState().hydrate();
  }, []);

  // Prevent the browser from navigating to a dropped image if it lands outside the dropzone.
  useEffect(() => {
    const cancel = (e: DragEvent) => {
      e.preventDefault();
    };
    window.addEventListener("dragover", cancel);
    window.addEventListener("drop", cancel);
    return () => {
      window.removeEventListener("dragover", cancel);
      window.removeEventListener("drop", cancel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-lg font-semibold">
          drawloom <span className="text-zinc-500 font-normal text-sm">— form-first drawing overlays</span>
        </h1>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setMode("study")} className={`text-xs px-3 py-1.5 rounded border ${mode === "study" ? "border-cyan-400 text-cyan-300" : "border-zinc-700"}`}>Study board</button>
          <div className="flex rounded-md border border-zinc-700 overflow-hidden text-xs">
            <button
              onClick={() => setMode("upload")}
              className={`px-3 py-1.5 ${mode === "upload" ? "bg-cyan-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              upload
            </button>
            <button
              onClick={() => setMode("webcam")}
              className={`px-3 py-1.5 ${mode === "webcam" ? "bg-cyan-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              webcam (live)
            </button>
          </div>
          <div className="flex rounded-md border border-zinc-700 overflow-hidden text-xs">
            <button
              onClick={() => setLayout("single")}
              className={`px-3 py-1.5 ${layout === "single" ? "bg-cyan-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
              title="Single view"
            >
              single
            </button>
            <button
              onClick={() => setLayout("split")}
              className={`px-3 py-1.5 ${layout === "split" ? "bg-cyan-600 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
              title="Side-by-side: your view + a skull at the same head angle"
            >
              split + skull
            </button>
          </div>
          {status === "ready" && pose && (
            <button
              onClick={() => downloadMediaPipeFramePacket(pose)}
              className="text-xs px-3 py-1.5 rounded border border-zinc-700 hover:border-cyan-500 hover:text-cyan-400 font-mono"
            >
              export MediaPipe JSON
            </button>
          )}
          {(image || mode === "webcam") && (
            <button
              onClick={reset}
              className="text-xs px-3 py-1.5 rounded border border-zinc-700 hover:border-cyan-500 hover:text-cyan-400"
            >
              reset
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <section className="min-w-0">
          {mode === "study" ? <StudyBoard /> : layout === "split" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="min-w-0">
                {mode === "webcam" ? (
                  <WebcamStage />
                ) : !image ? (
                  <div className="max-w-xl mx-auto pt-16">
                    <UploadDropzone />
                    {errorMsg && status === "error" && (
                      <p className="text-center mt-4 text-rose-400 text-sm">{errorMsg}</p>
                    )}
                  </div>
                ) : (
                  <CanvasStage />
                )}
              </div>
              <div className="min-w-0">
                <SkullPanel />
              </div>
            </div>
          ) : mode === "webcam" ? (
            <WebcamStage />
          ) : !image ? (
            <div className="max-w-xl mx-auto pt-16">
              <p className="text-center text-zinc-400 mb-6 text-sm leading-relaxed">
                Upload a portrait or switch to webcam mode. drawloom detects facial landmarks and provides direct
                landmark traces, a face-mesh wireframe, value reduction, measurement guides, and shape-simplification
                tools — all in your browser.
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
        <aside className="lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pr-2">
          <OverlayPanel />
        </aside>
      </main>
    </div>
  );
}
