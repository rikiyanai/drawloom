import type { PoseResult } from "../pose/detect";
import { makeMediaPipeFramePacket, type MediaPipeFramePacket } from "../pose/packet";
import { OVERLAYS, defaultParams } from "../overlays/registry";
import { PLANES_ENABLED, singleViewFrame } from '../planes/solve';
import type { PlanesFrame } from '../planes/solve';
import { FACE_OVAL } from '../pose/landmarks';
import { segmentImage } from '../pose/segmenter';
import { inPolygon } from '../planes/geometry';
import { drawPlanes } from '../planes/render';

// Underdrawing packet for text-art tools such as Hatch Studio's Tracing guide.
// Each registered overlay is rendered alone on a transparent canvas at the
// export size, so the receiver can show, hide and weight them separately.
// The packet carries only what the registry already draws (failure log #15):
// inferred construction is added only in an explicitly flagged experimental
// build, with source and fit quality preserved in optional metadata.
export const UNDERDRAWING_SCHEMA = "drawloom.underdrawing.v1";
export const UNDERDRAWING_MAX_WIDTH = 2048;

export type UnderdrawingLayer = {
  id: string;
  name: string;
  kind: "photo" | "overlay";
  category: string;
  enabled: boolean;
  params: Record<string, number | boolean>;
  // True when light-on-dark output was inverted to dark marks on paper.
  inverted: boolean;
  width: number;
  height: number;
  png: string;
  sha256: string;
};

export type UnderdrawingPacket = {
  schema: typeof UNDERDRAWING_SCHEMA;
  createdAt: string;
  sourceName: string;
  width: number;
  height: number;
  scale: number;
  // background: "removed" when the portrait was cut out (room painted white) before detection and overlays.
  source: { width: number; height: number; sha256: string; background: "removed" | "kept" | null };
  angles: { yaw: number; pitch: number; roll: number } | null;
  pose: MediaPipeFramePacket | null;
  layers: UnderdrawingLayer[];
  skipped: { id: string; reason: string }[];
  planes?: {topologyVersion:number;source:PlanesFrame['source'];refShotId:string;vertices:Record<string,{x:number;y:number;depth:number;visibility:string;observed:boolean;depthFromPrior:boolean;residualPx:number}>;faces:PlanesFrame['faces'];primitives:PlanesFrame['primitives'];primitiveSpace:'normalized reference head frame';curves:PlanesFrame['curves'];irises:PlanesFrame['irises'];canon:PlanesFrame['canon'];notes:PlanesFrame['state']['notes'][string]};
};

export type OverlaySelection = Record<string, { enabled: boolean; params: Record<string, number | boolean> }>;

export type UnderdrawingOptions = {
  image: HTMLImageElement;
  pose: PoseResult;
  overlays?: OverlaySelection;
  background?: "removed" | "kept" | null;
  sourceName?: string;
  maxWidth?: number;
  include?: string[];
  includePhoto?: boolean;
  // Per-overlay parameter overrides, e.g. { edges: { mode: 1 }, notan: { levels: 3 } }.
  params?: Record<string, Record<string, number | boolean>>;
  planes?:PlanesFrame;
  includePlanesMetadata?:boolean;
  includeReviewBlockIn?:boolean;
  reviewConstruction?:boolean;
  targetFaceSize?:number;
};

async function encode(canvas: HTMLCanvasElement): Promise<{ png: string; sha256: string }> {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed"))), "image/png")
  );
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const sha256 = Array.from(digest, (n) => n.toString(16).padStart(2, "0")).join("");
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { png: `data:image/png;base64,${btoa(binary)}`, sha256 };
}

function blankCanvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  return [canvas, ctx];
}

// Sobel edges are drawn light on black; receivers multiply guides onto paper, so
// export them as dark lines on white instead.
function invertInPlace(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = data.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i];
    d[i + 1] = 255 - d[i + 1];
    d[i + 2] = 255 - d[i + 2];
  }
  ctx.putImageData(data, 0, 0);
}

function scalePose(pose: PoseResult, scale: number, width: number, height: number): PoseResult {
  if (!pose) return null;
  return {
    ...pose,
    landmarks: pose.landmarks.map((p) => ({ x: p.x * scale, y: p.y * scale, z: p.z * scale })),
    bbox: { cx: pose.bbox.cx * scale, cy: pose.bbox.cy * scale, size: pose.bbox.size * scale },
    imageWidth: width,
    imageHeight: height,
  };
}

