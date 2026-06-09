import { ImageSegmenter, FilesetResolver, type MPMask } from "@mediapipe/tasks-vision";

// Keep in sync with src/lib/pose/detect.ts.
const MEDIAPIPE_VERSION = "0.10.35";

type Mode = "IMAGE" | "VIDEO";
const segmenters: Partial<Record<Mode, ImageSegmenter>> = {};
const initPromises: Partial<Record<Mode, Promise<ImageSegmenter>>> = {};

async function createSegmenter(mode: Mode): Promise<ImageSegmenter> {
  const fileset = await FilesetResolver.forVisionTasks(
    `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`
  );
  return ImageSegmenter.createFromOptions(fileset, {
    baseOptions: {
      // Selfie Segmenter — categorical person/background mask, ~250KB float16.
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite",
      delegate: "GPU",
    },
    outputCategoryMask: true,
    outputConfidenceMasks: false,
    runningMode: mode,
  });
}

async function init(mode: Mode): Promise<ImageSegmenter> {
  const existing = segmenters[mode];
  if (existing) return existing;
  const pending = initPromises[mode];
  if (pending) return pending;
  const p = createSegmenter(mode)
    .then((s) => {
      segmenters[mode] = s;
      return s;
    })
    .catch((err) => {
      delete initPromises[mode];
      throw err;
    });
  initPromises[mode] = p;
  return p;
}

export type MaskResult = { mask: MPMask; width: number; height: number } | null;

export async function segmentVideo(video: HTMLVideoElement, timestampMs: number): Promise<MaskResult> {
  const seg = await init("VIDEO");
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (w === 0 || h === 0) return null;
  // segmentForVideo dispatches a callback synchronously in this version.
  let out: MaskResult = null;
  seg.segmentForVideo(video, timestampMs, (result) => {
    const cm = result.categoryMask;
    if (cm) out = { mask: cm, width: w, height: h };
  });
  return out;
}

export async function warmupSegmenter(): Promise<void> {
  await init("VIDEO");
}
