"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStudio, type ViewFilters } from "@/lib/store";
import { detectPoseForVideo, warmupVideo, type PoseResult } from "@/lib/pose/detect";
import { segmentVideo, warmupSegmenter } from "@/lib/pose/segmenter";
import { detectBodyForVideo, warmupBody, type BodyPoseResult } from "@/lib/pose/body";
import { OVERLAYS } from "@/lib/overlays/registry";
import {
  analyzeFrame,
  assessCapture,
  CAPTURE_TARGETS,
  type CaptureAssessment,
  type FrameQuality,
} from "@/lib/capture/pose-session";

import { useStudies, type StudyShot } from "@/lib/capture/study-store";

const MAX_W = 1100;
const CAPTURE_HOLD_MS = 850;

export function WebcamStage({ children }: { children?: React.ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(-1);
  const poseRef = useRef<PoseResult>(null);
  const lastStorePushRef = useRef<number>(0);
  const lastPoseTruthyRef = useRef<boolean>(false);
  const pausedRef = useRef<boolean>(false);
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const overlays = useStudio((s) => s.overlays);
  const setPose = useStudio((s) => s.setPose);
  const setBodyPose = useStudio((s) => s.setBodyPose);
  const viewFilters = useStudio((s) => s.viewFilters);
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;
  const filtersRef = useRef<ViewFilters>(viewFilters);
  filtersRef.current = viewFilters;
  // Body PoseLandmarker: lazy-warmup the first time bodyPose flips on.
  const bodyWarmedRef = useRef(false);
  // Last body-detect timestamp + last body-store push (mirrors face throttling).
  const lastBodyTimestampRef = useRef<number>(-1);
  const lastBodyStorePushRef = useRef<number>(0);
  const lastBodyTruthyRef = useRef<boolean>(false);
  const bodyRef = useRef<BodyPoseResult>(null);
  // Offscreen scratch canvases for blur + mask compositing — avoid re-allocating per frame.
  const blurCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qualityCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastQualityRef = useRef<FrameQuality | null>(null);
  const lastQualityAtRef = useRef(0);
  const angleSamplesRef = useRef<Array<{ at: number; yaw: number; pitch: number; roll: number }>>([]);
  const guideActiveRef = useRef(false);
  const targetIndexRef = useRef(0);
  const readySinceRef = useRef<number | null>(null);
  const lastGuideUiAtRef = useRef(0);
  const [guideActive, setGuideActive] = useState(false);
  const [targetIndex, setTargetIndex] = useState(0);
  const sessions = useStudies((s) => s.sessions);
  const activeId = useStudies((s) => s.activeId);
  const hydrated = useStudies((s) => s.hydrated);
  const captures = sessions.find((s) => s.id === activeId)?.shots ?? {};
  const [assessment, setAssessment] = useState<CaptureAssessment | null>(null);
  const [holdProgress, setHoldProgress] = useState(0);

  useEffect(() => {
    guideActiveRef.current = guideActive;
  }, [guideActive]);

  useEffect(() => {
    targetIndexRef.current = targetIndex;
  }, [targetIndex]);

  const startGuide = useCallback(() => {
    useStudies.getState().newSession();
    setPaused(false);
    pausedRef.current = false;
    setTargetIndex(0);
    targetIndexRef.current = 0;
    readySinceRef.current = null;
    angleSamplesRef.current = [];
    setAssessment(null);
    setHoldProgress(0);
    setGuideActive(true);
    guideActiveRef.current = true;
  }, []);

  const stopGuide = useCallback(() => {
    setGuideActive(false);
    guideActiveRef.current = false;
    readySinceRef.current = null;
    setHoldProgress(0);
  }, []);

  const retakeTarget = useCallback((index: number) => {
    const target = CAPTURE_TARGETS[index];
    setPaused(false);
    pausedRef.current = false;
    setTargetIndex(index);
    targetIndexRef.current = index;
    readySinceRef.current = null;
    angleSamplesRef.current = [];
    setHoldProgress(0);
    setGuideActive(true);
    guideActiveRef.current = true;
  }, []);

  // Keep pausedRef in sync so the RAF loop sees the latest value
  // without re-subscribing through useEffect deps.
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const handlePauseToggle = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const handleSnapshot = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .slice(0, 19);
      a.href = url;
      a.download = `drawloom-${stamp}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Slight delay before revoking lets the download start cleanly.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    (async () => {
      try {
        await warmupVideo();
        // Pre-load the segmenter in parallel with camera startup so the first
        // background-blur toggle doesn't stall the render loop. Failure is OK
        // here — segmenter only matters if the user enables bg blur.
        warmupSegmenter().catch(() => {});
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setRunning(true);
        loop();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Webcam access denied");
      }
    })();

    function loop() {
      if (cancelled) return;
      // Pause short-circuit: keep the loop alive (cheap) but skip detection
      // and rendering so the canvas freezes on its last frame.
      if (pausedRef.current) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw === 0 || vh === 0) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const scale = Math.min(1, MAX_W / vw);
      const w = Math.round(vw * scale);
      const h = Math.round(vh * scale);
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const filters = filtersRef.current;
      // Shared timestamp for both segmentation and face detection this frame.
      const ts = performance.now();

      if (guideActiveRef.current && ts - lastQualityAtRef.current >= 220) {
        lastQualityAtRef.current = ts;
        if (!qualityCanvasRef.current) qualityCanvasRef.current = document.createElement("canvas");
        lastQualityRef.current = analyzeFrame(video, qualityCanvasRef.current);
      }

      // Step 1: draw the video frame onto the canvas, applying view filters.
      // Background-blur path: blurred copy of the whole frame, then composite
      // the in-focus person area on top using the segmentation mask.
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      const baseFilter = filters.grayscale ? "grayscale(1)" : "none";

      if (filters.bgBlur) {
        // Blurred background pass
        ctx.filter = `${baseFilter === "none" ? "" : baseFilter + " "}blur(${filters.bgBlurAmount}px)`;
        ctx.drawImage(video, 0, 0, w, h);
        ctx.filter = "none";
      } else {
        ctx.filter = baseFilter;
        ctx.drawImage(video, 0, 0, w, h);
        ctx.filter = "none";
      }
      ctx.restore();

      // Compose unblurred person area on top using the segmentation mask.
      if (filters.bgBlur) {
        // Run segmenter on the unmirrored video at its native timestamp.
        segmentVideo(video, ts).then((seg) => {
          if (!seg || !canvas) return;
          // Build a mask canvas at video resolution
          if (!maskCanvasRef.current) maskCanvasRef.current = document.createElement("canvas");
          const mc = maskCanvasRef.current;
          mc.width = seg.width;
          mc.height = seg.height;
          const mctx = mc.getContext("2d");
          if (!mctx) return;
          const arr = seg.mask.getAsUint8Array();
          // SelfieSegmenter categories: 0 = background, 1 = person. Build RGBA.
          const imgData = mctx.createImageData(seg.width, seg.height);
          const data = imgData.data;
          for (let i = 0, j = 0; i < arr.length; i++, j += 4) {
            const v = arr[i] === 0 ? 255 : 0; // bg pixels = white (we want to KEEP the blur there)
            data[j] = data[j + 1] = data[j + 2] = 255;
            data[j + 3] = arr[i] === 0 ? 0 : 255; // alpha: 255 where person (so we draw sharp on top)
            void v;
          }
          mctx.putImageData(imgData, 0, 0);

          // Build a sharp canvas of just the person area, then draw to the main canvas
          if (!blurCanvasRef.current) blurCanvasRef.current = document.createElement("canvas");
          const bc = blurCanvasRef.current;
          bc.width = w;
          bc.height = h;
          const bctx = bc.getContext("2d");
          if (!bctx) return;
          bctx.clearRect(0, 0, w, h);
          // Draw sharp video (with grayscale if active), mirrored
          bctx.save();
          bctx.translate(w, 0);
          bctx.scale(-1, 1);
          bctx.filter = baseFilter;
          bctx.drawImage(video, 0, 0, w, h);
          bctx.restore();
          // Clip to person mask using compositing
          bctx.globalCompositeOperation = "destination-in";
          bctx.save();
          bctx.translate(w, 0);
          bctx.scale(-1, 1);
          bctx.drawImage(mc, 0, 0, w, h);
          bctx.restore();
          bctx.globalCompositeOperation = "source-over";

          // Now blit the sharp-person canvas over the blurred background
          ctx.drawImage(bc, 0, 0);
          try { seg.mask.close(); } catch {}
        }).catch((e) => console.warn("segment failed", e));
      }

      // Run detection at most once per frame timestamp
      if (ts !== lastTimestampRef.current) {
        lastTimestampRef.current = ts;
        detectPoseForVideo(video, ts)
          .then((pose) => {
            if (!pose) {
              poseRef.current = null;
              return;
            }
            const sx = w / vw;
            const sy = h / vh;
            const mirrored: PoseResult = {
              ...pose,
              landmarks: pose.landmarks.map((p) => ({
                x: (vw - p.x) * sx,
                y: p.y * sy,
                z: p.z * sx,
              })),
              bbox: {
                cx: (vw - pose.bbox.cx) * sx,
                cy: pose.bbox.cy * sy,
                size: pose.bbox.size * sx,
              },
              angles: { ...pose.angles, yaw: -pose.angles.yaw, roll: -pose.angles.roll },
              imageWidth: w,
              imageHeight: h,
            };
            poseRef.current = mirrored;
          })
          .catch((e) => console.warn("detect failed", e));
      }

      // Body PoseLandmarker — optional, only when bodyPose toggle is on.
      if (filters.bodyPose) {
        if (!bodyWarmedRef.current) {
          bodyWarmedRef.current = true;
          warmupBody().catch(() => {});
        }
        // PoseLandmarker requires strictly-monotonic timestamps per running mode;
        // we keep our own marker so a face-detect re-use of `ts` doesn't collide.
        if (ts !== lastBodyTimestampRef.current) {
          lastBodyTimestampRef.current = ts;
          detectBodyForVideo(video, ts)
            .then((body) => {
              if (!body) {
                bodyRef.current = null;
                return;
              }
              const sx = w / vw;
              const sy = h / vh;
              const mirrored: BodyPoseResult = {
                ...body,
                landmarks: body.landmarks.map((p) => ({
                  x: (vw - p.x) * sx,
                  y: p.y * sy,
                  z: p.z * sx,
                  visibility: p.visibility,
                })),
                imageWidth: w,
                imageHeight: h,
              };
              bodyRef.current = mirrored;
            })
            .catch((e) => console.warn("body detect failed", e));
        }
      } else if (bodyRef.current) {
        // Toggle just turned off — drop the cached body pose.
        bodyRef.current = null;
      }

      // Render overlays using the most recent pose
      const pose = poseRef.current;

      if (guideActiveRef.current) {
        if (pose) {
          angleSamplesRef.current.push({ at: ts, ...pose.angles });
          angleSamplesRef.current = angleSamplesRef.current.filter((sample) => ts - sample.at <= 650);
        } else {
          angleSamplesRef.current = [];
        }
        const samples = angleSamplesRef.current;
        const motion = samples.length < 4
          ? Infinity
          : Math.max(
              ...(["yaw", "pitch", "roll"] as const).map((axis) => {
                const values = samples.map((sample) => sample[axis]);
                return Math.max(...values) - Math.min(...values);
              })
            );
        const index = targetIndexRef.current;
        const target = CAPTURE_TARGETS[index];
        if (target) {
          const nextAssessment = assessCapture(pose, target, lastQualityRef.current, motion);
          if (nextAssessment.ready) {
            if (readySinceRef.current === null) readySinceRef.current = ts;
            const progress = Math.min(1, (ts - readySinceRef.current) / CAPTURE_HOLD_MS);
            if (ts - lastGuideUiAtRef.current >= 80) {
              lastGuideUiAtRef.current = ts;
              setAssessment(nextAssessment);
              setHoldProgress(progress);
            }
            if (progress >= 1 && pose) {
              const clean = document.createElement("canvas");
              clean.width = w;
              clean.height = h;
              const cleanCtx = clean.getContext("2d");
              if (cleanCtx) {
                cleanCtx.translate(w, 0);
                cleanCtx.scale(-1, 1);
                cleanCtx.drawImage(video, 0, 0, w, h);
                const capture: StudyShot = {
                  pose: structuredClone(pose),
                  dataUrl: clean.toDataURL("image/jpeg", 0.9),
                  yaw: pose.angles.yaw,
                  pitch: pose.angles.pitch,
                  roll: pose.angles.roll,
                  capturedAt: Date.now(),
                };
                useStudies.getState().putShot(target.id, capture);
                readySinceRef.current = null;
                angleSamplesRef.current = [];
                setHoldProgress(0);
                const savedShots = useStudies.getState().sessions.find((s) => s.id === useStudies.getState().activeId)?.shots ?? {};
                const missingIndex = CAPTURE_TARGETS.findIndex((t) => !savedShots[t.id]);
                const nextIndex = missingIndex < 0 ? CAPTURE_TARGETS.length : missingIndex;
                if (nextIndex >= CAPTURE_TARGETS.length) {
                  setGuideActive(false);
                  guideActiveRef.current = false;
                } else {
                  targetIndexRef.current = nextIndex;
                  setTargetIndex(nextIndex);
                }
              }
            }
          } else {
            readySinceRef.current = null;
            if (ts - lastGuideUiAtRef.current >= 120) {
              lastGuideUiAtRef.current = ts;
              setAssessment(nextAssessment);
              setHoldProgress(0);
            }
          }
        }
      }

      for (const overlay of OVERLAYS) {
        const state = overlaysRef.current[overlay.id];
        if (!state?.enabled) continue;
        if (overlay.requiresFace && !pose) continue;
        try {
          overlay.render({
            ctx,
            image: canvas as unknown as HTMLImageElement,
            pose,
            bodyPose: bodyRef.current,
            width: w,
            height: h,
            params: state.params,
          });
        } catch (e) {
          console.warn(`overlay ${overlay.id} failed`, e);
        }
      }

      // Push pose into store (throttled, plus on first detect + transitions)
      const now = performance.now();
      const wasTruthy = lastPoseTruthyRef.current;
      const isTruthy = !!pose;
      const transitioned = wasTruthy !== isTruthy;
      const dueForUpdate = now - lastStorePushRef.current > 250;
      if (transitioned || dueForUpdate) {
        lastStorePushRef.current = now;
        lastPoseTruthyRef.current = isTruthy;
        setPose(pose);
      }

      // Mirror the same throttle/transition logic for body pose.
      const body = bodyRef.current;
      const bodyTruthy = !!body;
      const bodyTransitioned = lastBodyTruthyRef.current !== bodyTruthy;
      const bodyDue = now - lastBodyStorePushRef.current > 250;
      if (bodyTransitioned || bodyDue) {
        lastBodyStorePushRef.current = now;
        lastBodyTruthyRef.current = bodyTruthy;
        setBodyPose(body);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentTarget = CAPTURE_TARGETS[targetIndex];
  const currentYaw = poseRef.current?.angles.yaw ?? 0;
  const captureCount = Object.keys(captures).length;
  const complete = captureCount === CAPTURE_TARGETS.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={guideActive ? stopGuide : startGuide}
          disabled={!running || !hydrated}
          className="text-xs px-3 py-1.5 rounded border border-cyan-700 text-cyan-300 hover:border-cyan-400 disabled:opacity-40"
        >
          {guideActive ? "Cancel guided capture" : complete ? "New 5-angle capture" : "Start 5-angle capture"}
        </button>
        <button
          onClick={handlePauseToggle}
          disabled={!running}
          className="text-xs px-3 py-1.5 rounded border border-zinc-700 hover:border-cyan-500 hover:text-cyan-400 disabled:opacity-40"
          title="Freeze the live view on the current frame"
        >
          {paused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={handleSnapshot}
          disabled={!running}
          className="text-xs px-3 py-1.5 rounded border border-zinc-700 hover:border-cyan-500 hover:text-cyan-400 disabled:opacity-40"
          title="Save the current canvas (with overlays) as a PNG"
        >
          Snapshot
        </button>
      </div>
      <section data-testid="guided-capture" className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <div className="text-xs font-medium text-zinc-200">Guided five-angle capture</div>
            <div className="text-[11px] text-zinc-500">Clean camera frames; overlays are excluded.</div>
          </div>
          <div className="text-[11px] font-mono text-zinc-400">{captureCount}/5 captured</div>
        </div>

        {guideActive && currentTarget && (
          <div className="rounded border border-zinc-700 bg-zinc-900 p-3 space-y-2" aria-live="polite">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-white">{currentTarget.label}</span>
              <span className="text-[11px] font-mono text-zinc-400">
                yaw {currentYaw >= 0 ? "+" : ""}{currentYaw.toFixed(0)}° / {currentTarget.yaw >= 0 ? "+" : ""}{currentTarget.yaw}°
              </span>
            </div>
            <div className="relative h-5" aria-label="Yaw alignment guide">
              <div className="absolute left-0 right-0 top-2 h-px bg-zinc-700" />
              <div
                className="absolute top-0 h-5 rounded-sm bg-cyan-900/70 border border-cyan-500"
                style={{
                  left: `${((currentTarget.yaw - currentTarget.tolerance + 70) / 140) * 100}%`,
                  width: `${(currentTarget.tolerance * 2 / 140) * 100}%`,
                }}
              />
              <div
                className="absolute top-0 h-5 w-0.5 bg-white"
                style={{ left: `${Math.max(0, Math.min(100, ((currentYaw + 70) / 140) * 100))}%` }}
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full bg-cyan-400 transition-[width]" style={{ width: `${holdProgress * 100}%` }} />
              </div>
              <span className="min-w-44 text-right text-xs text-zinc-300">{assessment?.message ?? "Finding face…"}</span>
            </div>
          </div>
        )}

        {complete && !guideActive && (
          <div className="rounded border border-emerald-800 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-300">
            Five-angle set complete. Select any frame to retake it.
          </div>
        )}

        <div className="grid grid-cols-5 gap-2">
          {CAPTURE_TARGETS.map((target, index) => {
            const capture = captures[target.id];
            const selected = guideActive && index === targetIndex;
            return (
              <button
                data-testid="capture-slot"
                key={target.id}
                type="button"
                onClick={() => capture && retakeTarget(index)}
                disabled={!capture}
                className={`min-w-0 overflow-hidden rounded border text-left ${selected ? "border-cyan-500" : "border-zinc-800"} disabled:opacity-100`}
                title={capture ? `Retake ${target.label}` : target.label}
              >
                <div className="aspect-[4/3] bg-zinc-900 flex items-center justify-center overflow-hidden">
                  {capture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={capture.dataUrl} alt={`${target.label} capture`} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-[10px] text-zinc-600">{index + 1}</span>
                  )}
                </div>
                <div className="truncate px-1.5 py-1 text-[10px] text-zinc-400">{target.shortLabel}</div>
              </button>
            );
          })}
        </div>
      </section>
      <div className="rounded-xl overflow-hidden border border-zinc-800 bg-black relative">
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} className="block max-w-full h-auto" />
        {children}
        {paused && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded bg-black/70 text-cyan-300 text-xs font-mono">
            PAUSED
          </div>
        )}
        {!running && !error && (
          <div className="p-6 text-center text-zinc-400 text-sm">Starting webcam…</div>
        )}
        {error && (
          <div className="p-6 text-center text-rose-400 text-sm">
            Webcam error: {error}
            <br />
            <span className="text-zinc-500 text-xs">
              Check the browser permission prompt and that no other app is using the camera.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
