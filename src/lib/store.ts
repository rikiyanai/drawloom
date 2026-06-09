"use client";
import { create } from "zustand";
import type { PoseResult } from "./pose/detect";
import { OVERLAYS, defaultParams } from "./overlays/registry";

type OverlayState = {
  enabled: boolean;
  params: Record<string, number | boolean>;
};

export type SourceMode = "upload" | "webcam";
export type LayoutMode = "single" | "split";

export type ViewFilters = {
  grayscale: boolean;
  bgBlur: boolean;
  bgBlurAmount: number; // px
};

type StudioState = {
  mode: SourceMode;
  layout: LayoutMode;
  image: HTMLImageElement | null;
  imageUrl: string | null;
  pose: PoseResult;
  status: "idle" | "loading" | "detecting" | "ready" | "no-face" | "error";
  errorMsg: string | null;
  overlays: Record<string, OverlayState>;
  viewFilters: ViewFilters;
  setMode: (m: SourceMode) => void;
  setLayout: (l: LayoutMode) => void;
  setImage: (img: HTMLImageElement, url: string) => void;
  setStatus: (s: StudioState["status"], msg?: string) => void;
  setPose: (p: PoseResult) => void;
  toggleOverlay: (id: string) => void;
  setOverlayParam: (id: string, key: string, value: number | boolean) => void;
  setViewFilter: <K extends keyof ViewFilters>(key: K, value: ViewFilters[K]) => void;
  reset: () => void;
};

const initialOverlays: Record<string, OverlayState> = {};
for (const o of OVERLAYS) {
  // Defaults: ovoid + feature-lines on so user sees something useful immediately
  initialOverlays[o.id] = {
    enabled: o.id === "ovoid" || o.id === "feature-lines",
    params: defaultParams(o),
  };
}

const initialViewFilters: ViewFilters = { grayscale: false, bgBlur: false, bgBlurAmount: 18 };

export const useStudio = create<StudioState>((set) => ({
  mode: "upload",
  layout: "single",
  image: null,
  imageUrl: null,
  pose: null,
  status: "idle",
  errorMsg: null,
  overlays: initialOverlays,
  viewFilters: initialViewFilters,
  setMode: (mode) =>
    set((s) => {
      if (s.imageUrl) URL.revokeObjectURL(s.imageUrl);
      return { mode, image: null, imageUrl: null, pose: null, status: "idle", errorMsg: null };
    }),
  setLayout: (layout) => set({ layout }),
  setImage: (img, url) => set({ image: img, imageUrl: url, pose: null, status: "detecting", errorMsg: null }),
  setStatus: (status, msg) => set({ status, errorMsg: msg ?? null }),
  setPose: (pose) => set({ pose, status: pose ? "ready" : "no-face" }),
  toggleOverlay: (id) =>
    set((s) => ({ overlays: { ...s.overlays, [id]: { ...s.overlays[id], enabled: !s.overlays[id].enabled } } })),
  setOverlayParam: (id, key, value) =>
    set((s) => ({
      overlays: {
        ...s.overlays,
        [id]: { ...s.overlays[id], params: { ...s.overlays[id].params, [key]: value } },
      },
    })),
  setViewFilter: (key, value) =>
    set((s) => ({ viewFilters: { ...s.viewFilters, [key]: value } })),
  reset: () =>
    set((s) => {
      if (s.imageUrl) URL.revokeObjectURL(s.imageUrl);
      return {
        image: null,
        imageUrl: null,
        pose: null,
        status: "idle",
        errorMsg: null,
        overlays: initialOverlays,
        viewFilters: initialViewFilters,
      };
    }),
}));
