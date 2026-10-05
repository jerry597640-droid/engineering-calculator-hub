'use strict';
const $=id=>document.getElementById(id),CATALOG=JSON.parse($('catalog-data').textContent),AUDIT=JSON.parse($('audit-data').textContent),{parseValue,convert}=UnitEngine;
let current=CATALOG.find(d=>d.id==='pressure'),view='work',lastResult=null,toastTimer;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const EXAMPLES=[
 {category:'pressure',value:280,from:'kgf/cm²',to:'MPa',name:'混凝土強度'},
 {category:'force',value:1,from:'tf',to:'kN',name:'噸力轉千牛頓'},
 {category:'moment',value:1,from:'tf·m',to:'kgf·cm',name:'梁彎矩'},
 {category:'weightDensity',value:2.4,from:'tf/m³',to:'kN/m³',name:'混凝土單位重'},
 {category:'angle',value:1,from:'°',to:'″',name:'角度轉角秒'},
 {category:'temperature',value:0,from:'°C',to:'°F',name:'攝氏轉華氏'}
];
function format(n,p=Number($('precision').value)){
 if(!Number.isFinite(n))return '—';if(n===0)return '0';
 const abs=Math.abs(n);if(abs>=1e10||abs<1e-5)return n.toExponential(p-1).replace(/(\.\d*?[1-9])0+e/,'$1e').replace(/\.0+e/,'e');
 return n.toLocaleString('en-US',{maximumSignificantDigits:p,useGrouping:true});
}
function coef(n){return Number(n.toPrecision(15)).toString()}
function notify(t){$('toast').textContent=t;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3200)}
function units(){return {from:current.units.find(u=>u.id===$('from-unit').value),to:current.units.find(u=>u.id===$('to-unit').value)}}
function buildNav(){const q=$('category-search').value.trim().toLowerCase();const groups=[...new Set(CATALOG.map(c=>c.group))];$('category-nav').innerHTML=groups.map(g=>{const list=CATALOG.filter(c=>c.group===g&&(c.name+' '+c.id+' '+c.group).toLowerCase().includes(q));return list.length?`<div class="nav-group">${esc(g)}</div><div class="nav-list">${list.map(c=>`<button data-category="${esc(c.id)}" aria-current="${c.id===current.id}"><span>${esc(c.name)}</span><small>${c.units.length}</small></button>`).join('')}</div>`:''}).join('')||'<p style="padding:10px;font-size:14px">沒有符合的類別。</p>'}
function showView(next,focus=false){view=next;for(const v of ['work','help','audit']){$('view-'+v).hidden=v!==next;$('tab-'+v).setAttribute('aria-selected',String(v===next));$('tab-'+v).tabIndex=v===next?0:-1}if(next==='audit')renderAudit();if(focus)$('tab-'+next).focus();}
function setCategory(id,sample){current=CATALOG.find(c=>c.id===id)||current;const [value,from,to]=sample||current.default;const html=current.units.map(u=>`<option value="${esc(u.id)}">${esc(u.symbol)}</option>`).join('');$('from-unit').innerHTML=html;$('to-unit').innerHTML=html;$('from-unit').value=from;$('to-unit').value=to;$('input-value').value=String(value);$('category-select').value=current.id;$('category-title').textContent=current.name;$('group-label').textContent=current.group;$('base-tag').textContent='SI 基準 '+current.base;$('unit-count').textContent=current.units.length+' 種單位';$('category-note').textContent=current.note;$('data-source').textContent=current.source;$('unit-filter').value='';showView('work');buildNav();render();}
function render(){
 const {from,to}=units();$('input-unit').textContent=from.symbol;$('result-unit').textContent=to.symbol;$('factor-from').textContent=`1 ${from.symbol} 對應係數 ${coef(from.factor)}，偏移 ${coef(from.offset||0)}（基準 ${current.base}）`;$('factor-to').textContent=`1 ${to.symbol} 對應係數 ${coef(to.factor)}，偏移 ${coef(to.offset||0)}（基準 ${current.base}）`;$('definition-note').textContent=from.note+(from.note!==to.note?'；'+to.note:'');
 let x=null,error='';lastResult=null;try{x=parseValue($('input-value').value);lastResult=convert(x,from,to,current.id==='temperature')}catch(e){error=e.message}
 $('input-error').hidden=!error;$('input-error').textContent=error;$('input-value').setAttribute('aria-invalid',String(!!error));$('result-value').textContent=error?'—':format(lastResult);$('result-state').textContent=error?'請確認輸入':'即時更新';$('copy-result').disabled=!!error;$('swap-units').disabled=!!error;$('export-csv').disabled=!!error;
 const temperature=current.id==='temperature';$('formula-description').textContent=temperature?'先把原溫度換成 K，再由 K 換成目標溫度。a 是刻度比例，b 是偏移。':'每個單位先換到本類別的基準單位，再換到目標單位；面積與體積按長度係數的平方、立方推導。';
 const general=temperature?'T(K) = x × a₁ + b₁； y = [T(K) − b₂] ÷ a₂':'y = x × a₁ ÷ a₂';
 const substitution=temperature?`y = [${x===null?'x':coef(x)} × ${coef(from.factor)} + (${coef(from.offset||0)}) − (${coef(to.offset||0)})] ÷ ${coef(to.factor)}`:`y = ${x===null?'x':coef(x)} × ${coef(from.factor)} ÷ ${coef(to.factor)}`;
 $('formula-math').textContent=general+'\n'+substitution+(error?'':' = '+format(lastResult,12));$('result-equation').textContent=error?'輸入有效數值後會顯示代入結果。':`${format(x)} ${from.symbol} = ${format(lastResult)} ${to.symbol}`;
 renderTable(x);
}
function renderTable(x){
 const {from,to}=units(),q=$('unit-filter').value.trim().toLowerCase(),list=current.units.filter(u=>(u.symbol+' '+u.note).toLowerCase().includes(q));
 $('results-body').innerHTML=list.map(u=>{let n='—';if(x!==null)try{n=format(convert(x,from,u,current.id==='temperature'))}catch{}return `<tr class="${u.id===to.id?'selected':''}"><td><button class="cellunit" data-target="${esc(u.id)}" title="設為目標單位：${esc(u.symbol)}">${esc(u.symbol)}</button></td><td class="num">${esc(n)}</td></tr>`}).join('');$('results-empty').hidden=!!list.length;
}
function renderAudit(){const q=$('audit-search').value.trim().toLowerCase(),status=$('audit-status').value;const list=AUDIT.filter(r=>(!status||r.status===status)&&[r.label,r.currentUnit,r.currentCategory,r.reason,`${r.group}-${r.category}-${r.slot}`].join(' ').toLowerCase().includes(q));$('audit-count').textContent=`顯示 ${list.length} / ${AUDIT.length} 個原版欄位；44 欄保留待確認。`; $('audit-body').innerHTML=list.map(r=>`<tr><td><span style="color:var(--muted);font-size:12px">${r.group}-${r.category}-${r.slot}</span><br>${esc(r.label)}</td><td class="audit-num">${esc(coef(r.legacyMultiplier))}</td><td>${r.currentUnit?`${esc(r.currentCategory)}<br><strong>${esc(r.currentUnit)}</strong><br><span class="audit-num">${r.currentMultiplier!==undefined?esc(coef(r.currentMultiplier)):'含偏移公式'}</span>`:'—'}</td><td><span class="audit-status ${r.status==='保留待確認'?'pending':''}">${esc(r.status)}</span><br>${esc(r.reason)}</td></tr>`).join('')}
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}
$('download-offline').onclick=()=>{const html=document.documentElement.cloneNode(true);html.querySelector('#toast').hidden=true;html.querySelector('#input-value').setAttribute('value','280');for(const n of html.querySelectorAll('input[type=search]'))n.removeAttribute('value');download('<!doctype html>\n'+html.outerHTML,'工程單位換算_離線版.html','text/html;charset=utf-8');notify('離線版已下載；用瀏覽器開啟即可計算。')};
$('copy-result').onclick=async()=>{if(lastResult===null)return;const {from,to}=units(),t=`${format(parseValue($('input-value').value))} ${from.symbol} = ${format(lastResult)} ${to.symbol}`;try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(t);else{const area=document.createElement('textarea');area.value=t;area.style.cssText='position:fixed;left:-10000px';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();if(!ok)throw Error('copy');}notify('已複製數值與單位。')}catch{notify('瀏覽器不允許自動複製，請選取結果文字複製。')}};
$('export-csv').onclick=()=>{try{const x=parseValue($('input-value').value),{from}=units();convert(x,from,from,current.id==='temperature');const rows=[['類別','原始數值','原始單位','目標單位','結果（顯示精度）','SI 基準','轉基準係數','偏移'],...current.units.map(u=>{let n;try{n=format(convert(x,from,u,current.id==='temperature'))}catch(e){n=e.message}return [current.name,coef(x),from.symbol,u.symbol,n,current.base,coef(u.factor),coef(u.offset||0)]})];const safe=s=>{const t=String(s);return /^[=+@]/.test(t)?"'"+t:t};download('\ufeff'+rows.map(r=>r.map(s=>'"'+safe(s).replace(/"/g,'""')+'"').join(',')).join('\r\n'),`單位換算_${current.id}.csv`,'text/csv;charset=utf-8');notify('已匯出本類別全部單位。')}catch(e){notify(e.message)}};
$('swap-units').onclick=()=>{if(lastResult===null)return;const a=$('from-unit').value,b=$('to-unit').value;$('input-value').value=String(lastResult);$('from-unit').value=b;$('to-unit').value=a;render()};
$('input-value').addEventListener('input',render);$('from-unit').addEventListener('change',render);$('to-unit').addEventListener('change',render);$('precision').addEventListener('change',render);$('unit-filter').addEventListener('input',render);
$('category-search').addEventListener('input',buildNav);$('category-select').onchange=e=>setCategory(e.target.value);
$('category-nav').onclick=e=>{const b=e.target.closest('[data-category]');if(!b)return;const id=b.dataset.category,top=document.querySelector('.sidebar').scrollTop;setCategory(id);document.querySelector('.sidebar').scrollTop=top;document.querySelector(`[data-category="${id}"]`)?.focus({preventScroll:true})};
$('results-body').onclick=e=>{const b=e.target.closest('[data-target]');if(b){$('to-unit').value=b.dataset.target;render();$('to-unit').focus({preventScroll:true})}};
for(const b of document.querySelectorAll('[data-view]')){b.onclick=()=>showView(b.dataset.view);b.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const views=['work','help','audit'],i=views.indexOf(view);showView(e.key==='Home'?'work':e.key==='End'?'audit':views[(i+(e.key==='ArrowRight'?1:2))%3],true)}}}
$('audit-search').oninput=renderAudit;$('audit-status').onchange=renderAudit;
$('example-buttons').innerHTML=EXAMPLES.map((e,i)=>`<button class="example" data-example="${i}"><strong>${esc(e.name)}</strong><span>${esc(e.value+' '+e.from+' → '+e.to)}</span></button>`).join('');$('example-buttons').onclick=e=>{const b=e.target.closest('[data-example]');if(b){const x=EXAMPLES[Number(b.dataset.example)];setCategory(x.category,[x.value,x.from,x.to]);$('input-value').focus({preventScroll:true});notify('範例已載入，可直接調整數值。')}};
const groups=[...new Set(CATALOG.map(c=>c.group))];$('category-select').innerHTML=groups.map(g=>`<optgroup label="${esc(g)}">${CATALOG.filter(c=>c.group===g).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</optgroup>`).join('');
$('category-sources').innerHTML=CATALOG.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.base)}</td><td>${esc(c.source)}</td></tr>`).join('');
$('manual-examples').innerHTML=CATALOG.map(c=>{const [v,f,t]=c.default,a=c.units.find(u=>u.id===f),b=c.units.find(u=>u.id===t),n=convert(v,a,b,c.id==='temperature');return `<tr><td>${esc(c.name)}</td><td>${esc(v+' '+f)}</td><td>${esc(t)}</td><td>${esc(format(n,10)+' '+t)}</td></tr>`}).join('');
$('catalog-count').textContent=`${CATALOG.length} 類 · ${CATALOG.reduce((n,c)=>n+c.units.length,0)} 個單位`;
setCategory('pressure');if(location.hash==='#help')showView('help');if(location.hash==='#audit')showView('audit');
