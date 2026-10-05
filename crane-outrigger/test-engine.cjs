const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(require('path').join(__dirname,'index.html'),'utf8');
const code=html.match(/<script id="engine">([\s\S]*?)<\/script>/)[1];const ctx={};vm.createContext(ctx);vm.runInContext(code+';this.C=Crane;',ctx);const C=ctx.C;
const p={L:8,B:6,cx:0,cy:0,w0:80,x0:0,y0:0,w1:0,r1:0,w2:0,r2:0,w3:0,r3:-2,Q:10,hook:0,radius:10,phi:1,start:0,end:360,theta:0,capacity:0,kA:1,kB:1,kC:1,kD:1,padL:2,padB:2,qa:20,orig:0};
const near=(a,b,tol=1e-7)=>assert(Math.abs(a-b)<=tol,`${a} != ${b}`);let cases=0;
C.validate(p);let s=C.state(p,0);s.reaction.forEach((x,i)=>near(x,[28.75,28.75,16.25,16.25][i]));near(C.envelope(p).max,55);cases++;
s=C.state({...p,Q:0},180);s.reaction.forEach(x=>near(x,20));cases++;
s=C.state({...p,w0:38,x0:-.4,w1:12,w2:8,r2:4,w3:20,r3:-2.5,hook:1,phi:1.1,radius:12,B:7},0);near(s.W,90.1);near(s.sx,112);s.reaction.forEach((x,i)=>near(x,[29.525,29.525,15.525,15.525][i]));cases++;
s=C.state({...p,w0:100,Q:0,x0:3,y0:2},0);assert(s.reaction&&s.contact===3);near(s.reaction[3],0);cases++;
s=C.state({...p,w0:100,Q:0,x0:4,y0:0},0);assert(s.edge&&s.reaction===null);cases++;
s=C.state({...p,Q:100,radius:20},0);assert(!s.stable&&s.reaction===null&&s.ranges===null);assert(C.envelope({...p,Q:100,radius:20}).unstable);cases++;
let seed=42;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};let contact3=0;
for(let j=0;j<1200;j++){const q={...p,Q:rand()*20,L:3+rand()*10,B:3+rand()*7,cx:rand()-.5,cy:rand()-.5,x0:rand()-.5,y0:rand()-.5,radius:rand()*18,kA:.2+rand()*4,kB:.2+rand()*4,kC:.2+rand()*4,kD:.2+rand()*4};const t=rand()*360,s=C.state(q,t);if(s.stable&&!s.edge){assert(s.reaction,'valid state solver failed');const r=s.reaction;near(r.reduce((a,b)=>a+b),s.W,1e-6);near((r[0]+r[1]-r[2]-r[3])*q.L/2,s.W*s.ex,1e-6);near((r[0]+r[2]-r[1]-r[3])*q.B/2,s.W*s.ey,1e-6);r.forEach((x,i)=>assert(x>=-1e-8&&x>=s.ranges[i][0]-1e-6&&x<=s.ranges[i][1]+1e-6));if(s.contact===3)contact3++;const a=C.state({...q,kA:q.kA*30,kB:q.kB*30,kC:q.kC*30,kD:q.kD*30},t);r.forEach((x,i)=>near(x,a.reaction[i]));}cases++;}
for(let j=0;j<40;j++){const q={...p,start:rand()*300,end:0,cx:rand()-.5,cy:rand()-.5,Q:rand()*14,radius:rand()*18,w2:rand()*10,r2:rand()*6,w3:rand()*20};q.end=q.start+rand()*360;const e=C.envelope(q);let sampled=-Infinity;for(let k=0;k<=3600;k++){const t=q.start+(q.end-q.start)*k/3600,s=C.state(q,t);if(s.stable){const mx=Math.max(...s.ranges.map(r=>r[1]));assert(mx<=e.max+1e-6,'analytic bound misses sampled maximum');sampled=Math.max(sampled,mx);}}if(Number.isFinite(sampled))assert(e.max-sampled<.08);cases++;}
for(const bad of [{L:0},{phi:.5},{Q:-1},{end:800},{start:350,end:300},{qa:-1},{theta:400}])assert.throws(()=>C.validate({...p,...bad}));
assert(!C.pathContact(p).issue);assert(C.pathContact({...p,w0:100,Q:0,x0:3,y0:2}).issue);cases+=2;
const wrap=C.envelope({...p,start:300,end:420});near(wrap.max,55);cases++;
const one=C.envelope({...p,start:47,end:47});near(one.max,C.state(p,47).ranges.reduce((m,r)=>Math.max(m,r[1]),0));cases++;
console.log(JSON.stringify({passed:true,cases,randomThreeLegCases:contact3,example:s.C,scope:'mechanics, balance, bounds, contact, analytical angular extrema'}));
