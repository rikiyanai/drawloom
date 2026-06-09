import { FaceLandmarker } from "@mediapipe/tasks-vision";
import type { Overlay } from "./types";

// MediaPipe Face Mesh tessellation — the canonical ~2700-edge triangulation
// that wraps the 468-point face mesh as a continuous surface mesh.
// This replaces the previous "muscle polygons" approach (which was too vague)
// with the classic facemesh wireframe — thin lines hugging the actual
// surface of the face.
//
// Performance: ~2700 line segments at 30fps. We batch into a single
// beginPath/stroke per draw call, which keeps this cheap even on integrated
// GPUs. Optional depth-shaded mode samples z per vertex and tints darker
// where the face recedes, giving a 3D wrap impression.

const TESSELATION = FaceLandmarker.FACE_LANDMARKS_TESSELATION;

export const meshWireframeOverlay: Overlay = {
  id: "mesh-wireframe",
  name: "Face mesh wireframe",
  category: "anatomy",
  description:
    "MediaPipe's 468-point face mesh tessellation (~2700 thin lines) wrapping the surface of your face. Replaces the previous vague muscle polygons.",
  requiresFace: true,
  params: [
    { key: "opacity", label: "Opacity", type: "slider", min: 0, max: 1, step: 0.05, default: 0.45 },
    { key: "lineWidth", label: "Line width", type: "slider", min: 0.25, max: 2, step: 0.25, default: 0.5 },
    { key: "depthShade", label: "Depth shading (z-tint)", type: "toggle", default: true },
    { key: "fillTriangles", label: "Fill triangles (heavier)", type: "toggle", default: false },
  ],
  render({ ctx, pose, params }) {
    if (!pose) return;
    const lms = pose.landmarks;
    const opacity = (params.opacity as number) ?? 0.45;
    const lineWidth = (params.lineWidth as number) ?? 0.5;
    const depthShade = (params.depthShade as boolean) ?? true;
    const fill = (params.fillTriangles as boolean) ?? false;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";

    if (depthShade) {
      // Find z range so we can normalize tint across the visible face
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const p of lms) {
        if (p.z < minZ) minZ = p.z;
        if (p.z > maxZ) maxZ = p.z;
      }
      const range = maxZ - minZ || 1;

      // Group edges by depth bucket for fewer stroke calls
      const BUCKETS = 8;
      const bucketed: Array<Array<{ a: { x: number; y: number }; b: { x: number; y: number } }>> = Array.from(
        { length: BUCKETS },
        () => []
      );
      for (const { start, end } of TESSELATION) {
        const a = lms[start];
        const b = lms[end];
        if (!a || !b) continue;
        const avgZ = (a.z + b.z) / 2;
        const t = (avgZ - minZ) / range; // 0 = closest, 1 = farthest
        const bucket = Math.min(BUCKETS - 1, Math.floor(t * BUCKETS));
        bucketed[bucket].push({ a, b });
      }
      for (let i = 0; i < BUCKETS; i++) {
        const t = i / (BUCKETS - 1);
        // Closer = brighter cyan, farther = darker
        const lightness = Math.round(85 - t * 50); // 85% -> 35%
        ctx.strokeStyle = `hsl(190, 80%, ${lightness}%)`;
        ctx.beginPath();
        for (const { a, b } of bucketed[i]) {
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = "#22d3ee";
      ctx.beginPath();
      for (const { start, end } of TESSELATION) {
        const a = lms[start];
        const b = lms[end];
        if (!a || !b) continue;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
    }

    if (fill) {
      // Build triangles from the tessellation edge list by walking the
      // canonical ordering — every consecutive 3 edges form one triangle.
      // (MediaPipe's tessellation list is ordered as triangle-strip edges.)
      ctx.fillStyle = "rgba(34, 211, 238, 0.06)";
      for (let i = 0; i + 2 < TESSELATION.length; i += 3) {
        const t1 = TESSELATION[i];
        const t2 = TESSELATION[i + 1];
        const t3 = TESSELATION[i + 2];
        const p1 = lms[t1.start];
        const p2 = lms[t2.start];
        const p3 = lms[t3.start];
        if (!p1 || !p2 || !p3) continue;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    ctx.restore();
  },
};
