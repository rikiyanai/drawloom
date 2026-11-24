import { add, sub, mul, cross, unit, inPolygon } from '../planes/geometry';
import { pointVisibility, type PlanesFrame, type Visibility } from '../planes/solve';
import { distance, transform, type Vec3 } from '../planes/types';
import { surfaceVisibilityFrame } from './plane-surface-visibility';

type Point = { x: number; y: number };
export type EyeOwner = 'eye.left' | 'eye.right';
export type EyeFeaturePoint = Point & {
  model: Vec3; depth: number; visibility: Visibility;
};
export type EyeFeaturePath = {
  id: string; owner: EyeOwner; role: 'upper-lid' | 'lower-lid' | 'iris-visible';
  points: EyeFeaturePoint[]; strokeWeight: number;
};
export type PlaneEyeFeature = {
  owner: EyeOwner; aperture: Point[]; open: boolean; apertureRatio: number;
  blink: number; irisStatus: 'visible' | 'closed' | 'unresolved';
  width: number; paths: EyeFeaturePath[];
  gaze?: {
    center: Point; model: Vec3; radiusModel: number; radiusPx: number; disc?: Point[];
    /** Visible arcs only; never the hidden part of the fitted disc. */
    visibleBounds?: { x: number; y: number; width: number; height: number };
    /** Iris centre along the outer-to-inner corner axis. */
    alongAperture: number;
  };
  notes: string[];
};
export type PlaneEyeFeatures = { eyes: PlaneEyeFeature[]; paths: EyeFeaturePath[] };

const RINGS = [
  ['elo', 'elu1', 'elu', 'elu2', 'eli', 'ell2', 'ell', 'ell1'],
  ['ero', 'eru1', 'eru', 'eru2', 'eri', 'erl2', 'erl', 'erl1'],
] as const;
const lerp = (a: Vec3, b: Vec3, t: number) => add(a, mul(sub(b, a), t));
const cross2 = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
const delta = (a: Point, b: Point) => ({ x: a.x - b.x, y: a.y - b.y });
const visible = (p: EyeFeaturePoint) => p.visibility === 'visible' || p.visibility === 'grazing';

/** Exact segment intervals inside the authored (possibly nonconvex) lid polygon. */
function insideIntervals(a: Point, b: Point, polygon: Point[]): [number, number][] {
  const direction = delta(b, a), cuts = [0, 1];
  for (let i = 0; i < polygon.length; i++) {
    const c = polygon[i], d = polygon[(i + 1) % polygon.length];
    const edge = delta(d, c), denominator = cross2(direction, edge);
    if (Math.abs(denominator) < 1e-10) continue;
    const offset = delta(c, a), t = cross2(offset, edge) / denominator;
    const u = cross2(offset, direction) / denominator;
    if (t > 0 && t < 1 && u >= 0 && u <= 1) cuts.push(t);
  }
  cuts.sort((x, y) => x - y);
  const intervals: [number, number][] = [];
  for (let i = 1; i < cuts.length; i++) {
    const start = cuts[i - 1], end = cuts[i], mid = (start + end) / 2;
    if (end - start > 1e-8 && inPolygon({ x: a.x + direction.x * mid, y: a.y + direction.y * mid }, polygon)) intervals.push([start, end]);
  }
  return intervals;
}

