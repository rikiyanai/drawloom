import { ovoidOverlay } from "./ovoid";
import { dovelineOverlay } from "./doveline";
import { notanOverlay } from "./notan";
import { horizonOverlay } from "./horizon";
import { edgesOverlay } from "./edges";
import { meshWireframeOverlay } from "./mesh-wireframe";
import type { Overlay } from "./types";
import { headPlanesOverlay, headPrimitivesOverlay, headCanonOverlay } from './head-planes';

// See failure log entry #15. This registry is the public accuracy boundary.
// Keep only direct landmark traces and deterministic pixel or geometry transforms.
// Do not expose inferred construction or anatomical registration.
export const OVERLAYS: Overlay[] = [
  ovoidOverlay,
  dovelineOverlay,
  meshWireframeOverlay,
  horizonOverlay,
  notanOverlay,
  edgesOverlay,
  ...(process.env.NEXT_PUBLIC_DRAWLOOM_PLANES==='1'?[headPlanesOverlay,headPrimitivesOverlay,headCanonOverlay]:[]),
];

export function defaultParams(overlay: Overlay): Record<string, number | boolean> {
  const out: Record<string, number | boolean> = {};
  for (const p of overlay.params) out[p.key] = p.default;
  return out;
}
