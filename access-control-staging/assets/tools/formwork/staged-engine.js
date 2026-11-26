/* cm / kgf staged lateral-formwork model. Independent of legacy VB checks. */
(function(root){
'use strict';
const clone=v=>JSON.parse(JSON.stringify(v)),names={wall:'牆身',column:'柱單側',beam:'梁側'};
const JASS5=Object.freeze({id:'jass5-2022',title:'日本建築學會 JASS 5（2022）9 節・全液壓側壓',formula:'Ps = W0 × h',book:'建築工事標準仕様書・同解説 JASS 5 鉄筋コンクリート工事 2022',sources:[{title:'日本建築學會技術報告集 31(79), 1169–1174（2025），第 1 節',url:'https://www.jstage.jst.go.jp/article/aijt/31/79/31_1169/_pdf/-char/en'},{title:'鐵建技術報告 2023 No.37，本文第 1 節',url:'https://www.tekken.co.jp/media/fdbe6cca819fae6f7ad95dccdb8a52ae72916286.pdf'}]});
const HISTORICAL=Object.freeze({id:'jass5-historical',title:'JASS 5 歷史分段表比較（含牆長條件；非 2022 版）',sources:[{title:'日本住環境 GS 技術資料，印刷頁 10（PDF 第 12 頁）',url:'https://www.nchouse.co.jp/g-shield/download/pdf/technical/gsgijyutu.pdf'}],userReference:'https://terrylove12.blogspot.com/2018/08/jass-5.html'});
function rect(name,b,h,E=70000,Fb=140,Fv=12){return {name,shape:'rect',b,h,A:1,I:1,Z:1,E,Fb,Fv};}
function defaults(mode='wall'){
 const total=mode==='beam'?150:300,slab=mode==='beam'?20:0,top=total-slab;
 return {version:3,mode,project:'',location:'',total,slab,rho:2350,k:1,R:1.5,wallLength:300,pressure:JASS5.id,cap:.414,manual:.414,pressureSource:'',layers:mode==='beam'?'two':'one',deflection:240,absolute:.3,
  members:{panel:rect('襯板',1,1.5,70000,150,10),small:rect('小格柵',3.6,4.5),primary:rect('第一層大格柵',9,4.5),secondary:rect('第二層大格柵',9,4.5)},
  tie:{area:.316,Ft:1400,capacity:548,basis:'capacity'},stages:[{top:top/3,H1:15,B2:30,H3:40,H4:40,B4:30},{top:top*2/3,H1:30,B2:30,H3:50,H4:50,B4:30},{top,H1:30,B2:30,H3:60,H4:60,B4:30}]};
}
const checkRatio=v=>Math.abs(v-1)<=1e-12?1:v;
function sideHeight(d){return d.total-(d.mode==='beam'?d.slab:0);}
function normalize(d){
 if(!d.pressure||d.pressure==='hydro')d.pressure=JASS5.id;if(!('R' in d))d.R=1.5;if(!('wallLength' in d))d.wallLength=300;d.version=3;
 const last=d.stages?.at(-1);if(last)last.top=sideHeight(d);
 for(const s of d.stages||[]){s.H3=s.H4;if(d.mode==='beam'||d.layers==='one')s.B4=s.B2;}
 return d;
}
function historicalRule(d,z){
 const head=(d.total-z)/100,threshold=d.R<=10?1.5:2,coefficient=d.R>20?1:d.mode==='column'?(d.R<=10?.6:.8):d.wallLength<=300?(d.R<=10?.2:.4):0;
 const reduced=d.R<=20&&head>threshold,effectiveHead=reduced?threshold+coefficient*(head-threshold):head;
 return {head,threshold,coefficient,activeCoefficient:reduced?coefficient:1,effectiveHead,reduced,formula:reduced?`${threshold} + ${coefficient} × (h − ${threshold})`:'h',condition:`R ${d.R<=10?'≤ 10':d.R<=20?'> 10 且 ≤ 20':'> 20'} m/h；${d.mode==='column'?'柱':`牆長 ${d.wallLength<=300?'≤': '>'} 300 cm`}`};
}
function pressureAt(d,z){const base=d.pressure===HISTORICAL.id?d.rho*historicalRule(d,z).effectiveHead/1e4:d.rho*(d.total-z)/1e6;return d.pressure==='manual'?d.manual:d.pressure==='capped'?Math.min(d.k*base,d.cap):d.k*base;}
function pressureBasis(d){return d.pressure===JASS5.id||d.pressure==='hydro'?{...JASS5,jass:true,current:true,historical:false}:d.pressure===HISTORICAL.id?{...HISTORICAL,jass:true,current:false,historical:true}:{id:d.pressure,title:d.pressure==='manual'?'自訂均布側壓（非 JASS 5 方法）':'自訂側壓上限（非 JASS 5 方法）',jass:false,current:false,historical:false};}
function pressureTrace(d,z){const headCm=d.total-z,hydro=d.rho*headCm/1e6,rule=d.pressure===HISTORICAL.id?historicalRule(d,z):null,base=rule?d.rho*rule.effectiveHead/1e4:hydro,design=pressureAt(d,z);return {z,headCm,headM:headCm/100,unitWeightKN:d.rho*9.80665/1000,hydro,hydroKPa:hydro*98.0665,rule,referenceRatio:hydro===0?1:base/hydro,base,baseKPa:base*98.0665,k:d.k,design,designKPa:design*98.0665,...pressureBasis(d)};}
function pressureBreakpoints(d){return d.pressure===HISTORICAL.id&&d.R<=20?[d.total-(d.R<=10?150:200)]:[];}
function section(m){return m.shape==='custom'?{A:m.A,I:m.I,Z:m.Z}:{A:m.b*m.h,I:m.b*m.h**3/12,Z:m.b*m.h**2/6};}
function member(m,L,w,d,key){const s=section(m),M=w*L*L/8,V=w*L/2,fb=M/s.Z,fv=1.5*V/s.A,delta=5*w*L**4/(384*m.E*s.I),limit=Math.min(d.absolute,L/d.deflection),ratios=[fb/m.Fb,delta/limit,fv/m.Fv].map(checkRatio);return {...m,...s,key,L,w,M,V,fb,fv,delta,limit,ratios,ratio:Math.max(...ratios),pass:ratios.every(x=>x<1)};}
function validate(d){
 if(!d||!names[d.mode]||!Array.isArray(d.stages)||d.stages.length<1||d.stages.length>5||!d.members||!d.tie)return ['分階輸入不完整'];
 const e=[],pos=(v,n)=>{if(!Number.isFinite(v)||v<=0)e.push(n+'須大於 0');};
 for(const k of ['total','rho','k','deflection','absolute'])pos(d[k],k);
 if(d.k<1)e.push('側壓加成係數 k 不得小於 1');
 if(d.mode==='beam'&&(!Number.isFinite(d.slab)||d.slab<0||d.slab>=d.total))e.push('梁頂板厚須為 0 以上且小於梁總高');
 if(!['one','two'].includes(d.layers)||d.mode==='beam'&&d.layers!=='two')e.push('構件配置選項無效');
 if(![JASS5.id,HISTORICAL.id,'hydro','capped','manual'].includes(d.pressure))e.push('側壓選項無效');
 if(d.pressure===HISTORICAL.id){pos(d.R,'舊表澆置速度 R');if(d.mode==='wall')pos(d.wallLength,'實際牆長');if(d.mode==='beam')e.push('歷史表僅列柱與牆，梁側請使用全液壓');if(d.total>400)e.push('歷史表比較限總澆置高度 400 cm 以下；超出請採全液壓或另附核定設計');}
 if(d.pressure==='capped')pos(d.cap,'指定側壓上限');if(d.pressure==='manual')pos(d.manual,'指定均布側壓');
 if(!pressureBasis(d).jass&&!d.pressureSource?.trim())e.push('請填寫指定側壓的設計依據');
 let bottom=0;d.stages.forEach((s,j)=>{if(!s||typeof s!=='object'){e.push('階層資料不完整');return;}for(const k of ['top','H1','B2','H4','B4'])pos(s[k],`第${j+1}階 ${k}`);if(d.layers==='two'&&d.mode!=='beam')pos(s.H3,`第${j+1}階 H3`);if(s.top<=bottom||s.top>sideHeight(d)+1e-8)e.push('階層最高高度須由下而上遞增，且不得超過側模高度');if(Math.abs(s.H3-s.H4)>1e-8)e.push('H3 須與 H4 位於相同支承層');if((d.mode==='beam'||d.layers==='one')&&Math.abs(s.B4-s.B2)>1e-8)e.push('此配置 B4 須與 B2 同步');bottom=s.top;});
 if(Math.abs(bottom-sideHeight(d))>1e-8)e.push('最末階最高高度須等於側模總高');
 for(const key of ['panel',...(d.mode==='beam'?[]:['small']),'primary',...(d.layers==='two'?['secondary']:[])]){const m=d.members[key];if(!m){e.push(key+'構件資料缺漏');continue;}if(!['rect','custom'].includes(m.shape))e.push('斷面選項無效');for(const k of ['E','Fb','Fv',...(m.shape==='custom'?['A','I','Z']:['b','h'])])pos(m[k],`${m.name} ${k}`);}
 if(d.members.panel?.shape!=='rect'||d.members.panel?.b!==1)e.push('襯板須使用 1 cm 寬的矩形條帶');
 pos(d.tie.area,'螺桿有效拉力面積');if(!['capacity','stress'].includes(d.tie.basis))e.push('螺桿容許值選項無效');if(d.tie.basis==='capacity')pos(d.tie.capacity,'螺桿每支容許拉力');else pos(d.tie.Ft,'螺桿容許拉應力');
 return [...new Set(e)];
}
function checkStage(d,s,bottom,index,label){
 const p=pressureAt(d,bottom),rows=[];
 rows.push(member(d.members.panel,s.H1,p,d,'panel'));
 if(d.mode!=='beam')rows.push(member(d.members.small,s.B2,p*s.H1,d,'small'));
 if(d.mode==='beam')rows.push(member(d.members.primary,s.B2,p*s.H1,d,'primary'));
 else rows.push(member(d.members.primary,d.layers==='two'?s.H3:s.H4,p*s.B2,d,'primary'));
 if(d.layers==='two')rows.push(member(d.members.secondary,d.mode==='beam'?s.H4:s.B4,p*(d.mode==='beam'?s.B2:s.H3),d,'secondary'));
 const area=d.tie.area,capacity=d.tie.basis==='capacity'?d.tie.capacity:area*d.tie.Ft,Ft=capacity/area,tributary=s.B4*s.H4,T=p*tributary,ft=T/area,ratio=checkRatio(T/capacity),tie={area,capacity,Ft,tributary,T,ft,ratio,pass:ratio<1};
 return {index,label:label||`第${index+1}階`,bottom,top:s.top,p,pTop:pressureAt(d,s.top),pressureTrace:pressureTrace(d,bottom),spacing:clone(s),rows,tie,ratio:Math.max(tie.ratio,...rows.map(x=>x.ratio)),pass:tie.pass&&rows.every(x=>x.pass)};
}
function calculate(input){
 const errors=validate(input);if(errors.length)return {errors};const d=clone(input);let bottom=0;
 const stages=d.stages.map((s,j)=>{const r=checkStage(d,s,bottom,j);bottom=s.top;return r;});
 // At changes of spacing, independently check the component-wise larger spacing
 // with the lower adjacent tier's peak pressure; never let an interface disappear.
 const interfaces=d.stages.slice(1).map((s,j)=>{const prev=d.stages[j],envelope={...s};for(const k of ['H1','B2','H3','H4','B4'])envelope[k]=Math.max(prev[k],s[k]);return checkStage(d,envelope,stages[j].bottom,j,`階界 ${j+1}／${j+2} 包絡`);});
 const all=[...stages,...interfaces];
 if(all.some(s=>![s.p,s.pTop,s.tie.T,s.tie.ft,s.tie.ratio,...s.rows.flatMap(m=>[m.A,m.I,m.Z,m.w,m.M,m.V,m.fb,m.fv,m.delta,m.limit,...m.ratios])].every(Number.isFinite)))return {errors:['數值超出可計算範圍，請確認單位與輸入。']};
 return {errors:[],input:d,pressureBasis:pressureBasis(d),title:names[d.mode]+d.stages.length+'階模板檢核',stages,interfaces,max:Math.max(...all.map(s=>s.ratio)),pass:all.every(s=>s.pass),panelWorst:all.flatMap(s=>s.rows.filter(m=>m.key==='panel').map(m=>({...m,stage:s.label}))).sort((a,b)=>b.ratio-a.ratio)[0]};
}
const api={JASS5,HISTORICAL,defaults,normalize,sideHeight,historicalRule,pressureAt,pressureBasis,pressureTrace,pressureBreakpoints,section,member,validate,calculate};root.FormworkStaged=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
