/* Multi-layer rectangular perimeter templates; actual coordinates remain authoritative. */
let layerDefs=[],layerDirty=false;
const layerPalette=['#cf7918','#16867b','#8751aa','#567b24','#b24570','#90642d'];
function layerColor(layer){return Number.isInteger(layer)&&layer>=1&&layer<=6?layerPalette[layer-1]:'#cf7918';}
function validLayerConfig(a){return Array.isArray(a)&&a.length>=2&&a.length<=6&&a.every((l,i)=>l&&RCC.BARS[l.bar]&&Number.isInteger(l.nx)&&l.nx>=2&&l.nx<=12&&Number.isInteger(l.ny)&&l.ny>=2&&l.ny<=12&&(!i||(Number.isFinite(l.clear)&&l.clear>=.1&&l.clear<=30)));}
function defaultLayerConfig(count){return Array.from({length:count},(_,i)=>({bar:$('bar').value||'D25',nx:Number($('nx').value)||4,ny:Number($('ny').value)||4,clear:i?4:0}));}
function layerEditor(){
  if(!layerDefs.length)layerDefs=defaultLayerConfig(2);
  if($('layerCount').value==='custom')$('layerCustomCount').value=layerDefs.length;else $('layerCount').value=String(layerDefs.length);
  $('layerCustomCount').classList.toggle('hidden',$('layerCount').value!=='custom');
  $('layerEditor').innerHTML=layerDefs.map((l,i)=>'<div class="layer-row"><h4><span class="layer-dot" style="background:'+layerColor(i+1)+'"></span>第 '+(i+1)+' 層'+(i===0?'（最外層）':'')+'</h4><div class="grid"><div class="field"><label for="layerBar'+i+'">主筋尺寸</label><div class="control"><select id="layerBar'+i+'" data-layer="'+i+'" data-field="bar">'+Object.keys(RCC.BARS).map(k=>'<option '+(l.bar===k?'selected':'')+'>'+k+'</option>').join('')+'</select></div></div>'+[['nx','沿 b 每邊根數 nx'],['ny','沿 h 每邊根數 ny'],['clear','與前層淨距（cm）']].map(([k,t])=>'<div class="field"><label for="layer'+k+i+'">'+t+'</label><div class="control"><input id="layer'+k+i+'" data-layer="'+i+'" data-field="'+k+'" type="number" min="'+(k==='clear'?'.1':'2')+'" max="'+(k==='clear'?'30':'12')+'" step="'+(k==='clear'?'.1':'1')+'" value="'+esc(Number.isFinite(l[k])?l[k]:'')+'" '+(k==='clear'&&i===0?'disabled':'')+'></div></div>').join('')+'</div></div>').join('');
  updateLayerSummary();
}
function layerActualGroups(g){
  const groups=new Map();g.bars.forEach(p=>{const key=p.layer||0;let a=groups.get(key);if(!a){a={layer:key,N:0,Ast:0,types:{}};groups.set(key,a);}a.N++;a.Ast+=p.a;a.types[p.bar]=(a.types[p.bar]||0)+1;});
  return [...groups.values()].sort((a,b)=>a.layer-b.layer);
}
function updateLayerSummary(){
  $('layerDraftMessage').textContent=layerDirty?'多層設定已變更，尚未套用；目前計算及圖面仍採座標表。請按「產生／更新多層座標」。':'計算以目前實際座標表為準；重新產生將覆蓋拖曳調整。';
  if(!customRows.some(r=>Number.isInteger(r.layer))){$('layerSummary').innerHTML='';return;}
  const groups=new Map();for(const r of customRows){if(!RCC.BARS[r.bar]||!Number.isInteger(r.n)||r.n<1)continue;const key=r.layer||0;const g=groups.get(key)||{N:0,Ast:0};g.N+=r.n;g.Ast+=r.n*RCC.BARS[r.bar].a;groups.set(key,g);}
  $('layerSummary').innerHTML=[...groups.entries()].sort((a,b)=>a[0]-b[0]).map(([key,g])=>'<span class="layer-chip"><span class="layer-dot" style="background:'+layerColor(key)+'"></span>'+(key?'來源第'+key+'層':'未分層')+' · '+g.N+'根 · Ast '+fmt(g.Ast,3)+' cm²</span>').join('');
}
function actualLayerReport(g){return '<h3>主筋來源層別（依實際座標展開）</h3><div class="table-wrap">'+table(['來源層','主筋','根數','Ast（cm²）'],layerActualGroups(g).map(l=>[l.layer?'第'+l.layer+'層':'未分層',Object.entries(l.types).map(([k,n])=>n+'-'+k).join(' ＋ '),l.N,fmt(l.Ast,3)]))+'</div><p class="muted">來源層在拖曳後保留為分組標籤；容量採下方實際座標，不假定各層仍為規則周邊。</p>';}
function generateLayerCoordinates(){
  try{
    const built=RCC.buildLayers(read(),layerDefs),before=copyBarRows();
    customRows=built.rows;$('layout').value='layers';layerDirty=false;
    $('dX').value=Number($('b').value)/2;$('dY').value=Number($('h').value)/2;$('supported').checked=false;
    if(before.length)rememberGraphicEdit(before);$('layerError').classList.add('hidden');
    barEditor();layoutUI();invalidateDesign();recalc();
    $('layerDraftMessage').textContent='已產生 '+built.info.length+' 層、'+built.total+' 根；Ast '+fmt(built.Ast,3)+' cm²。dx/dy初值需依受拉筋形心核定，並確認各層側撐。';
    return true;
  }catch(e){$('layerError').textContent='多層座標未更新：'+e.message;$('layerError').classList.remove('hidden');layerDirty=true;updateLayerSummary();return false;}
}
function changeLayerCount(){
  const count=Number($('layerCount').value==='custom'?$('layerCustomCount').value:$('layerCount').value);
  $('layerCustomCount').classList.toggle('hidden',$('layerCount').value!=='custom');
  if(!Number.isInteger(count)||count<2||count>6){$('layerError').textContent='自訂層數須為2～6的整數。';$('layerError').classList.remove('hidden');return;}
  const defaults=defaultLayerConfig(count);layerDefs=defaults.map((l,i)=>layerDefs[i]?{...layerDefs[i]}:l);layerDirty=true;layerEditor();
}
$('layerCount').onchange=changeLayerCount;$('layerCustomCount').oninput=changeLayerCount;
$('layerEditor').oninput=e=>{const el=e.target;if(el.dataset.layer===undefined)return;const k=el.dataset.field;layerDefs[Number(el.dataset.layer)][k]=k==='bar'?el.value:el.value.trim()===''?NaN:Number(el.value);layerDirty=true;updateLayerSummary();};
$('generateLayers').onclick=generateLayerCoordinates;
$('layerExample').onclick=()=>{example();$('b').value=80;$('h').value=80;$('layout').value='layers';layerDefs=defaultLayerConfig(3);layerDefs.forEach(l=>{l.bar='D25';l.nx=l.ny=4;});layerDirty=false;layerEditor();generateLayerCoordinates();toast('已載入3層範例：36-D25；各層側撐、肢數與有效深度須依詳圖確認。');};
