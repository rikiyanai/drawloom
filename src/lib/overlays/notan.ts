import type { Overlay } from "./types";

export const notanOverlay: Overlay = {
  id: "notan",
  name: "Notan (value reduction)",
  category: "value",
  description:
    "Reduce image to N values (2 = pure notan, 3 = light/mid/dark, up to 6 for fine value studies). Threshold biases the midpoint.",
  requiresFace: false,
  params: [
    { key: "levels", label: "Levels (2–6)", type: "slider", min: 2, max: 6, step: 1, default: 2 },
    { key: "threshold", label: "Mid-bias", type: "slider", min: 0.2, max: 0.8, step: 0.02, default: 0.5 },
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 1 },
  ],
  render({ ctx, image, width, height, params }) {
    const levels = Math.max(2, Math.min(6, Math.round((params.levels as number) ?? 2)));
    const threshold = (params.threshold as number) ?? 0.5;
    const opacity = (params.opacity as number) ?? 1;

    // Build (levels - 1) threshold cuts, biased around `threshold` (the mid-tone).
    // For 2 levels: one cut at `threshold`.
    // For N>2: cuts evenly spaced across [0, 1] but stretched/squashed toward `threshold`.
    const cuts: number[] = [];
    for (let i = 1; i < levels; i++) {
      const evenly = i / levels; // 0 < evenly < 1
      // Bias toward threshold: map 0.5 -> threshold, keep endpoints stable
      const biased = evenly < 0.5
        ? (evenly / 0.5) * threshold
        : threshold + ((evenly - 0.5) / 0.5) * (1 - threshold);
      cuts.push(biased);
    }
    // Output values evenly spaced 0..255
    const outVals: number[] = [];
    for (let i = 0; i < levels; i++) {
      outVals.push(Math.round((i / (levels - 1)) * 255));
    }

    const off = document.createElement("canvas");
    off.width = width;
    off.height = height;
    const octx = off.getContext("2d")!;
    octx.drawImage(image, 0, 0, width, height);
    const imgData = octx.getImageData(0, 0, width, height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      let band = 0;
      for (let c = 0; c < cuts.length; c++) {
        if (lum >= cuts[c]) band = c + 1;
        else break;
      }
      const v = outVals[band];
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    octx.putImageData(imgData, 0, 0);
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  },
};
