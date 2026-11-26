import assert from 'node:assert/strict';
import {build,statics,moving,dynamic,loading} from './solver.js';
import {exchangeModel,vehicleForcingCsv} from './exchange-model.js';
import {writeMgt} from './export-mgt.js';
import {writeS2k} from './export-s2k.js';
import {materialCatalog} from './material-catalog.js';
import {builtInMaterialCsv,parseMaterialLibrary,reconcileManualSpanEdit,assertSpanMaterial} from './material-editor.js';

const mat=materialCatalog.find(m=>m.id==='SN490B'),A=.03,I=.0008;
const span={L:10,E:mat.E,A,I,mass:mat.density*A,material:mat};
const base={spans:[span,span],supports:['pin','roller','roller'],mesh:8,direction:-1,damping:2,
  axles:[{p:50,offset:0},{p:20,offset:1.35}],speed:60,tail:.1,dt:.007,step:1.1,factor:1.2,selfWeight:false,
  loads:[{type:'line',a:0,b:20,w1:10,w2:10},{type:'point',x:5,p:50}]};
const close=(a,b,tol=1e-7)=>assert.ok(Math.abs(a-b)<=tol*Math.max(1,Math.abs(b)),a+' vs '+b);
const list=parseMaterialLibrary(builtInMaterialCsv());
assert.equal(list.length,materialCatalog.length);
assert.equal(list.filter(s=>s.kind==='wood').length,8);
for(const s of list){assert.ok(s.E>0&&s.density>0);assert.match(s.source,/^https:/);}
assert.throws(()=>parseMaterialLibrary('name,kind,E,density\nx,wood,NaN,500'));
assertSpanMaterial(span);
const estimated={...span,material:{...mat},areaEstimated:true,I:.0009};reconcileManualSpanEdit(estimated,'I');close(estimated.A,Math.sqrt(12*.0009));close(estimated.mass,mat.density*estimated.A);
for(const mode of ['static','moving','dynamic']){
 const m=build({...base,mode});
 const a=mode==='dynamic'?await dynamic(m):mode==='moving'?await moving(m):{frames:[{t:0,front:0,result:statics(m)}]};
 const si=Math.floor(a.frames.length*.4);
 for(const scope of mode==='static'?['base']:mode==='moving'?['current','all']:['history','current']){
  const o=exchangeModel(m,a,si,scope),z=writeS2k(o),g=writeMgt(o);
  for(const f of [z,g]){assert.doesNotMatch(f,/NaN|Infinity|undefined|[^\x00-\x7F]/);assert.doesNotMatch(f,/(?<!\r)\n/);assert.match(f,/M1_SN490B/);}
  close(o.spans[0].width*o.spans[0].height**3/12,I);close(o.spans[0].density*o.spans[0].area*1000,span.mass);
  assert.equal(o.nodes.length,m.xs.length);assert.equal(o.nodes.filter(n=>n.uz).length,3);
  if(scope==='base'){const r=a.frames[0].result;[57.8125,159.375,32.8125].forEach((n,i)=>close(r.reactions[i].R,n));close(r.at(10).M,-171.875);}
  if(scope==='all')assert.equal(o.cases.length,a.frames.length+1);
  if(scope==='current'){
   const f=o.cases[1],target=a.frames[si].result.load.loads;
   const P=f.nodal.reduce((s,l)=>s+l.fz,0)+f.point.reduce((s,l)=>s+l.fz,0);
   close(P,-target.filter(l=>l.type==='point').reduce((s,l)=>s+l.p,0));
  }
  if(scope==='history'){
   assert.ok(z.includes('LinDirHist')&&g.includes('*DYN-NLOAD'));assert.ok(g.includes('NAME=BL_DYN'));
   assert.equal(o.history.steps,a.frames.length-1);close(o.history.alpha,a.alpha);const staticF=loading(m).F;
   const csv=vehicleForcingCsv(m,a).trim().split('\r\n');assert.equal(csv.length,a.frames.length+1);
   for(let i=0;i<a.frames.length;i++){
    const row=csv[i+1].split(',').map(Number);const f=a.frames[i];
    f.result.load.F.forEach((v,j)=>close(row[3+j],(v-staticF[j])*(j%2?-1:1)));
   }
   function valueAt(samples,t){let j=samples.findIndex(s=>s.t>=t);assert.ok(j>=0);if(!j||samples[j].t===t)return samples[j].value;const v=samples[j],w=samples[j-1];return w.value+(v.value-w.value)*(t-w.t)/(v.t-w.t);}
   for(const channel of o.history.channels){
    assert.equal(channel.samples[0].t,0);close(channel.samples.at(-1).t,a.frames.at(-1).t);
    for(let i=0;i<a.frames.length;i+=3){const f=a.frames[i],j=2*(channel.node-1)+(channel.dof==='MY'?1:0);close(valueAt(channel.samples,f.t),(f.result.load.F[j]-staticF[j])*(j%2?-1:1));}
   }
  }
 }
}
const custom=build({...base,mode:'static',spans:[span],supports:['roller','roller'],selfWeight:true,loads:[{type:'line',a:2,b:7,w1:-3,w2:7},{type:'moment',x:4.5,p:35},{type:'point',x:8,p:-6}]});
const ex=exchangeModel(custom,null,0);assert.equal(ex.anchor,1);assert.equal(ex.nodes[0].ux,true);
const f=ex.cases[0];const force=f.nodal.reduce((s,n)=>s+n.fz,0)+f.line.reduce((s,l)=>s+(l.w1+l.w2)/2*(ex.elements[l.element-1].b-ex.elements[l.element-1].a),0);
close(force,6-10-span.mass*9.80665/1000*10);close(f.nodal.reduce((s,v)=>s+v.my,0),-35);
console.log('Passed material import, profile mapping, static/position/dynamic exchange, nodal forcing and gravity checks.');
