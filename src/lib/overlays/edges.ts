import type { Overlay } from "./types";

export const edgesOverlay: Overlay = {
  id: "edges",
  name: "Edge / squint / silhouette",
  category: "shape",
  description: "Squint blur, Sobel edges, or big-shape silhouette for shape simplification.",
  requiresFace: false,
  params: [
    { key: "mode", label: "Mode (0=blur 1=edges 2=silhouette)", type: "slider", min: 0, max: 2, step: 1, default: 0 },
    { key: "strength", label: "Strength", type: "slider", min: 1, max: 20, step: 1, default: 6 },
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 1 },
  ],
  render({ ctx, image, width, height, params }) {
    const mode = Math.round((params.mode as number) ?? 0);
    const strength = Math.round((params.strength as number) ?? 6);
    const opacity = (params.opacity as number) ?? 1;

    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    const octx = off.getContext("2d")!;

    if (mode === 0) {
      octx.filter = `blur(${strength}px)`;
      octx.drawImage(image, 0, 0, width, height);
    } else {
      octx.drawImage(image, 0, 0, width, height);
      const src = octx.getImageData(0, 0, width, height);
      const dst = octx.createImageData(width, height);
      const sd = src.data;
      const dd = dst.data;
      const gray = new Float32Array(width * height);
      for (let i = 0, j = 0; i < sd.length; i += 4, j++) {
        gray[j] = 0.299 * sd[i] + 0.587 * sd[i + 1] + 0.114 * sd[i + 2];
      }
      if (mode === 1) {
        // Sobel
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const i = y * width + x;
            const gx =
              -gray[i - width - 1] - 2 * gray[i - 1] - gray[i + width - 1] +
              gray[i - width + 1] + 2 * gray[i + 1] + gray[i + width + 1];
            const gy =
              -gray[i - width - 1] - 2 * gray[i - width] - gray[i - width + 1] +
              gray[i + width - 1] + 2 * gray[i + width] + gray[i + width + 1];
            const m = Math.min(255, Math.hypot(gx, gy) * (strength / 4));
            const di = i * 4;
            dd[di] = dd[di + 1] = dd[di + 2] = m;
            dd[di + 3] = 255;
          }
        }
      } else {
        // Silhouette via luminance threshold
        const thr = 128 - strength * 5;
        for (let j = 0; j < gray.length; j++) {
          const v = gray[j] < thr ? 0 : 255;
          const di = j * 4;
          dd[di] = dd[di + 1] = dd[di + 2] = v;
          dd[di + 3] = 255;
        }
      }
      octx.putImageData(dst, 0, 0);
    }

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  },
};
