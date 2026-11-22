import { BASE_TOPOLOGY } from './reference';
import { transform } from './types';
import type { PlanesFrame } from './solve';
import type { HeadPlanesState } from './state';
import { edgeKey, normalizePin, setPin } from './state';
import { add, mul, sub, inPolygon } from './geometry';
import type { Vec3 } from './types';

export function connectPoints(state:HeadPlanesState,frame:PlanesFrame,a:string,b:string):HeadPlanesState {
  if(a===b||!frame.vertices[a]||!frame.vertices[b])return state;
  const key=edgeKey(a,b);if(frame.edges.some(e=>edgeKey(e.a,e.b)===key))return state;
  const reference=frame.context.shots[frame.context.refShotId];
  const project=(id:string)=>{const pin=state.observations[reference.id]?.[id]??state.front[id];return pin??normalizePin(transform(reference.fit,frame.vertices[id].model),reference.pose);};
  const p=project(a),q=project(b),orient=(a:{x:number;y:number},b:{x:number;y:number},c:{x:number;y:number})=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
  for(const e of frame.edges){if([e.a,e.b].some(id=>id===a||id===b))continue;const u=project(e.a),v=project(e.b);if(orient(p,q,u)*orient(p,q,v)<-1e-12&&orient(u,v,p)*orient(u,v,q)<-1e-12)throw Error('Split the crossing line with a point before connecting these points.');}
  const next=structuredClone(state);next.topology.removeEdges=next.topology.removeEdges.filter(e=>e!==key);next.topology.addEdges.push({a,b,kind:'ridge'});return next;
}
export function removeLine(state:HeadPlanesState,a:string,b:string):HeadPlanesState {
  const next=structuredClone(state),key=edgeKey(a,b);next.topology.addEdges=next.topology.addEdges.filter(e=>edgeKey(e.a,e.b)!==key);
  if(BASE_TOPOLOGY.edges.some(e=>edgeKey(e.a,e.b)===key)&&!next.topology.removeEdges.includes(key))next.topology.removeEdges.push(key);return next;
}
export function addPoint(state:HeadPlanesState,frame:PlanesFrame,p:{x:number;y:number},frames:PlanesFrame[],edge?:{a:string;b:string}):HeadPlanesState {
  const id=`u.${crypto.randomUUID()}`,next=structuredClone(state);let position:Vec3,region=frame.vertices[edge?.a??'ckl']?.region??'cheek',t=0;
  if(edge){const a=frame.vertices[edge.a],b=frame.vertices[edge.b],dx=b.x-a.x,dy=b.y-a.y;t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));position=add(a.model,mul(sub(b.model,a.model),t));}
  else {
    const view=frame.context.shots[frame.shotId],fit=view.fit,r=fit.rotation;
    let z=view.depth.at(p.x,p.y);
    if(!Number.isFinite(z)){const c=frame.primitives.sphere.center,s=fit.scale,cp={x:s*(r[0]*c.x+r[1]*c.y+r[2]*c.z)+fit.translation.x,y:s*(r[3]*c.x+r[4]*c.y+r[5]*c.z)+fit.translation.y,z:s*(r[6]*c.x+r[7]*c.y+r[8]*c.z)+fit.translation.z},rad=frame.primitives.sphere.radius*s;z=cp.z-Math.sqrt(Math.max(0,rad*rad-(p.x-cp.x)**2-(p.y-cp.y)**2));region='cranium';}
    const delta={x:(p.x-fit.translation.x)/fit.scale,y:(p.y-fit.translation.y)/fit.scale,z:(z-fit.translation.z)/fit.scale};
    position={x:r[0]*delta.x+r[3]*delta.y+r[6]*delta.z,y:r[1]*delta.x+r[4]*delta.y+r[7]*delta.z,z:r[2]*delta.x+r[5]*delta.y+r[8]*delta.z};
  }
  next.topology.added[id]={id,label:`New point ${Object.keys(next.topology.added).length+1}`,region,position};
  let result=setPin(next,frame.shotId,id,normalizePin(p,frame.pose));
  if(edge){
    result=removeLine(result,edge.a,edge.b);result.topology.addEdges.push({a:edge.a,b:id,kind:'ridge'},{a:id,b:edge.b,kind:'ridge'});
    for(const f of frames){const a=f.vertices[edge.a],b=f.vertices[edge.b];if(a&&b)result=setPin(result,f.shotId,id,normalizePin({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},f.pose));}
  }
  return result;
}

/** Bounded planar graph regions. Crossings are rejected when adding an edge.
 * Open chains never create faces. Face IDs are stable across reloads. */
