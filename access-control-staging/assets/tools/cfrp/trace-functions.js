function traceStart(p,n,m){const t=[];t.add=(title,formula,substitution,result,unit='',condition='',source='既有 CFRP 引擎；ACI 指南計算框架與原工具來源')=>t.push({title,formula,substitution,result,unit,condition,source});
 for(const k of ['fc','fy','Es','Ef'])t.add('材料單位 '+k,'SI = 輸入 × 0.0980665',`${p[k]} × ${K}`,m[k],'MPa');
 t.add('材料設計極限應變','εfu = CE × min(εfu*, ffu*/Ef)',`${p.CE} × min(${p.efu}, ${p.ffu}/${p.Ef})`,m.efu,'','同時考慮應變證明值與強度／模數控制；環境折減 CE 由輸入');t.add('設計極限強度','ffu = CE ffu* K',`${p.CE} × ${p.ffu} × ${K}`,m.ffu,'MPa');t.add('CFRP總厚度','t = n tf',`${n} × ${p.tf}`,m.t,'mm',`本候選層數 ${n}，保留整數原值`);return t;}
function flexTrace(p,n,m,r,d,df,As,Af,history){const t=traceStart(p,n,m),a=t.add;
 a('斷面轉換','b,h,d,df,bf(cm) ×10；As(cm²)×100',`b=${p.b}→${p.b*10}；h=${p.h}→${p.h*10}；d=${p.d}→${d}；df=${p.df}→${df}；As=${p.As}×100`,As,'mm²');a('FRP面積','Af=t bf(mm)',`${m.t} × ${p.bf*10}`,Af,'mm²');
 a('有效應變控制候選',n?'εfd=min(0.41√(fc/(Ef t)),0.9εfu)':'n=0 → εfd=0',n?`min(${.41*Math.sqrt(m.fc/(m.Ef*m.t))}, ${.9*m.efu})`:'無FRP',r.efd,'','脫黏與材料應變取最小值；n=0避免除零');
 a('截面平衡二分迭代','R(c)=C(c)-Ts(c)-Tf(c)；c=(a+b)/2',history.map(x=>`i=${x.i}, a=${x.a}, b=${x.b}, c=${x.c}, R=${x.residual} N, 更新=${x.branch}`).join('\n'),r.c,'mm','初始 [.001,min(d,df)×.999999]；固定100次迭代，不宣稱額外收斂準則');
 a('混凝土壓應變',n?'εc=min(.003,(εfd+εbi)c/(df-c))':'εc=.003',n?`min(.003,(${r.efd}+${p.ebi})×${r.c}/(${df}-${r.c}))`:'.003',r.ec);
 a('FRP與鋼筋應變','εf=max(0,εc(df-c)/c-εbi)；εs=εc(d-c)/c',`εf=max(0,${r.ec}×(${df}-${r.c})/${r.c}-${p.ebi})；εs=${r.ec}×(${d}-${r.c})/${r.c}`,`εf=${r.ef}；εs=${r.es}`,'',n?'初始應變由輸入扣除':'n=0，FRP應變指定0');
 a('鋼筋應力上下限','fs=clamp(Es εs,-fy,fy)',`clamp(${m.Es}×${r.es},-${m.fy},${m.fy})`,r.fs,'MPa');
 const q=r.ec/.002,I=q<=1?q-q*q/3:1-1/q/3,J=q<=1?q/3-q*q/12:.5-1/q/3+(1/q)**2/12;
 a('混凝土壓力積分','q=εc/.002；q≤1:I=q-q²/3,J=q/3-q²/12；否則I=1-1/(3q),J=.5-1/(3q)+1/(12q²)',`q=${q}；I=${I}；J=${J}；C=.85×${m.fc}×${p.b*10}×${r.c}×${I}；y=c J/I`,`C=${r.C} N；y=${r.y} mm`,'','拋物線／矩形原模型','Sika 2026 ACI 440.2-23 軟體手冊；原工具已採閉式積分');
 a('拉力','Ts=As fs；Tf=Af Ef εf',`${As}×${r.fs}；${Af}×${m.Ef}×${r.ef}`,`Ts=${r.Ts}；Tf=${r.Tf}`,'N');a('平衡殘差','R=(C-Ts-Tf)/9806.65',`(${r.C}-${r.Ts}-${r.Tf})/${TF}`,r.residual,'tf','畫面要求 |R|<1e-6 tf');
 a('折減係數','εy=fy/Es；φ=clamp(.65+.25(εs-εy)/.003,.65,.90)',`εy=${m.fy}/${m.Es}=${r.ey}；clamp(.65+.25×(${r.es}-${r.ey})/.003,.65,.90)`,r.phi);
 a('名義彎矩與折減容量','Mn=[Ts(d-y)+.85Tf(df-y)]/TF/1000；φMn=φMn',`[${r.Ts}×(${d}-${r.y})+.85×${r.Tf}×(${df}-${r.y})]/${TF}/1000；φ=${r.phi}`,`Mn=${r.Mn}；容量=${r.capacity}`,'tf·m');a('需求比與模式','u=Mu/容量',`${p.Mu}/${r.capacity}`,r.ratio,'',`u≤1；控制 ${r.mode}；不對中間值取整`);return t;}
