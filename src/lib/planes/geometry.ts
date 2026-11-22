import { barycentric } from './mesh';
import type { Vec3 } from './types';
export const add=(a:Vec3,b:Vec3):Vec3=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
export const sub=(a:Vec3,b:Vec3):Vec3=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
export const mul=(a:Vec3,s:number):Vec3=>({x:a.x*s,y:a.y*s,z:a.z*s});
export const dot=(a:Vec3,b:Vec3)=>a.x*b.x+a.y*b.y+a.z*b.z;
export const cross=(a:Vec3,b:Vec3):Vec3=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
export const unit=(a:Vec3)=>mul(a,1/(Math.hypot(a.x,a.y,a.z)||1));
export const mean=(a:Vec3,b:Vec3)=>mul(add(a,b),.5);
export function normal(points:Vec3[]):Vec3 {
  let n:Vec3={x:0,y:0,z:0};
  points.forEach((a,i)=>{const b=points[(i+1)%points.length];n=add(n,{x:(a.y-b.y)*(a.z+b.z),y:(a.z-b.z)*(a.x+b.x),z:(a.x-b.x)*(a.y+b.y)});});
  return unit(n);
}
export function inPolygon(p:{x:number;y:number},vertices:{x:number;y:number}[]) {
  let inside=false;
  for(let i=0,j=vertices.length-1;i<vertices.length;j=i++) {const a=vertices[i],b=vertices[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}
  return inside;
}
export function solveLinear(matrix:number[][],rhs:number[]):number[] {
  const n=matrix.length;
  const a=matrix.map((row,i)=>[...row,rhs[i]]);
  for(let i=0;i<n;i++) {
    let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(a[j][i])>Math.abs(a[pivot][i]))pivot=j;
    [a[i],a[pivot]]=[a[pivot],a[i]];
    if(Math.abs(a[i][i])<1e-12)throw Error('The 3D solve is underdetermined');
    const scale=a[i][i];for(let k=i;k<=n;k++)a[i][k]/=scale;
    for(let j=0;j<n;j++)if(j!==i){const s=a[j][i];for(let k=i;k<=n;k++)a[j][k]-=s*a[i][k];}
  }
  return a.map(row=>row[n]);
}
export function solve3(matrix:number[][],rhs:number[]):Vec3 {const[x,y,z]=solveLinear(matrix,rhs);return {x,y,z};}
export function depthBuffer(points:Vec3[],triangles:[number,number,number][],width:number,height:number) {
  const scale=Math.min(1,256/width),w=Math.max(1,Math.ceil(width*scale)),h=Math.max(1,Math.ceil(height*scale));
  const data=new Float32Array(w*h).fill(Infinity);
  for(const triangle of triangles){
    const [a,b,c]=triangle.map(i=>({...points[i],x:points[i].x*scale,y:points[i].y*scale}));
    const left=Math.max(0,Math.floor(Math.min(a.x,b.x,c.x))),right=Math.min(w-1,Math.ceil(Math.max(a.x,b.x,c.x)));
    const top=Math.max(0,Math.floor(Math.min(a.y,b.y,c.y))),bottom=Math.min(h-1,Math.ceil(Math.max(a.y,b.y,c.y)));
    for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
      const weights=barycentric({x:x+.5,y:y+.5},a,b,c);if(!weights||weights.some(v=>v<0))continue;
      const z=weights[0]*a.z+weights[1]*b.z+weights[2]*c.z;data[y*w+x]=Math.min(data[y*w+x],z);
    }
  }
  return {at:(x:number,y:number)=>x>=0&&y>=0&&x*scale<w&&y*scale<h?data[Math.floor(y*scale)*w+Math.floor(x*scale)]:Infinity};
}
