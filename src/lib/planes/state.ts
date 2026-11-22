import type { Vec3 } from './types';
import type { Region, PlaneEdge } from './topology';
import { REGIONS, validVertexId } from './topology';
import type { PoseResult } from '../pose/detect';

export type Pin={x:number;y:number;at:number};
export type AddedVertex={id:string;label:string;region:Region;position:Vec3};
export type HeadPlanesState={
  version:1;topologyVersion:number;refShotId:string;
  front:Record<string,Pin>;
  observations:Record<string,Record<string,Pin>>;
  notes:Record<string,{shot?:string;points?:Record<string,string>}>;
  topology:{added:Record<string,AddedVertex>;addEdges:PlaneEdge[];removeEdges:string[];deletedVertices:string[]};
  surfaceEdits:Record<string,Vec3>;
  hiddenLabels:Record<string,string[]>;
  reviewedShots:string[];
};
export const edgeKey=(a:string,b:string)=>[a,b].sort().join('|');
export function emptyPlanes(refShotId:string,front:Record<string,Pin>={}):HeadPlanesState {
  return {version:1,topologyVersion:1,refShotId,front,observations:{},notes:{},topology:{added:{},addEdges:[],removeEdges:[],deletedVertices:[]},surfaceEdits:{},hiddenLabels:{},reviewedShots:[]};
}
export function normalizePin(p:{x:number;y:number},pose:NonNullable<PoseResult>,at=Date.now()):Pin {return {x:(p.x-pose.bbox.cx)/pose.bbox.size,y:(p.y-pose.bbox.cy)/pose.bbox.size,at};}
export function pinPixels(pin:Pin,pose:NonNullable<PoseResult>) {return {x:pin.x*pose.bbox.size+pose.bbox.cx,y:pin.y*pose.bbox.size+pose.bbox.cy};}
export function setPin(state:HeadPlanesState,shot:string,id:string,pin:Pin):HeadPlanesState {return {...state,observations:{...state.observations,[shot]:{...state.observations[shot],[id]:pin}}};}
export function clearPin(state:HeadPlanesState,shot:string,id:string):HeadPlanesState {const next=structuredClone(state);delete next.observations[shot]?.[id];return next;}
export function deleteVertex(state:HeadPlanesState,id:string):HeadPlanesState {
  const next=structuredClone(state);
  if(next.topology.added[id])delete next.topology.added[id];
  else if(!next.topology.deletedVertices.includes(id))next.topology.deletedVertices.push(id);
  next.topology.addEdges=next.topology.addEdges.filter(e=>e.a!==id&&e.b!==id);
  for(const points of Object.values(next.observations))delete points[id];
  for(const notes of Object.values(next.notes))if(notes.points)delete notes.points[id];
  delete next.surfaceEdits[id];delete next.front[id];
  return next;
}

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const bounded=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=10;
function checkPin(v:unknown):v is Pin {return object(v)&&bounded(v.x)&&bounded(v.y)&&typeof v.at==='number'&&Number.isFinite(v.at);}
function checkPosition(v:unknown):v is Vec3 {return object(v)&&bounded(v.x)&&bounded(v.y)&&bounded(v.z);}
function note(v:unknown):v is string {return typeof v==='string'&&v.length<=500;}
/** Rebuild only known fields, preserving every valid saved pin and orphan ID. */
export function parsePlanes(value:unknown,shotIds:string[]):HeadPlanesState {
  const fail=()=>{throw new Error('The backup has invalid planes data.');};
  if(!object(value)||value.version!==1||!Number.isInteger(value.topologyVersion)||typeof value.refShotId!=='string'||!shotIds.includes(value.refShotId))return fail();
  const result=emptyPlanes(value.refShotId);result.topologyVersion=value.topologyVersion as number;
  function pins(v:unknown):Record<string,Pin> {
    if(!object(v)||Object.keys(v).length>400)return fail();
    const out:Record<string,Pin>={};
    for(const[id,p]of Object.entries(v)){if(!validVertexId(id)||!checkPin(p))return fail();out[id]={x:p.x,y:p.y,at:p.at};}
    return out;
  }
  result.front=pins(value.front);
  if(!object(value.observations)||!object(value.notes)||!object(value.topology)||!object(value.surfaceEdits)||!object(value.hiddenLabels))return fail();
  for(const[shot,p]of Object.entries(value.observations)){if(!shotIds.includes(shot))return fail();result.observations[shot]=pins(p);}
  let noteBytes=0;
  for(const[shot,n]of Object.entries(value.notes)){
    if(!shotIds.includes(shot)||!object(n)||n.shot!==undefined&&!note(n.shot)||n.points!==undefined&&!object(n.points))return fail();
    const points:Record<string,string>={};
    if(n.points)for(const[id,text]of Object.entries(n.points)){if(!validVertexId(id)||!note(text))return fail();points[id]=text;noteBytes+=new TextEncoder().encode(text).length;}
    noteBytes+=new TextEncoder().encode((n.shot as string)??'').length;
    result.notes[shot]={...(n.shot!==undefined?{shot:n.shot as string}:{}),points};
  }
  if(noteBytes>100000)return fail();
  const topology=value.topology;
  if(!object(topology.added)||Object.keys(topology.added).length>400||!Array.isArray(topology.addEdges)||topology.addEdges.length>1600||!Array.isArray(topology.removeEdges)||topology.removeEdges.length>1600||!Array.isArray(topology.deletedVertices)||topology.deletedVertices.length>400)return fail();
  for(const[id,v]of Object.entries(topology.added)){
    if(!validVertexId(id)||!object(v)||v.id!==id||typeof v.label!=='string'||!v.label.trim()||v.label.length>120||!REGIONS.includes(v.region as Region)||!checkPosition(v.position))return fail();
    result.topology.added[id]={id,label:v.label,region:v.region as Region,position:{...v.position}};
  }
  for(const edge of topology.addEdges){if(!object(edge)||typeof edge.a!=='string'||typeof edge.b!=='string'||!validVertexId(edge.a)||!validVertexId(edge.b)||edge.a===edge.b||!['ridge','contour','construction'].includes(edge.kind as string))return fail();result.topology.addEdges.push({a:edge.a,b:edge.b,kind:edge.kind as PlaneEdge['kind']});}
  for(const key of topology.removeEdges){if(typeof key!=='string'||key.split('|').length!==2||!key.split('|').every(validVertexId))return fail();result.topology.removeEdges.push(key);}
  for(const id of topology.deletedVertices){if(typeof id!=='string'||!validVertexId(id))return fail();result.topology.deletedVertices.push(id);}
  if(Object.keys(value.surfaceEdits).length>400)return fail();
  for(const[id,p]of Object.entries(value.surfaceEdits)){if(!validVertexId(id)||!checkPosition(p))return fail();result.surfaceEdits[id]={...p};}
  for(const[shot,ids]of Object.entries(value.hiddenLabels)){if(!shotIds.includes(shot)||!Array.isArray(ids)||ids.length>400||ids.some(id=>typeof id!=='string'||!validVertexId(id)))return fail();result.hiddenLabels[shot]=[...new Set(ids as string[])];}
  if(value.reviewedShots!==undefined){if(!Array.isArray(value.reviewedShots)||value.reviewedShots.length>12||value.reviewedShots.some(id=>typeof id!=='string'||!shotIds.includes(id)))return fail();result.reviewedShots=[...new Set(value.reviewedShots as string[])];}
  return result;
}