function shearTrace(p,n,m,r,v){const t=traceStart(p,n,m),a=t.add;const {b,d,df,w,sf,Av,ss,angle,Le,k1,k2,kv,ef,Vc,Vs,Af,Vf,psi,limit,spacingMax,avmin}=v;
 a('截面與配筋單位','cm×10→mm；cm²×100→mm²',`b=${b},d=${d},dfv=${df},wf=${w},sf=${sf},Av=${Av},s=${ss}`,angle,'rad',`α=${p.angle}°×π/180；包覆模式=${p.wrap}；形狀=${p.shape}`);
 a('有效黏結長度',n&&p.wrap!=='full'?'Le=23300/(t Ef)^.58':'n=0或完整包覆：Le=0',`${n&&p.wrap!=='full'?`23300/(${m.t}×${m.Ef})^.58`:'不採黏結長度修正'}`,Le,'mm');
 a('混凝土與幾何修正','k1=(fc/27)^(2/3)；k2=max(0,(dfv-qLe)/dfv)',`k1=${k1}；q=${p.wrap==='side'?2:1}；k2=max(0,(${df}-${p.wrap==='side'?2:1}×${Le})/${df})`,k2,'','n=0/完整包覆保留預設k1=0,k2=1，未採黏結修正');
 a('黏結折減最小候選','κv=min(.75,k1 k2 Le/(11900 εfu))',n&&p.wrap!=='full'?`min(.75,${k1}×${k2}×${Le}/(11900×${m.efu}))`:'完整包覆或n=0使用初始κv=.75',kv);
 a('有效FRP應變','εfe=min(.004, 完整包覆?.75εfu:κvεfu)',n?`min(.004,${p.wrap==='full'?.75:kv}×${m.efu})`:'n=0 → εfe=0',ef,'','k2回置0時未錨定包覆Vf=0');
 a('混凝土與鋼筋剪力','Vc=.17√fc b d；Vs=Av fy d/s',`.17√${m.fc}×${b}×${d}；${Av}×${m.fy}×${d}/${ss}`,`Vc=${Vc}；Vs=${Vs}`,'N');
 a('FRP有效面積與剪力','Afv=(圓形?π/2:2)t wf；Vf=Afv Ef εfe dfv(sinα+cosα)/sf',`Afv=${Af}；${Af}×${m.Ef}×${ef}×${df}×(sin(${angle})+cos(${angle}))/${sf}`,Vf,'N');
 a('折減剪力容量','φVn=.75(Vc+Vs+ψfVf)/TF',`.75×(${Vc}+${Vs}+${psi}×${Vf})/${TF}`,r.capacity,'tf',`ψf=${psi}；φ=.75`);
 a('補強上限','Vs+Vf≤.66√fc b d',`${Vs}+${Vf} ≤ ${limit}`,r.reinforcementOK?'通過':'未通過','N','原引擎比较容差1e-8 N');
 a('間距上限分支','Vs+Vf > .33√fc b d ? min(d/4,300) : min(d/2,600)',`${Vs+Vf} > ${.33*Math.sqrt(m.fc)*b*d}；原始mm再除10`,spacingMax,'cm',`ss=${p.ss},sf=${p.sf},wf=${p.w}；n=0或w=sf免條帶間距判定；通過=${r.spacingOK}`);
 a('最小箍筋','Av,min=max(.062√fc,.35)b s/fy/100',`max(${.062*Math.sqrt(m.fc)},.35)×${b}×${ss}/${m.fy}/100`,avmin,'cm²',`Av=${p.Av}；通過=${r.minimumOK}`);a('需求比','u=Vu/容量',`${p.Vu}/${r.capacity}`,r.ratio,'','u≤1；容量不足／上限／間距／最小筋須分別判定');return t;}
