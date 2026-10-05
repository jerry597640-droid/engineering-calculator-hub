/* CFRP Workbench 1.0 — units: input cm, kgf/cm², tf; internal N, mm, MPa. */
(function(root){
'use strict';
const K=.0980665,TF=9806.65, clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function bisect(f,a,b,history=[]){let fa=f(a);if(!Number.isFinite(fa)||!Number.isFinite(f(b))||fa*f(b)>0)throw Error('無法建立力平衡解；請確認幾何尺寸及配筋。');for(let i=0;i<100;i++){const c=(a+b)/2,fc=f(c);const branch=fa*fc<=0;history.push({i,a,b,c,residual:fc,branch:branch?'b=c':'a=c'});if(branch)b=c;else{a=c;fa=fc;}}return (a+b)/2;}
function material(p){return {fc:p.fc*K,fy:p.fy*K,Es:p.Es*K,Ef:p.Ef*K,efu:p.CE*Math.min(p.efu,p.ffu/p.Ef),ffu:p.CE*p.ffu*K,t:p.n*p.tf};}
// Closed-form integration of the parabola/rectangle used in Sika's 2026 ACI 440.2-23 software manual.
// Stress plateau 0.85 fc, peak strain .002, ultimate strain .003.
function concrete(c,ec,fc,b){const r=ec/.002;let I,J;if(r<=1){I=r-r*r/3;J=r/3-r*r/12;}else{const q=1/r;I=1-q/3;J=.5-q/3+q*q/12;}return {C:.85*fc*b*c*I,y:c*J/I,_integration:{r,I,J}};}
function flex(p,n=p.n){const m=material({...p,n}),b=p.b*10,h=p.h*10,d=p.d*10,df=p.df*10,As=p.As*100,Af=m.t*p.bf*10;
 const efdDebond=n?.41*Math.sqrt(m.fc/(m.Ef*m.t)):0,efdRupture=.9*m.efu;const efd=n?Math.min(efdDebond,efdRupture):0;
 function at(c){const ec=n?Math.min(.003,(efd+p.ebi)*c/(df-c)):.003;const ef=n?Math.max(0,ec*(df-c)/c-p.ebi):0,es=ec*(d-c)/c,fs=clamp(m.Es*es,-m.fy,m.fy),cc=concrete(c,ec,m.fc,b);return {c,ec,ef,es,fs,...cc,Tf:Af*m.Ef*ef,Ts:As*fs};}
 const history=[];const c=bisect(x=>{const r=at(x);return r.C-r.Ts-r.Tf;},.001,Math.min(d,df)*.999999,history),r=at(c),ey=m.fy/m.Es,phi=clamp(.65+.25*(r.es-ey)/.003,.65,.90),Mn=(r.Ts*(d-r.y)+.85*r.Tf*(df-r.y));
 const result={...r,efd,Af,phi,ey,Mn:Mn/TF/1000,capacity:phi*Mn/TF/1000,ratio:p.Mu/(phi*Mn/TF/1000),residual:(r.C-r.Ts-r.Tf)/TF,mode:r.ec>=.003-1e-9?'混凝土極限壓應變':'CFRP 脫黏／材料應變',t:m.t};result.trace=flexTrace(p,n,m,result,d,df,As,Af,history,{efdDebond,efdRupture,integration:r._integration});delete result._integration;result.inputSnapshot=JSON.stringify({...p,n});return result;}
function shear(p,n=p.n){const m=material({...p,n}),b=p.b*10,d=p.d*10,df=p.dv*10,w=p.w*10,sf=p.sf*10,Av=p.Av*100,ss=p.ss*10,a=p.angle*Math.PI/180;
 let Le=0,k1=0,k2=1,kv=.75,ef=0,k2Raw=null,kvRaw=null;if(n){if(p.wrap==='full')ef=Math.min(.004,.75*m.efu);else{Le=23300/Math.pow(m.t*m.Ef,.58);k1=Math.pow(m.fc/27,2/3);k2Raw=(df-(p.wrap==='side'?2:1)*Le)/df;k2=Math.max(0,k2Raw);kvRaw=k1*k2*Le/(11900*m.efu);kv=Math.min(.75,kvRaw);ef=Math.min(.004,kv*m.efu);}}
 const Vc=.17*Math.sqrt(m.fc)*b*d,Vs=Av*m.fy*d/ss,Af=(p.shape==='circle'?Math.PI/2:2)*m.t*w,Vf=Af*m.Ef*ef*df*(Math.sin(a)+Math.cos(a))/sf,psi=p.wrap==='full'?.95:.85,limit=.66*Math.sqrt(m.fc)*b*d,cap=.75*(Vc+Vs+psi*Vf)/TF;
 const spacingMax=Math.min(d/(Vs+Vf>.33*Math.sqrt(m.fc)*b*d?4:2),Vs+Vf>.33*Math.sqrt(m.fc)*b*d?300:600)/10;
 const avmin=Math.max(.062*Math.sqrt(m.fc),.35)*b*ss/m.fy/100;
 const result={Vc:Vc/TF,Vs:Vs/TF,Vf:Vf/TF,capacity:cap,ratio:p.Vu/cap,psi,ef,Le:Le/10,k1,k2,kv,limit:limit/TF,reinforcementOK:Vs+Vf<=limit+1e-8,spacingMax,spacingOK:p.ss<=spacingMax&&(n===0||p.w===p.sf||p.sf<=spacingMax),avmin,minimumOK:p.Av>=avmin,t:m.t};result.trace=shearTrace(p,n,m,result,{b,d,df,w,sf,Av,ss,angle:a,Le,k1,k2,kv,ef,Vc,Vs,Af,Vf,psi,limit,spacingMax,avmin,k2Raw,kvRaw});result.inputSnapshot=JSON.stringify({...p,n});return result;}
function column(p,n=p.n){const m=material({...p,n}),b=Math.min(p.b,p.h)*10,h=Math.max(p.b,p.h)*10,D=p.shape==='circle'?p.b*10:Math.hypot(b,h),rc=p.rc*10,Ag=p.shape==='circle'?Math.PI*D*D/4:b*h-(4-Math.PI)*rc*rc,As=p.As*100,rho=As/Ag;
 const areaRaw=p.shape==='circle'?1:(1-((b/h)*(h-2*rc)**2+(h/b)*(b-2*rc)**2)/(3*Ag)-rho)/(1-rho),areaRatio=p.shape==='circle'?1:clamp(areaRaw,0,1),ka=p.shape==='circle'?1:areaRatio*(b/h)**2,ef=.55*m.efu,fl=2*m.Ef*m.t*ef/D;
 const kb=p.shape==='circle'?1:areaRatio*Math.sqrt(h/b);
 const geo=p.shape==='circle'||(h/b<=2&&h<=900&&b<=900&&rc>=13),eligible=geo&&(n===0||fl/m.fc>=.08),fccMax=m.fc+(n&&eligible?.95*3.3*ka*fl:0),eccu=.002*(1.5+12*kb*fl/m.fc*Math.pow(ef/.002,.45)),E2=(fccMax-m.fc)/eccu,Ec=4700*Math.sqrt(m.fc),transition=2*m.fc/(Ec-E2),fcc=(n&&eligible&&eccu>.01)?(.01<transition?Ec*.01-(Ec-E2)**2*.01**2/(4*m.fc):m.fc+E2*.01):fccMax,phi=p.ties==='spiral'?.75:.65,axial=p.ties==='spiral'?.85:.80,cap=axial*phi*(.85*fcc*(Ag-As)+m.fy*As)/TF;
 // Recovered legacy calculation: the stress-unit ratio cancels; the thickness is in mm. Original fc_1 is design strength, distinct from measured concrete strength.
 const legacyEfd=n?Math.min(.41*Math.sqrt(p.target/(n*p.tf*p.Ef)),.9*p.efu):0,kc=p.shape==='circle'?.95:(p.b===p.h?.75:.5),legacyD=p.shape==='circle'?p.b:Math.max(p.b,p.h),legacyFl=n?2*(m.t/10)*p.Ef*legacyEfd/legacyD:0,theta=Math.min(36+p.fc/35,45),legacyFcc=p.fc+kc*legacyFl*Math.tan((45+theta/2)*Math.PI/180)**2;
 const result={Ag:Ag/100,areaRatio,ka,kb,eccu,fccMax:fccMax/K,strainCapped:eccu>.01,ef,fl:fl/K,fcc:fcc/K,confinementRatio:fl/m.fc,eligible,geo,capacity:cap,ratio:p.Pu/cap,phi,axial,t:m.t,legacyFcc,legacyEfd};result.trace=columnTrace(p,n,m,result,{b,h,D,rc,Ag,As,rho,areaRatio,ka,kb,ef,fl,geo,eligible,fccMax,eccu,E2,Ec,transition,fcc,phi,axial,legacyEfd,kc,legacyD,legacyFl,theta,legacyFcc,areaRaw});result.inputSnapshot=JSON.stringify({...p,n});return result;}
function validate(p,mode){for(const k of ['fc','fy','Es','Ef','ffu','efu','CE','tf','b','h','As'])if(!(Number.isFinite(p[k])&&p[k]>0))throw Error(k+' 必須大於 0。');if(!Number.isInteger(p.n)||p.n<0||p.n>200)throw Error('層數需為 0–200 的整數。');if(p.CE>1||p.efu>.1)throw Error('CE 不可超過 1；材料應變請填小數，例如 0.015。');if(p.fy*K>550)throw Error('本版限 fy ≤ 550 MPa。');if(mode==='flex'){if(!(p.d>0&&p.d<p.h&&p.df>=p.h&&p.bf>0&&p.bf<=p.b&&p.Mu>=0&&p.ebi>=0&&p.ebi<.003))throw Error('請確認 0<d<h、df≥h、0<bf≤b、Mu≥0，初始應變在 0–0.003 之間。');}if(mode==='shear'){if(!(p.d>0&&p.d<=p.h&&p.dv>0&&p.dv<=p.h&&p.Av>=0&&p.ss>0&&p.w>0&&p.sf>=p.w&&p.angle>=45&&p.angle<=90&&p.Vu>=0))throw Error('請確認剪力深度、箍筋、條帶寬度及間距；角度限 45–90°。');}if(mode==='column'){const Ag=p.shape==='circle'?Math.PI*p.b*p.b/4:p.b*p.h-(4-Math.PI)*p.rc*p.rc;if(!(p.As<Ag&&p.rc>=0&&2*p.rc<Math.min(p.b,p.h)&&p.Pu>=0))throw Error('請確認主筋面積、圓角半徑及軸力。');}return true;}
function traceStart(p,n,m){const t=[];t.add=(title,formula,substitution,result,unit='',condition='',source='既有 CFRP 引擎；ACI 指南計算框架與原工具來源')=>t.push({title,formula,substitution,result,unit,condition,source});
 for(const k of ['fc','fy','Es','Ef'])t.add('材料單位 '+k,'SI = 輸入 × 0.0980665',`${p[k]} × ${K}`,m[k],'MPa');
 t.add('材料設計極限應變','εfu = CE × min(εfu*, ffu*/Ef)',`${p.CE} × min(${p.efu}, ${p.ffu}/${p.Ef})`,m.efu,'','同時考慮應變證明值與強度／模數控制；環境折減 CE 由輸入');t.add('設計極限強度','ffu = CE ffu* K',`${p.CE} × ${p.ffu} × ${K}`,m.ffu,'MPa');t.add('CFRP總厚度','t = n tf',`${n} × ${p.tf}`,m.t,'mm',`本候選層數 ${n}，保留整數原值`);return t;}
function flexTrace(p,n,m,r,d,df,As,Af,history,captured){const t=traceStart(p,n,m),a=t.add;
 a('斷面轉換','b,h,d,df,bf(cm) ×10；As(cm²)×100',`b=${p.b}→${p.b*10}；h=${p.h}→${p.h*10}；d=${p.d}→${d}；df=${p.df}→${df}；As=${p.As}×100`,As,'mm²');a('FRP面積','Af=t bf(mm)',`${m.t} × ${p.bf*10}`,Af,'mm²');
 a('有效應變控制候選',n?'εfd=min(0.41√(fc/(Ef t)),0.9εfu)':'n=0 → εfd=0',n?`min(${captured.efdDebond}, ${captured.efdRupture})`:'無FRP',r.efd,'','脫黏與材料應變取最小值；n=0避免除零');
 a('截面平衡二分迭代','R(c)=C(c)-Ts(c)-Tf(c)；c=(a+b)/2',history.map(x=>`i=${x.i}, a=${x.a}, b=${x.b}, c=${x.c}, R=${x.residual} N, 更新=${x.branch}`).join('\n'),r.c,'mm','初始 [.001,min(d,df)×.999999]；固定100次迭代，不宣稱額外收斂準則');
 a('混凝土壓應變',n?'εc=min(.003,(εfd+εbi)c/(df-c))':'εc=.003',n?`min(.003,(${r.efd}+${p.ebi})×${r.c}/(${df}-${r.c}))`:'.003',r.ec);
 a('FRP與鋼筋應變','εf=max(0,εc(df-c)/c-εbi)；εs=εc(d-c)/c',`εf=max(0,${r.ec}×(${df}-${r.c})/${r.c}-${p.ebi})；εs=${r.ec}×(${d}-${r.c})/${r.c}`,`εf=${r.ef}；εs=${r.es}`,'',n?'初始應變由輸入扣除':'n=0，FRP應變指定0');
 a('鋼筋應力上下限','fs=clamp(Es εs,-fy,fy)',`clamp(${m.Es}×${r.es},-${m.fy},${m.fy})`,r.fs,'MPa');
 const {r:q,I,J}=captured.integration;
 a('混凝土壓力積分','q=εc/.002；q≤1:I=q-q²/3,J=q/3-q²/12；否則I=1-1/(3q),J=.5-1/(3q)+1/(12q²)',`q=${q}；I=${I}；J=${J}；C=.85×${m.fc}×${p.b*10}×${r.c}×${I}；y=c J/I`,`C=${r.C} N；y=${r.y} mm`,'','拋物線／矩形原模型','Sika 2026 ACI 440.2-23 軟體手冊；原工具已採閉式積分');
 a('拉力','Ts=As fs；Tf=Af Ef εf',`${As}×${r.fs}；${Af}×${m.Ef}×${r.ef}`,`Ts=${r.Ts}；Tf=${r.Tf}`,'N');a('平衡殘差','R=(C-Ts-Tf)/9806.65',`(${r.C}-${r.Ts}-${r.Tf})/${TF}`,r.residual,'tf','畫面要求 |R|<1e-6 tf');
 a('折減係數','εy=fy/Es；φ=clamp(.65+.25(εs-εy)/.003,.65,.90)',`εy=${m.fy}/${m.Es}=${r.ey}；clamp(.65+.25×(${r.es}-${r.ey})/.003,.65,.90)`,r.phi);
 a('名義彎矩與折減容量','Mn=[Ts(d-y)+.85Tf(df-y)]/TF/1000；φMn=φMn',`[${r.Ts}×(${d}-${r.y})+.85×${r.Tf}×(${df}-${r.y})]/${TF}/1000；φ=${r.phi}`,`Mn=${r.Mn}；容量=${r.capacity}`,'tf·m');a('需求比與模式','u=Mu/容量',`${p.Mu}/${r.capacity}`,r.ratio,'',`u≤1；控制 ${r.mode}；不對中間值取整`);return t;}
function shearTrace(p,n,m,r,v){const t=traceStart(p,n,m),a=t.add;const {b,d,df,w,sf,Av,ss,angle,Le,k1,k2,kv,ef,Vc,Vs,Af,Vf,psi,limit,spacingMax,avmin,k2Raw,kvRaw}=v;
 a('截面與配筋單位','cm×10→mm；cm²×100→mm²',`b=${b},d=${d},dfv=${df},wf=${w},sf=${sf},Av=${Av},s=${ss}`,angle,'rad',`α=${p.angle}°×π/180；包覆模式=${p.wrap}；形狀=${p.shape}`);
 a('有效黏結長度',n&&p.wrap!=='full'?'Le=23300/(t Ef)^.58':'n=0或完整包覆：Le=0',`${n&&p.wrap!=='full'?`23300/(${m.t}×${m.Ef})^.58`:'不採黏結長度修正'}`,Le,'mm');
 a('混凝土與幾何修正','k1=(fc/27)^(2/3)；k2=max(0,(dfv-qLe)/dfv)',`k1=${k1}；原始k2=${k2Raw}；q=${p.wrap==='side'?2:1}；k2=max(0,(${df}-${p.wrap==='side'?2:1}×${Le})/${df})`,k2,'','n=0/完整包覆保留預設k1=0,k2=1，未採黏結修正');
 a('黏結折減最小候選','κv=min(.75,k1 k2 Le/(11900 εfu))',n&&p.wrap!=='full'?`min(.75,${k1}×${k2}×${Le}/(11900×${m.efu}))；原始κv=${kvRaw}`:'完整包覆或n=0使用初始κv=.75',kv);
 a('有效FRP應變','εfe=min(.004, 完整包覆?.75εfu:κvεfu)',n?`min(.004,${p.wrap==='full'?.75:kv}×${m.efu})`:'n=0 → εfe=0',ef,'','k2回置0時未錨定包覆Vf=0');
 a('混凝土與鋼筋剪力','Vc=.17√fc b d；Vs=Av fy d/s',`.17√${m.fc}×${b}×${d}；${Av}×${m.fy}×${d}/${ss}`,`Vc=${Vc}；Vs=${Vs}`,'N');
 a('FRP有效面積與剪力','Afv=(圓形?π/2:2)t wf；Vf=Afv Ef εfe dfv(sinα+cosα)/sf',`Afv=${Af}；${Af}×${m.Ef}×${ef}×${df}×(sin(${angle})+cos(${angle}))/${sf}`,Vf,'N');
 a('折減剪力容量','φVn=.75(Vc+Vs+ψfVf)/TF',`.75×(${Vc}+${Vs}+${psi}×${Vf})/${TF}`,r.capacity,'tf',`ψf=${psi}；φ=.75`);
 a('補強上限','Vs+Vf≤.66√fc b d',`${Vs}+${Vf} ≤ ${limit}`,r.reinforcementOK?'通過':'未通過','N','原引擎比较容差1e-8 N');
 a('間距上限分支','Vs+Vf > .33√fc b d ? min(d/4,300) : min(d/2,600)',`${Vs+Vf} > ${.33*Math.sqrt(m.fc)*b*d}；原始mm再除10`,spacingMax,'cm',`ss=${p.ss},sf=${p.sf},wf=${p.w}；n=0或w=sf免條帶間距判定；通過=${r.spacingOK}`);
 a('最小箍筋','Av,min=max(.062√fc,.35)b s/fy/100',`max(${.062*Math.sqrt(m.fc)},.35)×${b}×${ss}/${m.fy}/100`,avmin,'cm²',`Av=${p.Av}；通過=${r.minimumOK}`);a('需求比','u=Vu/容量',`${p.Vu}/${r.capacity}`,r.ratio,'','u≤1；容量不足／上限／間距／最小筋須分別判定');return t;}
function columnTrace(p,n,m,r,v){const t=traceStart(p,n,m),a=t.add;const {b,h,D,rc,Ag,As,rho,areaRatio,ka,kb,ef,fl,geo,eligible,fccMax,eccu,E2,Ec,transition,fcc,phi,axial,legacyEfd,kc,legacyD,legacyFl,theta,legacyFcc,areaRaw}=v;
 a('幾何整理','b=min(b,h)×10；h=max(b,h)×10；D=圓形直徑或√(b²+h²)',`b=${b},h=${h},D=${D},rc=${rc},As=${As}`,Ag,'mm²',`Ag=${p.shape==='circle'?'πD²/4':'bh-(4-π)rc²'}；shape=${p.shape}`);
 a('有效圍束面積比','ρ=As/Ag；Ae/Ac=clamp([1-((b/h)(h-2rc)²+(h/b)(b-2rc)²)/(3Ag)-ρ]/(1-ρ),0,1)',`ρ=${rho}；未裁切Ae/Ac=${areaRaw}；${p.shape==='circle'?'圓形指定1':`b/h=${b/h},h/b=${h/b},h-2rc=${h-2*rc},b-2rc=${b-2*rc},Ag=${Ag}`}`,areaRatio,'','圓形=1；矩形結果下限0、上限1');
 a('形狀修正','κa=(Ae/Ac)(b/h)²；κb=(Ae/Ac)√(h/b)',`${areaRatio}×(${b}/${h})²；${areaRatio}×√(${h}/${b})`,`κa=${ka}；κb=${kb}`,'','圓形κa=κb=1');
 a('有效應變與圍束壓力','εfe=.55εfu；fl=2Ef t εfe/D',`.55×${m.efu}=${ef}；2×${m.Ef}×${m.t}×${ef}/${D}`,fl,'MPa');a('適用條件','geo=圓形或(h/b≤2,h≤900,b≤900,rc≥13)；eligible=geo且(n=0或fl/fc≥.08)',`h/b=${h/b},h=${h},b=${b},rc=${rc},n=${n},fl/fc=${fl/m.fc}`,`geo=${geo}；eligible=${eligible}`,'','尺寸mm；不符合不計強度提升');
 a('圍束強度最高值','fcc,max=fc+(n且eligible?.95×3.3κa fl:0)',`${m.fc}+${n&&eligible?`.95×3.3×${ka}×${fl}`:'0'}`,fccMax,'MPa');
 a('圍束極限應變','εccu=.002[1.5+12κb fl/fc(εfe/.002)^.45]',`.002×[1.5+12×${kb}×${fl}/${m.fc}×(${ef}/.002)^.45]`,eccu);
 a('應力應變斜率與轉折','E2=(fcc,max-fc)/εccu；Ec=4700√fc；εt=2fc/(Ec-E2)',`E2=(${fccMax}-${m.fc})/${eccu}=${E2}；Ec=${Ec}；εt=${transition}`,transition,'','原引擎值；不額外修改模型');
 a('0.01壓應變上限修正','n且eligible且εccu>.01：εt>.01用拋物線，否則fc+E2×.01；其他採fcc,max',`eligible=${eligible},n=${n},εccu=${eccu}；採用${n&&eligible&&eccu>.01?(.01<transition?'Ec×.01-(Ec-E2)²×.01²/(4fc)':'fc+E2×.01'):'fcc,max'}`,fcc,'MPa',`fcc,max=${fccMax}；未把strainCapped旗標當作所有分支均提升`);
 a('純軸壓容量','Pcap=軸壓係數×φ[.85fcc(Ag-As)+fy As]/TF',`${axial}×${phi}×[.85×${fcc}×(${Ag}-${As})+${m.fy}×${As}]/${TF}`,r.capacity,'tf',`ties=${p.ties}；螺旋筋(.85,.75)，一般箍筋(.80,.65)；不是P-M容量`);
 a('需求與目標強度','u=Pu/Pcap；fcc/K≥target',`${p.Pu}/${r.capacity}；${fcc}/${K} ≥ ${p.target}`,`u=${r.ratio}；fcc=${r.fcc}`,'kgf/cm²','需求比≤1；層數非0須eligible；目標強度須達標');
 a('舊版比對有效應變','εfd,old=min(.41√(target/(n tf Ef)),.9εfu*)',n?`min(.41√(${p.target}/(${n}×${p.tf}×${p.Ef})),.9×${p.efu})`:'n=0取0',legacyEfd,'','僅舊版比對，不參與新判定');a('舊版圍束比對','fl,old=2(t/10)Ef εfd/Dold；θ=min(36+fc/35,45)；fcc,old=fc+kc fl,old tan²(45+θ/2)',`fl,old=${legacyFl}；Dold=${legacyD}；kc=${kc}；θ=${theta}`,legacyFcc,'kgf/cm²','kc圓.95／方.75／矩.5；僅比對，不參與新判定');return t;}

root.CFRP={K,TF,material,concrete,flex,shear,column,validate};if(typeof module!=='undefined')module.exports=root.CFRP;
})(typeof globalThis!=='undefined'?globalThis:this);

