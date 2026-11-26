import assert from 'node:assert/strict';
import {build,statics,moving,dynamic} from './solver.js';
import {reportBlocks} from './calculation-report.js';
import {unitSystem} from './units.js';
import {wordReport} from './word-report.js';

const span = {L:10,E:200,I:.0008,mass:800};
const base = {spans:[span,span],supports:['pin','roller','roller'],
  loads:[{type:'line',a:0,b:20,w1:10,w2:10},{type:'point',x:5,p:50}],
  axles:[{p:60,offset:0},{p:120,offset:4}],mesh:8,selfWeight:false,
  direction:-1,factor:1,speed:72,step:1,dt:.01,damping:2,tail:.1};
for (const mode of ['static','moving','dynamic']) {
  const m=build({...base,mode});
  const a=mode==='static'?{frames:[{t:0,front:0,result:statics(m)}]}:await (mode==='moving'?moving(m):dynamic(m));
  const i=Math.floor(a.frames.length/2);
  for(const x of [0,5,20]){
    const u=unitSystem({force:'kgf',length:'cm'});
    const blocks=reportBlocks(m,a,i,x,u,{detail:true,history:true,project:'A&B'});
    const plain=JSON.stringify(blocks);
    assert.doesNotMatch(plain,/NaN|undefined|Infinity/);
    assert.ok(plain.includes('kgf·cm')&&plain.includes('組裝矩陣'));
    assert.ok(plain.includes(mode==='static'?'兩跨連續梁三彎矩驗算':'指定斷面逐步歷時'));
    if(mode==='static')for(const force of ['57.8125','159.375','32.8125','-171.875'])assert.ok(plain.includes(force));
    const ix=blocks.findIndex(b=>b.text==='指定斷面結果');
    assert.equal(blocks[ix+2].rows.length,x===5?2:1);
    const blob=wordReport(blocks);assert.equal(new DataView(await blob.slice(0,4).arrayBuffer()).getUint32(0),0x504b0304);
  }
  assert.throws(()=>reportBlocks(m,a,i,21,unitSystem()),/超出/);
}
console.log('BeamLab report checks passed for static, moving and dynamic analyses.');
