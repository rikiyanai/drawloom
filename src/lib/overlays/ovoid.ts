import type { Overlay } from "./types";

// "Doveline" — colloquial name for the ovoid/egg silhouette of the face.
// Classical portrait construction starts here: a single asymmetric ellipse
// (cranium wider, chin narrower) anchored to the actual detected outline.
export const ovoidOverlay: Overlay = {
  id: "ovoid",
  name: "Ovoid silhouette (a.k.a. doveline)",
  category: "construction",
  description:
    "Egg-shape outline of the whole face — cranium rounder up top, jaw narrower below. Classical first stroke in Loomis-style construction.",
  requiresFace: true,
  params: [
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 0.75 },
    { key: "asymmetry", label: "Asymmetry (round↔egg)", type: "slider", min: 0, max: 1, step: 0.05, default: 0.55 },
    { key: "showAnchors", label: "Anchor dots", type: "toggle", default: false },
  ],
  render({ ctx, pose, params }) {
    if (!pose) return;
    const lms = pose.landmarks;
    const top = lms[10];        // top of forehead (highest stable point)
    const chin = lms[152];      // chin tip
    const left = lms[234];      // left cheek/jaw edge
    const right = lms[454];     // right cheek/jaw edge
    if (!top || !chin || !left || !right) return;

    const opacity = (params.opacity as number) ?? 0.75;
    const asymmetry = (params.asymmetry as number) ?? 0.55;
    const showAnchors = (params.showAnchors as boolean) ?? false;

    // Center on the horizontal midline of cranium/chin
    const cx = (left.x + right.x) / 2;
    const widthRadius = Math.hypot(right.x - left.x, right.y - left.y) / 2;

    // Split the vertical axis: cranium half (top→eyes-ish) wider, chin half narrower.
    // Asymmetry slider biases the split point. 0 = perfect oval, 1 = pointy chin.
    const verticalAxis = chin.y - top.y;
    const splitY = top.y + verticalAxis * (0.5 + asymmetry * 0.15); // split sits below true midpoint
    const topRadius = splitY - top.y;
    const bottomRadius = chin.y - splitY;

    // Width of bottom half is squeezed by asymmetry (narrower chin)
    const bottomWidthRadius = widthRadius * (1 - asymmetry * 0.35);

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = "#f472b6";
    ctx.lineWidth = 2;

    ctx.beginPath();
    // Top half (cranium): ellipse from left through top to right
    ctx.ellipse(cx, splitY, widthRadius, topRadius, 0, Math.PI, 0, false);
    // Bottom half (jaw→chin): ellipse from right through chin back to left, narrower
    ctx.ellipse(cx, splitY, bottomWidthRadius, bottomRadius, 0, 0, Math.PI, false);
    ctx.closePath();
    ctx.stroke();

    if (showAnchors) {
      ctx.fillStyle = "#f472b6";
      [top, chin, left, right].forEach((p) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    ctx.restore();
  },
};
