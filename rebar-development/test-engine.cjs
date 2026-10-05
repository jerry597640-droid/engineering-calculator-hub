const assert=require('node:assert/strict');
const {calculate:calc,BARS,MODES}=require('./engine.js');
const base={mode:'tension',context:'ordinary',bar:'D25',fy:4200,fc:280,cover:4,spacing:10,agg:2,ktr:0,ratio:1.5,percent:100,top:false,epoxy:false,lightweight:false};
let count=0;
function ok(p,expected){const r=calc({...base,...p});assert.equal(r.errors.length,0,JSON.stringify(r.errors));assert.ok(Math.abs(r.length-expected)<1e-8,`${r.length} != ${expected}`);count++}
function bad(p){assert.ok(calc({...base,...p}).errors.length);count++}
for(const [mode,value]of Object.entries({tension:92.53364275178129,tensionLap:120.29373557731567,compression:47.81512051642242,compressionLap:77.8764,hook:76.57290129973761}))ok({mode},value);
for(const[mode,value]of Object.entries({tension:30,tensionLap:30,compression:20,hook:15}))ok({mode,bar:'D10',fy:2800,fc:700},value);
for(const p of [{fc:209.9},{fc:700.01},{fy:7000},{fy:4300},{bar:'D39'},{context:'column'},{context:'seismic'},{cover:0},{spacing:2.54},{ktr:-1},{agg:''},{agg:0},{agg:-1},{agg:NaN},{agg:Infinity},{ratio:.99,mode:'tensionLap'},{percent:100.1,mode:'tensionLap'}])bad(p);
for(const mode of Object.keys(MODES)){bad({mode,fy:5600,ktr:0});assert.equal(calc({...base,mode,fy:5600,ktr:1.27}).errors.length,0);count++}
assert.equal(calc({...base,mode:'tensionLap',ratio:2,percent:50}).extra.klass,'A');count++;
assert.equal(calc({...base,mode:'tensionLap',ratio:2,percent:50.000001}).extra.klass,'B');count++;
assert.equal(calc({...base,mode:'tension',bar:'D16',cover:4.77,spacing:11.13,epoxy:true}).extra.epoxy,1.2);count++;
assert.equal(calc({...base,mode:'tension',bar:'D16',cover:4.76999,spacing:11.13,epoxy:true}).extra.epoxy,1.5);count++;
console.log(`${count} regression assertions passed.`);
