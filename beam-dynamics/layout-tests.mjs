import assert from 'node:assert/strict';
import {build,statics,maxSpans} from './solver.js';
import {changeLayout} from './span-layout.js';
import {evaluateSection} from './section-geometry.js';
import {sectionCatalog} from './section-catalog.js';
import {assertSpanSection} from './section-editor.js';
import {exchangeModel} from './exchange-model.js';
import {mgtSectionMode,writeMgt} from './export-mgt.js';
import {s2kSectionMode,writeS2k} from './export-s2k.js';

const catalog=sectionCatalog.find(s=>s.id==='H_300x150x6p5x9');
const g=evaluateSection(catalog);
const member={L:10,E:200,I:g.Ih,A:g.A,mass:7850*g.A,section:{...catalog,axis:'h'}};
const model={spans:[member],supports:['pin','roller'],loads:[{type:'line',a:0,b:10,w1:10,w2:10}],axles:[{p:60,offset:0},{p:50,offset:4}],selfWeight:false,mesh:12,mode:'static',speed:60,step:.2,dt:.01,damping:2,tail:.1,direction:1,factor:1};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6*Math.max(1,Math.abs(b)),a+' != '+b);
for(const stock of sectionCatalog){
 const p=evaluateSection(stock);assert.ok(p.A>0&&p.Ih>0&&p.Iv>0);
 for(const axis of ['h','v'])assertSpanSection({section:{...stock,axis},A:p.A,I:axis==='v'?p.Iv:p.Ih});
}
const twin=changeLayout(model,[10,10]);
assertSpanSection(twin.spans[1]);assert.notEqual(twin.spans[0].section,twin.spans[1].section);
assert.deepEqual(twin.supports,['pin','roller','roller']);assert.equal(twin.loads[0].b,20);
assert.equal(model.loads[0].b,10);assert.equal(twin.axles[1].offset,4);
const r=statics(build(twin));near(r.at(10).M,-125);near(r.reactions[1].R,125);
const single=statics(build(changeLayout(twin,[10])));near(single.at(5).M,125);
const weak=structuredClone(model);weak.spans[0].section.axis='v';weak.spans[0].I=g.Iv;
near(statics(build(weak)).at(5).D/single.at(5).D,g.Ih/g.Iv);
const ex=exchangeModel(build(weak),null,0,'base');
assert.equal(mgtSectionMode(ex.spans[0]),'equivalent');assert.equal(s2kSectionMode(ex.spans[0]),'properties');
for(const native of [writeMgt(ex),writeS2k(ex)])assert.ok(native.includes(ex.spans[0].sectionName));
const cant={...model,supports:['fixed','free']};
assert.deepEqual(changeLayout(cant,[7,3,9]).supports,['fixed','roller','roller','free']);
assert.deepEqual(changeLayout({...twin,supports:['pin','fixed','free']},[6,8,5]).supports,['pin','fixed','roller','free']);
assert.throws(()=>changeLayout(model,[2],'fixed'),/超出/);
assert.equal(changeLayout(model,[12],'fixed').loads[0].b,10);
const uneven=statics(build(changeLayout(model,[6,8,5])));
near(uneven.reactions.reduce((a,s)=>a+s.R,0),190);
near(uneven.reactions.reduce((a,s)=>a+s.R*s.x,0),190*9.5);
for(const n of [1,2,3,6,maxSpans]){
 const m=build(changeLayout(model,Array(n).fill(6)));near(statics(m).reactions.reduce((a,s)=>a+s.R,0),n*60);
}
assert.throws(()=>changeLayout(model,Array(maxSpans+1).fill(10)));
console.log('Passed span layouts, load positions, end restraints, strong/weak axes, exchange and 12-span equilibrium.');
