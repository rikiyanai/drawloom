import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";
import { nativePaddingExact } from "./native-spacing";

type Rect = { x: number; y: number; width: number; height: number };
type MaskImage = HTMLImageElement | HTMLCanvasElement;
type Word = { x: number; end: number; text: string; gap: string };
const version = "0.10.35";
export const HAIR_MODEL = {
  id: "mediapipe/selfie_multiclass_256x256/float32/1",
  hairClass: 1,
  sha256: "c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0",
  source:
    "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/1/selfie_multiclass_256x256.tflite",
  license: "Apache-2.0",
};
let pending: Promise<ImageSegmenter> | undefined;
async function segmenter() {
  pending ??= (async () => {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? "/drawloom"}/models/selfie-multiclass/model.tflite`,
    );
    if (!response.ok)
      throw Error("The pinned hair segmentation model could not be loaded.");
    const bytes = await response.arrayBuffer(),
      hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    if (hash !== HAIR_MODEL.sha256)
      throw Error("Hair model hash does not match its pinned source.");
    const files = await FilesetResolver.forVisionTasks(
      `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${version}/wasm`,
    );
    return ImageSegmenter.createFromOptions(files, {
      baseOptions: { modelAssetBuffer: new Uint8Array(bytes), delegate: "CPU" },
      runningMode: "IMAGE",
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    });
  })().catch((error) => {
    pending = undefined;
    throw error;
  });
  return pending;
}

/** Full-size white hair / transparent nonhair mask, inferred locally from an
 * already selected-person cutout. Native mask resolution is read explicitly. */
export async function hairMask(
  canvas: HTMLCanvasElement,
  region?: Rect,
): Promise<string> {
  if (!canvas.width || !canvas.height)
    throw Error("Choose a nonempty person cutout.");
  const input = document.createElement("canvas");
  input.width = Math.round(region?.width ?? canvas.width);
  input.height = Math.round(region?.height ?? canvas.height);
  input
    .getContext("2d")!
    .drawImage(
      canvas,
      region?.x ?? 0,
      region?.y ?? 0,
      region?.width ?? canvas.width,
      region?.height ?? canvas.height,
      0,
      0,
      input.width,
      input.height,
    );
  const result = (await segmenter()).segment(input);
  try {
    const category = result.categoryMask;
    if (!category) throw Error("Hair segmentation returned no category mask.");
    const labels = category.getAsUint8Array(),
      small = document.createElement("canvas");
    small.width = category.width;
    small.height = category.height;
    const ctx = small.getContext("2d")!,
      pixels = ctx.createImageData(small.width, small.height);
    for (let i = 0; i < labels.length; i++) {
      pixels.data[i * 4] =
        pixels.data[i * 4 + 1] =
        pixels.data[i * 4 + 2] =
          255;
      pixels.data[i * 4 + 3] = labels[i] === HAIR_MODEL.hairClass ? 255 : 0;
    }
    ctx.putImageData(pixels, 0, 0);
    const full = document.createElement("canvas");
    full.width = canvas.width;
    full.height = canvas.height;
    const out = full.getContext("2d")!;
    out.imageSmoothingEnabled = false;
    out.drawImage(
      small,
      region?.x ?? 0,
      region?.y ?? 0,
      region?.width ?? full.width,
      region?.height ?? full.height,
    );
    return full.toDataURL("image/png");
  } finally {
    result.close();
  }
}

export type HairToneOptions = {
  text: string;
  measure: (text: string) => number;
  mask: MaskImage;
  source: HTMLCanvasElement;
  region: Rect;
  guideWidth: number;
  guideHeight: number;
  amount: number;
  pattern?: string;
  maxLuminance?: number;
};

/** Fill only eligible open paper with a fixed field or measured texture flow. Input should
 * already use native-spacing. Every original ink word keeps its exact x/row:
 * a tone cell is skipped if legal padding cannot preserve both ink anchors. */
export function addBoundedTone({
  text,
  measure,
  mask,
  source,
  region,
  guideWidth,
  guideHeight,
  amount,
  pattern = ":;",
  maxLuminance = 0.48,
}: HairToneOptions): string {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1)
    throw Error("Hair tone amount must be between 0 and 1.");
  if (!amount) return text;
  if (!/^[^\s　]{1,8}$/u.test(pattern))
    throw Error("Choose one nonspace hair-tone pattern of 1–8 characters.");
  if (
    ![guideWidth, guideHeight, region.width, region.height].every(
      (n) => Number.isFinite(n) && n > 0,
    )
  )
    throw Error("Hair tone needs a registered source region.");
  const sourcePixels = source
    .getContext("2d", { willReadFrequently: true })!
    .getImageData(0, 0, source.width, source.height).data;
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = source.width;
  maskCanvas.height = source.height;
  const maskContext = maskCanvas.getContext("2d", {
    willReadFrequently: true,
  })!;
  maskContext.imageSmoothingEnabled = false;
  maskContext.drawImage(mask, 0, 0, maskCanvas.width, maskCanvas.height);
  const maskPixels = maskContext.getImageData(
    0,
    0,
    maskCanvas.width,
    maskCanvas.height,
  ).data;
  const lines = text.split("\n"),
    lineWords: Word[][] = [];
  for (const line of lines) {
    let x = 0,
      gap = "";
    const words: Word[] = [];
    for (const run of line.match(/\s+|\S+/gu) ?? []) {
      const width = measure(run);
      if (/^\s+$/u.test(run)) gap += run;
      else {
        words.push({ x, end: x + width, text: run, gap });
        gap = "";
      }
      x += width;
    }
    lineWords.push(words);
  }
  const flow = pattern === "flow";
  const toneWidth = flow
      ? Math.max(...["i;", "ﾉ;", "ﾐ;", "‐;", ":;"].map(measure))
      : measure(pattern),
    step = Math.ceil((toneWidth + 3 + 30 * (1 - amount)) / 11) * 11,
    rowStep = amount < 0.34 ? 2 : 1;
  if (toneWidth <= 0 || toneWidth > guideWidth) return text;
  // Only existing selected text is rasterized here. Its actual Saitamaar ink,
  // including projecting marks, protects nearby rows without treating the
  // empty interior of an entire word box as occupied. This is a conflict map,
  // never a raster matcher or glyph-selection step.
  const corridor = 4,
    inkCanvas = document.createElement("canvas");
  inkCanvas.width =
    Math.ceil(
      Math.max(
        guideWidth,
        ...lineWords.flatMap((words) => words.map((word) => word.end)),
      ),
    ) +
    corridor * 2;
  inkCanvas.height = lines.length * 17 + corridor * 2;
  const inkContext = inkCanvas.getContext("2d", { willReadFrequently: true })!;
  inkContext.font = "16px Saitamaar";
  inkContext.textBaseline = "alphabetic";
  inkContext.fillStyle = "#000";
  lines.forEach((line, row) =>
    inkContext.fillText(
      line,
      corridor,
      corridor + row * 17 + (1122 / 1280) * 16,
    ),
  );
  const inkPixels = inkContext.getImageData(
    0,
    0,
    inkCanvas.width,
    inkCanvas.height,
  ).data;
  const protectedInk = new Uint8Array(inkCanvas.width * inkCanvas.height),
    offsets: { x: number; y: number }[] = [];
  for (let dy = -corridor; dy <= corridor; dy++)
    for (let dx = -corridor; dx <= corridor; dx++)
      if (dx * dx + dy * dy <= corridor * corridor)
        offsets.push({ x: dx, y: dy });
  for (let y = 0; y < inkCanvas.height; y++)
    for (let x = 0; x < inkCanvas.width; x++) {
      if (inkPixels[(y * inkCanvas.width + x) * 4 + 3] < 8) continue;
      for (const offset of offsets) {
        const px = x + offset.x,
          py = y + offset.y;
        if (px >= 0 && py >= 0 && px < inkCanvas.width && py < inkCanvas.height)
          protectedInk[py * inkCanvas.width + px] = 1;
      }
    }
  const tileCache = new Map<
    string,
    { text: string; width: number; pixels: Uint8ClampedArray }
  >();
  const tileFor = (word: string) => {
    if (tileCache.has(word)) return tileCache.get(word)!;
    const tile = document.createElement("canvas");
    tile.width = Math.ceil(measure(word));
    tile.height = 16;
    const ctx = tile.getContext("2d", { willReadFrequently: true })!;
    ctx.font = "16px Saitamaar";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(word, 0, (1122 / 1280) * 16);
    const value = {
      text: word,
      width: tile.width,
      pixels: ctx.getImageData(0, 0, tile.width, 16).data,
    };
    tileCache.set(word, value);
    return value;
  };
  // Orientation is inferred only inside the foreground material selected by
  // the preceding construction pass. A structure tensor averages local
  // texture; low coherence retains a neutral field rather than inventing flow.
  const flowAt = (x: number, row: number) => {
    const cx = region.x + ((x + toneWidth / 2) / guideWidth) * region.width,
      cy = region.y + ((row * 17 + 8) / guideHeight) * region.height;
    const dx = Math.max(1, (region.width / guideWidth) * 2),
      dy = Math.max(1, (region.height / guideHeight) * 2);
    const lum = (x: number, y: number) => {
      const px = Math.max(0, Math.min(source.width - 1, Math.round(x))),
        py = Math.max(0, Math.min(source.height - 1, Math.round(y))),
        i = (py * source.width + px) * 4;
      return (
        0.2126 * sourcePixels[i] +
        0.7152 * sourcePixels[i + 1] +
        0.0722 * sourcePixels[i + 2]
      );
    };
    let xx = 0,
      xy = 0,
      yy = 0;
    for (let j = -3; j <= 3; j++)
      for (let i = -3; i <= 3; i++) {
        const sx = cx + i * dx,
          sy = cy + j * dy,
          at =
            (Math.max(0, Math.min(source.height - 1, Math.round(sy))) *
              source.width +
              Math.max(0, Math.min(source.width - 1, Math.round(sx)))) *
            4;
        if (maskPixels[at + 3] < 192) continue;
        const gx = (lum(sx + dx, sy) - lum(sx - dx, sy)) / dx,
          gy = (lum(sx, sy + dy) - lum(sx, sy - dy)) / dy;
        xx += gx * gx;
        xy += gx * gy;
        yy += gy * gy;
      }
    const coherence = Math.hypot(xx - yy, 2 * xy) / Math.max(1e-6, xx + yy);
    let angle = 0.5 * Math.atan2(2 * xy, xx - yy) + Math.PI / 2;
    if (angle > Math.PI / 2) angle -= Math.PI;
    const word =
      coherence < 0.18
        ? ":;"
        : Math.abs(angle) < Math.PI / 8
          ? "‐;"
          : Math.abs(angle) > (3 * Math.PI) / 8
            ? "i;"
            : angle < 0
              ? "ﾉ;"
              : "ﾐ;";
    return tileFor(word);
  };
  const paddingCache = new Map<number, string | null>();
  const exactPadding = (distance: number) => {
    if (distance < 0 || !Number.isInteger(distance)) return null;
    if (!paddingCache.has(distance)) {
      const padding = nativePaddingExact(distance);
      paddingCache.set(
        distance,
        measure(padding) === distance ? padding : null,
      );
    }
    return paddingCache.get(distance)!;
  };
  function available(
    x: number,
    row: number,
    tile: ReturnType<typeof tileFor>,
  ): boolean {
    const cellWidth = tile.width;
    if (x < 0 || x + cellWidth > guideWidth || row * 17 + 16 >= guideHeight)
      return false;
    // Same-row words retain their whole native extents and corridor. Across
    // rows, only actual dilated ink blocks the available negative space.
    if (
      lineWords[row].some(
        (word) => word.x < x + cellWidth + corridor && word.end > x - corridor,
      )
    )
      return false;
    // Every actual glyph-ink pixel must stay inside dark source hair. Blank
    // pixels inside the glyph box need not suppress an otherwise valid mark.
    for (let py = row * 17; py < row * 17 + 16; py++)
      for (let px = Math.floor(x); px < Math.ceil(x + cellWidth); px++) {
        const tx = px - Math.floor(x),
          ty = py - row * 17;
        if (tile.pixels[(ty * tile.width + tx) * 4 + 3] < 8) continue;
        if (protectedInk[(py + corridor) * inkCanvas.width + px + corridor])
          return false;
        const sx = Math.floor(
            region.x + ((px + 0.5) / guideWidth) * region.width,
          ),
          sy = Math.floor(
            region.y + ((py + 0.5) / guideHeight) * region.height,
          );
        if (sx < 0 || sy < 0 || sx >= source.width || sy >= source.height)
          return false;
        const at = (sy * source.width + sx) * 4;
        if (
          maskPixels[at + 3] < 192 ||
          maskPixels[at] < 128 ||
          sourcePixels[at + 3] < 192
        )
          return false;
        const luminance =
          (0.2126 * sourcePixels[at] +
            0.7152 * sourcePixels[at + 1] +
            0.0722 * sourcePixels[at + 2]) /
          255;
        if (luminance >= maxLuminance) return false;
      }
    return true;
  }
  return lines
    .map((line, row) => {
      if (row % rowStep) return line;
      const words = lineWords[row];
      let pen = 0,
        out = "",
        changed = false;
      const gap = (end: number, anchored: boolean) => {
        let result = "",
          cursor = pen,
          inserted = false;
        for (
          let lattice = Math.ceil((pen + 1) / step) * step;
          lattice + toneWidth <= end;
          lattice += step
        ) {
          let found:
            { x: number; tile: ReturnType<typeof tileFor> } | undefined;
          for (const offset of [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5]) {
            const x = lattice + offset;
            const tile = flow ? flowAt(x, row) : tileFor(pattern);
            if (
              x < cursor ||
              x + tile.width > end ||
              exactPadding(x - cursor) === null
            )
              continue;
            if (anchored && exactPadding(end - x - tile.width) === null)
              continue;
            if (available(x, row, tile)) {
              found = { x, tile };
              break;
            }
          }
          if (found === undefined) continue;
          result += exactPadding(found.x - cursor)! + found.tile.text;
          cursor = found.x + found.tile.width;
          inserted = changed = true;
        }
        if (anchored) {
          const tail = exactPadding(end - cursor);
          if (tail === null) return null;
          result += tail;
        }
        return inserted ? result : null;
      };
      for (const word of words) {
        const filled = gap(word.x, true);
        // With no eligible tone, reuse the exact original gap to avoid shifting
        // any pre-existing ink, including unusual legacy spacing.
        out += (filled ?? word.gap) + word.text;
        pen = word.end;
      }
      const tail = gap(guideWidth, false);
      if (tail) out += tail;
      return changed ? out.trimEnd() : line;
    })
    .join("\n");
}

export const addHairTone = addBoundedTone;
