type Point = { x: number; y: number };

export function eyeFootprintExcess(ink:Point[], aperture:{left:number;right:number;top:number;bottom:number}, margin=4) {
  // Ink coordinates address raster cells. Quantize the continuous fitted
  // envelope outward before comparing; a fractional boundary must not reject
  // an overlapping edge cell and eliminate every native row phase.
  const left=Math.floor(aperture.left-margin),right=Math.ceil(aperture.right+margin);
  const top=Math.floor(aperture.top-margin),bottom=Math.ceil(aperture.bottom+margin);
  return ink.reduce((excess,p)=>Math.max(excess,left-p.x,p.x-right,top-p.y,p.y-bottom),0);
}

// Measure the complete lid, including its corners. A compact iris can cover
// enough central samples to pass an average while leaving both returns blank.
export function eyeContourSupport(curve: Point[], ink: Point[], tolerance = 2.5) {
  if (!curve.length || !ink.length) return { corners: false, coverage: 0, longestGap: Infinity };
  const supported = curve.map(p => ink.some(q => (p.x-q.x)**2+(p.y-q.y)**2 <= tolerance*tolerance));
  let length = 0, covered = 0, gap = 0, longestGap = 0;
  for (let i = 1; i < curve.length; i++) {
    const step = Math.hypot(curve[i].x-curve[i-1].x, curve[i].y-curve[i-1].y);
    length += step;
    covered += step * (Number(supported[i-1])+Number(supported[i])) / 2;
    if (supported[i-1] && supported[i]) gap = 0;
    else { gap += step; longestGap = Math.max(longestGap, gap); }
  }
  return { corners: supported[0] && supported.at(-1)!, coverage: length ? covered/length : 1, longestGap };
}