function columnTrace(p,n,m,r,v){const t=traceStart(p,n,m),a=t.add;const {b,h,D,rc,Ag,As,rho,areaRatio,ka,kb,ef,fl,geo,eligible,fccMax,eccu,E2,Ec,transition,fcc,phi,axial,legacyEfd,kc,legacyD,legacyFl,theta,legacyFcc}=v;
 a('幾何整理','b=min(b,h)×10；h=max(b,h)×10；D=圓形直徑或√(b²+h²)',`b=${b},h=${h},D=${D},rc=${rc},As=${As}`,Ag,'mm²',`Ag=${p.shape==='circle'?'πD²/4':'bh-(4-π)rc²'}；shape=${p.shape}`);
 a('有效圍束面積比','ρ=As/Ag；Ae/Ac=clamp([1-((b/h)(h-2rc)²+(h/b)(b-2rc)²)/(3Ag)-ρ]/(1-ρ),0,1)',`ρ=${rho}；${p.shape==='circle'?'圓形指定1':`b/h=${b/h},h/b=${h/b},h-2rc=${h-2*rc},b-2rc=${b-2*rc},Ag=${Ag}`}`,areaRatio,'','圓形=1；矩形結果下限0、上限1');
 a('形狀修正','κa=(Ae/Ac)(b/h)²；κb=(Ae/Ac)√(h/b)',`${areaRatio}×(${b}/${h})²；${areaRatio}×√(${h}/${b})`,`κa=${ka}；κb=${kb}`,'','圓形κa=κb=1');
 a('有效應變與圍束壓力','εfe=.55εfu；fl=2Ef t εfe/D',`.55×${m.efu}=${ef}；2×${m.Ef}×${m.t}×${ef}/${D}`,fl,'MPa');a('適用條件','geo=圓形或(h/b≤2,h≤900,b≤900,rc≥13)；eligible=geo且(n=0或fl/fc≥.08)',`h/b=${h/b},h=${h},b=${b},rc=${rc},n=${n},fl/fc=${fl/m.fc}`,`geo=${geo}；eligible=${eligible}`,'','尺寸mm；不符合不計強度提升');
 a('圍束強度最高值','fcc,max=fc+(n且eligible?.95×3.3κa fl:0)',`${m.fc}+${n&&eligible?`.95×3.3×${ka}×${fl}`:'0'}`,fccMax,'MPa');
 a('圍束極限應變','εccu=.002[1.5+12κb fl/fc(εfe/.002)^.45]',`.002×[1.5+12×${kb}×${fl}/${m.fc}×(${ef}/.002)^.45]`,eccu);
 a('應力應變斜率與轉折','E2=(fcc,max-fc)/εccu；Ec=4700√fc；εt=2fc/(Ec-E2)',`E2=(${fccMax}-${m.fc})/${eccu}=${E2}；Ec=${Ec}；εt=${transition}`,transition,'','原引擎值；不額外修改模型');
 a('0.01壓應變上限修正','n且eligible且εccu>.01：εt>.01用拋物線，否則fc+E2×.01；其他採fcc,max',`eligible=${eligible},n=${n},εccu=${eccu}；採用${n&&eligible&&eccu>.01?(.01<transition?'Ec×.01-(Ec-E2)²×.01²/(4fc)':'fc+E2×.01'):'fcc,max'}`,fcc,'MPa',`fcc,max=${fccMax}；未把strainCapped旗標當作所有分支均提升`);
 a('純軸壓容量','Pcap=軸壓係數×φ[.85fcc(Ag-As)+fy As]/TF',`${axial}×${phi}×[.85×${fcc}×(${Ag}-${As})+${m.fy}×${As}]/${TF}`,r.capacity,'tf',`ties=${p.ties}；螺旋筋(.85,.75)，一般箍筋(.80,.65)；不是P-M容量`);
 a('需求與目標強度','u=Pu/Pcap；fcc/K≥target',`${p.Pu}/${r.capacity}；${fcc}/${K} ≥ ${p.target}`,`u=${r.ratio}；fcc=${r.fcc}`,'kgf/cm²','需求比≤1；層數非0須eligible；目標強度須達標');
 a('舊版比對有效應變','εfd,old=min(.41√(target/(n tf Ef)),.9εfu*)',n?`min(.41√(${p.target}/(${n}×${p.tf}×${p.Ef})),.9×${p.efu})`:'n=0取0',legacyEfd,'','僅舊版比對，不參與新判定');a('舊版圍束比對','fl,old=2(t/10)Ef εfd/Dold；θ=min(36+fc/35,45)；fcc,old=fc+kc fl,old tan²(45+θ/2)',`fl,old=${legacyFl}；Dold=${legacyD}；kc=${kc}；θ=${theta}`,legacyFcc,'kgf/cm²','kc圓.95／方.75／矩.5；僅比對，不參與新判定');return t;}
