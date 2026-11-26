import assert from 'node:assert/strict';
import {build,statics,moving,dynamic} from './solver.js';
const base={spans:[{L:10,E:200,I:.001,mass:1000}],supports:['pin','roller'],loads:[],axles:[{p:100,offset:0}],mesh:12,mode:'static',direction:1,factor:1,speed:60,damping:2,step:.2,dt:.005,tail:.2,selfWeight:false};
const cfg=o=>({...structuredClone(base),...o});let checks=0;
function near(got,want,tol=1e-6,msg=''){assert.ok(Math.abs(got-want)<tol*Math.max(1,Math.abs(want)),`${msg}: got ${got}, expected ${want}`);checks++;}
function model(o){return build(cfg(o));}
let m=model({loads:[{type:'point',x:5,p:100}]}),r=statics(m);near(r.reactions[0].R,50);near(r.at(5).M,250);near(r.at(5).D,-100*10**3/(48*200000)*1000);near(r.at(5,-1).V,50);near(r.at(5,1).V,-50);
m=model({loads:[{type:'line',a:0,b:10,w1:10,w2:10}]});r=statics(m);near(r.reactions[0].R,50);near(r.at(5).M,125);near(r.at(5).D,-5*10*10**4/(384*200000)*1000);near(m.omega/(2*Math.PI),Math.PI/(2*100)*Math.sqrt(200000),1e-4,'first frequency');
m=model({supports:['fixed','free'],loads:[{type:'point',x:10,p:100}]});r=statics(m);near(r.reactions[0].R,100);near(r.reactions[0].T,1000);near(r.at(0).M,-1000);near(r.at(10).D,-100*10**3/(3*200000)*1000);
m=model({supports:['fixed','fixed'],loads:[{type:'line',a:0,b:10,w1:10,w2:10}]});r=statics(m);near(r.at(0).M,-1000/12);near(r.at(5).M,1000/24);near(r.at(5).D,-10*10**4/(384*200000)*1000);
m=model({spans:[...base.spans,...base.spans],supports:['pin','roller','roller'],loads:[{type:'line',a:0,b:20,w1:10,w2:10}]});r=statics(m);near(r.reactions[0].R,37.5);near(r.reactions[1].R,125);near(r.reactions[2].R,37.5);near(r.at(10).M,-125);near(r.at(10,-1).V,-62.5);near(r.at(10,1).V,62.5);
m=model({loads:[{type:'line',a:0,b:10,w1:0,w2:10}]});r=statics(m);near(r.reactions[0].R,50/3);near(r.reactions[1].R,100/3);near(r.at(10).M,0);
m=model({loads:[{type:'line',a:2,b:8,w1:5,w2:20},{type:'moment',x:3,p:30},{type:'point',x:7,p:-20}]});r=statics(m);near(r.reactions.reduce((s,x)=>s+x.R,0),55);near(r.reactions.reduce((s,x)=>s+x.R*x.x+x.T,0),5*6*5+15*6/2*6-20*7-30);near(r.at(3,1).M-r.at(3,-1).M,-30);
m=model({selfWeight:true});r=statics(m);near(r.reactions[0].R,49.03325);
// An unequal-span fixture; independent moment-area / three-moment result.
m=model({spans:[{L:10,E:200,I:.00015,mass:1000},{L:12,E:200,I:.00015,mass:1000}],supports:['pin','roller','roller'],loads:[{type:'line',a:0,b:10,w1:20,w2:20},{type:'point',x:16,p:50}]});r=statics(m);const MB=-(20*10**3/4+3*50*12**2/8)/(2*22);near(r.at(10).M,MB);near(r.at(5).M,250+MB/2);
// Different EI in each span: reciprocal displacement for independent point loads.
const spans=[{L:7,E:200,I:.001,mass:1000},{L:9,E:25,I:.004,mass:1000}];let ma=model({spans,supports:['pin','roller','roller'],loads:[{type:'point',x:3,p:10}]});let mb=model({spans,supports:['pin','roller','roller'],loads:[{type:'point',x:11,p:10}]});near(statics(ma).at(11).D,statics(mb).at(3).D,2e-3,'reciprocity sampled displacement');
assert.throws(()=>model({supports:['free','free']}));checks++;
assert.throws(()=>model({loads:[{type:'line',a:5,b:2,w1:10,w2:10}]}));checks++;
m=model({mode:'moving'});let mo=await moving(m);near(Math.max(...mo.envelope.rows.map(x=>x.Mmax)),250);near(mo.envelope.R[0].max,100);near(mo.envelope.R[1].max,100);
// Newmark dynamic equilibrium and low-speed limit at midspan; dynamic self-weight only remains steady.
m=model({mode:'dynamic',speed:90,damping:2});console.time('dynamic');let dy=await dynamic(m);console.timeEnd('dynamic');let residual=Math.max(...dy.frames.map(f=>f.result.residual));near(residual,0,2e-6,'dynamic equilibrium');assert.ok(dy.frames.some(f=>Math.abs(f.result.at(5).M-statics(m,f.front).at(5).M)>1));checks++;
// Global dynamic balance, using consistent-mass translational rows.
for(let f of dy.frames.filter((_,i)=>i%37===0)){let mass=0;for(let i=0;i<m.n;i+=2)for(let j=0;j<m.n;j++)mass+=m.M[i][j]*(f.result.acc[j]+dy.alpha*f.result.v[j]);let force=f.result.load.loads.filter(l=>l.type==='point').reduce((s,l)=>s+l.p,0);near(f.result.reactions.reduce((s,p)=>s+p.R,0),force+mass,2e-6,'dynamic global force');}
// Compare mesh/time refinement, excluding entry instantaneous shear pulse.
let finer=build(cfg({mode:'dynamic',speed:90,mesh:24,dt:.0025}));let dd=await dynamic(finer);let peak=ar=>Math.max(...ar.frames.map(f=>f.result.at(5).M));near(peak(dy),peak(dd),.025,'dynamic refinement peak M');
console.log(JSON.stringify({passed:checks,static:'analytic benchmarks',dynamic_steps:dy.frames.length,dynamic_peak_M:peak(dy),refined_peak_M:peak(dd),maximum_residual:residual}));
// Independent undamped simply-supported moving-force series (60 bending modes).
let undamped=build(cfg({mode:'dynamic',speed:90,damping:0,dt:.001,tail:0}));let ud=await dynamic(undamped);const exactM=t=>{let sum=0;for(let j=1;j<=60;j++){const k=j*Math.PI/10,wn=k*k*Math.sqrt(200000),om=k*25,q=-20/(wn*wn-om*om)*(Math.sin(om*t)-om/wn*Math.sin(wn*t));sum+=-200000*k*k*q*Math.sin(k*5);}return sum;};
for(let t of [.12,.20,.28]){let f=ud.frames.reduce((a,b)=>Math.abs(a.t-t)<Math.abs(b.t-t)?a:b);near(f.result.at(5).M,exactM(f.t),.015,'moving-force modal solution');}console.log('Independent modal series: 3/3 passed. Total checks: '+checks);
