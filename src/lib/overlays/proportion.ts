import type { Overlay } from "./types";

export const proportionOverlay: Overlay = {
  id: "proportion",
  name: "Proportion compare",
  category: "proportion",
  description: "Measure key facial ratios vs Loomis canon and show deltas.",
  requiresFace: true,
  params: [
    { key: "showLabels", label: "Labels", type: "toggle", default: true },
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 0.85 },
  ],
  render({ ctx, pose, params }) {
    if (!pose) return;
    const lms = pose.landmarks;
    const opacity = (params.opacity as number) ?? 0.85;
    const showLabels = (params.showLabels as boolean) ?? true;

    const browL = lms[105];
    const browR = lms[334];
    const noseBase = lms[2];
    const chin = lms[152];
    const hairline = lms[10]; // top of forehead landmark (approx)
    const pupilL = lms[468];
    const pupilR = lms[473];
    if (!browL || !browR || !noseBase || !chin || !hairline) return;

    const browMid = { x: (browL.x + browR.x) / 2, y: (browL.y + browR.y) / 2 };
    const topToBrow = Math.hypot(hairline.x - browMid.x, hairline.y - browMid.y);
    const browToNose = Math.hypot(browMid.x - noseBase.x, browMid.y - noseBase.y);
    const noseToChin = Math.hypot(noseBase.x - chin.x, noseBase.y - chin.y);

    const total = topToBrow + browToNose + noseToChin;
    const pctTop = topToBrow / total;
    const pctMid = browToNose / total;
    const pctBot = noseToChin / total;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = "#ec4899";
    ctx.fillStyle = "#ec4899";
    ctx.lineWidth = 1.5;

    [hairline, browMid, noseBase, chin].forEach((p) => {
      ctx.beginPath();
      ctx.moveTo(p.x - 60, p.y);
      ctx.lineTo(p.x + 60, p.y);
      ctx.stroke();
    });

    if (showLabels) {
      ctx.font = "13px system-ui, sans-serif";
      const labelX = Math.max(chin.x + 70, 10);
      const fmt = (p: number, ideal: number) =>
        `${(p * 100).toFixed(0)}% (canon ${(ideal * 100).toFixed(0)}%) Δ${((p - ideal) * 100).toFixed(0)}`;
      ctx.fillText(`top→brow  ${fmt(pctTop, 1 / 3)}`, labelX, (hairline.y + browMid.y) / 2);
      ctx.fillText(`brow→nose ${fmt(pctMid, 1 / 3)}`, labelX, (browMid.y + noseBase.y) / 2);
      ctx.fillText(`nose→chin ${fmt(pctBot, 1 / 3)}`, labelX, (noseBase.y + chin.y) / 2);
      if (pupilL && pupilR) {
        const eyeDist = Math.hypot(pupilL.x - pupilR.x, pupilL.y - pupilR.y);
        const faceWidth = pose.bbox.size;
        ctx.fillText(
          `eye-spacing  ${(eyeDist / faceWidth).toFixed(2)} of face-width (canon ~0.20)`,
          labelX,
          chin.y + 24
        );
      }
    }
    ctx.restore();
  },
};
