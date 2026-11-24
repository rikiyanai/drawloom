import type * as TensorFlow from '@tensorflow/tfjs';

type Manifest = { model:string; revision:string; checkpoint:string; sourceURLs:string[]; hashes:Record<string,string>; weights:{name:string;shape:number[];offset:number;bytes:number}[] };
type Loaded = {tf:typeof TensorFlow;manifest:Manifest;weights:Map<string,TensorFlow.Tensor>};
export type PhotoEdgesOptions = {onProgress?:(message:string,fraction:number)=>void;signal?:AbortSignal;maxSide?:number;strength?:number};
const assetBase=`${process.env.NEXT_PUBLIC_BASE_PATH??'/drawloom'}/models/teed/`;
let loading:Promise<Loaded>|undefined, occupied=false;
const stop=(signal?:AbortSignal)=>{if(signal?.aborted)throw new DOMException('Photo edge extraction cancelled.','AbortError');};
async function load():Promise<Loaded>{
  if(loading)return loading;
  loading=(async()=>{
    const tf=await import('@tensorflow/tfjs');
    if(!tf.getBackend()){try{await tf.setBackend('webgl');}catch{await tf.setBackend('cpu');}}
    await tf.ready();
    const [a,b]=await Promise.all([fetch(assetBase+'model.json'),fetch(assetBase+'weights.bin')]);
    if(!a.ok||!b.ok)throw Error('The pinned TEED model files could not be loaded.');
    const manifest=await a.json() as Manifest,buffer=await b.arrayBuffer();
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',buffer))].map(v=>v.toString(16).padStart(2,'0')).join('');
    if(digest!==manifest.hashes['weights.bin'])throw Error('TEED weight hash does not match its pinned source.');
    const weights=new Map<string,TensorFlow.Tensor>();
    for(const entry of manifest.weights)weights.set(entry.name,tf.tensor(new Float32Array(buffer,entry.offset,entry.bytes/4),entry.shape));
    return {tf,manifest,weights};
  })().catch(error=>{loading=undefined;throw error;});
  return loading;
}

/** A learned real-photo edge guide from the official MIT TEED checkpoint.
 * This is source preparation for the AA encoder, not native text itself.
 * Inference stays in the browser; no photograph is uploaded. */
