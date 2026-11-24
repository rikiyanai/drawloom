import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { BASE_TOPOLOGY, pointVisibility, type PlanesFrame } from '../planes/solve';
import { add, cross, dot, mul, normal, sub, unit } from '../planes/geometry';
import type { Vec3 } from '../planes/types';

/** Canonical winding is retained from the pinned MediaPipe graph. Reorienting
 * every triangle toward a turned reference image would make its hidden cheek
 * front-facing and create an interior "second jaw". */
export function canonicalSurfaceNormals(frame:PlanesFrame):Vec3[]{
 const normals=frame.context.landmarks.map(()=>({x:0,y:0,z:0})),edges=FaceLandmarker.FACE_LANDMARKS_TESSELATION;
 for(let i=0;i+2<edges.length;i+=3){
  const a=edges[i],b=edges[i+1],c=edges[i+2];
  if(a.end!==b.start||b.end!==c.start||c.end!==a.start)throw Error('The pinned facial surface lost its oriented triangle grouping.');
  const ids=[a.start,a.end,b.end],points=ids.map(id=>frame.context.landmarks[id]);
  const n=unit(cross(sub(points[1],points[0]),sub(points[2],points[0])));
  for(const id of ids)normals[id]=add(normals[id],n);
 }
 return normals.map(unit);
}

/** A consumer-side visibility projection of the fitted construction. Geometry
 * and authored pins are not changed; only normal orientation and the resulting
 * facing/depth classification are corrected before structural selection. */
export function surfaceVisibilityFrame(frame:PlanesFrame):PlanesFrame{
 const normals=canonicalSurfaceNormals(frame),definitions=new Map(BASE_TOPOLOGY.vertices.map(v=>[v.id,v]));
 const vertices={...frame.vertices};
 for(const[id,vertex]of Object.entries(frame.vertices)){
  const definition=definitions.get(id);if(!definition)continue;
  const seed=definition.seed;
  const n='tri'in seed?unit(seed.tri.reduce((sum,index,k)=>add(sum,mul(normals[index],seed.w[k])),{x:0,y:0,z:0})):vertex.normal;
  vertices[id]={...vertex,normal:n,visibility:pointVisibility(frame.context,frame.shotId,vertex.model,n,definition.surface,frame.primitives.sphere)};
 }
 const faces=frame.faces.map(face=>{
  let n=normal(face.verts.map(id=>vertices[id].model));
  const reference=unit(face.verts.reduce((sum,id)=>add(sum,vertices[id].normal),{x:0,y:0,z:0}));
  if(dot(n,reference)<0)n=mul(n,-1);
  return {...face,normal:n,yaw:Math.atan2(dot(n,frame.context.right),-dot(n,frame.context.back))*180/Math.PI,pitch:Math.atan2(-dot(n,frame.context.up),Math.hypot(dot(n,frame.context.right),dot(n,frame.context.back)))*180/Math.PI,visible:face.verts.some(id=>['visible','grazing'].includes(vertices[id].visibility))};
 });
 return {...frame,vertices,faces};
}

export function surfaceSampleVisibility(frame:PlanesFrame,position:Vec3,n:Vec3,surface='face'){return pointVisibility(frame.context,frame.shotId,position,n,surface,frame.primitives.sphere);}
