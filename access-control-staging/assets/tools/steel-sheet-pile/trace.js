/* Report fields are captured from the actual analyzed case before async export. */
function sheetSnapshot(r){const {vm,...data}=r;return structuredClone({...data,diagramSvg:geometry(r),pressureSvg:plot(r,'P'),momentSvg:plot(r,'M')});}
function sheetReport(r){
 const x=r.x,t=r.trace,steps=[],n=v=>Number(v).toPrecision(12),source='原檔 鋼鈑樁 OK.zip / Form1.vb Button3_Click（約2097–2628行）；本工具明示修正後Rankine模型。現行單層錨側壓：112年基礎構造設計規範8.8.1 https://www.nlma.gov.tw/ch/legislation/regsearch/962';
 const add=(title,formula,substitution,result,unit='',condition='',src=source)=>steps.push({title,formula,substitution,result,unit,condition,source:src});
 const labels={H:'開挖深度H',q:'地表超載q',gamma:'天然砂土單位重γ',gammaSat:'飽和砂土單位重γsat',gammaClay:'黏土單位重γc',phi:'砂土有效摩擦角φ',su:'不排水剪力強度Su',water:'等水位深度h₁',anchor:'錨點深度a',spacing:'地錨水平間距s',angle:'地錨傾角θ',S:'名義斷面模數Sx',eta:'有效斷面折減η',fb:'彎曲容許應力fb',mult:'入土加長倍率α',length:'實際總樁長',fs:'強度安全係數FS',case:'工況',section:'斷面選型',title:'案件名稱',reference:'資料依據／報告編號'};
 const units={H:'m',q:'tf/m²',gamma:'tf/m³',gammaSat:'tf/m³',gammaClay:'tf/m³',phi:'°',su:'tf/m²',water:'m',anchor:'m',spacing:'m',angle:'°',S:'cm³/m',eta:'無因次',fb:'kgf/cm²',mult:'無因次',length:'m',fs:'無因次'};
 const inputs=Object.entries(x).map(([k,value])=>({label:labels[k]||k,value,unit:units[k]||''}));
 const tables=[{title:'原檔斷面來源表',headers:['原表列','型號','寬 mm','深 mm','厚 mm','Sx cm³/m'],rows:SECTIONS.map((s,i)=>[i+1,s.name,s.width,s.depth,s.thickness,s.S]),source:'原檔鋼鈑樁 OK.zip重建，sections.js共35列。',note:'本次採用列及實際輸入另見詳細步驟；不是供應商現行認證值。',caption:'原檔鋼鈑樁 OK.zip重建，sections.js共35列。本次採用列及實際輸入另見詳細步驟；不是供應商現行認證值。'}];
 add('工況與適用條件','依工況選擇懸臂／單層錨、砂／黏／砂覆黏土、乾／等水位',`工況${x.case}：${r.name}；anchored=${r.anchored}；soil=${r.soil}；wet=${r.wet}`,r.name,'','每米牆寬；等水位淨水壓為零，差異水頭不適用');
 add('主動與被動土壓係數',r.soil==='clay'?'Ka=Kp=1':'Ka=tan²(45°−φ/2)；Kp=1/Ka；K=Kp−Ka',r.soil==='clay'?'純黏土總應力 φ=0 分支':`Ka=tan²(45−${x.phi}/2)=${n(r.Ka)}；Kp=1/${n(r.Ka)}=${n(r.Kp)}`,r.Kp-r.Ka,'無因次','完整精度計算；未取整');
 add('有效單位重',r.wet?'γ′=γsat−γw':'γ′=γ',r.wet?`${x.gammaSat}−1.0`:`${x.gamma}`,r.ge,'tf/m³','舊檔採γw=1.0 tf/m³；本次不更改原模型');
 add('開挖面上覆壓力Q',r.soil==='clay'?'Q=q+γcH':'Q=q+γmin(h₁,H)+γ′[H−min(h₁,H)]',r.soil==='clay'?`${x.q}+${x.gammaClay}×${x.H}`:`${x.q}+${x.gamma}×${r.wet?x.water:x.H}+${r.ge}×(${x.H}−${r.wet?x.water:x.H})`,r.Q,'tf/m²');
 if(r.soil!=='sand')add('黏土淨抵抗與正壓起點','B=4Su−Q；z₀=max(0,(2Su−q)/γc)',`B=4×${x.su}−${n(r.Q)}；z₀=max(0,(2×${x.su}−${x.q})/${x.gammaClay})=${n(Math.max(0,(2*x.su-x.q)/x.gammaClay))}`,r.B,'tf/m²','B≤0或正壓合力為零：引擎拒絕計算；混合土上覆採砂土');
 function segmentSteps(segs,prefix,records){let F=0,J=0;segs.forEach(([a,b,p0,p1],i)=>{const {l,k,f,j}=records[i];F+=f;J+=j;add(`${prefix} 第${i+1}段土壓線性式`,'p(z)=p₀+k(z−a)；k=(p₁−p₀)/(b−a)',`a=${n(a)}；b=${n(b)}；p₀=${n(p0)}；p₁=${n(p1)}；k=(${n(p1)}−${n(p0)})/(${n(b)}−${n(a)})`,k,'tf/m³','壓力正向為主動側；負值為淨抵抗側');add(`${prefix} 第${i+1}段力與一階矩`,'F=p₀l+kl²/2；J=aF+p₀l²/2+kl³/3',`l=${n(l)}；F=${n(p0)}×${n(l)}+${n(k)}×${n(l)}²/2=${n(f)} tf/m；J=${n(a)}×${n(f)}+${n(p0)}×${n(l)}²/2+${n(k)}×${n(l)}³/3；累計F=${n(F)}；J=${n(J)}`,j,'tf·m/m','J為對原地面一階矩；分段線性精確積分');});return {F,J};}
 if(r.soil==='clay')add('開挖面以上黏土壓力端點','p起=max(0,q−2Su)；p終=max(0,Q−2Su)',`max(0,${x.q}−2×${x.su})=${n(Math.max(0,x.q-2*x.su))}；max(0,${n(r.Q)}−2×${x.su})`,Math.max(0,r.Q-2*x.su),'tf/m²','起點採張裂深度z₀，若z₀≥H引擎拒絕零正壓合力');
 else{add('原地面砂土主動壓力','p₀=Ka q',`${n(r.Ka)}×${x.q}`,r.Ka*x.q,'tf/m²');if(r.wet)add('水位界面主動壓力','ph₁=Ka(q+γh₁)',`${n(r.Ka)}×(${x.q}+${x.gamma}×${x.water})`,r.Ka*(x.q+x.gamma*x.water),'tf/m²','水位以下γ′計上覆，兩側淨水壓為0');add('開挖面砂土主動壓力','pH=KaQ',`${n(r.Ka)}×${n(r.Q)}`,r.Ka*r.Q,'tf/m²');}
 const top=segmentSteps(t.top.segments,'開挖面以上',t.top.integral.parts);add('開挖面以上合力及合力位置','Pa=ΣF；ȳ=H−ΣJ/Pa',`Pa=${n(t.top.integral.F)}；J=${n(t.top.integral.J)}；${x.H}−${n(t.top.integral.J)}/${n(t.top.integral.F)}`,x.H-t.top.integral.J/t.top.integral.F,'m','懸臂砂土後續加入開挖面以下正壓三角形，Pa/ȳ將更新');
 function rootStep(rt,title){if(rt.error){add(title,'無有效括根解',rt.attempts?.map(a=>`[${a.lo},${a.hi}] f=${a.flo}/${a.fhi}`).join('；')||'',rt.error,'','此分支不得顯示符合');return;}add(title+'括根區間','由start=0；hi=max(1,start+1)，未換號時hi←1.5hi+1',rt.attempts.map(a=>`[${n(a.lo)},${n(a.hi)}]：f(lo)=${n(a.flo)}，f(hi)=${n(a.fhi)}`).join('；'),rt.value,'m','採第一個取得符號變化之正根區間；非宣告所有多項式根已求出');add(title+'中間迭代取樣','m=(lo+hi)/2；計算f(m)並更新換號區間',rt.iterationSamples.map(q=>`第${q.iteration}次：[${n(q.lo)},${n(q.hi)}]；m=${n(q.m)}；f(m)=${n(q.fmid)}；${q.branch}`).join('；'),rt.value,'m','列出實際第1–3與98–100次；中間94次依同一規則執行，未逐列展開');add(title+'二分求根','m=(lo+hi)/2；f(lo)f(m)≤0則hi=m，否則lo=m',`起始[${rt.bracket.map(n).join(', ')}]；100次；最後[${rt.finalBracket.map(n).join(', ')}]；f(root)=${n(rt.residual)}`,rt.value,'m','雙精度100次固定迭代，未取整；需滿足轉向區及反力物理條件');}
 if(t.root.equation==='anchor'){
  const a=x.anchor,h=x.H,net0=t.root.net0,slope=t.root.slope;
  add('單層錨入土平衡方程','f(D)=J上−aPa+pH[(H−a)D+D²/2]+k[(H−a)D²/2+D³/3]=0',`${n(t.top.integral.J)}−${a}×${n(t.top.integral.F)}+(${n(net0)})[(${h}−${a})D+D²/2]+(${n(slope)})[(${h}−${a})D²/2+D³/3]`,0,'tf·m/m',r.soil==='sand'?`pH=KaQ=${n(r.Ka)}×${n(r.Q)}；k=−γ′(Kp−Ka)=${n(slope)}`:`pH=−B=${n(net0)}；k=0`);
 }else if(t.root.equation==='quartic'){
  const g=t.root.gK,rev=t.root.rev,P=r.Pa,y=r.ybar;
  add('懸臂砂土壓力零點','gK=γ′(Kp−Ka)；pH=KaQ；y₀=pH/gK',`${r.ge}×(${n(r.Kp)}−${n(r.Ka)})=${n(g)}；y₀=${n(r.Ka)}×${n(r.Q)}/${n(g)}`,r.y0,'m');
  add('正壓三角形與合力基準','Pa=∫正壓；ȳ=H+y₀−J正/Pa；rev=γ′y₀K+QKp',`Pa=${n(P)}；J正=${n(t.root.positiveIntegral.J)}；ȳ=${x.H}+${n(r.y0)}−${n(t.root.positiveIntegral.J)}/${n(P)}=${n(y)}；rev=${r.ge}×${n(r.y0)}×${n(r.Kp-r.Ka)}+${n(r.Q)}×${n(r.Kp)}`,rev,'tf/m²');
  const formulas=['c₁=rev/gK','c₂=−8Pa/gK','c₃=−6Pa(2ȳgK+rev)/gK²','c₄=−(6Pa·ȳ·rev+4Pa²)/gK²'],subs=[`${n(rev)}/${n(g)}`,`−8×${n(P)}/${n(g)}`,`−6×${n(P)}×(2×${n(y)}×${n(g)}+${n(rev)})/${n(g)}²`,`−(6×${n(P)}×${n(y)}×${n(rev)}+4×${n(P)}²)/${n(g)}²`];
  formulas.forEach((f,i)=>add('四次方程係數 '+(i+1),f,subs[i],r.coeff[i+1],'','各係數配合L次方，方程量綱m⁴'));
  add('砂土懸臂四次方程','L⁴+c₁L³+c₂L²+c₃L+c₄=0',`L⁴+(${n(r.coeff[1])})L³+(${n(r.coeff[2])})L²+(${n(r.coeff[3])})L+(${n(r.coeff[4])})=0`,0,'m⁴');
 }else{
  const B=r.B,C=t.root.C,P=r.Pa,y=r.ybar;
  add('黏土懸臂二次係數A','A=B²/(6C)−B/2；C=2Su',`${n(B)}²/(6×${n(C)})−${n(B)}/2；C=2×${x.su}`,r.coeff[0],'');
  add('黏土懸臂二次係數B₁','B₁=Pa−2PaB/(6C)',`${n(P)}−2×${n(P)}×${n(B)}/(6×${n(C)})`,r.coeff[1],'');
  add('黏土懸臂二次係數C₁','C₁=Pa²/(6C)+Pa·ȳ',`${n(P)}²/(6×${n(C)})+${n(P)}×${n(y)}`,r.coeff[2],'');
  add('黏土懸臂二次方程','AD²+B₁D+C₁=0',`(${n(r.coeff[0])})D²+(${n(r.coeff[1])})D+(${n(r.coeff[2])})=0`,0,'tf·m/m');
 }
 rootStep(t.root,'理論平衡');
 if(t.root.equation==='quartic')add('砂土轉向區與理論入土','D=y₀+L；轉向長度=(gK·L²−2Pa)/(rev+2gK·L)',`D=${n(r.y0)}+${n(t.root.l)}=${n(r.D)}；轉向=(${n(t.root.gK)}×${n(t.root.l)}²−2×${n(r.Pa)})/(${n(t.root.rev)}+2×${n(t.root.gK)}×${n(t.root.l)})`,r.transition,'m',`0<轉向≤L(${n(t.root.l)})才有有效解`);
 else if(!r.anchored)add('黏土轉向區','轉向=(BD−Pa)/(4Su)',`(${n(r.B)}×${n(r.D)}−${n(r.Pa)})/(4×${x.su})`,r.transition,'m',`0<轉向≤D(${n(r.D)})才有有效解`);
 if(r.anchored)add('單層錨入土端點壓力','p底=pH+kD',`${n(t.root.net0)}+(${n(t.root.slope)})×${n(r.D)}`,t.root.net0+t.root.slope*r.D,'tf/m²',r.soil==='sand'?'淨砂土壓線性遞減':'黏土淨抵抗−B為常數');
 else if(r.soil==='sand'){const tp=t.tailParams;add('砂土反向區端點','zt=H+D−轉向；pt=−gK(L−轉向)；pb=rev+gKL',`zt=${x.H}+${n(r.D)}−${n(r.transition)}=${n(tp.zt)}；pt=−${n(tp.gK)}×(${n(tp.l)}−${n(r.transition)})=${n(tp.pt)}；pb=${n(tp.rev)}+${n(tp.gK)}×${n(tp.l)}`,tp.pb,'tf/m²','實際引擎pt/pb；由零點至zt、zt至樁尖分段線性');}
 else add('黏土反向區端點','zt=H+D−轉向；前段−B；反向底壓4Su+Q',`zt=${x.H}+${n(r.D)}−${n(r.transition)}=${n(t.tailParams.zt)}；−B=${n(-r.B)}；底壓=4×${x.su}+${n(r.Q)}`,4*x.su+r.Q,'tf/m²','原檔線性反向區近似');
 const full=segmentSteps(r.segs,'完整牆身',t.end.parts);
 add('土壓端點建立依據','各工況主動側Ka(q+有效土重)；砂土入土淨壓KaQ−γ′(Kp−Ka)d；黏土入土−B；樁尖反向區依平衡方程',`本次${r.soil}／${r.anchored?'地錨':'懸臂'}；分段端點為同引擎segs；${r.segs.map(s=>s.map(n).join(',')).join('；')}`,r.segs.length,'段','黏土主動負壓截為0；樁底反向區採原模型線性近似');
 add('力與矩平衡殘差','ΣF=∫p−Tₕ；ΣM=∫pz−Tₕa',`${n(t.end.F)}−${n(r.Ta)}=${n(r.resF)} tf/m；${n(t.end.J)}−${n(r.Ta)}×${x.anchor}`,r.resM,'tf·m/m','殘差列明，不以顯示取整掩蓋');
 if(r.anchored){add('每米牆水平錨力','Tₕ=∫p dz',`ΣF=${n(t.end.F)}`,r.Ta,'tf/m','Ta≤0停止計算');add('每支地錨水平力與軸力','T水平=Tₕs；T軸=Tₕs/cosθ',`${n(r.Ta)}×${x.spacing}=${n(r.anchorHorizontal)} tf；${n(r.Ta)}×${x.spacing}/cos(${x.angle}×π/180)`,r.anchorAxial,'tf','θ為與水平線夾角；地錨鋼材與拉拔未檢核');}
 add('剪力與彎矩實際積分','V(z)=F(z)−Tₕ；M(z)=zF(z)−J(z)−Tₕ(z−a)',`地錨項僅在z>a或錨點after側作用；引擎逐段精確積分。實際檢查${t.momentCandidates.length}個端點、錨點及V=0候選`,t.momentCandidates.length,'點','V=0在每段30個子區間判別符號變化並二分100次；如實揭露現有搜索方法');
 t.shearRoots.forEach((rt,i)=>add('剪力零點求根 '+(i+1),'V(z)=0；二分100次',`括區[${rt.bracket.map(n).join(',')}]；V起終=${rt.bracketValues.map(n).join('/')}；最終殘差=${n(rt.residual)}`,rt.value,'m'));
 t.momentCandidates.forEach((c,i)=>add('最大彎矩候選 '+(i+1),'比較|M(z)|',`z=${n(c.z)}；F(z)=${n(c.F)}；J(z)=${n(c.J)}；T項=${n(c.anchorTerm)}；V=${n(c.F)}−${n(c.anchorTerm)}=${n(c.V)} tf/m；M=${n(c.z)}×${n(c.F)}−${n(c.J)}−${n(c.anchorTerm)}×(${n(c.z)}−${x.anchor})=${n(c.M)}`,Math.abs(c.M),'tf·m/m',c.z===r.zM?'本次控制候選':'候選'));
 add('控制最大彎矩','|M|max=max候選|M(z)|',`控制z=${n(r.zM)} m`,r.Mmax,'tf·m/m');
 t.shearCandidates.forEach((c,i)=>add('最大剪力候選 '+(i+1),'V極值在段端／p=0／錨點兩側',`z=${n(c.z)}；side=${c.side}；V=${n(c.V)}`,Math.abs(c.V),'tf/m'));
 add('控制最大剪力','|V|max=max候選|V(z)|',`z=${n(t.maxShear.z)} m；V=${n(t.maxShear.V)} tf/m；${t.maxShear.side}`,Math.abs(t.maxShear.V),'tf/m','新增揭露，未新增剪力強度合格判定');
 const idx=SECTIONS.findIndex(s=>s.name===x.section),s=SECTIONS[idx];
 add('斷面來源表及實際採用','按斷面名稱精確選列；S有效=ηSx',s?`sections.js原檔35列：選第${idx+1}列 ${s.name}；欄寬=${s.width}mm、深=${s.depth}mm、厚=${s.thickness}mm、Sx=${s.S}cm³/m；實際輸入Sx=${x.S}；η=${x.eta}`:`自訂斷面；Sx=${x.S} cm³/m；η=${x.eta}`,x.S*x.eta,'cm³/m',s&&s.S!==x.S?'來源列與實際輸入不同，計算依本次輸入，不以表列值冒充':'無插值；原表Ix錯置不採用；須核對供應商');
 add('彎曲應力','σ=|M|max×100000/(ηSx)',`${n(r.Mmax)}×100000/(${x.eta}×${x.S})`,r.sigma,'kgf/cm²','100000由tf→kgf乘1000、m→cm乘100');
 add('名義斷面需求與應力使用率','S需求=M×100000/(fbη)；ratio=σ/fb',`${n(r.Mmax)}×100000/(${x.fb}×${x.eta})=${n(r.Srequired)} cm³/m；${n(r.sigma)}/${x.fb}`,r.ratio,'','應力全精度比較σ≤fb：'+r.stressPass);
 if(r.norm){const rt=t.normRoot;add('規範土壤強度折減','φr=atan(tanφ/FS)；Sur=Su/FS；Kar=tan²(45−φr/2)；Kpr=1/Kar',`atan(tan(${x.phi}×π/180)/${x.fs})×180/π=${n(r.norm.phiReduced)}°；${x.su}/${x.fs}=${n(r.norm.suReduced)}；Kar=${n(t.normKr)}；Kpr=${n(t.normPr)}`,r.norm.phiReduced,'°','FS≥1.2；只計最下層錨點以下力矩，Ms=0');rootStep(rt,'規範折減入土');segmentSteps(t.normSegments,'實際入土規範折減',t.normIntegral.parts);add('折減側壓公式及切段','砂土pr=Kar(Q+γ′d)−Kprγ′d；黏土以cut=max(0,(2Sur−Q)/γc)切段，先−2Sur−γcd，後Q−4Sur',`本次${r.soil}；cut=${n(t.normCut)}m；Sur=${n(r.norm.suReduced)}；Kar=${n(t.normKr)}；Kpr=${n(t.normPr)}；實際入土=${n(r.Dprovided)}m`,r.norm.netMoment,'tf·m/m','計算依引擎既有規範分段，不沿用理論平衡尾段');add('規範折減淨力矩判定','Mr=J折減−aF折減；Mr≤1e−8且FS≥1.2且需求有根',`${n(t.normIntegral.J)}−${x.anchor}×${n(t.normIntegral.F)}=${n(r.norm.netMoment)}；FS=${x.fs}；D規範=${r.norm.Drequired===null?'無有限根':n(r.norm.Drequired)}`,r.norm.pass?'通過':'不符','','全精度容許殘差1e−8；沒有根不判通過');}
 add('加長與最終控制入土','D設計=max(αD理論,D規範)；D提供=總長−H',`αD=${x.mult}×${n(r.D)}=${n(x.mult*r.D)}；D規範=${r.norm?.Drequired==null?'無適用有限值':n(r.norm.Drequired)}；提供=${x.length}−${x.H}=${n(r.Dprovided)}`,r.Ddesign,'m',`未向上取整；提供≥控制需求：${r.depthPass}；規範無根時仍顯示不符`);
 if(r.legacyHlim!=null)add('舊式參考深度上限','Hlim=(4Su−q)/(FSγc)',`(4×${x.su}−${x.q})/(${x.fs}×${x.gammaClay})`,r.legacyHlim,'m','僅原檔參考值，非完整規範判定');
 add('數值顯示規則','運算全精度；畫面常用3位小數；報告12位有效數字',`D=${n(r.D)}；M=${n(r.Mmax)}`,r.D,'m','根100次固定迭代；本次沒有另行取整');
 return {title:'鋼板樁詳細計算報告',summary:`${x.title}；${r.name}。入土${r.depthPass?'通過':'不足'}，應力${r.stressPass?'通過':'超限'}。單項檢核不代表完整開挖設計完成。`,valid:true,inputs,tables,steps,diagram:{svg:r.diagramSvg,width:420,height:420,caption:'本次施工剖面、開挖面、理論及實際樁尖、水位及錨點。灰色為實際長，藍色為理論平衡長；錨線角度對應本次θ。'},conclusions:[`入土：${r.depthPass?'通過':'不足'}；應力：${r.stressPass?'通過':'超限'}。`,...(r.norm?[`112年8.8.1折減側壓：${r.norm.pass?'通過':'不符'}。`]:[]),'差異水頭、張裂充水、多層支撐、地震、液化、變形、隆起、砂湧、上舉、整體滑動、施工階段、地錨拉拔／鋼腱／圍令／接頭尚須另行檢核。']};
}
function renderSheetTrace(r){const report=sheetReport(sheetSnapshot(r));$('calculation').innerHTML+=`<h3>本次詳細運算過程</h3>`+report.steps.map((s,i)=>`<details class="trace-step" ${i===0?'open':''}><summary>${i+1} ${esc(s.title)}</summary><p>${esc(s.formula)}</p><p>${esc(s.substitution)}</p><p>＝${esc(s.result)} ${esc(s.unit)}</p><p>${esc(s.condition)}</p><small>${esc(s.source)}</small></details>`).join('')+report.tables.map(t=>`<details><summary>${esc(t.title)}</summary><p>${esc(t.caption)}</p><div class="table-wrap"><table><tr>${t.headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr>${t.rows.map(row=>'<tr>'+row.map(v=>`<td>${esc(v)}</td>`).join('')+'</tr>').join('')}</table></div></details>`).join('');}

