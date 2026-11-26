import type { Rect } from './core';

export type RowPhaseChoice = {
  phase: number;
  eyes: number;
  brows: number;
  score: number;
};
export type RowAlignment = {
  phase: number;
  baseRect: Rect;
  contentRows: number;
  candidates: RowPhaseChoice[];
};

/** Move the whole composition against the native baseline lattice. One row of
 * paper is shared above/below the original frame; no source content is cropped,
 * no feature moves independently, and the original scale is unchanged. */
export function rowPhaseRect(base: Rect, contentRows: number, phase: number): Rect {
  if (!Number.isInteger(contentRows) || contentRows < 8 || contentRows > 89 ||
      !Number.isInteger(phase) || phase < 0 || phase > 16)
    throw Error('Choose 8–89 content rows and a native row phase of 0–16 px.');
  const pixel = base.height / (contentRows * 17);
  return { ...base, y: base.y - phase * pixel, height: base.height + 17 * pixel };
}

/** Missing identity constructions cannot be traded for a lower fitting error.
 * This ranks geometric alternatives only; it does not certify art quality. */
export function compareRowPhases(a: RowPhaseChoice, b: RowPhaseChoice): number {
  return b.eyes - a.eyes || b.brows - a.brows || a.score - b.score || a.phase - b.phase;
}
