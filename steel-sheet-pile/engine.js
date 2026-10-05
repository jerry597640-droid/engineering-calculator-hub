/* Steel sheet pile: source-derived Rankine limit equilibrium, tf/m unit wall. */
const CASES=[null,
['懸臂｜均質砂土',false,'sand',false],['懸臂｜砂土＋等水位',false,'sand',true],
['懸臂｜均質黏土',false,'clay',false],['懸臂｜砂土覆蓋黏土',false,'mixed',false],['懸臂｜砂土覆蓋黏土＋等水位',false,'mixed',true],
['單層地錨｜砂土',true,'sand',false],['單層地錨｜砂土＋等水位',true,'sand',true],
['單層地錨｜砂土覆蓋黏土',true,'mixed',false],['單層地錨｜砂土覆蓋黏土＋等水位',true,'mixed',true]];
const DEFAULT={case:1,H:3,q:1,gamma:1.8,gammaSat:1.8,gammaClay:1.9,phi:30,su:3.5,water:1.5,anchor:0.6,spacing:2,angle:15,S:2270,eta:1,fb:1500,mult:1.3,length:7,fs:1.5,section:'SP-Ⅳ',title:'鋼板樁設計案例'};
function root(fn,lo,hi,trace=null){let a=fn(lo),b=fn(hi);if(trace)Object.assign(trace,{bracket:[lo,hi],bracketValues:[a,b],iterations:100,iterationSamples:[]});if(!Number.isFinite(a+b)||a*b>0)throw Error('未取得有效平衡根；請檢查土壤抵抗力、開挖深度及錨定位置。');for(let i=0;i<100;i++){let m=(lo+hi)/2,v=fn(m);if(trace&&(i<3||i>=97))trace.iterationSamples.push({iteration:i+1,lo,hi,m,fmid:v,branch:a*v<=0?"hi=m":"lo=m"});if(a*v<=0){hi=m;b=v}else{lo=m;a=v}}const value=(lo+hi)/2;if(trace)Object.assign(trace,{finalBracket:[lo,hi],value,residual:fn(value)});return value}
function positiveRoot(fn,start=0,trace=null){if(trace)trace.attempts=[];let hi=Math.max(1,start+1),lo=start;for(let i=0;i<50;i++){if(trace)trace.attempts.push({lo,hi,flo:fn(lo),fhi:fn(hi)});if(fn(lo)*fn(hi)<=0)return root(fn,lo,hi,trace);hi=hi*1.5+1;if(hi>10000)break}throw Error('無合理正實根；此土壤條件無法以本模型形成平衡。')}
// Each [z0,z1,p0,p1] is exactly linear. Integrals include first moment about surface.
function integrals(segs,z=Infinity){let F=0,J=0,parts=[];for(const [a,b,p0,p1]of segs){let l=Math.max(0,Math.min(b,z)-a);if(!l)continue;let k=(p1-p0)/(b-a);let f=p0*l+k*l*l/2;const j=a*f+p0*l*l/2+k*l*l*l/3;F+=f;J+=j;parts.push({a,b,p0,p1,l,k,f,j,F,J})}return {F,J,parts}}
function pressure(segs,z){let s=segs.find(s=>z>=s[0]-1e-9&&z<=s[1]+1e-9);return s?s[2]+(s[3]-s[2])*(z-s[0])/(s[1]-s[0]):0}
function analyze(x){x={...DEFAULT,...x};for(const k of ['case','H','q','gamma','gammaSat','gammaClay','phi','su','water','anchor','spacing','angle','S','eta','fb','mult','length','fs'])if(!Number.isFinite(x[k]))throw Error(k+' 必須為有限數值，不能留白。');let c=CASES[x.case];if(!c)throw Error('請選擇有效工況。');let [name,anchored,soil,wet]=c;
if(x.H<=0||x.H>30||x.q<0||x.gamma<=0||x.gammaClay<=0||x.S<=0||x.fb<=0||x.length<=x.H)throw Error('H 需介於 0～30 m、載重不得負值、材料参数須正值，實際樁長須大於開挖深度。');
if(x.eta<=0||x.eta>1||x.mult<1||x.mult>2||x.fs<1)throw Error('斷面折減需 0＜η≤1、入土加長倍率需 1～2，安全係數需≥1。');
if(soil!=='clay'&&(x.phi<=0||x.phi>=50))throw Error('砂土摩擦角需 0＜φ＜50°。');if(soil!=='sand'&&x.su<=0)throw Error('Su 必須大於零。');if(wet&&(x.water<0||x.water>x.H||x.gammaSat<=1))throw Error('等水位深度需 0≤h₁≤H，飽和單位重須＞1 tf/m³。');if(anchored&&(x.anchor<0||x.anchor>=x.H||x.spacing<=0||x.angle<0||x.angle>=80))throw Error('地錨深度需 0≤a＜H、水平間距＞0、向下傾角 0～80°。');
let Ka=soil==='clay'?1:Math.tan((45-x.phi/2)*Math.PI/180)**2,Kp=1/Ka,K=Kp-Ka;
let ge=wet?x.gammaSat-1:x.gamma,w=wet?x.water:x.H;
let Q=x.q+x.gamma*w+ge*(x.H-w);if(soil==='clay')Q=x.q+x.gammaClay*x.H;
let above=[];if(soil==='clay'){let z0=Math.max(0,(2*x.su-x.q)/x.gammaClay);if(z0<x.H)above.push([z0,x.H,Math.max(0,x.q-2*x.su),Math.max(0,Q-2*x.su)])}else{if(w>0)above.push([0,w,Ka*x.q,Ka*(x.q+x.gamma*w)]);if(w<x.H)above.push([w,x.H,Ka*(x.q+x.gamma*w),Ka*Q])}
let top=integrals(above),Pa=top.F,ybar=Pa>0?x.H-top.J/Pa:0,B=4*x.su-Q;
if(soil!=='sand'&&B<=0)throw Error('淨抵抗壓力 B=4Su−(上覆土重＋q)≤0，無法形成穩定入土平衡。');
if(Pa<=1e-12)throw Error('主動土壓合力為零；黏土張裂或水充填可能控制，不能用零載重宣告設計通過。');
const trace={root:{},shearRoots:[]};let D,y0=0,coeff=[],tail=[],transition=0,Ta=0,formula;
if(anchored){let net0=soil==='sand'?Ka*Q:-B,slope=soil==='sand'?-ge*K:0;
let fn=d=>top.J-x.anchor*Pa+net0*((x.H-x.anchor)*d+d*d/2)+slope*((x.H-x.anchor)*d*d/2+d*d*d/3);
trace.root.equation="anchor";trace.root.net0=net0;trace.root.slope=slope;D=positiveRoot(fn,0,trace.root);tail=[[x.H,x.H+D,net0,net0+slope*D]];let all=integrals([...above,...tail]);Ta=all.F;if(Ta<=0)throw Error('計算地錨水平反力≤0；目前支點配置超出單層拉錨適用範圍。');formula='ΣM錨=∫p(z)(z−a)dz=0；Tₕ=∫p(z)dz。以分段線性土壓精確積分，修正原反力／彎矩公式。';
}else if(soil==='sand'){
let gK=ge*K,pH=Ka*Q;y0=pH/gK;let positive=[...above,[x.H,x.H+y0,pH,0]],ip=integrals(positive);Pa=ip.F;ybar=x.H+y0-ip.J/Pa;let rev=ge*y0*K+Q*Kp;
coeff=[1,rev/gK,-8*Pa/gK,-6*Pa*(2*ybar*gK+rev)/gK**2,-(6*Pa*ybar*rev+4*Pa**2)/gK**2];
let poly=l=>coeff.reduce((v,k)=>v*l+k,0),l=positiveRoot(poly,0,trace.root);trace.root.equation="quartic";trace.root.positiveIntegral=ip;trace.root.rev=rev;trace.root.gK=gK;trace.root.l=l;D=y0+l;transition=(gK*l*l-2*Pa)/(rev+2*gK*l);if(transition<=0||transition>l)throw Error('懸臂轉向區不成立；請改用完整土壤互制分析。');let zt=x.H+D-transition,pt=-gK*(l-transition),pb=rev+gK*l;
trace.tailParams={zt,pt,pb,l,gK,rev};above=positive;tail=[[x.H+y0,zt,0,pt],[zt,x.H+D,pt,pb]];formula='L⁴+c₁L³+c₂L²+c₃L+c₄=0；D=y₀+L。延用原砂土懸臂四次方程式，採雙精度括根法。';
}else{
let C=2*x.su;coeff=[B*B/(6*C)-B/2,Pa-2*Pa*B/(6*C),Pa*Pa/(6*C)+Pa*ybar];D=positiveRoot(d=>coeff[0]*d*d+coeff[1]*d+coeff[2],0,trace.root);trace.root.equation="quadratic";trace.root.C=C;transition=(B*D-Pa)/(4*x.su);if(transition<=0||transition>D)throw Error('黏土轉向區無有效解。');let zt=x.H+D-transition;trace.tailParams={zt};tail=[[x.H,zt,-B,-B],[zt,x.H+D,-B,4*x.su+Q]];formula='A D²+B₁ D+C₁=0；B=4Su−Q。延用原黏土二次平衡式，上覆壓力 Q 改取實際砂土／黏土條件。';
}
let segs=[...above,...tail],L=x.H+D,end=integrals(segs),resF=end.F-Ta,resM=end.J-Ta*x.anchor;
function vm(z,after=true){let i=integrals(segs,z),t=anchored&&(z>x.anchor||(after&&Math.abs(z-x.anchor)<1e-9))?Ta:0;return {F:i.F,J:i.J,anchorTerm:t,V:i.F-t,M:z*i.F-i.J-t*(z-x.anchor)}}
let breaks=[0,L,...segs.flatMap(s=>[s[0],s[1]]),...(anchored?[x.anchor]:[])].sort((a,b)=>a-b).filter((v,i,a)=>!i||Math.abs(v-a[i-1])>1e-8),pts=[...breaks];for(let i=1;i<breaks.length;i++){let a=breaks[i-1],b=breaks[i],last=a+1e-9;for(let j=1;j<=30;j++){let z=a+(b-a)*j/30;if(vm(last).V*vm(z-1e-9).V<0){const rt={};pts.push(root(t=>vm(t).V,last,z-1e-9,rt));trace.shearRoots.push(rt);}last=z}}
trace.momentCandidates=pts.map(z=>({z,...vm(z)}));let max={M:0,z:0};for(const z of pts){let v=Math.abs(vm(z).M);if(v>max.M)max={M:v,z}}
const vpts=[...breaks];for(const [a,b,p0,p1] of segs){if(p0*p1<0)vpts.push(a-p0*(b-a)/(p1-p0));}trace.shearCandidates=vpts.flatMap(z=>[{z,side:"after",...vm(z,true)},...(anchored&&Math.abs(z-x.anchor)<1e-8?[{z,side:"before",...vm(z,false)}]:[])]);trace.maxShear=trace.shearCandidates.reduce((m,c)=>Math.abs(c.V)>Math.abs(m.V)?c:m,{z:0,V:0,M:0});let sigma=max.M*100000/(x.S*x.eta),Ddesign=x.mult*D,Dprovided=x.length-x.H;
// TW 112 §8.8.1: reduced strength, moments only below the lowest anchor; Ms omitted.
let norm=null;
if(anchored){
 const kr=Math.tan((45-Math.atan(Math.tan(x.phi*Math.PI/180)/x.fs)*90/Math.PI)*Math.PI/180)**2,pr=1/kr,sur=x.su/x.fs;
 function normSegs(d){let a=[];if(w>0)a.push([0,w,kr*x.q,kr*(x.q+x.gamma*w)]);if(w<x.H)a.push([w,x.H,kr*(x.q+x.gamma*w),kr*Q]);
 if(soil==='sand')a.push([x.H,x.H+d,kr*Q,kr*(Q+ge*d)-pr*ge*d]);
 else{let cut=Math.max(0,(2*sur-Q)/x.gammaClay),z=Math.min(d,cut);if(z>0)a.push([x.H,x.H+z,-2*sur,-x.gammaClay*z-2*sur]);if(d>z)a.push([x.H+z,x.H+d,Q-4*sur,Q-4*sur]);}
 return a.map(([a,b,p,q])=>{let lo=Math.max(a,x.anchor),v=p+(q-p)*(lo-a)/(b-a);return [lo,b,v,q]}).filter(s=>s[1]>s[0]);}
 function nm(d){let j=integrals(normSegs(d));return j.J-x.anchor*j.F}
 let dn=null;trace.normRoot={};try{dn=positiveRoot(nm,0,trace.normRoot)}catch(err){trace.normRoot.error=err.message}let mom=nm(Dprovided);trace.normSegments=normSegs(Dprovided);trace.normIntegral=integrals(trace.normSegments);trace.normKr=kr;trace.normPr=pr;trace.normCut=Math.max(0,(2*sur-Q)/x.gammaClay);norm={phiReduced:Math.atan(Math.tan(x.phi*Math.PI/180)/x.fs)*180/Math.PI,suReduced:sur,Drequired:dn,netMoment:mom,pass:x.fs>=1.2&&dn!==null&&mom<=1e-8};if(dn!==null)Ddesign=Math.max(Ddesign,dn);
}

trace.top={segments:soil==='sand'&&!anchored?above.slice(0,-1):above,integral:top};trace.end=end;return {trace,x,name,anchored,soil,wet,Ka,Kp,Q,ge,Pa,ybar,B,y0,D,Ddesign,Dprovided,L,Ta,anchorHorizontal:Ta*x.spacing,anchorAxial:Ta*x.spacing/Math.cos(x.angle*Math.PI/180),Mmax:max.M,zM:max.z,sigma,ratio:sigma/x.fb,Srequired:max.M*100000/(x.fb*x.eta),segs,coeff,transition,resF,resM,formula,norm,depthPass:Dprovided>=Ddesign,stressPass:sigma<=x.fb,legacyHlim:soil!=='sand'?(4*x.su-x.q)/(x.fs*x.gammaClay):null,vm};
}
if(typeof module!=='undefined')module.exports={analyze,DEFAULT,CASES,integrals,pressure};

