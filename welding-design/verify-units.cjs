const assert=require('node:assert/strict'),U=require('./units.js'),{analyze}=require('./engine.js');
const s={version:1,basis:'TW',method:'ASD',F:70,w:6,t1:12,t2:12,endLoaded:true,seg:[[0,0,0,30],[20,0,20,30]],loads:[[25,15,8,2,-10,5,1,-2,3]]};
const kg=U.convertLoads(s.loads,'tf','kgf');assert.deepEqual(kg,[[25,15,8,2000,-10000,5000,1000,-2000,3000]]);
const restored=U.restore({...s,loads:kg,forceUnit:'kgf',displayUnit:'kgf'});assert.deepEqual(restored.loads,s.loads);assert.equal(analyze(restored).ratio,analyze(s).ratio);
assert.deepEqual(U.restore(s).loads,s.loads);assert.equal(U.restore(s).displayUnit,'tf');assert.throws(()=>U.restore({...s,forceUnit:'kg'}));
let a=s.loads;for(let i=0;i<100;i++)a=U.convertLoads(U.convertLoads(a,'tf','kgf'),'kgf','tf');assert.deepEqual(a,s.loads);
const r=analyze({...s,loads:[[25,15,0,0,-10,0,0,0,0]]});assert.equal((r.critical.q/9.80665).toFixed(3),'37.646');assert.equal((r.my/9806.65).toFixed(3),'0.000');assert.equal(r.mz/9806.65,-1500);console.log('kgf / tf forces, moments, geometry, round-trip, old JSON and sample outputs: PASS');
