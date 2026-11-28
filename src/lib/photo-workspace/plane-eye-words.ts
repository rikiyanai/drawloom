import type { PlanesFrame } from '../planes/solve';
import { inPolygon } from '../planes/geometry';
import type { Rect } from './core';
import { eyeFeatures, type EyeOwner, type PlaneEyeFeature } from './plane-eye-features';
import { eyeContourSupport, eyeFootprintExcess } from './eye-contour-support';

export type PlaneEyeWord = {
  x: number; row: number; text: string; role: 'eye-form' | 'brow-form'; owner: EyeOwner;
  score: number; evidence: string;
};
export type PlaneEyeWordPlan = {
  words: PlaneEyeWord[];
  reservedRects: (Rect & { owner: EyeOwner })[];
  notes: string[];
  targetGuide?: string;
};
type Raster = { ink: { x: number; y: number }[]; width: number; height: number; text: string };
type XY = {x:number;y:number};
// Exact capped Euclidean queries. Integer ink uses a tiny occupancy window;
// noninteger source paths retain exact coordinates and memoize stable queries.
const distanceIndexes = new WeakMap<XY[], (p:XY)=>number>();
function nearestSquared(p:XY, points:XY[]):number {
  let query=distanceIndexes.get(points);
  if(!query){
    const integer=points.every(q=>Number.isInteger(q.x)&&Number.isInteger(q.y));
    if(integer&&points.length){
      let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
      for(const q of points){left=Math.min(left,q.x);right=Math.max(right,q.x);top=Math.min(top,q.y);bottom=Math.max(bottom,q.y);}
      const width=right-left+1,height=bottom-top+1,occupied=new Uint8Array(width*height);
      for(const q of points)occupied[(q.y-top)*width+q.x-left]=1;
      query=(q:XY)=>{
        let best=16;
        const ymin=Math.max(top,Math.ceil(q.y-4)),ymax=Math.min(bottom,Math.floor(q.y+4));
        const xmin=Math.max(left,Math.ceil(q.x-4)),xmax=Math.min(right,Math.floor(q.x+4));
        for(let y=ymin;y<=ymax;y++){
          const dy=(q.y-y)**2;if(dy>=best)continue;
          for(let x=xmin;x<=xmax;x++){
            const distance=dy+(q.x-x)**2;
            if(distance<best&&occupied[(y-top)*width+x-left]){best=distance;if(best===0)return 0;}
          }
        }
        return best;
      };
    }else{
      const memo=new Map<number,Map<number,number>>();
      query=(q:XY)=>{
        const column=memo.get(q.x),cached=column?.get(q.y);if(cached!==undefined)return cached;
        let best=16;
        for(let i=0;i<points.length;i++){
          const dx=q.x-points[i].x,dy=q.y-points[i].y,d=dx*dx+dy*dy;
          if(d<best){best=d;if(best===0)break;}
        }
        const next=column??new Map<number,number>();next.set(q.y,best);if(!column)memo.set(q.x,next);
        return best;
      };
    }
    distanceIndexes.set(points,query);
  }
  return query(p);
}
// Form alternatives include compact x-height crossings for low row phases,
// not only full-height kana/discs. Every candidate faces the same geometry,
// pupil, contact and protected-paper checks.
const IRIS_CORES=['yﾌ','ﾜ','ｏ','o','O','ﾓ','ﾏ','ｦ','ﾃ','ｷ','ｼ','ﾐ','y','f','ﾚ','ｪ'];
const COMPACT_IRIS_CORES=['__','_',"'",'､','‐','ｰ'];
const FONT = '16px Saitamaar';
const BASELINE = 1122 / 1280 * 16;
const PITCH = 17;
const makeCanvas = (width: number, height: number) => {
  const c = document.createElement('canvas'); c.width = width; c.height = height; return c;
};

/** A small compositional vocabulary: entry / occluded disc / return. Each
 * complete word is evaluated as one owner against the posed opening. No
 * identity selects a word and no glyph is stretched, clipped or moved alone. */
function grammar(open: boolean, cores: string[] = IRIS_CORES): string[] {
  if (!open) return ['ー', '一', '⌒', '‐', '､_', 'ｰ', '､ｰ', 'ー､'];
  const words = new Set<string>();
  for (const iris of cores) {
    if(cores===COMPACT_IRIS_CORES){words.add(iris);continue;}
    for(const [entry,exit] of [['',''],['ｨ','ｧ'],["'","'"],['､','､']])words.add(entry+iris+exit);
  }
  // Whole entry / pupil / return constructions observed in the portrait
  // vocabulary. They still face the fitted aperture, photo and paper checks;
  // neither the subject nor a face identity chooses a phrase.
  if(cores===IRIS_CORES)for (const word of ["_,r'(yﾌr､", "r'(yﾌ､", "ｨ'でﾚヽ", ",r'ｨｪヽ", "ｨ'ﾃヽ"]) words.add(word);
  return [...words];
}

/** Plan native eye ownership BEFORE the general encoder. Call from Generate,
 * reserve the returned rectangles in its input, and merge the planned whole
 * words afterward at exact native positions. This never edits encoder text. */
