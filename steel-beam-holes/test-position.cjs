const assert=require('node:assert/strict'),fs=require('node:fs');
const {calc,withPosition,calcCombined}=require('./engine.js');
const raw={H:50,B:20,tw:1,tf:1.6,Fy:325,d:18,nt:2,nb:2,Lb:100,M:20,Fb:0,add:1.5};
const tests=[];function test(n,fn){fn();tests.push(n)}
function near(a,b,t=1e-6){assert(Math.abs(a-b)<t,`${a} versus ${b}`)}
// Independent depth strips; no use of section() or its parallel-axis sums.
function integrate(p){const dy=p.H/200000;let A=0,Q=0,J=0;for(let i=0;i<200000;i++){const y=(i+.5)*dy,b=y<p.tf?p.B-p.nb*(p.d+p.add)/10:y>p.H-p.tf?p.B-p.nt*(p.d+p.add)/10:p.tw;A+=b*dy;Q+=b*dy*y;J+=b*dy*y*y}const y=Q/A,I=J-Q*Q/A;return{A,y,I,St:I/(p.H-y),Sb:I/y}}
test('four positions mask inactive flange counts',()=>{for(const [pos,nt,nb]of [['top',2,0],['bottom',0,2],['both',2,2],['web',0,0],['combined',2,2]]){const p=withPosition(raw,pos);assert.equal(p.nt,nt);assert.equal(p.nb,nb)}});
test('mapping never changes saved raw field values',()=>{withPosition(raw,'top');assert.equal(raw.nb,2)});
const examples=[];
for(const [position,name]of [['top','上翼板'],['bottom','下翼板'],['both','上下翼板']])test(name+' independently integrated net section',()=>{
 const p=withPosition(raw,position),r=calc(p),q=integrate(p);near(r.n.A,q.A,1e-6);near(r.n.y,q.y,1e-6);near(r.n.I,q.I,.003);near(r.n.St,q.St,.0002);near(r.n.Sb,q.Sb,.0002);
 examples.push({position,name,nt:p.nt,nb:p.nb,area:r.n.A,centroid:r.n.y,I:r.n.I,St:r.n.St,Sb:r.n.Sb,retention:r.r*100,Mnet:r.mn,max_integration_error_I:Math.abs(r.n.I-q.I)});
});
test('top and bottom mirror without changing conservative moment reference',()=>{const a=calc(withPosition(raw,'top')),b=calc(withPosition(raw,'bottom'));near(a.n.y+b.n.y,raw.H);near(a.n.St,b.n.Sb);near(a.mn,b.mn)});
test('equal holes on both flanges retain central centroid',()=>near(calc(withPosition(raw,'both')).n.y,25));
test('both flanges reduce capacity more than one flange',()=>assert(calc(withPosition(raw,'both')).mn<calc(withPosition(raw,'top')).mn));
test('moment sign changes compression flange without moving the holes',()=>{const a=withPosition({...raw,M:-20},'top');assert.equal(calc(a).compression,'下翼板');assert.equal(a.nt,2);assert.equal(a.nb,0)});
test('zero holes remains a supported baseline',()=>near(calc(withPosition({...raw,nt:0,nb:0},'both')).r,1));
test('unknown position is rejected',()=>assert.throws(()=>withPosition(raw,'flange-and-web')));
const combinedExamples=[];
test('combined flange/web net section independently integrated',()=>{for(const flangePosition of ['top','bottom','both']){const p=withPosition(raw,'combined',flangePosition),w={ho:20,e:2},r=calcCombined(p,w);const dy=p.H/200000;let A=0,Q=0,J=0;for(let i=0;i<200000;i++){const y=(i+.5)*dy;let b=y<p.tf?p.B-p.nb*(p.d+p.add)/10:y>p.H-p.tf?p.B-p.nt*(p.d+p.add)/10:p.tw;if(y>p.H/2+w.e-w.ho/2&&y<p.H/2+w.e+w.ho/2)b=0;A+=b*dy;Q+=b*dy*y;J+=b*dy*y*y}near(r.n.A,A,1e-6);near(r.n.y,Q/A,1e-6);near(r.n.I,J-Q*Q/A,.003);assert.equal(r.pass,false);combinedExamples.push({flangePosition,area:r.n.A,centroid:r.n.y,I:r.n.I,Mnet:r.mn,retention:r.r*100})}});
test('combined reflected openings mirror net section',()=>{const a=calcCombined(withPosition(raw,'combined','top'),{ho:20,e:2}),b=calcCombined(withPosition(raw,'combined','bottom'),{ho:20,e:-2});near(a.n.y+b.n.y,50);near(a.mn,b.mn)});
test('combined web opening cannot increase section modulus reference',()=>{const p=withPosition(raw,'combined','both');assert(calcCombined(p,{ho:20,e:0}).mn<calc(p).mn)});
test('combined holes touching a flange are rejected',()=>assert.throws(()=>calcCombined(raw,{ho:49,e:0})));
fs.writeFileSync(__dirname+'/position-verification.json',JSON.stringify({date:'2026-10-17',passed:tests.length,method:'TW ASD 4.1/4.2 rules + independently integrated 200000 depth strips; not a published flange-hole case',sources:['https://www.nlma.gov.tw/uploads/files/e7c2c9d73eefc69beecde12336374b9b.pdf','https://www.nlma.gov.tw/uploads/files/91bbcbd01a38582e6c5b1f00dd367683.pdf'],tests,inputs:raw,examples,combinedInputs:{ho:20,e:2},combinedExamples},null,2));
const f=x=>x.toFixed(3);
fs.writeFileSync(__dirname+'/position-validation.html','<div class="table"><table><thead><tr><th>位置</th><th>上／下孔數</th><th>形心自梁底 cm</th><th>Ix cm⁴</th><th>淨模數保留率</th><th>彎矩參考 tf·m</th></tr></thead><tbody>'+examples.map(q=>`<tr><td>${q.name}</td><td>${q.nt}／${q.nb}</td><td>${f(q.centroid)}</td><td>${f(q.I)}</td><td>${f(q.retention)}%</td><td>${f(q.Mnet)}</td></tr>`).join('')+'</tbody></table></div>');
console.log(JSON.stringify({passed:tests.length,examples},null,2));
