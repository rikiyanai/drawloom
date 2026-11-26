import { analyzeFigure, planeFrame, newCanvas, objectMask, cutoutPhoto, portraitRect, type Figure } from './core';
import { buildPlaneStudy } from './plane-structure';
import { hairMask } from './hair-tone';

export const STUDIO_ENGINE_VERSION = 'drawloom.studio-photo.v1';
type Progress = (message:string)=>void;

export async function pickPhotoPerson(source:HTMLCanvasElement,point:{x:number;y:number},progress:Progress=()=>{}) {
  progress('Isolating the selected person…');
  const mask=await objectMask(source,point),cutout=await cutoutPhoto(source,mask.toDataURL('image/png'),true);
  progress('Framing the selected face and shoulders…');
  const pose=await analyzeFigure(cutout);
  return{canvas:cutout,frame:portraitRect({id:'person',name:'Person',pose,rect:{x:0,y:0,width:source.width,height:source.height}})};
}

/** Shared construction engine. Studio owns source selection, paper, layers,
 * frames, history and persistence; this module has no editor or project store. */
export async function fitPhotoGuides(source:HTMLCanvasElement, progress:Progress=()=>{}) {
  progress('Fitting the photo’s head forms…');
  const pose = await analyzeFigure(source);
  const figure:Figure={id:'studio-photo',name:'Photo',pose,rect:{x:0,y:0,width:source.width,height:source.height}};
  const region=figure.rect, frame=planeFrame(figure);
  progress('Resolving hair in front of the fitted head…');
  const hair=await hairMask(source,region), image=new Image();
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('Hair mask could not be decoded.'));image.src=hair;});
  progress('Constructing visible planes and selected structure…');
  const study=buildPlaneStudy(source,figure,region,{hairMask:image});
  const mesh=newCanvas(source.width,source.height),c=mesh.getContext('2d')!;
  c.strokeStyle='#244e76';c.lineWidth=Math.max(1,source.width/800);c.beginPath();
  for(const edge of frame.edges){const a=frame.vertices[edge.a],b=frame.vertices[edge.b];if(!a||!b||![a,b].every(p=>['visible','grazing'].includes(p.visibility)))continue;c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);}c.stroke();
  return {source,figure,frame,study,hair,pose,guides:[
    {kind:'mesh',name:'Fitted head mesh',canvas:mesh},
    {kind:'planes',name:'Fitted head planes',canvas:study.planesCanvas},
    {kind:'hatch',name:'Selected head structure',canvas:study.selectedLinesCanvas},
  ]};
}

export async function traceFittedPhoto(fit:Awaited<ReturnType<typeof fitPhotoGuides>>, width:number,height:number,measure:(text:string)=>number,progress:Progress=()=>{},top=0,left=0) {
  if(width>640||width<128||height>1530)throw Error('The current photo encoder needs a page 128–640 px wide and at most 90 native rows. Plane guides remain available at larger sizes.');
  const {source,study,frame}=fit,rows=Math.min(90,Math.floor((height-top)/17));
  if(rows<8)throw Error('Use a page with at least eight complete native rows for the photo filter.');
  const nativeHeight=rows*17,region={x:source.width*left/(width+left),y:source.height*top/height,width:source.width*width/(width+left),height:source.height*nativeHeight/height};
  const [{photoEdges},{tracePhoto},{compilePlaneEyes},{composeNativeWords},{normalizeNativeSpacing},{addHairTone,addBoundedTone}]=await Promise.all([
    import('./photo-edges'),import('./model-trace'),import('./plane-eye-words'),import('./native-composition'),import('./native-spacing'),import('./hair-tone')]);
  const edges=await photoEdges(source,{maxSide:768,strength:1.2,onProgress:progress});
  const input=newCanvas(edges.width,edges.height),c=input.getContext('2d')!;
  c.fillStyle='white';c.fillRect(0,0,input.width,input.height);c.drawImage(edges,0,0);
  c.globalCompositeOperation='destination-out';c.drawImage(study.faceMaskCanvas,0,0,input.width,input.height);
  c.globalCompositeOperation='multiply';c.drawImage(study.selectedLinesCanvas,0,0,input.width,input.height);c.globalCompositeOperation='source-over';
  // Preserve the Studio page's exact source registration; the editor controls
  // framing by moving its photo guide, never by silently resizing existing ink.
  const eyePlan=compilePlaneEyes(source,frame,region,width,nativeHeight,measure);
  const registeredInput=newCanvas(input.width*region.width/source.width,input.height*region.height/source.height),registered=registeredInput.getContext('2d')!;
  registered.drawImage(input,input.width*region.x/source.width,input.height*region.y/source.height,input.width*region.width/source.width,input.height*region.height/source.height,0,0,registeredInput.width,registeredInput.height);
  registered.fillStyle='white';for(const r of eyePlan.reservedRects)registered.fillRect(r.x/width*registeredInput.width,r.y/nativeHeight*registeredInput.height,r.width/width*registeredInput.width,r.height/nativeHeight*registeredInput.height);
  const result=await tracePhoto(registeredInput,{width,rows,mode:'prepared-lines',onProgress:progress});
  const normalized=normalizeNativeSpacing(result.text,measure);
  let text=composeNativeWords(normalized.text,eyePlan.words,eyePlan.reservedRects,measure);
  for(const band of study.shadowBands)text=addBoundedTone({text,measure,mask:band.maskCanvas,source,region,guideWidth:width,guideHeight:nativeHeight,amount:band.band===2?.3:.195,pattern:band.band===2?';:':':',maxLuminance:1.01});
  const mask=newCanvas(source.width,source.height),m=mask.getContext('2d')!;
  const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('Hair mask could not be decoded.'));image.src=fit.hair;});
  m.drawImage(image,0,0);m.drawImage(study.facialHairMaskCanvas,0,0);
  text=addHairTone({text,measure,mask,source,region,guideWidth:width,guideHeight:nativeHeight,amount:1,pattern:'flow'});
  return{text,model:result.model,notes:[...study.summary,...eyePlan.notes,...result.warnings],qualification:'Editable photo trace draft; not AAHub-quality acceptance.'};
}
