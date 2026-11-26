import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowPhaseRect, compareRowPhases } from '../src/lib/photo-workspace/native-row-layout';
import { validatePhotoProject } from '../src/lib/photo-workspace/core';

test('whole-face phases retain every source point at identical scale', () => {
  const base = {x:12,y:0,width:480,height:680};
  for (const rows of [8,40,89]) for (let phase=0;phase<17;phase++) {
    const padded = rowPhaseRect(base,rows,phase);
    assert.ok(padded.y <= base.y);
    assert.ok(padded.y+padded.height >= base.y+base.height);
    for (const sourceY of [base.y,base.y+197,base.y+base.height]) {
      const before = (sourceY-base.y)/base.height*rows*17;
      const after = (sourceY-padded.y)/padded.height*(rows+1)*17;
      assert.ok(Math.abs(after-before-phase)<1e-9);
    }
  }
});

test('phase ranking never trades an unresolved eye for a lower fit error', () => {
  assert.ok(compareRowPhases({phase:0,eyes:2,brows:0,score:9},{phase:1,eyes:1,brows:2,score:0})<0);
});

test('saved padded frames reopen, but unregistered framing changes are rejected', () => {
  const base = {x:0,y:0,width:480,height:680};
  const figure = {id:'a',name:'Face',rect:{...base},
    rowAlignment:{phase:12,contentRows:40,baseRect:base,candidates:[]},
    traceRect:rowPhaseRect(base,40,12)};
  const project = {schema:'drawloom.photo-workspace.v1',name:'Test',photo:'data:image/png;base64,AA==',figures:[figure],selected:'a'};
  assert.equal(validatePhotoProject(project).figures[0].rowAlignment?.phase,12);
  assert.throws(()=>validatePhotoProject({...project,figures:[{...figure,traceRect:{...figure.traceRect,y:-500}}]}));
  assert.throws(()=>validatePhotoProject({...project,figures:[{...figure,rowAlignment:undefined}]}));
});
