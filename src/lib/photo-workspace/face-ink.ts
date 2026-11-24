import type { PoseResult } from '../pose/detect';
import { LEFT_EYE, RIGHT_EYE, LEFT_IRIS, RIGHT_IRIS } from '../pose/landmarks';
import type { Rect } from './core';

type Point={x:number;y:number};
type Region={polygon:Point[];iris?:{center:Point;ux:number;uy:number;rx:number;ry:number}};
const browRings=[
  [70,63,105,66,107,55,65,52,53,46],
  [336,296,334,293,300,276,283,282,295,285],
];
// Canonical eye/brow connections: MediaPipe FaceMesh (Apache-2.0).
// https://github.com/google-ai-edge/mediapipe/blob/v0.10.35/mediapipe/python/solutions/face_mesh_connections.py
function inside(point:Point,polygon:Point[]):boolean{
  let yes=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)yes=!yes;
  }
  return yes;
}

/** White-on-black saliency mask containing only actual dark photograph pixels
 * inside detected brows or visible iris regions. No pupil is drawn, no glyph
 * is selected, and no closed eye receives an invented iris. The caller may
 * retain this source ink after its general line-thinning stage. */
export function faceInk(source:HTMLCanvasElement,pose:PoseResult|undefined,region:Rect,nativeWidth:number,trainedHeight:number):HTMLCanvasElement{
  const canvas=document.createElement('canvas');canvas.width=Math.round(nativeWidth);canvas.height=Math.round(trainedHeight);
  if(canvas.width<1||canvas.height<1||!source.width||!source.height)throw Error('Face ink needs a registered nonempty source.');
  const ctx=canvas.getContext('2d')!,output=ctx.createImageData(canvas.width,canvas.height);
  for(let i=3;i<output.data.length;i+=4)output.data[i]=255;
  if(!pose||pose.landmarks.length<478){ctx.putImageData(output,0,0);return canvas;}
  const sx=source.width/pose.imageWidth,sy=source.height/pose.imageHeight;
  const landmark=(id:number):Point=>({x:pose.landmarks[id].x*sx,y:pose.landmarks[id].y*sy});
  const regions:Region[]=browRings.map(ids=>({polygon:ids.map(landmark)}));
  for(const [eyeIds,irisIds] of [[LEFT_EYE,LEFT_IRIS],[RIGHT_EYE,RIGHT_IRIS]]){
    const eye=eyeIds.map(landmark),a=eye[0],b=eye[8],width=Math.hypot(b.x-a.x,b.y-a.y);
    if(width<6)continue;
    const ux=(b.x-a.x)/width,uy=(b.y-a.y)/width;
    const vertical=(point:Point)=>(point.x-a.x)*(-uy)+(point.y-a.y)*ux;
    const mean=(points:Point[])=>points.reduce((total,p)=>total+vertical(p),0)/points.length;
    const aperture=Math.abs(mean(eye.slice(2,6))-mean(eye.slice(10,14)));
    // The gate is rotation-invariant and deliberately conservative for closed,
    // squinting and collapsed far-side eyes. It does not substitute eye shape.
    if(aperture<1.5||aperture/width<.11)continue;
    const center=landmark(irisIds[0]);if(!inside(center,eye))continue;
    const ring=irisIds.slice(1).map(landmark);
    const rx=Math.max(...ring.map(p=>Math.abs((p.x-center.x)*ux+(p.y-center.y)*uy)));
    const ry=Math.max(...ring.map(p=>Math.abs((p.x-center.x)*(-uy)+(p.y-center.y)*ux)));
    if(rx<.5||ry<.5||rx>width*.35||ry>width*.35)continue;
    regions.push({polygon:eye,iris:{center,ux,uy,rx,ry}});
  }
  const pixels=source.getContext('2d',{willReadFrequently:true})!.getImageData(0,0,source.width,source.height).data;
  for(const selection of regions){
    const minX=Math.max(0,Math.floor((Math.min(...selection.polygon.map(p=>p.x))-region.x)/region.width*canvas.width));
    const maxX=Math.min(canvas.width-1,Math.ceil((Math.max(...selection.polygon.map(p=>p.x))-region.x)/region.width*canvas.width));
    const minY=Math.max(0,Math.floor((Math.min(...selection.polygon.map(p=>p.y))-region.y)/region.height*canvas.height));
    const maxY=Math.min(canvas.height-1,Math.ceil((Math.max(...selection.polygon.map(p=>p.y))-region.y)/region.height*canvas.height));
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      const point={x:region.x+(x+.5)/canvas.width*region.width,y:region.y+(y+.5)/canvas.height*region.height};
      if(!inside(point,selection.polygon))continue;
      if(selection.iris){const {center,ux,uy,rx,ry}=selection.iris,dx=point.x-center.x,dy=point.y-center.y;if(((dx*ux+dy*uy)/rx)**2+((dx*(-uy)+dy*ux)/ry)**2>1)continue;}
      const px=Math.floor(point.x),py=Math.floor(point.y);if(px<0||py<0||px>=source.width||py>=source.height)continue;
      const at=(py*source.width+px)*4;
      if(pixels[at+3]<192||(.2126*pixels[at]+.7152*pixels[at+1]+.0722*pixels[at+2])/255>=.3)continue;
      const to=(y*canvas.width+x)*4;output.data[to]=output.data[to+1]=output.data[to+2]=255;
    }
  }
  ctx.putImageData(output,0,0);return canvas;
}
