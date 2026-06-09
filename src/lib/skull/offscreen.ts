"use client";
import { mountSkullScene, type SkullScene } from "./scene";

// Module-singleton three.js skull rendering to an offscreen canvas. Used by
// the Skeleton overlay (and any other overlay that wants the skull blitted
// into the 2D drawing context). Lazy-initialized on first access.
//
// The scene's own RAF loop keeps the offscreen canvas continuously rendered,
// so any drawImage call picks up the latest rotation set via setRotation().
// At worst there's a 1-frame lag, which is below the perceptual threshold.

type OffscreenSkull = {
  canvas: HTMLCanvasElement;
  scene: SkullScene;
  w: number;
  h: number;
};

let offscreen: OffscreenSkull | null = null;

export function getOffscreenSkull(): OffscreenSkull | null {
  if (typeof document === "undefined") return null;
  if (!offscreen) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const scene = mountSkullScene(canvas);
    scene.resize(512, 512);
    offscreen = { canvas, scene, w: 512, h: 512 };
  }
  return offscreen;
}

export function ensureOffscreenSize(w: number, h: number): void {
  if (!offscreen) return;
  if (offscreen.w !== w || offscreen.h !== h) {
    offscreen.scene.resize(w, h);
    offscreen.w = w;
    offscreen.h = h;
  }
}
