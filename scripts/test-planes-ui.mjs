import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const endpoint=process.argv[2]??'http://127.0.0.1:3000/drawloom/',supplied=process.argv[3];
const fixture=JSON.parse(await readFile('scripts/fixtures/planes-registration.json','utf8'));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1100},acceptDownloads:true});
const errors=[];page.on('pageerror',e=>errors.push(e.stack??e.message));
async function stored(){return page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('drawloom-studies',1);r.onsuccess=()=>{const db=r.result,q=db.transaction('state').objectStore('state').get('studies');q.onsuccess=()=>{db.close();resolve(q.result.sessions.find(s=>s.id===q.result.activeId));};q.onerror=()=>reject(q.error);};r.onerror=()=>reject(r.error);}));}
async function waitSave(){await page.waitForFunction(async()=>{const request=indexedDB.open('drawloom-studies',1);const saved=await new Promise(resolve=>{request.onsuccess=()=>{const db=request.result,r=db.transaction('state').objectStore('state').get('studies');r.onsuccess=()=>{db.close();resolve(r.result);};};});return !!saved?.sessions.find(s=>s.id===saved.activeId)?.planes;});}
const pointLocator=id=>page.locator(`[data-point="${id}"]`);
async function dragPoint(id,dx=8,dy=5){
  const handle=pointLocator(id);await handle.scrollIntoViewIfNeeded();const box=await handle.boundingBox();assert.ok(box,'point handle exists');const before={x:Number(await handle.getAttribute('cx')),y:Number(await handle.getAttribute('cy'))},svg=await page.getByLabel('Editable head construction').boundingBox();const viewBox=await page.getByLabel('Editable head construction').getAttribute('viewBox'),width=Number(viewBox.split(' ')[2]);
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+dx,box.y+box.height/2+dy,{steps:4});await page.mouse.up();
  const expected={x:before.x+dx*width/svg.width,y:before.y+dy*width/svg.width};
  await page.waitForFunction(({id,x,y})=>{const e=document.querySelector(`[data-point="${id}"]`);return e&&Math.hypot(Number(e.getAttribute('cx'))-x,Number(e.getAttribute('cy'))-y)<.2;},{id,...expected});return expected;
}
try {
  await page.goto(endpoint,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Study board',exact:true}).click();
  let backup=supplied?await readFile(supplied,'utf8'):await page.evaluate(({frames})=>{
    const shots={};for(const f of frames){const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1820;const ctx=canvas.getContext('2d');ctx.fillStyle='#b9babd';ctx.fillRect(0,0,1024,1820);ctx.strokeStyle='#343a46';ctx.lineWidth=3;ctx.beginPath();for(const p of f.landmarks){ctx.moveTo(p.x+2,p.y);ctx.arc(p.x,p.y,2,0,Math.PI*2);}ctx.stroke();
      const xs=f.landmarks.map(p=>p.x),ys=f.landmarks.map(p=>p.y),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);shots[`frame-${f.id}`]={dataUrl:canvas.toDataURL('image/jpeg'),capturedAt:1,...f.angles,pose:{landmarks:f.landmarks,angles:f.angles,matrix:[],blendShapes:{},bbox:{cx:(left+right)/2,cy:(top+bottom)/2,size:Math.max(right-left,bottom-top)},imageWidth:1024,imageHeight:1820}};}
    return JSON.stringify({format:'drawloom-study',version:1,session:{name:'Planes UI check',shots,order:Object.keys(shots),layout:'grid'}});
  },fixture);
  await page.getByLabel('Study backup file').setInputFiles({name:'study.json',mimeType:'application/json',buffer:Buffer.from(backup)});
  const start=page.getByRole('button',{name:'Start experimental construction',exact:true});await page.getByTestId('planes-editor').or(start).first().waitFor();if(await start.isVisible())await start.click();
  await page.getByTestId('planes-editor').waitFor();await waitSave();
  const baseline=await stored();assert.ok(baseline.planes);const first=baseline.order[0];
  // Prominent, pointer-centered zoom and canvas pan remain separate from pinning.
  const plus=page.getByRole('button',{name:'Zoom in',exact:true});for(let i=0;i<3;i++)await plus.click();
  const id=await page.locator('[data-point]').evaluateAll(nodes=>nodes.find(n=>n.getAttribute('pointer-events')==='all'&&!n.getAttribute('data-point').startsWith('iris')&&n.getAttribute('data-point').startsWith('br'))?.getAttribute('data-point'));
  assert.ok(id,'a named visible brow handle can be edited');
  const original={x:Number(await pointLocator(id).getAttribute('cx')),y:Number(await pointLocator(id).getAttribute('cy'))};
  const exact=await dragPoint(id);await page.getByRole('button',{name:'Undo',exact:true}).click();assert.ok(Math.abs(Number(await pointLocator(id).getAttribute('cx'))-original.x)<.2);await page.getByRole('button',{name:'Redo',exact:true}).click();
  assert.ok(Math.abs(Number(await pointLocator(id).getAttribute('cx'))-exact.x)<.2);
  await page.getByLabel('Point note',{exact:true}).fill('A note stays with this exact pin.');await page.getByLabel('Capture note',{exact:true}).fill('Capture review.');
  await page.getByLabel('Capture note',{exact:true}).press('a');assert.equal(await page.getByRole('button',{name:'Move (V)',exact:true}).getAttribute('aria-pressed'),'true');
  await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'Study board',exact:true}).click();await page.getByTestId('planes-editor').waitFor();
  assert.ok(Math.hypot(Number(await pointLocator(id).getAttribute('cx'))-exact.x,Number(await pointLocator(id).getAttribute('cy'))-exact.y)<.2);
  assert.equal((await stored()).planes.notes[first].points[id],'A note stays with this exact pin.');
  // Topology edits, names and undo affect the same durable document.
  await page.getByRole('button',{name:'Fit',exact:true}).click();await page.getByRole('button',{name:'Add point (A)',exact:true}).click();
  const edge=await page.locator('[data-edge]').evaluateAll(edges=>edges.map(e=>({id:e.getAttribute('data-edge'),len:e.getTotalLength()})).sort((a,b)=>b.len-a.len)[0]?.id);assert.ok(edge);
  const edgeElement=page.locator(`[data-edge="${edge}"]`);await edgeElement.scrollIntoViewIfNeeded();const midpoint=await edgeElement.evaluate(e=>{const p=e.getPointAtLength(e.getTotalLength()/2),q=new DOMPoint(p.x,p.y).matrixTransform(e.getScreenCTM());return {x:q.x,y:q.y};});
  const beforeAdded=Object.keys((await stored()).planes.topology.added);await page.mouse.click(midpoint.x,midpoint.y);
  await page.getByLabel('New point name',{exact:true}).waitFor();await page.getByLabel('New point name',{exact:true}).fill('Added construction corner');
  const afterAdded=await stored(),added=Object.keys(afterAdded.planes.topology.added).find(id=>!beforeAdded.includes(id));assert.ok(added);assert.ok(afterAdded.planes.topology.removeEdges.includes(edge));
  await page.getByRole('button',{name:'Delete point',exact:true}).click();await page.getByRole('button',{name:'Undo',exact:true}).click();assert.ok((await stored()).planes.topology.added[added]);
  // Free orbit must not change the active photo; snap restores its reading pose.
  await page.getByRole('button',{name:'Move (V)',exact:true}).click();await page.getByRole('button',{name:'Fit',exact:true}).click();
  const canvas=page.getByLabel('Rotatable construction mesh');await canvas.scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(requestAnimationFrame));const beforeOrbit=await canvas.screenshot(),box=await canvas.boundingBox();await page.mouse.move(box.x+20,box.y+30);await page.mouse.down();await page.mouse.move(box.x+90,box.y+60,{steps:5});await page.mouse.up();await page.evaluate(()=>new Promise(requestAnimationFrame));assert.notDeepEqual(await canvas.screenshot(),beforeOrbit);
  assert.equal((await stored()).planes.refShotId,baseline.planes.refShotId);await page.getByRole('button',{name:'Snap to capture',exact:true}).click();await page.evaluate(()=>new Promise(requestAnimationFrame));
  // The selected point can be moved on the 3D surface without moving its photo pin.
  await page.locator(`[data-select-point="${id}"]`).click();await canvas.scrollIntoViewIfNeeded();await page.waitForFunction(id=>document.querySelector('[aria-label="Rotatable construction mesh"]').dataset.selectedPoint===id,id);
  const selected3d=await canvas.evaluate(e=>({x:Number(e.dataset.selectedX),y:Number(e.dataset.selectedY)})),meshBox=await canvas.boundingBox();
  await page.mouse.move(meshBox.x+selected3d.x,meshBox.y+selected3d.y);await page.mouse.down();await page.mouse.move(meshBox.x+selected3d.x+12,meshBox.y+selected3d.y+5,{steps:4});await page.mouse.up();
  await page.waitForFunction(async id=>{const db=await new Promise(resolve=>{const r=indexedDB.open('drawloom-studies',1);r.onsuccess=()=>resolve(r.result);});const value=await new Promise(resolve=>{const r=db.transaction('state').objectStore('state').get('studies');r.onsuccess=()=>resolve(r.result);});db.close();return !!value.sessions.find(s=>s.id===value.activeId).planes.surfaceEdits[id];},id);
  assert.ok(Math.hypot(Number(await pointLocator(id).getAttribute('cx'))-exact.x,Number(await pointLocator(id).getAttribute('cy'))-exact.y)<.2);
  const viewport=page.getByRole('region',{name:'Construction drawing viewport'});await viewport.scrollIntoViewIfNeeded();const viewportBox=await viewport.boundingBox(),beforePinch=await page.getByLabel('Editable head construction').boundingBox(),cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:viewportBox.x+100,y:viewportBox.y+80,id:1},{x:viewportBox.x+160,y:viewportBox.y+80,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:viewportBox.x+80,y:viewportBox.y+80,id:1},{x:viewportBox.x+180,y:viewportBox.y+80,id:2}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:false});await cdp.detach();
  const afterPinch=await page.getByLabel('Editable head construction').boundingBox();assert.ok(afterPinch.width>beforePinch.width*1.2,'touch pinch zooms the canvas');
  // Export is checked at the same size and exact pin coordinates.
  if(!process.env.DRAWLOOM_TEST_SEGMENTATION)await page.getByLabel('Subject-masked value block-in').uncheck();await page.getByLabel('Include editable geometry metadata').check();
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export this underdrawing',exact:true}).click();const download=await downloadPromise;const text=await readFile(await download.path(),'utf8'),packet=JSON.parse(text);
  assert.equal(packet.schema,'drawloom.underdrawing.v1');assert.ok(packet.planes.primitives.sphere.radius>0);assert.ok(packet.planes.curves.length>0);if(process.env.DRAWLOOM_TEST_SEGMENTATION){const layer=packet.layers.find(layer=>layer.id==='review-block-in');assert.ok(layer);const ink=await page.evaluate(async png=>{const image=new Image();image.src=png;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;let count=0;for(let i=3;i<data.length;i+=4)if(data[i])count++;return count;},layer.png);assert.ok(ink>100,'the subject value block-in contains visible marks');} assert.equal(packet.planes.source,'triangulated');assert.ok(packet.layers.some(layer=>layer.id==='head-planes'));assert.ok(packet.layers.some(layer=>layer.id==='review-features'));assert.ok(packet.layers.every(layer=>layer.width===packet.width&&layer.height===packet.height));assert.ok(Math.hypot(packet.planes.vertices[id].x-exact.x*packet.scale,packet.planes.vertices[id].y-exact.y*packet.scale)<.2);
  if(process.env.HATCH_READER){const {readDrawloomPacket}=await import(pathToFileURL(path.resolve(process.env.HATCH_READER)).href);const guides=readDrawloomPacket(text,{width:1200,height:1800});assert.equal(guides.length,packet.layers.length);assert.ok(guides.every(g=>g.scale===guides[0].scale));}
  const back=page.waitForEvent('download');await page.getByRole('button',{name:'Back up session',exact:true}).click();const portable=JSON.parse(await readFile(await(await back).path(),'utf8'));assert.equal(portable.version,2);assert.ok(portable.session.planes.topology.added[added]);
  assert.deepEqual(errors,[]);
  if(process.env.DRAWLOOM_QA_DIR){await mkdir(process.env.DRAWLOOM_QA_DIR,{recursive:true});await writeFile(path.join(process.env.DRAWLOOM_QA_DIR,'underdrawing.json'),text);await writeFile(path.join(process.env.DRAWLOOM_QA_DIR,'study.json'),JSON.stringify(portable));await page.screenshot({path:path.join(process.env.DRAWLOOM_QA_DIR,'editor.png'),fullPage:true});}
  console.log('planes UI ok: exact pins and reload, zoom/pinch, undo/redo, notes and shortcut focus, split/delete/undo, 3D orbit/snap/surface drag, version-2 backup and aligned underdrawing export');
}catch(error){console.error('Browser errors:',errors);if(process.env.DRAWLOOM_QA_DIR){await mkdir(process.env.DRAWLOOM_QA_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.DRAWLOOM_QA_DIR,'failure.png'),fullPage:true});}throw error;}
finally{await browser.close();}
