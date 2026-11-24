import { planeFrame, type Figure, type Rect } from './core';
import { add as add3, dot, inPolygon, mul, solveLinear, sub, unit } from '../planes/geometry';
import { median, rotate, transform } from '../planes/types';
import type { Vec3 } from '../planes/types';
import { pointVisibility, type PlanesFrame, type SolvedFace } from '../planes/solve';
import type { Region } from '../planes/topology';
import { FACE_OVAL, LEFT_BROW, RIGHT_BROW, LIPS_INNER, LIPS_OUTER } from '../pose/landmarks';

import { eyeFeatures, type PlaneEyeFeatures } from './plane-eye-features';
import { canonicalSurfaceNormals, surfaceVisibilityFrame } from './plane-surface-visibility';

type Point={x:number;y:number};
export type PlanePath={id:string;role:string;region:Region;owner:string;points:Point[];width:number;closed:boolean;reason:string;source:'posed-plane-graph'|'posed-facial-surface';visible:boolean};
export type PlanePatch={id:string;region:Region;vertices:string[];normal:Vec3;photoValue:number;photoObserved:boolean;sampleCount:number;fittedValue:number;band:number;displayValue:number;visible:boolean;depthEstimated:boolean};
export type PlaneDecision={id:string;selected:boolean;role:string;reason:string;dihedral?:number;contrast?:number};
export type PlaneShadowRegion={id:string;owner:'head.skin';band:number;planeIds:string[];relativeValue:number;polygons:Point[][];reason:string};
export type PlaneAppearanceRegion={id:string;role:'facial-hair'|'accessory-or-unexplained-albedo';pixelCount:number;facialHairPixelCount:number;bounds:Rect;meanRelativeDeficit:number;textureFraction:number;strandFraction:number;planeIds:string[];reason:string};
export type PlaneStudyOptions={detail?:number;lightBands?:number;hairMask?:HTMLCanvasElement|HTMLImageElement};
export type PlaneStudy={planesCanvas:HTMLCanvasElement;selectedLinesCanvas:HTMLCanvasElement;faceMaskCanvas:HTMLCanvasElement;shadowMaskCanvas:HTMLCanvasElement;appearanceMaskCanvas:HTMLCanvasElement;facialHairMaskCanvas:HTMLCanvasElement;appearanceRegions:PlaneAppearanceRegion[];shadowRegions:PlaneShadowRegion[];shadowBands:{band:number;maskCanvas:HTMLCanvasElement}[];paths:PlanePath[];planes:PlanePatch[];eyes:PlaneEyeFeatures;decisions:PlaneDecision[];summary:string[];light:{ambient:number;direction:Vec3;strength:number;residual:number;source:string;displayWindow?:{low:number;high:number;span:number;purpose:string}};registration:{space:'source-crop-pixels';width:number;height:number;traceRect:Rect};};
const clamp=(x:number,lo=0,hi=1)=>Math.max(lo,Math.min(hi,x));
const canvas=(width:number,height:number)=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
const polygon=(ctx:CanvasRenderingContext2D,points:Point[])=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();};
function smooth(ctx:CanvasRenderingContext2D,points:Point[],closed=false){
 if(!points.length)return;ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);
 if(points.length<3){for(const p of points.slice(1))ctx.lineTo(p.x,p.y);if(closed)ctx.closePath();return;}
 for(let i=0;i<points.length-1;i++){
  const p0=points[Math.max(0,i-1)],p1=points[i],p2=points[i+1],p3=points[Math.min(points.length-1,i+2)];
  ctx.bezierCurveTo(p1.x+(p2.x-p0.x)/6,p1.y+(p2.y-p0.y)/6,p2.x-(p3.x-p1.x)/6,p2.y-(p3.y-p1.y)/6,p2.x,p2.y);
 }
 if(closed)ctx.closePath();
}
const edgeKey=(a:string,b:string)=>[a,b].sort().join('|');
function faceCentroid(face:SolvedFace,frame:PlanesFrame){return face.verts.reduce((p,id)=>({x:p.x+frame.vertices[id].x/face.verts.length,y:p.y+frame.vertices[id].y/face.verts.length,z:p.z+frame.vertices[id].depth/face.verts.length}),{x:0,y:0,z:0});}

/** Infer a single-view construction first, then choose depiction from its
 * planes, openings, visibility and photo-supported changes. No learned photo
 * edge map is consumed. The recovered graph is a deformable drawing prior,
 * not a claim of anatomically calibrated Asaro geometry for every person. */
