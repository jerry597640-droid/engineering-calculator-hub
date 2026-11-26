/* Workbench navigation is independent of the calculation engine. */
function refreshWorkbench(){
 const d=states[mode],r=last;
 $('live-status').textContent=names[mode]+' · '+(!r||r.errors.length?'輸入待修正':r.pass?'已列數值通過':'有超限項目')+' · 即時重算';
 const notes=[];
 if(d.members.some(m=>!m.sim))notes.push('連續構件採原係數 M=wL²/10、V=wL/2。AWC 等跨二跨全載的支點彎矩為 wL²/8，支點側剪力為 5wL/8；原係數不能當作任意連續梁解。');
 if(d.members.some(m=>m.shape==='custom'))notes.push('自訂斷面仍採 1.5V/A，僅是矩形剪應力假設；鋼型材或組合斷面須另核對腹板剪力。');
 if(mode==='column'||mode==='wall')notes.push('原一般混凝土側壓含歷史係數及單位重折減順序，尚未確認現行適用條件。可用靜水壓 γH 比較，不能只以數值較小選用。');
 if(d.pressure==='scc'&&mode!=='plate'&&mode!=='beam')notes.push('SCC 原分段式未完成規範適用性確認，牆 H=3m、4m 有跳變。NRMCA 的 SCC 資料指出，無適當試驗資料時，模板應依全液壓設計。');
 if(mode!=='plate')notes.push('緊結器 S 與構件跨距分開輸入；原式含 1/2 分攤，柱牆另驗 2T。實際拉桿數量與分攤面積須依配置圖確認。');
 notes.push('撓度原預設 min(0.3cm,L/240) 不等同 APA 模板建議的 L/270 或 L/360；需依面板種類與外觀要求確認。');
 notes.push('鋼管／木柱沿用原容許應力算法；產品接頭、偏心、斜撐、基礎及支架整體穩定尚未檢核。');
 $('audit-panel').innerHTML=`<div class="audit-head"><span class="eyebrow">VERIFICATION / 2026.10.02</span><h2>驗算結果與適用範圍</h2><p>基本公式與單位換算已比對；原算法的數值回歸通過，不代表現行規範或整體支架安全認證。</p></div><h3>當前模型需確認</h3><ul class="audit-notes">${notes.map(t=>'<li>'+t+'</li>').join('')}</ul><h3>獨立計算基準</h3><div class="table-wrap"><table><thead><tr><th>驗算項目</th><th>基準</th><th>結果</th></tr></thead><tbody><tr><td>簡支均布梁</td><td>w=10 kgf/cm、L=100 cm、EI=70,000,000 kgf·cm²</td><td>M=12,500 kgf·cm；V=500 kgf；δ=0.186012 cm</td></tr><tr><td>矩形斷面</td><td>b=6cm、h=10cm</td><td>A=60cm²；I=500cm⁴；Z=100cm³</td></tr><tr><td>樓板預設</td><td>q=0.84+0.20+0.20=1.24 tf/m²</td><td>單柱 P=1,004.4 kgf；模板 δ=0.123067cm</td></tr><tr><td>靜水壓</td><td>γ=2,400 kgf/m³、H=3m</td><td>p=7,200 kgf/m²</td></tr></tbody></table></div><h3>公開對照資料</h3><ol class="source-links"><li><a href="https://engineering.purdue.edu/~ce474/Docs/DA6-BeamFormulas.pdf" target="_blank" rel="noopener">AWC Beam Design Formulas（Purdue 收藏）</a>：圖 1 簡支梁、圖 29 等跨二跨連續梁。</li><li><a href="https://www.apawood.org/engineered-wood-products/plywood-osb/concrete-plyforms/" target="_blank" rel="noopener">APA Concrete Plyforms</a>：面板彎曲、剪力、撓度與跨數條件。</li><li><a href="https://www.selfconsolidatingconcrete.org/advanced/formwork.html" target="_blank" rel="noopener">NRMCA SCC — Formwork Pressure</a>：SCC 全液壓與試驗資料的適用條件。</li><li><a href="https://www.osha.gov.tw/48110/48417/48419/86764/" target="_blank" rel="noopener">職安署：模板支撐安全設計與施工查驗</a>：設計、施工圖說、繫條與澆置計畫。此頁為 2019 年案例，非完整現行規範。</li></ol><p class="note">已修正極大輸入造成非有限數值時仍顯示檢核的問題；不參與所選側壓計算的 R、T 不再阻擋該模式。原預設 NG 與原公式差異均保留，未為了顯示 OK 調低載重。</p>`;
}
function setWorkspace(view){
 document.body.dataset.view=view;document.body.classList.remove('mobile-inputs');
 document.querySelectorAll('[data-view]').forEach(b=>{if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',b.dataset.view===view?'true':'false')});
 document.querySelectorAll('[data-mobile]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mobile===view?'true':'false'));
 $('toggle-inputs').setAttribute('aria-pressed',document.body.classList.contains('inputs-hidden')?'false':'true');
 $('results-panel').scrollTop=0;
}
document.querySelectorAll('.view-tabs button').forEach(b=>b.onclick=()=>setWorkspace(b.dataset.view));
document.querySelectorAll('[data-mobile]').forEach(b=>b.onclick=()=>{if(b.dataset.mobile==='inputs'){document.body.classList.add('mobile-inputs');document.querySelectorAll('[data-mobile]').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));$('toggle-inputs').setAttribute('aria-pressed','true');}else setWorkspace(b.dataset.mobile)});
$('toggle-inputs').onclick=()=>{if(matchMedia('(max-width: 760px)').matches){document.body.classList.toggle('mobile-inputs');$('toggle-inputs').setAttribute('aria-pressed',document.body.classList.contains('mobile-inputs')?'true':'false');document.querySelectorAll('[data-mobile]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.mobile===(document.body.classList.contains('mobile-inputs')?'inputs':document.body.dataset.view)?'true':'false'));}else{document.body.classList.toggle('inputs-hidden');$('toggle-inputs').setAttribute('aria-pressed',document.body.classList.contains('inputs-hidden')?'false':'true')}};
refreshWorkbench();

