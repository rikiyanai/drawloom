export type Triangle = [number, number, number];
import type { Vec3 } from './types';
/** Deterministic candidates, not an approved surface. M0 must review their count and winding. */
export function triangleCandidates(edges: readonly {start:number;end:number}[], vertexCount=468): Triangle[] {
  const neighbors=Array.from({length:vertexCount},()=>new Set<number>());
  for(const {start,end} of edges) {
    if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<0||start>=vertexCount||end>=vertexCount||start===end) throw new Error('Invalid tessellation edge');
    neighbors[start].add(end); neighbors[end].add(start);
  }
  const triangles: Triangle[]=[];
  for(let a=0;a<vertexCount;a++) for(const b of [...neighbors[a]].sort((x,y)=>x-y)) if(b>a) {
    for(const c of [...neighbors[b]].sort((x,y)=>x-y)) if(c>b&&neighbors[a].has(c)) triangles.push([a,b,c]);
  }
  return triangles;
}

/** Remove the enclosing cycles of degree-three subdivisions, then orient the
 * facial sheet toward the reference camera (image y down, camera along +z).
 * For the pinned MediaPipe graph, 102 and 331 subdivide the two enclosing nose
 * triangles. Keeping those bases would create internal double surfaces. */
export function surfaceTriangles(edges:readonly {start:number;end:number}[], reference:Vec3[]):Triangle[] {
  if(reference.length<468)throw new Error('A facial surface needs 468 reference landmarks');
  const candidates=triangleCandidates(edges);
  const neighbors=Array.from({length:468},()=>new Set<number>());
  for(const {start,end} of edges) { if(start<468&&end<468) {neighbors[start].add(end);neighbors[end].add(start);} }
  return candidates.filter(t=>![...neighbors[t[0]]].some(v=>neighbors[v].size===3&&t.every(i=>neighbors[v].has(i)))).map(t=>{
    const [a,b,c]=t.map(i=>reference[i]);
    return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)>0?[t[0],t[2],t[1]]:t;
  });
}

export function barycentric(p:{x:number;y:number},a:Vec3,b:Vec3,c:Vec3):[number,number,number]|null {
  const den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
  if(Math.abs(den)<1e-12)return null;
  const u=((b.y-c.y)*(p.x-c.x)+(c.x-b.x)*(p.y-c.y))/den;
  const v=((c.y-a.y)*(p.x-c.x)+(a.x-c.x)*(p.y-c.y))/den;
  return [u,v,1-u-v];
}
