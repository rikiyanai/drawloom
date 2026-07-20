"use client";
import { create } from "zustand";
import type { PoseResult } from "./pose/detect";
import type { BodyPoseResult } from "./pose/body";
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
  bodyPose: boolean; // enable MediaPipe Pose Landmarker (~5MB extra)
};

type StudioState = {
  mode: SourceMode;
  layout: LayoutMode;
  image: HTMLImageElement | null;
  imageUrl: string | null;
  pose: PoseResult;
  bodyPose: BodyPoseResult;
  status: "idle" | "loading" | "detecting" | "ready" | "no-face" | "error";
  errorMsg: string | null;
  overlays: Record<string, OverlayState>;
  viewFilters: ViewFilters;
  setMode: (m: SourceMode) => void;
  setLayout: (l: LayoutMode) => void;
  setImage: (img: HTMLImageElement, url: string) => void;
  setStatus: (s: StudioState["status"], msg?: string) => void;
  setPose: (p: PoseResult) => void;
  setBodyPose: (p: BodyPoseResult) => void;
  toggleOverlay: (id: string) => void;
  setOverlayParam: (id: string, key: string, value: number | boolean) => void;
  setViewFilter: <K extends keyof ViewFilters>(key: K, value: ViewFilters[K]) => void;
  reset: () => void;
};

const initialOverlays: Record<string, OverlayState> = {};
for (const o of OVERLAYS) {
  // FL-015: Default only to a direct landmark trace, never an inferred guide.
  initialOverlays[o.id] = {
    enabled: o.id === "ovoid",
    params: defaultParams(o),
  };
}

const initialViewFilters: ViewFilters = { grayscale: false, bgBlur: false, bgBlurAmount: 18, bodyPose: false };

export const useStudio = create<StudioState>((set) => ({
  mode: "upload",
  // FL-015: A separate skull reference avoids implying anatomical registration.
  layout: "split",
  image: null,
  imageUrl: null,
  pose: null,
  bodyPose: null,
  status: "idle",
  errorMsg: null,
  overlays: initialOverlays,
  viewFilters: initialViewFilters,
  setMode: (mode) =>
    set((s) => {
      if (s.imageUrl) URL.revokeObjectURL(s.imageUrl);
      return { mode, image: null, imageUrl: null, pose: null, bodyPose: null, status: "idle", errorMsg: null };
    }),
  setLayout: (layout) => set({ layout }),
  setImage: (img, url) => set({ image: img, imageUrl: url, pose: null, bodyPose: null, status: "detecting", errorMsg: null }),
  setStatus: (status, msg) => set({ status, errorMsg: msg ?? null }),
  setPose: (pose) => set({ pose, status: pose ? "ready" : "no-face" }),
  setBodyPose: (bodyPose) => set({ bodyPose }),
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
        bodyPose: null,
        status: "idle",
        errorMsg: null,
        overlays: initialOverlays,
        viewFilters: initialViewFilters,
      };
    }),
}));
