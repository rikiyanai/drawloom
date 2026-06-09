import type { PoseResult } from "../pose/detect";
import type { BodyPoseResult } from "../pose/body";

export type OverlayContext = {
  ctx: CanvasRenderingContext2D;
  image: HTMLImageElement;
  pose: PoseResult;
  bodyPose?: BodyPoseResult;
  width: number;
  height: number;
  params: Record<string, number | boolean>;
};

export type OverlayParam =
  | { key: string; label: string; type: "slider"; min: number; max: number; step: number; default: number }
  | { key: string; label: string; type: "toggle"; default: boolean };

export type Overlay = {
  id: string;
  name: string;
  category: "construction" | "value" | "geometry" | "shape" | "proportion" | "anatomy";
  description: string;
  requiresFace: boolean;
  params: OverlayParam[];
  render: (ctx: OverlayContext) => void;
};
