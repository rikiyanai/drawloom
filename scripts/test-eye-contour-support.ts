import test from 'node:test';
import assert from 'node:assert/strict';
import { eyeContourSupport, eyeFootprintExcess } from '../src/lib/photo-workspace/eye-contour-support';

const lid = Array.from({length:41}, (_,x) => ({x,y:0}));
test('a fractional fitted edge retains its overlapping native raster cell', () => {
  const aperture={left:255.21,right:300.79,top:232.40,bottom:246.32};
  assert.equal(eyeFootprintExcess([{x:271,y:228},{x:278,y:234}],aperture),0);
  assert.equal(eyeFootprintExcess([{x:271,y:227}],aperture),1);
  assert.equal(eyeFootprintExcess([{x:306,y:234}],aperture),1);
});
test('a central pupil cannot stand in for the complete lid', () => {
  const result = eyeContourSupport(lid, lid.slice(12,29));
  assert.equal(result.corners, false);
  assert.ok(result.longestGap > 6);
});
test('two corners alone expose the missing intervening contour', () => {
  const result = eyeContourSupport(lid, [...lid.slice(0,5),...lid.slice(36)]);
  assert.equal(result.corners, true);
  assert.ok(result.longestGap > 20);
});
test('cooperating runs can preserve a small native glyph gap', () => {
  const result = eyeContourSupport(lid, [...lid.slice(0,19),...lid.slice(22)]);
  assert.equal(result.corners, true);
  assert.ok(result.coverage > .9);
  assert.ok(result.longestGap <= 6);
});
test('gap size follows curve length rather than sampling density', () => {
  const sparse = lid.filter((_,i) => i%2===0);
  const ink = [...lid.slice(0,9),...lid.slice(32)];
  const denseResult = eyeContourSupport(lid,ink), sparseResult = eyeContourSupport(sparse,ink);
  assert.ok(Math.abs(denseResult.longestGap-sparseResult.longestGap) <= 2);
});
test('two isolated corners leave an unsupported middle', () => {
  const result = eyeContourSupport(lid, [lid[0],lid.at(-1)!]);
  assert.equal(result.corners, true);
  assert.ok(result.longestGap > 30);
  assert.ok(result.coverage < .2);
});
test('support follows a tilted curved lid in either direction', () => {
  const curve = lid.map(p => ({x:p.x,y:10-Math.sin(p.x/40*Math.PI)*4+p.x*.2}));
  const forward = eyeContourSupport(curve,curve);
  const reverse = eyeContourSupport([...curve].reverse(),curve);
  assert.equal(forward.corners, true);
  assert.equal(forward.coverage, 1);
  assert.equal(forward.longestGap, 0);
  assert.deepEqual(forward,reverse);
});
