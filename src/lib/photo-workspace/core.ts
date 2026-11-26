import {
  FaceDetector,
  FilesetResolver,
  InteractiveSegmenter,
} from "@mediapipe/tasks-vision";
import { detectPose, type PoseResult } from "../pose/detect";
import { singleViewFrame, solveFrame } from "../planes/solve";
import {
  FACE_OVAL,
  LEFT_EYE,
  RIGHT_EYE,
  LEFT_BROW,
  RIGHT_BROW,
  LIPS_OUTER,
  NOSE_BOTTOM,
} from "../pose/landmarks";
import { normalizePin } from "../planes/state";
import { FONT_PROFILE } from "../portrait/types";
import { surfaceVisibilityFrame } from "./plane-surface-visibility";
import { rowPhaseRect, type RowAlignment } from "./native-row-layout";

export type Rect = { x: number; y: number; width: number; height: number };
export type Figure = {
  id: string;
  name: string;
  rect: Rect;
  seed?: { x: number; y: number };
  mask?: string;
  hairMask?: string;
  facialHairMask?: string;
  appearanceMask?: string;
  outlineText?: string;
  pose?: PoseResult;
  pins?: Record<string, { x: number; y: number }>;
  surfaceEdits?: Record<string, { x: number; y: number; z: number }>;
  planeGuide?: string;
  structureGuide?: string;
  structureSummary?: string[];
  structureRecords?: unknown;
  eyePlan?: import("./plane-eye-words").PlaneEyeWordPlan;
  rowAlignment?: RowAlignment;
  shadowMasks?: { band: number; dataUrl: string }[];
  text?: string;
  rawText?: string;
  traceModel?: string;
  traceRect?: Rect;
  lineGuide?: string;
  preparedInput?: string;
  traceLayout?: {
    width: number;
    height: number;
    guideWidth: number;
    guideHeight: number;
  };
  warnings?: string[];
};
export type PhotoProject = {
  schema: "drawloom.photo-workspace.v1";
  name: string;
  photo: string;
  originalPhoto?: string;
  originalRotation?: number;
  figures: Figure[];
  selected: string;
  settings?: {
    rows: number;
    portrait: boolean;
    edgeStrength: number;
    traceMode: "planes" | "edges" | "values" | "prepared-lines";
    hairTone?: number;
    hairPattern?: string;
    preserveFeatures?: boolean;
    rowPhase?: "auto" | "off" | number;
    structureDetail?: number;
    planeBands?: number;
    planeTone?: number;
  };
};
const wasm =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
let detector: Promise<FaceDetector> | undefined,
  segmenter: Promise<InteractiveSegmenter> | undefined;
export const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(Error("This image could not be read."));
    image.src = src;
  });
export const newCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
};
export async function mergeMasks(
  width: number,
  height: number,
  sources: (string | undefined)[],
) {
  const canvas = newCanvas(width, height),
    context = canvas.getContext("2d")!;
  for (const source of sources)
    if (source) context.drawImage(await loadImage(source), 0, 0, width, height);
  return canvas;
}
export function boundedRect(rect: Rect, w: number, h: number): Rect {
  const x = Math.max(0, Math.min(w - 8, Math.round(rect.x))),
    y = Math.max(0, Math.min(h - 8, Math.round(rect.y)));
  return {
    x,
    y,
    width: Math.max(8, Math.min(w - x, Math.round(rect.width))),
    height: Math.max(8, Math.min(h - y, Math.round(rect.height))),
  };
}
export function cropPhoto(photo: HTMLImageElement, rect: Rect) {
  const c = newCanvas(rect.width, rect.height);
  c.getContext("2d")!.drawImage(
    photo,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    c.width,
    c.height,
  );
  return c;
}

