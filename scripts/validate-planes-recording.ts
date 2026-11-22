import fs from 'node:fs';
import path from 'node:path';
import { fitSimilarity } from '../src/lib/planes/register';
import { median, transform, rotate } from '../src/lib/planes/types';
import type { Registration, Vec3, Mat3 } from '../src/lib/planes/types';
import { headContext, initializePlanes, solveFrame } from '../src/lib/planes/solve';
import type { StudySession } from '../src/lib/capture/study-store';

// This recording supplies additional poses, not independent subjects or manual
// placement truth. Report failed detections as well as usable frames.
const root=process.argv[2]??'docs/agent/planes-feature/work/face-riki-scan';
const receipt=JSON.parse(fs.readFileSync(path.join(root,'receipt.json'),'utf8'));
const records=fs.readdirSync(path.join(root,'drawloom')).sort().map(id=>({id,...JSON.parse(fs.readFileSync(path.join(root,'drawloom',id,'pose.json'),'utf8'))}));
const valid=records.filter(f=>f.pose?.vertices?.length===478&&f.angles);
const reference=valid.find(f=>f.id==='0001');if(!reference)throw Error('Recording reference frame 0001 is missing');
const indices=[10,67,297,109,338,151,9,8,168,6,197,195,5,4,33,263,127,356,234,454,93,323,132,361];
const direct=(a:Vec3[],b:Vec3[],subset=false)=>fitSimilarity(subset?indices.map(i=>a[i]):a.slice(0,468),subset?indices.map(i=>b[i]):b.slice(0,468));
function compose(a:Registration,b:Registration):Registration {
  const rotation=Array.from({length:9},(_,i)=>{const row=Math.floor(i/3),col=i%3;return [0,1,2].reduce((s,k)=>s+b.rotation[row*3+k]*a.rotation[k*3+col],0);}) as Mat3;
  const t=rotate(b.rotation,a.translation);
  return {...b,rotation,scale:a.scale*b.scale,translation:{x:b.scale*t.x+b.translation.x,y:b.scale*t.y+b.translation.y,z:b.scale*t.z+b.translation.z}};
}
const error=(fit:Registration,target:Vec3[])=>median(reference.pose.vertices.slice(0,468).map((p:Vec3,i:number)=>{const q=transform(fit,p);return Math.hypot(q.x-target[i].x,q.y-target[i].y,q.z-target[i].z);}));
const rows:{id:string;yaw:number;pitch:number;roll:number;all468Median3dPx:number;stableSubsetMedian3dPx:number;chainedMedian3dPx:number;visibility:Record<string,number>;irisCount:number}[]=[];let previous=reference,chain=direct(reference.pose.vertices,reference.pose.vertices);
for(const f of valid){
  if(f!==reference)chain=compose(chain,direct(previous.pose.vertices,f.pose.vertices));previous=f;
  const all=direct(reference.pose.vertices,f.pose.vertices),stable=direct(reference.pose.vertices,f.pose.vertices,true);
  // Each frame is exercised in a two-shot study; the production keyframe cap
  // stays 12. No unlabelled views are pretended to be corrected observations.
  const session:StudySession={id:'recording',name:'Recording validation',order:[reference.id,...(f.id===reference.id?[]:[f.id])],layout:'grid',shots:{}};
  for(const frame of [reference,f]){const landmarks=frame.pose.vertices,x=landmarks.map((p:Vec3)=>p.x),y=landmarks.map((p:Vec3)=>p.y),left=Math.min(...x),right=Math.max(...x),top=Math.min(...y),bottom=Math.max(...y);session.shots[frame.id]={dataUrl:'',capturedAt:0,...frame.angles,pose:{landmarks,angles:frame.angles,matrix:frame.pose.modelToCamera.m,blendShapes:{},bbox:{cx:(left+right)/2,cy:(top+bottom)/2,size:Math.max(right-left,bottom-top)},imageWidth:frame.pose.imageW,imageHeight:frame.pose.imageH}};}
  const c=headContext(session,reference.id),state=initializePlanes(c),solved=solveFrame(c,state,f.id);
  if(Object.values(solved.vertices).some(v=>![v.x,v.y,v.depth].every(Number.isFinite)))throw Error(`Nonfinite model at ${f.id}`);
  rows.push({id:f.id,...f.angles,all468Median3dPx:error(all,f.pose.vertices),stableSubsetMedian3dPx:error(stable,f.pose.vertices),chainedMedian3dPx:error(chain,f.pose.vertices),visibility:Object.fromEntries(['visible','occluded','back','grazing','uncertain'].map(v=>[v,Object.values(solved.vertices).filter(p=>p.visibility===v).length])),irisCount:solved.irises.length});
}
const scores=Object.fromEntries(['all468Median3dPx','stableSubsetMedian3dPx','chainedMedian3dPx'].map(key=>[key,median(rows.filter(r=>r.id!==reference.id).map(r=>r[key as keyof typeof r] as number))]));
const report={schema:'drawloom.planes.recording-validation.v1',source:receipt.stages.frames,reference:'0001',totalFrames:records.length,usableFrames:valid.length,failedDetectionIds:records.filter(f=>!valid.includes(f)).map(f=>f.id),scores,rows,limitations:['One subject from one recording; additional poses do not establish cross-subject generalization.','Unlabelled frames test numerical stability and rendering, not plane-placement or visibility accuracy.','Stable subset and chained methods are compared on the same full 468-landmark residual; the current runtime uses direct robust 468 registration.']};
const output=JSON.stringify(report,null,2)+'\n';fs.writeFileSync(process.argv[3]??'docs/agent/planes-feature/RECORDING-MEASUREMENTS.json',output);console.log(JSON.stringify({totalFrames:records.length,usableFrames:valid.length,scores}));
