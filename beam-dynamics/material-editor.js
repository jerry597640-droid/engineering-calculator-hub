import {materialCatalog} from './material-catalog.js';

const storeKey = 'beamlab-materials-v1';
const positive = n => Number.isFinite(n) && n > 0;
const rounded = n => Number.isFinite(n) ? String(Number(n.toPrecision(12))) : '';
const localKinds = new Map([['steel','steel'],['鋼材','steel'],['鋼','steel'],['wood','wood'],['timber','wood'],['木構材','wood'],['木材','wood'],['木','wood']]);
const get = id => document.getElementById(id);
const normalize = s => String(s ?? '').normalize('NFKC').trim();
function customId(kind,name) {
  let hash=2166136261;
  for(const c of kind+'|'+normalize(name).toLowerCase())hash=Math.imul(hash^c.codePointAt(0),16777619);
  return 'U_'+(hash>>>0).toString(36).toUpperCase();
}
function httpsUrl(input){
  if(!input)return '';
  try {const u=new URL(input);return u.protocol==='https:'&&!(u.username||u.password)?u.href:'';}catch{return '';}
}
function shortText(value,max,label){
  const s=normalize(value);
  if(s.length>max||/[\u0000-\u001f\u007f]/.test(s))throw Error(label+'過長或含有控制字元。');
  return s;
}
function normalizeRecord(raw) {
  if(!raw || typeof raw!=='object' || Array.isArray(raw))throw Error('材質資料格式錯誤。');
  const name=shortText(raw.name,85,'材質名稱');
  const kind=localKinds.get(normalize(raw.kind).toLowerCase());
  if(!name||!kind)throw Error('請填入材質名稱，類別使用 steel（鋼材）或 wood（木構材）。');
  const numeric=value=>typeof value==='number'||typeof value==='string'&&value.trim()!==''?Number(value):NaN;
  const E=numeric(raw.E),density=numeric(raw.density);
  if(!positive(E)||!positive(density))throw Error('彈性模數 E（GPa）與密度（kg/m³）須為正數。');
  let id=normalize(raw.id);
  if(id && !/^[a-z0-9][a-z0-9_/.-]{0,39}$/i.test(id))throw Error('代碼請使用 1 至 40 個英文、數字、底線、斜線、連字號或小數點。');
  if(!id)id=customId(kind,name);
  const source=httpsUrl(normalize(raw.source));
  if(raw.source&&!source)throw Error('來源網址請填寫有效的 https 網址。');
  const record={id,name,kind,E,density,standard:shortText(raw.standard,150,'規格'),notes:shortText(raw.notes,600,'備註'),source,densityAssumed:['true','yes','是','1'].includes(String(raw.densityAssumed).toLowerCase())};
  // Preserve the separate provenance of grade, stiffness and density when supplied by a catalog.
  for(const field of ['densitySource','gradeSource','modulusSource'])if(raw[field]&&httpsUrl(raw[field]))record[field]=httpsUrl(raw[field]);
  return record;
}
function parseCsv(text){
  const rows=[];let row=[],value='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(quoted){
      if(c==='"'&&text[i+1]==='"'){value+='"';i++;}
      else if(c==='"'){quoted=false;closed=true;}
      else value+=c;
    } else if(c==='"'&&!value.length&&!closed)quoted=true;
    else if(c===','){row.push(value);value='';closed=false;}
    else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(value);if(row.some(v=>v.trim()))rows.push(row);row=[];value='';closed=false;}
    else if(c==='"'||(closed&&c.trim()))throw Error('CSV 引號格式錯誤。');
    else value+=c;
  }
  if(quoted)throw Error('CSV 缺少結尾引號。');
  row.push(value);if(row.some(v=>v.trim()))rows.push(row);
  return rows;
}
const aliases={
  id:['id','代碼','材質代碼'], name:['name','名稱','材質名稱','牌號'],
  kind:['kind','type','類別','種類','材質類別'], E:['e','e_gpa','egpa','彈性模數','彈性模數(gpa)','彈性模數e(gpa)'],
  density:['density','density_kg_m3','density_kg_m^3','密度','密度(kg/m3)','密度(kg/m^3)'],
  standard:['standard','規格','標準'], notes:['notes','note','備註'], source:['source','url','來源網址'],
  densityAssumed:['densityassumed','估計密度'],densitySource:['densitysource','密度來源'],modulusSource:['modulussource','彈性模數來源'],gradeSource:['gradesource','牌號來源']
};
function keyOf(header){
  const key=normalize(header).replace(/\s/g,'').toLowerCase();
  return Object.keys(aliases).find(k=>aliases[k].includes(key));
}
export function parseMaterialLibrary(text,isJson=false){
  const clean=String(text).replace(/^\uFEFF/,'').trim();let raw;
  if(isJson||clean.startsWith('{')||clean.startsWith('[')){
    let obj;try{obj=JSON.parse(clean);}catch{throw Error('JSON 格式錯誤，請使用材質陣列或 materials 陣列。');}
    raw=Array.isArray(obj)?obj:obj?.materials;
    if(!Array.isArray(raw))throw Error('JSON 需提供材質陣列或 materials 陣列。');
  }else{
    const rows=parseCsv(clean);if(!rows.length)throw Error('CSV 沒有資料。');
    const headers=rows.shift().map(keyOf);
    if(new Set(headers.filter(Boolean)).size!==headers.filter(Boolean).length)throw Error('CSV 欄名重複。');
    if(!['name','kind','E','density'].every(k=>headers.includes(k)))throw Error('CSV 缺少材質名稱、類別、E_GPa 或 density_kg_m3 欄。');
    raw=rows.map((r,i)=>{if(r.length!==headers.length)throw Error('CSV 第 '+(i+2)+' 列欄位數不符。');return Object.fromEntries(headers.flatMap((h,j)=>h?[[h,r[j]]]:[]));});
  }
  if(!raw.length||raw.length>500)throw Error('材質庫須含 1 至 500 筆材料。');
  const result=new Map();
  raw.forEach((row,i)=>{
    try{
      const item=normalizeRecord(row);
      if(materialCatalog.some(m=>m.id.toLowerCase()===item.id.toLowerCase()))item.id='MY_'+item.id;
      const key=item.id.toLowerCase();if(result.has(key))throw Error('檔案內的材質代碼重複。');
      result.set(key,item);
    }catch(e){throw Error('第 '+(i+1)+' 筆材質：'+e.message);}
  });
  return Array.from(result.values());
}
export function assertSpanMaterial(span) {
  if(span.A!=null&&!positive(span.A))throw Error('跨斷面積須為有限正數。');
  if(span.material==null)return;
  const m=normalizeRecord(span.material);
  const near=(a,b)=>positive(a)&&positive(b)&&Math.abs(a-b)<=1e-8*Math.max(a,b);
  if((typeof span.material.E!=='number'||typeof span.material.density!=='number')||!positive(span.A)||!near(m.E,span.E)||!near(m.density*span.A,span.mass))throw Error('跨材質的 E、面積或單位長度質量不一致。');
}
export function reconcileManualSpanEdit(span,key) {
  if(!span)return;
  if(key==='I'&&span.areaEstimated===true&&positive(span.I)){
    span.A=Math.sqrt(12*span.I);
    if(span.material)span.mass=span.A*span.material.density;
    return;
  }
  if(!span.material||!['mass','E'].includes(key))return;
  const old=span.material;
  if((key==='E'&&span.E===old.E)||(key==='mass'&&span.mass===old.density*span.A))return;
  if(!positive(span.E)||!positive(span.mass)||!positive(span.A)){
    delete span.material;return;
  }
  const name=old.name.endsWith('（自訂）')?old.name:old.name+'（自訂）';
  span.material={id:customId(old.kind,name),kind:old.kind,name,E:span.E,density:span.mass/span.A,standard:'',notes:'以手動輸入的跨資料更新。',source:'',densityAssumed:key==='mass'?false:old.densityAssumed===true};
}
let context,library=[],activeIndex=-1,chosen=null,baseArea=NaN,areaIsEstimated=false;
function readStored(){
  try{
    const data=JSON.parse(localStorage.getItem(storeKey)||'[]');
    return Array.isArray(data)&&data.length?parseMaterialLibrary(JSON.stringify(data),true):[];
  }catch{return [];}
}
function saveLibrary(items){
  const map=new Map(library.map(m=>[m.id.toLowerCase(),m]));
  for(const item of items)map.set(item.id.toLowerCase(),item);
  if(map.size>500)throw Error('此瀏覽器最多可儲存 500 筆自訂材質。');
  const next=[...map.values()];localStorage.setItem(storeKey,JSON.stringify(next));library=next;
}
function findRecord(key){return materialCatalog.find(m=>m.id===key)||library.find(m=>m.id===key);}
function optionList(current){
  const select=get('beamMaterialChoice');select.replaceChildren(new Option('自訂材質',''));
  for(const [title,items] of [['台灣常用鋼材',materialCatalog.filter(m=>m.kind==='steel')],['木構材',materialCatalog.filter(m=>m.kind==='wood')],['我的材質庫',library]]){
    if(!items.length)continue;
    const group=document.createElement('optgroup');group.label=title;
    items.forEach(m=>group.append(new Option(m.name,m.id)));select.append(group);
  }
  const linked=current&&findRecord(current.id);
  select.value=linked&&linked.name===current.name&&linked.E===current.E&&linked.density===current.density?current.id:'';
}
function selectionSources(m){
  const note=get('beamMaterialBasis');note.replaceChildren();
  if(m?.standard||m?.notes||m?.densityAssumed){
    const p=document.createElement('p');p.textContent=[m.standard,m.notes,m.densityAssumed?'預設密度為估計值，可依實際含水率或供應商資料修改。':''].filter(Boolean).join('　');note.append(p);
  }
  const urls=new Set();
  for(const [key,label] of [['source','材質資料來源'],['gradeSource','牌號來源'],['modulusSource','彈性模數來源'],['densitySource','密度來源']]){
    const url=httpsUrl(m?.[key]);if(!url||urls.has(url))continue;urls.add(url);
    const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=label;note.append(a);
  }
}
function setValues(m){
  chosen=m;
  get('beamMaterialName').value=m?.name||'';
  get('beamMaterialKind').value=m?.kind||'steel';
  get('beamMaterialE').value=rounded(context.getUnits().show('GPa',m?.E??context.getConfig().spans[activeIndex].E));
  get('beamMaterialDensity').value=rounded(m?.density??context.getConfig().spans[activeIndex].mass/baseArea);
  selectionSources(m);refreshResult();
}
function areaScale(){return context.getUnits().show('m',1)**2;}
function refreshResult(){
  const u=context.getUnits(),area=Number(get('beamMaterialArea').value)/areaScale(),rho=Number(get('beamMaterialDensity').value),mass=area*rho;
  get('beamMaterialMass').textContent=positive(mass)?'單位長度質量 ρA = '+rounded(u.show('kg/m',mass))+' '+u.label('kg/m'):'請輸入正的密度與斷面積。';
}
export function openMaterial(i){
  const s=context.getConfig().spans[i];if(!s)return;
  activeIndex=i;const u=context.getUnits();
  baseArea=positive(s.A)?s.A:(positive(s.I)?Math.sqrt(12*s.I):NaN);
  areaIsEstimated=positive(s.A)?s.areaEstimated===true:positive(baseArea);
  get('beamMaterialTitle').textContent='第 '+(i+1)+' 跨梁材質';
  get('beamMaterialEUnit').textContent=u.label('GPa');
  get('beamMaterialAreaUnit').textContent=u.label('m')+'²';
  get('beamMaterialArea').value=rounded(baseArea*areaScale());
  get('beamMaterialArea').readOnly=Boolean(s.section);
  get('beamMaterialAreaHint').textContent=s.section?'面積由已連結斷面提供；請至「梁斷面」修改。':areaIsEstimated?'初值依 I 推估為等效實心正方形面積，請核對並輸入實際斷面積。':'請使用實際斷面積，慣性矩 I 另外在跨資料設定。';
  get('beamMaterialMessage').textContent='';get('beamMaterialImportSection').open=false;
  get('beamMaterialClear').hidden=!s.material;
  optionList(s.material);setValues(s.material);get('beamMaterialDialog').showModal();
}
function commit(){
  const span=context.getConfig().spans[activeIndex],u=context.getUnits();
  if(!span)return;
  const form=get('beamMaterialForm');if(!form.reportValidity())return;
  try{
    const name=shortText(get('beamMaterialName').value,85,'材質名稱'),kind=get('beamMaterialKind').value,E=u.base('GPa',get('beamMaterialE').valueAsNumber),density=get('beamMaterialDensity').valueAsNumber,A=span.section?span.A:get('beamMaterialArea').valueAsNumber/areaScale();
    if(!name||![E,density,A,A*density].every(positive))throw Error('請填寫材質名稱、正的彈性模數、密度及斷面積。');
    const approx=(a,b)=>Math.abs(a-b)<=1e-10*Math.max(Math.abs(a),Math.abs(b));
    const same=chosen&&name===chosen.name&&kind===chosen.kind&&approx(E,chosen.E)&&approx(density,chosen.density);
    let material;
    if(same)material={...chosen};
    else{
      const editedStock=chosen&&materialCatalog.some(m=>m.id===chosen.id);
      const newName=editedStock&&name===chosen.name?name+'（自訂）':name;
      const id=chosen&&!editedStock&&chosen.name===name?chosen.id:customId(kind,newName);
      material=normalizeRecord({id,name:newName,kind,E,density,notes:chosen?'依材質資料自行調整。':'自訂輸入。',densityAssumed:!!(chosen?.densityAssumed&&approx(density,chosen.density))});
    }
    if(!same) {try{saveLibrary([material]);}catch{/* The applied material is still saved in the model JSON. */}}
    Object.assign(span,{A,E:material.E,mass:material.density*A,material,areaEstimated:areaIsEstimated&&approx(A,baseArea)});
    get('beamMaterialDialog').close();context.onChange();
  }catch(e){get('beamMaterialMessage').textContent=e.message;}
}
async function importFile(file){
  if(!file)return;
  const message=get('beamMaterialMessage');
  try{
    if(file.size>2*1024*1024)throw Error('材質庫檔案須小於 2 MB。');
    const list=parseMaterialLibrary(await file.text(),/\.json$/i.test(file.name));saveLibrary(list);
    optionList(chosen);get('beamMaterialChoice').value=list[0].id;setValues(list[0]);
    message.textContent='已匯入 '+list.length+' 筆至「我的材質庫」。可選取材料並套用至此跨。';
  }catch(e){message.textContent='匯入失敗：'+e.message;}
}
function saveCsv(name,text){
  const url=URL.createObjectURL(new Blob(['\uFEFF',text],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function downloadTemplate(){
  const text='材質代碼,材質名稱,類別,E_GPa,density_kg_m3,規格,備註\r\nMY_STEEL,專案鋼材範例,steel,200,7850,,請依材料證明修改\r\nMY_WOOD,專案木材範例,wood,10,450,,請依材等與含水率修改\r\n';
  saveCsv('BeamLab_materials_template.csv',text);
}
export function builtInMaterialCsv(){
  const keys=['id','name','kind','E','density','standard','notes','source','modulusSource','densitySource','densityAssumed'];
  const headers=['id','name','kind','E_GPa','density_kg_m3',...keys.slice(5)];
  const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';
  return [headers,...materialCatalog.map(m=>keys.map(k=>m[k]))].map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
}
export function renderMaterialPickers(){
  if(!context)return;
  document.querySelectorAll('#spanList .spanbox').forEach((box,i)=>{
    const span=context.getConfig().spans[i];if(!span)return;
    let btn=box.querySelector('.beam-material-picker');
    if(!btn){
      btn=document.createElement('button');btn.type='button';btn.className='beam-material-picker';btn.setAttribute('aria-haspopup','dialog');btn.onclick=()=>openMaterial(i);
      box.querySelector('.boxhead').after(btn);
    }
    btn.textContent=span.material?'梁材質　'+span.material.name:'選擇梁材質';
    btn.setAttribute('aria-label','第 '+(i+1)+' 跨'+(span.material?'梁材質 '+span.material.name:'選擇梁材質'));
  });
}
export function installMaterialEditor(options){
  context=options;library=readStored();if(get('beamMaterialDialog')){renderMaterialPickers();return;}
  const dialog=document.createElement('dialog');dialog.id='beamMaterialDialog';dialog.setAttribute('aria-labelledby','beamMaterialTitle');
  // Only static UI markup is used here. Imported text always goes through .value or .textContent.
  dialog.innerHTML='<div class="dialoghead"><h2 id="beamMaterialTitle">梁材質</h2><button type="button" class="iconbtn" id="beamMaterialClose" aria-label="關閉梁材質">×</button></div><div class="dialogbody"><form id="beamMaterialForm"><label class="beam-material-source">材質庫<select id="beamMaterialChoice"></select></label><div class="beam-material-fields"><label>材質名稱<input id="beamMaterialName" required maxlength="85" placeholder="例如：專案用木梁"></label><label>類別<select id="beamMaterialKind"><option value="steel">鋼材</option><option value="wood">木構材</option></select></label><label>彈性模數 E <small id="beamMaterialEUnit"></small><input type="number" step="any" id="beamMaterialE" required></label><label>密度 ρ <small>kg/m³</small><input type="number" step="any" id="beamMaterialDensity" required></label><label>斷面積 A <small id="beamMaterialAreaUnit"></small><input type="number" step="any" id="beamMaterialArea" required></label></div><p id="beamMaterialAreaHint"></p><p id="beamMaterialMass"></p><div id="beamMaterialBasis"></div><details id="beamMaterialImportSection"><summary>匯入我的材質庫</summary><p>CSV 或 JSON 可一次匯入多筆鋼材或木材。匯入檔的 E 使用 GPa，密度使用 kg/m³。同代碼會更新原有自訂材質。與內建代碼相同的項目會另存 MY_ 副本。</p><div class="beam-material-files"><button type="button" id="beamMaterialTemplate">下載 CSV 範本</button><button type="button" id="beamMaterialCatalog">下載內建材質 CSV</button><label>匯入材質檔<input id="beamMaterialFile" type="file" accept=".csv,.json,text/csv,application/json"></label></div></details><p id="beamMaterialMessage" role="status"></p><div class="beam-material-actions"><button type="submit" class="primary">套用到此跨</button><button type="button" id="beamMaterialClear">解除材質連結</button></div></form></div>';
  document.body.append(dialog);
  get('beamMaterialClose').onclick=()=>dialog.close();dialog.onclick=e=>{if(e.target===dialog)dialog.close();};
  get('beamMaterialChoice').onchange=e=>setValues(findRecord(e.target.value));
  get('beamMaterialDensity').oninput=refreshResult;get('beamMaterialArea').oninput=()=>{areaIsEstimated=false;get('beamMaterialAreaHint').textContent='使用輸入的斷面積計算單位長度質量。';refreshResult();};
  get('beamMaterialCatalog').onclick=()=>saveCsv('BeamLab_TW_materials.csv',builtInMaterialCsv());
  get('beamMaterialTemplate').onclick=downloadTemplate;get('beamMaterialFile').onchange=async e=>{const input=e.target;await importFile(input.files[0]);input.value='';};
  get('beamMaterialForm').onsubmit=e=>{e.preventDefault();commit();};
  get('beamMaterialClear').onclick=()=>{const s=context.getConfig().spans[activeIndex];if(s){delete s.material;dialog.close();context.onChange();}};
  renderMaterialPickers();
}
