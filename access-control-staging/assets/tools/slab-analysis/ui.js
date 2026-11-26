// Focused workspace navigation and shared reinforcement editing.
(()=>{
 const root=document.getElementById('valid-results'),summary=root.querySelector('.summary'),visual=root.querySelector('.visual-row'),steel=root.querySelector('.reinforcement'),audit=root.querySelector('.audit'),formulas=root.querySelector('.formulas');
 const analysis=document.createElement('div');analysis.id='panel-analysis';analysis.append(visual,steel);summary.after(analysis);
 const panels=[analysis,formulas,audit],labels=['分析檢核','詳細公式','規範核對'];formulas.id='panel-formulas';audit.id='panel-audit';
 const nav=document.createElement('div');nav.className='result-tabs';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','樓板分析檢視');
 const buttons=panels.map((panel,i)=>{panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','tab-'+i);const b=document.createElement('button');b.type='button';b.id='tab-'+i;b.setAttribute('role','tab');b.setAttribute('aria-controls',panel.id);b.innerHTML=labels[i]+(i===2?'<span class="tab-note">需補算</span>':'');nav.append(b);b.addEventListener('click',()=>select(i));return b;});
 function select(i){panels.forEach((p,j)=>{p.hidden=i!==j;buttons[j].setAttribute('aria-selected',String(i===j));buttons[j].tabIndex=i===j?0:-1;});}
 nav.addEventListener('keydown',e=>{const i=buttons.indexOf(document.activeElement);if(i<0)return;let n;if(e.key==='ArrowRight')n=(i+1)%3;else if(e.key==='ArrowLeft')n=(i+2)%3;else if(e.key==='Home')n=0;else if(e.key==='End')n=2;else return;e.preventDefault();select(n);buttons[n].focus();});summary.after(nav);select(0);
 const bulk=document.createElement('div');bulk.className='bulk-spacing';bulk.innerHTML='<label for="bulk-spacing">統一實配間距 <span>cm</span></label><input id="bulk-spacing" type="number" min="0.1" step="0.5" value="20" aria-label="六處統一實配間距，公分"><button id="apply-spacing" type="button">套用六處</button><span id="bulk-message" role="status"></span>';
 steel.querySelector('.table-wrap').before(bulk);document.getElementById('apply-spacing').addEventListener('click',()=>{const n=Number(document.getElementById('bulk-spacing').value),msg=document.getElementById('bulk-message');if(!Number.isFinite(n)||n<=0){msg.textContent='請輸入大於零的間距';return;}for(let i=0;i<6;i++)document.getElementById('spacing'+i).value=n;render();msg.textContent='已套用，仍可逐處修改';});
 document.getElementById('export-top').addEventListener('click',()=>{document.getElementById('export-word').click();const status=document.getElementById('export-status');document.getElementById('top-export-status').textContent=status.textContent;});
 document.getElementById('reset').addEventListener('click',()=>{document.getElementById('bulk-spacing').value=20;document.getElementById('bulk-message').textContent='';document.getElementById('top-export-status').textContent='';});
 const report=document.getElementById('report-meta');document.getElementById('edit-report').addEventListener('click',()=>{setWorkspaceView('report');report.open=true;report.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});document.getElementById('report-project').focus({preventScroll:true});});

 const bottom=document.createElement('nav');bottom.className='mobile-workspace-nav';bottom.setAttribute('aria-label','工作區切換');
 bottom.innerHTML='<button type="button" data-view="parameters" aria-pressed="true">設計參數</button><button type="button" data-view="analysis" aria-pressed="false">分析結果</button><button type="button" data-view="report" aria-pressed="false">計算報告</button>';
 document.body.append(bottom);
 bottom.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>setWorkspaceView(b.dataset.view)));
 const forward=document.createElement('button');forward.type='button';forward.className='mobile-forward';forward.textContent='查看分析結果';forward.addEventListener('click',()=>setWorkspaceView('analysis'));document.querySelector('aside').append(forward);
 const cellLabels=['方向 / 位置','C × 10³','彎矩 |Mu| · tf·m/m','所需 As · cm²/m','原碼建議 · cm','實配間距 · cm','實配 As · cm²/m','檢核結果'];
 document.querySelectorAll('#rows tr').forEach(row=>row.querySelectorAll('td').forEach((td,i)=>td.dataset.label=cellLabels[i]));
 document.querySelectorAll('input[type=number]').forEach(input=>input.setAttribute('inputmode','decimal'));
 setWorkspaceView('parameters',false);
 if(current)updateUX(current);
})();
function updateUX(o){const summary=document.querySelector('.summary');summary.dataset.state=o.pass?'pass':'fail';const n=o.rows.filter(x=>x.active&&!x.pass).length;document.getElementById('summary-text').textContent=o.pass?'板厚、剪力與實配鋼筋通過原碼檢核；規範核對仍有待補算事項。':`${[!o.thicknessPass?'板厚不足':'',!o.shearPass?'剪力未通過':'',n?`${n} 處配筋未通過`:''].filter(Boolean).join(' · ')}。請查看下方紅色項目。`;o.rows.forEach((x,i)=>{const row=document.getElementById('spacing'+i).closest('tr');row.classList.toggle('row-fail',!x.pass);row.classList.toggle('row-inactive',!x.active);});}

function setWorkspaceView(view,scroll=true){
 document.body.dataset.workspaceView=view;
 document.querySelectorAll('.mobile-workspace-nav button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
 const report=document.getElementById('report-meta');
 if(view==='report')report.open=true;
 const forward=document.querySelector('.mobile-forward');if(forward)forward.hidden=view==='report';
 if(scroll&&window.matchMedia('(max-width: 900px)').matches)window.scrollTo({top:0,behavior:'instant'});
}
