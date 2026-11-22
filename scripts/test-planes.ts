import test from 'node:test';
import assert from 'node:assert/strict';
import { FaceLandmarker } from '@mediapipe/tasks-vision';
import { fitSimilarity, headFrame } from '../src/lib/planes/register';
import { transform, distance } from '../src/lib/planes/types';
import type { Similarity, Vec3 } from '../src/lib/planes/types';
import { triangleCandidates } from '../src/lib/planes/mesh';
import { validateTopology } from '../src/lib/planes/topology';
import type { PlaneTopology } from '../src/lib/planes/topology';
import { readFileSync } from 'node:fs';
import { surfaceTriangles } from '../src/lib/planes/mesh';
import { headContext, initializePlanes, solveFrame, BASE_TOPOLOGY } from '../src/lib/planes/solve';
import { setPin, normalizePin, parsePlanes, deleteVertex } from '../src/lib/planes/state';
import { serializeBackup, parseBackup } from '../src/lib/capture/backup';
import { addPoint, removeLine } from '../src/lib/planes/edit';
import type { StudySession } from '../src/lib/capture/study-store';
import { fitNeck, neckSides } from '../src/lib/planes/neck';

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

const recovered=JSON.parse(readFileSync('scripts/fixtures/planes-registration.json','utf8'));
function session():StudySession {
  const shots:StudySession['shots']={};
  for(const f of recovered.frames){const l:Vec3[]=f.landmarks,x=l.map(p=>p.x),y=l.map(p=>p.y),left=Math.min(...x),right=Math.max(...x),top=Math.min(...y),bottom=Math.max(...y);shots[`frame-${f.id}`]={dataUrl:'data:image/png;base64,AAAA',capturedAt:1,...f.angles,pose:{landmarks:l,angles:f.angles,matrix:[],blendShapes:{},bbox:{cx:(left+right)/2,cy:(top+bottom)/2,size:Math.max(right-left,bottom-top)},imageWidth:1024,imageHeight:1820}};}
  return {id:'reference',name:'Reference',shots,order:Object.keys(shots),layout:'grid'};
}
test('V1 reproduces the recovered real-capture residuals and surface excludes the two internal nose bases',()=>{
  const baseline=[2.6,8.1,11.4];
  for(const [i,f]of recovered.frames.slice(1).entries()){const fit=fitSimilarity(recovered.frames[0].landmarks,f.landmarks,{robust:false});assert.ok(Math.abs(fit.median-baseline[i])/baseline[i]<.1);}
  const faces=surfaceTriangles(FaceLandmarker.FACE_LANDMARKS_TESSELATION,recovered.frames[0].landmarks);
  assert.equal(faces.length,852);assert.ok(!faces.some(f=>[49,64,129].every(id=>f.includes(id))));
  assert.deepEqual(validateTopology(BASE_TOPOLOGY),[]);
});
test('photo pins are exact, a turned-view correction never moves the front, and evaluation can hold a view out',()=>{
  const s=session(),context=headContext(s),initial=initializePlanes(context),front=solveFrame(context,initial,context.refShotId);
  const id='cbl',shot='frame-0007',point={x:431.234,y:984.567};
  const corrected=setPin(initial,shot,id,normalizePin(point,s.shots[shot].pose!));
  const frame=solveFrame(context,corrected,shot),after=solveFrame(context,corrected,context.refShotId);
  for(const row of frame.canon){assert.ok(Number.isFinite(row.measured));if(row.canon!==undefined)assert.ok(Number.isFinite(row.delta),'convention measurements include their display difference');}
  assert.ok(Math.hypot(frame.vertices[id].x-point.x,frame.vertices[id].y-point.y)<1e-8);
  assert.equal(after.vertices[id].x,front.vertices[id].x);assert.equal(after.vertices[id].y,front.vertices[id].y);
  assert.ok(solveFrame(context,corrected,shot,shot).vertices[id].observed); // saved work is retained for reporting
  assert.ok(Math.hypot(solveFrame(context,corrected,shot,shot).vertices[id].x-point.x,solveFrame(context,corrected,shot,shot).vertices[id].y-point.y)>1);
});
test('backup version 2 preserves pins, topology, 3D edits, notes and orphan IDs; version 1 remains readable',()=>{
  const s=session(),context=headContext(s),state=initializePlanes(context);state.observations[context.refShotId]={'old.orphan':{x:.1,y:.2,at:1}};state.surfaceEdits.cbl={x:.1,y:.2,z:.3};state.notes[context.refShotId]={shot:'review',points:{cbl:'chin'}};
  const id='u.test';state.topology.added[id]={id,label:'Chin addition',region:'chin',position:{x:.1,y:.2,z:.3}};state.topology.addEdges.push({a:'cbl',b:id,kind:'ridge'});
  const backup=serializeBackup({...s,planes:state});assert.equal(JSON.parse(backup).version,2);assert.deepEqual(parseBackup(backup).planes,state);
  assert.equal(JSON.parse(serializeBackup(s)).version,1);assert.equal(parseBackup(serializeBackup(s)).planes,undefined);
  const malformed=structuredClone(state);malformed.observations[context.refShotId].cbl={x:Infinity,y:0,at:1};assert.throws(()=>parsePlanes(malformed,s.order),/invalid planes/);
});
test('splitting an edge preserves every pinned view and deletion is atomic and undoable by snapshot',()=>{
  const s=session(),c=headContext(s),state=initializePlanes(c),frames=s.order.map(id=>solveFrame(c,state,id)),frame=frames[0],edge=frame.edges[0],a=frame.vertices[edge.a],b=frame.vertices[edge.b];
  const split=addPoint(state,frame,{x:(a.x+b.x)/2,y:(a.y+b.y)/2},frames,edge),id=Object.keys(split.topology.added)[0];
  for(const before of frames){const after=solveFrame(c,split,before.shotId);assert.ok(Math.hypot(after.vertices[id].x-(before.vertices[edge.a].x+before.vertices[edge.b].x)/2,after.vertices[id].y-(before.vertices[edge.a].y+before.vertices[edge.b].y)/2)<.2);}
  assert.ok(!solveFrame(c,split,frame.shotId).edges.some(e=>e.a===edge.a&&e.b===edge.b));
  const snapshot=structuredClone(split),deleted=deleteVertex(split,id);assert.equal(deleted.topology.added[id],undefined);assert.ok(Object.values(deleted.observations).every(p=>!p[id]));assert.deepEqual(split,snapshot);
  assert.ok(removeLine(state,edge.a,edge.b).topology.removeEdges.length);
});
test('cylinder limb observations are view-dependent silhouettes rather than fixed 3D correspondences',()=>{
  const s=session(),c=headContext(s),state=initializePlanes(c),target={top:{x:0,y:.3,z:.15},bottom:{x:.04,y:.9,z:.22},radius:.19};
  for(const[viewIndex,shot]of s.order.entries()){
    const sides=neckSides(c,shot,target),fit=c.shots[shot].fit,pose=c.shots[shot].pose;
    for(const[id,key]of Object.entries({nkl0:'leftTop',nkr0:'rightTop',nkl1:'leftBottom',nkr1:'rightBottom'}))state.observations[shot]={...state.observations[shot],[id]:normalizePin(transform(fit,sides[key as keyof typeof sides]),pose)};
    for(const[left,id]of [[true,'nkl'],[false,'nkr']] as const){const a=left?sides.leftTop:sides.rightTop,b=left?sides.leftBottom:sides.rightBottom,t=.15+viewIndex*.23;state.observations[shot][id]=normalizePin(transform(fit,{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t}),pose);}
  }
  const fitted=fitNeck(c,state,{top:{x:.04,y:.34,z:.12},bottom:{x:0,y:.94,z:.19},radius:.23});
  assert.ok(distance(fitted.top,target.top)<.015);assert.ok(distance(fitted.bottom,target.bottom)<.015);assert.ok(Math.abs(fitted.radius-target.radius)<.01);
});
