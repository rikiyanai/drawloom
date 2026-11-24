import type * as TensorFlow from '@tensorflow/tfjs';

type TF = typeof TensorFlow;
type Weight = { name: string; shape: number[]; offset: number; bytes: number };
type Manifest = { model: string; revision: string; inputRowPitch: number; vocabulary: string[]; advances: number[]; weights: Weight[]; sourceURLs: string[]; hashes: Record<string,string> };
export type TracePhotoOptions = {
  width?: number; rows?: number; mode?: 'prepared-lines' | 'edges' | 'values'; contrast?: number;
  lineThreshold?: number; thinLines?: boolean; postThinInk?:HTMLCanvasElement;
  signal?: AbortSignal; onProgress?: (message: string, fraction: number) => void;
};
export type ModelTrace = {
  text: string; model: string; width: number; height: number; rows: number;
  guideWidth: number; guideHeight: number; trainedInputHeight: number;
  aligned: boolean; warnings: string[]; sourceURLs: string[]; preparedInput:string;
  settings: { width: number; rows: number; mode: string; contrast: number; lineThreshold: number; thinLines: boolean };
};
type Loaded = { tf: TF; manifest: Manifest; weights: Map<string,TensorFlow.Tensor> };
const assetBase = `${process.env.NEXT_PUBLIC_BASE_PATH ?? '/drawloom'}/models/stnk20/`;
let loading: Promise<Loaded> | undefined;
let occupied = false;
const stop = (signal?: AbortSignal) => { if (signal?.aborted) throw new DOMException('Trace cancelled.', 'AbortError'); };

// Guo–Hall parallel thinning: each phase marks all deletions before applying
// any, preserving stroke connectivity. The pinned encoder's train.py uses this
// operation after thresholding, not continuous-gray edge ribbons.
// Algorithm reference: OpenCV ximgproc THINNING_GUOHALL (Apache-2.0),
// https://github.com/opencv/opencv_contrib/blob/4.10.0/modules/ximgproc/src/thinning.cpp
async function thinGuoHall(ink: Uint8Array, width: number, height: number, signal: AbortSignal | undefined, yieldFrame: () => Promise<void>): Promise<void> {
  const removed = new Uint8Array(ink.length);
  let changed: boolean, rounds = 0;
  do {
    changed = false;
    for (let phase = 0; phase < 2; phase++) {
      removed.fill(0);
      for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
        const at = y * width + x;
        if (!ink[at]) continue;
        const north = ink[at-width], ne = ink[at-width+1], east = ink[at+1], se = ink[at+width+1];
        const south = ink[at+width], sw = ink[at+width-1], west = ink[at-1], nw = ink[at-width-1];
        const transitions = ((1-north)&(ne|east)) + ((1-east)&(se|south)) + ((1-south)&(sw|west)) + ((1-west)&(nw|north));
        const pairsA = (nw|north)+(ne|east)+(se|south)+(sw|west);
        const pairsB = (north|ne)+(east|se)+(south|sw)+(west|nw);
        const pairs = Math.min(pairsA,pairsB);
        const guarded = phase === 0 ? (south|sw|(1-nw))&west : (north|ne|(1-se))&east;
        if (transitions === 1 && pairs >= 2 && pairs <= 3 && !guarded) removed[at] = 1;
      }
      for (let i = 0; i < ink.length; i++) if (removed[i]) { ink[i] = 0; changed = true; }
    }
    stop(signal);
    if (++rounds % 8 === 0) await yieldFrame();
  } while (changed);
}

async function load(): Promise<Loaded> {
  if (loading) return loading;
  loading = (async () => {
    const tf = await import('@tensorflow/tfjs');
    if (!tf.getBackend()) { try { await tf.setBackend('webgl'); } catch { await tf.setBackend('cpu'); } }
    await tf.ready();
    const [meta, raw] = await Promise.all([fetch(assetBase+'model.json'), fetch(assetBase+'weights.bin')]);
    if (!meta.ok || !raw.ok) throw Error('The pinned STNK20 model files could not be loaded.');
    const manifest = await meta.json() as Manifest, buffer = await raw.arrayBuffer();
    const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(v=>v.toString(16).padStart(2,'0')).join('');
    if (digest !== manifest.hashes['weights.bin']) throw Error('STNK20 weight hash does not match its pinned source.');
    const weights = new Map<string,TensorFlow.Tensor>();
    for (const weight of manifest.weights) weights.set(weight.name, tf.tensor(new Float32Array(buffer, weight.offset, weight.bytes/4), weight.shape));
    return { tf, manifest, weights };
  })().catch(error => { loading = undefined; throw error; });
  return loading;
}

/** The actual pinned STNK20 learned encoder, followed by its greedy masked-width
 * decoder. It supplies an editable trace base, not a claim of finished likeness.
 * The original 18px training rows are compensated in the input for Studio's
 * 17px native rows; glyph advances are checked rather than silently replaced. */
