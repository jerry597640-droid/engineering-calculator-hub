'use strict';
/* Slope Workbench 1.0 — kN, m, kPa, unit out-of-plane thickness.
 * Bishop simplified: overall moment + individual vertical equilibrium.
 * No claim of full horizontal equilibrium. Positive kh acts toward left.
 */
(function(root){
const rad=Math.PI/180, gw=9.80665;
function interp(p,x){if(x<p[0][0]-1e-8||x>p.at(-1)[0]+1e-8)throw Error('座標超出剖面範圍');for(let i=1;i<p.length;i++)if(x<=p[i][0]+1e-8){const a=p[i-1],b=p[i];return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0]);}return p.at(-1)[1];}
function parsePoints(text){return text.trim().split(/\n/).filter(x=>x.trim()).map((l,i)=>{const a=l.trim().split(/[\s,，;；]+/).map(Number);if(a.length!==2||!a.every(Number.isFinite))throw Error('第 '+(i+1)+' 行座標需為兩個數字 x,y');return a;});}
function validate(m){
if(!m||!Array.isArray(m.ground)||m.ground.length<3||m.ground.length>100)throw Error('地表需 3–100 個座標點');
for(let i=0;i<m.ground.length;i++){const p=m.ground[i];if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))throw Error('地表座標無效');if(i&&(p[0]<=m.ground[i-1][0]||p[1]<m.ground[i-1][1]-1e-8))throw Error('地表 x 須嚴格遞增，y 須由低至高、不下降；坡向相反時請鏡射剖面');}
const minY=m.ground[0][1],maxY=m.ground.at(-1)[1];if(maxY-minY<.1)throw Error('剖面高差至少 0.1 m');
if(!Array.isArray(m.layers)||!m.layers.length||m.layers.length>12)throw Error('地層需 1–12 層');
for(let i=0;i<m.layers.length;i++){const l=m.layers[i];for(const k of ['bottom','c','phi','gamma','sat'])if(!Number.isFinite(l[k]))throw Error('地層數字無效');if(l.c<0||l.phi<0||l.phi>=60||l.gamma<=0||l.sat<l.gamma||l.sat>40||l.gamma>40)throw Error('c ≥ 0、0 ≤ φ < 60°、0 < γ ≤ γsat ≤ 40 kN/m³');if(l.bottom>= (i?m.layers[i-1].bottom:maxY)||i===m.layers.length-1&&l.bottom>=minY)throw Error('層底高程必須由高至低，最底層須低於坡趾');}
for(const k of ['q','qa','qb','kh','kv','slices','density','minSpan','maxDepth','arcMin','arcMax','waterNormal','waterRain','ruNormal','ruRain','gammaWater'])if(!Number.isFinite(m[k]))throw Error(k+' 必須為有限數字');
if(m.q<0||m.qb<=m.qa||m.qa<m.ground[0][0]||m.qb>m.ground.at(-1)[0])throw Error('載重 q ≥ 0 且載重起訖 x 須位於剖面內、起點小於終點');
if(m.kh<0||m.kh>.5||m.kv<0||m.kv>.4)throw Error('水平地震係數 0–0.5；垂直係數絕對值 0–0.4');
if(!Number.isInteger(m.slices)||m.slices<10||m.slices>200||!Number.isInteger(m.density)||m.density<6||m.density>30)throw Error('切片數 10–200；搜尋密度 6–30');
if(m.minSpan<=0||m.minSpan>=m.ground.at(-1)[0]-m.ground[0][0]||m.maxDepth<=0||m.arcMin<=0||m.arcMax<=m.arcMin||m.arcMax>10)throw Error('搜尋跨度、深度須為正，圓心距/弦長上限須大於下限且 ≤ 10');
if(m.gammaWater<=0||m.gammaWater>15||m.waterNormal<0||m.waterRain<0||m.ruNormal<0||m.ruNormal>=1||m.ruRain<0||m.ruRain>=1)throw Error('水深 ≥ 0；0 ≤ ru < 1；水單位重 0–15 kN/m³');
if(!['dry','depth','line','ru'].includes(m.waterMode))throw Error('地下水模式無效');
if(m.waterMode==='line')for(const key of ['waterLine','rainLine']){const p=m[key];if(!Array.isArray(p)||p.length<2||p.length>100)throw Error('水位線需 2–100 點');for(let i=0;i<p.length;i++)if(!p[i].every(Number.isFinite)||i&&p[i][0]<=p[i-1][0])throw Error('水位線 x 須嚴格遞增');if(p[0][0]>m.ground[0][0]||p.at(-1)[0]<m.ground.at(-1)[0])throw Error('水位線須涵蓋完整剖面');for(const [x,y]of p)if(x>=m.ground[0][0]&&x<=m.ground.at(-1)[0]&&y>interp(m.ground,x)+1e-7)throw Error('本版不支援地表外積水，水位線不可高於地表');for(const [x,y]of m.ground)if(interp(p,x)>y+1e-7)throw Error('水位線不得高於地表');}
if(!['sw-permanent','sw-temporary','foundation-global','custom'].includes(m.profile))throw Error('檢核設定無效');
if(!['bishop','ordinary'].includes(m.method))throw Error('分析方法無效');
if(m.profile==='custom'){if(!Array.isArray(m.targets)||m.targets.length!==3||m.targets.some(x=>!Number.isFinite(x)||x<1||x>5))throw Error('自訂安全係數需 1–5');if(!String(m.customSource||'').trim())throw Error('自訂門檻必須填寫規範／核定文件及條文來源');}
if(m.mode==='manual'){if(!m.circle||!['cx','cy','r'].every(k=>Number.isFinite(m.circle[k]))||m.circle.r<=0)throw Error('圓心及半徑無效');}
return m;
}
function targets(m){return ['sw-permanent','foundation-global'].includes(m.profile)?[1.5,1.2,1.1]:m.profile==='sw-temporary'?[1.2,1.1,1.0]:m.targets;}
function waterY(m,x,scenario){const yg=interp(m.ground,x);if(m.waterMode==='dry'||m.waterMode==='ru')return -Infinity;if(m.waterMode==='depth')return yg-(scenario==='rain'?m.waterRain:m.waterNormal);return interp(scenario==='rain'?m.rainLine:m.waterLine,x);}
function atLayer(m,y){let top=Infinity;for(const l of m.layers){if(y<=top+1e-7&&y>=l.bottom-1e-7)return l;top=l.bottom;}return null;}
function bottom(c,x){const z=c.r*c.r-(x-c.cx)**2;return z>=0?c.cy-Math.sqrt(z):NaN;}
function circleFromEnds(m,a,b,ratio){const ya=interp(m.ground,a),yb=interp(m.ground,b),dx=b-a,dy=yb-ya,L=Math.hypot(dx,dy),d=L*ratio;return {cx:(a+b)/2-d*dy/L,cy:(ya+yb)/2+d*dx/L,r:Math.hypot(L/2,d),a,b,ratio};}
function intersectionPairs(m,c){const hits=[];for(let i=1;i<m.ground.length;i++){const [ax,ay]=m.ground[i-1],[bx,by]=m.ground[i],dx=bx-ax,dy=by-ay,A=dx*dx+dy*dy,B=2*(dx*(ax-c.cx)+dy*(ay-c.cy)),C=(ax-c.cx)**2+(ay-c.cy)**2-c.r*c.r,D=B*B-4*A*C;if(D<0)continue;for(const t of [(-B-Math.sqrt(D))/(2*A),(-B+Math.sqrt(D))/(2*A)])if(t>=-1e-9&&t<=1+1e-9){const x=ax+t*dx,y=ay+t*dy;if(y<=c.cy+1e-8&&!hits.some(z=>Math.abs(z-x)<1e-6))hits.push(x);}}
hits.sort((a,b)=>a-b);const pairs=[];for(let i=1;i<hits.length;i++){const a=hits[i-1],b=hits[i];if(b-a>=m.minSpan&&bottom(c,(a+b)/2)<interp(m.ground,(a+b)/2)-1e-5)pairs.push({...c,a,b});}return pairs;}
function slices(m,c,scenario,n=m.slices){
const a=c.a,b=c.b;if(b-a<m.minSpan)return {error:'span'};
if(c.cy<Math.max(interp(m.ground,a),interp(m.ground,b))-1e-7)return {error:'upper-arc'};
const cuts=[...Array.from({length:n+1},(_,i)=>a+(b-a)*i/n),...m.ground.map(p=>p[0]).filter(x=>x>a&&x<b),...[m.qa,m.qb].filter(x=>x>a&&x<b)];
// Split exactly at horizontal material interfaces crossing the circular base.
for(const l of m.layers){const dy=c.cy-l.bottom,z=c.r*c.r-dy*dy;if(dy>=0&&z>=0)for(const x of [c.cx-Math.sqrt(z),c.cx+Math.sqrt(z)])if(x>a&&x<b)cuts.push(x);}
cuts.sort((x,y)=>x-y);const xs=cuts.filter((x,i)=>!i||x-cuts[i-1]>1e-7),out=[];let maxD=0;
const gauss=[[-Math.sqrt(3/5),5/9],[0,8/9],[Math.sqrt(3/5),5/9]];
for(let i=1;i<xs.length;i++){const x1=xs[i-1],x2=xs[i],width=x2-x1,x=(x1+x2)/2,y=bottom(c,x),top=interp(m.ground,x),h=top-y,alpha=Math.asin((x-c.cx)/c.r),co=Math.cos(alpha),base=atLayer(m,y);
if(!base||!Number.isFinite(y)||co<.05||h<-1e-7)return {error:'geometry'};
// Depth is concave on each straight ground segment: check both ends and its exact stationary point.
const slope=(interp(m.ground,x2)-interp(m.ground,x1))/width;
const peak=c.cx+c.r*slope/Math.sqrt(1+slope*slope),check=[x1,x2];if(peak>x1&&peak<x2)check.push(peak);
for(const xp of check){const yp=bottom(c,xp),depth=interp(m.ground,xp)-yp;if(!Number.isFinite(yp)||depth<-1e-6||yp<m.layers.at(-1).bottom-1e-7)return {error:'geometry'};maxD=Math.max(maxD,depth);}
if(maxD>m.maxDepth+1e-7)return {error:'depth'};
let W=0,M=0,weightParts=[];for(const [gx,w]of gauss){const xp=x+width*gx/2,yp=bottom(c,xp),tp=interp(m.ground,xp);if(tp<yp-1e-7||yp<m.layers.at(-1).bottom-1e-7)return {error:'geometry'};let lt=Infinity;const wy=waterY(m,xp,scenario);for(const layer of m.layers){const lo=Math.max(yp,layer.bottom),hi=Math.min(tp,lt);lt=layer.bottom;if(hi<=lo)continue;const satHi=m.waterMode==='ru'?lo:Math.min(hi,Math.max(lo,wy));for(const [v0,v1,gamma]of [[lo,satHi,layer.sat],[satHi,hi,layer.gamma]])if(v1>v0){const dw=(v1-v0)*gamma*width*w/2;W+=dw;M+=dw*(v0+v1)/2;weightParts.push({x:xp,weight:w,lo:v0,hi:v1,gamma,dW:dw,y:(v0+v1)/2,layer:layer.name});}}}
const Q=m.q*Math.max(0,Math.min(x2,m.qb)-Math.max(x1,m.qa)),yb=bottom(c,x),u=m.waterMode==='ru'?(scenario==='rain'?m.ruRain:m.ruNormal)*W/width:m.gammaWater*Math.max(0,waterY(m,x,scenario)-yb);
if(W<=0)return {error:'geometry'};
out.push({i:out.length+1,x,x1,x2,y:yb,top,b:width,l:width/co,alpha,W,Q,yg:M/W,u,c:base.c,phi:base.phi,layer:base.name||'土層',weightParts});
}
return {slices:out,maxDepth:maxD};
}
function solve(ss,c,kh=0,kv=0){
let D=0;for(const s of ss)D+=((1-kv)*s.W+s.Q)*Math.sin(s.alpha)+kh*s.W*(c.cy-s.yg)/c.r;
if(D<=1e-10)return {error:'driving'};
const evaluate=F=>{let sum=0,minM=Infinity,negative=0,rows=[];for(const s of ss){const sn=Math.sin(s.alpha),co=Math.cos(s.alpha),t=Math.tan(s.phi*rad),V=(1-kv)*s.W+s.Q,m=co+sn*t/F;if(m<=.05)return null;const ne=(V-s.u*s.b-s.c*s.l*sn/F)/m,R=s.c*s.l+ne*t;sum+=R;minM=Math.min(minM,m);if(ne<-1e-5)negative++;rows.push({...s,V,m,ne,R,T:R/F});}return {sum,minM,negative,rows};};
if(ss.every(s=>s.c===0&&s.phi===0))return {fs:0,ordinary:0,iterations:0,residual:0,D,minM:1,negative:0,rows:ss.map(s=>({...s,V:(1-kv)*s.W+s.Q,m:Math.cos(s.alpha),ne:((1-kv)*s.W+s.Q)/Math.cos(s.alpha)-s.u*s.l,R:0,T:0}))};
let found=null;
for(const initial of [1.5,3,.5]){let F=initial,history=[];for(let it=0;it<300;it++){const z=evaluate(F);if(!z||z.sum<0)break;const raw=z.sum/D;if(!Number.isFinite(raw)||raw<=0)break;history.push({iteration:it+1,F,sum:z.sum,raw,next:.5*(F+raw),difference:Math.abs(raw-F)});if(Math.abs(raw-F)<1e-8*Math.max(1,F)){found={fs:raw,iterations:it+1,initial,history,...evaluate(raw)};break;}F=.5*(F+raw);}if(found)break;}
if(!found)return {error:'convergence'};if(found.minM<.2)return {error:'m-alpha'};
const residual=Math.abs(found.sum-found.fs*D)/Math.max(1,Math.abs(found.fs*D));
if(residual>1e-6)return {error:'residual'};
let ordinary=0;for(const s of ss){const ne=((1-kv)*s.W+s.Q)*Math.cos(s.alpha)-kh*s.W*Math.sin(s.alpha)-s.u*s.l;ordinary+=s.c*s.l+ne*Math.tan(s.phi*rad);}
return {...found,D,ordinary:ordinary/D,residual};
}
function solveOrdinary(ss,c,kh=0,kv=0){let D=0,R=0,negative=0;const rows=ss.map(s=>{const V=(1-kv)*s.W+s.Q,ne=V*Math.cos(s.alpha)-kh*s.W*Math.sin(s.alpha)-s.u*s.l,res=s.c*s.l+ne*Math.tan(s.phi*rad);D+=V*Math.sin(s.alpha)+kh*s.W*(c.cy-s.yg)/c.r;R+=res;if(ne<-1e-5)negative++;return {...s,V,ne,R:res,m:null};});if(D<=1e-10)return {error:'driving'};const fs=R/D;return {fs,ordinary:fs,iterations:1,residual:0,D,minM:null,negative,rows:rows.map(s=>({...s,T:fs?s.R/fs:0}))};}
function analyzeCircle(m,c,scenario){const built=slices(m,c,scenario);if(built.error)return built;let variants=[];for(const kv of scenario==='seismic'&&m.kv?[m.kv,-m.kv]:[0]){const r=(m.method==='ordinary'?solveOrdinary:solve)(built.slices,c,scenario==='seismic'?m.kh:0,kv);if(r.error)return r;variants.push({...r,kv});}variants.sort((a,b)=>a.fs-b.fs);return {...variants[0],circle:c,maxDepth:built.maxDepth,variants:variants.map(v=>({kv:v.kv,fs:v.fs}))};}
function search(m,scenario){
let best=null,top=[],count=0,valid=0,errors={};const X=m.ground.map(p=>p[0]),lo=X[0],hi=X.at(-1),N=m.density;
const exits=[...Array.from({length:N+1},(_,i)=>lo+(hi-lo)*i/N),...X],entries=[...exits];
function tryOne(c){count++;const r=analyzeCircle(m,c,scenario);if(r.error){errors[r.error]=(errors[r.error]||0)+1;return;}valid++;if(!best||r.fs<best.fs)best=r;top.push({fs:r.fs,circle:r.circle,negative:r.negative});if(top.length>40){top.sort((a,b)=>a.fs-b.fs);top.length=20;}}
for(const a of exits)for(const b of entries)if(b-a>=m.minSpan&&interp(m.ground,b)>interp(m.ground,a)+.1)for(let k=0;k<=N;k++)tryOne(circleFromEnds(m,a,b,m.arcMin+(m.arcMax-m.arcMin)*k/N));
// Three local refinements of both endpoints and circular curvature, with original limits retained.
let step=(hi-lo)/N,rstep=(m.arcMax-m.arcMin)/N;
for(let round=0;round<3&&best;round++){const seed=best.circle;step/=2;rstep/=2;for(const da of [-step,0,step])for(const db of [-step,0,step])for(const dr of [-rstep,0,rstep]){const a=seed.a+da,b=seed.b+db,r=seed.ratio+dr;if(a>=lo&&b<=hi&&b-a>=m.minSpan&&r>=m.arcMin&&r<=m.arcMax)tryOne(circleFromEnds(m,a,b,r));}}
top.sort((a,b)=>a.fs-b.fs);return {best,count,valid,errors,top:top.slice(0,12)};
}
function run(m){validate(m);const results=[];for(const scenario of ['normal','rain','seismic']){let r;if(m.mode==='manual'){const pairs=intersectionPairs(m,m.circle),items=pairs.map(c=>analyzeCircle(m,c,scenario));const ok=items.filter(z=>!z.error).sort((a,b)=>a.fs-b.fs);r={best:ok[0]||null,count:items.length,valid:ok.length,errors:items.reduce((o,z)=>{if(z.error)o[z.error]=(o[z.error]||0)+1;return o;},{}),top:ok.map(z=>({fs:z.fs,circle:z.circle,negative:z.negative}))};}else r=search(m,scenario);const j=['normal','rain','seismic'].indexOf(scenario);results.push({...r,scenario,target:targets(m)[j],strict:m.profile==='foundation-global'||m.profile==='custom'&&m.strict});}
return {model:m,results,version:'1.1.0',checked:'2026-10-11'};
}
function benchmarks(){const heights=[.8,2.3,3.3,3.9,4.1,3.6,1.65],angles=[-9,.5,9,18.5,28,39,52],pressures=[7.84,22.54,32.34,38.22,40.18,35.28,16.17];return [0,1].map(wet=>{const ss=heights.map((h,i)=>({i:i+1,b:2.5,l:2.5/Math.cos(angles[i]*rad),alpha:angles[i]*rad,W:50*h,Q:0,yg:0,u:wet?pressures[i]:0,c:20,phi:20}));const z=solve(ss,{cy:0,r:1});return {name:wet?'Rocscience 濕坡七切片':'Rocscience 乾坡七切片',expected:wet?1.555:2.113,actual:z.fs,tolerance:.002,pass:Math.abs(z.fs-(wet?1.555:2.113))<=.002,residual:z.residual,rows:z.rows};});}
const api={interp,parsePoints,validate,targets,waterY,bottom,circleFromEnds,intersectionPairs,slices,solve,solveOrdinary,analyzeCircle,search,run,benchmarks,gw};root.SlopeCore=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof self!=='undefined'?self:globalThis);
