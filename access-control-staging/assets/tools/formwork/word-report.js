/* Editable DOCX report, generated locally with the bundled docx library. */
(function(root){
const names={plate:'樓板模板',beam:'梁模板',column:'柱模板',wall:'牆模板'};
const num=(x,p=5)=>Number.isFinite(x)?Number(x.toPrecision(10)).toLocaleString('en-US',{maximumFractionDigits:p}):'—';
function blocks(d,F,stamp=new Date().toLocaleString('zh-TW'),snapshotResult){
 const r=snapshotResult||F.calculate(d);if(r.errors.length)throw new Error(r.errors.join('；'));
 if(!Number.isFinite(r.max)||r.rows.some(x=>![x.w,x.M,x.V,x.delta,x.A,x.I,x.Z].every(Number.isFinite)))throw new Error('輸入數值過大，請修正後匯出。');
 const b=[],p=t=>b.push({type:'p',text:t}),h=(t,page=false)=>b.push({type:'h',text:t,page}),table=(headers,rows,widths)=>b.push({type:'table',headers,rows,widths}),N=num;
 b.push({type:'title',text:names[d.mode]+'支撐詳細計算書'});
 p('計算結論：'+(r.pass?'已列檢核項目均通過。':'有檢核項目未通過，詳見各項判定。')+' 最大需求／容許比 = '+N(r.max)+'。');
 p('產生時間：'+stamp+'。本計算書採匯出當下的設計參數；跨距敏感度拉霸屬獨立比較，不納入設計結果。');
 p('計算依據：模板支撐計算(1).zip 內 FormMain.vb，_CALCULATE_ENGINE_GO 與 _DMIN。');
 h('一 設計條件與檢核摘要');
 p('單位：力 kgf；內力 kgf·cm；應力 kgf/cm²；計算跨距 cm。輸入跨距 m，計算時乘 100。面載重 tf/m²；混凝土密度輸入 kg/m³，重力制單位重換算為 kgf/m³。');
 if(d.mode!=='plate')p('混凝土密度 ρ = '+N(d.rho)+' kg/m³；標準重力換算 W0 = ρ × 9.80665 / 1000 = '+N(d.rho*9.80665/1000,7)+' kN/m³；以下重力制 γ = '+N(d.rho)+' kgf/m³。');
 table(['構件','跨距 m','彎曲比','剪力比','撓度比','判定'],r.rows.map(x=>[x.name,N(x.L),...x.ratios.map(v=>N(v,4)),x.ratio<1?'OK':'NG']),[1800,1000,1300,1300,1300,1200]);
 p('彎曲比 = fb/Fb；剪力比 = fv/Fv；撓度比 = δ/δa。判定採未四捨五入數值；一般項目須嚴格小於容許值，等於時為 NG。木柱沿用 P ≤ Pa。表內小數為顯示值。');
 if(r.s)p('支柱：P = '+N(r.s.P)+' kgf；Pa = '+N(r.s.capacity)+' kgf；需求／容許比 = '+N(r.s.ratio)+'；'+(r.s.pass?'OK':'NG')+'。');
 if(r.tie)p('緊結器：T = '+N(r.tie.force)+' kgf；Ta = '+N(r.tie.capacity)+' kgf。'+(d.mode==='beam'?'':'另列 2T = '+N(r.tie.doubleForce)+' kgf，並納入總覽判定。'));
 h('二 載重計算');
 if(d.mode==='plate'||d.mode==='beam'){
  if(d.mode==='plate')p('WD = '+N(d.wd)+' tf/m²（使用者指定靜載重）。');
  else p('γ = '+N(d.rho)+' kgf/m³，梁高 H = '+N(d.H)+' m。\nWD = γH/1000 = '+N(d.rho)+' × '+N(d.H)+' / 1000 = '+N(d.rho*d.H/1000)+' tf/m²。');
  p('WI = '+N(d.wi)+' tf/m²；WL = '+N(d.wl)+' tf/m²。WI 為加算的衝擊載重，非乘數。');
  p('q = WD + WI + WL = '+N(d.mode==='plate'?d.wd:d.rho*d.H/1000)+' + '+N(d.wi)+' + '+N(d.wl)+' = '+N(r.q)+' tf/m²。');
 }
 if(d.mode!=='plate'){
  p('γ = '+N(d.rho)+' kgf/m³；H = '+N(d.H)+' m；靜水壓 γH = '+N(d.rho)+' × '+N(d.H)+' = '+N(d.rho*d.H)+' kgf/m²。');
  if(d.mode==='beam'||d.pressure==='hydro')p('採用側壓 p = γH = '+N(r.p)+' kgf/m²。');
  else if(d.pressure==='manual')p('採用使用者指定側壓 p = '+N(d.manualP)+' kgf/m²。');
  else if(d.pressure==='normal'){
   const wall=d.mode==='wall',second=wall&&d.R>=2.1,cap=wall?9764:14646,t=d.T+17.8,p0=second?732+117710/t+24920*d.R/t:732+80100*d.R/t;
   p('一般混凝土原程式模式；R = '+N(d.R)+' m/hr；T = '+N(d.T)+' °C；T + 17.8 = '+N(t)+'。原介面條件：一次澆灌不大於 1.2 m。');
   p(second?'p₀ = 732 + 117710/(T+17.8) + 24920R/(T+17.8)\n= 732 + 117710/'+N(t)+' + 24920 × '+N(d.R)+'/'+N(t)+' = '+N(p0)+' kgf/m²。':'p₀ = 732 + 80100R/(T+17.8)\n= 732 + 80100 × '+N(d.R)+' / '+N(t)+' = '+N(p0)+' kgf/m²。');
   p('p₁ = min(p₀, '+cap+') = '+N(Math.min(p0,cap))+' kgf/m²。\np₂ = max(p₁, 2929) = '+N(Math.max(Math.min(p0,cap),2929))+' kgf/m²。\np₃ = min(p₂, γH) = '+N(Math.min(Math.max(Math.min(p0,cap),2929),d.rho*d.H))+' kgf/m²。\np = p₃ × γ/2403 = '+N(Math.min(Math.max(Math.min(p0,cap),2929),d.rho*d.H))+' × '+N(d.rho)+' / 2403 = '+N(r.p)+' kgf/m²。');
  }else{
   let expr='H',sub=N(d.H);
   if(d.mode==='column'){
    if(d.R<10&&d.H>=1.5){expr='1.5 + 0.6(H−1.5)';sub='1.5 + 0.6 × ('+N(d.H)+'−1.5)';}
    else if(d.R>=10&&d.R<=20&&d.H>=2){expr='2 + 0.8(H−2)';sub='2 + 0.8 × ('+N(d.H)+'−2)';}
   }else if(d.R<10){if(d.H>=1.5&&d.H<3){expr='1.5 + 0.2(H−1.5)';sub='1.5 + 0.2 × ('+N(d.H)+'−1.5)';}else if(d.H>=3&&d.H<4){expr='1.5';sub='1.5';}}
   else if(d.R<=20){if(d.H>=2&&d.H<3){expr='2 + 0.4(H−2)';sub='2 + 0.4 × ('+N(d.H)+'−2)';}else if(d.H>=3&&d.H<4){expr='2';sub='2';}}
   p('採原程式 SCC／一次澆灌分段式：R = '+N(d.R)+' m/hr，H = '+N(d.H)+' m。\np = γ × ['+expr+'] = '+N(d.rho)+' × ['+sub+'] = '+N(r.p)+' kgf/m²。');
   p('牆 SCC 分段式在 H = 3 m、4 m 等邊界有不連續，本版保留原始公式。');
  }
 }
 const wFormula=(i)=>{
  const m=d.members;
  if(d.mode==='plate')return i===0?'w = 10q = 10 × '+N(r.q):'w = 10qL前層 = 10 × '+N(r.q)+' × '+N(m[i-1].L);
  if(d.mode==='beam')return i===0?'w = p/10000 = '+N(r.p)+'/10000':i===1?'w = pL側模板/100 = '+N(r.p)+' × '+N(m[0].L)+'/100':i===2?'w = q/10 = '+N(r.q)+'/10':'w = 10qL前層 = 10 × '+N(r.q)+' × '+N(m[i-1].L);
  return i===0?'w = p/10000 = '+N(r.p)+'/10000':'w = pL前層/100 = '+N(r.p)+' × '+N(m[i-1].L)+'/100';
 };
 r.rows.forEach((x,i)=>{
  h('三之'+(i+1)+' '+x.name+'詳細計算',true);
  table(['項目','採用數值','單位'],[['斷面輸入',x.shape==='custom'?'自行指定 A I Z':'矩形 b = '+N(x.b)+'，h = '+N(x.h),'cm'],['跨距',N(x.L)+' m = '+N(x.L*100)+' cm','m / cm'],['支承模型',x.sim?'簡支':'連續 原程式係數',''],['彈性係數 E',N(x.E),'kgf/cm²'],['容許彎曲應力 Fb',N(x.Fb),'kgf/cm²'],['容許剪應力 Fv',N(x.Fv),'kgf/cm²']],[2900,3500,1500]);
  p('1 斷面性質');
  if(x.shape==='rect')p('A = bh = '+N(x.b)+' × '+N(x.h)+' = '+N(x.A)+' cm²。\nI = bh³/12 = '+N(x.b)+' × '+N(x.h)+'³ / 12 = '+N(x.I)+' cm⁴。\nZ = bh²/6 = '+N(x.b)+' × '+N(x.h)+'² / 6 = '+N(x.Z)+' cm³。');
  else p('採使用者指定：A = '+N(x.A)+' cm²；I = '+N(x.I)+' cm⁴；Z = '+N(x.Z)+' cm³。');
  p('2 分攤線載重');p(wFormula(i)+' = '+N(x.w)+' kgf/cm。傳遞式中的前層 L 採 m。');
  p('3 內力與變形');
  p('L = '+N(x.L)+' × 100 = '+N(x.L*100)+' cm。\nM = wL²/'+(x.sim?8:10)+' = '+N(x.w)+' × '+N(x.L*100)+'² / '+(x.sim?8:10)+' = '+N(x.M)+' kgf·cm。\nV = wL/2 = '+N(x.w)+' × '+N(x.L*100)+' / 2 = '+N(x.V)+' kgf。');
  p('fb = M/Z = '+N(x.M)+' / '+N(x.Z)+' = '+N(x.fb)+' kgf/cm²。\nfv = 1.5V/A = 1.5 × '+N(x.V)+' / '+N(x.A)+' = '+N(x.fv)+' kgf/cm²。');
  p('δ = '+(x.sim?'5wL⁴/(384EI)':'wL⁴/(128EI)')+'\n= '+(x.sim?'5 × ':'')+N(x.w)+' × '+N(x.L*100)+'⁴ / ('+(x.sim?384:128)+' × '+N(x.E)+' × '+N(x.I)+') = '+N(x.delta,7)+' cm。');
  p('δa = '+(d.def==='both'?'min(0.3, L/240) = min(0.3, '+N(x.L*100)+'/240)':d.def==='absolute'?'0.3':N(x.L*100)+'/240')+' = '+N(x.limit,7)+' cm。');
  p('4 檢核結果');
  table(['檢核','計算值','容許值','需求／容許','判定'],[['彎曲 kgf/cm²',N(x.fb),N(x.Fb),N(x.ratios[0]),x.ratios[0]<1?'OK':'NG'],['剪力 kgf/cm²',N(x.fv),N(x.Fv),N(x.ratios[1]),x.ratios[1]<1?'OK':'NG'],['撓度 cm',N(x.delta,7),N(x.limit,7),N(x.ratios[2]),x.ratios[2]<1?'OK':'NG']],[2300,1500,1500,1500,1100]);
 });
 h('四 支撐與緊結器',true);
 if(r.s){const s=r.s;p('分攤尺寸 X = '+N(d.X)+' cm；Y = '+N(d.Y)+' cm。X = L3 × 100，Y = L2 × 100。\n分攤面積 = XY/10000 = '+N(d.X)+' × '+N(d.Y)+' / 10000 = '+N(d.X*d.Y/10000)+' m²。\nP = qXY/10 = '+N(r.q)+' × '+N(d.X)+' × '+N(d.Y)+' / 10 = '+N(s.P)+' kgf = '+N(s.P/1000)+' tf。');
  if(d.support==='tube'){
   const di=d.D-2*d.t,m=s.lambda/s.Cc;
   p('鋼管支柱採 K = 1；E = 2100000 kgf/cm²；Fy = 2500 kgf/cm²。\nD = '+N(d.D)+' cm；t = '+N(d.t)+' cm；Lb = '+N(d.Lb)+' cm。\ndi = D−2t = '+N(d.D)+'−2 × '+N(d.t)+' = '+N(di)+' cm。');
   p('A = π(D²−di²)/4 = π('+N(d.D)+'²−'+N(di)+'²)/4 = '+N(s.A)+' cm²。\nI = π(D⁴−di⁴)/64 = π('+N(d.D)+'⁴−'+N(di)+'⁴)/64 = '+N(s.I)+' cm⁴。\nr = √(I/A) = √('+N(s.I)+'/'+N(s.A)+') = '+N(s.r)+' cm。');
   p('λ = KLb/r = 1 × '+N(d.Lb)+' / '+N(s.r)+' = '+N(s.lambda)+'。\nCc = √(2π²E/Fy) = √(2π² × 2100000/2500) = '+N(s.Cc)+'。');
   if(s.lambda>s.Cc)p('λ > Cc，採彈性挫屈分支。\nFa = 12π²E/(23λ²) = 12π² × 2100000 / (23 × '+N(s.lambda)+'²) = '+N(s.Fa)+' kgf/cm²。');
   else p('λ ≤ Cc，採非彈性挫屈分支。\nm = λ/Cc = '+N(s.lambda)+'/'+N(s.Cc)+' = '+N(m)+'。\nFa = (1−0.5m²)Fy / (5/3+3m/8−m³/8)\n= (1−0.5 × '+N(m)+'²) × 2500 / (5/3+3 × '+N(m)+'/8−'+N(m)+'³/8)\n= '+N(s.Fa)+' kgf/cm²。');
   p('Pa = FaA = '+N(s.Fa)+' × '+N(s.A)+' = '+N(s.capacity)+' kgf。');
  }else if(d.support==='wood'){
   const small=Math.min(d.sw,d.sh),large=Math.max(d.sw,d.sh),k=s.Fa/d.Fc;
   p('木柱 b = '+N(d.sw)+' cm；h = '+N(d.sh)+' cm；Lb = '+N(d.Lb)+' cm；基準容許壓應力 Fc = '+N(d.Fc)+' kgf/cm²。\nA = bh = '+N(d.sw)+' × '+N(d.sh)+' = '+N(s.A)+' cm²。\nI弱 = '+N(large)+' × '+N(small)+'³/12 = '+N(s.I)+' cm⁴。\nr = √(I弱/A) = √('+N(s.I)+'/'+N(s.A)+') = '+N(s.r)+' cm。\nλ = Lb/r = '+N(d.Lb)+'/'+N(s.r)+' = '+N(s.lambda)+'。');
   p('折減係數 k = '+(s.lambda<=30?'1（λ ≤ 30）':s.lambda<=100?'1.3−0.01λ = 1.3−0.01 × '+N(s.lambda):'3000/λ² = 3000/'+N(s.lambda)+'²')+' = '+N(k)+'。\nFa = kFc = '+N(k)+' × '+N(d.Fc)+' = '+N(s.Fa)+' kgf/cm²。\nPa = FaA = '+N(s.Fa)+' × '+N(s.A)+' = '+N(s.capacity)+' kgf。');
  }else p('指定支架容許容量 Pa = '+N(d.capacity)+' tf × 1000 = '+N(s.capacity)+' kgf。原程式預設 32 tf，需依實際型號與搭設條件確認採用值。');
  p('軸力檢核：P '+(d.support==='wood'?'≤':'<')+' Pa；'+N(s.P)+(s.pass?(d.support==='wood'?' ≤ ':' < '):(d.support==='wood'?' > ':' ≥ '))+N(s.capacity)+' kgf，判定 '+(s.pass?'OK':'NG')+'。\n需求／容許比 = '+N(s.P)+'/'+N(s.capacity)+' = '+N(s.ratio)+'。');
 }
 if(r.tie){const t=r.tie,L=d.members[d.mode==='beam'?0:1].L;p('緊結器間距 S = '+N(d.tieSp)+' m；採用跨距 '+(d.mode==='beam'?'L側模板':'L直材')+' = '+N(L)+' m；每組容許拉力 Ta = '+N(d.tieCapacity)+' kgf。\n分攤面積 At = S × L / 2 = '+N(d.tieSp)+' × '+N(L)+' / 2 = '+N(t.area)+' m²。\nT = pAt = '+N(r.p)+' × '+N(t.area)+' = '+N(t.force)+' kgf。\nT/Ta = '+N(t.force)+' / '+N(t.capacity)+' = '+N(t.ratio)+'；判定 '+(t.ratio<1?'OK':'NG')+'。');if(d.mode!=='beam')p('原報表另列 2T = 2 × '+N(t.force)+' = '+N(t.doubleForce)+' kgf。\n2T/Ta = '+N(t.doubleForce)+' / '+N(t.capacity)+' = '+N(t.doubleRatio)+'；判定 '+(t.doubleRatio<1?'OK':'NG')+'。原碼未註明 2T 的配置適用條件，本版保留並納入總覽。');}
 h('五 計算範圍與採用條件');
 p('本計算書重現附件算法，未另作現行規範符合性校訂。連續梁採原固定係數，非任意跨數、跨比及載重配置的通用解；各斷面剪應力均採 fv = 1.5V/A。');
 p('模板計算條帶寬：樓板 100 cm，梁底及各側模板 1 cm。原計算不另加模板、角材及貫材自重；樓板 WD 由使用者指定。尚未包含支架整體穩定、斜撐、接頭、偏心、基礎與地基承壓檢核。');
 p('原程式的梁板材料初值不一定合格，本版如實列出結果。計算採雙精度，顯示值四捨五入；公式中的 π 採完整精度。');
 h("六 同一次引擎的完整計算紀錄");for(const s of r.trace||[]){h(s.title);p(s.formula);p("數值代入：\n"+s.substitution);p("結果："+s.result+" "+s.unit);if(s.condition)p("条件與判定："+s.condition);if(s.source)p("來源："+s.source);if(s.table)table(s.table.headers,s.table.rows,s.table.headers.map(()=>7900/s.table.headers.length));}h('附錄 現行規範資訊與適用範圍');p('查核日期 2026-10-10。營造安全衛生設施標準於 2026-06-30 修正；第 11-2 條於 2027-07-01 施行。模板支撐設計及施工應核對第 130–136 條。此計算書只包含所列構件與單柱檢核，不證明整體支撐系統符合規範。');p('ACI 官方列示 PRC-347-14(21) 與 PRC-347.2-17(25)；本版僅提供版本與適用範圍對照，未完整實作其設計條文。');p('官方來源：https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=N0060014 ；https://www.concrete.org/topicsinconcrete/topicdetail.aspx?search=aci+347');return b;
}
function documentFromBlocks(blocks,D){
 const {Document,Paragraph,TextRun,Table,TableRow,TableCell,WidthType,HeadingLevel,BorderStyle,AlignmentType}=D;
 const run=(text,bold=false,color='000000')=>new TextRun({text:String(text),bold,font:{ascii:'Noto Sans CJK TC',hAnsi:'Noto Sans CJK TC',eastAsia:'Noto Sans CJK TC'},size:20,color});
 const para=(text,opts={})=>new Paragraph({...opts,children:String(text).split('\n').flatMap((line,i)=>i?[new TextRun({break:1}),run(line)]:[run(line)]),spacing:{after:65,line:270,lineRule:'exact',...opts.spacing}});
 const border={style:BorderStyle.SINGLE,size:4,color:'D9D9D9'};
 const children=blocks.flatMap(b=>{
  if(b.type==='title')return [new Paragraph({text:b.text,style:'Title'})];
  if(b.type==='h')return [new Paragraph({text:b.text,heading:HeadingLevel.HEADING_1,pageBreakBefore:b.page,keepNext:true})];
  if(b.type==='p')return [para(b.text)];if(b.type==='image')return [new Paragraph({children:[new D.ImageRun({type:'png',data:b.data,transformation:{width:560,height:b.height||300}})],spacing:{line:240,lineRule:'auto'},keepNext:true}),para(b.caption||'本次輸入荷載與跨距示意，非施工詳圖。')];
  const widths=b.widths;return [new Table({width:{size:9360,type:WidthType.DXA},columnWidths:widths.map(w=>Math.round(w/7900*9360)),borders:{top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border},rows:[b.headers,...b.rows].map((row,i)=>new TableRow({tableHeader:i===0,cantSplit:true,children:row.map((v,j)=>new TableCell({width:{size:Math.round(widths[j]/7900*9360),type:WidthType.DXA},shading:{fill:i===0?'DCE6EE':'FFFFFF'},verticalAlign:'center',margins:{top:60,bottom:60,left:110,right:110},children:[new Paragraph({children:[run(v,i===0,b.statusColors?(v==='OK'?'177352':v==='NG'?'B53937':'000000'):'000000')],alignment:j===0?AlignmentType.LEFT:AlignmentType.CENTER,keepNext:!!b.keepTogether&&i<b.rows.length,spacing:{after:0,line:270,lineRule:'exact'}})]}))}))}),para('',{spacing:{after:30,line:80,lineRule:'exact'}})];
 });
 return new Document({creator:'模板支撐分析',title:blocks[0].text,description:'設計參數與詳細計算過程',styles:{default:{document:{run:{font:{ascii:'Noto Sans CJK TC',hAnsi:'Noto Sans CJK TC',eastAsia:'Noto Sans CJK TC'},size:20,color:'000000'},paragraph:{spacing:{after:65,line:270,lineRule:'exact'}}}},paragraphStyles:[{id:'Title',name:'Title',basedOn:'Normal',next:'Normal',run:{font:{ascii:'Noto Sans CJK TC',hAnsi:'Noto Sans CJK TC',eastAsia:'Noto Sans CJK TC'},size:34,bold:true,color:'000000'},paragraph:{spacing:{before:0,after:240}}},{id:'Heading1',name:'Heading 1',basedOn:'Normal',next:'Normal',run:{font:{ascii:'Noto Sans CJK TC',hAnsi:'Noto Sans CJK TC',eastAsia:'Noto Sans CJK TC'},size:26,bold:true,color:'000000'},paragraph:{keepNext:true,spacing:{before:200,after:130}}}]},sections:[{properties:{page:{size:{width:12240,height:15840},margin:{top:900,bottom:900,left:1440,right:1440}}},children}]});
}
const api={blocks,documentFromBlocks};root.FormworkWord=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

