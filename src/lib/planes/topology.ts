export const REGIONS=['cranium','brow','socket','eye','nose','cheek','mouth','chin','jaw','neck'] as const;
export type Region = typeof REGIONS[number];
export type Seed = {tri:[number,number,number];w:[number,number,number];off?:[number,number]} | {sphere:{dir:[number,number,number]}} | {neck:{t:number;theta:number}};
export type PlaneVertex = {id:string;label:string;region:Region;surface:'face'|'cranium'|'neck'|'lid'|'limb';mirror?:string;seed:Seed};
export type PlaneFace = {id:string;label:string;region:Region;verts:string[];kind:'plane'|'band'|'wedge'};
export type PlaneEdge = {a:string;b:string;kind:'ridge'|'contour'|'construction'};
export type PlaneTopology = {version:number;vertices:PlaneVertex[];faces:PlaneFace[];edges:PlaneEdge[]};
export const validVertexId = (id:string) => /^[a-z0-9][a-z0-9.-]{0,63}$/.test(id);

/** Validate recovered/edited data before it is admitted to a session. No canonical topology is invented here. */
export function validateTopology(topology: PlaneTopology): string[] {
  const errors:string[]=[],ids=new Map<string,PlaneVertex>(),faceIds=new Set<string>(),faceSets=new Set<string>(),edges=new Set<string>();
  if(!Number.isInteger(topology.version)||topology.version<1) errors.push('Invalid topology version');
  for(const vertex of topology.vertices) {
    if(!validVertexId(vertex.id)||ids.has(vertex.id)) errors.push(`Invalid or duplicate vertex id: ${vertex.id}`);
    ids.set(vertex.id,vertex);
    if(!vertex.label.trim()||!REGIONS.includes(vertex.region)) errors.push(`Missing vertex label or region: ${vertex.id}`);
    if(!['face','cranium','neck','lid','limb'].includes(vertex.surface)) errors.push(`Invalid vertex surface: ${vertex.id}`);
    const seed=vertex.seed;
    if('tri' in seed) {
      if(seed.tri.length!==3||new Set(seed.tri).size!==3||seed.tri.some(i=>!Number.isInteger(i)||i<0||i>=468)||seed.w.length!==3||!seed.w.every(Number.isFinite)||Math.abs(seed.w.reduce((a,b)=>a+b,0)-1)>1e-6||seed.off&&(seed.off.length!==2||!seed.off.every(Number.isFinite))) errors.push(`Invalid landmark seed: ${vertex.id}`);
    } else if('sphere' in seed) {
      if(seed.sphere.dir.length!==3||!seed.sphere.dir.every(Number.isFinite)||Math.hypot(...seed.sphere.dir)<1e-9) errors.push(`Invalid sphere seed: ${vertex.id}`);
    } else if('neck' in seed) {
      if(!Number.isFinite(seed.neck.t)||!Number.isFinite(seed.neck.theta)) errors.push(`Invalid neck seed: ${vertex.id}`);
    } else errors.push(`Unknown seed: ${vertex.id}`);
  }
  for(const vertex of topology.vertices) if(vertex.mirror&&(vertex.mirror===vertex.id||ids.get(vertex.mirror)?.mirror!==vertex.id)) errors.push(`Nonreciprocal mirror: ${vertex.id}`);
  for(const face of topology.faces) {
    if(!validVertexId(face.id)||faceIds.has(face.id)) errors.push(`Invalid or duplicate face id: ${face.id}`);
    faceIds.add(face.id);
    const key=[...face.verts].sort().join('|');
    if(face.verts.length<3||new Set(face.verts).size!==face.verts.length||face.verts.some(id=>!ids.has(id))||faceSets.has(key)) errors.push(`Invalid or duplicate face: ${face.id}`);
    faceSets.add(key);
    if(!face.label.trim()||!REGIONS.includes(face.region)||!['plane','band','wedge'].includes(face.kind)) errors.push(`Invalid face metadata: ${face.id}`);
  }
  for(const edge of topology.edges) {
    const key=[edge.a,edge.b].sort().join('|');
    if(edge.a===edge.b||!ids.has(edge.a)||!ids.has(edge.b)||edges.has(key)||!['ridge','contour','construction'].includes(edge.kind)) errors.push(`Invalid or duplicate edge: ${key}`);
    edges.add(key);
  }
  return errors;
}
