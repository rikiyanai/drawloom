"use client";
import { OVERLAYS } from "@/lib/overlays/registry";
import { useStudio } from "@/lib/store";

export function OverlayPanel() {
  const { overlays, toggleOverlay, setOverlayParam, pose, status, mode, viewFilters, setViewFilter } = useStudio();

  // In webcam mode, always show the panel (status churns frame-to-frame).
  // In upload mode, hide until an image is being processed or done.
  if (mode === "upload" && (status === "idle" || status === "loading")) return null;

  return (
    <div className="space-y-3">
      {status === "no-face" && (
        <div className="rounded-md border border-amber-700/50 bg-amber-950/40 text-amber-200 text-sm p-3">
          No face detected. Geometry/value overlays will still work; construction/anatomy/proportion need a visible face.
        </div>
      )}
      {pose && (
        <div className="rounded-md border border-zinc-800 bg-zinc-950 text-xs p-3 font-mono text-zinc-300">
          yaw <span className="text-cyan-400">{pose.angles.yaw.toFixed(1)}°</span>{" · "}
          pitch <span className="text-cyan-400">{pose.angles.pitch.toFixed(1)}°</span>{" · "}
          roll <span className="text-cyan-400">{pose.angles.roll.toFixed(1)}°</span>
        </div>
      )}

      <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3 space-y-2">
        <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">View filters</div>
        <label className="flex items-center justify-between text-sm cursor-pointer">
          <span>Black &amp; white</span>
          <input
            type="checkbox"
            checked={viewFilters.grayscale}
            onChange={(e) => setViewFilter("grayscale", e.target.checked)}
            className="h-4 w-4 accent-cyan-500"
          />
        </label>
        <label className="flex items-center justify-between text-sm cursor-pointer">
          <span>Background blur {mode === "upload" && <span className="text-zinc-500 text-xs">(webcam only)</span>}</span>
          <input
            type="checkbox"
            disabled={mode === "upload"}
            checked={viewFilters.bgBlur}
            onChange={(e) => setViewFilter("bgBlur", e.target.checked)}
            className="h-4 w-4 accent-cyan-500"
          />
        </label>
        {viewFilters.bgBlur && (
          <div className="text-xs">
            <div className="flex justify-between text-zinc-400 mb-0.5">
              <span>Blur strength</span>
              <span className="font-mono">{viewFilters.bgBlurAmount}px</span>
            </div>
            <input
              type="range"
              min={4}
              max={40}
              step={1}
              value={viewFilters.bgBlurAmount}
              onChange={(e) => setViewFilter("bgBlurAmount", Number(e.target.value))}
              className="w-full accent-cyan-500"
            />
          </div>
        )}
      </div>
      {OVERLAYS.map((o) => {
        const state = overlays[o.id];
        const disabled = o.requiresFace && !pose;
        return (
          <div
            key={o.id}
            className={`rounded-md border ${
              state.enabled ? "border-cyan-700 bg-zinc-900" : "border-zinc-800 bg-zinc-950"
            } p-3 transition-colors ${disabled ? "opacity-40" : ""}`}
          >
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="font-medium text-sm">{o.name}</span>
              <input
                type="checkbox"
                disabled={disabled}
                checked={state.enabled}
                onChange={() => toggleOverlay(o.id)}
                className="h-4 w-4 accent-cyan-500"
              />
            </label>
            <p className="text-xs text-zinc-500 mt-1">{o.description}</p>
            {state.enabled && (
              <div className="mt-3 space-y-2">
                {o.params.map((p) => (
                  <div key={p.key} className="text-xs">
                    <div className="flex justify-between text-zinc-400 mb-0.5">
                      <span>{p.label}</span>
                      <span className="font-mono">
                        {p.type === "slider"
                          ? Number(state.params[p.key]).toFixed(p.step >= 1 ? 0 : 2)
                          : state.params[p.key]
                          ? "on"
                          : "off"}
                      </span>
                    </div>
                    {p.type === "slider" ? (
                      <input
                        type="range"
                        min={p.min}
                        max={p.max}
                        step={p.step}
                        value={Number(state.params[p.key])}
                        onChange={(e) => setOverlayParam(o.id, p.key, Number(e.target.value))}
                        className="w-full accent-cyan-500"
                      />
                    ) : (
                      <input
                        type="checkbox"
                        checked={Boolean(state.params[p.key])}
                        onChange={(e) => setOverlayParam(o.id, p.key, e.target.checked)}
                        className="h-4 w-4 accent-cyan-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
