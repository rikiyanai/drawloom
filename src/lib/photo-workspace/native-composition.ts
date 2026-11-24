import { nativePaddingExact } from "./native-spacing";
export type NativeWord = {
  x: number;
  row: number;
  text: string;
  owner?: string;
};
export type NativeReserve = {
  x: number;
  y: number;
  width: number;
  height: number;
};
/** The structure plan owns these native regions before general encoding.
 * Merge complete planned words at their measured pen positions. The general
 * encoder supplies only the remaining ink; no raster image edits text. */
export function composeNativeWords(
  base: string,
  words: NativeWord[],
  reserves: NativeReserve[],
  measure: (s: string) => number,
): string {
  if (!words.length) return base;
  const rows: NativeWord[][] = base.split("\n").map((line, row) => {
    let x = 0;
    const kept: NativeWord[] = [];
    for (const char of line) {
      const width = measure(char);
      if (
        !/\s/u.test(char) &&
        !reserves.some(
          (r) =>
            x < r.x + r.width &&
            x + width > r.x &&
            row * 17 < r.y + r.height &&
            (row + 1) * 17 > r.y,
        )
      )
        kept.push({ x, row, text: char });
      x += width;
    }
    return kept;
  });
  for (const word of words) {
    while (rows.length <= word.row) rows.push([]);
    const end = word.x + measure(word.text);
    rows[word.row] = rows[word.row].filter(
      (item) => item.x >= end || item.x + measure(item.text) <= word.x,
    );
    rows[word.row].push(word);
  }
  return rows
    .map((items) => {
      let x = 0,
        out = "";
      for (const word of items.sort((a, b) => a.x - b.x)) {
        if (word.x < x)
          throw Error("The planned native feature words overlap.");
        out += nativePaddingExact(word.x - x) + word.text;
        x = word.x + measure(word.text);
      }
      return out;
    })
    .join("\n");
}
