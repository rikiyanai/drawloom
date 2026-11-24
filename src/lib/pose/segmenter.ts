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
    outputCategoryMask: mode === "VIDEO",
    outputConfidenceMasks: mode === "IMAGE",
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
export async function segmentImage(image:HTMLImageElement):Promise<{labels:Uint8Array;width:number;height:number}> {
  const segmenter=await init('IMAGE'),result=segmenter.segment(image);
  // The binary model has one foreground-probability channel. Category output
  // in this Tasks build uses 0/255, not a reliable 0/1 person label.
  try {const mask=result.confidenceMasks?.[0];if(!mask)throw Error('Subject segmentation did not return a foreground mask.');return {labels:Uint8Array.from(mask.getAsFloat32Array(),p=>p>=.5?1:0),width:mask.width,height:mask.height};}
  finally {result.close();}
}

// Background first: a still portrait with everything outside the person painted paper white, so pose detection,
// every overlay (notan, edges, ovoid…) and the underdrawing export read the subject, never the room.
export async function removeImageBackground(img: HTMLImageElement): Promise<HTMLImageElement> {
  const { labels, width, height } = await segmentImage(img);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (width !== w || height !== h) throw new Error("Person mask is not at the image size");
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const pixels = ctx.getImageData(0, 0, w, h);
  const d = pixels.data;
  for (let i = 0; i < labels.length; i++) {
    if (labels[i] === 1) continue;
    const p = i * 4;
    d[p] = d[p + 1] = d[p + 2] = d[p + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Encode failed"))), "image/png"));
  const out = new Image();
  out.src = URL.createObjectURL(blob);
  await new Promise<void>((res, rej) => {
    out.onload = () => res();
    out.onerror = () => rej(new Error("Could not load cut-out"));
  });
  return out;
}
