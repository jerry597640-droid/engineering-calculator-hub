/* Detailed records use the same calculate() result rendered by the workbench. */
(()=>{
'use strict';
const labels={fyR:'鋼筋降伏強度',fyW:'鋼線網降伏強度',thickness:'構件厚度',rX:'X向鋼筋',rY:'Y向鋼筋',rsX:'X向鋼筋間距',rsY:'Y向鋼筋間距',dX:'X向鋼線徑',dY:'Y向鋼線徑',wsX:'X向鋼網間距',wsY:'Y向鋼網間距',rho:'自訂最小配筋比'};
const units={fyR:'kgf/cm²',fyW:'kgf/cm²',thickness:'cm',rsX:'mm',rsY:'mm',dX:'mm',dY:'mm',wsX:'mm',wsY:'mm'};
let snapshot=null;
function assertCurrent(){try{const live=params();if(!current||Object.keys(live).some(k=>live[k]!==current.p[k]))throw Error('條件已變更，請重新確認當次結果後匯出。');}catch(e){render();throw e;}}
const panel=document.createElement('section');panel.className='panel';panel.id='actual-trace';panel.style.cssText='margin-top:18px;overflow-wrap:anywhere';$('results').append(panel);
function diagram(p){
 let svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 450" role="img" aria-label="當次鋼筋與鋼線網雙向尺寸"><rect width="340" height="450" fill="#f4f7fa"/>';
 for(const [i,title] of ['鋼筋（'+(p.mode==='forward'?'原設計':'擬用')+'）','鋼線網（'+(p.mode==='forward'?'擬用':'原設計')+'）'].entries()){
  const y=20+i*220,mesh=i===1;
  svg+=`<text x="15" y="${y}" font-size="18" fill="#244259">${title}</text><g stroke="#1768ac" stroke-width="3">${[45,75,105].map(v=>`<path d="M50 ${y+v}H280"/>`).join('')}</g><g stroke="#bc781f" stroke-width="3">${[70,120,170,220,270].map(x=>`<path d="M${x} ${y+35}V${y+115}"/>`).join('')}</g><path d="M35 ${y+45}h10m-5 0v30m-5 0h10M70 ${y+122}v10m0-5h50m0-5v10" fill="none" stroke="#244259"/><text x="15" y="${y+153}" font-size="17" fill="#1768ac">X：${mesh?'φ'+p.dX:bars[p.rX][0]} @ ${mesh?p.wsX:p.rsX} mm</text><text x="15" y="${y+180}" font-size="17" fill="#9a5e0d">Y：${mesh?'φ'+p.dY:bars[p.rY][0]} @ ${mesh?p.wsY:p.rsY} mm</text>`;
 }
 return svg+'<text x="15" y="438" font-size="14" fill="#244259">示意非比例；X筋水平、Y筋垂直</text></svg>';
}
function makeReport(p,r){
 const custom=$('specSelect').value!==''?customSpecs[+$('specSelect').value]:null;
 const inputRows=[{label:'換算方向',value:p.mode==='forward'?'鋼筋 → 鋼線網':'鋼線網 → 鋼筋',unit:''},{label:'最小配筋模式',value:p.minMode==='custom'?'自訂配筋比':'原附件公式',unit:''},...inputIds.filter(k=>k!=='rho'||p.minMode==='custom').map(k=>({label:labels[k],value:k==='rX'||k==='rY'?`${bars[p[k]][0]}（bars資料列${p[k]+1}；面積${bars[p[k]][1]} cm²）`:p[k],unit:units[k]||''}))];
 if(custom)inputRows.push({label:'自訂鋼網尺寸庫當次選項',value:custom.name,unit:''},{label:'網片寬度（只作規格記錄）',value:custom.width??'未填',unit:'m'},{label:'網片長度（只作規格記錄）',value:custom.length??'未填',unit:'m'});
 const branches={custom:`ρ = 自訂 ${p.rho}`,wire:`ρ = max(0.0018 × 4200 ÷ fyW, 0.0014) = max(0.0018 × 4200 ÷ ${p.fyW}, 0.0014)`, 'rebar-low':`fyR=${p.fyR}<4200 → ρ=0.002`,'rebar-equal':`fyR=${p.fyR}=4200 → ρ=0.0018`,'rebar-high':`fyR=${p.fyR}>4200 → ρ=max(0.0018 × 4200 ÷ ${p.fyR},0.0014)`};
 const steps=[{title:'最小配筋比實際分支',formula:branches[r.trace.rhoBranch],result:r.rho,condition:p.minMode==='custom'?'自訂最小比允許0；等值需求仍保留。':'沿用附件公式；0.0014為適用分支下限，非完整現行規範檢核。',source:'原VB附件轉製：本工具calculate函數rho分支。'},{title:'每方向最小鋼量與單位',formula:'As,min = (ρ × 100) × h',substitution:`(${r.rho} × 100) × ${p.thickness}；ρ×100=${r.trace.minLeft}`,result:r.min,unit:'cm²/m',condition:'每公尺寬=100 cm；厚度h使用cm。兩方向各採本最小量。'}];
 for(const a of r.axes){const k=a.k,t=a.trace,bar=bars[p['r'+k]],d=p['d'+k];steps.push(
  {title:k+'向名義鋼筋面積查表',formula:`bars[${p['r'+k]}][1]`,substitution:`列${p['r'+k]+1}（${bar[0]}），欄2「名義面積」`,result:t.ar,unit:'cm²',source:'提供VB程式名義鋼筋面積表；不以號數當直徑重算。'},
  {title:k+'向鋼線面積與mm轉cm',formula:'Aw = Math.PI × (d / 20)²',substitution:`π=${Math.PI}；(${d} mm ÷ 10) ÷ 2=${t.wireRadiusCm} cm；半徑平方=${t.wireRadiusSquared} cm²`,result:t.aw,unit:'cm²',condition:'使用Math.PI；無中間取整。'},
  {title:k+'向原設計每公尺鋼量',formula:'As,原 = (單支面積 × 1000) ÷ 原間距',substitution:`(${a.fromArea} × 1000) ÷ ${a.fromSpacing}；分子=${t.sourceNumerator}`,result:a.source,unit:'cm²/m',condition:'每公尺1000 mm，間距使用mm。'},
  {title:k+'向等值強度需求',formula:'As,eq = (As,原 × fy原) ÷ fy目標',substitution:`(${a.source} × ${r.fySource}) ÷ ${r.fyTarget}；中間乘積=${t.force}`,result:a.equivalent,unit:'cm²/m',condition:'As原×fy原=As目標×fy目標；此為等值原理，不完成構件設計。'},
  {title:k+'向需求最小值控制',formula:'As,req = max(As,eq, As,min)',substitution:`max(${a.equivalent}, ${r.min})`,result:a.required,unit:'cm²/m',condition:a.control+'控制；相等時原程式標示等值鋼量。'},
  {title:k+'向理論最大間距',formula:'smax = (目標單支面積 × 1000) ÷ As,req',substitution:`(${a.toArea} × 1000) ÷ ${a.required}；分子=${t.targetNumerator}`,result:a.maxSpacing,unit:'mm',condition:'不作Integer隱式取整；這是等值／最小鋼量上限，不是規範最大間距。'},
  {title:k+'向目前提供量',formula:'As,提供 = (目標單支面積 × 1000) ÷ 目標間距',substitution:`(${a.toArea} × 1000) ÷ ${a.toSpacing}；分子=${t.targetNumerator}`,result:a.provided,unit:'cm²/m'},
  {title:k+'向供需比與實際判定',formula:'供需比 = As,提供 ÷ As,req；As,提供 ≥ As,req',substitution:`${a.provided} ÷ ${a.required} = ${a.ratio}；${a.provided} ${a.ok?'≥':'<'} ${a.required}`,result:a.ok?'滿足換算條件':'不足，須調整',condition:'判定使用未四捨五入值；供需圖僅視覺上限100%，不裁切實際比例。'}
 );}
 const range=allowedPairs(p);steps.push({title:'候選間距與範圍',formula:'X/Y提供量各≥需求，依(ax+ay)升冪排序',result:p.mode==='forward'?`符合 ${choices.length} 組；當次允許間距表 ${range.map(x=>x.join('×')).join('、')} mm。${choices.length?'首選'+choices[0].x+'×'+choices[0].y+' mm；AsX='+choices[0].ax+'、AsY='+choices[0].ay+' cm²/m。':''}`:'反向模式不提供鋼網候選。',condition:'同線徑≤3.2用前17組；≤8全22組；≤12去首組；>12由第8組起；不同線徑／自訂線徑用原22組參考。不保證供貨。',source:'原22組pairs表、diameters標準線徑清單與allowedPairs/candidates實際函數。'},
 {title:'取整、輸入邊界與結果範圍',result:'本次中間值、間距上限、供需判定皆未取整。畫面小數格式不改計算；完整Number值列於本紀錄。',condition:inputIds.filter(k=>k!=='rho'||p.minMode==='custom').map(k=>{const e=$(k);return `${labels[k]}：${e.tagName==='SELECT'?'從名義面積表選取':`最小 ${e.min||'未設定'}、上限 ${e.max||'未設定'} ${units[k]||''}`}`;}).join('；')+'。欄位HTML驗證及有限數值檢核通過；未額外套法規間距上限、取整或材料係數。'});
 return {title:'鋼筋與鋼線網互換詳細計算報告',summary:p.mode==='forward'?'鋼筋 → 鋼線網':'鋼線網 → 鋼筋',inputs:inputRows,steps,conclusions:[`X向：${r.axes[0].ok?'滿足':'不足'}；Y向：${r.axes[1].ok?'滿足':'不足'}；整體${r.ok?'兩向滿足換算條件':'尚未滿足換算條件'}。`,'本報告不是構件或規範合格證明。上下層須分開計算；強度、裂縫、耐震、錨定、搭接、保護層與供貨須另核。','網片寬長只作規格記錄，不計算搭接、採購數量。'],diagram:{svg:diagram(p),width:340,height:450,caption:'本次鋼筋／鋼線網雙向線徑與間距。示意非比例；不代表施工配置合格。'}};
}
const renderOriginal=render;render=function(){renderOriginal();snapshot=null;panel.innerHTML='';if(!current)return;const {p,r}=current;snapshot=JSON.parse(JSON.stringify(makeReport(p,r)));panel.innerHTML=`<h2>本次完整計算記錄</h2><details open><summary>輸入、單位、實際公式與代入</summary>${snapshot.inputs.map(i=>`<p>${esc(i.label)}：${esc(i.value)} ${esc(i.unit)}</p>`).join('')}${snapshot.steps.map((s,i)=>`<div class="formula"><b>${i+1}. ${esc(s.title)}</b>${['formula','substitution','result','condition','source'].filter(k=>s[k]!=null&&s[k]!=='').map(k=>`<p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(s[k])}${k==='result'&&s.unit?' '+esc(s.unit):''}</p>`).join('')}</div>`).join('')}</details><div style="max-width:400px;margin-top:16px">${snapshot.diagram.svg}</div><button id="exportDocx" type="button">匯出本次詳細 Word</button><p id="docxStatus" role="status"></p>`;$('exportDocx').onclick=async()=>{const status=$('docxStatus');try{assertCurrent();if(!snapshot||!current)throw Error('輸入無效，請先修正。');const report=JSON.parse(JSON.stringify(snapshot));status.textContent='製作當次報告中…';await CalculationDocx.download(report,'鋼筋鋼網互換_詳細計算.docx');if(status.isConnected)status.textContent='已下載可編輯 Word。';}catch(e){if(status.isConnected)status.textContent=e.message;else toast(e.message);}};};render();
})();
