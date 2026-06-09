import { PoseLandmarker, FilesetResolver, type PoseLandmarkerResult } from "@mediapipe/tasks-vision";

// Keep in sync with src/lib/pose/detect.ts.
const MEDIAPIPE_VERSION = "0.10.35";

type Mode = "IMAGE" | "VIDEO";
const landmarkers: Partial<Record<Mode, PoseLandmarker>> = {};
const initPromises: Partial<Record<Mode, Promise<PoseLandmarker>>> = {};

async function createLandmarker(mode: Mode): Promise<PoseLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`
  );
  return PoseLandmarker.createFromOptions(fileset, {
    baseOptions: {
      // Pose Landmarker Lite — ~5MB, 33 body landmarks. Plenty for picking
      // shoulder midpoint (the sternal-notch proxy).
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
      delegate: "GPU",
    },
    runningMode: mode,
    numPoses: 1,
  });
}

async function init(mode: Mode): Promise<PoseLandmarker> {
  const existing = landmarkers[mode];
  if (existing) return existing;
  const pending = initPromises[mode];
  if (pending) return pending;
  const p = createLandmarker(mode)
    .then((lm) => {
      landmarkers[mode] = lm;
      return lm;
    })
    .catch((err) => {
      delete initPromises[mode];
      throw err;
    });
  initPromises[mode] = p;
  return p;
}

// MediaPipe Pose landmark indices we care about.
export const POSE_LEFT_SHOULDER = 11;
export const POSE_RIGHT_SHOULDER = 12;

export type BodyPoseResult = {
  // Pixel-space landmarks in source video coordinates (pre-mirror, pre-scale).
  landmarks: { x: number; y: number; z: number; visibility: number }[];
  imageWidth: number;
  imageHeight: number;
} | null;

function processResult(result: PoseLandmarkerResult, w: number, h: number): BodyPoseResult {
  const arr = result.landmarks;
  if (!arr || arr.length === 0) return null;
  const lms = arr[0].map((p) => ({
    x: p.x * w,
    y: p.y * h,
    z: (p.z ?? 0) * w,
    visibility: p.visibility ?? 0,
  }));
  return { landmarks: lms, imageWidth: w, imageHeight: h };
}

export async function detectBodyForVideo(video: HTMLVideoElement, timestampMs: number): Promise<BodyPoseResult> {
  const lm = await init("VIDEO");
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w === 0 || h === 0) return null;
  const result = lm.detectForVideo(video, timestampMs);
  return processResult(result, w, h);
}

export async function detectBody(image: HTMLImageElement | HTMLCanvasElement): Promise<BodyPoseResult> {
  const lm = await init("IMAGE");
  const w = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const h = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
  const result = lm.detect(image);
  return processResult(result, w, h);
}

export async function warmupBody(): Promise<void> {
  await init("VIDEO");
}
