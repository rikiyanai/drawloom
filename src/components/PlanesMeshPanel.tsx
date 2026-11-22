"use client";
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PlanesFrame } from '@/lib/planes/solve';
import { BASE_TOPOLOGY } from '@/lib/planes/reference';
import { REGION_COLORS } from '@/lib/planes/render';
import type { Vec3 } from '@/lib/planes/types';
import { createProceduralSkull } from '@/lib/skull/scene';

const world=(p:Vec3)=>new THREE.Vector3(p.x,-p.y,-p.z);
const head=(p:THREE.Vector3):Vec3=>({x:p.x,y:-p.y,z:-p.z});
type SavedCamera={shot:string;position:THREE.Vector3;target:THREE.Vector3;up:THREE.Vector3;zoom:number};
export function PlanesMeshPanel({frame,selected,selectedFace,normals,onSelect,onFace,onMove}:{frame:PlanesFrame;selected?:string;selectedFace?:string;normals:boolean;onSelect:(id:string)=>void;onFace:(id:string)=>void;onMove:(id:string,p:Vec3)=>void}){
  const canvas=useRef<HTMLCanvasElement>(null),wrap=useRef<HTMLDivElement>(null),cameraState=useRef<SavedCamera|null>(null),callbacks=useRef({onSelect,onFace,onMove});callbacks.current={onSelect,onFace,onMove};
  const [reset,setReset]=useState(0),[error,setError]=useState(''),[proxy,setProxy]=useState(false);
  const lastReset=useRef(0);
  useEffect(()=>{
    if(!canvas.current||!wrap.current)return;
    const element=canvas.current,container=wrap.current;let renderer:THREE.WebGLRenderer;
    try {renderer=new THREE.WebGLRenderer({canvas:element,antialias:true});}catch{setError('The 3D reading view needs WebGL. Photo editing and backups still work.');return;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));renderer.setClearColor(0x101319);
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,100),controls=new OrbitControls(camera,element),bounds=new THREE.Box3().setFromPoints(Object.values(frame.vertices).map(p=>world(p.model))),center=bounds.getCenter(new THREE.Vector3()),extent=bounds.getSize(new THREE.Vector3());
    scene.add(new THREE.AmbientLight(0xffffff,1.6));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(-2,3,4);scene.add(light);
    const view=frame.context.shots[frame.shotId].fit,r=view.rotation,saved=lastReset.current===reset?cameraState.current:null;lastReset.current=reset;
    if(saved&&saved.shot===frame.shotId){camera.position.copy(saved.position);camera.up.copy(saved.up);camera.zoom=saved.zoom;controls.target.copy(saved.target);}
    else {camera.position.copy(center).addScaledVector(world({x:r[6],y:r[7],z:r[8]}),-4);camera.up.copy(world({x:-r[3],y:-r[4],z:-r[5]}));controls.target.copy(center);}
    controls.enableDamping=false;controls.update();
    const clickable:THREE.Object3D[]=[],pointMeshes:THREE.Mesh[]=[];
    for(const face of frame.faces){
      const points=face.verts.map(id=>frame.vertices[id].model),triangles=THREE.ShapeUtils.triangulateShape(points.map(p=>new THREE.Vector2(p.x,p.y)),[]);
      const coordinates=triangles.flatMap(t=>t.flatMap(i=>world(points[i]).toArray()));
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(coordinates,3));geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:face.id===selectedFace?'#ffffff':face.visible?REGION_COLORS[face.region]:'#697484',transparent:true,opacity:face.id===selectedFace?.7:.28,side:THREE.DoubleSide,flatShading:true}));mesh.userData.face=face.id;scene.add(mesh);clickable.push(mesh);
      if(normals){const c=points.reduce<THREE.Vector3>((a,p)=>a.add(world(p)),new THREE.Vector3()).divideScalar(points.length);scene.add(new THREE.ArrowHelper(world(face.normal).normalize(),c,.1,0xffdd88,.025,.012));}
    }
    for(const edge of frame.edges){const a=frame.vertices[edge.a],b=frame.vertices[edge.b];const geometry=new THREE.BufferGeometry().setFromPoints([world(a.model),world(b.model)]);scene.add(new THREE.Line(geometry,new THREE.LineBasicMaterial({color:[edge.a,edge.b].includes(selected??'')?'#ffffff':REGION_COLORS[a.region]})));}
    const graphIds=new Set([...BASE_TOPOLOGY.vertices.map(v=>v.id),...Object.keys(frame.state.topology.added)]);
    for(const p of Object.values(frame.vertices).filter(p=>graphIds.has(p.id)||p.id===selected)){const marker=new THREE.Mesh(new THREE.SphereGeometry(p.id===selected?.011:.0065,8,6),new THREE.MeshBasicMaterial({color:p.id===selected?'#ffffff':p.visibility==='visible'?REGION_COLORS[p.region]:'#76818d',depthTest:false}));marker.position.copy(world(p.model));marker.userData.vertex=p.id;marker.renderOrder=10;scene.add(marker);pointMeshes.push(marker);}
    const source=frame.context.landmarks,triangles=frame.context.triangles;
    const surface=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));surface.geometry.setAttribute('position',new THREE.Float32BufferAttribute(triangles.flatMap(t=>t.flatMap(i=>world(source[i]).toArray())),3));scene.add(surface);
    const ball=new THREE.Mesh(new THREE.SphereGeometry(frame.primitives.sphere.radius,24,16),new THREE.MeshBasicMaterial({transparent:true,opacity:.06,wireframe:true,depthWrite:false}));ball.position.copy(world(frame.primitives.sphere.center));scene.add(ball);
    const neck=frame.primitives.neck,top=world(neck.top),bottom=world(neck.bottom),axis=bottom.clone().sub(top),cylinder=new THREE.Mesh(new THREE.CylinderGeometry(neck.radius,neck.radius,axis.length(),24,1,true),new THREE.MeshBasicMaterial({transparent:true,opacity:.04,wireframe:true,side:THREE.DoubleSide}));cylinder.position.copy(top).add(bottom).multiplyScalar(.5);cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),axis.normalize());scene.add(cylinder);
    if(proxy){const skull=createProceduralSkull();skull.position.copy(world(frame.primitives.sphere.center));skull.scale.setScalar(frame.primitives.sphere.radius);skull.traverse(node=>{if(node instanceof THREE.Mesh){const materials=Array.isArray(node.material)?node.material:[node.material];for(const material of materials){material.transparent=true;material.opacity=.12;material.depthWrite=false;}}});scene.add(skull);}
    let scheduled=0,disposed=false;
    const render=()=>{if(!scheduled&&!disposed)scheduled=requestAnimationFrame(()=>{scheduled=0;if(!disposed){renderer.render(scene,camera);if(selected&&frame.vertices[selected]){const q=world(frame.vertices[selected].model).project(camera);element.dataset.selectedPoint=selected;element.dataset.selectedX=String((q.x+1)*element.clientWidth/2);element.dataset.selectedY=String((1-q.y)*element.clientHeight/2);}else delete element.dataset.selectedPoint;}});};
    const resize=()=>{const width=container.clientWidth,height=420,aspect=width/height;const half=Math.max(1.4,extent.y*1.15,extent.x/aspect*1.15)/2;camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(width,height,false);render();};
    controls.addEventListener('change',render);const observer=new ResizeObserver(resize);observer.observe(container);resize();
    const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let drag:{id:string;marker:THREE.Mesh;original:THREE.Vector3;position?:THREE.Vector3}|null=null,down:{x:number;y:number}|null=null;
    const aim=(event:PointerEvent)=>{const rect=element.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);};
    const start=(event:PointerEvent)=>{aim(event);down={x:event.clientX,y:event.clientY};const hits=ray.intersectObjects(pointMeshes),hit=hits.find(item=>item.object.userData.vertex===selected)??hits[0];if(hit&&graphIds.has(hit.object.userData.vertex)){const marker=hit.object as THREE.Mesh;drag={id:marker.userData.vertex,marker,original:marker.position.clone()};controls.enabled=false;element.setPointerCapture(event.pointerId);}};
    const move=(event:PointerEvent)=>{if(!drag)return;aim(event);const definition=BASE_TOPOLOGY.vertices.find(v=>v.id===drag!.id),target=definition?.surface==='cranium'?ball:['neck','limb'].includes(definition?.surface??'')?cylinder:surface,hit=ray.intersectObject(target)[0];if(hit){drag.marker.position.copy(hit.point);drag.position=hit.point.clone();render();}};
    const end=(event:PointerEvent)=>{if(drag){const current=drag;drag=null;controls.enabled=true;callbacks.current.onSelect(current.id);if(current.position&&current.position.distanceTo(current.original)>1e-5)callbacks.current.onMove(current.id,head(current.position));}else if(down&&Math.hypot(event.clientX-down.x,event.clientY-down.y)<4){aim(event);const hit=ray.intersectObjects(clickable)[0];if(hit)callbacks.current.onFace(hit.object.userData.face);}down=null;};
    const cancel=()=>{if(drag){drag.marker.position.copy(drag.original);drag=null;render();}controls.enabled=true;down=null;};
    element.addEventListener('pointerdown',start);element.addEventListener('pointermove',move);element.addEventListener('pointerup',end);element.addEventListener('pointercancel',cancel);
    return ()=>{cameraState.current={shot:frame.shotId,position:camera.position.clone(),up:camera.up.clone(),target:controls.target.clone(),zoom:camera.zoom};disposed=true;cancelAnimationFrame(scheduled);observer.disconnect();controls.dispose();element.removeEventListener('pointerdown',start);element.removeEventListener('pointermove',move);element.removeEventListener('pointerup',end);element.removeEventListener('pointercancel',cancel);scene.traverse(node=>{if(node instanceof THREE.Mesh||node instanceof THREE.Line){node.geometry.dispose();for(const material of Array.isArray(node.material)?node.material:[node.material])material.dispose();}});renderer.dispose();};
  },[frame,selected,selectedFace,normals,proxy,reset]);
  return <div className="rounded-xl border border-zinc-700 bg-zinc-950 overflow-hidden"><div className="p-3 flex gap-3 flex-wrap items-center text-sm"><strong>3D reading view</strong><button className="rounded border border-zinc-600 px-2 py-1" onClick={()=>{cameraState.current=null;setReset(x=>x+1);}}>Snap to capture</button><label><input type="checkbox" checked={proxy} onChange={e=>setProxy(e.target.checked)}/> Skull proxy</label></div><div ref={wrap}><canvas ref={canvas} className="block w-full h-[420px] touch-none" aria-label="Rotatable construction mesh"/></div><p className="px-3 pb-3 text-sm text-zinc-400">{error||'Orbit to read hidden surfaces. Grey planes are partly hidden, edge-on or uncertain in the active photo. The skull proxy is unregistered reference geometry.'}</p></div>;
}
