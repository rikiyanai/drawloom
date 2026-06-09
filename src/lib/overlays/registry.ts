import { loomisOverlay } from "./loomis";
import { loomisReillyOverlay } from "./loomis-reilly";
import { ovoidOverlay } from "./ovoid";
import { notanOverlay } from "./notan";
import { horizonOverlay } from "./horizon";
import { edgesOverlay } from "./edges";
import { proportionOverlay } from "./proportion";
import { featureLinesOverlay } from "./feature-lines";
import { skeletonOverlay } from "./skeleton";
import type { Overlay } from "./types";

export const OVERLAYS: Overlay[] = [
  ovoidOverlay,
  loomisReillyOverlay,
  loomisOverlay,
  skeletonOverlay,
  featureLinesOverlay,
  proportionOverlay,
  horizonOverlay,
  notanOverlay,
  edgesOverlay,
];

export function defaultParams(overlay: Overlay): Record<string, number | boolean> {
  const out: Record<string, number | boolean> = {};
  for (const p of overlay.params) out[p.key] = p.default;
  return out;
}
