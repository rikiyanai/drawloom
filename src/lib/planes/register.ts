import { distance, finitePoint, median, rotate, transform } from './types';
import type { Mat3, Registration, Similarity, Vec3 } from './types';

/** Jacobi diagonalization of a small real symmetric matrix. Eigenvectors are columns. */
function eigen(input: number[][]) {
  const a = input.map(row => [...row]), n = a.length;
  const vectors: number[][] = Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>Number(i===j)));
  for (let iteration=0; iteration<100; iteration++) {
    let p=0, q=1;
    for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) if(Math.abs(a[i][j])>Math.abs(a[p][q])) {p=i;q=j;}
    const magnitude = Math.max(...a.map(row=>Math.max(...row.map(Math.abs))), Number.MIN_VALUE);
    if(Math.abs(a[p][q]) <= magnitude*1e-14) break;
    const angle = 0.5*Math.atan2(2*a[p][q],a[q][q]-a[p][p]);
    const c=Math.cos(angle),s=Math.sin(angle),app=a[p][p],aqq=a[q][q],apq=a[p][q];
    a[p][p]=c*c*app-2*s*c*apq+s*s*aqq;
    a[q][q]=s*s*app+2*s*c*apq+c*c*aqq;
    a[p][q]=a[q][p]=0;
    for(let k=0;k<n;k++) {
      if(k!==p&&k!==q) {const x=a[k][p],y=a[k][q]; a[k][p]=a[p][k]=c*x-s*y; a[k][q]=a[q][k]=s*x+c*y;}
      const x=vectors[k][p],y=vectors[k][q]; vectors[k][p]=c*x-s*y; vectors[k][q]=s*x+c*y;
    }
  }
  return {values:a.map((row,i)=>row[i]),vectors};
}

function centroid(points: Vec3[], weights: number[]): Vec3 {
  const total=weights.reduce((a,b)=>a+b,0);
  return points.reduce((c,p,i)=>({x:c.x+p.x*weights[i]/total,y:c.y+p.y*weights[i]/total,z:c.z+p.z*weights[i]/total}),{x:0,y:0,z:0});
}
function centered(points: Vec3[], center: Vec3) {return points.map(p=>[p.x-center.x,p.y-center.y,p.z-center.z]);}
function requireSpread(points: number[][], weights: number[]) {
  const scatter = Array.from({length:3},()=>[0,0,0]);
  points.forEach((p,k)=>{for(let i=0;i<3;i++) for(let j=0;j<3;j++) scatter[i][j]+=weights[k]*p[i]*p[j];});
  const values=eigen(scatter).values.sort((a,b)=>b-a);
  if(values[0]<=0||values[1]<=values[0]*1e-10) throw new Error('Registration needs at least three non-collinear weighted points');
}

function leastSquares(source: Vec3[], target: Vec3[], weights: number[]): Similarity {
  const cs=centroid(source,weights),ct=centroid(target,weights),xs=centered(source,cs),ys=centered(target,ct);
  requireSpread(xs,weights); requireSpread(ys,weights);
  const m=Array.from({length:3},()=>[0,0,0]);
  xs.forEach((p,k)=>{for(let i=0;i<3;i++) for(let j=0;j<3;j++) m[i][j]+=weights[k]*p[i]*ys[k][j];});
  const [[xx,xy,xz],[yx,yy,yz],[zx,zy,zz]]=m;
  // Proper rotation via Horn's symmetric quaternion system (1987, section 4).
  // https://people.csail.mit.edu/bkph/papers/Absolute_Orientation.pdf
  // Combined with the forward least-squares scale, this solves the same
  // proper similarity objective as the planned Umeyama SVD formulation.
  const n=[[xx+yy+zz,yz-zy,zx-xz,xy-yx],[yz-zy,xx-yy-zz,xy+yx,zx+xz],[zx-xz,xy+yx,-xx+yy-zz,yz+zy],[xy-yx,zx+xz,yz+zy,-xx-yy+zz]];
  const e=eigen(n),largest=e.values.indexOf(Math.max(...e.values));
  const [w,x,y,z]=e.vectors.map(row=>row[largest]);
  const rotation: Mat3=[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)];
  let numerator=0,denominator=0;
  xs.forEach((p,k)=>{const r=rotate(rotation,{x:p[0],y:p[1],z:p[2]});numerator+=weights[k]*(ys[k][0]*r.x+ys[k][1]*r.y+ys[k][2]*r.z);denominator+=weights[k]*(p[0]**2+p[1]**2+p[2]**2);});
  const scale=numerator/denominator,r=rotate(rotation,cs);
  if(!Number.isFinite(scale)||scale<=0) throw new Error('Registration has no positive finite scale');
  return {rotation,scale,translation:{x:ct.x-scale*r.x,y:ct.y-scale*r.y,z:ct.z-scale*r.z}};
}

export function fitSimilarity(source: Vec3[], target: Vec3[], options: {weights?: number[]; robust?: boolean; iterations?: number; huberDelta?: number} = {}): Registration {
  if(source.length!==target.length||source.length<3||!source.every(finitePoint)||!target.every(finitePoint)) throw new Error('Registration requires matching finite 3D point arrays');
  const base=options.weights??source.map(()=>1);
  if(base.length!==source.length||base.some(w=>!Number.isFinite(w)||w<0)||base.filter(w=>w>0).length<3) throw new Error('Invalid registration weights');
  if(options.huberDelta!==undefined&&(!Number.isFinite(options.huberDelta)||options.huberDelta<=0)) throw new Error('Invalid Huber threshold');
  const iterations=options.robust===false?1:options.iterations??12;
  if(!Number.isInteger(iterations)||iterations<1||iterations>100) throw new Error('Invalid registration iteration count');
  let weights=[...base],fit=leastSquares(source,target,weights);
  for(let iteration=1;iteration<iterations;iteration++) {
    const residuals=source.map((p,i)=>distance(transform(fit,p),target[i]));
    const cutoff=options.huberDelta??Math.max(1e-9,1.5*median(residuals.filter((_,i)=>base[i]>0)));
    weights=residuals.map((r,i)=>base[i]*Math.min(1,cutoff/Math.max(r,1e-15)));
    fit=leastSquares(source,target,weights);
  }
  const residuals=source.map((p,i)=>distance(transform(fit,p),target[i]));
  const active=residuals.filter((_,i)=>base[i]>0);
  return {...fit,residuals,weights,median:median(active),rms:Math.sqrt(active.reduce((s,r)=>s+r*r,0)/active.length)};
}

export function headFrame(landmarks: Vec3[], bboxSize: number) {
  if(landmarks.length<468||!landmarks.every(finitePoint)||!Number.isFinite(bboxSize)||bboxSize<=0) throw new Error('A head frame needs 468 finite face landmarks and positive face size');
  const face=landmarks.slice(0,468),origin=centroid(face,face.map(()=>1));
  return {origin,size:bboxSize,landmarks:landmarks.map(p=>({x:(p.x-origin.x)/bboxSize,y:(p.y-origin.y)/bboxSize,z:(p.z-origin.z)/bboxSize}))};
}