export function workingPhoto(
  image: HTMLImageElement,
  turns = 0,
  maxSide = 2400,
) {
  const odd = turns % 2 !== 0,
    rotatedWidth = odd ? image.naturalHeight : image.naturalWidth,
    rotatedHeight = odd ? image.naturalWidth : image.naturalHeight,
    scale = Math.min(1, maxSide / Math.max(rotatedWidth, rotatedHeight)),
    c = newCanvas(rotatedWidth * scale, rotatedHeight * scale),
    ctx = c.getContext("2d")!;
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(
    image,
    (-image.naturalWidth * scale) / 2,
    (-image.naturalHeight * scale) / 2,
    image.naturalWidth * scale,
    image.naturalHeight * scale,
  );
  return c;
}
export function originalCrop(
  image: HTMLImageElement,
  rect: Rect,
  workingWidth: number,
  turns = 0,
) {
  const w = image.naturalWidth,
    h = image.naturalHeight,
    scale = (turns % 2 ? h : w) / workingWidth,
    r = {
      x: rect.x * scale,
      y: rect.y * scale,
      width: rect.width * scale,
      height: rect.height * scale,
    };
  let original: Rect;
  if (turns === 1)
    original = {
      x: r.y,
      y: h - r.x - r.width,
      width: r.height,
      height: r.width,
    };
  else if (turns === 2)
    original = {
      x: w - r.x - r.width,
      y: h - r.y - r.height,
      width: r.width,
      height: r.height,
    };
  else if (turns === 3)
    original = {
      x: w - r.y - r.height,
      y: r.x,
      width: r.height,
      height: r.width,
    };
  else original = r;
  original = boundedRect(original, w, h);
  const crop = cropPhoto(image, original),
    c = newCanvas(
      turns % 2 ? crop.height : crop.width,
      turns % 2 ? crop.width : crop.height,
    ),
    ctx = c.getContext("2d")!;
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((turns * Math.PI) / 2);
  ctx.drawImage(crop, -crop.width / 2, -crop.height / 2);
  return c;
}

