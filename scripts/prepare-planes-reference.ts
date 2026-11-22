import fs from 'node:fs';
import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { barycentric, surfaceTriangles } from '../src/lib/planes/mesh';
import type { Triangle } from '../src/lib/planes/mesh';
import { validateTopology } from '../src/lib/planes/topology';
import type { PlaneTopology, PlaneVertex, Region } from '../src/lib/planes/topology';
import type { Vec3 } from '../src/lib/planes/types';

const root='docs/agent/planes-feature/work/';
const read=(file:string)=>JSON.parse(fs.readFileSync(root+file,'utf8'));
const data=read('planes-art/data3d.json');
const pose=read('face-riki-scan/drawloom/0001/pose.json').pose;
const placed=read('face-riki-scan/planes-edits/20261121-1620/0001.json').placed;
const landmarks:Vec3[]=pose.vertices;
const triangles=surfaceTriangles(FaceLandmarker.FACE_LANDMARKS_TESSELATION,landmarks);
if(triangles.length!==852)throw Error(`Review the changed tessellation before generating seeds: ${triangles.length} faces`);
const frame=data.angles.find((a:{id:string})=>a.id==='0001'),m=frame.img2page,det=m[0][0]*m[1][1]-m[0][1]*m[1][0];
function imagePoint(p:number[]) {const x=p[0]-m[0][2],y=p[1]-m[1][2];return {x:(m[1][1]*x-m[0][1]*y)/det,y:(-m[1][0]*x+m[0][0]*y)/det};}
function pagePoint(p:number[]) {return [frame.M[0].reduce((s:number,v:number,i:number)=>s+v*p[i],frame.c[0]),frame.M[1].reduce((s:number,v:number,i:number)=>s+v*p[i],frame.c[1])];}
const region=(key:string):Region=>{const value=data.names[key]?.group??'jaw';return ['forehead','temple'].includes(value)?'cranium':value;};
const lower=(key:string)=>key.toLowerCase();
const keys=Object.keys(data.verts);
if(new Set(keys.map(lower)).size!==keys.length)throw Error('Source IDs collide after normalization');
function faceSeed(p:{x:number;y:number}) {
  let best:{tri:Triangle;w:[number,number,number];off:[number,number];error:number}|undefined;
  for(const tri of triangles) {
    const w=barycentric(p,...tri.map(i=>landmarks[i]) as [Vec3,Vec3,Vec3]);
    if(!w)continue;
    if(w.every(v=>v>=-1e-8))return {inside:true,seed:{tri,w}};
    for(let i=0;i<3;i++) {
      const j=(i+1)%3,a=landmarks[tri[i]],b=landmarks[tri[j]],dx=b.x-a.x,dy=b.y-a.y;
      const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
      const off:[number,number]=[p.x-a.x-t*dx,p.y-a.y-t*dy],error=Math.hypot(...off);
      const weights:[number,number,number]=[0,0,0];weights[i]=1-t;weights[j]=t;
      if(!best||error<best.error)best={tri,w:weights,off,error};
    }
  }
  if(!best)throw Error('No reference surface triangles');
  const size=Math.max(Math.max(...landmarks.map(p=>p.x))-Math.min(...landmarks.map(p=>p.x)),Math.max(...landmarks.map(p=>p.y))-Math.min(...landmarks.map(p=>p.y)));
  return {inside:false,seed:{tri:best.tri,w:best.w,off:best.off.map(v=>v/size) as [number,number]}};
}
const vertices:PlaneVertex[]=keys.map(key=>{
  const original:number[]=data.verts[key],p=imagePoint(placed[key]??pagePoint(original)),r=region(key),face=faceSeed(p);
  let seed:PlaneVertex['seed']=face.seed,surface:PlaneVertex['surface']=r==='eye'?'lid':'face';
  if(r==='cranium'&&!face.inside) {
    const [x,y,z]=data.loomis.sphC,radius=data.loomis.sphR;
    const dz=-Math.sqrt(Math.max(0,radius*radius-(p.x-x)**2-(p.y-y)**2));
    const direction:[number,number,number]=[p.x-x,p.y-y,dz||original[2]-z];
    const length=Math.hypot(...direction),axes=[data.loomis.right,data.loomis.up,data.loomis.back];
    seed={sphere:{dir:axes.map(axis=>direction.reduce((sum,v,i)=>sum+v*axis[i],0)/length) as [number,number,number]}};surface='cranium';
  } else if(r==='neck') {
    const c=data.loomis.neckC,axis=data.loomis.neckDir,right=data.loomis.right,back=data.loomis.back;
    const delta=original.map((v,i)=>v-c[i]);
    const t=delta.reduce((s,v,i)=>s+v*axis[i],0)/data.loomis.neckLen;
    const radial=delta.map((v,i)=>v-t*data.loomis.neckLen*axis[i]);
    seed={neck:{t,theta:Math.atan2(radial.reduce((s,v,i)=>s+v*back[i],0),radial.reduce((s,v,i)=>s+v*right[i],0))}};surface=key==='nkL'||key==='nkR'?'limb':'neck';
  }
  const partner=key.includes('L')?key.replace('L','R'):key.includes('R')?key.replace('R','L'):'';
  return {id:lower(key),label:data.names[key]?.name??key,region:r,surface,seed,...(keys.includes(partner)?{mirror:lower(partner)}:{})};
});
const edgeSet=new Set<string>();
for(const line of data.poly)for(let i=1;i<line.length;i++)edgeSet.add([lower(line[i-1]),lower(line[i])].sort().join('|'));
const topology:PlaneTopology={version:1,vertices,faces:data.faces.map((face:string[],index:number)=>{
  const groups=face.map(region),r=groups.sort((a,b)=>groups.filter(x=>x===b).length-groups.filter(x=>x===a).length)[0];
  return {id:`plane.${index+1}`,label:`${r[0].toUpperCase()+r.slice(1)} plane ${index+1}`,region:r,verts:face.map(lower),kind:r==='eye'?'band':'plane'};
}),edges:[...edgeSet].map(key=>{const[a,b]=key.split('|');return {a,b,kind:'ridge'};})};
const errors=validateTopology(topology);
if(errors.length)throw Error(errors.join('\n'));
fs.writeFileSync('src/lib/planes/reference-topology.json',JSON.stringify({...topology,source:{commit:'8146135b80ed2acdbf74087da97c0ba9a2bb24dc',geometry:'planes-art/data3d.json',pins:'face-riki-scan/planes-edits/20261121-1620/0001.json',status:'single-subject drawing construction; not anatomical registration'}},null,2)+'\n');
console.log(`Prepared ${vertices.length} named vertices, ${topology.faces.length} explicit faces, ${topology.edges.length} edges; surface ${triangles.length} triangles.`);
