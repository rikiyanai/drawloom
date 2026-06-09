"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStudio, type ViewFilters } from "@/lib/store";
import { detectPoseForVideo, warmupVideo, type PoseResult } from "@/lib/pose/detect";
import { segmentVideo, warmupSegmenter } from "@/lib/pose/segmenter";
import { detectBodyForVideo, warmupBody, type BodyPoseResult } from "@/lib/pose/body";
import { OVERLAYS } from "@/lib/overlays/registry";

const MAX_W = 1100;

export function WebcamStage() {
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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={handlePauseToggle}
          disabled={!running}
          className="text-xs px-3 py-1.5 rounded border border-zinc-700 hover:border-cyan-500 hover:text-cyan-400 disabled:opacity-40"
          title="Freeze the live view on the current frame"
        >
          {paused ? "▶ resume" : "⏸ pause"}
        </button>
        <button
          onClick={handleSnapshot}
          disabled={!running}
          className="text-xs px-3 py-1.5 rounded border border-zinc-700 hover:border-cyan-500 hover:text-cyan-400 disabled:opacity-40"
          title="Save the current canvas (with overlays) as a PNG"
        >
          📸 snapshot
        </button>
      </div>
      <div className="rounded-xl overflow-hidden border border-zinc-800 bg-black relative">
        <video ref={videoRef} className="hidden" playsInline muted />
        <canvas ref={canvasRef} className="block max-w-full h-auto" />
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
