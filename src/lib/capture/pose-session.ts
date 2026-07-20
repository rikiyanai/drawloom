import type { PoseResult } from "@/lib/pose/detect";

export type CaptureTarget = {
  id: string;
  label: string;
  shortLabel: string;
  yaw: number;
  tolerance: number;
};

export type FrameQuality = {
  meanLuma: number;
  darkFraction: number;
  brightFraction: number;
  sharpness: number;
};

export type CaptureChecks = {
  face: boolean;
  angle: boolean;
  level: boolean;
  framing: boolean;
  expression: boolean;
  lighting: boolean;
  sharpness: boolean;
  stable: boolean;
};

export type CaptureAssessment = {
  ready: boolean;
  message: string;
  checks: CaptureChecks;
};

export const CAPTURE_TARGETS: CaptureTarget[] = [
  { id: "front", label: "Front", shortLabel: "Front", yaw: 0, tolerance: 6 },
  { id: "three-quarter-left", label: "Three-quarter · screen left", shortLabel: "¾ left", yaw: -30, tolerance: 7 },
  { id: "three-quarter-right", label: "Three-quarter · screen right", shortLabel: "¾ right", yaw: 30, tolerance: 7 },
  { id: "profile-left", label: "Profile · screen left", shortLabel: "Profile L", yaw: -55, tolerance: 8 },
  { id: "profile-right", label: "Profile · screen right", shortLabel: "Profile R", yaw: 55, tolerance: 8 },
];

const emptyChecks: CaptureChecks = {
  face: false,
  angle: false,
  level: false,
  framing: false,
  expression: false,
  lighting: false,
  sharpness: false,
  stable: false,
};

export function assessCapture(
  pose: PoseResult,
  target: CaptureTarget,
  quality: FrameQuality | null,
  motionDegrees: number
): CaptureAssessment {
  if (!pose) {
    return { ready: false, message: "Put one face in frame", checks: emptyChecks };
  }

  const faceScale = pose.bbox.size / Math.min(pose.imageWidth, pose.imageHeight);
  const centerX = pose.bbox.cx / pose.imageWidth;
  const centerY = pose.bbox.cy / pose.imageHeight;
  const blink = Math.max(pose.blendShapes.eyeBlinkLeft ?? 0, pose.blendShapes.eyeBlinkRight ?? 0);
  const expression = Math.max(
    pose.blendShapes.jawOpen ?? 0,
    pose.blendShapes.mouthSmileLeft ?? 0,
    pose.blendShapes.mouthSmileRight ?? 0
  );

  const checks: CaptureChecks = {
    face: true,
    angle: Math.abs(pose.angles.yaw - target.yaw) <= target.tolerance,
    level: Math.abs(pose.angles.pitch) <= 11 && Math.abs(pose.angles.roll) <= 8,
    framing:
      faceScale >= 0.3 &&
      faceScale <= 0.76 &&
      Math.abs(centerX - 0.5) <= 0.2 &&
      Math.abs(centerY - 0.48) <= 0.24,
    expression: blink < 0.6 && expression < 0.48,
    lighting:
      quality !== null &&
      quality.meanLuma >= 38 &&
      quality.meanLuma <= 218 &&
      quality.darkFraction < 0.48 &&
      quality.brightFraction < 0.34,
    sharpness: quality !== null && quality.sharpness >= 5,
    stable: motionDegrees <= 4,
  };

  let message = "Hold still";
  if (!checks.angle) message = "Move the yaw marker into the target zone";
  else if (!checks.level) message = "Keep your head level";
  else if (!checks.framing) message = faceScale < 0.3 ? "Move closer" : faceScale > 0.76 ? "Move back" : "Center your face";
  else if (!checks.expression) message = "Relax your face and keep your eyes open";
  else if (!checks.lighting) message = "Use more even light on your face";
  else if (!checks.sharpness) message = "Hold still or add light";
  else if (checks.stable) message = "Hold — capturing automatically";

  return { ready: Object.values(checks).every(Boolean), message, checks };
}

export function analyzeFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): FrameQuality | null {
  const width = 160;
  const height = Math.max(90, Math.round((video.videoHeight / video.videoWidth) * width));
  if (!Number.isFinite(height) || video.videoWidth === 0) return null;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const luma = new Float32Array(width * height);
  let sum = 0;
  let dark = 0;
  let bright = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const value = data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722;
    luma[p] = value;
    sum += value;
    if (value < 28) dark++;
    if (value > 235) bright++;
  }
  let edgeSum = 0;
  let edgeCount = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      edgeSum += Math.abs(4 * luma[i] - luma[i - 1] - luma[i + 1] - luma[i - width] - luma[i + width]);
      edgeCount++;
    }
  }
  const pixels = width * height;
  return {
    meanLuma: sum / pixels,
    darkFraction: dark / pixels,
    brightFraction: bright / pixels,
    sharpness: edgeSum / edgeCount,
  };
}
