// Preserve model-selected ink words while spelling their gaps in Studio's
// full-space/single-half-space vocabulary. The preview uses this exact TXT.
export function nativePadding(pixels: number): string {
  let best = "",
    error = Math.abs(pixels);
  for (let full = 0; full <= Math.ceil(pixels / 11) + 1; full++) {
    const half = Math.max(
        0,
        Math.min(full, Math.round((pixels - full * 11) / 5)),
      ),
      next = Math.abs(full * 11 + half * 5 - pixels);
    if (next < error) {
      best = "　 ".repeat(half) + "　".repeat(full - half);
      error = next;
    }
  }
  return best;
}
// Studio's native Unicode pixel-space profile preserves complete learned words
// at their original pen positions. Never insert ASCII leading/repeated spaces.
export function nativePaddingExact(pixels: number): string {
  let remaining = Math.max(0, Math.round(pixels)),
    out = "　".repeat(Math.floor(remaining / 11));
  remaining %= 11;
  for (const [width, char] of [
    [8, " "],
    [4, " "],
    [3, " "],
    [2, " "],
    [1, " "],
  ] as const) {
    while (remaining >= width) {
      out += char;
      remaining -= width;
    }
  }
  return out;
}
export function normalizeNativeSpacing(
  text: string,
  measure: (text: string) => number,
) {
  let changed = 0,
    maxShift = 0;
  const lines = text.split("\n").map((line) => {
    let target = 0,
      pen = 0,
      out = "";
    for (const run of line.match(/\s+|\S+/gu) ?? []) {
      if (/^\s+$/u.test(run)) {
        target += measure(run);
        continue;
      }
      const gap = nativePaddingExact(Math.max(0, target - pen));
      out += gap;
      pen += measure(gap);
      maxShift = Math.max(maxShift, Math.abs(target - pen));
      out += run;
      pen += measure(run);
      target += measure(run);
    }
    if (out !== line) changed++;
    return out;
  });
  return { text: lines.join("\n"), changed, maxShift };
}
