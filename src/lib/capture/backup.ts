import type { StudySession, StudyShot } from "./study-store";
import { CAPTURE_TARGETS } from "./pose-session";

export const MAX_BACKUP_BYTES = 40 * 1024 * 1024;
const ids = new Set(CAPTURE_TARGETS.map(t => t.id));
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const vector = (value: unknown) => object(value) && finite(value.x) && finite(value.y) && finite(value.z);
function validPose(p: unknown): boolean {
  if (p === null) return true;
  return object(p) && Array.isArray(p.landmarks) && p.landmarks.length === 478 && p.landmarks.every(vector)
    && object(p.angles) && [p.angles.yaw, p.angles.pitch, p.angles.roll].every(finite)
    && object(p.bbox) && [p.bbox.cx, p.bbox.cy, p.bbox.size].every(finite) && (p.bbox.size as number) > 0
    && finite(p.imageWidth) && p.imageWidth > 0 && finite(p.imageHeight) && p.imageHeight > 0
    && Array.isArray(p.matrix) && (p.matrix.length === 0 || p.matrix.length === 16) && p.matrix.every(finite)
    && object(p.blendShapes) && Object.values(p.blendShapes).every(finite);
}
export function serializeBackup(session: StudySession): string {
  return JSON.stringify({ format: "drawloom-study", version: 1, session });
}
export function parseBackup(text: string): StudySession {
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw new Error("This file is not valid JSON."); }
  if (!object(value) || value.format !== "drawloom-study" || value.version !== 1) throw new Error("Choose a Drawloom study backup (version 1).");
  const s = value.session;
  if (!object(s) || typeof s.name !== "string" || !s.name.trim() || s.name.length > 80 || !object(s.shots)
    || !Array.isArray(s.order) || !s.order.every(id => typeof id === "string" && ids.has(id))
    || new Set(s.order).size !== s.order.length || !["grid", "strip"].includes(s.layout as string)
    || Object.keys(s.shots).length !== s.order.length || !s.order.every(id => Object.hasOwn(s.shots as object, id))) throw new Error("The backup has an invalid session or shot order.");
  const shots: Record<string, StudyShot> = {};
  for (const id of s.order) {
    const shot = s.shots[id];
    if (!object(shot) || typeof shot.dataUrl !== "string" || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(shot.dataUrl)
      || ![shot.yaw, shot.pitch, shot.roll, shot.capturedAt].every(finite) || !validPose(shot.pose)) throw new Error(`The ${id} shot has invalid image or pose data.`);
    shots[id] = { dataUrl: shot.dataUrl, yaw: shot.yaw as number, pitch: shot.pitch as number, roll: shot.roll as number, capturedAt: shot.capturedAt as number, pose: shot.pose as StudyShot["pose"] };
  }
  return { id: crypto.randomUUID(), name: s.name, shots, order: [...s.order] as string[], layout: s.layout as StudySession["layout"] };
}