export function compilePlaneEyes(
  source: HTMLCanvasElement, frame: PlanesFrame, region: Rect,
  nativeW: number, nativeH: number, measure: (text: string) => number,
): PlaneEyeWordPlan {
  const started = performance.now();
  const result: PlaneEyeWordPlan = { words: [], reservedRects: [], notes: [] };
  const features = eyeFeatures(frame);
  const targetGuide=makeCanvas(nativeW,nativeH),guide=targetGuide.getContext('2d')!;
  guide.fillStyle='white';guide.fillRect(0,0,nativeW,nativeH);
  guide.globalAlpha=.12;guide.drawImage(source,region.x*source.width/frame.pose.imageWidth,region.y*source.height/frame.pose.imageHeight,region.width*source.width/frame.pose.imageWidth,region.height*source.height/frame.pose.imageHeight,0,0,nativeW,nativeH);guide.globalAlpha=1;
  const sx = nativeW / region.width, sy = nativeH / region.height;
  const toNative = (p: { x: number; y: number }) => ({ x: (p.x - region.x) * sx, y: (p.y - region.y) * sy });
  const sourceX = source.width / frame.pose.imageWidth, sourceY = source.height / frame.pose.imageHeight;
  const pixels = source.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, source.width, source.height).data;
  const photoValue = (x: number, y: number) => {
    const px = Math.round(x * sourceX), py = Math.round(y * sourceY);
    if (px < 0 || py < 0 || px >= source.width || py >= source.height) return 1;
    const i = (py * source.width + px) * 4;
    return pixels[i + 3] > 192 ? (.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2])/255 : 1;
  };
  const dark = (x:number,y:number)=>photoValue(x,y)<.34;
  const rasterCache = new Map<string, Raster>();
  const raster = (text: string): Raster => {
    const cached = rasterCache.get(text); if (cached) return cached;
    const width = Math.ceil(measure(text)), c = makeCanvas(width + 6, PITCH + 8);
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.font = FONT; ctx.textBaseline = 'alphabetic'; ctx.fillText(text, 3, 4 + BASELINE);
    const data = ctx.getImageData(0, 0, c.width, c.height).data, ink: Raster['ink'] = [];
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (data[(y * c.width + x) * 4 + 3] > 80) ink.push({ x: x - 3, y: y - 4 });
    const value = { text, width, height: PITCH, ink }; rasterCache.set(text, value); return value;
  };
  for (const eye of features.eyes) planEye(eye);
  for (const eye of features.eyes) planBrow(eye);
  result.targetGuide=targetGuide.toDataURL('image/png');
  result.notes.push(`Native eye/brow planning took ${Math.round(performance.now() - started)} ms.`);
  return result;

  function planBrow(eye: PlaneEyeFeature) {
    const leftSide=eye.owner==='eye.left';
    const keys=leftSide?['brl0','brl1','brl2']:['brr0','brr1','brr2'];
    const fitted=keys.map(key=>frame.vertices[key]).filter(v=>v&&['visible','grazing'].includes(v.visibility));
    if(fitted.length<2)return;
    const ids=leftSide?[70,63,105,66,107,55,65,52,53,46]:[336,296,334,293,300,276,283,282,295,285];
    if(ids.some(id=>!frame.pose.landmarks[id]))return;
    const polygon=ids.map(id=>toNative(frame.pose.landmarks[id]));
    const arch=fitted.map(toNative);
    let left=Math.floor(Math.min(...polygon.map(p=>p.x))),right=Math.ceil(Math.max(...polygon.map(p=>p.x)));
    const top=Math.floor(Math.min(...polygon.map(p=>p.y))),bottom=Math.ceil(Math.max(...polygon.map(p=>p.y)));
    if(right-left<8||left<0||right>nativeW)return;
    const mass:{x:number;y:number}[]=[];
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++)if(inPolygon({x,y},polygon)&&dark(x/sx+region.x,y/sy+region.y))mass.push({x,y});
    if(mass.length<5)return;
    // Landmarks enclose paper around the brow. Its observed mass, rather than
    // that padded polygon, determines the entry and taper of the native band.
    left=Math.min(...mass.map(p=>p.x));right=Math.max(...mass.map(p=>p.x))+1;
    const dist=nearestSquared;
    // The brow's continuous ridge/body owns the read. Isolated hair flecks
    // cannot substitute for that band merely by covering dark source pixels.
    const marks=["'",'｀','､','‐','￣','_','ｰ','=','ﾆ','二','三'];
    type BrowPart={text:string;x:number;row:number};
    type Run={parts:BrowPart[];pen:number;cost:number;ink:{x:number;y:number}[]};
    let best:{run:Run;score:number;coverage:number}|undefined;
    const midY=mass.reduce((sum,p)=>sum+p.y,0)/mass.length;
    const nativeRows=[Math.floor(midY/PITCH)-1,Math.floor(midY/PITCH),Math.floor(midY/PITCH)+1].filter(row=>row>=0&&(row+1)*PITCH<=nativeH);
    // A sloping brow can cross a baseline: jointly construct its entry, body
    // and taper on neighboring rows. One forced full-width row cannot express
    // that arch, even when individual glyphs fit its dark pixels.
    for(const rowSet of [...nativeRows.map(row=>[row]),nativeRows]){
      const states=new Map<number,Run[]>();states.set(left,[{parts:[],pen:left,cost:0,ink:[]}]);
      for(let pen=left;pen<=right;pen++)for(const run of states.get(pen)??[]){
        for(const row of rowSet)for(const mark of marks){
          const r=raster(mark),next=pen+r.width;if(next>right+2||!r.ink.length)continue;
          if(result.words.some(w=>w.role==='eye-form'&&w.row===row&&w.x<next&&w.x+measure(w.text)>pen))continue;
          const ink=r.ink.map(p=>({x:pen+p.x,y:row*PITCH+p.y}));
          if(ink.some(p=>p.y<top-2||p.y>bottom+2))continue;
          const local=mass.filter(p=>p.x>=pen-1&&p.x<=next+1);if(!local.length)continue;
          const spill=ink.reduce((sum,p)=>sum+dist(p,mass),0)/ink.length;
          const cover=local.reduce((sum,p)=>sum+dist(p,ink),0)/local.length;
          const meanY=ink.reduce((sum,p)=>sum+p.y,0)/ink.length;
          const nearArch=arch.reduce((best,p)=>Math.abs(p.x-(pen+next)/2)<Math.abs(best.x-(pen+next)/2)?p:best,arch[0]);
          const border=(points:XY[],edge:'left'|'right')=>{
            const x=edge==='left'?Math.min(...points.map(p=>p.x)):Math.max(...points.map(p=>p.x));
            return points.filter(p=>Math.abs(p.x-x)<1.1);
          };
          const join=run.ink.length?Math.min(...border(run.ink,'right').flatMap(a=>border(ink,'left').map(b=>Math.max(0,Math.hypot(a.x-b.x,a.y-b.y)-3)**2))):0;
          const previous=run.parts.at(-1),parts=run.parts.map(p=>({...p}));
          if(previous?.row===row)parts[parts.length-1].text+=mark;
          else parts.push({text:mark,x:pen,row});
          const nextRun={parts,pen:next,cost:run.cost+(spill*1.2+cover*.9+Math.min(9,(meanY-nearArch.y)**2)*.12)*r.width+join*2,ink:[...run.ink,...ink]};
          const list=[...(states.get(next)??[]),nextRun].sort((a,b)=>a.cost-b.cost).slice(0,3);states.set(next,list);
        }
      }
      for(const[pen,runs]of states)if(Math.abs(pen-right)<=2)for(const run of runs){
        const coverage=mass.filter(p=>dist(p,run.ink)<=2.25).length/mass.length;
        const spill=run.ink.filter(p=>dist(p,mass)>4).length/run.ink.length;
        if(coverage<.45||spill>.25)continue;
        const score=run.cost/Math.max(1,pen-left)+(1-coverage)*3;
        if(!best||score<best.score)best={run,score,coverage};
      }
    }
    if(!best){result.notes.push(`${eye.owner}.brow: native arch/mass unresolved; source-derived brow remains with encoder.`);return;}
    const chosen=best;
    for(const part of chosen.run.parts)result.words.push({...part,owner:eye.owner,role:'brow-form',score:chosen.score,evidence:`Visible posed brow ridge plus actual dark brow pixels; jointly planned arch across native rows, coverage ${chosen.coverage.toFixed(2)}.`});
    const x=Math.max(0,Math.min(left,Math.floor(Math.min(...chosen.run.ink.map(p=>p.x))-1))),y=Math.max(0,Math.min(top,Math.floor(Math.min(...chosen.run.ink.map(p=>p.y))-1)));
    result.reservedRects.push({x,y,width:Math.ceil(Math.max(right,...chosen.run.ink.map(p=>p.x))-x+2),height:Math.ceil(Math.max(bottom,...chosen.run.ink.map(p=>p.y))-y+2),owner:eye.owner});
    result.notes.push(`${eye.owner}.brow: source-mass arch planned at rows ${[...new Set(chosen.run.parts.map(p=>p.row))].join('/')}, native UI inspection required.`);
  }

  function planEye(eye: PlaneEyeFeature) {
    const aperture = eye.aperture.map(toNative), visibleIris = eye.paths.filter(p => p.role === 'iris-visible');
    const upper = eye.paths.filter(p => p.role === 'upper-lid');
    if (!upper.length || eye.width * sx < 7) { result.notes.push(`${eye.owner}: unresolved, opening is occluded or too narrow for a complete native passage.`); return; }
    // A disc is permissible only when the fitted visible portion contains real
    // dark source pixels. Closed/uncertain views cannot gain a synthetic pupil.
    const gaze = eye.gaze;
    let darkSamples = 0, sampled = 0;
    const edgeDistance = (p: {x:number;y:number}) => Math.min(...eye.aperture.map((a, i) => {
      const b = eye.aperture[(i + 1) % eye.aperture.length], dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
      return Math.hypot(p.x-a.x-t*dx, p.y-a.y-t*dy);
    }));
    const minimumInterior = Math.max(.8, region.height / nativeH * .5);
    if (eye.open && gaze && visibleIris.length) {
      const r = gaze.radiusPx;
      for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
        if (x * x + y * y > 16) continue;
        const p = { x: gaze.center.x + x / 4 * r, y: gaze.center.y + y / 4 * r };
        // Lid/brow darkness on the aperture boundary cannot count as a pupil.
        if (inPolygon(p, eye.aperture) && edgeDistance(p) > minimumInterior) { sampled++; if (dark(p.x, p.y)) darkSamples++; }
      }
    }
    const visibleHeight = (gaze?.visibleBounds?.height ?? 0) / region.height * nativeH;
    const minimumCoreHeight=Math.min(...IRIS_CORES.map(text=>{const ys=raster(text).ink.map(p=>p.y);return Math.max(...ys)-Math.min(...ys)+1;}));
    const irisCores=visibleHeight<minimumCoreHeight?COMPACT_IRIS_CORES:IRIS_CORES;
    const showIris = eye.open && eye.blink < .55 && visibleIris.length > 0 && visibleHeight >= 2 && sampled >= 3 && darkSamples / sampled > .12;
    const blinkSupportedLidOnly=!showIris&&eye.blink>.30&&eye.apertureRatio<.15;
    if (eye.open && !showIris && !blinkSupportedLidOnly) { result.notes.push(`${eye.owner}: unresolved open iris; fitted disc lacks sufficient visible dark-photo support. Lids remain with the general encoder.`); return; }
    if(blinkSupportedLidOnly)result.notes.push(`${eye.owner}: narrow aperture, measured blink and absent interior iris support select one lid passage; no pupil inferred.`);
    const points = eye.paths.filter(p => p.role !== 'iris-visible' || showIris).flatMap(p => p.points.map(toNative));
    if (!points.length) return;
    const left = Math.min(...aperture.map(p => p.x)), right = Math.max(...aperture.map(p => p.x));
    const top = Math.min(...aperture.map(p => p.y)), bottom = Math.max(...aperture.map(p => p.y));
    result.notes.push(`${eye.owner}: native aperture ${left.toFixed(2)},${top.toFixed(2)}–${right.toFixed(2)},${bottom.toFixed(2)}; visible iris height ${visibleHeight.toFixed(2)}px; smallest full core ${minimumCoreHeight}px; ${irisCores===COMPACT_IRIS_CORES?'compact partial-iris':'full iris'} vocabulary.`);
    const padding = 3;
    const target = makeCanvas(Math.ceil(right - left) + 2 * padding + 1, Math.ceil(bottom - top) + 2 * padding + 1);
    const tc = target.getContext('2d', { willReadFrequently: true })!;
    for (const path of eye.paths) {
      if (path.role === 'iris-visible' || (!showIris&&path.role==='lower-lid')) continue;
      tc.beginPath(); path.points.map(toNative).forEach((p, i) => i ? tc.lineTo(p.x - left + padding, p.y - top + padding) : tc.moveTo(p.x - left + padding, p.y - top + padding));
      tc.lineWidth = path.role === 'upper-lid' ? 1.5 : 1; tc.stroke();
    }
    const lidData = tc.getImageData(0, 0, target.width, target.height).data;
    const lidWanted: { x: number; y: number }[] = [];
    for (let y = 0; y < target.height; y++) for (let x = 0; x < target.width; x++) if (lidData[(y * target.width + x) * 4 + 3] > 70) lidWanted.push({ x: x + left - padding, y: y + top - padding });
    const irisWanted: { x: number; y: number }[] = [];
    const pupilWanted: {x:number;y:number}[]=[];
    const ring = eye.gaze?.disc?.map(toNative) ?? [];
    if (showIris) {
      // The eye owns a photo-supported dark MASS, not just a hollow iris rim.
      // White sclera outside the clipped disc stays protected paper.
      for (let y = Math.floor(top); y <= Math.ceil(bottom); y++) for (let x = Math.floor(left); x <= Math.ceil(right); x++) {
        let support = 0;
        for (const oy of [-.3, 0, .3]) for (const ox of [-.3, 0, .3]) {
          const q = { x: x + ox, y: y + oy };
          if (inPolygon(q, aperture) && inPolygon(q, ring) && dark(q.x / sx + region.x, q.y / sy + region.y)) support++;
        }
        if (support >= 2) { irisWanted.push({x,y}); if(photoValue(x/sx+region.x,y/sy+region.y)<.18)pupilWanted.push({x,y}); }
      }
      if (irisWanted.length < 2) { result.notes.push(`${eye.owner}: unresolved, no native-resolution dark iris mass inside the visible aperture.`); return; }
    }
    const wanted = [...lidWanted, ...irisWanted];
    const distanceTo = nearestSquared;
    const center = showIris && gaze ? toNative(gaze.center) : { x: (left + right) / 2, y: (top + bottom) / 2 };
    const photoPupil=pupilWanted.length?{x:pupilWanted.reduce((sum,p)=>sum+p.x,0)/pupilWanted.length,y:pupilWanted.reduce((sum,p)=>sum+p.y,0)/pupilWanted.length}:center;
    // Align native pupil ink with the actually visible dark pupil, within the
    // fitted disc. The 3D disc/aperture are never translated to fit a glyph.
    const maximumPupilOffset=Math.min(3,(gaze?.radiusPx??0)*sx*.35);
    const pupilAnchorX=center.x+Math.max(-maximumPupilOffset,Math.min(maximumPupilOffset,photoPupil.x-center.x));

    const candidates = new Set(grammar(showIris,irisCores));
    const upperNative = upper.flatMap(path=>path.points.map(toNative)).sort((a,b)=>a.x-b.x);
    const lowerNative = eye.paths.filter(path=>path.role==='lower-lid').flatMap(path=>path.points.map(toNative)).sort((a,b)=>a.x-b.x);
    const upperContacts=upperNative.filter(p=>inPolygon(p,ring)&&p.y<=center.y);
    const bridgeCache = new Map<string,string[]>();
    // Native contour passages follow the posed upper-lid curve. A sustained
    // horizontal bar is proposed only when that actual curve supports it.
    const curveBridge = (start:number,end:number,row:number,role:'upper'|'lower'='upper'):string[] => {
      const key=[Math.round(start),Math.round(end),row,role].join(':');
      const curve=role==='lower'?lowerNative:upperNative;
      const cached=bridgeCache.get(key);if(cached)return cached;
      const width=Math.max(0,Math.round(end-start));if(width<2)return [''];
      type State={text:string;pen:number;cost:number;last?:{x:number;y:number}};
      const states:State[][]=Array.from({length:width+4},()=>[]);states[0]=[{text:'',pen:0,cost:0}];
      for(let pen=0;pen<=width;pen++) for(const state of states[pen].sort((a,b)=>a.cost-b.cost).slice(0,4)) {
        for(const mark of ['‐','￣',"'",'｀','､','_','ｰ','~','ノ','ヽ','⌒']) {
          const r=raster(mark),advance=Math.round(measure(mark)),next=pen+advance;if(!advance||next>width+2||!r.ink.length)continue;
          const ink=r.ink.map(p=>({x:start+pen+p.x,y:row*PITCH+p.y}));
          const local=curve.filter(p=>p.x>=start+pen-1&&p.x<=start+next+1);if(!local.length)continue;
          const loss=ink.reduce((sum,p)=>sum+distanceTo(p,curve),0)/ink.length;
          const cover=local.reduce((sum,p)=>sum+distanceTo(p,ink),0)/local.length;
          const minX=Math.min(...ink.map(p=>p.x)),maxX=Math.max(...ink.map(p=>p.x));
          const entry=ink.filter(p=>p.x<=minX+1),exit=ink.filter(p=>p.x>=maxX-1);
          const first={x:minX,y:entry.reduce((sum,p)=>sum+p.y,0)/entry.length};
          const last={x:maxX,y:exit.reduce((sum,p)=>sum+p.y,0)/exit.length};
          const join=state.last?Math.max(0,Math.hypot(first.x-state.last.x,first.y-state.last.y)-2.5)**2:0;
          const candidate={text:state.text+mark,pen:next,cost:state.cost+(loss+cover*.7)*advance+join*2,last};
          states[next].push(candidate);if(states[next].length>12)states[next]=states[next].sort((a,b)=>a.cost-b.cost).slice(0,4);
        }
      }
      const choices=states.flatMap((list,pen)=>Math.abs(pen-width)<=2?list.map(state=>({...state,cost:state.cost/Math.max(1,pen)+Math.abs(pen-width)*2})):[]).sort((a,b)=>a.cost-b.cost).slice(0,3).map(state=>state.text);
      bridgeCache.set(key,choices.length?choices:['']);return choices.length?choices:[''];
    };
    type Part = { r: Raster; x: number; row: number; irisText?:string; irisOffset?:number; wholeIris?:boolean };
    type Choice = { parts: Part[]; score: number; ink: { x: number; y: number }[]; lidCoverage: number; irisCoverage: number; whiteSpill: number; pupilCoverage:number; contactCoverage:number; upperCoverage:number; lowerCoverage:number };
    let best: Choice | undefined, closest: Choice | undefined;
    let closestFootprint: {parts:Part[];ink:XY[];excess:number} | undefined;
    let rejectedFootprint=0,rejectedSemantic=0;
    const consider = (parts: Part[]) => {
      if (parts.some(({r,x,row}) => x < 0 || row < 0 || x + r.width > nativeW || (row + 1) * PITCH > nativeH)) return;
      const ink = parts.flatMap(({r,x,row}) => r.ink.map(p => ({x:p.x+x,y:p.y+row*PITCH})));
      const excess=eyeFootprintExcess(ink,{left,right,top,bottom});
      if(excess>0){if(!closestFootprint||excess<closestFootprint.excess)closestFootprint={parts,ink,excess};rejectedFootprint++;return;}
      const lidCoverage = lidWanted.filter(p => distanceTo(p, ink) <= 6.25).length / Math.max(1,lidWanted.length);
      const irisCoverage = showIris ? irisWanted.filter(p => distanceTo(p, ink) <= 3.1).length / irisWanted.length : 1;
      const upperCoverage=upperNative.filter(p=>distanceTo(p,ink)<=6.25).length/Math.max(1,upperNative.length);
      const lowerCoverage=showIris&&lowerNative.length?lowerNative.filter(p=>distanceTo(p,ink)<=6.25).length/lowerNative.length:1;
      const upperSupport=eyeContourSupport(upperNative,ink);
      const white = ink.filter(p => inPolygon(p, aperture) && distanceTo(p,lidWanted) > 2.25);
      const whiteSpill = showIris ? white.filter(p => distanceTo(p,irisWanted) > 3.1).length / Math.max(1,white.length) : 0;
      // Semantic role constraints replace an arbitrary aggregate-score cutoff.
      // Keep the globally bounded footprint and protect visible sclera.
      const irisInk:XY[]=[];
      if(showIris)for(const part of parts){
        const token=part.irisText??irisCores.find(mark=>part.r.text.includes(mark));
        if(part.wholeIris){for(const p of part.r.ink)irisInk.push({x:part.x+p.x,y:part.row*PITCH+p.y});continue;}
        if(!token)continue;
        const offset=part.irisOffset??measure(part.r.text.slice(0,part.r.text.indexOf(token)));
        for(const p of raster(token).ink)irisInk.push({x:part.x+offset+p.x,y:part.row*PITCH+p.y});
      }
      const pupilCoverage=pupilWanted.length?pupilWanted.filter(p=>distanceTo(p,irisInk)<=1).length/pupilWanted.length:1;
      const contactCoverage=showIris&&upperContacts.length?upperContacts.filter(p=>distanceTo(p,irisInk)<=4).length/upperContacts.length:1;

      const coverage = lidWanted.reduce((sum,p)=>sum+distanceTo(p,ink),0)/Math.max(1,lidWanted.length);
      const irisLoss = showIris ? irisWanted.reduce((sum,p)=>sum+distanceTo(p,ink),0)/irisWanted.length : 0;
      const spill = ink.reduce((sum,p)=>sum+distanceTo(p,wanted),0)/Math.max(1,ink.length);
      const pupilLoss=pupilWanted.length?pupilWanted.reduce((sum,p)=>sum+distanceTo(p,irisInk),0)/pupilWanted.length:0;
      const upperLoss=upperNative.reduce((sum,p)=>sum+distanceTo(p,ink),0)/Math.max(1,upperNative.length);
      const lowerLoss=showIris&&lowerNative.length?lowerNative.reduce((sum,p)=>sum+distanceTo(p,ink),0)/lowerNative.length:0;
      const score = (upperLoss+lowerLoss)*.8 + Math.max(upperLoss,lowerLoss)*.4 + irisLoss + pupilLoss*1.4 + spill*.7 + whiteSpill*10 + (parts.length-1)*.15;
      const choice={parts,score,ink,lidCoverage,irisCoverage,whiteSpill,pupilCoverage,contactCoverage,upperCoverage,lowerCoverage};
      if(!closest||score<closest.score)closest=choice;
      if (!upperSupport.corners || upperSupport.longestGap > Math.max(6,(right-left)*.18) || upperSupport.coverage < .65 || lidCoverage < (showIris ? .30 : .60) || irisCoverage < .40 || whiteSpill > .30 || pupilCoverage < .35 || contactCoverage < .30 || upperCoverage < .40 || lowerCoverage < .35) {rejectedSemantic++;return;}
      if (!best || score < best.score) best = choice;
    };
    if(!showIris){
      const upperY=upperNative.reduce((sum,p)=>sum+p.y,0)/upperNative.length;
      const rows=new Set<number>();
      for(const mark of ['‐','￣',"'",'｀','､','_','ｰ','~','ノ','ヽ']){
        const r=raster(mark);if(!r.ink.length)continue;
        const anchorY=r.ink.reduce((sum,p)=>sum+p.y,0)/r.ink.length;
        const nearest=Math.round((upperY-anchorY)/PITCH);for(const d of [-1,0,1])rows.add(nearest+d);
      }
      for(const row of rows)for(const text of curveBridge(left,right,row)){
        const r=raster(text);if(r.ink.length&&r.width>=(right-left)*.80)consider([{r,x:Math.round(left),row}]);
      }
    }
    for (const text of candidates) {
      const r = raster(text); if (!r.ink.length || r.width > right-left+8) continue;
      const token = showIris ? irisCores.find(mark=>text.includes(mark)) : undefined;
      const anchor = token ? raster(token) : r;
      const prefixWidth = token ? measure(text.slice(0,text.indexOf(token))) : 0;
      const anchorX = prefixWidth + anchor.ink.reduce((sum,p)=>sum+p.x,0)/anchor.ink.length;
      const anchorY = anchor.ink.reduce((sum,p)=>sum+p.y,0)/anchor.ink.length;
      const rowCenter = Math.round((center.y-anchorY)/PITCH);
      for (const row of [rowCenter-1,rowCenter,rowCenter+1]) for (const phase of [-2,-1,0,1,2]) {
        const x=Math.round(pupilAnchorX-anchorX+phase);consider([{r,x,row}]);
        // Only bare iris cores grow measured entry/return runs. Attached core
        // alternatives remain eligible as complete words through the same score.
        if(showIris&&token===text&&Math.abs(phase)<=1) {
          const prefix=curveBridge(left,x,row),suffix=curveBridge(x+r.width,right,row);
          for(const a of prefix) for(const b of suffix) {
            const whole=raster(a+text+b),groupX=x-measure(a);
            if(Math.abs(groupX-left)>3&&a)continue;
            consider([{r:whole,x:groupX,row,irisText:token,irisOffset:measure(a)}]);
            // The opening's lower return can cross the next native row even
            // when its entire visible iris fits on this row. Own that return
            // as a pure contour; do not invent a second iris fragment.
            if(lowerNative.length){
              const lowerRow=row+1;
              for(const passage of curveBridge(left,right,lowerRow,'lower')){
                const lower=raster(passage);
                if(!lower.ink.length||lower.width<(right-left)*.80)continue;
                consider([{r:whole,x:groupX,row,irisText:token,irisOffset:measure(a)},{r:lower,x:Math.round(left),row:lowerRow}]);
              }
            }
          }
        }
      }
    }
    // A tall opening may legitimately cross two native rows. Fit its upper
    // contact and visible disc jointly; no part is moved after the group wins.
    if (showIris && bottom-top >= 9) {
      const upperPoints = upper.flatMap(path=>path.points.map(toNative));
      const upperY = upperPoints.reduce((sum,p)=>sum+p.y,0)/upperPoints.length;
      for (const token of irisCores) {
        const disc = raster(token), ax=disc.ink.reduce((sum,p)=>sum+p.x,0)/disc.ink.length, ay=disc.ink.reduce((sum,p)=>sum+p.y,0)/disc.ink.length;
        const discRow = Math.round((center.y-ay)/PITCH);
        for (const mark of ['‐','￣',"'"]) {
          const lid = raster(mark.repeat(Math.max(1,Math.round((right-left)/Math.max(1,measure(mark))))));
          const ly=lid.ink.reduce((sum,p)=>sum+p.y,0)/lid.ink.length, lidRow=Math.round((upperY-ly)/PITCH);
          if (lidRow===discRow || Math.abs(lidRow-discRow)!==1) continue;
          for (const passage of curveBridge(left,right,lidRow)) {
            const curved=raster(passage);if(!curved.ink.length)continue;
            for (const phase of [-1,0,1]) consider([{r:disc,x:Math.round(pupilAnchorX-ax+phase),row:discRow,irisText:token,irisOffset:0},{r:curved,x:Math.round(left),row:lidRow}]);
          }
        }
      }
    }
    // A disc crossing a native row boundary can require cooperating glyphs
    // on BOTH rows. Each component is bound to the same fitted gaze/visible
    // mass; there is no clipped glyph or independently adjusted eye stamp.
    if(showIris&&gaze&&irisWanted.length){
      const irisTop=Math.min(...irisWanted.map(p=>p.y)),irisBottom=Math.max(...irisWanted.map(p=>p.y));
      const firstRow=Math.floor(irisTop/PITCH),secondRow=firstRow+1;
      if(irisBottom>=secondRow*PITCH-1){
        for(const topText of ['f','y','ｦ','ｮ','ﾛ','θ','ｿ','ﾘ','ﾃ','ｷ','ﾐ'])for(const bottomText of ["'",'｀','､','‐','ｰ','i',',']){
          const a=raster(topText),b=raster(bottomText);if(!a.ink.length||!b.ink.length)continue;
          const ax=a.ink.reduce((sum,p)=>sum+p.x,0)/a.ink.length,bx=b.ink.reduce((sum,p)=>sum+p.x,0)/b.ink.length;
          for(const phase of [-1,0,1]){
            const x=Math.round(pupilAnchorX-ax+phase),x2=Math.round(pupilAnchorX-bx+phase);
            const prefixes=curveBridge(left,x,firstRow),suffixes=curveBridge(x+a.width,right,firstRow);
            for(const prefix of prefixes.slice(0,2))for(const suffix of suffixes.slice(0,2)){
              const text=prefix+topText+suffix,word=raster(text),prefixWidth=measure(prefix);
              const lowerPrefixes=curveBridge(left,x2,secondRow,'lower'),lowerSuffixes=curveBridge(x2+b.width,right,secondRow,'lower');
              for(const lowerPrefix of lowerPrefixes.slice(0,2))for(const lowerSuffix of lowerSuffixes.slice(0,2)){
                const lowerText=lowerPrefix+bottomText+lowerSuffix,lowerWord=raster(lowerText),lowerPrefixWidth=measure(lowerPrefix);
                consider([{r:word,x:x-prefixWidth,row:firstRow,irisText:topText,irisOffset:prefixWidth},{r:lowerWord,x:x2-lowerPrefixWidth,row:secondRow,irisText:bottomText,irisOffset:lowerPrefixWidth}]);
              }
            }
          }
        }
      }
    }
    // Exported through Generate: blue lids, dark photo-supported iris/pupil,
    // green accepted native ink (red closest rejected ink), actual row grid.
    guide.strokeStyle='#286fb0';guide.lineWidth=.7;guide.beginPath();aperture.forEach((p,i)=>i?guide.lineTo(p.x,p.y):guide.moveTo(p.x,p.y));guide.closePath();guide.stroke();
    guide.fillStyle='#286fb0';for(const p of lidWanted)guide.fillRect(p.x,p.y,1,1);
    guide.fillStyle='#666';for(const p of irisWanted)guide.fillRect(p.x,p.y,1,1);
    guide.fillStyle='black';for(const p of pupilWanted)guide.fillRect(p.x,p.y,1,1);
    guide.strokeStyle='#bbb';for(let row=Math.floor((top-5)/PITCH);row<=(bottom+5)/PITCH;row++){guide.beginPath();guide.moveTo(left-5,row*PITCH);guide.lineTo(right+5,row*PITCH);guide.stroke();}
    const witness=best??closest??closestFootprint;if(witness){guide.globalAlpha=.55;guide.fillStyle=best?'#00852c':'#d02c28';for(const p of witness.ink)guide.fillRect(p.x,p.y,1,1);guide.globalAlpha=1;}
    if(!closest&&closestFootprint)result.notes.push(`${eye.owner}: nearest bounded-footprint candidate ${closestFootprint.parts.map(part=>JSON.stringify(part.r.text)+'@'+part.row+':'+part.x).join(' + ')} exceeds the native aperture margin by ${closestFootprint.excess.toFixed(2)}px; ink bounds ${Math.min(...closestFootprint.ink.map(p=>p.x)).toFixed(2)},${Math.min(...closestFootprint.ink.map(p=>p.y)).toFixed(2)}–${Math.max(...closestFootprint.ink.map(p=>p.x)).toFixed(2)},${Math.max(...closestFootprint.ink.map(p=>p.y)).toFixed(2)}.`);
    result.notes.push(`${eye.owner}: iris centre phase ${(center.y%PITCH).toFixed(2)}px; ${rejectedFootprint} footprint and ${rejectedSemantic} semantic rejections; pupil offset ${(pupilAnchorX-center.x).toFixed(2)}px; closest words ${closest?.parts.map(part=>JSON.stringify(part.r.text)+'@'+part.row+':'+part.x).join(' + ')??'none'}; closest ${closest?.score.toFixed(2)??'none'} [upper ${closest?.upperCoverage.toFixed(2)??'-'}, lower ${closest?.lowerCoverage.toFixed(2)??'-'}, lid ${closest?.lidCoverage.toFixed(2)??'-'}, iris ${closest?.irisCoverage.toFixed(2)??'-'}, pupil ${closest?.pupilCoverage.toFixed(2)??'-'}, contact ${closest?.contactCoverage.toFixed(2)??'-'}, white ${closest?.whiteSpill.toFixed(2)??'-'}], accepted ${best?.score.toFixed(2)??'none'}. Target guide: blue lids/grey iris/black pupil; green accepted or red rejected native ink.`);
    if (!best) { result.notes.push(`${eye.owner}: unresolved native pose witness: no complete one/two-row group preserves lid coverage, dark iris support and protected sclera.`); return; }
    for (const {r,x,row} of best.parts) result.words.push({x,row,text:r.text,role:'eye-form',owner:eye.owner,score:best.score,
      evidence:`${showIris?'Visible 3D iris and actual dark-photo mass':'Closed posed aperture, no iris'}; jointly owned group, lid coverage ${best.lidCoverage.toFixed(2)}, iris ${best.irisCoverage.toFixed(2)}, white spill ${best.whiteSpill.toFixed(2)}.`});
    const inkLeft = Math.max(0, Math.floor(Math.min(...best.ink.map(p => p.x),...aperture.map(p=>p.x)) - 1));
    const inkTop = Math.max(0, Math.floor(Math.min(...best.ink.map(p => p.y),...aperture.map(p=>p.y)) - 1));
    result.reservedRects.push({ x: inkLeft, y: inkTop, width: Math.ceil(Math.max(...best.ink.map(p => p.x),...aperture.map(p=>p.x)) - inkLeft + 2), height: Math.ceil(Math.max(...best.ink.map(p => p.y),...aperture.map(p=>p.y)) - inkTop + 2), owner: eye.owner });
    result.notes.push(`${eye.owner}: ${showIris ? 'open' : 'closed'} fitted eye planned at row ${best.parts.map(part=>part.row).join('/')}; geometry score ${best.score.toFixed(2)}. Native UI inspection remains required.`);
  }
}
