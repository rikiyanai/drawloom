"use client";
import { useEffect, useRef } from "react";
import { useStudio } from "@/lib/store";
import { OVERLAYS } from "@/lib/overlays/registry";
import { PLANES_ENABLED, singleViewFrame } from '@/lib/planes/solve';
import { edgesOverlay } from '@/lib/overlays/edges';

const MAX_W = 1100;

export function CanvasStage({ children, nativeResolution=false, fillWidth=false, background='photo', skipPlanes=false, showOverlays=true }: { children?: React.ReactNode;nativeResolution?:boolean;fillWidth?:boolean;background?:'photo'|'line'|'both';skipPlanes?:boolean;showOverlays?:boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { image, pose, overlays, viewFilters } = useStudio();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const scale = nativeResolution?1:Math.min(1, MAX_W / image.naturalWidth);
    const w = Math.round(image.naturalWidth * scale);
    const h = Math.round(image.naturalHeight * scale);
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);

    // Apply view filters only to the photo draw, not to overlays
    ctx.filter = viewFilters.grayscale ? "grayscale(1)" : "none";
    ctx.drawImage(image, 0, 0, w, h);
    ctx.filter = "none";

    const scaledPose = pose
      ? {
          ...pose,
          landmarks: pose.landmarks.map((p) => ({ x: p.x * scale, y: p.y * scale, z: p.z * scale })),
          bbox: { cx: pose.bbox.cx * scale, cy: pose.bbox.cy * scale, size: pose.bbox.size * scale },
          imageWidth: w,
          imageHeight: h,
        }
      : null;

    if(background!=='photo'){
      const layer=document.createElement('canvas');layer.width=w;layer.height=h;const line=layer.getContext('2d')!;
      edgesOverlay.render({ctx:line,image,pose:scaledPose,width:w,height:h,params:{mode:1}});
      const pixels=line.getImageData(0,0,w,h);for(let i=0;i<pixels.data.length;i+=4){pixels.data[i]=255-pixels.data[i];pixels.data[i+1]=255-pixels.data[i+1];pixels.data[i+2]=255-pixels.data[i+2];}line.putImageData(pixels,0,0);
      ctx.globalAlpha=background==='line'?1:.45;ctx.drawImage(layer,0,0);ctx.globalAlpha=1;
    }
    const planes=PLANES_ENABLED&&scaledPose&&!skipPlanes?singleViewFrame(scaledPose):undefined;
    for (const overlay of OVERLAYS) {
      if(!showOverlays)continue;
      if(skipPlanes&&overlay.id.startsWith('head-'))continue;
      const state = overlays[overlay.id];
      if (!state?.enabled) continue;
      if (overlay.requiresFace && !scaledPose) continue;
      try {
        overlay.render({ ctx, image, pose: scaledPose, bodyPose: null, width: w, height: h, params: state.params,planes });
      } catch (e) {
        console.warn(`overlay ${overlay.id} failed`, e);
      }
    }
  }, [image, pose, overlays, viewFilters,nativeResolution,background,skipPlanes,showOverlays]);

  if (!image) return null;
  return (
    <div className="rounded-xl overflow-hidden border border-zinc-800 bg-black relative">
      <canvas ref={canvasRef} className={`block ${fillWidth?'w-full':'max-w-full'} h-auto`} />
      {children}
    </div>
  );
}
