"use client";
import { create } from "zustand";
import type { PoseResult } from "../pose/detect";

export type StudyShot = { dataUrl: string; yaw: number; pitch: number; roll: number; capturedAt: number; pose: PoseResult };
export type StudySession = { id: string; name: string; shots: Record<string, StudyShot>; order: string[]; layout: "grid" | "strip" };
type State = {
  sessions: StudySession[]; activeId: string | null; hydrated: boolean; storageError: string | null;
  hydrate: () => Promise<void>; newSession: () => void;
  update: (patch: Partial<StudySession>) => void;
  putShot: (id: string, shot: StudyShot) => void;
  select: (id: string) => void; remove: () => void;
  importSession: (session: StudySession) => void;
};
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("drawloom-studies", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
let writes = Promise.resolve();
function save() {
  const { sessions, activeId, hydrated } = useStudies.getState();
  if (!hydrated) return;
  writes = writes.catch(() => {}).then(async () => {
    const db = await database();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction("state", "readwrite");
        tx.objectStore("state").put({ sessions, activeId }, "studies");
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error);
      });
      useStudies.setState({ storageError: null });
    } finally { db.close(); }
  }).catch(() => useStudies.setState({ storageError: "Could not save on this device. Keep this tab open and export your shots." }));
}
let hydration: Promise<void> | undefined;
export const useStudies = create<State>((set, get) => ({
  sessions: [], activeId: null, hydrated: false, storageError: null,
  hydrate: () => hydration ??= (async () => {
    try {
      const db = await database();
      try {
        const saved = await new Promise<{ sessions: StudySession[]; activeId: string | null } | undefined>((resolve, reject) => {
          const request = db.transaction("state").objectStore("state").get("studies");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        set({ ...(saved ?? {}), hydrated: true });
      } finally { db.close(); }
    } catch { set({ hydrated: true, storageError: "Device storage is unavailable. Shots will remain in this tab only." }); }
  })(),
  newSession: () => {
    if (!get().hydrated) return;
    const session: StudySession = { id: crypto.randomUUID(), name: `Study ${get().sessions.length + 1}`, shots: {}, order: [], layout: "grid" };
    set({ sessions: [...get().sessions, session], activeId: session.id }); save();
  },
  update: (patch) => { set({ sessions: get().sessions.map(s => s.id === get().activeId ? { ...s, ...patch } : s) }); save(); },
  putShot: (id, shot) => {
    if (!get().activeId) get().newSession();
    const session = get().sessions.find(s => s.id === get().activeId);
    if (session) get().update({ shots: { ...session.shots, [id]: shot }, order: session.order.includes(id) ? session.order : [...session.order, id] });
  },
  importSession: (session) => {
    if (!get().hydrated) return;
    set({ sessions: [...get().sessions, session], activeId: session.id }); save();
  },
  select: (activeId) => { set({ activeId }); save(); },
  remove: () => { const sessions = get().sessions.filter(s => s.id !== get().activeId); set({ sessions, activeId: sessions.at(-1)?.id ?? null }); save(); },
}));