export async function photoEdges(source:HTMLCanvasElement,options:PhotoEdgesOptions={}):Promise<HTMLCanvasElement>{
  if(occupied)throw Error('Photo edge extraction is already running. Wait or cancel it first.');
  occupied=true;
  const live=new Set<TensorFlow.Tensor>();
  try{
    if(!source.width||!source.height)throw Error('Choose a nonempty photo crop.');
    stop(options.signal);options.onProgress?.('Loading learned photo-edge model…',.02);
    const {tf,manifest,weights}=await load();stop(options.signal);
    const limit=options.maxSide??512,strength=options.strength??1;
    if(!Number.isFinite(limit)||limit<128||limit>1024||!Number.isFinite(strength)||strength<.25||strength>4)throw Error('Choose a 128–1024 pixel edge inference size and .25–4 edge strength.');
    const ratio=Math.min(1,limit/Math.max(source.width,source.height));
    const width=Math.max(8,Math.ceil(source.width*ratio/8)*8),height=Math.max(8,Math.ceil(source.height*ratio/8)*8);
    const resized=document.createElement('canvas');resized.width=width;resized.height=height;
    const ctx=resized.getContext('2d',{willReadFrequently:true})!;ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(source,0,0,width,height);
    const pixels=ctx.getImageData(0,0,width,height).data,input=new Float32Array(width*height*3);
    for(let i=0;i<width*height;i++){input[i*3]=pixels[i*4+2]-103.939;input[i*3+1]=pixels[i*4+1]-116.779;input[i*3+2]=pixels[i*4]-123.68;}
    const weight=(name:string)=>{const w=weights.get(name);if(!w)throw Error('Missing TEED tensor: '+name);return w;};
    const smish=(x:TensorFlow.Tensor4D)=>tf.mul(x,tf.tanh(tf.log(tf.add(tf.sigmoid(x),1)))) as TensorFlow.Tensor4D;
    const conv=(x:TensorFlow.Tensor4D,name:string,stride=1,pad=0)=>{
      // Explicit PyTorch padding is important for stride-2 alignment: TensorFlow
      // SAME uses a different asymmetric pad on even-sized inputs.
      const padded=pad?tf.pad(x,[[0,0],[pad,pad],[pad,pad],[0,0]]) as TensorFlow.Tensor4D:x;
      return tf.add(tf.conv2d(padded,weight(name+'.weight') as TensorFlow.Tensor4D,stride,'valid'),weight(name+'.bias')) as TensorFlow.Tensor4D;
    };
    const transpose=(x:TensorFlow.Tensor4D,name:string)=>{
      const kernel=weight(name+'.weight') as TensorFlow.Tensor4D;
      return tf.add(tf.conv2dTranspose(x,kernel,[1,x.shape[1]*2,x.shape[2]*2,kernel.shape[2]],2,'same'),weight(name+'.bias')) as TensorFlow.Tensor4D;
    };
    const up=(x:TensorFlow.Tensor4D,n:number)=>{
      const name=`up_block_${n}.features`;
      let result=transpose(smish(conv(x,name+'.0')),name+'.2');
      if(n===3)result=transpose(smish(conv(result,name+'.3')),name+'.5');
      return result;
    };
    const keep=(fn:()=>TensorFlow.Tensor4D)=>{const t=tf.tidy(fn);live.add(t);return t;};
    const release=(...values:TensorFlow.Tensor[])=>{for(const value of values){value.dispose();live.delete(value);}};
    const progress=async(message:string,fraction:number)=>{options.onProgress?.(message,fraction);await tf.nextFrame();stop(options.signal);};
    const image=tf.tensor4d(input,[1,height,width,3]);live.add(image);
    const block1=keep(()=>smish(conv(smish(conv(image,'block_1.conv1',2,1)),'block_1.conv2',1,1)));release(image);
    await progress('Finding photo contours at several scales…',.2);
    const head1=keep(()=>up(block1,1));
    const side=keep(()=>conv(block1,'side_1.conv',2));
    const block2=keep(()=>conv(smish(conv(block1,'block_2.conv1',1,1)),'block_2.conv2',1,1));release(block1);
    const head2=keep(()=>up(block2,2));
    const down=keep(()=>tf.maxPool(tf.pad(block2,[[0,0],[1,1],[1,1],[0,0]],-1e30) as TensorFlow.Tensor4D,3,2,'valid'));release(block2);
    await progress('Joining learned structural edges…',.45);
    const block3=keep(()=>{
      const pre=conv(down,'pre_dense_3.conv'),joined=tf.add(down,side) as TensorFlow.Tensor4D;
      const first=smish(conv(smish(joined),'dblock_3.denselayer1.conv1',1,2));
      return tf.mul(tf.add(conv(first,'dblock_3.denselayer1.conv2'),pre),.5) as TensorFlow.Tensor4D;
    });release(down,side);
    const head3=keep(()=>up(block3,3));release(block3);
    await progress('Fusing the photo-edge guide…',.7);
    const edges=keep(()=>{
      const joined=tf.concat([head1,head2,head3],3) as TensorFlow.Tensor4D;
      const depthwise=(x:TensorFlow.Tensor4D,name:string)=>tf.add(tf.depthwiseConv2d(x,weight(name+'.weight') as TensorFlow.Tensor4D,1,'same'),weight(name+'.bias')) as TensorFlow.Tensor4D;
      const first=depthwise(smish(joined),'block_cat.DWconv1');
      const second=depthwise(smish(first),'block_cat.DWconv2');
      return tf.sigmoid(smish(tf.sum(tf.add(first,second),3,true) as TensorFlow.Tensor4D));
    });release(head1,head2,head3);
    const values=await edges.data();stop(options.signal);
    let lo=Infinity,hi=-Infinity;for(const value of values){lo=Math.min(lo,value);hi=Math.max(hi,value);}
    const output=ctx.createImageData(width,height),span=hi-lo;
    for(let i=0;i<values.length;i++){
      const normalized=span>1e-8?Math.max(0,Math.min(1,(values[i]-lo)/span*strength)):0;
      const color=Math.round((1-normalized)*255);output.data[i*4]=output.data[i*4+1]=output.data[i*4+2]=color;output.data[i*4+3]=255;
    }
    ctx.putImageData(output,0,0);
    const canvas=document.createElement('canvas');canvas.width=source.width;canvas.height=source.height;
    canvas.getContext('2d')!.drawImage(resized,0,0,canvas.width,canvas.height);
    canvas.dataset.model=`${manifest.model}@${manifest.revision}:${manifest.checkpoint}`;
    canvas.dataset.inferenceSize=`${width}×${height}`;canvas.dataset.sourceUrls=JSON.stringify(manifest.sourceURLs);
    options.onProgress?.('Learned photo-edge guide ready.',1);return canvas;
  }finally{for(const tensor of live)tensor.dispose();occupied=false;}
}
