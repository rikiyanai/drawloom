"use client";

// MediaPipe / TensorFlow Lite ship internal INFO and warning lines through
// console.error (a long-standing quirk of the Emscripten -> JS bridge).
// In Next 16's strict error overlay every console.error becomes a red
// "Console Error" panel even when the underlying message is just info.
// We filter the well-known harmless lines once on the client.

const HARMLESS_PATTERNS: (string | RegExp)[] = [
  /^INFO:/,
  /XNNPACK delegate/,
  /Created TensorFlow Lite/,
  /Feedback manager requires a model/,
  /landmark_projection_calculator/,
];

let installed = false;

export function installConsoleFilter() {
  if (installed) return;
  installed = true;
  const original = console.error;
  console.error = (...args: unknown[]) => {
    const first = args[0];
    const msg = typeof first === "string" ? first : first instanceof Error ? first.message : "";
    for (const pat of HARMLESS_PATTERNS) {
      if (typeof pat === "string" ? msg.includes(pat) : pat.test(msg)) {
        // Re-route to console.info so the line is still visible in DevTools,
        // just not classified as an error by Next's overlay.
        console.info(...args);
        return;
      }
    }
    original.apply(console, args);
  };
}
