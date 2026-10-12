"use client";
import { useEffect, useRef, useState } from "react";
import { useStudies } from "@/lib/capture/study-store";
import { CAPTURE_TARGETS } from "@/lib/capture/pose-session";
import { useStudio } from "@/lib/store";
import { MAX_BACKUP_BYTES, parseBackup, serializeBackup } from "@/lib/capture/backup";
import { CanvasStage } from "./CanvasStage";

const label = (id: string) => CAPTURE_TARGETS.find(t => t.id === id)?.shortLabel ?? id;
const button = "rounded border border-zinc-700 px-3 py-1.5 text-xs hover:border-cyan-400 disabled:opacity-40";
function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error("Could not load shot")); image.src = src;
  });
}
function download(url: string, name: string) {
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click();
}
export function StudyBoard() {
  const { sessions, activeId, hydrated, storageError, select, update, remove } = useStudies();
  const session = sessions.find(s => s.id === activeId);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const order = session?.order ?? [];
  const selectedId = selected && order.includes(selected) ? selected : order[0];
  const shot = session?.shots[selectedId];
  useEffect(() => {
    let cancelled = false;
    useStudio.setState({ image: null, pose: null, bodyPose: null });
    if (shot) loadImage(shot.dataUrl).then(image => {
      if (cancelled) return;
      const state = useStudio.getState(); state.setImage(image, shot.dataUrl); state.setPose(shot.pose);
    }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [shot]);
  function move(id: string, offset: number) {
    const next = [...order]; const index = next.indexOf(id); const destination = index + offset;
    if (destination < 0 || destination >= next.length) return;
    [next[index], next[destination]] = [next[destination], next[index]]; update({ order: next });
  }
  function backup() {
    if (!session) return;
    const url = URL.createObjectURL(new Blob([serializeBackup(session)], { type: "application/json" }));
    download(url, "drawloom-study.json"); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importBackup(file: File) {
    setError(null); setImporting(true);
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("This backup exceeds the 40 MB limit.");
      const restored = parseBackup(await file.text());
      await Promise.all(Object.values(restored.shots).map(shot => loadImage(shot.dataUrl)));
      useStudies.getState().importSession(restored); setSelected(null);
    } catch(e) { setError(e instanceof Error ? e.message : "Could not import this backup."); }
    finally { setImporting(false); if (inputRef.current) inputRef.current.value = ""; }
  }
  async function exportSheet() {
    if (!session || !order.length) return;
    setExporting(true); setError(null);
    try {
      const images = await Promise.all(order.map(id => loadImage(session.shots[id].dataUrl)));
      const columns = session.layout === "strip" ? images.length : Math.min(3, images.length);
      const cellWidth = 640, cellHeight = 540, gap = 24;
      const canvas = document.createElement("canvas");
      canvas.width = columns * (cellWidth + gap) + gap;
      canvas.height = Math.ceil(images.length / columns) * (cellHeight + gap) + gap + 64;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Export is unavailable");
      ctx.fillStyle = "#fafafa"; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#18181b"; ctx.font = "28px sans-serif"; ctx.fillText(session.name, gap, 44);
      images.forEach((image, index) => {
        const x = gap + index % columns * (cellWidth + gap), y = 64 + gap + Math.floor(index / columns) * (cellHeight + gap);
        const scale = Math.min(cellWidth / image.naturalWidth, (cellHeight - 44) / image.naturalHeight);
        const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
        ctx.drawImage(image, x + (cellWidth - w) / 2, y + (cellHeight - 44 - h) / 2, w, h);
        ctx.fillStyle = "#18181b"; ctx.font = "22px sans-serif";
        ctx.fillText(`${label(order[index])} · yaw ${session.shots[order[index]].yaw.toFixed(0)}°`, x, y + cellHeight - 12);
      });
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Export failed")), "image/png"));
      const url = URL.createObjectURL(blob); download(url, "drawloom-contact-sheet.png"); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch(e) { setError(e instanceof Error ? e.message : "Export failed"); }
    finally { setExporting(false); }
  }
  return <div data-testid="study-board" className="space-y-4">
    <div className="flex flex-wrap gap-2 items-center">
      <h2 className="text-lg font-medium">Still-shot studies</h2>
      <input ref={inputRef} aria-label="Study backup file" type="file" accept=".json,application/json" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void importBackup(file); }} />
      <button className={button} disabled={!hydrated || importing} onClick={() => inputRef.current?.click()}>{importing ? "Importing…" : "Import study"}</button>
      <select aria-label="Saved session" value={activeId ?? ""} onChange={e => { select(e.target.value); setSelected(null); }} className="max-w-full rounded bg-zinc-900 border border-zinc-700 px-2 py-1">
        {!sessions.length && <option value="">No saved sessions</option>}
        {sessions.map(s => <option key={s.id} value={s.id}>{s.name} ({Object.keys(s.shots).length}/5)</option>)}
      </select>
      <button className={button} disabled={!hydrated} onClick={() => useStudio.getState().setMode("webcam")}>Capture / retake</button>
    </div>
    {(storageError || error) && <p role="alert" className="text-sm text-rose-300">{storageError || error}</p>}
    {!hydrated ? <p>Loading saved studies…</p> : !session || !order.length ? <div className="space-y-3"><p className="text-zinc-400">Start a five-angle capture in webcam mode. Each shot is saved here automatically.</p><div className="grid grid-cols-2 md:grid-cols-3 gap-3">{CAPTURE_TARGETS.map(target => <div key={target.id} className="rounded border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-400"><div>{target.shortLabel}</div><div className="mt-2 text-xs text-zinc-500">Target yaw {target.yaw}° · not captured</div></div>)}</div></div> : <>
      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Session name" value={session.name} maxLength={80} onChange={e => update({ name: e.target.value })} className="rounded bg-zinc-900 border border-zinc-700 px-2 py-1" />
        {(["grid", "strip"] as const).map(layout => <button key={layout} className={button} aria-pressed={session.layout === layout} onClick={() => update({ layout })}>{layout}</button>)}
        <button className={button} onClick={backup}>Back up session</button>
        <button className={button} disabled={exporting} onClick={exportSheet}>{exporting ? "Exporting…" : "Export contact sheet"}</button>
        <button className={button} onClick={() => { if (window.confirm(`Delete “${session.name}” and its saved shots?`)) remove(); }}>Delete session</button>
      </div>
      <p className="text-xs text-zinc-400">Saved on this device. Contact sheets contain clean photos; select a shot below to study with overlays.</p>
      <div className={session.layout === "grid" ? "grid grid-cols-2 md:grid-cols-3 gap-3" : "flex gap-3 overflow-x-auto pb-2"}>
        {order.map((id, index) => <div key={id} className={`rounded border p-2 ${session.layout === "strip" ? "w-52 shrink-0" : "min-w-0"} ${selectedId === id ? "border-cyan-400" : "border-zinc-700"}`}>
          <button aria-label={`Study ${label(id)}`} aria-pressed={selectedId === id} onClick={() => setSelected(id)} className="w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={session.shots[id].dataUrl} alt={label(id)} className="w-full h-36 object-contain bg-black" />
            <span className="text-xs">{label(id)} · measured yaw {session.shots[id].yaw.toFixed(0)}°</span>
          </button>
          <div className="flex justify-between gap-1 mt-2">
            <button className={button} aria-label={`Move ${label(id)} earlier`} disabled={index === 0} onClick={() => move(id, -1)}>←</button>
            <button className={button} onClick={() => download(session.shots[id].dataUrl, `drawloom-${id}.jpg`)}>Save shot</button>
            <button className={button} aria-label={`Move ${label(id)} later`} disabled={index === order.length - 1} onClick={() => move(id, 1)}>→</button>
          </div>
        </div>)}
      </div>
      <h3 className="text-sm">{label(selectedId)} · frozen study</h3>
      <CanvasStage />
    </>}
  </div>;
}