export async function suggestFigures(
  photo: HTMLImageElement,
): Promise<Figure[]> {
  detector ??= FilesetResolver.forVisionTasks(wasm)
    .then((files) =>
      FaceDetector.createFromOptions(files, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.55,
      }),
    )
    .catch((error) => {
      detector = undefined;
      throw error;
    });
  const ready = await detector;
  const faces = ready
    .detect(photo)
    .detections.flatMap((d) => (d.boundingBox ? [d.boundingBox] : []));
  // A wide group shot makes faces tiny in the detector's fixed input. Overlap
  // tiles at source scale, then merge duplicate detections before proposing crops.
  const tileSize = Math.min(640, photo.naturalWidth, photo.naturalHeight),
    positions = (length: number) => [
      ...new Set([
        ...Array.from(
          {
            length:
              Math.ceil(Math.max(0, length - tileSize) / (tileSize * 0.72)) + 1,
          },
          (_, i) =>
            Math.min(length - tileSize, Math.round(i * tileSize * 0.72)),
        ),
        length - tileSize,
      ]),
    ];
  if (photo.naturalWidth > tileSize || photo.naturalHeight > tileSize)
    for (const y of positions(photo.naturalHeight))
      for (const x of positions(photo.naturalWidth)) {
        const tile = newCanvas(tileSize, tileSize);
        tile
          .getContext("2d")!
          .drawImage(photo, x, y, tileSize, tileSize, 0, 0, tileSize, tileSize);
        for (const detection of ready.detect(tile).detections) {
          const b = detection.boundingBox;
          if (!b) continue;
          const candidate = {
            ...b,
            originX: b.originX + x,
            originY: b.originY + y,
          };
          const duplicate = faces.some(
            (old) =>
              Math.hypot(
                old.originX +
                  old.width / 2 -
                  candidate.originX -
                  candidate.width / 2,
                old.originY +
                  old.height / 2 -
                  candidate.originY -
                  candidate.height / 2,
              ) <
              Math.max(old.width, candidate.width) * 0.5,
          );
          if (!duplicate) faces.push(candidate);
        }
      }
  const largest = Math.max(0, ...faces.map((b) => b.width * b.height));
  const chosen = faces
    .filter((b) => b.width * b.height >= largest * 0.3)
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .slice(0, 8)
    .sort((a, b) => a.originX - b.originX);
  if (!chosen.length)
    throw Error(
      "No clear faces found. Draw a crop on the source photo instead.",
    );
  return chosen.map((face, i) => {
    const rect = boundedRect(
      {
        x: face.originX - face.width * 1.1,
        y: face.originY - face.height * 0.85,
        width: face.width * 3.3,
        height: photo.naturalHeight - face.originY + face.height * 0.85,
      },
      photo.naturalWidth,
      photo.naturalHeight,
    );
    return {
      id: crypto.randomUUID(),
      name: `Figure ${i + 1}`,
      rect,
      seed: {
        x: face.originX + face.width * 0.5 - rect.x,
        y: Math.min(rect.height - 8, face.originY + face.height * 1.8 - rect.y),
      },
    };
  });
}
export async function objectMask(
  crop: HTMLCanvasElement,
  point: { x: number; y: number },
): Promise<HTMLCanvasElement> {
  segmenter ??= FilesetResolver.forVisionTasks(wasm)
    .then((files) =>
      InteractiveSegmenter.createFromOptions(files, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite",
          delegate: "CPU",
        },
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      }),
    )
    .catch((error) => {
      segmenter = undefined;
      throw error;
    });
  const result = (await segmenter).segment(crop, {
    keypoint: { x: point.x / crop.width, y: point.y / crop.height },
  });
  try {
    const mask = result.confidenceMasks?.[1] ?? result.confidenceMasks?.[0];
    if (!mask)
      throw Error("The selected-object model returned no foreground mask.");
    const pixels = mask.getAsFloat32Array(),
      small = newCanvas(mask.width, mask.height),
      ctx = small.getContext("2d")!,
      rgba = ctx.createImageData(mask.width, mask.height);
    for (let i = 0; i < pixels.length; i++) {
      rgba.data[i * 4] = rgba.data[i * 4 + 1] = rgba.data[i * 4 + 2] = 255;
      rgba.data[i * 4 + 3] = pixels[i] >= 0.5 ? 255 : 0;
    }
    ctx.putImageData(rgba, 0, 0);
    const full = newCanvas(crop.width, crop.height);
    full.getContext("2d")!.drawImage(small, 0, 0, full.width, full.height);
    return full;
  } finally {
    result.close();
  }
}
export async function cutoutPhoto(
  crop: HTMLCanvasElement,
  maskUrl?: string,
  white = false,
) {
  const c = newCanvas(crop.width, crop.height),
    ctx = c.getContext("2d")!;
  ctx.drawImage(crop, 0, 0);
  if (maskUrl) {
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(await loadImage(maskUrl), 0, 0, c.width, c.height);
    ctx.globalCompositeOperation = "source-over";
  }
  if (white) {
    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.globalCompositeOperation = "source-over";
  }
  return c;
}
export async function analyzeFigure(crop: HTMLCanvasElement) {
  const pose = await detectPose(crop);
  if (!pose)
    throw Error(
      "No face detected in this crop. Adjust the crop and try again.",
    );
  return pose;
}
export function portraitRect(figure: Figure): Rect {
  if (!figure.pose)
    return { x: 0, y: 0, width: figure.rect.width, height: figure.rect.height };
  const p = figure.pose,
    s = p.bbox.size,
    top = Math.min(...FACE_OVAL.map((i) => p.landmarks[i].y));
  return boundedRect(
    {
      x: p.bbox.cx - s * 0.77,
      y: top - s * 0.35,
      width: s * 1.54,
      height: p.landmarks[152].y + s * 0.45 - (top - s * 0.35),
    },
    figure.rect.width,
    figure.rect.height,
  );
}
export function cropCanvas(source: HTMLCanvasElement, rect: Rect) {
  const c = newCanvas(rect.width, rect.height);
  c.getContext("2d")!.drawImage(
    source,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    c.width,
    c.height,
  );
  return c;
}