export function buildPlaneStudy(source:HTMLCanvasElement,figure:Pick<Figure,'pose'|'pins'|'surfaceEdits'>,traceRect:Rect,options:PlaneStudyOptions={}):PlaneStudy{
 if(!figure.pose)throw Error('Analyze the face and head planes before selecting portrait structure.');
 if(!source.width||!source.height)throw Error('Choose a nonempty selected-person source.');
 const frame=surfaceVisibilityFrame(planeFrame(figure as Figure)),pose=figure.pose,detail=clamp(options.detail??.55),bands=Math.round(clamp(options.lightBands??5,3,9));
 const sx=source.width/pose.imageWidth,sy=source.height/pose.imageHeight;
 const p=(point:Point):Point=>({x:point.x*sx,y:point.y*sy});
 const vertex=(id:string)=>{const v=frame.vertices[id];return v?p(v):undefined;};
 const landmark=(id:number)=>p(pose.landmarks[id]);
 const image=source.getContext('2d',{willReadFrequently:true})!.getImageData(0,0,source.width,source.height),rgba=image.data;
 const luminance=(x:number,y:number)=>{const px=Math.max(0,Math.min(source.width-1,Math.floor(x))),py=Math.max(0,Math.min(source.height-1,Math.floor(y))),i=(py*source.width+px)*4;return (.2126*rgba[i]+.7152*rgba[i+1]+.0722*rgba[i+2])/255;};
 const hair=canvas(source.width,source.height),hairCtx=hair.getContext('2d',{willReadFrequently:true})!;if(options.hairMask)hairCtx.drawImage(options.hairMask,0,0,hair.width,hair.height);
 const hairPixels=hairCtx.getImageData(0,0,hair.width,hair.height).data;
 const hairAt=(q:Point)=>{const x=Math.floor(q.x),y=Math.floor(q.y);return x>=0&&y>=0&&x<hair.width&&y<hair.height&&hairPixels[(y*hair.width+x)*4+3]>128;};
 const view=frame.context.shots[frame.shotId],tolerance=pose.bbox.size*.025,canonicalNormals=canonicalSurfaceNormals(frame);
 const definitions=new Map(frame.context.landmarks.map((_,i)=>[i,canonicalNormals[i]]));
 const faceVisible=(face:SolvedFace)=>{
  const centre=faceCentroid(face,frame),n=rotate(view.fit.rotation,face.normal);
  if(n.z>.12||face.verts.every(id=>['back','occluded'].includes(frame.vertices[id].visibility)))return false;
  return centre.z<=view.depth.at(centre.x,centre.y)+tolerance;
 };
 const visibleFaces=new Map(frame.faces.map(f=>[f.id,faceVisible(f)]));
 const patchValue=(face:SolvedFace)=>{
  const points=face.verts.map(id=>vertex(id)!),left=Math.min(...points.map(q=>q.x)),right=Math.max(...points.map(q=>q.x)),top=Math.min(...points.map(q=>q.y)),bottom=Math.max(...points.map(q=>q.y));
  const samples:number[]=[];
  for(let y=0;y<9;y++)for(let x=0;x<9;x++){const q={x:left+(x+.5)/9*(right-left),y:top+(y+.5)/9*(bottom-top)};if(inPolygon(q,points)&&!hairAt(q))samples.push(luminance(q.x,q.y));}
  return {value:samples.length?median(samples):.65,count:samples.length,observed:samples.length>=4};
 };
 const patches:PlanePatch[]=frame.faces.map(face=>{const photo=patchValue(face);return {id:face.id,region:face.region,vertices:[...face.verts],normal:rotate(view.fit.rotation,face.normal),photoValue:photo.value,photoObserved:photo.observed,sampleCount:photo.count,fittedValue:0,band:0,displayValue:0,visible:visibleFaces.get(face.id)!,depthEstimated:face.verts.some(id=>frame.vertices[id].depthFromPrior)};});
 // Fit only broadly skin-covered planes. Brows, lips and eye openings have a
 // different albedo; including them would turn the lighting fit into an edge
 // or darkness detector. This is a weak single-image photometric estimate.
 const samples=patches.filter(p=>p.visible&&p.photoObserved&&['cranium','cheek','nose'].includes(p.region)&&!p.vertices.some(id=>/^(lp|ph|mc|wl|wr)/.test(id)||id==='sub'));
 let coefficients=[.65,-.1,-.15,-.15],residual=0;
 if(samples.length>=4){
  let weights=samples.map(()=>1);
  for(let round=0;round<3;round++){
   const a=Array.from({length:4},(_,i)=>Array.from({length:4},(_,j)=>i===j?.03:0)),b=[.03*.65,0,0,0];
   samples.forEach((sample,k)=>{const row=[1,sample.normal.x,sample.normal.y,sample.normal.z];for(let i=0;i<4;i++){b[i]+=weights[k]*row[i]*sample.photoValue;for(let j=0;j<4;j++)a[i][j]+=weights[k]*row[i]*row[j];}});
   try{coefficients=solveLinear(a,b);}catch{break;}
   const errors=samples.map(sample=>Math.abs(sample.photoValue-coefficients[0]-dot(sample.normal,{x:coefficients[1],y:coefficients[2],z:coefficients[3]}))),sigma=Math.max(.025,median(errors)*1.5);weights=errors.map(error=>Math.min(1,sigma/Math.max(error,1e-6)));
  }
  residual=Math.sqrt(samples.reduce((sum,sample)=>sum+(sample.photoValue-coefficients[0]-dot(sample.normal,{x:coefficients[1],y:coefficients[2],z:coefficients[3]}))**2,0)/samples.length);
 }
 const lightVector={x:coefficients[1],y:coefficients[2],z:coefficients[3]},light={ambient:coefficients[0],direction:unit(lightVector),strength:Math.hypot(...coefficients.slice(1)),residual,source:'Robust plane-patch Lambertian estimate; one photo cannot separate albedo from light.'};
 patches.forEach(patch=>{patch.fittedValue=clamp(coefficients[0]+dot(patch.normal,lightVector));});
 const displayed=patches.filter(patch=>patch.visible).map(patch=>patch.fittedValue).sort((a,b)=>a-b),quantile=(fraction:number)=>displayed[Math.min(displayed.length-1,Math.floor((displayed.length-1)*fraction))]??.5;
 const displayLow=quantile(.05),displayHigh=quantile(.95),displaySpan=Math.max(.03,displayHigh-displayLow);
 const displayWindow={low:displayLow,high:displayHigh,span:displayHigh-displayLow,purpose:'Contrast-normalized construction diagnostic only; physical fitted values and shadow decisions are unchanged.'};
 patches.forEach(patch=>{patch.displayValue=clamp((patch.fittedValue-displayLow)/displaySpan);patch.band=Math.round(patch.displayValue*(bands-1));});
 const displayedLight={...light,displayWindow};
 const planesCanvas=canvas(source.width,source.height),selectedLinesCanvas=canvas(source.width,source.height),faceMaskCanvas=canvas(source.width,source.height);
 const planeCtx=planesCanvas.getContext('2d')!,lineCtx=selectedLinesCanvas.getContext('2d')!,maskCtx=faceMaskCanvas.getContext('2d')!;
 planeCtx.fillStyle='white';planeCtx.fillRect(0,0,source.width,source.height);lineCtx.fillStyle='white';lineCtx.fillRect(0,0,source.width,source.height);
 const oval=FACE_OVAL.map(landmark);maskCtx.fillStyle='white';polygon(maskCtx,oval);maskCtx.fill();
 const patchById=new Map(patches.map(p=>[p.id,p]));
 for(const face of [...frame.faces].sort((a,b)=>faceCentroid(b,frame).z-faceCentroid(a,frame).z)){
  const patch=patchById.get(face.id)!;if(!patch.visible||face.region==='neck')continue;
  const points=face.verts.map(id=>vertex(id)!);polygon(maskCtx,points);maskCtx.fill();
  polygon(planeCtx,points);const shade=Math.round(70+patch.band/(bands-1)*170);planeCtx.fillStyle=`rgb(${shade},${shade},${shade})`;planeCtx.fill();
 }
 const geometryMaskCanvas=canvas(source.width,source.height);geometryMaskCanvas.getContext('2d')!.drawImage(faceMaskCanvas,0,0);
 // The model's forehead/cranium is behind foreground hair. This mask decides
 // which photo proposals are replaced by head construction, not a bounding box.
 if(options.hairMask){maskCtx.globalCompositeOperation='destination-out';maskCtx.drawImage(hair,0,0);maskCtx.globalCompositeOperation='source-over';}
 const ownedMask=maskCtx.getImageData(0,0,source.width,source.height).data;
 const owned=(q:Point)=>{const x=Math.floor(q.x),y=Math.floor(q.y);return x>=0&&y>=0&&x<source.width&&y<source.height&&ownedMask[(y*source.width+x)*4+3]>64;};
 const paths:PlanePath[]=[],decisions:PlaneDecision[]=[];
 const baseWidth=Math.max(.9,pose.bbox.size*sx/330);
 const add=(id:string,role:string,region:Region,points:Point[],width:number,reason:string,closed=false,sourceKind:PlanePath['source']='posed-plane-graph')=>{if(points.length<2)return;paths.push({id,role,region,owner:`head.${region}`,points,width,reason,closed,source:sourceKind,visible:true});};
 type SurfaceSample={display:Point;model:Vec3;normal:Vec3;surface:string};
 const appendVisible=(id:string,role:string,region:Region,points:SurfaceSample[],width:number,reason:string,closed=false,sourceKind:PlanePath['source']='posed-plane-graph')=>{
  let run:Point[]=[],serial=0,allVisible=true;
  const emit=()=>{if(run.length>1){add(`${id}.visible.${serial++}`,role,region,run,width,reason,closed&&allVisible,sourceKind);}run=[];};
  const pairs=closed?[...points,points[0]]:points;
  for(let i=1;i<pairs.length;i++){
   const a=pairs[i-1],b=pairs[i],steps=Math.max(1,Math.ceil(Math.hypot(b.display.x-a.display.x,b.display.y-a.display.y)/Math.max(1,baseWidth)));
   for(let k=i===1?0:1;k<=steps;k++){
    const t=k/steps,model=add3(a.model,mul(sub(b.model,a.model),t)),n=unit(add3(mul(a.normal,1-t),mul(b.normal,t))),display={x:a.display.x+(b.display.x-a.display.x)*t,y:a.display.y+(b.display.y-a.display.y)*t};
    const visibility=pointVisibility(frame.context,frame.shotId,model,n,t<.5?a.surface:b.surface,frame.primitives.sphere);
    if(visibility==='visible'||visibility==='grazing')run.push(display);else{allVisible=false;emit();}
   }
  }
  emit();return serial;
 };
 const addVertices=(id:string,role:string,region:Region,ids:string[],width:number,reason:string,closed=false)=>{
  if(ids.some(id=>!frame.vertices[id]))return 0;
  const points=ids.map(id=>{const v=frame.vertices[id];return {display:vertex(id)!,model:v.model,normal:v.normal,surface:'face'};});
  return appendVisible(id,role,region,points,width,reason,closed);
 };
 const addSurface=(id:string,role:string,region:Region,ids:readonly number[],width:number,reason:string,closed=false)=>{
  const points=ids.map(index=>({display:landmark(index),model:frame.context.landmarks[index],normal:definitions.get(index)!,surface:'face'}));
  return appendVisible(id,role,region,points,width,reason,closed,'posed-facial-surface');
 };
 const contrastAlong=(points:Point[])=>{
  const distances:number[]=[];const offset=Math.max(2,pose.bbox.size*sx*.012);
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<1)continue;for(const t of [.2,.5,.8]){const x=a.x+dx*t,y=a.y+dy*t,nx=-dy/length*offset,ny=dx/length*offset;distances.push(Math.abs(luminance(x+nx,y+ny)-luminance(x-nx,y-ny)));}}
  return distances.length?median(distances):0;
 };
 // Identity-bearing occlusions and apertures are coherent paths, not a pass
 // drawing every edge of the plane tessellation at one weight.
 addSurface('face.jaw-over-neck','occluding silhouette','jaw',[234,93,132,58,172,136,150,149,176,148,152,377,400,378,379,365,397,288,361,323,454],baseWidth*1.25,'Only canonically front-facing, depth-visible runs of the facial-sheet boundary separate jaw from neck.');
 const eyes=eyeFeatures(frame);
 for(const eye of eyes.eyes){
  const side=eye.owner==='eye.left'?'left':'right';
  for(const path of eye.paths){
   if(path.role==='iris-visible'||(!eye.open&&path.role==='lower-lid'))continue;
   add(path.id,path.role==='upper-lid'?(eye.open?'upper lid over iris':'closed eyelid'):'lower lid return','eye',path.points.map(p),baseWidth*path.strokeWeight,eye.open?'The fitted lid opening and sampled 3D visibility own this continuous aperture run.':'The collapsed lid owns one crease; no iris is inferred.');
  }
  decisions.push({id:`${eye.owner}.aperture`,selected:eye.paths.some(path=>path.role==='upper-lid'),role:eye.open?'visible eye opening':'closed eyelid',reason:[eye.open?'Source-bound plane eyelids and clipped iris geometry are available.':'Closed or collapsed aperture suppresses its iris.',...eye.notes].join(' ')});
  const brow=(side==='left'?LEFT_BROW:RIGHT_BROW).map(landmark),browContrast=contrastAlong(brow);
  if(browContrast>.025)add(`brow.${side}`,'brow ridge and hair boundary','brow',brow,baseWidth*(1.3+Math.min(2,browContrast*6)),'Actual brow-region contrast supports the posed brow ridge.',false,'posed-facial-surface');
 }
 // Nose planes determine the wing/under-tip occlusion. Front-view bridge
 // planes stay value changes, rather than automatically drawing a nose box.
 for(const [side,ids]of [['left',['nsl','wl0','wl1']],['right',['nsr','wr0','wr1']]] as const){
  addVertices(`nose.${side}.nostril`,'visible nostril/wing return','nose',[...ids],baseWidth,'Visible nasal wing and nostril return form one short occluding run; hidden points are clipped.');
 }
 const tipPoints=['tip3','sub','tip2'].map(id=>vertex(id)).filter(Boolean) as Point[],tipSupport=contrastAlong(tipPoints);
 if(tipSupport>.025)addVertices('nose.under-tip','under-tip turn','nose',['tip3','sub','tip2'],baseWidth*.8,'The source supports the visible underside of the fitted nose wedge.');
 const noseCandidates=[{side:'left',ids:['nas0','tip0','tip3']},{side:'right',ids:['nas1','tip1','tip2']}].map(candidate=>{
  const points=candidate.ids.map(id=>vertex(id)!),visible=candidate.ids.filter(id=>['visible','grazing'].includes(frame.vertices[id].visibility)).length,contrast=contrastAlong(points);
  return {...candidate,points,visible,contrast,score:visible*contrast};
 });
 const noseTurn=Math.abs(pose.angles.yaw)>32?noseCandidates.filter(candidate=>candidate.visible>=2&&candidate.contrast>.035).sort((a,b)=>b.score-a.score)[0]:undefined;
 for(const candidate of noseCandidates){
  const selected=candidate===noseTurn;
  if(selected)addVertices(`nose.${candidate.side}.turn`,'single visible nose side-plane turn','nose',candidate.ids,baseWidth,'One supported visible turn is selected for the posed wedge; the opposite plane is not boxed.');
  decisions.push({id:`nose.${candidate.side}.bridge`,selected,role:'nose side-plane turn',contrast:candidate.contrast,reason:selected?'The strongest supported visible turn owns the wedge contour.':'The opposite/weak side remains a plane value; no second enclosing side is drawn.'});
 }
 const lipInner=LIPS_INNER.map(landmark),lipOuter=LIPS_OUTER.map(landmark),mouthWidth=Math.hypot(lipInner[10].x-lipInner[0].x,lipInner[10].y-lipInner[0].y),mouthHeight=Math.hypot(landmark(13).x-landmark(14).x,landmark(13).y-landmark(14).y);
 if(mouthHeight/Math.max(mouthWidth,1)>.065)addSurface('mouth.aperture','mouth opening and lip contact','mouth',LIPS_INNER,baseWidth*1.1,'Visible posed inner-lip runs preserve teeth/air as paper; hidden lip segments are clipped.',true);
 else addSurface('mouth.parting','lip parting','mouth',LIPS_INNER.slice(0,11),baseWidth*1.2,'Closed or narrow lip aperture is a depth-visible coherent parting path.');
 const lowerLip=[lipOuter[10],...lipOuter.slice(11),lipOuter[0]],lowerContrast=contrastAlong(lowerLip);
 if(lowerContrast>.035)addSurface('mouth.lower-roll','lower lip roll','mouth',[LIPS_OUTER[10],...LIPS_OUTER.slice(11),LIPS_OUTER[0]],baseWidth*.75,'Visible lower-lip plane/value return supports a secondary roll.');
 for(const [side,ids]of [['left',['nsl','nll','mcl']],['right',['nsr','nlr','mcr']]] as const){
  const points=ids.map(id=>vertex(id)).filter(Boolean) as Point[],contrast=contrastAlong(points),selected=contrast>(.065-detail*.035)&&ids.some(id=>frame.vertices[id]?.visibility==='visible');
  if(selected)addVertices(`cheek.${side}.fold`,'nasolabial plane fold','cheek',[...ids],baseWidth*.7,'The visible nose/cheek/mouth junction has source-supported value separation.');
  decisions.push({id:`cheek.${side}.fold`,selected,role:'nasolabial plane fold',contrast,reason:selected?'Supported fold explains the cheek-to-mouth turn.':'Weak plane separation is left to value; no default smile crease.'});
 }
 const adjacency=new Map<string,SolvedFace[]>();for(const face of frame.faces)for(let i=0;i<face.verts.length;i++){const key=edgeKey(face.verts[i],face.verts[(i+1)%face.verts.length]);adjacency.set(key,[...(adjacency.get(key)??[]),face]);}
 for(const edge of frame.edges){
  const adjacent=adjacency.get(edgeKey(edge.a,edge.b))??[],front=adjacent.filter(f=>visibleFaces.get(f.id));
  const angle=adjacent.length===2?Math.acos(clamp(dot(adjacent[0].normal,adjacent[1].normal),-1,1))*180/Math.PI:0;
  const difference=adjacent.length===2?Math.abs(patchById.get(adjacent[0].id)!.fittedValue-patchById.get(adjacent[1].id)!.fittedValue):0;
  // Eye/nose/lip borders are owned by whole aperture/wedge paths above.
  // Construction partitions in a broad skin plane are never automatic ink.
  decisions.push({id:edgeKey(edge.a,edge.b),selected:false,role:'plane boundary',dihedral:angle,contrast:difference,reason:adjacent.length===2&&front.length===2?'Both planes are visible: their form change belongs to light/value, not a wire edge.':'A plane-cell partition is not a physical contour. Visible geometry is owned by clipped coherent feature paths or bounded value fields.'});
 }
 lineCtx.strokeStyle='black';lineCtx.lineCap='round';lineCtx.lineJoin='round';
 for(const path of paths){lineCtx.lineWidth=path.width;smooth(lineCtx,path.points,path.closed);lineCtx.stroke();}
 // Render only actual dark iris pixels where the 3D-disc projection and posed
 // eyelid aperture agree. Never paint a geometric pupil through a closed lid.
 for(const eye of eyes.eyes){
  const arcs=eye.paths.filter(path=>path.role==='iris-visible');
  if(!eye.open||!eye.gaze?.visibleBounds||!arcs.length)continue;
  const bounds=eye.gaze.visibleBounds,outline=eye.aperture.map(p),shown=arcs.flatMap(path=>path.points).map(p);
  const left=Math.max(0,Math.floor(bounds.x*sx)),right=Math.min(source.width-1,Math.ceil((bounds.x+bounds.width)*sx)),top=Math.max(0,Math.floor(bounds.y*sy)),bottom=Math.min(source.height-1,Math.ceil((bounds.y+bounds.height)*sy));
  // Source support is sampled only inside the visible arc envelope and its own
  // opening. The helper already performed all disc projection, lid clipping,
  // far-eye uncertainty and 3D per-sample visibility decisions.
  const threshold=Math.min(.5,median(outline.map(q=>luminance(q.x,q.y)))*.72),pixels:Point[]=[];
  const envelope=shown.length>2?shown:[];
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const q={x:x+.5,y:y+.5};if(inPolygon(q,outline)&&envelope.length&&inPolygon(q,envelope)&&owned(q)&&luminance(x,y)<threshold)pixels.push({x,y});}
  const supported=pixels.length>=3;
  if(supported){
   for(const path of arcs){const points=path.points.map(p);lineCtx.lineWidth=baseWidth*path.strokeWeight;smooth(lineCtx,points);lineCtx.stroke();add(path.id,'visible iris arc clipped by lid','eye',points,baseWidth*path.strokeWeight,'The visible fitted iris arc has dark photographic support inside its own opening.');}
   lineCtx.fillStyle='black';for(const q of pixels)lineCtx.fillRect(q.x,q.y,1,1);
  }
  decisions.push({id:`${eye.owner}.source-iris`,selected:supported,role:'source-verified visible iris',reason:supported?'Dark source pixels support the same fitted, visible iris inside its lid opening.':'No supported dark iris mass in the visible arc envelope; no pupil is invented.'});
 }
 // A geometric skin model must not erase foreground appearance. Compare
 // actual albedo evidence with the fitted n.L prediction inside semantic 3D
 // material regions, rather than treating every dark pixel as hair or shadow.
 const appearanceMaskCanvas=canvas(source.width,source.height),facialHairMaskCanvas=canvas(source.width,source.height),appearanceRegions:PlaneAppearanceRegion[]=[];
 const appearanceCtx=appearanceMaskCanvas.getContext('2d')!,facialHairCtx=facialHairMaskCanvas.getContext('2d')!;
 const upperLipEnvelope=[61,98,97,2,326,327,291,...LIPS_OUTER.slice(0,11).reverse().slice(1)].map(landmark);
 const total=source.width*source.height,predicted=new Float32Array(total).fill(NaN),materialRegion=new Uint8Array(total),planeIndex=new Int16Array(total).fill(-1),protectedPaper=new Uint8Array(total);
 const protectedCanvas=canvas(source.width,source.height),protectedCtx=protectedCanvas.getContext('2d')!;
 protectedCtx.fillStyle='white';protectedCtx.strokeStyle='white';protectedCtx.lineWidth=baseWidth*2;
 for(const eye of eyes.eyes){polygon(protectedCtx,eye.aperture.map(p));protectedCtx.fill();protectedCtx.stroke();}
 polygon(protectedCtx,lipOuter);protectedCtx.fill();protectedCtx.stroke();
 for(const ids of [['wl0','wl1'],['wr0','wr1']]){const a=vertex(ids[0]),b=vertex(ids[1]);if(!a||!b)continue;protectedCtx.lineWidth=baseWidth*3;protectedCtx.beginPath();protectedCtx.moveTo(a.x,a.y);protectedCtx.lineTo(b.x,b.y);protectedCtx.stroke();}
 const paper=protectedCtx.getImageData(0,0,source.width,source.height).data;for(let i=0;i<total;i++)protectedPaper[i]=paper[i*4+3]>32?1:0;
 for(const [index,face]of [...frame.faces].sort((a,b)=>faceCentroid(b,frame).z-faceCentroid(a,frame).z).entries()){
  const patch=patchById.get(face.id)!;if(!patch.visible||['mouth','neck'].includes(face.region))continue;
  const points=face.verts.map(id=>vertex(id)!),left=Math.max(0,Math.floor(Math.min(...points.map(q=>q.x)))),right=Math.min(source.width-1,Math.ceil(Math.max(...points.map(q=>q.x)))),top=Math.max(0,Math.floor(Math.min(...points.map(q=>q.y)))),bottom=Math.min(source.height-1,Math.ceil(Math.max(...points.map(q=>q.y))));
  const upperLipMaterial=face.region==='nose'&&face.verts.some(id=>/^(lp|ph|mc)/.test(id)||id==='sub'),lowerMaterial=['chin','jaw'].includes(face.region)||upperLipMaterial;
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const at=y*source.width+x,q={x:x+.5,y:y+.5};if(!owned(q)||protectedPaper[at]||!inPolygon(q,points))continue;predicted[at]=patch.fittedValue;materialRegion[at]=upperLipMaterial?(inPolygon(q,upperLipEnvelope)?3:2):lowerMaterial?1:2;planeIndex[at]=index;}
 }
 // Compare neighbourhood means, not raw grain. The noise floor comes from
 // source-supported skin patches after the geometric illumination fit.
 const integralWidth=source.width+1,integral=new Float64Array(integralWidth*(source.height+1));
 for(let y=0;y<source.height;y++){let row=0;for(let x=0;x<source.width;x++){row+=luminance(x,y);integral[(y+1)*integralWidth+x+1]=integral[y*integralWidth+x+1]+row;}}
 const meanLuminance=(x:number,y:number,r:number)=>{const left=Math.max(0,Math.floor(x-r)),right=Math.min(source.width,Math.ceil(x+r+1)),top=Math.max(0,Math.floor(y-r)),bottom=Math.min(source.height,Math.ceil(y+r+1));return (integral[bottom*integralWidth+right]-integral[top*integralWidth+right]-integral[bottom*integralWidth+left]+integral[top*integralWidth+left])/Math.max(1,(right-left)*(bottom-top));};
 const meanRadius=Math.max(1,Math.round(pose.bbox.size*sx*.004)),skinNoise:number[]=[];
 for(let y=0;y<source.height;y+=Math.max(2,meanRadius*2))for(let x=0;x<source.width;x+=Math.max(2,meanRadius*2)){const at=y*source.width+x,expected=predicted[at];if(Number.isFinite(expected)&&expected>.1&&Math.abs(luminance(x,y)-expected)<expected*.18)skinNoise.push(Math.abs(luminance(x,y)-meanLuminance(x,y,meanRadius)));}
 const noiseFloor=skinNoise.length?median(skinNoise)*1.4826/(meanRadius*2+1):.006;
 const candidates=new Uint8Array(total),deficits=new Float32Array(total),texture=new Uint8Array(total),strandTexture=new Uint8Array(total),radius=Math.max(2,Math.round(pose.bbox.size*sx*.01));
 const relativeThreshold=Math.max(.28,Math.min(.5,residual*2.5));
 for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
  const at=y*source.width+x,expected=predicted[at];if(!Number.isFinite(expected)||expected<.08||!materialRegion[at])continue;
  const actual=meanLuminance(x,y,meanRadius),deficit=(expected-actual)/Math.max(expected,.12);deficits[at]=deficit;
  if(deficit<relativeThreshold||expected-actual<.035)continue;
  const surrounding=[meanLuminance(x-radius,y,meanRadius),meanLuminance(x+radius,y,meanRadius),meanLuminance(x,y-radius,meanRadius),meanLuminance(x,y+radius,meanRadius),meanLuminance(x-radius,y-radius,meanRadius),meanLuminance(x+radius,y+radius,meanRadius)];
  const variation=Math.max(...surrounding,actual)-Math.min(...surrounding,actual);
  texture[at]=variation>Math.max(.018,expected*.07,noiseFloor*3)?1:0;
  const fine=meanLuminance(x,y,1),fineRadius=Math.max(2,meanRadius),acrossX=Math.abs(meanLuminance(x-fineRadius,y,1)+meanLuminance(x+fineRadius,y,1)-2*fine),acrossY=Math.abs(meanLuminance(x,y-fineRadius,1)+meanLuminance(x,y+fineRadius,1)-2*fine);
  strandTexture[at]=Math.max(Math.abs(fine-meanLuminance(x,y,meanRadius+2)),acrossX,acrossY)>Math.max(.018,expected*.065,noiseFloor*(meanRadius*2+1)*2.4)?1:0;candidates[at]=1;
 }
 const seen=new Uint8Array(total),minimum=Math.max(4,Math.round((pose.bbox.size*sx)**2*.00008)),faceOrder=[...frame.faces].sort((a,b)=>faceCentroid(b,frame).z-faceCentroid(a,frame).z);
 appearanceCtx.fillStyle='white';facialHairCtx.fillStyle='white';
 for(let seed=0;seed<total;seed++){
  if(!candidates[seed]||seen[seed])continue;
  const queue=[seed],pixels:number[]=[];seen[seed]=1;let cursor=0,deficitSum=0,textured=0,stranded=0,lower=0,minX=source.width,minY=source.height,maxX=0,maxY=0;const owners=new Set<string>();
  while(cursor<queue.length){const at=queue[cursor++],x=at%source.width,y=Math.floor(at/source.width);pixels.push(at);deficitSum+=deficits[at];textured+=texture[at];stranded+=strandTexture[at];lower+=materialRegion[at]===1||materialRegion[at]===3?1:0;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);if(planeIndex[at]>=0)owners.add(faceOrder[planeIndex[at]].id);
   for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=source.width||ny>=source.height)continue;const next=ny*source.width+nx;if(candidates[next]&&!seen[next]){seen[next]=1;queue.push(next);}}
  }
  const fraction=textured/pixels.length,strandFraction=stranded/pixels.length,meanDeficit=deficitSum/pixels.length;
  // Smooth n.L shadow without material/texture evidence remains a geometric
  // shadow field. A residual alone is not a facial-hair classification.
  if(pixels.length<minimum||fraction<.075||meanDeficit<relativeThreshold)continue;
  const facial=lower/pixels.length>.6&&fraction>.1&&strandFraction>.12&&meanDeficit>.34,bulk=pixels.length/Math.max(1,(maxX-minX+1)*(maxY-minY+1));let facialHairPixelCount=0;
  // Thin peripheral rings may be straps or other foreground material. Keep
  // their photo proposals, but do not relabel the entire ring as a beard.
  // Upper-lip material and broad lower-face masses have independent support.
  for(const at of pixels){const x=at%source.width,y=Math.floor(at/source.width);appearanceCtx.fillRect(x,y,1,1);if(facial&&(materialRegion[at]===3||bulk>.42)){facialHairCtx.fillRect(x,y,1,1);facialHairPixelCount++;}}
  appearanceRegions.push({id:`head.appearance.${appearanceRegions.length}`,role:facialHairPixelCount/pixels.length>.6?'facial-hair':'accessory-or-unexplained-albedo',pixelCount:pixels.length,facialHairPixelCount,bounds:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1},meanRelativeDeficit:meanDeficit,textureFraction:fraction,strandFraction,planeIds:[...owners],reason:facialHairPixelCount/pixels.length>.6?'Fine hair-like texture and dark albedo differ from fitted skin/light inside the posed upper-lip envelope or a broad lower-face mass.':'Source-supported textured albedo residual may be an accessory or material; it is not assumed to be a skin plane.'});
 }
 // Give photo proposal extraction a narrow corridor around each observed
 // material edge. Never expand through the protected apertures or off the face.
 const expanded=canvas(source.width,source.height),expandedCtx=expanded.getContext('2d')!,edgeRadius=Math.max(1,Math.round(baseWidth));
 for(let dy=-edgeRadius;dy<=edgeRadius;dy++)for(let dx=-edgeRadius;dx<=edgeRadius;dx++)expandedCtx.drawImage(appearanceMaskCanvas,dx,dy);
 expandedCtx.globalCompositeOperation='destination-in';expandedCtx.drawImage(faceMaskCanvas,0,0);expandedCtx.globalCompositeOperation='destination-out';expandedCtx.drawImage(protectedCanvas,0,0);expandedCtx.globalCompositeOperation='source-over';appearanceCtx.clearRect(0,0,source.width,source.height);appearanceCtx.drawImage(expanded,0,0);
 maskCtx.globalCompositeOperation='destination-out';maskCtx.drawImage(appearanceMaskCanvas,0,0);maskCtx.globalCompositeOperation='source-over';
 lineCtx.globalCompositeOperation='destination-out';lineCtx.drawImage(appearanceMaskCanvas,0,0);lineCtx.globalCompositeOperation='destination-over';lineCtx.fillStyle='white';lineCtx.fillRect(0,0,source.width,source.height);lineCtx.globalCompositeOperation='source-over';
 decisions.push({id:'appearance.material-occlusion',selected:appearanceRegions.length>0,role:'material/accessory occlusion before photo line extraction',reason:`${appearanceRegions.length} source-supported residual components preserve photographic material proposals; fitted illumination and protected openings were considered first.`});
 // Skin fields come from the fitted light on the posed planes, relative to
 // this subject's skin-plane median. They are not a photograph-darkness ramp.
 // A connected equal-band field owns one constant native pattern and phase.
 const skinValues=samples.map(patch=>patch.fittedValue),skinMedian=skinValues.length?median(skinValues):.65;
 const shadeFaces=new Map<string,number>();
 for(const patch of patches){
  if(!patch.visible||!patch.photoObserved||!['cranium','brow','socket','nose','cheek','chin','jaw'].includes(patch.region))continue;
  const deficit=skinMedian-patch.fittedValue;
  if(deficit>.045)shadeFaces.set(patch.id,deficit>.14?2:1);
 }
 const neighbours=new Map<string,Set<string>>();for(const shared of adjacency.values())for(const a of shared)for(const b of shared)if(a.id!==b.id){const set=neighbours.get(a.id)??new Set<string>();set.add(b.id);neighbours.set(a.id,set);}
 const shadowRegions:PlaneShadowRegion[]=[],remaining=new Set(shadeFaces.keys());
 while(remaining.size){
  const first=remaining.values().next().value!,band=shadeFaces.get(first)!,queue=[first],ids:string[]=[];remaining.delete(first);
  while(queue.length){const id=queue.shift()!;ids.push(id);for(const next of neighbours.get(id)??[])if(remaining.has(next)&&shadeFaces.get(next)===band){remaining.delete(next);queue.push(next);}}
  shadowRegions.push({id:`head.skin.shadow.${band}.${shadowRegions.length}`,owner:'head.skin',band,planeIds:ids,relativeValue:ids.reduce((sum,id)=>sum+patchById.get(id)!.fittedValue-skinMedian,0)/ids.length,polygons:ids.map(id=>frame.faces.find(face=>face.id===id)!.verts.map(vertexId=>vertex(vertexId)!)),reason:'Connected posed skin planes fall below this subject’s fitted skin-plane median; eye whites, mouth opening and foreground hair remain protected.'});
 }
 const shadowMaskCanvas=canvas(source.width,source.height),shadowContext=shadowMaskCanvas.getContext('2d')!,shadowBands:{band:number;maskCanvas:HTMLCanvasElement}[]=[];
 const excludeOpenings=(ctx:CanvasRenderingContext2D)=>{
  ctx.globalCompositeOperation='destination-out';ctx.fillStyle='white';ctx.strokeStyle='white';ctx.lineWidth=baseWidth*3;
  for(const eye of eyes.eyes){const outline=eye.aperture.map(p);polygon(ctx,outline);ctx.fill();ctx.stroke();}
  polygon(ctx,lipOuter);ctx.fill();ctx.stroke();
  if(options.hairMask)ctx.drawImage(hair,0,0);
  ctx.globalCompositeOperation='destination-in';ctx.drawImage(faceMaskCanvas,0,0);ctx.globalCompositeOperation='source-over';
 };
 for(const band of [1,2]){
  const maskCanvas=canvas(source.width,source.height),ctx=maskCanvas.getContext('2d')!;ctx.fillStyle='white';
  for(const field of shadowRegions.filter(region=>region.band===band))for(const points of field.polygons){polygon(ctx,points);ctx.fill();}
  excludeOpenings(ctx);shadowContext.drawImage(maskCanvas,0,0);shadowBands.push({band,maskCanvas});
 }
 decisions.push({id:'skin.relative-plane-shadows',selected:shadowRegions.length>0,role:'bounded plane-turn shadow field',reason:`${shadowRegions.length} connected plane-band fields below fitted skin median ${skinMedian.toFixed(3)}; tone is not inferred from absolute skin darkness.`});
 // Foreground hair clips all face ink as well as the ownership mask.
 if(options.hairMask){lineCtx.globalCompositeOperation='destination-out';lineCtx.drawImage(hair,0,0);lineCtx.globalCompositeOperation='destination-over';lineCtx.fillStyle='white';lineCtx.fillRect(0,0,source.width,source.height);lineCtx.globalCompositeOperation='source-over';}
 planeCtx.globalCompositeOperation='destination-in';planeCtx.drawImage(geometryMaskCanvas,0,0);planeCtx.globalCompositeOperation='destination-over';planeCtx.fillStyle='white';planeCtx.fillRect(0,0,source.width,source.height);planeCtx.globalCompositeOperation='source-over';
 const selected=decisions.filter(d=>d.selected).length;
 return {planesCanvas,selectedLinesCanvas,faceMaskCanvas,shadowMaskCanvas,appearanceMaskCanvas,facialHairMaskCanvas,appearanceRegions,shadowRegions,shadowBands,paths,planes:patches,eyes,decisions,light:displayedLight,registration:{space:'source-crop-pixels',width:source.width,height:source.height,traceRect:{...traceRect}},summary:[`Plane-first single-view construction: ${patches.length} posed patches, ${paths.length} coherent paths; ${selected} selected decisions.`,`The plane graph chooses visible openings, occlusions and plane/value transitions before any learned line extraction.`,`Plane diagnostic values are windowed across fitted span ${displayWindow.span.toFixed(3)} to reveal plane orientation; this does not strengthen the physical shadow fit.`, `Material/hair occlusion masks are separate from the construction diagnostic, so material evidence does not erase the fitted plane graph.`, `The recovered topology is a drawing prior deformed by the current face landmarks; single-view depth, hidden anatomy and lighting/albedo separation remain estimates.`,`Broad visible plane changes remain value bands; ${shadowRegions.length} connected shadow fields are available for constant native tone.  All ${frame.edges.length} graph edges were considered; the complete wireframe was not emitted.`,`Hair clips the facial construction. Hair/clothing proposals outside this ownership mask must be selected separately.`]};
}
