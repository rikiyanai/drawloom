import { BASE_TOPOLOGY } from './reference';
export { BASE_TOPOLOGY } from './reference';
import { graphFaces } from './edit';
import { fitNeck, neckSides } from './neck';
import { fitSimilarity, headFrame } from './register';
import { surfaceTriangles } from './mesh';
import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { add, sub, mul, dot, cross, unit, mean, normal, depthBuffer, solve3 } from './geometry';
import { distance, transform } from './types';
import type { Vec3, Registration } from './types';
import type { PlaneTopology, PlaneVertex, Region } from './topology';
import type { StudySession } from '../capture/study-store';
import type { PoseResult } from '../pose/detect';
import { emptyPlanes, normalizePin, pinPixels, edgeKey } from './state';
import type { HeadPlanesState, Pin } from './state';

export const PLANES_ENABLED=process.env.NEXT_PUBLIC_DRAWLOOM_PLANES==='1';
export const CONTROL_LABELS:Record<string,string>={hairline:'Hairline reference (user placed)','ear.top.l':'Ear top (image left)','ear.bottom.l':'Ear bottom (image left)','ear.top.r':'Ear top (image right)','ear.bottom.r':'Ear bottom (image right)',sphc:'Sphere centre',sphr:'Sphere radius',lmtop:'Sphere top',lmbrow:'Brow construction line',lmnose:'Nose-base construction line',lmchin:'Chin construction line',lmearl:'Ear reference (image left)',lmearr:'Ear reference (image right)',lmjawl:'Jaw reference (image left)',lmjawr:'Jaw reference (image right)',nkl0:'Neck top, image left',nkr0:'Neck top, image right',nkl1:'Neck bottom, image left',nkr1:'Neck bottom, image right',nkpit:'Pit of the neck',mastoidl:'Mastoid reference (image left)',mastoidr:'Mastoid reference (image right)',cutlc:'Side-plane centre (image left)',cutlb:'Side-plane top (image left)',cutla:'Side-plane width (image left)',cutrc:'Side-plane centre (image right)',cutrb:'Side-plane top (image right)',cutra:'Side-plane width (image right)',iris0:'Iris centre (image left)',iris1:'Iris centre (image right)',iris0r:'Iris radius (image left)',iris1r:'Iris radius (image right)'};
type Pose=NonNullable<PoseResult>;
export type Visibility='visible'|'grazing'|'occluded'|'back'|'uncertain';
type ShotContext={id:string;pose:Pose;fit:Registration;depth:ReturnType<typeof depthBuffer>};
export type HeadContext={refShotId:string;reference:Pose;origin:Vec3;size:number;landmarks:Vec3[];triangles:[number,number,number][];shots:Record<string,ShotContext>;right:Vec3;up:Vec3;back:Vec3};
export type SolvedVertex={id:string;label:string;region:Region;x:number;y:number;depth:number;model:Vec3;normal:Vec3;visibility:Visibility;observed:boolean;depthFromPrior:boolean;residualPx:number};
export type SolvedFace={id:string;label:string;region:Region;verts:string[];normal:Vec3;yaw:number;pitch:number;visible:boolean};
export type PlanesFrame={shotId:string;pose:Pose;vertices:Record<string,SolvedVertex>;faces:SolvedFace[];edges:PlaneTopology['edges'];irises:{eye:string[];points:{x:number;y:number}[]}[];curves:{id:string;points:{x:number;y:number}[]}[];canon:{id:string;measured:number;canon?:number;delta?:number;source:string;sourceVerified:boolean}[];source:'triangulated'|'single-view-lift';fitMedianPx:number;primitives:{sphere:{center:Vec3;radius:number;quality:string};neck:{top:Vec3;bottom:Vec3;radius:number;quality?:string;residualPx?:number}};context:HeadContext;state:HeadPlanesState};
const cache=new WeakMap<StudySession['shots'],Map<string,HeadContext>>();
export function headContext(session:StudySession,requested?:string):HeadContext {
  const valid=session.order.filter(id=>session.shots[id]?.pose);
  const refShotId=requested&&valid.includes(requested)?requested:[...valid].sort((a,b)=>Math.abs(session.shots[a].yaw)-Math.abs(session.shots[b].yaw))[0];
  if(!refShotId)throw Error('Capture or import a shot with facial landmarks first.');
  const existing=cache.get(session.shots)?.get(refShotId);if(existing)return existing;
  const pose=session.shots[refShotId].pose!,head=headFrame(pose.landmarks,pose.bbox.size),landmarks=head.landmarks;
  const triangles=surfaceTriangles(FaceLandmarker.FACE_LANDMARKS_TESSELATION,landmarks);
  const right=unit(sub(landmarks[454],landmarks[234])),up0=sub(landmarks[10],landmarks[152]),up=unit(sub(up0,mul(right,dot(up0,right))));
  let back=unit(cross(right,up));if(back.z<0)back=mul(back,-1);
  const shots:Record<string,ShotContext>={};
  for(const id of valid){const p=session.shots[id].pose!;shots[id]={id,pose:p,fit:fitSimilarity(landmarks.slice(0,468),p.landmarks.slice(0,468)),depth:depthBuffer(p.landmarks,triangles,p.imageWidth,p.imageHeight)};}
  const context={refShotId,reference:pose,origin:head.origin,size:head.size,landmarks,triangles,shots,right,up,back};
  const map=cache.get(session.shots)??new Map();map.set(refShotId,context);cache.set(session.shots,map);return context;
}
function primitives(context:HeadContext){
  const l=context.landmarks,r=Math.max(.05,Math.abs(dot(sub(l[9],l[2]),context.up)));
  const center=add(l[9],mul(context.back,r)),top=add(mean(l[172],l[397]),mul(context.back,.08));
  const direction=unit(add(mul(context.up,-Math.cos(Math.PI/10)),mul(context.back,Math.sin(Math.PI/10))));
  return {center,radius:r,top,bottom:add(top,mul(direction,1.25*r)),neckRadius:distance(l[234],l[454])/3.5};
}
function seedPoint(v:PlaneVertex,context:HeadContext,p:ReturnType<typeof primitives>):Vec3 {
  const seed=v.seed;
  if('tri'in seed){const q=seed.tri.reduce((q,i,j)=>add(q,mul(context.landmarks[i],seed.w[j])),{x:0,y:0,z:0});return add(q,{x:seed.off?.[0]??0,y:seed.off?.[1]??0,z:v.surface==='lid'?-.002:0});}
  if('sphere'in seed){const [x,y,z]=seed.sphere.dir;return add(p.center,mul(add(add(mul(context.right,x),mul(context.up,y)),mul(context.back,z)),p.radius));}
  const axis=sub(p.bottom,p.top);return add(add(p.top,mul(axis,seed.neck.t)),mul(add(mul(context.right,Math.cos(seed.neck.theta)),mul(context.back,Math.sin(seed.neck.theta))),p.neckRadius));
}
function controlSeeds(c:HeadContext,p:ReturnType<typeof primitives>):Record<string,Vec3>{
  const l=c.landmarks,rc=p.radius*Math.sqrt(1-.62**2),out:Record<string,Vec3>={sphc:p.center,sphr:add(p.center,mul(c.up,p.radius)),lmtop:add(p.center,mul(c.up,p.radius)),lmbrow:l[9],lmnose:l[2],lmchin:l[152],lmearl:l[234],lmearr:l[454],lmjawl:l[172],lmjawr:l[397],nkl0:add(p.top,mul(c.right,-p.neckRadius)),nkr0:add(p.top,mul(c.right,p.neckRadius)),nkl1:add(p.bottom,mul(c.right,-p.neckRadius)),nkr1:add(p.bottom,mul(c.right,p.neckRadius)),nkpit:add(p.bottom,mul(c.back,-p.neckRadius)),mastoidl:l[234],mastoidr:l[454]};
  for(const [side,sign]of [['l',-1],['r',1]] as const){const center=add(p.center,mul(c.right,sign*.62*p.radius));out[`cut${side}c`]=center;out[`cut${side}b`]=add(center,mul(c.up,rc));out[`cut${side}a`]=add(center,mul(c.back,-rc));}
  for(const [j,i]of [468,473].entries()){out[`iris${j}`]=l[i];const radius=[1,2,3,4].reduce((s,k)=>s+distance(l[i],l[i+k]),0)/4;out[`iris${j}r`]=add(l[i],mul(c.right,radius));}
  out.hairline=l[10];for(const[side,id]of [['l',234],['r',454]] as const){out[`ear.top.${side}`]=add(l[id],mul(c.up,.12));out[`ear.bottom.${side}`]=add(l[id],mul(c.up,-.12));}
  return out;
}
export function initializePlanes(c:HeadContext):HeadPlanesState {
  const p=primitives(c),shot=c.shots[c.refShotId],front:Record<string,Pin>={};
  for(const v of BASE_TOPOLOGY.vertices)front[v.id]=normalizePin(transform(shot.fit,seedPoint(v,c,p)),shot.pose,0);
  return emptyPlanes(c.refShotId,front);
}
const singleFrames=new WeakMap<Pose,PlanesFrame>();
export function singleViewFrame(pose:Pose):PlanesFrame {
  const cached=singleFrames.get(pose);if(cached)return cached;
  const session:StudySession={id:'single',name:'Single photo',layout:'grid',order:['front'],shots:{front:{dataUrl:'',capturedAt:0,...pose.angles,pose}}};
  const context=headContext(session),frame=solveFrame(context,initializePlanes(context),'front');singleFrames.set(pose,frame);return frame;
}
function pinFor(state:HeadPlanesState,shot:string,id:string){return state.observations[shot]?.[id]??(shot===state.refShotId?state.front[id]:undefined);}
function modelPoint(c:HeadContext,state:HeadPlanesState,id:string,prior:Vec3,excludeShot?:string,visibility?:{normal:Vec3;surface:string;sphere:ReturnType<typeof primitives>}):{point:Vec3;depthFromPrior:boolean} {
  // An explicit 3D surface edit changes shared geometry; existing photo pins
  // remain exact through display offsets and report their model residual.
  if(state.surfaceEdits[id])return {point:state.surfaceEdits[id],depthFromPrior:false};
  const front=excludeShot!==c.refShotId?pinFor(state,c.refShotId,id):undefined;
  const fixed=front?pinPixels(front,c.reference):undefined;
  const x=fixed?(fixed.x-c.origin.x)/c.size:prior.x,y=fixed?(fixed.y-c.origin.y)/c.size:prior.y;
  const observations=Object.entries(state.observations).filter(([shot,pins])=>shot!==excludeShot&&c.shots[shot]&&pins[id]&&(!visibility||pointVisibility(c,shot,prior,visibility.normal,visibility.surface,visibility.sphere)==='visible'));
  let point={x,y,z:prior.z},observable=false;
  for(let iteration=0;iteration<4;iteration++){
    const depthWeight=visibility?.surface==='face'||visibility?.surface==='lid'?2500:25;
    const a=[[25,0,0],[0,25,0],[0,0,depthWeight]],b=[25*prior.x,25*prior.y,depthWeight*prior.z];let az=depthWeight,bz=depthWeight*prior.z;
    for(const [shot,pins]of observations){const view=c.shots[shot],fit=view.fit,p=pinPixels(pins[id],view.pose),scale=view.pose.bbox.size;
      const rows=[fit.rotation.slice(0,3).map(v=>v*fit.scale/scale),fit.rotation.slice(3,6).map(v=>v*fit.scale/scale)];
      const rhs=[(p.x-fit.translation.x)/scale,(p.y-fit.translation.y)/scale];
      const residual=Math.hypot(...rows.map((row,j)=>dot({x:row[0],y:row[1],z:row[2]},point)-rhs[j]));
      const sigma=Math.sqrt(9+fit.median**2)/scale,weight=1/(sigma*sigma)*Math.min(1,2*sigma/Math.max(residual,1e-9));
      if(Math.hypot(rows[0][2],rows[1][2])>.08)observable=true;
      for(let row=0;row<2;row++){for(let i=0;i<3;i++){b[i]+=weight*rows[row][i]*rhs[row];for(let j=0;j<3;j++)a[i][j]+=weight*rows[row][i]*rows[row][j];}az+=weight*rows[row][2]**2;bz+=weight*rows[row][2]*(rhs[row]-rows[row][0]*x-rows[row][1]*y);}
    }
    point=fixed?{x,y,z:bz/az}:solve3(a,b);
  }
  return {point,depthFromPrior:!observable};
}
function rotateVector(fit:Registration,v:Vec3){const r=fit.rotation;return {x:dot({x:r[0],y:r[1],z:r[2]},v),y:dot({x:r[3],y:r[4],z:r[5]},v),z:dot({x:r[6],y:r[7],z:r[8]},v)};}
export function pointVisibility(c:HeadContext,shotId:string,position:Vec3,n:Vec3,surface:string,sphere?:{center:Vec3;radius:number}):Visibility {
  const view=c.shots[shotId],facing=-rotateVector(view.fit,n).z;
  if(surface!=='limb'){if(facing<-.08)return 'back';if(facing<.08)return 'grazing';}
  const p=transform(view.fit,position),tolerance=.015*view.pose.bbox.size;
  if(p.z>view.depth.at(p.x,p.y)+tolerance)return 'occluded';
  if(sphere&&['cranium','neck','limb'].includes(surface)){const s=transform(view.fit,sphere.center),r=sphere.radius*view.fit.scale,d=r*r-(p.x-s.x)**2-(p.y-s.y)**2;if(d>0&&p.z>s.z-Math.sqrt(d)+tolerance)return 'occluded';}
  if(['face','lid'].includes(surface)&&Math.abs(view.pose.angles.yaw)>=50&&position.x*view.fit.rotation[6]>.025)return 'uncertain';
  return 'visible';
}
export function solveFrame(c:HeadContext,state:HeadPlanesState,shotId:string,excludeShot?:string):PlanesFrame {
  const view=c.shots[shotId];if(!view)throw Error('This shot has no face landmarks.');
  const p=primitives(c),controls=controlSeeds(c,p),controlModels:Record<string,Vec3>={};
  for(const[id,prior]of Object.entries(controls))controlModels[id]=modelPoint(c,state,id,prior,excludeShot).point;
  p.center=controlModels.sphc;
  const radii=Object.entries(state.observations).filter(([shot,pins])=>shot!==excludeShot&&c.shots[shot]&&(pins.sphr||pins.lmtop)).map(([shot,pins])=>{const a=c.shots[shot],center=pinFor(state,shot,'sphc'),cp=center?pinPixels(center,a.pose):transform(a.fit,p.center),edge=pinPixels(pins.sphr??pins.lmtop,a.pose);return Math.hypot(edge.x-cp.x,edge.y-cp.y)/a.fit.scale;});
  if(radii.length)p.radius=Math.max(.03,radii.reduce((a,b)=>a+b,0)/radii.length);
  const fittedNeck=fitNeck(c,state,{top:p.top,bottom:p.bottom,radius:p.neckRadius},excludeShot);
  p.top=fittedNeck.top;p.bottom=fittedNeck.bottom;p.neckRadius=fittedNeck.radius;
  const sides=neckSides(c,shotId,fittedNeck),neckControls:Record<string,Vec3>={nkl0:sides.leftTop,nkr0:sides.rightTop,nkl1:sides.leftBottom,nkr1:sides.rightBottom};
  const base=new Map(BASE_TOPOLOGY.vertices.map(v=>[v.id,v])),vertices:Record<string,SolvedVertex>={};
  const priors:Record<string,Vec3>={...controls,...neckControls};for(const v of BASE_TOPOLOGY.vertices)priors[v.id]=seedPoint(v,c,p);for(const v of Object.values(state.topology.added))priors[v.id]=v.position;
  for(const[id,prior]of Object.entries(priors)){
    if(state.topology.deletedVertices.includes(id))continue;
    if((id==='hairline'||id.startsWith('ear.'))&&!state.surfaceEdits[id]&&!Object.values(state.observations).some(pins=>pins[id]))continue;
    const definition=base.get(id),added=state.topology.added[id];
    let n:Vec3={x:0,y:0,z:-1};
    if(definition&&'tri'in definition.seed){const [a,b,d]=definition.seed.tri.map(i=>c.landmarks[i]);n=unit(cross(sub(b,a),sub(d,a)));if(n.z>0)n=mul(n,-1);}
    if(definition?.surface==='cranium')n=unit(sub(prior,p.center));
    if(['neck','limb'].includes(definition?.surface??'')){const axis=unit(sub(p.bottom,p.top)),delta=sub(prior,p.top);n=unit(sub(delta,mul(axis,dot(delta,axis))));}
    let limbPoint:Vec3|undefined;
    if(definition?.surface==='limb'&&'neck' in definition.seed){
      const left=id.endsWith('l'),a=left?sides.leftTop:sides.rightTop,b=left?sides.leftBottom:sides.rightBottom,pin=shotId!==excludeShot?pinFor(state,shotId,id):undefined;
      let t=definition.seed.neck.t;
      if(pin){const q=pinPixels(pin,view.pose),pa=transform(view.fit,a),pb=transform(view.fit,b),dx=pb.x-pa.x,dy=pb.y-pa.y;t=Math.max(-.25,Math.min(2,((q.x-pa.x)*dx+(q.y-pa.y)*dy)/(dx*dx+dy*dy||1)));}
      limbPoint=add(a,mul(sub(b,a),t));
    }
    const solved=neckControls[id]?{point:neckControls[id],depthFromPrior:fittedNeck.quality.startsWith('estimated')}:limbPoint&&!state.surfaceEdits[id]?{point:limbPoint,depthFromPrior:fittedNeck.quality.startsWith('estimated')}:modelPoint(c,state,id,prior,excludeShot,definition||added?{normal:n,surface:definition?.surface??'face',sphere:p}:undefined);
    const model=solved.point,projected=transform(view.fit,model),pin=shotId!==excludeShot?pinFor(state,shotId,id):undefined,display=pin?pinPixels(pin,view.pose):projected;
    const visibility=definition||added?pointVisibility(c,shotId,model,n,definition?.surface??'face',p):'visible';
    vertices[id]={id,label:definition?.label??added?.label??CONTROL_LABELS[id]??id,region:definition?.region??added?.region??(id.startsWith('iris')?'eye':'cranium'),x:display.x,y:display.y,depth:projected.z,model,normal:n,visibility,observed:!!state.observations[shotId]?.[id],depthFromPrior:solved.depthFromPrior,residualPx:Math.hypot(projected.x-display.x,projected.y-display.y)};
  }
  const removed=new Set(state.topology.removeEdges),edgeMap=new Map(BASE_TOPOLOGY.edges.map(e=>[edgeKey(e.a,e.b),e]));
  for(const key of removed)edgeMap.delete(key);for(const e of state.topology.addEdges)edgeMap.set(edgeKey(e.a,e.b),e);
  const edges=[...edgeMap.values()].filter(e=>vertices[e.a]&&vertices[e.b]);
  const faces: SolvedFace[]=BASE_TOPOLOGY.faces.filter(f=>f.verts.every(id=>vertices[id])).map(face=>{
    let verts=[...face.verts];const points=verts.map(id=>vertices[id].model);let n=normal(points);
    // The recovered planar graph's positive image area faces away in y-down coordinates.
    const initial=verts.map(id=>priors[id]);if(normal(initial).z>0){verts.reverse();n=mul(n,-1);}
    return {...face,verts,normal:n,yaw:Math.atan2(dot(n,c.right),-dot(n,c.back))*180/Math.PI,pitch:Math.atan2(-dot(n,c.up),Math.hypot(dot(n,c.right),dot(n,c.back)))*180/Math.PI,visible:verts.every(id=>vertices[id].visibility==='visible')};
  });
  const curves:PlanesFrame['curves']=[],pushCurve=(id:string,points:Vec3[])=>curves.push({id,points:points.map(point=>transform(view.fit,point))});
  const ring=(center:Vec3,u:Vec3,v:Vec3,r:number)=>Array.from({length:97},(_,i)=>add(center,add(mul(u,r*Math.cos(i*Math.PI/48)),mul(v,r*Math.sin(i*Math.PI/48)))));
  const camera={x:view.fit.rotation[6],y:view.fit.rotation[7],z:view.fit.rotation[8]},u=unit(cross(camera,c.up)),v=unit(cross(camera,u));
  pushCurve('sphere',ring(p.center,u,v,p.radius));pushCurve('centerline',ring(p.center,c.up,c.back,p.radius));
  for(const sign of [-1,1])pushCurve('side-plane',ring(add(p.center,mul(c.right,sign*.62*p.radius)),c.up,c.back,p.radius*Math.sqrt(1-.62**2)));
  pushCurve('neck-top',ring(p.top,c.right,c.back,p.neckRadius));pushCurve('neck-bottom',ring(p.bottom,c.right,c.back,p.neckRadius));
  const neckSide=unit(cross(unit(sub(p.bottom,p.top)),camera));for(const sign of [-1,1])pushCurve('neck-side',[add(p.top,mul(neckSide,sign*p.neckRadius)),add(p.bottom,mul(neckSide,sign*p.neckRadius))]);
  // Per-view construction offsets preserve authored handle placements while
  // the 3D reading view continues to show the shared fit and its residual.
  const sphereCenter=vertices.sphc,spherePin=shotId!==excludeShot?(state.observations[shotId]?.sphr??state.observations[shotId]?.lmtop):undefined;
  const sphereRadius=spherePin?Math.hypot(pinPixels(spherePin,view.pose).x-sphereCenter.x,pinPixels(spherePin,view.pose).y-sphereCenter.y):p.radius*view.fit.scale;
  const sphereCurve=curves.find(curve=>curve.id==='sphere');if(sphereCurve)sphereCurve.points=Array.from({length:97},(_,i)=>({x:sphereCenter.x+sphereRadius*Math.cos(i*Math.PI/48),y:sphereCenter.y+sphereRadius*Math.sin(i*Math.PI/48)}));
  for(const [index,side]of ['l','r'].entries()){
    const center=vertices[`cut${side}c`],top=vertices[`cut${side}b`],edge=vertices[`cut${side}a`],curve=curves.filter(curve=>curve.id==='side-plane')[index];
    if(curve)curve.points=Array.from({length:97},(_,i)=>({x:center.x+(top.x-center.x)*Math.cos(i*Math.PI/48)+(edge.x-center.x)*Math.sin(i*Math.PI/48),y:center.y+(top.y-center.y)*Math.cos(i*Math.PI/48)+(edge.y-center.y)*Math.sin(i*Math.PI/48)}));
  }
  const neckBack=unit(cross(c.right,sub(p.bottom,p.top)));
  for(const level of [0,1]){
    const left=vertices[`nkl${level}`],right=vertices[`nkr${level}`],center={x:(left.x+right.x)/2,y:(left.y+right.y)/2},point=transform(view.fit,level?p.bottom:p.top),backPoint=transform(view.fit,add(level?p.bottom:p.top,mul(neckBack,p.neckRadius)));
    let vx=backPoint.x-point.x,vy=backPoint.y-point.y;if(level&&shotId!==excludeShot&&state.observations[shotId]?.nkpit){vx=center.x-vertices.nkpit.x;vy=center.y-vertices.nkpit.y;}
    const curve=curves.find(curve=>curve.id===(level?'neck-bottom':'neck-top'));if(curve)curve.points=Array.from({length:97},(_,i)=>({x:center.x+(right.x-left.x)/2*Math.cos(i*Math.PI/48)+vx*Math.sin(i*Math.PI/48),y:center.y+(right.y-left.y)/2*Math.cos(i*Math.PI/48)+vy*Math.sin(i*Math.PI/48)}));
  }
  const neckCurves=curves.filter(curve=>curve.id==='neck-side');for(const[index,side]of ['l','r'].entries()){if(neckCurves[index])neckCurves[index].points=[vertices[`nk${side}0`],vertices[`nk${side}1`]];curves.push({id:'neck-ridge',points:[vertices[`mastoid${side}`],vertices.nkpit]});}
  for(const[id,key]of [['brow','lmbrow'],['nose','lmnose']] as const){const height=dot(sub(controlModels[key],p.center),c.up),radius=Math.sqrt(Math.max(0,p.radius**2-height**2));if(radius>0)pushCurve(id,ring(add(p.center,mul(c.up,height)),c.right,c.back,radius).filter(point=>dot(sub(point,p.center),camera)<=0));}
  const irises:PlanesFrame['irises']=[];
  for(const [j,eye]of [['elo','elu1','elu','elu2','eli','ell2','ell','ell1'],['ero','eru1','eru','eru2','eri','erl2','erl','erl1']].entries()){
    const center=vertices[`iris${j}`],rim=vertices[`iris${j}r`];if(!center||!rim||eye.some(id=>!vertices[id]))continue;
    const eyeNormal=unit(eye.map(id=>vertices[id].normal).reduce(add,{x:0,y:0,z:0}));
    if(eye.filter(id=>vertices[id].visibility==='visible').length<3||!['visible','grazing'].includes(pointVisibility(c,shotId,center.model,eyeNormal,'lid',p)))continue;
    const radius=distance(center.model,rim.model),projection=transform(view.fit,center.model),offset={x:center.x-projection.x,y:center.y-projection.y};
    const axis=unit(sub(vertices[eye[4]].model,vertices[eye[0]].model)),up=unit(cross(eyeNormal,axis));
    irises.push({eye,points:ring(center.model,axis,up,radius).map(point=>{const q=transform(view.fit,point);return {x:q.x+offset.x,y:q.y+offset.y};})});
  }
  const canon:PlanesFrame['canon']=[{id:'Neck width / head width',measured:2*p.neckRadius/distance(c.landmarks[234],c.landmarks[454]),source:'Measured construction ratio; no canon',sourceVerified:true}];
  if(['elo','eli','ero','eri'].every(id=>vertices[id])){
    const eyeWidth=(distance(vertices.elo.model,vertices.eli.model)+distance(vertices.ero.model,vertices.eri.model))/2;
    for(const row of [{id:'Face width / mean eye width',measured:distance(c.landmarks[234],c.landmarks[454])/eyeWidth,canon:5},{id:'Intercanthal gap / mean eye width',measured:distance(vertices.eli.model,vertices.eri.model)/eyeWidth,canon:1}])canon.push({...row,delta:row.measured-row.canon,source:'Drawing convention; individual subjects vary',sourceVerified:false});
    if(vertices.wl0&&vertices.wr0)canon.push({id:'Nose width / inner-eye gap',measured:distance(vertices.wl0.model,vertices.wr0.model)/distance(vertices.eli.model,vertices.eri.model),canon:1,delta:distance(vertices.wl0.model,vertices.wr0.model)/distance(vertices.eli.model,vertices.eri.model)-1,source:'Drawing convention; individual subjects vary',sourceVerified:false});
  }
  const convention=(id:string,measured:number,value:number)=>canon.push({id,measured,canon:value,delta:measured-value,source:'Drawing convention; never a fitting target',sourceVerified:false});
  if(['hairline','gl0','gl1','sub','cb0'].every(id=>vertices[id])){const brow=mean(vertices.gl0.model,vertices.gl1.model),lengths=[Math.abs(dot(sub(vertices.hairline.model,brow),c.up)),Math.abs(dot(sub(brow,vertices.sub.model),c.up)),Math.abs(dot(sub(vertices.sub.model,vertices.cb0.model),c.up))],average=lengths.reduce((a,b)=>a+b,0)/3;if(average>1e-9)lengths.forEach((v,i)=>convention(['Upper third / mean third','Middle third / mean third','Lower third / mean third'][i],v/average,1));}
  if(['skl','skr','cb0','iris0','iris1'].every(id=>vertices[id])){const top=mean(vertices.skl.model,vertices.skr.model),eye=mean(vertices.iris0.model,vertices.iris1.model),height=dot(sub(top,vertices.cb0.model),c.up);if(Math.abs(height)>1e-9)convention('Eye line from crown / head height',dot(sub(top,eye),c.up)/height,.5);}
  if(['mcl','mcr','iris0','iris1'].every(id=>vertices[id]))convention('Mouth width / pupil gap',distance(vertices.mcl.model,vertices.mcr.model)/distance(vertices.iris0.model,vertices.iris1.model),1);
  for(const side of ['l','r'])if([`ear.top.${side}`,`ear.bottom.${side}`,'gl0','gl1','sub'].every(id=>vertices[id])){const brow=mean(vertices.gl0.model,vertices.gl1.model);convention(`Ear top vs brow, image ${side==='l'?'left':'right'} (head units)`,dot(sub(vertices[`ear.top.${side}`].model,brow),c.up),0);convention(`Ear bottom vs nose, image ${side==='l'?'left':'right'} (head units)`,dot(sub(vertices[`ear.bottom.${side}`].model,vertices.sub.model),c.up),0);}
  const neckAxis=unit(sub(p.bottom,p.top));canon.push({id:'Neck axis from vertical (degrees)',measured:Math.atan2(Math.hypot(dot(neckAxis,c.right),dot(neckAxis,c.back)),-dot(neckAxis,c.up))*180/Math.PI,source:'Measured construction angle; no canon',sourceVerified:true});
  const correctedViews=new Set([...(Object.keys(state.front).length?[c.refShotId]:[]),...Object.keys(state.observations).filter(id=>id!==excludeShot&&Object.keys(state.observations[id]).length)]);
  const sphereViews=Object.entries(state.observations).filter(([id,pins])=>id!==excludeShot&&(pins.sphc||pins.sphr||pins.lmtop)).length;
  const radiusSpread=radii.length>1?Math.max(...radii.map(r=>Math.abs(r-p.radius)/p.radius)):0;
  const result:PlanesFrame={shotId,pose:view.pose,vertices,faces,edges,irises,curves,canon,source:correctedViews.size>1?'triangulated':'single-view-lift',fitMedianPx:view.fit.median,primitives:{sphere:{center:p.center,radius:p.radius,quality:sphereViews<2?'estimated (prior)':radiusSpread>.1?'weak fit':'fitted construction'},neck:{top:p.top,bottom:p.bottom,radius:p.neckRadius,quality:fittedNeck.quality,residualPx:fittedNeck.residualPx}},context:c,state};
  if(Object.keys(state.topology.added).length||state.topology.addEdges.length||state.topology.removeEdges.length||state.topology.deletedVertices.length){
    const reference=shotId===c.refShotId?result:solveFrame(c,state,c.refShotId,excludeShot);
    result.faces=graphFaces(result,reference).map(face=>{const n=normal(face.verts.map(id=>vertices[id].model));return {...face,normal:n,yaw:Math.atan2(dot(n,c.right),-dot(n,c.back))*180/Math.PI,pitch:Math.atan2(-dot(n,c.up),Math.hypot(dot(n,c.right),dot(n,c.back)))*180/Math.PI,visible:face.verts.every(id=>vertices[id].visibility==='visible')};});
  }
  return result;
}
