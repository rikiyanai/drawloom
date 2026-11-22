import fs from 'node:fs';
import path from 'node:path';
import { headContext, initializePlanes } from '../src/lib/planes/solve';
import { normalizePin, parsePlanes } from '../src/lib/planes/state';
import { serializeBackup, parseBackup, MAX_BACKUP_BYTES } from '../src/lib/capture/backup';
import type { StudySession } from '../src/lib/capture/study-store';
import type { Region } from '../src/lib/planes/topology';

const args=process.argv.slice(2),option=(key:string,fallback:string)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const root=option('--root','docs/agent/planes-feature/work'),output=option('--out','../planes-study.json'),ids=option('--ids','0001,0004,0007,0010').split(',');
if(ids.length>12||new Set(ids).size!==ids.length||ids.some(id=>!/^\d{4,6}$/.test(id)))throw Error('Select at most 12 distinct capture IDs.');
const read=(file:string)=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const data=read('planes-art/data3d.json'),sourceTopology=read('face-riki-scan/planes-edits/20261121-1620/topology.json');
const session:StudySession={id:crypto.randomUUID(),name:ids.length===4?'Recovered four-angle planes study':'Head recording keyframe study',layout:'grid',shots:{},order:[]};
for(const id of ids){
  const record=read(`face-riki-scan/drawloom/${id}/pose.json`),frame=data.angles.find((a:{id:string})=>a.id===id),raw=record.pose;
  let photo:string,landmarks=raw.vertices,width=raw.imageW,height=raw.imageH;
  if(frame){photo=frame.photo;const m=frame.img2page,scale=Math.sqrt(Math.abs(m[0][0]*m[1][1]-m[0][1]*m[1][0]));landmarks=raw.vertices.map((p:{x:number;y:number;z:number})=>({x:m[0][0]*p.x+m[0][1]*p.y+m[0][2],y:m[1][0]*p.x+m[1][1]*p.y+m[1][2],z:p.z*scale}));width=frame.w;height=frame.h;}
  else {const packet=read(`face-riki-scan/drawloom/${id}/packet.json`);photo=packet.layers?.find((layer:{id:string})=>layer.id==='photo')?.png;if(!photo)throw Error(`Capture ${id} needs its packet.json photo layer.`);}
  const xs=landmarks.map((p:{x:number})=>p.x),ys=landmarks.map((p:{y:number})=>p.y),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys),key=`frame-${id}`;
  session.order.push(key);session.shots[key]={dataUrl:photo,capturedAt:raw.timestampMs,...record.angles,pose:{landmarks,bbox:{cx:(left+right)/2,cy:(top+bottom)/2,size:Math.max(right-left,bottom-top)},imageWidth:width,imageHeight:height,matrix:raw.modelToCamera.m,angles:record.angles,blendShapes:raw.blendShapes}};
}
const context=headContext(session),state=initializePlanes(context),front=data.angles.find((a:{id:string})=>`frame-${a.id}`===context.refShotId);
if(front){
  for(const[id,p]of Object.entries(data.verts) as [string,number[]][]){const point={x:front.M[0].reduce((s:number,v:number,i:number)=>s+v*p[i],front.c[0]),y:front.M[1].reduce((s:number,v:number,i:number)=>s+v*p[i],front.c[1])};state.front[id.toLowerCase()]=normalizePin(point,context.reference,0);}
  for(const[id,vertex]of Object.entries(sourceTopology.added??{}) as [string,{X:number[];name:string;group:Region}][]){const m=front.img2page,scale=Math.sqrt(Math.abs(m[0][0]*m[1][1]-m[0][1]*m[1][0])),p=vertex.X;
    state.topology.added[id.toLowerCase()]={id:id.toLowerCase(),label:vertex.name,region:vertex.group,position:{x:(m[0][0]*p[0]+m[0][1]*p[1]+m[0][2]-context.origin.x)/context.size,y:(m[1][0]*p[0]+m[1][1]*p[1]+m[1][2]-context.origin.y)/context.size,z:(p[2]*scale-context.origin.z)/context.size}};
  }
}
state.topology.addEdges=(sourceTopology.addE??[]).map((key:string)=>{const[a,b]=key.toLowerCase().split('|');return {a,b,kind:'ridge'};});state.topology.removeEdges=(sourceTopology.delE??[]).map((key:string)=>key.toLowerCase());state.topology.deletedVertices=(sourceTopology.delV??[]).map((id:string)=>id.toLowerCase());
for(const id of ids){
  const key=`frame-${id}`,frame=data.angles.find((a:{id:string})=>a.id===id);if(!frame)continue;
  const edit=read(`face-riki-scan/planes-edits/20261121-1620/${id}.json`),pose=session.shots[key].pose!;
  state.observations[key]={};for(const[name,p]of Object.entries(edit.placed??{}) as [string,number[]][])state.observations[key][name.toLowerCase()]=normalizePin({x:p[0],y:p[1]},pose,Date.parse(edit.updatedAt)||0);
  const notes:Record<string,string>={};for(const[name,note]of Object.entries(edit.pointNotes??{})){if(typeof note!=='string')throw Error(`Invalid point note in capture ${id}`);notes[name.toLowerCase()]=note;}
  state.notes[key]={shot:edit.notes??'',points:notes};
}
session.planes=parsePlanes(state,session.order);
const backup=serializeBackup(session);if(Buffer.byteLength(backup)>MAX_BACKUP_BYTES)throw Error('The selected frames exceed the 40 MB backup limit. Select fewer frames.');
parseBackup(backup);fs.writeFileSync(output,backup);
console.log(`Wrote ${session.order.length} shots, ${Object.values(state.observations).reduce((n,p)=>n+Object.keys(p).length,0)} exact pins, ${Object.keys(state.topology.added).length} added points to ${output} (${Buffer.byteLength(backup)} bytes).`);
