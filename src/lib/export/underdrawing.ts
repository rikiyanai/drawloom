import type { PoseResult } from "../pose/detect";
import { makeMediaPipeFramePacket, type MediaPipeFramePacket } from "../pose/packet";
import { OVERLAYS, defaultParams } from "../overlays/registry";

// Underdrawing packet for text-art tools such as Hatch Studio's Tracing guide.
// Each registered overlay is rendered alone on a transparent canvas at the
// export size, so the receiver can show, hide and weight them separately.
// The packet carries only what the registry already draws (failure log #15):
// no inferred construction is added on export.
export const UNDERDRAWING_SCHEMA = "drawloom.underdrawing.v1";
export const UNDERDRAWING_MAX_WIDTH = 2048;

export type UnderdrawingLayer = {
  id: string;
  name: string;
  kind: "photo" | "overlay";
  category: string;
  enabled: boolean;
  params: Record<string, number | boolean>;
  // True when light-on-dark output was inverted to dark marks on paper.
  inverted: boolean;
  width: number;
  height: number;
  png: string;
  sha256: string;
};

export type UnderdrawingPacket = {
  schema: typeof UNDERDRAWING_SCHEMA;
  createdAt: string;
  sourceName: string;
  width: number;
  height: number;
  scale: number;
  source: { width: number; height: number; sha256: string };
  angles: { yaw: number; pitch: number; roll: number } | null;
  pose: MediaPipeFramePacket | null;
  layers: UnderdrawingLayer[];
  skipped: { id: string; reason: string }[];
};

export type OverlaySelection = Record<string, { enabled: boolean; params: Record<string, number | boolean> }>;

export type UnderdrawingOptions = {
  image: HTMLImageElement;
  pose: PoseResult;
  overlays?: OverlaySelection;
  sourceName?: string;
  maxWidth?: number;
  include?: string[];
  includePhoto?: boolean;
  // Per-overlay parameter overrides, e.g. { edges: { mode: 1 }, notan: { levels: 3 } }.
  params?: Record<string, Record<string, number | boolean>>;
};

async function encode(canvas: HTMLCanvasElement): Promise<{ png: string; sha256: string }> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png")
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const sha256 = Array.from(digest, (n) => n.toString(16).padStart(2, "0")).join("");
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { png: `data:image/png;base64,${btoa(binary)}`, sha256 };
}

function blankCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  return [canvas, ctx];
}

// Sobel edges are drawn light on black; receivers multiply guides onto paper, so
// export them as dark lines on white instead.
function invertInPlace(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i];
    d[i + 1] = 255 - d[i + 1];
    d[i + 2] = 255 - d[i + 2];
  }
  ctx.putImageData(data, 0, 0);
}

function scalePose(pose: PoseResult, scale: number, width: number, height: number): PoseResult {
  if (!pose) return null;
  return {
    ...pose,
    landmarks: pose.landmarks.map((p) => ({ x: p.x * scale, y: p.y * scale, z: p.z * scale })),
    bbox: { cx: pose.bbox.cx * scale, cy: pose.bbox.cy * scale, size: pose.bbox.size * scale },
    imageWidth: width,
    imageHeight: height,
  };
}

export async function buildUnderdrawingPacket(options: UnderdrawingOptions): Promise<UnderdrawingPacket> {
  const { image, overlays, sourceName = "drawloom-portrait", includePhoto = true } = options;
  const maxWidth = Math.min(UNDERDRAWING_MAX_WIDTH, Math.max(64, Math.round(options.maxWidth ?? 1024)));
  const include = options.include ? new Set(options.include) : null;
  const unknown = [...(include ?? []), ...Object.keys(options.params ?? {})].filter((id) => !OVERLAYS.some((o) => o.id === id));
  if (unknown.length) throw new Error(`Unknown overlay id(s): ${unknown.join(", ")}`);
  const scale = Math.min(1, maxWidth / image.naturalWidth);
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);
  const pose = scalePose(options.pose, scale, width, height);

  const [photoCanvas, photoCtx] = blankCanvas(width, height);
  photoCtx.drawImage(image, 0, 0, width, height);
  const photo = await encode(photoCanvas);

  const layers: UnderdrawingLayer[] = [];
  const skipped: UnderdrawingPacket["skipped"] = [];
  if (includePhoto) {
    layers.push({ id: "photo", name: "Photo", kind: "photo", category: "source", enabled: false, params: {}, inverted: false, width, height, ...photo });
  }
  for (const overlay of OVERLAYS) {
    if (include && !include.has(overlay.id)) continue;
    if (overlay.requiresFace && !pose) {
      skipped.push({ id: overlay.id, reason: "no face detected" });
      continue;
    }
    const state = overlays?.[overlay.id];
    const params = { ...(state?.params ?? defaultParams(overlay)), ...options.params?.[overlay.id] };
    const [canvas, ctx] = blankCanvas(width, height);
    overlay.render({ ctx, image, pose, bodyPose: null, width, height, params });
    const inverted = overlay.id === "edges" && Math.round(params.mode as number) === 1;
    if (inverted) invertInPlace(canvas, ctx);
    layers.push({
      id: overlay.id,
      name: overlay.name,
      kind: "overlay",
      category: overlay.category,
      enabled: state?.enabled ?? false,
      params,
      inverted,
      width,
      height,
      ...(await encode(canvas)),
    });
  }

  return {
    schema: UNDERDRAWING_SCHEMA,
    createdAt: new Date().toISOString(),
    sourceName: sourceName.slice(0, 120),
    width,
    height,
    scale,
    source: { width: image.naturalWidth, height: image.naturalHeight, sha256: photo.sha256 },
    angles: pose ? pose.angles : null,
    pose: makeMediaPipeFramePacket(pose),
    layers,
    skipped,
  };
}

export function downloadUnderdrawingPacket(packet: UnderdrawingPacket): void {
  const blob = new Blob([`${JSON.stringify(packet)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `drawloom-underdrawing-${packet.source.sha256.slice(0, 12)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
