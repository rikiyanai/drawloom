export type Vec3 = { x: number; y: number; z: number };
/** Row-major matrix acting on column vectors. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];
export type Similarity = { rotation: Mat3; scale: number; translation: Vec3 };
export type Registration = Similarity & { residuals: number[]; median: number; rms: number; weights: number[] };

export function rotate(r: Mat3, p: Vec3): Vec3 {
  return { x: r[0]*p.x+r[1]*p.y+r[2]*p.z, y: r[3]*p.x+r[4]*p.y+r[5]*p.z, z: r[6]*p.x+r[7]*p.y+r[8]*p.z };
}
export function transform(fit: Similarity, point: Vec3): Vec3 {
  const p = rotate(fit.rotation, point);
  return { x: fit.scale*p.x+fit.translation.x, y: fit.scale*p.y+fit.translation.y, z: fit.scale*p.z+fit.translation.z };
}
export const finitePoint = (p: Vec3) => !!p && [p.x, p.y, p.z].every(Number.isFinite);
export const distance = (a: Vec3, b: Vec3) => Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z);
export function median(values: number[]): number {
  const sorted = [...values].sort((a,b) => a-b), i = Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[i] : (sorted[i-1]+sorted[i])/2;
}
