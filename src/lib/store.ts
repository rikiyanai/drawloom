"use client";
import { create } from "zustand";
import type { PoseResult } from "./pose/detect";
import { OVERLAYS, defaultParams } from "./overlays/registry";

type OverlayState = {
  enabled: boolean;
  params: Record<string, number | boolean>;
};

type StudioState = {
  image: HTMLImageElement | null;
  imageUrl: string | null;
  pose: PoseResult;
  status: "idle" | "loading" | "detecting" | "ready" | "no-face" | "error";
  errorMsg: string | null;
  overlays: Record<string, OverlayState>;
  setImage: (img: HTMLImageElement, url: string) => void;
  setStatus: (s: StudioState["status"], msg?: string) => void;
  setPose: (p: PoseResult) => void;
  toggleOverlay: (id: string) => void;
  setOverlayParam: (id: string, key: string, value: number | boolean) => void;
  reset: () => void;
};

const initialOverlays: Record<string, OverlayState> = {};
for (const o of OVERLAYS) {
  initialOverlays[o.id] = { enabled: o.id === "loomis", params: defaultParams(o) };
}

export const useStudio = create<StudioState>((set) => ({
  image: null,
  imageUrl: null,
  pose: null,
  status: "idle",
  errorMsg: null,
  overlays: initialOverlays,
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
  reset: () =>
    set((s) => {
      if (s.imageUrl) URL.revokeObjectURL(s.imageUrl);
      return { image: null, imageUrl: null, pose: null, status: "idle", errorMsg: null, overlays: initialOverlays };
    }),
}));
