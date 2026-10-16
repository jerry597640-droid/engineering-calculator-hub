const assert=require('node:assert/strict'),fs=require('fs');const {calc}=require('./engine.js');const p={H:50,B:20,tw:1,tf:1.6,Fy:325,d:18,nt:2,nb:0,Lb:100,M:20,Fb:0,add:1.5};let count=0;function test(n,f){f();count++;console.log('PASS',n)}function near(a,b,t=1e-6){assert(Math.abs(a-b)<t,`${a} vs ${b}`)}
// Independent midpoint integration through depth, separate from three-rectangle parallel-axis implementation.
function integral(p){let dy=p.H/100000,A=0,Q=0,J=0;for(let i=0;i<100000;i++){let y=(i+.5)*dy,b=y<p.tf?p.B-p.nb*(p.d+p.add)/10:y>p.H-p.tf?p.B-p.nt*(p.d+p.add)/10:p.tw;A+=b*dy;Q+=b*dy*y;J+=b*dy*y*y}return {A,y:Q/A,I:J-Q*Q/A}}
test('independent integrated asymmetric section',()=>{let r=calc(p),v=integral(p);near(r.n.A,v.A,1e-5);near(r.n.y,v.y,1e-5);near(r.n.I,v.I,.01)});
test('gross rectangular hand formula',()=>{let r=calc(p);near(r.g.I,(20*50**3-19*46.8**3)/12);near(r.g.St,r.g.Sb)});
test('no holes retains 100%',()=>{let r=calc({...p,nt:0,nb:0});near(r.r,1);near(r.mn,r.m0)});
test('15 percent threshold only excess deducted',()=>{let r=calc(p);near(r.e.A,r.g.A-(3.9-3)*1.6);near(calc({...p,nt:1}).e.I,r.g.I)});
test('symmetric holes retain centered neutral axis',()=>near(calc({...p,nb:2}).n.y,25));
test('top bottom mirror',()=>{let a=calc(p),b=calc({...p,nt:0,nb:2});near(a.n.St,b.n.Sb);near(a.n.y+b.n.y,50)});
test('moment sign swaps compression',()=>assert.equal(calc({...p,M:-20}).compression,'下翼板'));
test('long Lb does not get automatic allowable',()=>{let r=calc({...p,Lb:480});assert.equal(r.auto,false);assert.equal(r.mn,null)});
test('verified external Fb can be supplied',()=>assert(calc({...p,Lb:480,Fb:1500}).mn>0));
test('actual diameter gives less reduction',()=>assert(calc({...p,add:0}).r>calc(p).r));
test('invalid or impossible geometry rejected',()=>{for(const x of [{H:1},{nt:-1},{nt:2.5},{nt:20},{Fy:NaN},{M:NaN}])assert.throws(()=>calc({...p,...x}))});
test('larger hole cannot increase net capacity',()=>{let prev=1;for(let d=5;d<50;d++){let r=calc({...p,d});assert(r.r<=prev);prev=r.r}});
test('noncompact section blocks automatic Fb',()=>assert.equal(calc({...p,tf:.4}).auto,false));
fs.writeFileSync(__dirname+'/verification.json',JSON.stringify({date:'2026-10-16',passed:count,method:'Independent 100000-strip numerical integration and analytical invariants',example:calc(p)},null,2));
