import { loomisOverlay } from "./loomis";
import { notanOverlay } from "./notan";
import { horizonOverlay } from "./horizon";
import { edgesOverlay } from "./edges";
import { proportionOverlay } from "./proportion";
import { anatomyOverlay } from "./anatomy";
import type { Overlay } from "./types";

export const OVERLAYS: Overlay[] = [
  loomisOverlay,
  anatomyOverlay,
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
