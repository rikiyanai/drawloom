import test from 'node:test';
import assert from 'node:assert/strict';
import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { fitSimilarity, headFrame } from '../src/lib/planes/register';
import { transform, distance } from '../src/lib/planes/types';
import type { Similarity, Vec3 } from '../src/lib/planes/types';
import { triangleCandidates } from '../src/lib/planes/mesh';
import { validateTopology } from '../src/lib/planes/topology';
import type { PlaneTopology } from '../src/lib/planes/topology';

const points:Vec3[]=Array.from({length:90},(_,i)=>({x:Math.sin(i*1.71),y:Math.cos(i*.39),z:Math.sin(i*.57)*.8}));
function yaw(degrees:number): Similarity {const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return {rotation:[c,0,s,0,1,0,-s,0,c],scale:213,translation:{x:300,y:250,z:45}};}
test('proper 3D similarity recovers scale, depth, translation and yaw across the validation angles',()=>{
  for(const angle of [0,15,39,61,120,180]) {
    const expected=yaw(angle),target=points.map(p=>transform(expected,p)),fit=fitSimilarity(points,target);
    assert.ok(fit.rms<1e-8,`${angle}: ${fit.rms}`);
    assert.ok(Math.abs(fit.scale-expected.scale)<1e-8);
    assert.ok(distance(transform(fit,{x:.13,y:.27,z:-.61}),transform(expected,{x:.13,y:.27,z:-.61}))<1e-8);
  }
});
test('IRLS limits corrupted landmarks without discarding or mutating input observations',()=>{
  const expected=points.map(p=>transform(yaw(61),p)),target=structuredClone(expected);
  for(let i=0;i<8;i++) {target[i].x+=150;target[i].y-=100;target[i].z+=80;}
  const original=JSON.stringify(target),ordinary=fitSimilarity(points,target,{robust:false}),robust=fitSimilarity(points,target);
  const error=(fit:Similarity)=>points.slice(8).reduce((sum,p,i)=>sum+distance(transform(fit,p),expected[i+8]),0)/(points.length-8);
  assert.ok(error(robust)<error(ordinary)*.01);
  assert.equal(JSON.stringify(target),original);
});
test('registration rejects underdetermined or nonfinite input and respects zero weights',()=>{
  assert.throws(()=>fitSimilarity([{x:0,y:0,z:0},{x:1,y:0,z:0},{x:2,y:0,z:0}],points.slice(0,3)),/non-collinear/);
  assert.throws(()=>fitSimilarity(points,points.slice(1)),/matching/);
  assert.throws(()=>fitSimilarity([{x:NaN,y:0,z:0},...points],points),/matching/);
  const target=points.map(p=>transform(yaw(39),p)); target[0]={x:1e6,y:1e6,z:1e6};
  const fit=fitSimilarity(points,target,{weights:points.map((_,i)=>Number(i!==0))});
  assert.ok(fit.median<1e-8);
});
test('rotation remains proper for all axes and does not silently mirror a subject',()=>{
  const expected:Similarity={rotation:[0,0,-1,1,0,0,0,-1,0],scale:.75,translation:{x:-12,y:17,z:4}};
  const fit=fitSimilarity(points,points.map(p=>transform(expected,p)));
  assert.ok(fit.rms<1e-10);
  const reflected=fitSimilarity(points,points.map(p=>({x:-p.x,y:p.y,z:p.z})),{robust:false});
  const r=reflected.rotation;
  const determinant=r[0]*(r[4]*r[8]-r[5]*r[7])-r[1]*(r[3]*r[8]-r[5]*r[6])+r[2]*(r[3]*r[7]-r[4]*r[6]);
  assert.ok(Math.abs(determinant-1)<1e-10);
  assert.ok(reflected.rms>.1);
});
test('head-frame normalization is reversible and does not use iris points as the origin',()=>{
  const face=Array.from({length:478},(_,i)=>({x:i,y:i*2,z:-i/3})),frame=headFrame(face,300);
  assert.ok(Math.abs(frame.origin.x-233.5)<1e-10);
  assert.ok(distance(face[477],{x:frame.landmarks[477].x*frame.size+frame.origin.x,y:frame.landmarks[477].y*frame.size+frame.origin.y,z:frame.landmarks[477].z*frame.size+frame.origin.z})<1e-10);
});
test('tessellation candidates do not depend on edge order, direction or duplicate entries',()=>{
  const edges=FaceLandmarker.FACE_LANDMARKS_TESSELATION,candidates=triangleCandidates(edges);
  assert.equal(candidates.length,854); // Observed count, not a validated 854-face surface.
  const shuffled=[...edges].reverse().map(e=>({start:e.end,end:e.start}));
  assert.deepEqual(triangleCandidates([...shuffled,...edges]),candidates);
  assert.throws(()=>triangleCandidates([{start:0,end:478}]),/Invalid/);
});
function topology():PlaneTopology {return {version:1,vertices:['a','b','c'].map(id=>({id,label:id,region:'eye',surface:'lid',seed:{tri:[1,2,3],w:[1,0,0]}})),faces:[{id:'lid',label:'Lid',region:'eye',verts:['a','b','c'],kind:'band'}],edges:[{a:'a',b:'b',kind:'ridge'}]};}
test('topology rejects lost references, duplicate faces, bad seeds and nonreciprocal mirrors',()=>{
  assert.deepEqual(validateTopology(topology()),[]);
  const invalid=topology(); invalid.vertices[0].mirror='b';invalid.faces.push({...invalid.faces[0],id:'duplicate',verts:['c','b','a']});invalid.edges.push({a:'a',b:'missing',kind:'ridge'});
  invalid.vertices[1].seed={tri:[1,2,3],w:[1,1,1]};
  assert.ok(validateTopology(invalid).some(e=>e.includes('mirror')));
  assert.ok(validateTopology(invalid).some(e=>e.includes('duplicate face')));
  assert.ok(validateTopology(invalid).some(e=>e.includes('edge')));
  assert.ok(validateTopology(invalid).some(e=>e.includes('seed')));
});