export function planeFrame(figure: Figure) {
  if (!figure.pose) throw Error("Analyze the face first.");
  const base = singleViewFrame(figure.pose);
  if (
    !Object.keys(figure.pins ?? {}).length &&
    !Object.keys(figure.surfaceEdits ?? {}).length
  )
    return surfaceVisibilityFrame(base);
  const state = structuredClone(base.state);
  for (const [id, point] of Object.entries(figure.pins ?? {}))
    state.front[id] = normalizePin(point, figure.pose, 0);
  state.surfaceEdits = { ...state.surfaceEdits, ...figure.surfaceEdits };
  // Generated seed locations are priors. Only an explicit photo pin should
  // constrain a point after the user moves its 3D surface position.
  for (const id of Object.keys(figure.surfaceEdits ?? {}))
    if (!Object.hasOwn(figure.pins ?? {}, id)) delete state.front[id];
  return surfaceVisibilityFrame(solveFrame(base.context, state, base.shotId));
}
export function faceGuides(
  crop: HTMLCanvasElement,
  figure: Figure,
  kind: "features" | "planes" | "values" | "edges",
  strength = 24,
): HTMLCanvasElement {
  const c = newCanvas(crop.width, crop.height),
    ctx = c.getContext("2d")!;
  if (kind === "features") {
    if (!figure.pose) throw Error("Analyze the face first.");
    ctx.strokeStyle = "#244e76";
    ctx.lineWidth = 1.5;
    for (const ids of [
      FACE_OVAL,
      LEFT_EYE,
      RIGHT_EYE,
      LEFT_BROW,
      RIGHT_BROW,
      LIPS_OUTER,
      NOSE_BOTTOM,
    ]) {
      ctx.beginPath();
      ids.forEach((id, i) => {
        const p = figure.pose!.landmarks[id];
        if (i) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
      });
      if ([FACE_OVAL, LEFT_EYE, RIGHT_EYE, LIPS_OUTER].includes(ids))
        ctx.closePath();
      ctx.stroke();
    }
  } else if (kind === "planes") {
    const frame = planeFrame(figure),
      point = (id: string) => figure.pins?.[id] ?? frame.vertices[id];
    ctx.lineWidth = 1;
    for (const face of frame.faces.filter((f) => f.visible)) {
      const points = face.verts.map(point).filter(Boolean);
      if (!points.length) continue;
      ctx.beginPath();
      points.forEach((p, i) =>
        i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
      );
      ctx.closePath();
      ctx.fillStyle = `hsla(${(face.yaw + 180) % 360},45%,55%,.12)`;
      ctx.fill();
      ctx.strokeStyle = "rgba(38,102,174,.8)";
      ctx.stroke();
    }
    for (const vertex of Object.values(frame.vertices).filter(
      (v) => v.visibility === "visible",
    )) {
      const p = point(vertex.id);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.3, 0, Math.PI * 2);
      ctx.fillStyle = figure.pins?.[vertex.id] ? "#e06020" : "#2b69a1";
      ctx.fill();
    }
  } else {
    const data = crop
        .getContext("2d")!
        .getImageData(0, 0, crop.width, crop.height),
      out = ctx.createImageData(c.width, c.height),
      lum = new Float32Array(c.width * c.height);
    for (let i = 0; i < lum.length; i++)
      lum[i] =
        0.299 * data.data[i * 4] +
        0.587 * data.data[i * 4 + 1] +
        0.114 * data.data[i * 4 + 2];
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++) {
        const i = y * c.width + x;
        let v = 255;
        if (kind === "values") v = Math.round(lum[i] / 85) * 85;
        else if (x > 1 && y > 1 && x < c.width - 2 && y < c.height - 2) {
          const dx = lum[i + 1] - lum[i - 1],
            dy = lum[i + c.width] - lum[i - c.width];
          v = Math.hypot(dx, dy) > strength ? 40 : 255;
        }
        out.data[i * 4] = out.data[i * 4 + 1] = out.data[i * 4 + 2] = v;
        out.data[i * 4 + 3] = 255;
      }
    ctx.putImageData(out, 0, 0);
  }
  return c;
}

