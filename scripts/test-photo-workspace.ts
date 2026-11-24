import { test } from "node:test";
import assert from "node:assert/strict";
import {
  boundedRect,
  validatePhotoProject,
} from "../src/lib/photo-workspace/core";
import {
  nativePadding,
  nativePaddingExact,
  normalizeNativeSpacing,
} from "../src/lib/photo-workspace/native-spacing";

test("native padding keeps model words and legal proportional spaces", () => {
  const widths: Record<string, number> = {
    "　": 11,
    " ": 5,
    "\u2002": 8,
    "\u2005": 4,
    "\u2006": 3,
    "\u2009": 2,
    "\u200a": 1,
  };
  const measure = (s: string) =>
    [...s].reduce((n, c) => n + (widths[c] ?? 5), 0);
  for (let width = 0; width <= 2048; width++) {
    const gap = nativePadding(width);
    assert.doesNotMatch(gap, /^ | {2}|[^　 ]/u);
    assert.ok(Math.abs(measure(gap) - width) <= 5);
  }
  for (let width = 0; width <= 2048; width++) {
    const gap = nativePaddingExact(width);
    assert.equal(measure(gap), width);
    assert.doesNotMatch(gap, /^ | {2}/u);
  }
  const source = "  Example    text　 test\nNext   line",
    result = normalizeNativeSpacing(source, measure);
  assert.equal(result.text.replace(/\s/gu, ""), source.replace(/\s/gu, ""));
  assert.equal(result.maxShift, 0);
  for (const row of result.text.split("\n"))
    assert.doesNotMatch(row, /^ | {2}/u);
});
test("crop stays inside the original and cannot collapse", () => {
  assert.deepEqual(
    boundedRect({ x: -10, y: 900, width: 2000, height: 900 }, 1280, 960),
    { x: 0, y: 900, width: 1280, height: 60 },
  );
  assert.deepEqual(
    boundedRect({ x: 1300, y: 1000, width: 1, height: -1 }, 1280, 960),
    { x: 1272, y: 952, width: 8, height: 8 },
  );
});
test("workspace rejects duplicate figures and invalid saved controls", () => {
  const value = {
    schema: "drawloom.photo-workspace.v1",
    name: "Test",
    photo: "data:image/png;base64,AA==",
    figures: [
      { id: "a", name: "Figure", rect: { x: 0, y: 0, width: 80, height: 100 } },
    ],
    selected: "a",
  };
  assert.equal(validatePhotoProject(value).selected, "a");
  assert.throws(() =>
    validatePhotoProject({
      ...value,
      figures: [...value.figures, ...value.figures],
    }),
  );
  assert.throws(() =>
    validatePhotoProject({
      ...value,
      settings: {
        rows: Infinity,
        portrait: true,
        edgeStrength: 1,
        traceMode: "edges",
      },
    }),
  );
});
