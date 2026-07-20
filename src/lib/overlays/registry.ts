import { ovoidOverlay } from "./ovoid";
import { dovelineOverlay } from "./doveline";
import { notanOverlay } from "./notan";
import { horizonOverlay } from "./horizon";
import { edgesOverlay } from "./edges";
import { meshWireframeOverlay } from "./mesh-wireframe";
import type { Overlay } from "./types";

// FL-015: This registry is the public accuracy boundary. Keep only overlays
// that directly trace detected landmarks or apply deterministic pixel/geometry
// transforms; do not expose inferred construction or anatomical registration.
export const OVERLAYS: Overlay[] = [
  ovoidOverlay,
  dovelineOverlay,
  meshWireframeOverlay,
  horizonOverlay,
  notanOverlay,
  edgesOverlay,
];

export function defaultParams(overlay: Overlay): Record<string, number | boolean> {
  const out: Record<string, number | boolean> = {};
  for (const p of overlay.params) out[p.key] = p.default;
  return out;
}
