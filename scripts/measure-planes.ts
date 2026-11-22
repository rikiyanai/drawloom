import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fitSimilarity } from '../src/lib/planes/register';
import { median, transform } from '../src/lib/planes/types';
import type { Vec3 } from '../src/lib/planes/types';

async function main() {
const args=process.argv.slice(2);
const root=path.resolve(args[0]??'docs/agent/planes-feature/work/face-riki-scan/drawloom');
const expected:Record<string,number>={'0004':2.6,'0007':8.1,'0010':11.4};
const frames=[];
for(const id of ['0001','0004','0007','0010']) {
  let data;
  try {data=JSON.parse(await readFile(path.join(root,id,'pose.json'),'utf8'));}
  catch {throw new Error(`Missing recovered capture ${id}/pose.json under ${root}. Pull recovery commit 8146135 or supply the capture directory; synthetic tests do not replace V1.`);}
  const landmarks:Vec3[]=data.pose?.vertices;
  if(!Array.isArray(landmarks)||landmarks.length!==478)throw new Error(`Expected 478 landmarks in capture ${id}`);
  frames.push({id,angles:data.angles,landmarks});
}
const measurements=[];
for(const frame of frames.slice(1)) for(const count of [478,468]) for(const robust of [false,true]) for(const zScale of [.5,1,1.5]) {
  const source=frames[0].landmarks.slice(0,count).map(p=>({...p,z:p.z*zScale}));
  const target=frame.landmarks.slice(0,count),fit=fitSimilarity(source,target,{robust});
  const xy=source.map((p,i)=>{const q=transform(fit,p);return Math.hypot(q.x-target[i].x,q.y-target[i].y);});
  measurements.push({id:frame.id,yaw:frame.angles.yaw,landmarkCount:count,robust,referenceZScale:zScale,median3dPx:fit.median,median2dPx:median(xy),rms3dPx:fit.rms});
}
const baseline=measurements.filter(m=>m.landmarkCount===478&&!m.robust&&m.referenceZScale===1);
const v1=baseline.map(m=>({id:m.id,expectedMedianPx:expected[m.id],actualMedianPx:m.median3dPx,withinTenPercent:Math.abs(m.median3dPx-expected[m.id])/expected[m.id]<=.1}));
const report={schema:'drawloom.planes.measurements.v1',sourceCommit:'8146135b80ed2acdbf74087da97c0ba9a2bb24dc',zSweep:'Scale only reference landmark z; compare to unchanged target landmarks in image-pixel units.',v1,measurements};
console.log(JSON.stringify(report,null,2));
if(args[1])await writeFile(args[1],JSON.stringify(report,null,2)+'\n');
if(!v1.every(m=>m.withinTenPercent)) process.exitCode=1;
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