export async function studioPhotoProject(
  photo: HTMLImageElement,
  figure: Figure,
  sourceName: string,
  rows: number,
) {
  const crop = cropPhoto(photo, figure.rect),
    cut = await cutoutPhoto(crop, figure.mask, true),
    region = figure.traceRect ?? {
      x: 0,
      y: 0,
      width: crop.width,
      height: crop.height,
    },
    scale = Math.min(1, (rows * 17) / region.height),
    guideWidth =
      figure.traceLayout?.guideWidth ?? Math.ceil(region.width * scale),
    guideHeight =
      figure.traceLayout?.guideHeight ?? Math.ceil(region.height * scale),
    width = Math.max(64, figure.traceLayout?.width ?? guideWidth),
    height = Math.max(64, figure.traceLayout?.height ?? guideHeight);
  const guides: {
    id: string;
    kind: "guide";
    name: string;
    image: string;
    reference: object;
    registration: object;
    x: number;
    y: number;
    scale: number;
    rotation: number;
    opacity: number;
    visible: boolean;
    locked: boolean;
  }[] = [];
  const add = (
    canvas: HTMLCanvasElement,
    name: string,
    visible: boolean,
    alreadyCropped = false,
  ) => {
    const sized = newCanvas(width, height);
    sized
      .getContext("2d")!
      .drawImage(
        alreadyCropped ? canvas : cropCanvas(canvas, region),
        0,
        0,
        guideWidth,
        guideHeight,
      );
    const image = sized.toDataURL("image/png");
    if (image.length > 4 * 1024 * 1024)
      throw Error("This guide is too large. Reduce the native row count.");
    guides.push({
      id: crypto.randomUUID(),
      kind: "guide",
      name,
      image,
      reference: {
        kind: "photo-workspace",
        sourceName,
        crop: figure.rect,
        traceRegion: region,
        cutoutModel: figure.mask ? "MediaPipe MagicTouch float32 v1" : null,
        singleViewEstimate: !!figure.pose,
      },
      registration: {
        space: "native-paper-pixels",
        imageWidth: width,
        imageHeight: height,
        pivot: "top-left",
        targetProfile: FONT_PROFILE,
      },
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      opacity: 0.45,
      visible,
      locked: false,
    });
  };
  add(crop, "Original crop", false);
  add(cut, "Selected-person cutout", true);
  add(faceGuides(cut, figure, "values"), "Four-value study", false);
  add(faceGuides(cut, figure, "edges"), "Contour study", false);
  if (figure.pose) {
    add(faceGuides(cut, figure, "features"), "Facial feature anchors", false);
    add(
      faceGuides(cut, figure, "planes"),
      "Editable single-view head planes",
      false,
    );
  }
  if (figure.lineGuide) {
    const line = await loadImage(figure.lineGuide),
      c = newCanvas(line.naturalWidth, line.naturalHeight);
    c.getContext("2d")!.drawImage(line, 0, 0);
    add(c, "Learned photo contour guide", false, true);
  }
  if (figure.planeGuide) {
    const image = await loadImage(figure.planeGuide),
      c = newCanvas(image.naturalWidth, image.naturalHeight);
    c.getContext("2d")!.drawImage(image, 0, 0);
    add(c, "Fitted head plane values before line selection", false);
  }
  if (figure.structureGuide) {
    const image = await loadImage(figure.structureGuide),
      c = newCanvas(image.naturalWidth, image.naturalHeight);
    c.getContext("2d")!.drawImage(image, 0, 0);
    add(c, "Plane-selected head structure", false);
  }
  if (figure.appearanceMask) {
    const image = await loadImage(figure.appearanceMask),
      canvas = newCanvas(image.naturalWidth, image.naturalHeight);
    canvas.getContext("2d")!.drawImage(image, 0, 0);
    add(
      canvas,
      "Material occlusion evidence after fitted plane lighting",
      false,
    );
  }
  if (figure.facialHairMask) {
    const image = await loadImage(figure.facialHairMask),
      canvas = newCanvas(image.naturalWidth, image.naturalHeight);
    canvas.getContext("2d")!.drawImage(image, 0, 0);
    add(canvas, "Fitted-plane facial hair material field", false);
  }
  if (figure.preparedInput) {
    const input = await loadImage(figure.preparedInput),
      c = newCanvas(input.naturalWidth, input.naturalHeight);
    c.getContext("2d")!.drawImage(input, 0, 0);
    add(c, "Exact model input, aligned to native page", false, true);
  }
  return {
    schema: "studio.native-document.v1",
    id: crypto.randomUUID(),
    name: `${figure.name} — photo study`,
    revision: 0,
    profile: FONT_PROFILE,
    width,
    height,
    origin: { x: 0, y: 0 },
    paper: "#ffffff",
    ink: "#000000",
    layers: [
      ...guides,
      {
        id: crypto.randomUUID(),
        kind: "passage",
        name: "Native text drawing",
        text: figure.text ?? "",
        x: 0,
        r: 0,
        paper: "transparent",
        boundary: "reject",
        visible: true,
        locked: false,
      },
    ],
    editor: {
      photoStudy: {
        sourceName,
        crop: figure.rect,
        planes: figure.pins ?? {},
        surfaceEdits: figure.surfaceEdits ?? {},
        structure: figure.structureRecords ?? null,
        traceModel: figure.traceModel ?? null,
      },
    },
  };
}

