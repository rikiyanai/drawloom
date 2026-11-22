import type { PlanesFrame } from './solve';
import { BASE_TOPOLOGY, pointVisibility } from './solve';
import { add, mul, sub, unit } from './geometry';
import { transform } from './types';
import type { Region } from './topology';

export const REGION_COLORS:Record<Region,string>={cranium:'#ef776d',brow:'#dc8de5',socket:'#79b7f7',eye:'#a4c7ff',nose:'#f4b04c',cheek:'#61cf9d',mouth:'#ff8fb9',chin:'#b79bff',jaw:'#c8cbd0',neck:'#d095f4'};
const surfaces=new Map(BASE_TOPOLOGY.vertices.map(v=>[v.id,v.surface]));
export function edgeSamples(frame:PlanesFrame,a:string,b:string) {
  const p=frame.vertices[a],q=frame.vertices[b],view=frame.context.shots[frame.shotId];
  const p0=transform(view.fit,p.model),q0=transform(view.fit,q.model);
  return Array.from({length:13},(_,i)=>{const t=i/12,model=add(p.model,mul(sub(q.model,p.model),t)),projected=transform(view.fit,model),n=unit(add(mul(p.normal,1-t),mul(q.normal,t)));
    return {x:projected.x+(p.x-p0.x)*(1-t)+(q.x-q0.x)*t,y:projected.y+(p.y-p0.y)*(1-t)+(q.y-q0.y)*t,visible:p.visibility==='visible'&&q.visibility==='visible'&&pointVisibility(frame.context,frame.shotId,model,n,surfaces.get(t<.5?a:b)??'face',frame.primitives.sphere)==='visible'};
  });
}
export function drawPlanes(ctx:CanvasRenderingContext2D,frame:PlanesFrame,options:{part?:'planes'|'primitives'|'canon';scale?:number;hidden?:boolean;faces?:boolean;regions?:Region[]}={}){
  const part=options.part??'planes',scale=options.scale??1;ctx.save();ctx.scale(scale,scale);ctx.lineCap='round';ctx.lineJoin='round';
  const width=Math.max(.6,frame.pose.bbox.size/350);
  if(part==='planes'){
    if(options.faces!==false)for(const face of frame.faces){if(!face.visible)continue;ctx.beginPath();face.verts.forEach((id,i)=>{const p=frame.vertices[id];if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.fillStyle=REGION_COLORS[face.region]+'18';ctx.fill();}
    for(const edge of frame.edges){if(options.regions&&!options.regions.includes(frame.vertices[edge.a].region)&&!options.regions.includes(frame.vertices[edge.b].region))continue;const a=frame.vertices[edge.a],samples=edgeSamples(frame,edge.a,edge.b);ctx.lineWidth=width*(['eye','nose','mouth'].includes(a.region)?1.7:1);for(let i=1;i<samples.length;i++){const p=samples[i-1],q=samples[i],visible=p.visible&&q.visible;if(!visible&&!options.hidden)continue;ctx.setLineDash(visible?[]:[3*width,3*width]);ctx.strokeStyle=visible?REGION_COLORS[a.region]:'#96999f';ctx.globalAlpha=visible?1:.35;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}}
    ctx.setLineDash([]);ctx.globalAlpha=1;
    for(const iris of frame.irises){ctx.save();ctx.beginPath();iris.eye.forEach((id,i)=>{const p=frame.vertices[id];if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.clip();ctx.beginPath();iris.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=REGION_COLORS.eye;ctx.lineWidth=width*1.5;ctx.stroke();ctx.restore();}
  } else if(part==='primitives'){
    ctx.lineWidth=width;for(const curve of frame.curves){ctx.strokeStyle=curve.id.startsWith('neck')?REGION_COLORS.neck:curve.id==='side-plane'?'#58cfae':'#6fa8ff';ctx.beginPath();curve.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}
  } else {
    ctx.strokeStyle='#e5bd62';ctx.fillStyle='#e5bd62';ctx.lineWidth=width;ctx.setLineDash([6*width,4*width]);
    for(const[a,b]of [['elo','ero'],['eli','eri'],['wlo','wro']]){const p=frame.vertices[a],q=frame.vertices[b];if(!p||!q)continue;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}
  }
  ctx.restore();
}
