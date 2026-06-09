import type { Overlay } from "./types";
import { indicesToPts, type Pt } from "../pose/landmarks";

// Doveline — the central rhythm contour of the face. Traces the silhouette
// ridge running down the midline: forehead crown → glabella → nose bridge →
// nose tip → philtrum → upper lip apex → lower lip → chin.
//
// In 3/4 view this curve naturally appears at an angle because MediaPipe
// lands these landmarks on the actual surface of the face, so the line
// follows the true central ridge rather than projecting to a flat plumb.
//
// Why a separate overlay from Ovoid: the ovoid is the face PERIMETER; the
// doveline is the central CONTOUR. They are different drawing aids that
// were conflated under the same toggle in the first pass.

// MediaPipe canonical centerline column, top → bottom. Every index here
// sits on (or essentially on) the facial midline in the canonical mesh.
const DOVELINE: number[] = [
  10,   // top of forehead
  151,  // mid forehead
  9,    // glabella (between brows, top)
  168,  // nasion (top of nose bridge)
  6,    // mid bridge
  197,  // lower bridge
  195,  // just above nose tip
  1,    // nose tip
  19,   // subnasale
  164,  // upper lip top (philtrum apex)
  0,    // cupid's bow / upper lip apex
  13,   // upper lip inner edge
  14,   // lower lip inner edge
  17,   // lower lip apex (top of mentolabial)
  200,  // mentolabial sulcus
  152,  // chin
];

// Smooth open Catmull-Rom-style curve through pts, drawn as a single bezier
// chain. Tangent at each interior point uses the neighboring points so the
// curve actually hugs the centerline ridge instead of cutting corners.
function drawCatmullRom(ctx: CanvasRenderingContext2D, pts: Pt[], tension = 0.5) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension * 2;
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension * 2;
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension * 2;
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension * 2;
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
  }
  ctx.stroke();
}

export const dovelineOverlay: Overlay = {
  id: "doveline",
  name: "Doveline (central contour)",
  category: "construction",
  description:
    "Central rhythm contour from forehead crown through nose ridge, philtrum, lips, and chin. Follows the true midline of the face surface, so it naturally angles in 3/4 view.",
  requiresFace: true,
  params: [
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 0.9 },
    { key: "lineWidth", label: "Line width", type: "slider", min: 1, max: 5, step: 0.5, default: 2 },
    { key: "tension", label: "Curve tension", type: "slider", min: 0.2, max: 1, step: 0.05, default: 0.5 },
    { key: "showAnchors", label: "Anchor dots", type: "toggle", default: false },
  ],
  render({ ctx, pose, params }) {
    if (!pose) return;
    const pts = indicesToPts(DOVELINE, pose.landmarks);
    if (pts.length < 3) return;
    const opacity = (params.opacity as number) ?? 0.9;
    const lineWidth = (params.lineWidth as number) ?? 2;
    const tension = (params.tension as number) ?? 0.5;
    const showAnchors = (params.showAnchors as boolean) ?? false;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = "#a3e635"; // lime — distinct from the pink ovoid
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    drawCatmullRom(ctx, pts, tension);
    if (showAnchors) {
      ctx.fillStyle = "#a3e635";
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  },
};