export async function tracePhoto(source: HTMLCanvasElement, options: TracePhotoOptions = {}): Promise<ModelTrace> {
  if (occupied) throw Error('A learned trace is already running. Wait or cancel it first.');
  occupied = true;
  let x: TensorFlow.Tensor4D | undefined, residual: TensorFlow.Tensor4D | undefined;
  let blank: TensorFlow.Tensor4D | undefined, chars: TensorFlow.Tensor4D | undefined;
  try {
    if (!source.width || !source.height) throw Error('Choose a nonempty source crop.');
    stop(options.signal); options.onProgress?.('Loading the pinned learned trace model…', .02);
    const { tf, manifest, weights } = await load(); stop(options.signal);
    const width = Math.round(options.width ?? 400), rows = Math.round(options.rows ?? width*source.height/source.width/17);
    if (width < 128 || width > 640 || rows < 8 || rows > 90) throw Error('Choose a trace width of 128–640 pixels and 8–90 native rows.');
    const mode = options.mode ?? 'edges', contrast = options.contrast ?? 1;
    if (!Number.isFinite(contrast) || contrast < .25 || contrast > 4) throw Error('Choose trace contrast between .25 and 4.');
    const lineThreshold = options.lineThreshold ?? .3, thinLines = options.thinLines ?? true;
    if (!Number.isFinite(lineThreshold) || lineThreshold <= 0 || lineThreshold >= 1) throw Error('Choose a line ink threshold between 0 and 1.');
    const height = rows*18, prepared = document.createElement('canvas'); prepared.width = width; prepared.height = height;
    const ctx = prepared.getContext('2d', {willReadFrequently:true})!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height); ctx.drawImage(source,0,0,width,height);
    const pixels = ctx.getImageData(0,0,width,height).data, values = new Float32Array(width*height);
    for (let i=0;i<values.length;i++) values[i] = (.2126*pixels[i*4]+.7152*pixels[i*4+1]+.0722*pixels[i*4+2])/255;
    const input = new Float32Array(values.length), clamp = (n:number) => Math.max(0,Math.min(1,n));
    for (let y=0;y<height;y++) for (let c=0;c<width;c++) {
      const at=y*width+c;
      if (mode === 'edges') {
        const p=(dx:number,dy:number)=>values[Math.max(0,Math.min(height-1,y+dy))*width+Math.max(0,Math.min(width-1,c+dx))];
        const gx=-p(-1,-1)+p(1,-1)-2*p(-1,0)+2*p(1,0)-p(-1,1)+p(1,1);
        const gy=-p(-1,-1)-2*p(0,-1)-p(1,-1)+p(-1,1)+2*p(0,1)+p(1,1);
        input[at]=clamp((Math.hypot(gx,gy)-.08)*contrast*1.8);
      } else input[at]=clamp((1-values[at])*contrast);
    }
    if (mode === 'prepared-lines') {
      options.onProgress?.(thinLines ? 'Binarizing and thinning the guide to training-matched strokes…' : 'Binarizing the prepared line guide…', .05);
      const binary = Uint8Array.from(input, ink => ink > lineThreshold ? 1 : 0);
      if (thinLines) await thinGuoHall(binary,width,height,options.signal,()=>tf.nextFrame());
      input.set(binary);
    }
    const weight=(name:string)=>{const result=weights.get(name);if(!result)throw Error('Missing learned tensor: '+name);return result;};
    const conv=(a:TensorFlow.Tensor4D,n:number,dilation=1,stride:[number,number]=[1,1])=>{
      const name=n ? `conv2d_${n}`:'conv2d';
      let result=tf.conv2d(a,weight(name+'/kernel:0') as TensorFlow.Tensor4D,stride,'same','NHWC',[1,dilation]);
      const bias=weights.get(name+'/bias:0');if(bias)result=tf.add(result,bias) as TensorFlow.Tensor4D;return result;
    };
    const bn=(a:TensorFlow.Tensor4D,n:number)=>{const name=n ? `batch_normalization_${n}`:'batch_normalization';return tf.batchNorm(a,weight(name+'/moving_mean:0'),weight(name+'/moving_variance:0'),weight(name+'/beta:0'),weight(name+'/gamma:0'),.001) as TensorFlow.Tensor4D;};
    if(options.postThinInk){ctx.clearRect(0,0,width,height);ctx.drawImage(options.postThinInk,0,0,width,height);const salient=ctx.getImageData(0,0,width,height).data;for(let i=0;i<input.length;i++)if(salient[i*4]>127)input[i]=1;}
    const shown=ctx.createImageData(width,height);for(let i=0;i<input.length;i++){const shade=Math.round((1-input[i])*255);shown.data[i*4]=shown.data[i*4+1]=shown.data[i*4+2]=shade;shown.data[i*4+3]=255;}ctx.putImageData(shown,0,0);const preparedInput=prepared.toDataURL('image/png');
    x=tf.tensor4d(input,[1,height,width,1]);
    let steps=0;
    const step=async(fn:(a:TensorFlow.Tensor4D)=>TensorFlow.Tensor4D)=>{
      stop(options.signal);const previous=x!;x=tf.tidy(()=>fn(previous));previous.dispose();
      options.onProgress?.('Constructing the learned native trace…',.08+(++steps/19)*.8);await tf.nextFrame();stop(options.signal);
    };
    await step(a=>tf.pad(a,[[0,0],[0,0],[16,0],[0,0]]) as TensorFlow.Tensor4D);
    await step(a=>tf.relu(conv(a,0,1,[2,1])));
    await step(a=>bn(conv(a,1,2),0));
    await step(a=>bn(tf.stridedSlice(conv(tf.relu(a),2,2),[0,1,0,0],[1,a.shape[1],a.shape[2],64],[1,3,1,1]) as TensorFlow.Tensor4D,1));
    residual=x.clone();
    await step(a=>bn(conv(tf.relu(a),3,6),2));
    await step(a=>bn(conv(tf.relu(a),4,6),3));
    await step(a=>tf.add(a,residual!) as TensorFlow.Tensor4D);residual.dispose();residual=undefined;
    await step(a=>bn(a,4));
    await step(a=>bn(tf.stridedSlice(conv(tf.relu(a),5,6),[0,1,0,0],[1,a.shape[1],a.shape[2],128],[1,3,1,1]) as TensorFlow.Tensor4D,5));
    residual=x.clone();
    await step(a=>bn(a,6));
    await step(a=>bn(conv(tf.relu(a),6,18),7));
    await step(a=>bn(conv(tf.relu(a),7,18),8));
    await step(a=>bn(tf.add(a,residual!) as TensorFlow.Tensor4D,9));residual.dispose();residual=undefined;
    await step(a=>tf.relu(bn(conv(tf.relu(a),8),10)));
    await step(a=>tf.slice(a,[0,0,0,0],[1,a.shape[1],a.shape[2]-16,512]));
    blank=tf.tidy(()=>tf.softmax(conv(x!,9),-1));chars=tf.tidy(()=>tf.softmax(conv(x!,10),-1));x.dispose();x=undefined;
    const [bData,cData]=await Promise.all([blank.data(),chars.data()]);stop(options.signal);
    const lines:string[]=[];
    for(let r=0;r<rows;r++) {
      let line='';
      for(let px=0;px<width;) {
        const i=r*width+px, b=i*3, c=i*322;
        let kind=2, best=cData[c], bestIndex=0;
        for(let k=1;k<322;k++)if(cData[c+k]>best){best=cData[c+k];bestIndex=k;}
        let probability=bData[b+2]*best;
        if(bData[b]>=probability){kind=0;probability=bData[b];}
        if(bData[b+1]>probability)kind=1;
        const index=kind===2?bestIndex+2:kind;
        line+=manifest.vocabulary[index];px+=manifest.advances[index];
      }
      lines.push(line.trimEnd());
    }
    const metric=document.createElement('canvas').getContext('2d')!;metric.font='16px Saitamaar';
    const mismatched=manifest.vocabulary.filter((char,i)=>Math.round(metric.measureText(char).width)!==manifest.advances[i]);
    const aligned=document.fonts.check('16px Saitamaar') && !mismatched.length;
    const warnings:string[]=[];
    if(!aligned)warnings.push(`The trained glyph advances differ from the loaded font for ${mismatched.length} of 324 characters; inspect registration before retaining.`);
    const bad=lines.filter(line=>line.startsWith(' ')||line.includes('  ')).length;
    if(bad)warnings.push(`${bad} rows contain model-selected leading or repeated half spaces. Correct them in Studio; the raw model spelling is retained.`);
    if(mode==='edges')warnings.push('Photo edges are conventional preprocessing; the AA encoder is learned. This is not the AAHub service’s separate learned manga-line extraction stage.');
    options.onProgress?.('Learned native trace ready for correction.',1);
    return {preparedInput,text:lines.join('\n'),model:`${manifest.model}@${manifest.revision}`,width:Math.max(width,...lines.map(line=>Math.ceil(metric.measureText(line).width))),height:rows*17,rows,guideWidth:width,guideHeight:rows*17,trainedInputHeight:height,aligned,warnings,sourceURLs:manifest.sourceURLs,settings:{width,rows,mode,contrast,lineThreshold,thinLines}};
  } finally {x?.dispose();residual?.dispose();blank?.dispose();chars?.dispose();occupied=false;}
}
