import {combinations,runSteelDesign,steelReportBlocks,steelCode,steelSources} from './steel-design.js?v=1.9.0';

const escape=value=>String(value??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let context,computed=null,signature='',running=false,version=0;
const get=id=>document.getElementById(id);
const fingerprint=()=>JSON.stringify(context.getConfig());
export function currentSteelDesign(){return computed&&signature===fingerprint()?computed:null;}
function settings(){
  const config=context.getConfig();
  const stored=config.steelDesign||{};
  return {fullLive:stored.fullLive!==false,selected:Array.isArray(stored.selected)?stored.selected:['S-DL','U-D','U-DL'],spans:Array.isArray(stored.spans)?stored.spans:config.spans.map(()=>({}))};
}
function readSettings(){
  const spans=[...get('steelSpans').children].map(row=>{
    const value=name=>{const field=row.querySelector('[data-param="'+name+'"]');return field.value===''?null:Number(field.value);};
    return {fy:value('fy'),lb:value('lb'),deflection:value('deflection'),
      fabrication:row.querySelector('[data-param="fabrication"]').value,
      loadHeight:row.querySelector('[data-param="loadHeight"]').value};
  });
  return {fullLive:get('steelFullLive').checked,selected:[...get('steelCombinations').querySelectorAll('input:checked')].map(e=>e.value),spans};
}
function save(){
  const c=context.getConfig();c.steelDesign=readSettings();
  [...get('steelLoads').querySelectorAll('select')].forEach((el,i)=>c.loads[i].loadCase=el.value||undefined);
  context.persist();computed=null;version++;get('steelResults').replaceChildren();get('steelStatus').textContent='設定已儲存，請執行組合檢核。';
}
function drawCombinations(config){
  get('steelCombinations').innerHTML=combinations(config.fullLive).map(combo=>'<label class="steel-check"><input type="checkbox" value="'+combo.id+'" '+(config.selected.includes(combo.id)?'checked':'')+'>'+escape(combo.name)+'</label>').join('');
}
function draw(){
  const c=context.getConfig(),prefs=settings();
  get('steelFullLive').checked=prefs.fullLive;drawCombinations(prefs);
  get('steelLoads').innerHTML=c.loads.map((load,i)=>'<label>第 '+(i+1)+' 筆 '+({line:'分布載重',point:'集中力',moment:'集中彎矩'}[load.type])+'<select aria-label="第 '+(i+1)+' 筆載重分類">'+[['','請選擇'],['D','D 恆載'],['L','L 活載'],['W','W 風載'],['E','E 地震']].map(([value,name])=>'<option value="'+value+'" '+(load.loadCase===value?'selected':'')+'>'+name+'</option>').join('')+'</select></label>').join('');
  get('steelSpans').innerHTML=c.spans.map((span,i)=>{
    const s=prefs.spans[i]||{};
    const field=(name,title,unit,min=0)=>'<label>'+title+' <small>'+unit+'</small><input data-param="'+name+'" aria-label="第 '+(i+1)+' 跨 '+title+'" type="number" step="any" min="'+min+'" value="'+escape(s[name])+'"></label>';
    return '<fieldset><legend>第 '+(i+1)+' 跨 · '+escape(span.material?.name||'尚未選鋼材')+'</legend><p>'+escape(span.section?.name||'尚未選擇斷面')+'</p><div class="steel-fields">'+
      field('fy','降伏強度 Fy','MPa',.001)+field('lb','最長有效側撐間距 Lb','m')+field('deflection','使用撓度限值','mm',.001)+
      '<label>製作方式<select data-param="fabrication"><option value="">請選擇</option><option value="rolled" '+(s.fabrication==='rolled'?'selected':'')+'>熱軋</option><option value="welded" '+(s.fabrication==='welded'?'selected':'')+'>銲接</option></select></label>'+
      '<label>載重作用高度<select data-param="loadHeight"><option value="">請選擇</option><option value="centroid" '+(s.loadHeight==='centroid'?'selected':'')+'>形心軸</option><option value="top" '+(s.loadHeight==='top'?'selected':'')+'>上翼板</option></select></label></div></fieldset>';
  }).join('');
  get('steelStatus').textContent='車軸歸類 L，自重歸類 D。請逐筆指定其他載重類別。';
  if(currentSteelDesign())render(computed);else get('steelResults').replaceChildren();
}
function render(result){
  const root=get('steelResults');root.replaceChildren();
  for(const block of steelReportBlocks(result,context.getUnits(),false)){
    if(block.type==='table'){
      const wrap=document.createElement('div');wrap.className='report-data';
      const table=document.createElement('table'),head=table.createTHead().insertRow();
      block.headers.forEach(text=>{const th=document.createElement('th');th.textContent=text;head.append(th);});
      const body=table.createTBody();
      block.rows.forEach(values=>{const row=body.insertRow();values.forEach(value=>{const td=row.insertCell();td.textContent=value;});});
      wrap.append(table);root.append(wrap);
    }else{
      const node=document.createElement(block.type==='h1'?'h3':block.type==='h2'?'h4':'p');node.textContent=block.text;root.append(node);
    }
  }
}
async function run(){
  if(running)return;
  save();const c=structuredClone(context.getConfig()),job=version,start=fingerprint();
  running=true;get('steelRun').disabled=true;get('steelInputs').disabled=true;
  try{
    const result=await runSteelDesign(c,c.steelDesign,(p,name)=>{
      if(job!==version||start!==fingerprint())throw Error('模型已變更，請重新執行檢核。');
      get('steelStatus').textContent='計算 '+name+' · '+Math.round(p*100)+'%';
    });
    if(job!==version||start!==fingerprint())throw Error('模型已變更，請重新執行檢核。');
    computed=result;signature=start;render(result);
    get('steelStatus').textContent='已完成 '+result.cases.length+' 組分析。檢核明細將併入計算報告。';
  }catch(error){computed=null;get('steelStatus').textContent=error.message;}
  finally{running=false;get('steelRun').disabled=false;get('steelInputs').disabled=false;}
}
export function installSteelDesign(options){
  context=options;
  const dialog=document.createElement('dialog');dialog.id='steelDialog';dialog.setAttribute('aria-labelledby','steelTitle');
  dialog.innerHTML='<div class="dialoghead"><h2 id="steelTitle">鋼梁強度與載重組合</h2><button class="iconbtn" id="steelClose" aria-label="關閉鋼梁檢核">×</button></div><div class="dialogbody">'+
    '<p>'+steelCode+'</p><p>自動強度適用強軸、結實 H／I 型鋼，含側向扭轉挫屈與剪力。其他斷面或條件會列出待補驗項目。</p>'+
    '<fieldset id="steelInputs"><h3>載重分類</h3><div class="steel-fields" id="steelLoads"></div>'+
    '<h3>組合選擇</h3><label class="steel-check"><input type="checkbox" id="steelFullLive">車庫、公眾使用場所或活載大於 0.5 tf/m²，風／震組合 L 係數採 1.0</label>'+
    '<div id="steelCombinations" class="steel-fields"></div><p>風及地震輸入為本梁面內等效載重。載重值與適用組合依專案設計依據確認。</p>'+
    '<h3>各跨設計條件</h3><p>Fy 依材質與實際板厚輸入。Lb 採正負彎矩受壓翼板的最長有效間距，連續側撐填 0。撓度限值依所選使用載重組合與專案要求填寫。</p><div id="steelSpans"></div></fieldset>'+
    '<button class="primary" id="steelRun">計算所選組合與檢核</button><p role="status" id="steelStatus"></p><div id="steelResults"></div><p>'+steelSources.map(([name,url])=>'<a href="'+url+'" target="_blank" rel="noopener">'+name+'</a>').join(' · ')+'</p></div>';
  document.body.append(dialog);
  get('steelClose').onclick=()=>dialog.close();get('steelRun').onclick=run;
  get('steelInputs').addEventListener('change',event=>{
    const prefs=readSettings();if(event.target.id==='steelFullLive')drawCombinations(prefs);
    save();
  });
  get('steelBtn').onclick=()=>{context.stop();draw();dialog.showModal();};
}