/** Source-space paths from the fitted head. This module makes no glyph choices. */
export function eyeFeatures(frame: PlanesFrame): PlaneEyeFeatures {
  frame = surfaceVisibilityFrame(frame);
  const view = frame.context.shots[frame.shotId], eyes: PlaneEyeFeature[] = [];
  if (!view) return { eyes, paths: [] };
  for (const [index, ids] of RINGS.entries()) {
    if (ids.some(id => !frame.vertices[id])) continue;
    const vertices = ids.map(id => frame.vertices[id]);
    const owner: EyeOwner = index === 0 ? 'eye.left' : 'eye.right';
    const aperture = vertices.map(v => ({ x: v.x, y: v.y }));
    const outer = aperture[0], inner = aperture[4], axis2 = delta(inner, outer);
    const width = Math.hypot(axis2.x, axis2.y);
    const area = Math.abs(aperture.reduce((sum, a, i) => sum + cross2(a, aperture[(i + 1) % aperture.length]), 0)) / 2;
    const apertureRatio = area / Math.max(width * width, 1e-9);
    // A closed, collapsed or highly uncertain far eye may own a lid, never a pupil.
    // Image-left landmarks 33/468 belong to the subject's right eye.
    const blink = frame.pose.blendShapes[index === 0 ? 'eyeBlinkRight' : 'eyeBlinkLeft'] ?? 0;
    const open = blink < .55 && width > 2 && apertureRatio > .025 && vertices.filter(v => v.visibility === 'visible' || v.visibility === 'grazing').length >= 3;
    const eye: PlaneEyeFeature = { owner, aperture, open, apertureRatio, blink,
      irisStatus: open ? 'unresolved' : 'closed', width, paths: [], notes: [] };
    const point = (model: Vec3, display: Point, normal: Vec3): EyeFeaturePoint => ({
      x: display.x, y: display.y, model, depth: transform(view.fit, model).z,
      visibility: pointVisibility(frame.context, frame.shotId, model, normal, 'lid'),
    });
    let serial = 0;
    const append = (role: EyeFeaturePath['role'], points: EyeFeaturePoint[]) => {
      if (points.length < 2) return;
      eye.paths.push({ id: `${owner}.${role}.${serial++}`, owner, role, points, strokeWeight: role === 'upper-lid' ? 1.35 : role === 'lower-lid' ? .7 : 1 });
    };
    // Visibility is sampled along edges: partially occluded eyes retain their visible run.
    const sampledSegment = (a: EyeFeaturePoint, b: EyeFeaturePoint, normalA: Vec3, normalB: Vec3) => {
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
      return Array.from({ length: steps + 1 }, (_, i) => {
        const t = i / steps;
        return point(lerp(a.model, b.model, t), { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, unit(lerp(normalA, normalB, t)));
      });
    };
    const visibleRuns = (role: EyeFeaturePath['role'], samples: EyeFeaturePoint[]) => {
      let run: EyeFeaturePoint[] = [];
      for (const p of samples) {
        if (visible(p)) run.push(p);
        else { append(role, run); run = []; }
      }
      append(role, run);
    };
    for (const [role, sequence] of [['upper-lid', [0, 1, 2, 3, 4]], ['lower-lid', [4, 5, 6, 7, 0]]] as const) {
      if (!open && role === 'lower-lid') continue;
      const samples: EyeFeaturePoint[] = [];
      for (let i = 1; i < sequence.length; i++) {
        const a = vertices[sequence[i - 1]], b = vertices[sequence[i]];
        const segment = sampledSegment(point(a.model, a, a.normal), point(b.model, b, b.normal), a.normal, b.normal);
        samples.push(...(i === 1 ? segment : segment.slice(1)));
      }
      visibleRuns(role, samples);
    }
    const center = frame.vertices[`iris${index}`], rim = frame.vertices[`iris${index}r`];
    const iris = frame.irises.find(ring => ring.eye[0] === ids[0]);
    if (center && rim) {
      const radius = distance(center.model, rim.model);
      eye.gaze = { center: { x: center.x, y: center.y }, model: center.model,
        radiusModel: radius, radiusPx: radius * view.fit.scale,
        alongAperture: ((center.x - outer.x) * axis2.x + (center.y - outer.y) * axis2.y) / Math.max(width * width, 1e-9) };
      if (open && iris) {
        const normal = unit(vertices.reduce((n, vertex) => add(n, vertex.normal), { x: 0, y: 0, z: 0 }));
        const axis = unit(sub(vertices[4].model, vertices[0].model)), up = unit(cross(normal, axis));
        const ringModels = iris.points.map((_, i) => {
          const theta = i * 2 * Math.PI / (iris.points.length - 1);
          return add(center.model, add(mul(axis, radius * Math.cos(theta)), mul(up, radius * Math.sin(theta))));
        });
        // Project the same canonical model samples that visibility consumes.
        // Upstream irises may have been built before normal orientation repair.
        const projectedCenter=transform(view.fit,center.model);
        const offset={x:center.x-projectedCenter.x,y:center.y-projectedCenter.y};
        const ringPoints=ringModels.map(model=>{const q=transform(view.fit,model);return{x:q.x+offset.x,y:q.y+offset.y};});
        eye.gaze.disc=ringPoints;
        let joined: EyeFeaturePoint[] = [];
        const finish = () => { visibleRuns('iris-visible', joined); joined = []; };
        for (let i = 1; i < ringPoints.length; i++) {
          const a = ringPoints[i - 1], b = ringPoints[i], intervals = insideIntervals(a, b, aperture);
          if (!intervals.length) { finish(); continue; }
          for (const [start, end] of intervals) {
            if (start > 1e-7) finish();
            const at = (t: number) => point(lerp(ringModels[i - 1], ringModels[i], t), { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, normal);
            const samples = sampledSegment(at(start), at(end), normal, normal);
            joined.push(...(joined.length ? samples.slice(1) : samples));
            if (end < 1 - 1e-7) finish();
          }
        }
        finish();
        const shown = eye.paths.filter(path => path.role === 'iris-visible').flatMap(path => path.points);
        if (shown.length) {
          const xs = shown.map(p => p.x), ys = shown.map(p => p.y), x = Math.min(...xs), y = Math.min(...ys);
          eye.gaze.visibleBounds = { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
          eye.irisStatus = 'visible';
        } else eye.notes.push('Fitted iris has no visible arc inside the lid aperture.');
      } else eye.notes.push(open ? 'Solver supplied no visible iris for this view.' : 'Closed or collapsed aperture: iris suppressed.');
    }
    if (vertices.some(v => v.visibility === 'uncertain')) eye.notes.push('Far-eye geometry is uncertain; uncertain path samples are suppressed.');
    eyes.push(eye);
  }
  return { eyes, paths: eyes.flatMap(eye => eye.paths) };
}