export function validatePhotoProject(value: unknown): PhotoProject {
  const v = value as PhotoProject;
  if (
    !v ||
    v.schema !== "drawloom.photo-workspace.v1" ||
    typeof v.name !== "string" ||
    typeof v.photo !== "string" ||
    !/^data:image\/(jpeg|png|webp);base64,/.test(v.photo) ||
    !Array.isArray(v.figures) ||
    v.figures.length > 12 ||
    !v.figures.length
  )
    throw Error("Choose a saved photo workspace project.");
  if (
    (v.originalPhoto &&
      !/^data:image\/(jpeg|png|webp);base64,/.test(v.originalPhoto)) ||
    (v.originalRotation !== undefined &&
      (!Number.isInteger(v.originalRotation) ||
        v.originalRotation < 0 ||
        v.originalRotation > 3))
  )
    throw Error("Invalid original photo orientation.");
  const ids = new Set();
  for (const f of v.figures) {
    if (
      !f ||
      typeof f.id !== "string" ||
      ids.has(f.id) ||
      typeof f.name !== "string" ||
      f.name.length > 100 ||
      !f.rect ||
      ![f.rect.x, f.rect.y, f.rect.width, f.rect.height].every(
        Number.isFinite,
      ) ||
      f.rect.width < 8 ||
      f.rect.height < 8 ||
      (f.mask && !/^data:image\/png;base64,/.test(f.mask)) ||
      (f.text !== undefined &&
        (typeof f.text !== "string" || f.text.length > 65536)) ||
      (f.pose &&
        (!Array.isArray(f.pose.landmarks) ||
          f.pose.landmarks.length !== 478 ||
          f.pose.landmarks.some(
            (p) => ![p.x, p.y, p.z].every(Number.isFinite),
          ))) ||
      (f.pins &&
        Object.values(f.pins).some((p) => ![p.x, p.y].every(Number.isFinite)))
    )
      throw Error("Invalid figure in saved photo project.");
    if (
      (f.hairMask && !/^data:image\/png;base64,/.test(f.hairMask)) ||
      (f.lineGuide && !/^data:image\/png;base64,/.test(f.lineGuide)) ||
      [
        f.planeGuide,
        f.structureGuide,
        f.preparedInput,
        f.facialHairMask,
        f.appearanceMask,
        f.eyePlan?.targetGuide,
      ].some(
        (value) =>
          value !== undefined &&
          (typeof value !== "string" ||
            !/^data:image\/png;base64,/.test(value)),
      ) ||
      (f.surfaceEdits &&
        (Object.keys(f.surfaceEdits).length > 400 ||
          Object.values(f.surfaceEdits).some(
            (p) =>
              ![p.x, p.y, p.z].every(
                (n) => Number.isFinite(n) && Math.abs(n) <= 10,
              ),
          )))
    )
      throw Error("Invalid saved model mask or contour guide.");
    if (
      f.seed &&
      (![f.seed.x, f.seed.y].every(Number.isFinite) ||
        f.seed.x < 0 ||
        f.seed.y < 0 ||
        f.seed.x > f.rect.width ||
        f.seed.y > f.rect.height)
    )
      throw Error("Invalid saved person selection.");
    const sourceFrame = f.rowAlignment?.baseRect ?? f.traceRect;
    if (f.rowAlignment) {
      const alignment = f.rowAlignment;
      const expected = rowPhaseRect(alignment.baseRect, alignment.contentRows, alignment.phase);
      if (!f.traceRect || !Array.isArray(alignment.candidates) || alignment.candidates.length > 17 ||
          alignment.candidates.some(c => !Number.isInteger(c.phase) || c.phase < 0 || c.phase > 16 ||
            !Number.isInteger(c.eyes) || c.eyes < 0 || c.eyes > 2 ||
            !Number.isInteger(c.brows) || c.brows < 0 || c.brows > 2 || !Number.isFinite(c.score)) ||
          (['x','y','width','height'] as const).some(k => Math.abs(expected[k] - f.traceRect![k]) > 1e-6))
        throw Error("Invalid saved native row alignment.");
    }
    if (
      sourceFrame &&
      (!Object.values(sourceFrame).every(Number.isFinite) ||
        sourceFrame.x < 0 ||
        sourceFrame.y < 0 ||
        sourceFrame.width < 8 ||
        sourceFrame.height < 8 ||
        sourceFrame.x + sourceFrame.width > f.rect.width ||
        sourceFrame.y + sourceFrame.height > f.rect.height)
    )
      throw Error("Invalid saved trace framing.");
    if (
      f.traceLayout &&
      (!Object.values(f.traceLayout).every(
        (n) => Number.isInteger(n) && n > 0,
      ) ||
        f.traceLayout.width > 2048 ||
        f.traceLayout.height > 4096 ||
        f.traceLayout.guideWidth > f.traceLayout.width ||
        f.traceLayout.guideHeight > f.traceLayout.height)
    )
      throw Error("Invalid saved native page size.");
    ids.add(f.id);
  }
  if (!ids.has(v.selected)) throw Error("The selected figure is missing.");
  if (
    v.settings &&
    (!Number.isInteger(v.settings.rows) ||
      v.settings.rows < 24 ||
      v.settings.rows > 90 ||
      typeof v.settings.portrait !== "boolean" ||
      !Number.isFinite(v.settings.edgeStrength) ||
      v.settings.edgeStrength < 0.5 ||
      v.settings.edgeStrength > 2 ||
      !["planes", "edges", "values", "prepared-lines"].includes(
        v.settings.traceMode,
      ) ||
      (v.settings.hairTone !== undefined &&
        (!Number.isFinite(v.settings.hairTone) ||
          v.settings.hairTone < 0 ||
          v.settings.hairTone > 1)) ||
      (v.settings.hairPattern !== undefined &&
        (typeof v.settings.hairPattern !== "string" ||
          !/^[^\s　]{1,8}$/u.test(v.settings.hairPattern))) ||
      (v.settings.preserveFeatures !== undefined &&
        typeof v.settings.preserveFeatures !== "boolean") ||
      (v.settings.rowPhase !== undefined && v.settings.rowPhase !== "auto" && v.settings.rowPhase !== "off" &&
        (!Number.isInteger(v.settings.rowPhase) || Number(v.settings.rowPhase) < 0 || Number(v.settings.rowPhase) > 16)) ||
      (v.settings.structureDetail !== undefined &&
        (!Number.isFinite(v.settings.structureDetail) ||
          v.settings.structureDetail < 0 ||
          v.settings.structureDetail > 1)) ||
      (v.settings.planeBands !== undefined &&
        (!Number.isInteger(v.settings.planeBands) ||
          v.settings.planeBands < 3 ||
          v.settings.planeBands > 9)) ||
      (v.settings.planeTone !== undefined &&
        (!Number.isFinite(v.settings.planeTone) ||
          v.settings.planeTone < 0 ||
          v.settings.planeTone > 1)))
  )
    throw Error("Invalid filter settings.");
  return v;
}
