import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";

// Keep in sync with the @mediapipe/tasks-vision version in package.json.
const MEDIAPIPE_VERSION = "0.10.35";

type Mode = "IMAGE" | "VIDEO";

const landmarkers: Partial<Record<Mode, FaceLandmarker>> = {};
const initPromises: Partial<Record<Mode, Promise<FaceLandmarker>>> = {};

async function createLandmarker(mode: Mode): Promise<FaceLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`
  );
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU",
    },
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: true,
    runningMode: mode,
    numFaces: 1,
  });
}

async function init(mode: Mode): Promise<FaceLandmarker> {
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

export type HeadAngles = { yaw: number; pitch: number; roll: number };

export type PoseResult = {
  landmarks: { x: number; y: number; z: number }[];
  blendShapes: Record<string, number>;
  angles: HeadAngles;
  matrix: number[];
  bbox: { cx: number; cy: number; size: number };
  imageWidth: number;
  imageHeight: number;
} | null;

function matrixToYPR(m: number[]): HeadAngles {
  const r00 = m[0];
  const r02 = m[8];
  const r10 = m[1];
  const r11 = m[5];
  const r12 = m[9];
  const r20 = m[2];
  const r22 = m[10];
  const pitch = Math.asin(-r12);
  let yaw: number;
  let roll: number;
  if (Math.abs(r12) < 0.9999) {
    yaw = Math.atan2(r02, r22);
    roll = Math.atan2(r10, r11);
  } else {
    yaw = Math.atan2(-r20, r00);
    roll = 0;
  }
  const toDeg = 180 / Math.PI;
  return { yaw: yaw * toDeg, pitch: pitch * toDeg, roll: roll * toDeg };
}

function processResult(result: FaceLandmarkerResult, w: number, h: number): PoseResult {
  const faces = result.faceLandmarks;
  if (!faces || faces.length === 0) return null;
  const lms = faces[0].map((p) => ({ x: p.x * w, y: p.y * h, z: p.z * w }));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of lms) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const size = Math.max(maxX - minX, maxY - minY) * 1.4;
  const matrix = result.facialTransformationMatrixes?.[0]?.data;
  const angles: HeadAngles = matrix ? matrixToYPR(Array.from(matrix)) : { yaw: 0, pitch: 0, roll: 0 };
  const blendShapes = Object.fromEntries(
    (result.faceBlendshapes?.[0]?.categories ?? []).map((c) => [c.categoryName, c.score])
  );
  return {
    landmarks: lms,
    blendShapes,
    angles,
    matrix: matrix ? Array.from(matrix) : [],
    bbox: { cx, cy, size },
    imageWidth: w,
    imageHeight: h,
  };
}

export async function detectPose(image: HTMLImageElement | HTMLCanvasElement): Promise<PoseResult> {
  const lm = await init("IMAGE");
  const w = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const h = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
  const result = lm.detect(image);
  return processResult(result, w, h);
}

export async function detectPoseForVideo(
  video: HTMLVideoElement,
  timestampMs: number
): Promise<PoseResult> {
  const lm = await init("VIDEO");
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w === 0 || h === 0) return null;
  const result = lm.detectForVideo(video, timestampMs);
  return processResult(result, w, h);
}

export async function warmupVideo(): Promise<void> {
  await init("VIDEO");
}