export function graphFaces(frame:PlanesFrame,reference:PlanesFrame) {
  const neighbors=new Map<string,string[]>();for(const e of frame.edges){neighbors.set(e.a,[...(neighbors.get(e.a)??[]),e.b]);neighbors.set(e.b,[...(neighbors.get(e.b)??[]),e.a]);}
  // An unfinished interior stroke must not erase the surrounding closed plane.
  let pruned=true;while(pruned){pruned=false;for(const[id,list]of neighbors)if(list.length<2){neighbors.delete(id);for(const other of list)neighbors.set(other,(neighbors.get(other)??[]).filter(v=>v!==id));pruned=true;}}
  for(const[id,list]of neighbors){const p=reference.vertices[id];if(!p)continue;list.sort((a,b)=>Math.atan2(reference.vertices[a].y-p.y,reference.vertices[a].x-p.x)-Math.atan2(reference.vertices[b].y-p.y,reference.vertices[b].x-p.x));}
  const visited=new Set<string>(),cycles:string[][]=[];
  for(const edge of frame.edges)for(const start of [[edge.a,edge.b],[edge.b,edge.a]]){
    if(!neighbors.has(start[0])||!neighbors.has(start[1]))continue;
    let[a,b]=start;const cycle:string[]=[];
    while(!visited.has(`${a}|${b}`)&&cycle.length<400){visited.add(`${a}|${b}`);cycle.push(a);const list=neighbors.get(b)!;const next=list[(list.indexOf(a)+list.length-1)%list.length];a=b;b=next;}
    if(a!==start[0]||b!==start[1]||cycle.length<3||new Set(cycle).size!==cycle.length)continue;
    const area=cycle.reduce((sum,id,i)=>{const p=reference.vertices[id],q=reference.vertices[cycle[(i+1)%cycle.length]];return sum+p.x*q.y-q.x*p.y;},0)/2;
    if(area>1e-5)cycles.push(cycle);
  }
  for(const cycle of cycles)for(const other of cycles){if(cycle===other||cycle.some(id=>other.includes(id)))continue;if(cycle.some(id=>frame.state.topology.added[id])&&inPolygon(reference.vertices[cycle[0]],other.map(id=>reference.vertices[id])))throw Error('A disconnected loop inside another plane needs connecting edges; holes are not inferred automatically.');}
  const originalIds=new Set(BASE_TOPOLOGY.vertices.map(v=>v.id)),affected=new Set<string>();
  for(const face of BASE_TOPOLOGY.faces)if(face.verts.some((id,i)=>frame.state.topology.deletedVertices.includes(id)||frame.state.topology.removeEdges.includes(edgeKey(id,face.verts[(i+1)%face.verts.length]))))affected.add(face.id);
  const addedNeighbors=new Map<string,Set<string>>();for(const edge of frame.state.topology.addEdges){for(const[a,b]of [[edge.a,edge.b],[edge.b,edge.a]]){if(!addedNeighbors.has(a))addedNeighbors.set(a,new Set());addedNeighbors.get(a)!.add(b);}}
  const seen=new Set<string>();for(const start of addedNeighbors.keys()){if(seen.has(start))continue;const pending=[start],component=new Set<string>();while(pending.length){const id=pending.pop()!;if(component.has(id))continue;component.add(id);seen.add(id);for(const next of addedNeighbors.get(id)??[])if(!component.has(next))pending.push(next);}const ends=[...component].filter(id=>originalIds.has(id));if(ends.length>1)for(const face of BASE_TOPOLOGY.faces)if(ends.filter(id=>face.verts.includes(id)).length>1)affected.add(face.id);}
  const preserved=BASE_TOPOLOGY.faces.filter(f=>!affected.has(f.id)&&f.verts.every(id=>frame.vertices[id]));
  const allowed=new Set([...BASE_TOPOLOGY.faces.filter(f=>affected.has(f.id)).flatMap(f=>f.verts),...Object.keys(frame.state.topology.added)]);
  const generated=cycles.filter(cycle=>!preserved.some(f=>f.verts.length===cycle.length&&f.verts.every(id=>cycle.includes(id)))&&cycle.every(id=>allowed.has(id))).map(verts=>{
    const existing=BASE_TOPOLOGY.faces.find(f=>f.verts.length===verts.length&&f.verts.every(id=>verts.includes(id)));
    let hash=2166136261;for(const ch of [...verts].sort().join('|'))hash=Math.imul(hash^ch.charCodeAt(0),16777619);
    return {id:existing?.id??`edited.${(hash>>>0).toString(16)}`,label:existing?.label??'Edited plane',region:existing?.region??frame.vertices[verts[0]].region,verts:[...verts].reverse(),kind:'plane' as const};
  });
  return [...preserved,...generated];
}
