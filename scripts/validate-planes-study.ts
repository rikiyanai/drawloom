import fs from 'node:fs';
import { parseBackup } from '../src/lib/capture/backup';
import { BASE_TOPOLOGY, headContext, solveFrame } from '../src/lib/planes/solve';
import { pinPixels } from '../src/lib/planes/state';
import { median, transform } from '../src/lib/planes/types';

const file=process.argv[2];if(!file)throw Error('Usage: tsx scripts/validate-planes-study.ts <study-backup.json> [report.json]');
const session=parseBackup(fs.readFileSync(file,'utf8')),state=session.planes;if(!state)throw Error('Use a version-2 backup containing planes corrections.');
const context=headContext(session,state.refShotId),single={...state,observations:{[context.refShotId]:state.observations[context.refShotId]??{}}};
const stats=(values:number[])=>{const v=[...values].sort((a,b)=>a-b);return {count:v.length,median:v.length?median(v):null,p90:v.length?v[Math.min(v.length-1,Math.ceil(v.length*.9)-1)]:null};};
const rows=[];
for(const shot of session.order.filter(id=>context.shots[id])){
  const b1=solveFrame(context,single,shot),b2=solveFrame(context,state,shot,shot),regions:Record<string,{b1:number[];b2:number[]}>={},all1:number[]=[],all2:number[]=[];
  for(const vertex of BASE_TOPOLOGY.vertices){const pin=state.observations[shot]?.[vertex.id];if(!pin||!b2.vertices[vertex.id])continue;const target=pinPixels(pin,context.shots[shot].pose),a=b1.vertices[vertex.id],b=b2.vertices[vertex.id],error1=Math.hypot(a.x-target.x,a.y-target.y),error2=Math.hypot(b.x-target.x,b.y-target.y);
    all1.push(error1);all2.push(error2);regions[vertex.region]??={b1:[],b2:[]};regions[vertex.region].b1.push(error1);regions[vertex.region].b2.push(error2);
  }
  const visibilityFrame=solveFrame(context,state,shot),ids=BASE_TOPOLOGY.vertices.map(v=>v.id).filter(id=>visibilityFrame.vertices[id]),truth=new Set(state.hiddenLabels[shot]??[]),draggable=ids.filter(id=>visibilityFrame.vertices[id].visibility==='visible'),hidden=ids.filter(id=>truth.has(id)),falseVisible=draggable.filter(id=>truth.has(id)).length,hiddenFound=hidden.filter(id=>!draggable.includes(id)).length;
  const visibilityReview=state.reviewedShots.includes(shot)?{reviewed:true,vertices:ids.length,actuallyHidden:hidden.length,draggable:draggable.length,falseVisible,falseVisibleRate:draggable.length?falseVisible/draggable.length:null,hiddenRecall:hidden.length?hiddenFound/hidden.length:null}:{reviewed:false};
  const p=b2.primitives.sphere,c=transform(context.shots[shot].fit,p.center),spherePin=state.observations[shot]?.sphc,observedCenter=spherePin?pinPixels(spherePin,context.shots[shot].pose):undefined;
  rows.push({shot,yaw:session.shots[shot].yaw,referenceView:shot===context.refShotId,visibilityReview,b1:stats(all1),b2:stats(all2),b2MedianFaceUnits:all2.length?median(all2)/context.shots[shot].pose.bbox.size:null,regions:Object.fromEntries(Object.entries(regions).map(([region,v])=>[region,{b1:stats(v.b1),b2:stats(v.b2)}])),heldOutSphereCenterErrorOverRadius:observedCenter?Math.hypot(c.x-observedCenter.x,c.y-observedCenter.y)/(p.radius*context.shots[shot].fit.scale):null});
}
const report={schema:'drawloom.planes.validation.v1',referenceCapture:context.refShotId,rows,limitations:[
  'Scores compare against the recovered snapshot of manual pins; these are drawing placements, not anatomical ground truth.',
  'The front reference also authored the topology seeds, so a front-view score is not an independent held-out test.',
  'Held-out views contribute neither display pins nor model observations to their B2 prediction. Every saved pin remains in the original backup.',
  'The historical B0 medians in PLAN.md come from an earlier editor snapshot. The recovered legacy profile file contains only two comparable plane-vertex drags, so a reliable per-region B0 comparison is unavailable.',
  'V3 needs completed human visibility labels; V9 needs two additional subjects. No default-on gate is claimed here.'
]};
const output=JSON.stringify(report,null,2)+'\n';if(process.argv[3])fs.writeFileSync(process.argv[3],output);console.log(output);
