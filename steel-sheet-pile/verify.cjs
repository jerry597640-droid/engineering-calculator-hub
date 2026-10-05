const assert=require('node:assert/strict'),fs=require('node:fs');
const {analyze,DEFAULT,pressure}=require('./engine.js');let checks=0;
function close(a,b,t=1e-6){assert.ok(Math.abs(a-b)<=t*Math.max(1,Math.abs(b)),`${a} vs ${b}`);checks++}
let cases=[];
for(let k=1;k<=9;k++){
 const x={...DEFAULT,case:k,...(k===3?{H:5,length:12}:{}),...([2,7].includes(k)?{length:10}:{})},r=analyze(x);
 // Independent midpoint quadrature per segment, integrate V and M by distributed-load summation.
 let samples=[];for(let [a,b,p,q]of r.segs){const n=10000,dz=(b-a)/n;for(let i=0;i<n;i++){let z=a+(i+.5)*dz;samples.push([z,(p+(q-p)*(i+.5)/n)*dz])}}
 let F=samples.reduce((v,[z,p])=>v+p,0),J=samples.reduce((v,[z,p])=>v+z*p,0);
 close(F,r.Ta,1e-7);close(J,r.Ta*x.anchor,1e-6);
 const at=z=>samples.reduce((m,[t,p])=>m+(t<z?p*(z-t):0),0)-(r.anchored&&z>x.anchor?r.Ta*(z-x.anchor):0);
 close(Math.abs(at(r.zM)),r.Mmax,1e-6);
 close(r.sigma,r.Mmax*100000/(x.S*x.eta));
 if(r.norm){let pr=r.norm.phiReduced*Math.PI/180,ka=Math.tan(Math.PI/4-pr/2)**2,kp=1/ka,su=x.su/x.fs,d=r.norm.Drequired,N=100000,dz=(x.H+d-x.anchor)/N,mt=0;
 for(let i=0;i<N;i++){let z=x.anchor+(i+.5)*dz,sv=x.q+x.gamma*Math.min(z,r.wet?x.water:z)+(r.wet?Math.max(0,Math.min(z,x.H)-x.water)*(x.gammaSat-1):0),p;
 if(z<x.H)p=ka*sv;else if(r.soil==='sand')p=ka*(r.Q+r.ge*(z-x.H))-kp*r.ge*(z-x.H);else p=Math.max(0,r.Q+x.gammaClay*(z-x.H)-2*su)-(x.gammaClay*(z-x.H)+2*su);
 mt+=p*(z-x.anchor)*dz;}
 close(mt,0,1e-3);checks++;
 }
 cases.push({case:k,name:r.name,inputs:x,D:r.D,Drequired:r.Ddesign,Mmax:r.Mmax,sigma:r.sigma,Ta:r.Ta,norm:r.norm,residualF:F-r.Ta,residualM:J-r.Ta*x.anchor});
}
// Independent dry anchored cubic: Pa(H centroid-a)+pH((H-a)D+D²/2)-γ(Kp-Ka)((H-a)D²/2+D³/3)=0.
let x={...DEFAULT,case:6,q:0},r=analyze(x),ka=1/3,kp=3,P=ka*x.gamma*x.H*x.H/2,D=r.D;
close(P*(2*x.H/3-x.anchor)+ka*x.gamma*x.H*((x.H-x.anchor)*D+D*D/2)-x.gamma*(kp-ka)*((x.H-x.anchor)*D*D/2+D**3/3),0);
// Source sand cantilever M = Pa(ybar+sqrt(2Pa/gK))-gK y³/6.
r=analyze(DEFAULT);let v=Math.sqrt(2*r.Pa/(r.ge*(r.Kp-r.Ka)));close(r.Mmax,r.Pa*(r.ybar+v)-r.ge*(r.Kp-r.Ka)*v**3/6);
for(let patch of [{H:0},{q:-1},{S:0},{phi:0},{case:6,anchor:3},{case:2,water:-1},{case:2,gammaSat:1},{eta:1.1},{case:4,su:1},{H:NaN}]){assert.throws(()=>analyze({...DEFAULT,...patch}));checks++}
for(let water of [0,DEFAULT.H]){r=analyze({...DEFAULT,case:2,water});close(r.resF,0);close(r.resM,0)}
for(let k of [1,2,4,5,6,7,8,9]){let a=analyze({...DEFAULT,case:k}),b=analyze({...DEFAULT,case:k,q:1.5});assert.ok(b.D>a.D&&b.Mmax>a.Mmax);checks++}
const out={date:'2026-10-05',passed:true,checks,method:'Independent midpoint quadrature 10000 intervals per pressure segment, 100000 intervals for TW 112 §8.8.1 reduced-strength moment, closed-form/source formula checks, invalid inputs and load sensitivity.',cases};fs.writeFileSync(__dirname+'/verification.json',JSON.stringify(out,null,2));console.log(`PASS ${checks} numerical checks; all 9 cases independently integrated.`);
