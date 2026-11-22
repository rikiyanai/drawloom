import type { HeadContext } from './solve';
import type { HeadPlanesState } from './state';
import { pinPixels } from './state';
import type { Vec3 } from './types';
import { transform, distance } from './types';
import { add, sub, mul, unit, cross, solveLinear } from './geometry';

export type Neck={top:Vec3;bottom:Vec3;radius:number;quality:string;residualPx:number};
const memo=new WeakMap<HeadContext,Map<string,Neck>>();
/** Orthographic cylinder limbs are view-dependent tangent lines, not fixed
 * material points. Top/bottom handles constrain their cross-section endpoints;
 * side pins constrain perpendicular distance to the silhouette line. */
export function neckSides(context:HeadContext,shot:string,neck:{top:Vec3;bottom:Vec3;radius:number}) {
  const view=context.shots[shot],r=view.fit.rotation,camera={x:r[6],y:r[7],z:r[8]};let side=unit(cross(sub(neck.bottom,neck.top),camera));
  const a=transform(view.fit,neck.top),b=transform(view.fit,add(neck.top,side));if(b.x<a.x)side=mul(side,-1);
  return {leftTop:add(neck.top,mul(side,-neck.radius)),rightTop:add(neck.top,mul(side,neck.radius)),leftBottom:add(neck.bottom,mul(side,-neck.radius)),rightBottom:add(neck.bottom,mul(side,neck.radius))};
}
export function fitNeck(context:HeadContext,state:HeadPlanesState,prior:{top:Vec3;bottom:Vec3;radius:number},excludeShot?:string):Neck {
  const ids=['nkl0','nkr0','nkl1','nkr1','nkl','nkr'];
  const observations=Object.entries(state.observations).filter(([shot])=>shot!==excludeShot&&context.shots[shot]).flatMap(([shot,pins])=>ids.filter(id=>pins[id]).map(id=>({shot,id,point:pinPixels(pins[id],context.shots[shot].pose)})));
  if(!observations.length)return {...prior,quality:'estimated (prior)',residualPx:0};
  const key=JSON.stringify([excludeShot,observations]),existing=memo.get(context)?.get(key);if(existing)return existing;
  const start=[prior.top.x,prior.top.y,prior.top.z,prior.bottom.x,prior.bottom.y,prior.bottom.z,Math.log(prior.radius)];
  const neck=(p:number[])=>({top:{x:p[0],y:p[1],z:p[2]},bottom:{x:p[3],y:p[4],z:p[5]},radius:Math.exp(p[6])});
  function residuals(params:number[],includePrior=true,pixels=false){
    const n=neck(params),out:number[]=[];
    for(const observation of observations){const view=context.shots[observation.shot],sides=neckSides(context,observation.shot,n),sigma=pixels?1:Math.sqrt(9+view.fit.median**2),p=observation.point;
      const key=observation.id==='nkl0'?'leftTop':observation.id==='nkr0'?'rightTop':observation.id==='nkl1'?'leftBottom':'rightBottom';
      if(observation.id==='nkl'||observation.id==='nkr'){
        const left=observation.id==='nkl',a=transform(view.fit,left?sides.leftTop:sides.rightTop),b=transform(view.fit,left?sides.leftBottom:sides.rightBottom),dx=b.x-a.x,dy=b.y-a.y;
        out.push(((p.x-a.x)*dy-(p.y-a.y)*dx)/(Math.hypot(dx,dy)||1)/sigma);
      }else{const q=transform(view.fit,sides[key]);out.push((q.x-p.x)/sigma,(q.y-p.y)/sigma);}
    }
    if(includePrior)for(let i=0;i<7;i++)out.push((params[i]-start[i])/(i===6?.35:.12));
    return out;
  }
  const cost=(p:number[])=>residuals(p).reduce((s,r)=>s+(Math.abs(r)<=2?r*r:4*Math.abs(r)-4),0);
  let parameters=[...start];
  for(let iteration=0;iteration<12;iteration++){
    const residual=residuals(parameters),jacobian=Array.from({length:7},(_,i)=>{const p=[...parameters];p[i]+=1e-5;const next=residuals(p);return next.map((r,j)=>(r-residual[j])/1e-5);}),matrix=Array.from({length:7},(_,i)=>Array.from({length:7},(_,j)=>i===j?1e-3:0)),rhs=Array(7).fill(0);
    residual.forEach((r,row)=>{const w=Math.min(1,2/Math.max(Math.abs(r),1e-9));for(let i=0;i<7;i++){rhs[i]-=w*jacobian[i][row]*r;for(let j=0;j<7;j++)matrix[i][j]+=w*jacobian[i][row]*jacobian[j][row];}});
    const step=solveLinear(matrix,rhs).map((v,i)=>Math.max(i===6?-.25:-.1,Math.min(i===6?.25:.1,v))),before=cost(parameters);let improved=false;
    for(const scale of [1,.5,.25,.125]){const candidate=parameters.map((v,i)=>v+step[i]*scale),n=neck(candidate);if(distance(n.top,n.bottom)<.05||n.radius<.01||n.radius>2)continue;if(cost(candidate)<before){parameters=candidate;improved=true;break;}}
    if(!improved||Math.hypot(...step)<1e-6)break;
  }
  const resultNeck=neck(parameters),error=residuals(parameters,false),rms=Math.sqrt(error.reduce((s,r)=>s+r*r,0)/error.length),views=new Set(observations.map(o=>o.shot)).size;
  const result={...resultNeck,quality:views<2?'estimated (one corrected view)':rms>2?'weak fit':'fitted construction',residualPx:Math.sqrt(residuals(parameters,false,true).reduce((s,r)=>s+r*r,0)/error.length)};
  const map=memo.get(context)??new Map();if(map.size>32)map.clear();map.set(key,result);memo.set(context,map);return result;
}
