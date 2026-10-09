const assert=require('node:assert/strict'),E=require('./joints.js'),W=require('./engine.js');
const s={type:'PJP',method:'ASD',mode:'shear',t:12,t2:12,F:70,Fy:2500,length:30,te:6,count:4,diameter:21,depth:12,slotLength:60,pitch:84,pitchL:120,P:5000,bm:20000,qualified:true};
const f=70*6.894757293168,g=9.80665;let r=E.analyze(s);assert.equal(r.area,1800);assert(Math.abs(r.capacity-.3*f*1800/g)<1e-9);assert(r.pass);
r=E.analyze({...s,method:'LRFD',mode:'tension'});assert(Math.abs(r.capacity-.8*.6*f*1800/g)<1e-9);
r=E.analyze({...s,type:'CJP',method:'LRFD',mode:'shear'});assert.equal(r.area,3600);assert(Math.abs(r.capacity-.8*.6*f*3600/g)<1e-9);
r=E.analyze({...s,type:'CJP',mode:'tension'});assert(Math.abs(r.capacity-.6*2500*36)<1e-9);
r=E.analyze({...s,type:'PLUG'});assert(Math.abs(r.area-4*Math.PI*21**2/4)<1e-10);assert(r.pass);
r=E.analyze({...s,type:'SLOT'});assert(Math.abs(r.area-4*(21*(60-21)+Math.PI*21**2/4))<1e-10);assert(r.pass);
assert(!E.analyze({...s,bm:0}).pass);assert(!E.analyze({...s,qualified:false}).pass);assert(!E.analyze({...s,type:'PLUG',diameter:20}).pass);assert.throws(()=>E.analyze({...s,type:'PLUG',mode:'tension'}));assert.throws(()=>E.analyze({...s,type:'SLOT',slotLength:20}));assert.throws(()=>E.analyze({...s,te:13}));assert.throws(()=>E.analyze({...s,P:-10}));
const base={basis:'TW',method:'ASD',w:6,t1:12,t2:12,F:70,loads:[[0,0,0,0,-1,0,0,0,0]],seg:[[0,0,0,42]],endLoaded:false};assert(W.analyze(base).pass);assert(!W.analyze({...base,seg:[[0,0,0,42.1]]}).pass);assert(!W.analyze({...base,seg:[[0,0,0,22],[0,22,0,44]]}).pass);assert(W.analyze({...base,basis:'AISC',endLoaded:true,seg:[[0,0,0,50]]}).pass);assert(!W.analyze({...base,basis:'AISC',endLoaded:true,seg:[[0,0,0,61]]}).pass);assert(!W.analyze({...base,intermittent:true,seg:[[0,0,0,3]]}).pass);assert(W.analyze({...base,intermittent:true,seg:[[0,0,0,4]]}).pass);
console.log('CJP/PJP strengths, hole/slot area, validation, WPS and mother gates; TW70s/AISC100s, contiguous split, intermittent40mm: PASS');

for(const type of ['CJP','PJP','PLUG','SLOT'])for(const method of ['ASD','LRFD'])for(const mode of (['CJP','PJP'].includes(type)?['tension','shear']:['shear'])){const r=E.analyze({...s,type,method,mode});const area=type==='CJP'?3600:type==='PJP'?1800:type==='PLUG'?4*Math.PI*21**2/4:4*(21*39+Math.PI*21**2/4);const fd=type==='CJP'&&mode==='tension'?(method==='ASD'?.6:.9)*2500*.0980665:(method==='ASD'?.3:type==='CJP'||mode==='tension'?.48:.45)*f;assert(Math.abs(r.capacity-fd*area/g)<1e-8);}
console.log('All four forms × both methods × supported force modes match independent area/strength substitution: PASS');
