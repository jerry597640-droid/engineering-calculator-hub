/* Verify free-P slices against the original solver plus independent endpoint/equilibrium checks. */
const A=require('node:assert/strict'),fs=require('node:fs'),R=require('./core.js'),S=require('./surface-core.js');
const example=JSON.parse(fs.readFileSync(__dirname+'/example-project.json')),base=example.s,checks=[],numbers={};
const close=(a,b,t=1e-7)=>A(Math.abs(a-b)<=t,`${a} != ${b}`);
const run=job=>{let q;const progress=[];do{q=job.next();if(!q.done)progress.push(q.value.progress)}while(!q.done);return {value:q.value,progress}};
const contour=(s,P,angles=120)=>run(S.slice(R,s,P,{angles})).value;
const test=(name,f)=>{f();checks.push(name)};
const compare=(s,P)=>{
 const a=contour(s,P),b=R.section(s,{P,Mx:20,My:-13},120);A(a.valid);A.equal(a.reason,'');A.equal(a.points.length,120);A.equal(b.envelope.length,120);
 for(let i=0;i<120;i++){const x=a.points[i],y=b.envelope[i];close(x.P,P);close(x.mx,y.mx);close(x.my,y.my);close(x.phi,y.phi);close(x.theta,y.theta);close(y.dp,P,1e-5*Math.max(1,Math.abs(P)));A.deepEqual(Object.keys(x).sort(),['P','mx','my','phi','theta'].sort());}
 return a;
};
const Ast=12*5.067,P0=(.85*280*(3600-Ast)+4200*Ast)/1000,Pmax=.52*P0,Tmax=.9*4200*Ast/1000;
let original;
test('自由軸力 120 方向逐點符合原 section，且每 6 角分段回報',()=>{
 original=S.build(R,base,{levels:12,angles:24});
 const forces=[-60.4321,0,317.4567,Pmax*.937];
 for(const P of forces){const a=compare(base,P);A(a.points.every(v=>Number.isFinite(v.mx)&&Number.isFinite(v.my)));}
 const job=run(S.slice(R,base,317.4567));A.equal(job.progress.length,20);close(job.progress[0],.05);close(job.progress.at(-1),1);A(job.progress.every((p,i)=>i===0||p>job.progress[i-1]));
 numbers.freeAxial={tested_tf:forces,angles:120,maxContourResidual_tf:Math.max(...R.section(base,{P:317.4567,Mx:20,My:-13},120).envelope.map(v=>Math.abs(v.dp-317.4567)))};
});
test('最大壓力端面與純拉端點符合獨立手算；超限直接返回空輪廓',()=>{
 close(original.Pmax,Pmax);close(original.Tmax,Tmax);compare(base,Pmax);
 const t=contour(base,-Tmax);A(t.valid);A(t.points.every(v=>v.P===-Tmax&&Math.abs(v.mx)<1e-8&&Math.abs(v.my)<1e-8&&v.phi===.9));
 let called=0;const guarded={...R,capacityAtP(...args){called++;return R.capacityAtP(...args)}};
 for(const P of [Pmax+1e-9,-Tmax-1e-9,Pmax+100,-Tmax-100]){const a=run(S.slice(guarded,base,P)).value;A.equal(a.valid,false);A.equal(a.P,P);A.deepEqual(a.points,[]);A(a.reason.includes('超出'));}A.equal(called,0);
 numbers.handEndpoints={Ast_cm2:Ast,P0_tf:P0,Pmax_tf:Pmax,Tmax_tf:Tmax};
});
test('非對稱混合配筋純拉偏心由逐筋力量與彎矩獨立求和',()=>{
 const s={...base,layout:'custom',dX:30,dY:30,tieLegsX:4,tieLegsY:4,hx:20,supported:true,customBars:[
  {bar:'D25',n:1,x1:10,y1:10},{bar:'D25',n:1,x1:50,y1:10},
  {bar:'D19',n:1,x1:10,y1:50},{bar:'D25',n:1,x1:50,y1:50}]};
 const hand=s.customBars.reduce((v,r)=>{const F=-.9*s.fy*R.BARS[r.bar].a;v.P+=F/1000;v.mx+=F*(r.y1-s.h/2)/100000;v.my+=F*(r.x1-s.b/2)/100000;return v},{P:0,mx:0,my:0});
 const g=R.geometry(s),P=-.9*s.fy*g.Ast/1000;close(hand.P,P);const a=contour(s,P);A(a.valid);A(Math.hypot(hand.mx,hand.my)>.01);
 for(const v of a.points){close(v.mx,hand.mx);close(v.my,hand.my);close(v.phi,.9);}A(R.section(s,{P,Mx:hand.mx,My:hand.my},120).pass);A(!R.section(s,{P,Mx:0,My:0},120).pass);
 compare(s,173.284);numbers.asymmetricTensionHand=hand;
});
test('2 層、3 層及混合筋徑切片採實際座標，位移後容量跟著改變',()=>{
 const s={...base,b:80,h:80,layout:'custom',dX:40,dY:40,tieLegsX:4,tieLegsY:4,hx:20,supported:true};
 const layerResults=[];
 for(const count of [2,3]){
  const defs=Array.from({length:count},(_,i)=>({bar:i===1?'D19':'D25',nx:4,ny:4,clear:i?4:0})),layers=R.buildLayers(s,defs),actual={...s,customBars:layers.rows};
  const a=compare(actual,427.318),g=R.geometry(actual),flat={...actual,customBars:g.bars.map(p=>({bar:p.bar,n:1,x1:p.x+40,y1:p.y+40}))},b=contour(flat,427.318);
  A.deepEqual(a.points,b.points);A.equal(g.bars.length,count*12);close(g.Ast,count===2?12*(5.067+2.865):12*(5.067*2+2.865));
  const moved=structuredClone(flat);moved.customBars[12].x1+=.4;moved.customBars[12].y1+=.2;A.equal(R.validate(moved).length,0);const c=contour(moved,427.318);
  A(c.points.some((v,i)=>Math.hypot(v.mx-b.points[i].mx,v.my-b.points[i].my)>1e-5));A.notEqual(S.key(moved,28,60),S.key(flat,28,60));layerResults.push({layers:count,N:g.bars.length,Ast_cm2:g.Ast});
 }
 numbers.layers=layerResults;
});
test('對稱斷面 180° 力矩反向、90° 軸交換及非對稱鏡射對應',()=>{
 const a=contour(base,284.123);for(let i=0;i<60;i++){close(a.points[i].mx,-a.points[i+60].mx);close(a.points[i].my,-a.points[i+60].my);}close(a.points[0].my,a.points[30].mx);
 const s={...base,layout:'custom',dX:30,dY:30,tieLegsX:4,tieLegsY:4,hx:20,supported:true,customBars:[{bar:'D25',n:1,x1:10,y1:10},{bar:'D25',n:1,x1:50,y1:10},{bar:'D19',n:1,x1:10,y1:50},{bar:'D25',n:1,x1:50,y1:50}]},mir={...s,customBars:s.customBars.map(p=>({...p,x1:60-p.x1}))},b=contour(s,100.357),c=contour(mir,100.357);
 for(let i=0;i<120;i++){const j=(60-i+120)%120;close(b.points[i].mx,c.points[j].mx);close(b.points[i].my,-c.points[j].my);}
});
test('自由切片不改變原 3D 產生結果、核心 D/C 或輸入資料',()=>{
 const snapshot=JSON.stringify(base),model=S.build(R,base,{levels:12,angles:24});A.deepEqual(model,original);A.equal(model.points,312);
 const a=R.evaluate(base,example.loads);close(a.cases[0].ratio,.384387041888,1e-6);close(a.cases[1].ratio,.647230654,1e-6);A.equal(JSON.stringify(base),snapshot);
 numbers.originalRatios=a.cases.map(c=>c.ratio);
});
test('分段切片可取消；無效資料、非法角度及非有限 P 一律拒絕',()=>{
 let calls=0;const wrapped={...R,capacityAtP(...args){calls++;return R.capacityAtP(...args)}},g=S.slice(wrapped,base,317.4567);A.equal(g.next().done,false);A.equal(calls,6);g.return();A.equal(g.next().done,true);A.equal(calls,6);
 const exhausted=job=>run(job);for(const P of [NaN,Infinity,-Infinity,'300'])A.throws(()=>exhausted(S.slice(R,base,P)));
 for(const angles of [0,11,120.5,721,NaN,'120'])A.throws(()=>exhausted(S.slice(R,base,300,{angles})));
 A.throws(()=>exhausted(S.slice(R,{...base,b:0},300)));A.throws(()=>exhausted(S.slice(R,{...base,layout:'custom',customBars:[]},300)));
 A.equal(contour(base,300,12).points.length,12);A.equal(contour(base,300,720).points.length,720);
});
test('任何一個方向未收斂或產生非有限容量，切片整體停止不顯示部分輪廓',()=>{
 for(const value of [null,{mx:NaN,my:0,dp:300,phi:.65,theta:0},{mx:0,my:Infinity,dp:300,phi:.65,theta:0},{mx:0,my:0,dp:300,phi:NaN,theta:0}])A.throws(()=>run(S.slice({...R,capacityAtP:()=>value},base,300)),/未收斂/);
});
const report={version:'1.5.0',date:'2026-10-07',checks,numbers,notes:['P 為設計軸力（tf），正壓負拉；切片逐角呼叫既有應變相容容量求解器，未插值或變更強度公式。','超出 [-Tmax, Pmax] 直接返回 valid:false 與空 points，未夾到端面；純拉彎矩依主筋實際形心偏心。','成功輪廓只有 P、mx、my、phi、theta，未攜帶詳細迭代資料，分段取消不影響既有結果。']};
fs.writeFileSync(__dirname+'/surface-pro-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
