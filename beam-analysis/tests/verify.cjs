const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const B=require('../beam-core.js');
const clone=x=>JSON.parse(JSON.stringify(x));
let assertions=0;
function near(actual,expected,label,rel=2e-9,abs=1e-8){assert.ok(Math.abs(actual-expected)<=abs+rel*Math.abs(expected),`${label}: ${actual} != ${expected}`);assertions++;}
function run(m){const c=B.compile(m),s=B.solve(c),a=B.summarize(s,m);near(s.balance.force,0,'force equilibrium');near(s.balance.moment,0,'moment equilibrium');for(const r of s.reactions){near(B.evaluate(s,r.x).y,-r.settlement/1000,'support displacement',1e-8,1e-9);if(r.type==='fixed')near(B.evaluate(s,r.x).theta,0,'fixed rotation',1e-8,1e-9);}return {c,s,a};}
const reference=[];
for(const name of ['uniform','point','cantilever','fixed','continuous','triangle','moment']){
 const m=B.example(name),{s,a}=run(m);
 if(name==='uniform'){near(s.reactions[0].R,30,name+' RA');near(s.reactions[1].R,30,name+' RB');near(a.Mplus.value,45,name+' M');near(a.Dabs.value,10.546875,name+' d');}
 if(name==='point'){near(s.reactions[0].R,10,name+' RA');near(a.Mplus.value,30,name+' M');near(a.Dabs.value,5.625,name+' d');}
 if(name==='cantilever'){near(s.reactions[0].R,20,name+' R');near(s.reactions[0].C,60,name+' C');near(a.Mminus.value,60,name+' M');near(a.Dabs.value,11.25,name+' d');}
 if(name==='fixed'){near(s.reactions[0].C,30,name+' CA');near(s.reactions[1].C,-30,name+' CB');near(a.Mminus.value,30,name+' Mneg');near(a.Mplus.value,15,name+' Mpos');near(a.Dabs.value,2.109375,name+' d');}
 if(name==='continuous'){near(s.reactions[0].R,22.5,name+' RA');near(s.reactions[1].R,75,name+' RB');near(s.reactions[2].R,22.5,name+' RC');near(a.Mminus.value,45,name+' Mneg');near(a.Mplus.value,25.3125,name+' Mpos');near(a.Mplus.x,2.25,name+' xpos');}
 if(name==='triangle'){near(s.reactions[0].R,12,name+' RA');near(s.reactions[1].R,24,name+' RB');near(a.Mplus.value,16*Math.sqrt(3),name+' M');near(a.Mplus.x,Math.sqrt(12),name+' x');}
 if(name==='moment'){near(s.reactions[0].R,20/6,name+' RA');near(s.reactions[1].R,-20/6,name+' RB');near(B.evaluate(s,3,'left').M-B.evaluate(s,3,'right').M,20,'moment jump');near(B.evaluate(s,3,'left').V,B.evaluate(s,3,'right').V,'couple no shear jump');}
 reference.push({name,reactions:s.reactions,Mplus:a.Mplus,Mminus:a.Mminus,Dabs:a.Dabs});
}
// Off-node point: forces and exact interior displacement, not only Hermite interpolation.
{const m=B.example('point');m.loads[0].x=1.234;const {s}=run(m),a=1.234,b=m.length-a;near(s.reactions[0].R,20*b/m.length,'off-node RA');near(B.evaluate(s,a).y,-20*a*a*b*b/(3*s.EI*m.length),'off-node y');near(B.evaluate(s,a,'right').V-B.evaluate(s,a,'left').V,-20,'point jump');}
// Linearly changing load over part of the span: total force and centroid.
{const m=B.example();m.loads=[{type:'distributed',group:'D',a:1,b:4,q0:3,q1:9}];const {s}=run(m),Q=18,centroid=1+3*(3+2*9)/(3*(3+9));near(s.reactions[1].R,Q*centroid/6,'partial trapezoid RB');}
// Reversed cantilever and end couple.
{const m=B.example('cantilever');m.supports[0].x=3;m.loads[0].x=0;const {s,a}=run(m);near(s.reactions[0].C,-60,'right cantilever C');near(a.Mminus.value,60,'right cantilever M');near(B.evaluate(s,0).y,-.01125,'right cantilever deflection');}
{const m=B.example('cantilever');m.loads=[{type:'moment',group:'L',x:3,value:20}];const {s}=run(m);near(s.reactions[0].C,-20,'tip couple reaction');near(B.evaluate(s,3).y,20*9/(2*s.EI),'tip couple deflection');}
// Support settlement rigid translation and rotation produce no flexural demand in a simple beam.
{const m=B.example();m.loads=[];m.supports[0].settlement=5;m.supports[1].settlement=11;const {s,a}=run(m);near(s.reactions[0].R,0,'settlement R');near(B.evaluate(s,2).y,-.007,'linear settlement');near(a.deflection.value,0,'relative settlement deflection');assert.equal(a.deflection.span,1);assertions++;}
// Self weight is D only; strength factors do not amplify imposed support settlement.
{const m=B.example();m.loads=[];m.selfWeight=true;m.A=50;m.gamma=77;m.factors={D:1.4,L:0,X:0};m.combination='rc14';const {s}=run(m);near(s.reactions[0].R,77*50*1e-4*1.4*3,'self weight');}
// Geometry and unit conversion.
{const p=B.section('rectangle',{b:20,h:40});near(p.I,20*40**3/12,'rect I');near(p.Splus,20*40**2/6,'rect S');near(p.shearFactor,15/800,'rect shear');const h=B.section('h',{h:30,b:15,tw:.65,tf:.9});near(h.A,2*15*.9+28.2*.65,'H area');near(1*B.G,9.80665,'tf unit');near(B.G/1000,.00980665,'kgf unit');}
// Independent superposition and sign reversal.
{const p=B.example('point'),q=B.example(),both=clone(p);both.loads.push(q.loads[0]);const sp=run(p).s,sq=run(q).s,sb=run(both).s;for(const x of [0,1,2.77,3,5.25,6])for(const k of ['V','M','y','theta'])near(B.evaluate(sb,x)[k],B.evaluate(sp,x)[k]+B.evaluate(sq,x)[k],'superposition '+k);both.loads.forEach(l=>{if(l.type==='distributed'){l.q0*=-1;l.q1*=-1;}else l.value*=-1;});const sn=run(both).s;near(B.evaluate(sn,2.5).M,-B.evaluate(sb,2.5).M,'sign reversal');}
// No false pass from missing data or incorrect service/strength basis.
{const m=B.example(),{a}=run(m);let c=B.checks(m,a,a);assert.equal(c.items[0].status,'待確認');assert.equal(c.items.find(r=>r.name==='彎曲彈性應力').status,'未啟用');assertions+=2;m.checks.Mplus=100;m.checks.V=50;m.checks.capacitySource='Example verified capacity';m.checks.defSource='Project L/360';c=B.checks(m,a,a);assert.equal(c.items[0].status,'通過');assert.equal(c.overall,'所列容量比對通過');m.checks.basis='strength';c=B.checks(m,a,a);assert.equal(c.items[0].status,'待確認');assertions+=3;m.checks.basis='service';m.combination='custom-service';assert.equal(B.checks(m,a,a).compatible,true);m.checks.fb=150;m.Splus=0;c=B.checks(m,a,a);assert.equal(c.items.find(r=>r.name==='彎曲彈性應力').status,'待確認');assertions+=2;}
for(const mutate of [m=>m.E=0,m=>m.I=-1,m=>m.supports=[{x:2,type:'roller',settlement:0}],m=>m.supports[1].x=0,m=>m.loads[0].a=-1,m=>m.loads[0].b=7,m=>m.loads[0].q0=NaN,m=>m.vehicle={...m.vehicle,enabled:true,step:0},m=>m.vehicle={...m.vehicle,enabled:true,axles:[{offset:1,p:20}]},m=>m.checks.defDen=0]){const m=B.example();mutate(m);assert.throws(()=>B.compile(m));assertions++;}
// Random mixed loads used by a different Python flexibility/compatibility solver.
let seed=712345;function random(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;}
const fixtures=[];
for(let i=0;i<60;i++){const m=B.example();m.title='independent-'+i;m.length=4+random()*14;m.E=30000+random()*200000;m.I=2500+random()*22000;const L=m.length,preset=i%6;const points=preset===0?[0,L]:preset===1?[0]:preset===2?[L]:preset===3?[0,L/2,L]:preset===4?[L*.12,L*.47,L*.83]:[0,L*.33,L*.72,L];m.supports=points.map((x,j)=>({x,type:(preset===1||preset===2||preset===5&&j===0)?'fixed':j===0?'pin':'roller',settlement:(random()-.5)*6}));m.loads=[];for(let j=0;j<5;j++){const type=j%3===0?'point':j%3===1?'moment':'distributed',base={type,group:['D','L','X'][j%3],enabled:true};if(type==='distributed'){const a=random()*L*.7,b=a+(L-a)*(.15+random()*.85);m.loads.push({...base,a,b,q0:(random()-.3)*15,q1:(random()-.3)*20});}else m.loads.push({...base,x:random()*L,value:(random()-.35)*60});}m.combination='custom-service';m.factors={D:1.1,L:1.3,X:-.7};const {s,a}=run(m);const at=[0,L*.071,L*.233,L*.523,L*.817,L,...m.supports.map(s=>s.x)];fixtures.push({model:m,solution:s,at:at.map(x=>B.evaluate(s,x)),summary:{Mplus:a.Mplus,Mminus:a.Mminus,Vabs:a.Vabs,Dabs:a.Dabs}});}
async function main(){
 const m=B.example('point');m.loads=[];m.vehicle.enabled=true;m.vehicle.axles=[{offset:0,p:20}];m.vehicle.step=.17;m.vehicle.position=1;m.vehicle.impact=.3;m.vehicle.share=.5;
 const env=await B.envelope(B.compile(m));const P=20*1.3*.5;near(env.governing.Mplus.result.value,P*6/4,'moving single axle moment');near(env.governing.Dabs.result.value,P*216/(48*16000)*1000,'moving single axle displacement');assert.ok(env.converged);assertions++;near(env.reactions[0].Rmax,P,'moving support axle');near(env.maxGap<=m.vehicle.step/2+1e-9?0:1,0,'max scan gap');
 const forward=B.example('vehicle');forward.vehicle.impact=.15;const ec=B.compile(forward),s=B.solve(ec);for(const p of s.loads.filter(l=>l.vehicle))near(p.value,forward.vehicle.axles[Number(p.name.split(' ')[1])-1].p*1.15,'impact exactly once');const test=clone(forward);test.vehicle.position=-3;const vloads=B.loadsFor(test,test.factors).filter(l=>l.vehicle);assert.equal(vloads.length,2);assertions++;test.vehicle.reverse=true;const rv=B.loadsFor(test,test.factors).filter(l=>l.vehicle);assert.equal(rv.length,1);assertions++;
 const e1=await B.envelope(ec),reverse=clone(forward);reverse.vehicle.reverse=true;const e2=await B.envelope(B.compile(reverse));near(e1.governing.Mplus.result.value,e2.governing.Mplus.result.value,'symmetric beam reverse moving max',1e-5);assertions++;
 const report={version:B.VERSION,assertions,referenceCases:reference.length,independentCases:fixtures.length,vehicleCases:3,reference,vehicle:{singleAxle:{Mplus:env.governing.Mplus.result.value,Dabs:env.governing.Dabs.result.value,count:env.count,changes:env.changes},threeAxle:{Mplus:e1.governing.Mplus.result.value,changes:e1.changes}}};fs.writeFileSync(path.join(__dirname,'fixtures.json'),JSON.stringify(fixtures));fs.writeFileSync(path.join(__dirname,'numerical-validation.json'),JSON.stringify(report,null,2));console.log(`PASS: ${assertions} assertions; ${reference.length} closed-form reference cases; ${fixtures.length} mixed-load independent fixtures; moving-load tests.`);
}
main().catch(e=>{console.error(e);process.exit(1)});
