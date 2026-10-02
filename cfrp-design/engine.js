/* CFRP Workbench 1.0 — units: input cm, kgf/cm², tf; internal N, mm, MPa. */
(function(root){
'use strict';
const K=.0980665,TF=9806.65, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function bisect(f,a,b){let fa=f(a);if(!Number.isFinite(fa)||!Number.isFinite(f(b))||fa*f(b)>0)throw Error('無法建立力平衡解；請確認幾何尺寸及配筋。');for(let i=0;i<100;i++){const c=(a+b)/2,fc=f(c);if(fa*fc<=0)b=c;else{a=c;fa=fc;}}return (a+b)/2;}
function material(p){return {fc:p.fc*K,fy:p.fy*K,Es:p.Es*K,Ef:p.Ef*K,efu:p.CE*Math.min(p.efu,p.ffu/p.Ef),ffu:p.CE*p.ffu*K,t:p.n*p.tf};}
// Closed-form integration of the parabola/rectangle used in Sika's 2026 ACI 440.2-23 software manual.
// Stress plateau 0.85 fc, peak strain .002, ultimate strain .003.
function concrete(c,ec,fc,b){const r=ec/.002;let I,J;if(r<=1){I=r-r*r/3;J=r/3-r*r/12;}else{const q=1/r;I=1-q/3;J=.5-q/3+q*q/12;}return {C:.85*fc*b*c*I,y:c*J/I};}
function flex(p,n=p.n){const m=material({...p,n}),b=p.b*10,h=p.h*10,d=p.d*10,df=p.df*10,As=p.As*100,Af=m.t*p.bf*10;
 const efd=n?Math.min(.41*Math.sqrt(m.fc/(m.Ef*m.t)),.9*m.efu):0;
 function at(c){const ec=n?Math.min(.003,(efd+p.ebi)*c/(df-c)):.003;const ef=n?Math.max(0,ec*(df-c)/c-p.ebi):0,es=ec*(d-c)/c,fs=clamp(m.Es*es,-m.fy,m.fy),cc=concrete(c,ec,m.fc,b);return {c,ec,ef,es,fs,...cc,Tf:Af*m.Ef*ef,Ts:As*fs};}
 const c=bisect(x=>{const r=at(x);return r.C-r.Ts-r.Tf;},.001,Math.min(d,df)*.999999),r=at(c),ey=m.fy/m.Es,phi=clamp(.65+.25*(r.es-ey)/.003,.65,.90),Mn=(r.Ts*(d-r.y)+.85*r.Tf*(df-r.y));
 return {...r,efd,Af,phi,ey,Mn:Mn/TF/1000,capacity:phi*Mn/TF/1000,ratio:p.Mu/(phi*Mn/TF/1000),residual:(r.C-r.Ts-r.Tf)/TF,mode:r.ec>=.003-1e-9?'混凝土極限壓應變':'CFRP 脫黏／材料應變',t:m.t};}
function shear(p,n=p.n){const m=material({...p,n}),b=p.b*10,d=p.d*10,df=p.dv*10,w=p.w*10,sf=p.sf*10,Av=p.Av*100,ss=p.ss*10,a=p.angle*Math.PI/180;
 let Le=0,k1=0,k2=1,kv=.75,ef=0;if(n){if(p.wrap==='full')ef=Math.min(.004,.75*m.efu);else{Le=23300/Math.pow(m.t*m.Ef,.58);k1=Math.pow(m.fc/27,2/3);k2=Math.max(0,(df-(p.wrap==='side'?2:1)*Le)/df);kv=Math.min(.75,k1*k2*Le/(11900*m.efu));ef=Math.min(.004,kv*m.efu);}}
 const Vc=.17*Math.sqrt(m.fc)*b*d,Vs=Av*m.fy*d/ss,Af=(p.shape==='circle'?Math.PI/2:2)*m.t*w,Vf=Af*m.Ef*ef*df*(Math.sin(a)+Math.cos(a))/sf,psi=p.wrap==='full'?.95:.85,limit=.66*Math.sqrt(m.fc)*b*d,cap=.75*(Vc+Vs+psi*Vf)/TF;
 const spacingMax=Math.min(d/(Vs+Vf>.33*Math.sqrt(m.fc)*b*d?4:2),Vs+Vf>.33*Math.sqrt(m.fc)*b*d?300:600)/10;
 const avmin=Math.max(.062*Math.sqrt(m.fc),.35)*b*ss/m.fy/100;
 return {Vc:Vc/TF,Vs:Vs/TF,Vf:Vf/TF,capacity:cap,ratio:p.Vu/cap,psi,ef,Le:Le/10,k1,k2,kv,limit:limit/TF,reinforcementOK:Vs+Vf<=limit+1e-8,spacingMax,spacingOK:p.ss<=spacingMax&&(n===0||p.w===p.sf||p.sf<=spacingMax),avmin,minimumOK:p.Av>=avmin,t:m.t};}
function column(p,n=p.n){const m=material({...p,n}),b=Math.min(p.b,p.h)*10,h=Math.max(p.b,p.h)*10,D=p.shape==='circle'?p.b*10:Math.hypot(b,h),rc=p.rc*10,Ag=p.shape==='circle'?Math.PI*D*D/4:b*h-(4-Math.PI)*rc*rc,As=p.As*100,rho=As/Ag;
 const areaRatio=p.shape==='circle'?1:clamp((1-((b/h)*(h-2*rc)**2+(h/b)*(b-2*rc)**2)/(3*Ag)-rho)/(1-rho),0,1),ka=p.shape==='circle'?1:areaRatio*(b/h)**2,ef=.55*m.efu,fl=2*m.Ef*m.t*ef/D;
 const kb=p.shape==='circle'?1:areaRatio*Math.sqrt(h/b);
 const geo=p.shape==='circle'||(h/b<=2&&h<=900&&b<=900&&rc>=13),eligible=geo&&(n===0||fl/m.fc>=.08),fccMax=m.fc+(n&&eligible?.95*3.3*ka*fl:0),eccu=.002*(1.5+12*kb*fl/m.fc*Math.pow(ef/.002,.45)),E2=(fccMax-m.fc)/eccu,Ec=4700*Math.sqrt(m.fc),transition=2*m.fc/(Ec-E2),fcc=(n&&eligible&&eccu>.01)?(.01<transition?Ec*.01-(Ec-E2)**2*.01**2/(4*m.fc):m.fc+E2*.01):fccMax,phi=p.ties==='spiral'?.75:.65,axial=p.ties==='spiral'?.85:.80,cap=axial*phi*(.85*fcc*(Ag-As)+m.fy*As)/TF;
 // Exact recovered legacy calculation: denominator used single-ply mm with kgf/cm².
 const legacyEfd=n?Math.min(.41*Math.sqrt(p.fc/(n*p.tf*p.Ef)),.9*p.efu):0,kc=p.shape==='circle'?.95:(p.b===p.h?.75:.5),legacyD=p.shape==='circle'?p.b:Math.max(p.b,p.h),legacyFl=n?2*(m.t/10)*p.Ef*legacyEfd/legacyD:0,theta=Math.min(36+p.fc/35,45),legacyFcc=p.fc+kc*legacyFl*Math.tan((45+theta/2)*Math.PI/180)**2;
 return {Ag:Ag/100,areaRatio,ka,kb,eccu,fccMax:fccMax/K,strainCapped:eccu>.01,ef,fl:fl/K,fcc:fcc/K,confinementRatio:fl/m.fc,eligible,geo,capacity:cap,ratio:p.Pu/cap,phi,axial,t:m.t,legacyFcc,legacyEfd};}
function validate(p,mode){for(const k of ['fc','fy','Es','Ef','ffu','efu','CE','tf','b','h','As'])if(!(Number.isFinite(p[k])&&p[k]>0))throw Error(k+' 必須大於 0。');if(!Number.isInteger(p.n)||p.n<0||p.n>200)throw Error('層數需為 0–200 的整數。');if(p.CE>1||p.efu>.1)throw Error('CE 不可超過 1；材料應變請填小數，例如 0.015。');if(p.fy*K>550)throw Error('本版限 fy ≤ 550 MPa。');if(mode==='flex'){if(!(p.d>0&&p.d<p.h&&p.df>=p.h&&p.bf>0&&p.bf<=p.b&&p.Mu>=0&&p.ebi>=0&&p.ebi<.003))throw Error('請確認 0<d<h、df≥h、0<bf≤b、Mu≥0，初始應變在 0–0.003 之間。');}if(mode==='shear'){if(!(p.d>0&&p.d<=p.h&&p.dv>0&&p.dv<=p.h&&p.Av>=0&&p.ss>0&&p.w>0&&p.sf>=p.w&&p.angle>=45&&p.angle<=90&&p.Vu>=0))throw Error('請確認剪力深度、箍筋、條帶寬度及間距；角度限 45–90°。');}if(mode==='column'){const Ag=p.shape==='circle'?Math.PI*p.b*p.b/4:p.b*p.h-(4-Math.PI)*p.rc*p.rc;if(!(p.As<Ag&&p.rc>=0&&2*p.rc<Math.min(p.b,p.h)&&p.Pu>=0))throw Error('請確認主筋面積、圓角半徑及軸力。');}return true;}
root.CFRP={K,TF,material,concrete,flex,shear,column,validate};if(typeof module!=='undefined')module.exports=root.CFRP;
})(typeof globalThis!=='undefined'?globalThis:this);