export async function buildUnderdrawingPacket(options: UnderdrawingOptions): Promise<UnderdrawingPacket> {
  const { image, overlays, sourceName = "drawloom-portrait", includePhoto = true } = options;
  if(options.targetFaceSize!==undefined&&(!Number.isFinite(options.targetFaceSize)||options.targetFaceSize<=0))throw new Error('The reference head size must be positive.');
  const maxWidth = Math.min(UNDERDRAWING_MAX_WIDTH, Math.max(64, Math.round(options.maxWidth ?? 1024)));
  const include = options.include ? new Set(options.include) : null;
  const unknown = [...(include ?? []), ...Object.keys(options.params ?? {})].filter((id) => !OVERLAYS.some((o) => o.id === id));
  if (unknown.length) throw new Error(`Unknown overlay id(s): ${unknown.join(", ")}`);
  const requestedScale = options.targetFaceSize&&options.pose?Math.min(UNDERDRAWING_MAX_WIDTH/image.naturalWidth,options.targetFaceSize/options.pose.bbox.size):Math.min(1, maxWidth / image.naturalWidth);
  const width = Math.round(image.naturalWidth * requestedScale);
  const scale=width/image.naturalWidth;
  const height = Math.round(image.naturalHeight * scale);
  const pose = scalePose(options.pose, scale, width, height);
  const planes=PLANES_ENABLED?(options.planes??(options.pose?singleViewFrame(options.pose):undefined)):undefined;

  const [photoCanvas, photoCtx] = blankCanvas(width, height);
  photoCtx.drawImage(image, 0, 0, width, height);
  const photo = await encode(photoCanvas);

  const layers: UnderdrawingLayer[] = [];
  const skipped: UnderdrawingPacket["skipped"] = [];
  if (includePhoto) {
    layers.push({ id: "photo", name: "Photo", kind: "photo", category: "source", enabled: false, params: {}, inverted: false, width, height, ...photo });
  }
  for (const overlay of OVERLAYS) {
    if (include && !include.has(overlay.id)) continue;
    if (overlay.requiresFace && !pose) {
      skipped.push({ id: overlay.id, reason: "no face detected" });
      continue;
    }
    const state = overlays?.[overlay.id];
    const params = { ...(state?.params ?? defaultParams(overlay)), ...options.params?.[overlay.id] };
    const [canvas, ctx] = blankCanvas(width, height);
    overlay.render({ ctx, image, pose, bodyPose: null, width, height, params,planes });
    const inverted = overlay.id === "edges" && Math.round(params.mode as number) === 1;
    if (inverted) invertInPlace(canvas, ctx);
    if(planes&&options.reviewConstruction&&overlay.id==='edges'){
      const lines=ctx.getImageData(0,0,width,height);for(let i=0;i<lines.data.length;i+=4){const strength=255-lines.data[i];lines.data[i]=lines.data[i+1]=lines.data[i+2]=0;lines.data[i+3]=Math.round(strength*.25);}ctx.putImageData(lines,0,0);
    }
    layers.push({
      id: overlay.id,
      name: overlay.name,
      kind: "overlay",
      category: overlay.category,
      enabled: state?.enabled ?? false,
      params,
      inverted,
      width,
      height,
      ...(await encode(canvas)),
    });
  }

  if(planes&&options.includeReviewBlockIn&&pose){
    const mask=await segmentImage(image),[canvas,ctx]=blankCanvas(width,height),[hull,hullCtx]=blankCanvas(width,height);
    hullCtx.beginPath();FACE_OVAL.forEach((id,i)=>{const p=pose.landmarks[id];if(i)hullCtx.lineTo(p.x,p.y);else hullCtx.moveTo(p.x,p.y);});hullCtx.closePath();hullCtx.fill();
    const face=hullCtx.getImageData(0,0,width,height).data;ctx.drawImage(image,0,0,width,height);const pixels=ctx.getImageData(0,0,width,height),d=pixels.data;
    const sphereOutline=planes.curves.find(curve=>curve.id==='sphere')?.points.map(p=>({x:p.x*scale,y:p.y*scale}))??[];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){const index=(y*width+x)*4,person=mask.labels[Math.floor(y*mask.height/height)*mask.width+Math.floor(x*mask.width/width)]!==0,inside=face[index+3]>0,inBall=inPolygon({x,y},sphereOutline),lum=(.299*d[index]+.587*d[index+1]+.114*d[index+2])/255;
      const dark=lum<.33,mid=lum<.67;d[index]=d[index+1]=d[index+2]=dark?25:120;d[index+3]=person&&(dark&&(inside||inBall)||mid&&inside)?220:0;
    }
    ctx.putImageData(pixels,0,0);layers.push({id:'review-block-in',name:'Subject-masked head value block-in (experimental)',kind:'overlay',category:'value',enabled:true,params:{levels:3},inverted:false,width,height,...await encode(canvas)});
  }
  if(planes&&options.reviewConstruction){
    const[canvas,ctx]=blankCanvas(width,height);drawPlanes(ctx,planes,{scale,faces:false,regions:['eye','nose','mouth']});
    layers.push({id:'review-features',name:'Feature contours (experimental)',kind:'overlay',category:'construction',enabled:true,params:{},inverted:false,width,height,...await encode(canvas)});
    const order=['photo','edges','review-block-in','head-primitives','head-planes','review-features'];layers.sort((a,b)=>(order.includes(a.id)?order.indexOf(a.id):99)-(order.includes(b.id)?order.indexOf(b.id):99));
  }

  return {
    schema: UNDERDRAWING_SCHEMA,
    createdAt: new Date().toISOString(),
    sourceName: sourceName.slice(0, 120),
    width,
    height,
    scale,
    source: { width: image.naturalWidth, height: image.naturalHeight, sha256: photo.sha256, background: options.background ?? null },
    angles: pose ? pose.angles : null,
    pose: makeMediaPipeFramePacket(pose),
    layers,
    skipped,
    ...(planes&&options.includePlanesMetadata?{planes:{topologyVersion:planes.state.topologyVersion,source:planes.source,refShotId:planes.context.refShotId,vertices:Object.fromEntries(Object.entries(planes.vertices).map(([id,p])=>[id,{x:p.x*scale,y:p.y*scale,depth:p.depth*scale,visibility:p.visibility,observed:p.observed,depthFromPrior:p.depthFromPrior,residualPx:p.residualPx*scale}])),faces:planes.faces,primitives:planes.primitives,primitiveSpace:'normalized reference head frame',curves:planes.curves.map(curve=>({...curve,points:curve.points.map(p=>({x:p.x*scale,y:p.y*scale}))})),irises:planes.irises.map(iris=>({...iris,points:iris.points.map(p=>({x:p.x*scale,y:p.y*scale}))})),canon:planes.canon,notes:planes.state.notes[planes.shotId]??{}}}:{}),
  };
}

export function downloadUnderdrawingPacket(packet: UnderdrawingPacket): void {
  const blob = new Blob([`${JSON.stringify(packet)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `drawloom-underdrawing-${packet.source.sha256.slice(0, 12)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
