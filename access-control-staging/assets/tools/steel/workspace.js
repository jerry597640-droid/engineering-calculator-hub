'use strict';
(()=>{
 const names={input:'構材參數',overview:'分析總覽',calculation:'詳細計算',report:'計算報告',reference:'操作說明與規範'};
 const mobile=()=>window.matchMedia('(max-width: 900px)').matches;
 function go(view){
  if(!names[view])return;
  if(view==='input'&&!mobile()){[...document.querySelectorAll('#inputs input')].find(el=>el.getClientRects().length)?.focus();return;}
  document.body.dataset.workspace=view;
  document.getElementById('view-title').textContent=names[view];
  document.querySelectorAll('.app-nav [data-go]').forEach(b=>{if(b.dataset.go===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  window.scrollTo({top:0,behavior:'instant'});
 }
 document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
 const tabs=[...document.querySelectorAll('[data-input-tab]')];
 function inputTab(name,focus=false){document.body.dataset.inputActive=name;tabs.forEach(b=>{const active=b.dataset.inputTab===name;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;if(active&&focus)b.focus();});}
 tabs.forEach((b,i)=>{b.addEventListener('click',()=>inputTab(b.dataset.inputTab));b.addEventListener('keydown',e=>{let index=e.key==='ArrowRight'?(i+1)%tabs.length:e.key==='ArrowLeft'?(i+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:null;if(index!==null){e.preventDefault();inputTab(tabs[index].dataset.inputTab,true);}});});
 inputTab('section');
 const error=document.getElementById('error');const syncError=()=>{document.body.classList.toggle('invalid-input',!error.hidden);const inline=document.getElementById('input-error');inline.hidden=error.hidden;inline.textContent=error.textContent;};
 new MutationObserver(syncError).observe(error,{attributes:true,attributeFilter:['hidden'],childList:true,subtree:true});syncError();
 window.matchMedia('(max-width: 900px)').addEventListener('change',()=>{if(!mobile()&&document.body.dataset.workspace==='input')go('overview');});
 // A result row retains its meaning when rendered as a stacked mobile record.
 const checks=document.getElementById('checks');const labelRows=()=>{for(const row of checks.rows)[...row.cells].forEach((cell,i)=>cell.dataset.label=['檢核項目','計算值','容許值','比值','結果'][i]);};
 new MutationObserver(labelRows).observe(checks,{childList:true});labelRows();
 document.querySelectorAll('input[type="number"]').forEach(el=>el.setAttribute('inputmode','decimal'));
})();

