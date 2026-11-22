export type Triangle = [number, number, number];
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
