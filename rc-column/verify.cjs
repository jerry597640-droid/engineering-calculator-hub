const assert=require('node:assert/strict'),fs=require('node:fs'),R=require('./core.js');
const checks=[],rows=[];
function test(name,fn){fn();checks.push(name)}
function near(actual,expected,tol,name){const error=Math.abs((actual-expected)/expected)*100;assert(error<=tol,`${name}: ${actual} vs ${expected}, ${error}%`);rows.push({name,expected,actual,errorPercent:error,tolerancePercent:tol});}
const psi=.07030695796,inch=2.54,kip=.45359237,kipft=.138254954376;
const sp={b:16*inch,h:16*inch,fc:5000*psi,fy:60000*psi,Es:29000000*psi,betaOverride:.8};
const gp={Ast:8*inch**2,Ag:sp.b*sp.h,bars:[-5.5,-5.5/3,5.5/3,5.5].flatMap(x=>[-5.5,5.5].map(y=>({x:x*inch,y:y*inch,a:inch**2,d:1.128*inch})))};
test('公開案例：單向P–M控制點',()=>{
 const ety=sp.fy/sp.Es;
 const refs=[[0,622.31,169.8634],[.5*ety,421.91,220.05034],[ety,270.8914,250.77437],[ety+.003,171.64154,286.75074]];
 for(const [et,P,M] of refs){const c=13.5*inch*.003/(.003+et),v=R.state(sp,gp,Math.PI/2,c);near(v.dp/kip,P,.001,`單向φP εt=${et.toFixed(6)}`);near(v.mx/kipft,M,.001,`單向φM εt=${et.toFixed(6)}`);}
 const pb=R.capacityAtP(sp,gp,Math.PI/2,0);near(pb.mx/kipft,213.91,.1,'單向純彎矩 spColumn');
 const P0=(.85*sp.fc*(gp.Ag-gp.Ast)+sp.fy*gp.Ast)/1000;near(.52*P0/kip,797.68,.00001,'最大設計軸壓力');
});
test('公開案例：雙向彎矩',()=>{
 const s={...sp,fc:4000*psi,betaOverride:.85},coords=[[-5.6,5.6],[0,5.6],[5.6,5.6],[5.6,0],[5.6,-5.6],[0,-5.6],[-5.6,-5.6],[-5.6,0]],g={Ag:16**2*inch**2,Ast:8*.79*inch**2,bars:coords.map(([x,y])=>({x:x*inch,y:y*inch,a:.79*inch**2,d:1.003*inch}))};
 const v=R.state(s,g,120*Math.PI/180,12.66*inch);near(v.P/1000/kip,485.54,.1,'雙向Pn');near(v.Mx/100000/kipft,197.11,.1,'雙向Mnx');near(Math.abs(v.My)/100000/kipft,95.56,.1,'雙向Mny');assert.equal(v.phi,.65);
});
const s={name:'C1',mode:'normal',environment:'inside',b:60,h:60,fc:280,fy:4200,fyt:4200,Es:2040000,cover:4,agg:2,bar:'D25',tie:'D13',nx:4,ny:4,s:10,L:300,kx:1,ky:1,frame:'braced',ratioX:-1,ratioY:-1,second:false};
const loads=[{name:'U1',P:300,Mx:20,My:10,Vx:15,Vy:15},{name:'U2',P:220,Mx:35,My:-18,Vx:20,Vy:10}],r=R.evaluate(s,loads);
test('台灣公式獨立代入',()=>{near(r.g.Ast,12*5.067,.000001,'Ast cm²');near(r.cases[0].P0,(.85*280*(3600-60.804)+4200*60.804)/1000,.000001,'P0 tf');near(r.cases[0].Pmax,570.80683296,.000001,'最大軸壓 tf');near(r.det.slx,300/(60/Math.sqrt(12)),.000001,'長細比');assert.equal(R.beta(280),.85);assert.equal(R.beta(560),.65);assert.equal(R.phi(4200/2040000,4200,2040000),.65);assert.equal(R.phi(4200/2040000+.003,4200,2040000),.9);assert(r.pass)});
test('剪力與雙向剪力交互作用',()=>{const g=r.g,d=60-g.o,Vc=Math.min((.53*Math.sqrt(280)+300000/(6*3600)),1.33*Math.sqrt(280))*60*d/1000,Vs=4*1.267*4200*d/10/1000;near(r.cases[0].sx.Vc,Vc,.000001,'Vc tf');near(r.cases[0].sx.Vs,Vs,.000001,'Vs tf');assert.equal(R.evaluate({...s,fyt:5600},loads).cases[0].sx.Vs,r.cases[0].sx.Vs);assert.equal(R.evaluate({...s,mode:'seismic',fyt:5600},loads).cases[0].sx.fytUsed,5600);const cap=r.cases[0].sx.cap;assert(!R.evaluate(s,[{...loads[0],Vx:.8*cap,Vy:.8*cap}]).cases[0].allPass);assert(R.evaluate(s,[{...loads[0],Vx:.6*cap,Vy:.6*cap}]).cases[0].allPass)});
test('軸力超限、長細與耐震待辦',()=>{assert(!R.evaluate(s,[{...loads[0],P:600,Mx:0,My:0}]).pass);assert(!R.evaluate({...s,L:600},loads).pass);assert(R.evaluate({...s,L:600,second:true},loads).pass);const z=R.evaluate({...s,mode:'seismic'},loads);assert(z.pendingSeismic);assert.equal(z.cases[0].sx.Vc,0)});
test('無效输入不得產生有效結果',()=>{assert.throws(()=>R.evaluate({...s,b:NaN},loads));assert.throws(()=>R.evaluate(s,[{...loads[0],P:NaN}]));assert.throws(()=>R.evaluate(s,[]));assert.throws(()=>R.evaluate({...s,nx:2.5},loads));assert.throws(()=>R.evaluate({...s,mode:'seismic',fy:2800},loads))});
test('對稱與120角度收斂',()=>{for(const [P,Mx,My] of [[0,20,13],[220,35,18],[300,20,10],[550,8,11],[-50,10,7]]){const l={P,Mx,My,Vx:0,Vy:0},a=R.section(s,l,120),b=R.section(s,{...l,Mx:-Mx,My:-My},120),c=R.section(s,{...l,Mx:My,My:Mx},120),fine=R.section(s,l,720);assert(Math.abs(a.ratio-b.ratio)<1e-9);assert(Math.abs(a.ratio-c.ratio)<1e-9);assert(Math.abs(a.ratio/fine.ratio-1)<.003);for(const p of a.envelope)assert(Math.abs(p.dp-P)<1e-5)}});
test('配筋搜尋最小Ast可行候選',()=>{let found;for(const q of R.designCandidates(s,loads)){const v=R.evaluate(q.ss,loads,120);if(v.pass){found=v;break}}assert(found);assert(found.g.Ast<r.g.Ast);assert(found.pass)});
const report={date:'2026-10-05',version:'1.3.1',checks,benchmarkComparisons:rows,example:{Ast:r.g.Ast,rhoPercent:r.det.rho*100,P0:r.cases[0].P0,Pmax:r.cases[0].Pmax,bendingRatios:r.cases.map(c=>c.ratio),implementedChecksPass:r.pass},notes:['外部案例採原始美制材料換算；台灣UI使用mks與台灣規範。','混凝土扣除主筋面積採連續圓弓形積分；與原文點面積法在邊界穿過主筋時有小幅差異。','驗證有限案例與本版項目，不代表完整耐震、接頭或二階構架設計已完成。']};
fs.writeFileSync(__dirname+'/validation-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
