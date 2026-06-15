import type { PoseResult } from "./detect";

type Vec3 = { x: number; y: number; z: number };

export type MediaPipeFramePacket = {
  schema: "drawloom.mediapipe.frame.v1";
  source: "mediapipe";
  topology: "mediapipe-face-landmarks-478";
  timestampMs: number;
  imageW: number;
  imageH: number;
  modelToCamera: { m: number[] };
  vertices: Vec3[];
  blendShapes: Record<string, number>;
};

export function makeMediaPipeFramePacket(pose: PoseResult, timestampMs = Date.now()): MediaPipeFramePacket | null {
  if (!pose || pose.matrix.length < 16) return null;
  return {
    schema: "drawloom.mediapipe.frame.v1",
    source: "mediapipe",
    topology: "mediapipe-face-landmarks-478",
    timestampMs,
    imageW: pose.imageWidth,
    imageH: pose.imageHeight,
    modelToCamera: { m: pose.matrix },
    vertices: pose.landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z })),
    blendShapes: pose.blendShapes,
  };
}

export function downloadMediaPipeFramePacket(pose: PoseResult): void {
  const packet = makeMediaPipeFramePacket(pose);
  if (!packet) return;
  const blob = new Blob([`${JSON.stringify(packet, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `drawloom-mediapipe-packet-${packet.timestampMs}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
