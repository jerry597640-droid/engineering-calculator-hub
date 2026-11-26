const assert=require('assert'),F=require('./engine.js');let total=0;
function check(ok,msg){assert(ok,msg);total++;}
function near(a,b,t=1e-6){check(Math.abs(a-b)<=t,'expected '+a+' ≈ '+b);}
for(const mode of ['rect','trap']){
 const p={...F.examples[mode]},a=F.calc(p),L=a.g.L;
 const mirror={...p,b1:mode==='rect'?p.b1:p.b2,b2:p.b1,D1:p.D2,D2:p.D1,Q1:p.Q2,Q2:p.Q1,cx1:p.cx2,cx2:p.cx1,cy1:p.cy2,cy2:p.cy1,a1:L-(a.g.x2+p.cx2/200)};
 const b=F.calc(mirror);check(a.valid&&b.valid,'mirror model');for(let j=0;j<a.models.length;j++){let ma=a.models[j],mb=b.models[j];for(let t of [.07,.19,.37,.58,.78,.91]){let x=L*t;near(ma.M(x),mb.M(L-x));near(ma.V(x),-mb.V(L-x));near(ma.netQ(x),mb.netQ(L-x));}}
}
for(let key of ['L','b1','spacing','cx1','h','fc','fy','cover','longBottom','stirrupSpace'])for(let value of [NaN,Infinity,-10])check(!F.calc({...F.defaults,[key]:value}).valid,'invalid '+key);
check(!F.calc({...F.defaults,cover:5}).valid,'cover');check(!F.calc({...F.defaults,longBar:'D999'}).valid,'bar');
const nc=F.calc({...F.defaults,L:12});check(nc.invalidContact&&!nc.reinforcement,'negative contact stops');
const edge=F.calc(F.examples.strap);check(edge.punching[0].pending&&edge.punching[0].pass===null,'edge punching not passed');
const overload=F.calc({...F.defaults,D1:700,D2:700,qa:200});check(overload.checks.some(v=>v.pass===false),'overload fails');
const tooMuch=F.calc({...F.defaults,longBottom:2,longTop:2});check(tooMuch.reinforcement.some(v=>!v.tension),'over reinforcement strain');
const unequal=F.calc({...F.defaults,cx1:40,cy1:140,cx2:40,cy2:140,b1:3,cover:7.5,h:50});check(unequal.punching.every(v=>Math.min(...v.coeffs)<1.06),'large beta reduces punching strength');
const deep=F.calc({...F.examples.strap,spacing:4});check(!deep.valid,'deep beam unsupported');
const custom=F.calc({...F.defaults,manual:true,U1:85,U2:115});check(custom.models.length===1&&custom.warnings.length>0,'custom combination warning');near(custom.models[0].balanceV,0);near(custom.models[0].balanceM,0);
console.log(total+' mirrored / boundary assertions passed');
