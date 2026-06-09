"use client";
import { mountLoomisScene, type LoomisScene } from "./scene";

// Module-singleton three.js Loomis-construction scene rendered to an
// offscreen canvas. The Loomis overlay drives it via setRotation/setVisibility
// then drawImages the offscreen canvas into the 2D context. Same shape as
// src/lib/skull/offscreen.ts.

type OffscreenLoomis = {
  canvas: HTMLCanvasElement;
  scene: LoomisScene;
  w: number;
  h: number;
};

let offscreen: OffscreenLoomis | null = null;

export function getOffscreenLoomis(): OffscreenLoomis | null {
  if (typeof document === "undefined") return null;
  if (!offscreen) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const scene = mountLoomisScene(canvas);
    scene.resize(512, 512);
    offscreen = { canvas, scene, w: 512, h: 512 };
  }
  return offscreen;
}

export function ensureLoomisSize(w: number, h: number): void {
  if (!offscreen) return;
  if (offscreen.w !== w || offscreen.h !== h) {
    offscreen.scene.resize(w, h);
    offscreen.w = w;
    offscreen.h = h;
  }
}
