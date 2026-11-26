import assert from 'node:assert/strict';
import {closestFrame,movingAtDistance} from './live-loads.js';
import {build,moving,statics,envelope,axleLoads} from './solver.js';

const c={spans:[{L:10,E:200,I:.0008,mass:800}],supports:['pin','roller'],loads:[],
  axles:[{p:60,offset:0},{p:90,offset:2}],mode:'moving',mesh:8,selfWeight:false,
  direction:1,factor:1,speed:60,step:1,dt:.01,damping:2,tail:0};
for(const direction of [1,-1]){
  const model=build({...c,direction}),sweep=await moving(model),original=sweep.frames.length;
  const {analysis,index}=movingAtDistance(sweep,model,4.321,statics);
  assert.equal(analysis.frames[index].front,4.321);
  assert.equal(analysis.frames.length,original+1);
  assert.equal(sweep.frames.length,original);
  const loads=axleLoads(model,4.321);
  assert.equal(loads[0].x,direction===1?4.321:10-4.321);
  const r=analysis.frames[index].result.reactions;
  assert.ok(Math.abs(r[0].R+r[1].R-150)<1e-7);
  assert.deepEqual(analysis.envelope,envelope(model,analysis.frames));
  const existing=movingAtDistance(sweep,model,sweep.frames[2].front,statics);
  assert.equal(existing.analysis,sweep);assert.equal(existing.index,2);
  assert.equal(closestFrame(sweep.frames,-1),0);
  assert.equal(closestFrame(sweep.frames,100),original-1);
}
console.log('Exact vehicle stations, axle directions, reactions and envelope frame indices verified.');
