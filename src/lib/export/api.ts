"use client";
import { useStudio } from "../store";
import { buildUnderdrawingPacket, UNDERDRAWING_SCHEMA, type UnderdrawingOptions, type UnderdrawingPacket } from "./underdrawing";

// Scriptable surface for automation (scripts/export-underdrawing.mjs) and other
// local tools. It reads the same store the visible studio renders from, so an
// exported packet always matches what upload mode detected for the current image.
export type DrawloomApi = {
  schema: typeof UNDERDRAWING_SCHEMA;
  status: () => ReturnType<typeof useStudio.getState>["status"];
  error: () => string | null;
  exportUnderdrawing: (options?: Omit<UnderdrawingOptions, "image" | "pose" | "overlays">) => Promise<UnderdrawingPacket>;
};

declare global {
  interface Window {
    drawloom?: DrawloomApi;
  }
}

export function currentUnderdrawingPacket(options: Omit<UnderdrawingOptions, "image" | "pose" | "overlays"> = {}) {
  const { image, pose, overlays, status } = useStudio.getState();
  if (!image) throw new Error("Load a portrait first.");
  if (status !== "ready" && status !== "no-face") throw new Error(`Detection is not finished (status: ${status}).`);
  return buildUnderdrawingPacket({ ...options, image, pose, overlays });
}

export function installDrawloomApi() {
  if (typeof window === "undefined" || window.drawloom) return;
  window.drawloom = {
    schema: UNDERDRAWING_SCHEMA,
    status: () => useStudio.getState().status,
    error: () => useStudio.getState().errorMsg,
    exportUnderdrawing: currentUnderdrawingPacket,
  };
}
