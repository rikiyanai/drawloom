import type { Overlay } from "./types";

export const notanOverlay: Overlay = {
  id: "notan",
  name: "Notan (value reduction)",
  category: "value",
  description: "Reduce image to 2 or 3 values for shape-first study.",
  requiresFace: false,
  params: [
    { key: "levels", label: "Levels (2 or 3)", type: "slider", min: 2, max: 3, step: 1, default: 2 },
    { key: "threshold", label: "Threshold", type: "slider", min: 0, max: 1, step: 0.02, default: 0.5 },
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 1 },
  ],
  render({ ctx, image, width, height, params }) {
    const levels = Math.round((params.levels as number) ?? 2);
    const threshold = (params.threshold as number) ?? 0.5;
    const opacity = (params.opacity as number) ?? 1;

    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    const octx = off.getContext("2d")!;
    octx.drawImage(image, 0, 0, width, height);
    const imgData = octx.getImageData(0, 0, width, height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      let v: number;
      if (levels === 2) {
        v = lum < threshold ? 0 : 255;
      } else {
        const lo = threshold * 0.66;
        const hi = threshold * 1.33;
        v = lum < lo ? 0 : lum < hi ? 128 : 255;
      }
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    octx.putImageData(imgData, 0, 0);
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  },
};
