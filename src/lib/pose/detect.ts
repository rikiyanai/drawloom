import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";

let landmarker: FaceLandmarker | null = null;
let initPromise: Promise<FaceLandmarker> | null = null;

async function init(): Promise<FaceLandmarker> {
  if (landmarker) return landmarker;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
    );
    const lm = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
        delegate: "GPU",
      },
      outputFaceBlendshapes: false,
      outputFacialTransformationMatrixes: true,
      runningMode: "IMAGE",
      numFaces: 1,
    });
    landmarker = lm;
    return lm;
  })();
  return initPromise;
}

export type HeadAngles = { yaw: number; pitch: number; roll: number };

export type PoseResult = {
  landmarks: { x: number; y: number; z: number }[];
  angles: HeadAngles;
  matrix: number[];
  bbox: { cx: number; cy: number; size: number };
  imageWidth: number;
  imageHeight: number;
} | null;

function matrixToYPR(m: number[]): HeadAngles {
  const r00 = m[0], r01 = m[4], r02 = m[8];
  const r10 = m[1], r11 = m[5], r12 = m[9];
  const r20 = m[2], r21 = m[6], r22 = m[10];
  const pitch = Math.asin(-r12);
  let yaw: number, roll: number;
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

export async function detectPose(image: HTMLImageElement | HTMLCanvasElement): Promise<PoseResult> {
  const lm = await init();
  const result: FaceLandmarkerResult = lm.detect(image);
  const faces = result.faceLandmarks;
  if (!faces || faces.length === 0) return null;

  const w = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const h = image instanceof HTMLImageElement ? image.naturalHeight : image.height;

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
  const angles: HeadAngles = matrix
    ? matrixToYPR(Array.from(matrix))
    : { yaw: 0, pitch: 0, roll: 0 };

  return {
    landmarks: lms,
    angles,
    matrix: matrix ? Array.from(matrix) : [],
    bbox: { cx, cy, size },
    imageWidth: w,
    imageHeight: h,
  };
}
