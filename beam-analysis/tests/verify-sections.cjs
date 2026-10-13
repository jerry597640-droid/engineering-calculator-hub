const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const S=require('../section-library.js'),B=require('../beam-core.js'),bytes=fs.readFileSync(path.join(__dirname,'../../steel-sections/section-data.json')),data=JSON.parse(bytes);let checks=0;
const near=(a,b,name)=>{assert.ok(Math.abs(a-b)<=1e-10*Math.max(1,Math.abs(b)),name+': '+a+' != '+b);checks++;};
assert.deepEqual(S.list(),[...data.catalog,...data.examples]);assert.equal(data.catalog.length,98);assert.equal(data.examples.length,31);assert.equal(S.meta.sha256,crypto.createHash('sha256').update(bytes).digest('hex'));checks+=4;
for(const r of S.list()){
 for(const k of ['A','W','Ix','Iy','Sx','Sy','rx','ry']){assert.ok(Number.isFinite(r[k])&&r[k]>0,r.id+' '+k);checks++;}
 if(r.type==='L'){assert.throws(()=>S.beamValues(r,'x'),/耦合/);checks++;continue;}
 for(const axis of ['x','y']){const v=S.beamValues(r,axis);near(v.A,r.A,r.id+' A');near(v.I,r[axis==='x'?'Ix':'Iy'],r.id+' I');near(v.Splus,r[axis==='x'?'Sx':'Sy'],r.id+' S');near(v.Sminus,v.Splus,r.id+' conservative S');near(v.gamma*v.A*1e-4,r.W*B.G/1000,r.id+' self-weight');assert.deepEqual(S.restore(S.snapshot(r,axis)).record,r);checks++;}
}
const H=S.get('CH-21');assert.equal(H.name,'H-300×150×6.5×9');near(H.A,46.78,'manufacturer A');near(H.W,36.7,'manufacturer W');near(H.Ix,7210,'manufacturer Ix');near(H.Iy,508,'manufacturer Iy');near(H.Sx,481,'manufacturer Sx');near(H.Sy,68,'manufacturer Sy');
const simple=S.custom({type:'H',H:300,B:150,tw:6.5,tf:9});near(simple.A,45.33,'no-fillet H area');assert.notEqual(simple.A,H.A);checks++;
const geometry=B.section('h',{h:30,b:15,tw:.65,tf:.9});near(simple.Ix,geometry.I,'separate cm/mm geometry paths');near(simple.Sx,geometry.Splus,'H modulus cm/mm');
for(const r of data.examples){const reference=S.calculate(r);for(const k of ['A','W','Ix','Iy','Sx','Sy'])near(reference[k],r[k],r.id+' same-tool geometry');}
const pipe=S.custom({type:'CHS',D:100,t:4});near(pipe.A,Math.PI*(100**2-92**2)/400,'pipe area closed form');near(pipe.Ix,Math.PI*(100**4-92**4)/640000,'pipe inertia closed form');
for(const axis of ['x','y']){const m=B.example();Object.assign(m,S.beamValues(H,axis));const s=B.solve(B.compile(m)),a=B.summarize(s,m);near(a.Dabs.value,5*10*6**4/(384*m.E*m.I*1e-5)*1000,'selected-axis beam displacement');m.selfWeight=true;const t=B.solve(B.compile(m));near(t.reactions[0].R,(10+36.7*B.G/1000)*3,'catalog mass-to-force support reaction');}
const packet={schema:'steel-sections-custom-v2',unit:'mm',sections:[{id:'USER-A',type:'C',H:100,B:50,t:2.3,lip:20,label:'加工C'}]};const imported=S.importBackup(packet)[0];near(imported.A,5.4142,'custom backup C area');assert.equal(imported.origin,'custom');assert.deepEqual(S.restore(S.snapshot(imported,'y')).record,imported);checks+=2;
for(const bad of [{...packet,unit:'cm'},{...packet,sections:[{...packet.sections[0],t:60}]},{...packet,sections:[packet.sections[0],packet.sections[0]]}]){assert.throws(()=>S.importBackup(bad));checks++;}
const spoof={...H,A:45.33};assert.throws(()=>S.resolve(spoof),/不符/);assert.throws(()=>S.restore({...S.snapshot(H,'x'),datasetSha256:'0'.repeat(64)}),/版本/);assert.throws(()=>S.beamValues(H,'z'));checks+=3;
const result={status:'passed',checks,catalog:98,examples:31,sourceSha256:S.meta.sha256,method:'Exact shared-data comparison; axis/weight mapping; separate cm/mm H formulas; pipe and beam closed forms; snapshot/import validation'};fs.writeFileSync(path.join(__dirname,'sections-validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
