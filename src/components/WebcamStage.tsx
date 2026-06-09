"use client";
import { useEffect, useRef, useState } from "react";
import { useStudio } from "@/lib/store";
import { detectPoseForVideo, warmupVideo, type PoseResult } from "@/lib/pose/detect";
import { OVERLAYS } from "@/lib/overlays/registry";

const MAX_W = 1100;

export function WebcamStage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenImgRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimestampRef = useRef<number>(-1);
  const poseRef = useRef<PoseResult>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const overlays = useStudio((s) => s.overlays);
  const setPose = useStudio((s) => s.setPose);
  const overlaysRef = useRef(overlays);
  overlaysRef.current = overlays;

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;

    (async () => {
      try {
        await warmupVideo();
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

      // Mirror horizontally for selfie view
      ctx.save();
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, w, h);
      ctx.restore();

      // Run detection at most once per frame timestamp
      const ts = performance.now();
      if (ts !== lastTimestampRef.current) {
        lastTimestampRef.current = ts;
        detectPoseForVideo(video, ts)
          .then((pose) => {
            if (!pose) {
              poseRef.current = null;
              return;
            }
            // Mirror landmark X coords to match the flipped canvas, then scale to canvas size
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
              // Mirror angles too so yaw matches what user sees
              angles: { ...pose.angles, yaw: -pose.angles.yaw, roll: -pose.angles.roll },
              imageWidth: w,
              imageHeight: h,
            };
            poseRef.current = mirrored;
          })
          .catch((e) => console.warn("detect failed", e));
      }

      // Render overlays using the most recent pose (may lag a frame; that's fine)
      const pose = poseRef.current;
      if (!hiddenImgRef.current) {
        // Pass canvas-as-image fallback for overlays that need image source (notan/edges)
        // We construct a temporary HTMLImageElement only if needed; for now skip non-face overlays gracefully
      }
      for (const overlay of OVERLAYS) {
        const state = overlaysRef.current[overlay.id];
        if (!state?.enabled) continue;
        if (overlay.requiresFace && !pose) continue;
        try {
          overlay.render({
            ctx,
            // For non-face overlays that need an image source, use the canvas itself
            image: canvas as unknown as HTMLImageElement,
            pose,
            width: w,
            height: h,
            params: state.params,
          });
        } catch (e) {
          console.warn(`overlay ${overlay.id} failed`, e);
        }
      }

      // Push pose into the store occasionally so the angles HUD updates
      if (pose && Math.floor(ts / 250) !== Math.floor(lastTimestampRef.current / 250)) {
        setPose(pose);
      } else if (!pose) {
        // ensure store reflects no-face occasionally
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
    <div className="rounded-xl overflow-hidden border border-zinc-800 bg-black">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="block max-w-full h-auto" />
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
  );
}
