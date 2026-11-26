function traceHTML(r){return '<section class="trace-heading"><h3>完整實際計算步驟</h3><p>中間值保留 JavaScript 實際數值；畫面摘要另採顯示小數位，未更動引擎取整。</p>'+r.trace.map((s,i)=>`<article class="trace-step"><h4>${i+1}. ${esc(s.title)}</h4><p>公式：${esc(s.formula)}</p><p>代入：${esc(s.substitution)}</p><p>結果：${esc(s.result)} ${esc(s.unit)}</p>${s.condition?`<p>條件：${esc(s.condition)}</p>`:''}<p>來源：${esc(s.source)}</p></article>`).join('')+'</section>'}
function makeWordReport(p,r){
 if(r.errors.length||r.inputSnapshot!==JSON.stringify(p))throw Error('計算結果已過期，請重新計算');
 const active=Object.keys(p).filter(k=>!document.querySelector('[data-field="'+k+'"]')?.hidden);
 const svg=$('diagram').cloneNode(true);svg.setAttribute('style','font-family:Microsoft JhengHei,sans-serif;font-size:13px');
 const report={title:'地錨詳細計算報告',summary:`${p.project}；設計軸力 ${r.T} tf；容許軸力 ${r.axialCapacity} tf；控制 ${r.controlling}；${r.pass?'表列檢核通過':'表列檢核有未通過項目'}。`,inputs:active.map(k=>({label:FIELD_META[k]?.label||k,value:p[k],unit:FIELD_META[k]?.unit||''})),steps:JSON.parse(JSON.stringify(r.trace)),conclusions:[`容許軸力 ${r.axialCapacity} tf；容許水平力 ${r.horizontalCapacity} tf；利用率 ${r.utilization}；控制 ${r.controlling}。`,`表列檢核：${r.pass?'全部通過':'有未通過項目，請檢查設計'}。`,'本報告未包括整體穩定、群錨、錨頭承壓、防蝕、潛變及現地試驗結果。',...r.warnings],diagram:{svg:new XMLSerializer().serializeToString(svg),width:560,height:560*350/620,caption:`本次剖面示意 θ=${p.theta}°；自由段 Lf=${p.Lf} cm；錨碇段 La=${p.La} cm；交點 s0=${r.slip} cm。自由段藍色、錨碇段黃色、破壞面紅色；角度與線段長度按本次輸入繪製。`}};
 return report;
}
