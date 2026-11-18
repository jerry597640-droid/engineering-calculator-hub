import {sectionCatalog} from './section-catalog.js';
import {evaluateSection,sectionOutline} from './section-geometry.js';

const shapeNames={i:'H 型鋼／工字形',channel:'槽形',angle:'角形',rect:'矩形實心',circle:'圓形實心',tube:'圓管',box:'矩形箱管',general:'自訂斷面性質'};
const dimKeys={i:['h','b','tw','tf'],channel:['h','b','tw','tf'],angle:['h','b','t'],rect:['h','b'],circle:['d'],tube:['d','t'],box:['h','b','t'],general:['A','Ih','Iv']};
const dimText={h:'總高 h',b:'總寬 b',t:'厚度 t',tw:'腹板厚 tw',tf:'翼板厚 tf',d:'外徑 d',A:'斷面積 A',Ih:'水平形心軸 Ih',Iv:'垂直形心軸 Iv'};
const referenceSizes={i:{h:.3,b:.15,tw:.007,tf:.01},channel:{h:.2,b:.075,tw:.006,tf:.01},angle:{h:.1,b:.075,t:.009},rect:{h:.3,b:.2},circle:{d:.2},tube:{d:.2,t:.008},box:{h:.2,b:.15,t:.008}};
const ids=id=>document.getElementById(id);
const element=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;return el;};
const positive=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const near=(a,b)=>positive(a)&&positive(b)&&Math.abs(a-b)<=1e-8*Math.max(a,b);
const copy=o=>JSON.parse(JSON.stringify(o));
const numeric=n=>Number.isFinite(n)?String(Number(n.toPrecision(11))):'';
let context,index=-1,draft=null;

function propertyFor(section,res){return section.axis==='v'?res.Iv:res.Ih;}
export function assertSpanSection(span){
  if(span.section==null)return;
  const s=span.section;
  if(!s||typeof s!=='object'||!Object.hasOwn(shapeNames,s.type)||typeof s.name!=='string'||!s.name.trim()||s.name.length>120||!['h','v'].includes(s.axis))throw Error('梁斷面名稱、類型或受彎方向有誤。');
  const geom=evaluateSection(s);
  if(!near(geom.A,span.A)||!near(propertyFor(s,geom),span.I))throw Error('跨資料的 A 或 I 與連結的斷面不一致。');
}
export function reconcileManualSectionEdit(span,key) {
  if(!span?.section||!['A','I'].includes(key))return;
  const p=evaluateSection(span.section),expected=key==='A'?p.A:propertyFor(span.section,p);
  if(!near(span[key],expected))delete span.section;
}
function unitFor(key){
  const u=context.getUnits(),power=key==='A'?2:key==='Ih'||key==='Iv'?4:1;
  return {scale:u.show('m',1)**power,label:u.label('m')+(power===2?'²':power===4?'⁴':'')};
}
function fromSpan(s){
  const I=positive(s.I)?s.I:.00045,A=positive(s.A)?s.A:Math.sqrt(12*I),h=Math.sqrt(12*I/A);
  return {type:'rect',dims:{h,b:A/h},name:'等效矩形',axis:'h'};
}
function allShapes(){
  const kind=ids('sectionShape');kind.replaceChildren();
  for(const [key,name] of Object.entries(shapeNames))kind.append(new Option(name,key));
}
function presetChoices(selectedId){
  const menu=ids('sectionPreset');menu.replaceChildren(new Option('自訂尺寸或性質',''));
  const filter=ids('sectionFilter').value.trim().toLowerCase().replace(/\s/g,'');
  const groups=new Map();
  for(const entry of sectionCatalog){
    const label=(entry.name+' '+entry.id+' '+(shapeNames[entry.type]||'')).toLowerCase().replace(/\s/g,'');
    if(filter&&!label.includes(filter)&&entry.id!==selectedId)continue;
    if(!groups.has(entry.type)){
      const group=element('optgroup');group.label=shapeNames[entry.type]||entry.type;groups.set(entry.type,group);menu.append(group);
    }
    groups.get(entry.type).append(new Option(entry.name,entry.id));
  }
  menu.value=selectedId||'';
}
function applyPreset(id){
  const preset=sectionCatalog.find(rec=>rec.id===id);
  if(preset){
    const axis=draft.axis;
    draft={...copy(preset),axis};ids('sectionIntro').textContent='可切換水平或垂直形心軸。修改型錄尺寸後會依自訂幾何重新計算。';
  }else detachPreset();
  syncForm();
}
function detachPreset(){
  if(!draft.id&&!draft.tab)return;
  const previous=draft.name;
  draft={type:draft.type,name:previous.endsWith('（自訂）')?previous:previous+'（自訂）',axis:draft.axis,dims:Object.fromEntries(dimKeys[draft.type].map(k=>[k,draft.dims[k]]))};
  ids('sectionPreset').value='';ids('sectionName').value=draft.name;
  ids('sectionIntro').textContent='目前按自訂幾何計算，型鋼圓角與斜度略去。';
}
function changeShape(type){
  let geom;
  try{geom=evaluateSection(draft);}catch{}
  const axis=draft.axis;
  if(type==='general'){
    const span=context.getConfig().spans[index];
    const I=positive(span.I)?span.I:.00045;
    draft={type,axis,name:'自訂斷面',props:{A:geom?.A||(positive(span.A)?span.A:Math.sqrt(12*I)),Ih:geom?.Ih||I,Iv:geom?.Iv||I}};
  }else{
    draft={type,axis,name:shapeNames[type],dims:{...referenceSizes[type]}};
  }
  ids('sectionIntro').textContent=type==='general'?'輸入已知斷面積及兩個形心軸的慣性矩。':'請輸入實際外形尺寸與厚度。';
  syncForm();
}
function syncForm(){
  ids('sectionShape').value=draft.type;
  ids('sectionAxis').value=draft.axis;
  ids('sectionName').value=draft.name;
  presetChoices(draft.id);
  const wrap=ids('sectionDimensions');wrap.replaceChildren();
  const props=draft.type==='general';
  for(const key of dimKeys[draft.type]){
    const {label,scale}=unitFor(key),node=element('label',dimText[key]+' ('+label+')'),input=element('input');
    input.type='number';input.step='any';input.required=true;input.value=numeric((props?draft.props:draft.dims)[key]*scale);
    input.dataset.sectionKey=key;
    input.oninput=()=>{
      if(!props)detachPreset();
      (props?draft.props:draft.dims)[key]=input.valueAsNumber/scale;
      plotAndSummarize();
    };
    node.append(input);wrap.append(node);
  }
  plotAndSummarize();
}
const ns='http://www.w3.org/2000/svg';
function svgPart(tag,attrs){
  const node=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,String(v));return node;
}
function renderDiagram(res){
  const host=ids('sectionDrawing');host.replaceChildren();
  const schematic=draft.type==='general';
  const outline=schematic?null:sectionOutline(draft),w=370,h=185,bodyW=235,bodyH=112;
  const svg=svgPart('svg',{viewBox:'0 0 '+w+' '+h,role:'img','aria-label':schematic?'自訂斷面的水平及垂直形心軸示意':'斷面形狀及兩個垂直的形心軸'});
  const x=schematic?185:(w-Math.min(bodyW,bodyH*outline.width/outline.height))/2;
  const scale=schematic?1:Math.min(bodyW/outline.width,bodyH/outline.height);
  const y=schematic?h/2:(h+outline.height*scale)/2;
  const cx=schematic?x:x+res.cy*scale,cz=schematic?y:y-res.cz*scale;
  if(outline){
    svg.append(svgPart('path',{d:outline.path,transform:'translate('+x+' '+y+') scale('+scale+' '+(-scale)+')','fill-rule':'evenodd',fill:'#d3e8e6',stroke:'#25565b','stroke-width':1.8,'vector-effect':'non-scaling-stroke'}));
  }
  // Horizontal and vertical are defined in the section plane, independent of model view rotation.
  const horizontal=draft.axis==='h';
  for(const [isH,color] of [[true,horizontal?'#9a401b':'#566d78'],[false,horizontal?'#566d78':'#9a401b']]){
    const active=isH===horizontal;
    const line=isH?{x1:23,x2:w-35,y1:cz,y2:cz}:{x1:cx,x2:cx,y1:16,y2:h-15};
    svg.append(svgPart('line',{...line,stroke:color,'stroke-width':active?2.3:1.3,'stroke-dasharray':active?'7 3':'3 4'}));
    const lab=svgPart('text',{x:isH?w-28:cx+8,y:isH?cz+4:14,'font-size':15,fill:color,'font-weight':650});
    lab.textContent=isH?'h':'v';svg.append(lab);
  }
  svg.append(svgPart('circle',{cx,cy:cz,r:3.2,fill:'#23383e',stroke:'#fff','stroke-width':1}));
  host.append(svg);
  if(schematic)host.append(element('figcaption','形心軸示意，斷面外形依原始圖說。'));
  else if(res.source==='table')host.append(element('figcaption','A、Ih、Iv 採型錄表值。圖形與形心位置依直邊尺寸示意。'));
  else host.append(element('figcaption','斷面外形依輸入尺寸繪製。'));
}
function plotAndSummarize(){
  const properties=ids('sectionProperties'),status=ids('sectionValidation'),source=ids('sectionSource');
  properties.replaceChildren();status.textContent='';source.replaceChildren();
  try{
    const res=evaluateSection(draft);
    if(![res.A,res.Ih,res.Iv].every(positive))throw Error('斷面積與慣性矩須為正數。');
    renderDiagram(res);
    for(const [key,label,num] of [['A','面積 A',res.A],['Ih','水平軸 Ih',res.Ih],['Iv','垂直軸 Iv',res.Iv]]){
      const unit=unitFor(key),group=element('div');
      if(key==='I'+draft.axis)group.className='selected';
      group.append(element('dt',label),element('dd',numeric(num*unit.scale)+' '+unit.label));properties.append(group);
    }
    const span=context.getConfig().spans[index],u=context.getUnits();
    if(span.material)source.append(element('p','依「'+span.material.name+'」密度換算單位長度質量為 '+numeric(u.show('kg/m',span.material.density*res.A))+' '+u.label('kg/m')+'。'));
    else source.append(element('p','套用後保留原輸入單位長度質量 '+numeric(u.show('kg/m',span.mass))+' '+u.label('kg/m')+'。'));
    if(draft.type==='angle')source.append(element('p','角形的水平、垂直形心軸通常不是主軸。本模型按選定方向作單平面彎曲分析，未計斜向雙軸耦合。'));
    if(draft.type==='channel')source.append(element('p','槽形開口斷面的剪力中心與形心分離。本模型僅分析選定平面的彎曲；偏心扭轉須另行檢核。'));
    if(draft.notes)source.append(element('p',draft.notes));
    if(draft.source){try{const url=new URL(draft.source);if(url.protocol==='https:'&&!url.username&&!url.password){const a=element('a','型鋼資料來源');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';source.append(a);}}catch{}}
    ids('sectionApply').disabled=false;
  }catch(e){
    ids('sectionDrawing').replaceChildren();ids('sectionApply').disabled=true;status.textContent=e.message;
  }
}
export function openSection(i){
  index=i;const span=context.getConfig().spans[i];if(!span)return;
  draft=span.section?copy(span.section):fromSpan(span);
  ids('sectionTitle').textContent='第 '+(i+1)+' 跨梁斷面';
  ids('sectionIntro').textContent=span.section?'選擇型鋼表或直接編輯斷面尺寸。':'可套用型鋼表或自行設定斷面。初始矩形依目前慣性矩與面積換算。';
  ids('sectionClear').hidden=!span.section;ids('sectionFilter').value='';
  syncForm();ids('beamSectionDialog').showModal();
}
function commit(){
  const form=ids('beamSectionForm');if(!form.reportValidity())return;
  try{
    const name=ids('sectionName').value.trim(),span=context.getConfig().spans[index];
    if(!name||name.length>120||/[\x00-\x1F\x7F]/.test(name))throw Error('請輸入有效的斷面名稱。');
    const section={...draft,name,axis:ids('sectionAxis').value},p=evaluateSection(section);
    const updated={...span,section:copy(section),A:p.A,I:propertyFor(section,p),areaEstimated:false};
    if(span.material)updated.mass=span.material.density*p.A;
    if(!positive(updated.mass))throw Error('此跨單位長度質量須大於零。');
    assertSpanSection(updated);Object.assign(span,updated);
    ids('beamSectionDialog').close();context.onChange();
  }catch(e){ids('sectionValidation').textContent=e.message;}
}
export function renderSectionPickers(){
  if(!context)return;
  document.querySelectorAll('#spanList .spanbox').forEach((box,i)=>{
    const span=context.getConfig().spans[i];if(!span)return;
    let button=box.querySelector('.beam-section-picker');
    if(!button){
      button=element('button');button.type='button';button.className='beam-section-picker';button.setAttribute('aria-haspopup','dialog');button.onclick=()=>openSection(i);
      (box.querySelector('.beam-material-picker')||box.querySelector('.boxhead')).after(button);
    }
    const s=span.section;
    button.textContent=s?'梁斷面　'+s.name+' · '+(s.axis==='h'?'水平軸':'垂直軸'):'選擇梁斷面';
    button.setAttribute('aria-label','第 '+(i+1)+' 跨'+(s?'梁斷面 '+s.name:'選擇梁斷面'));
  });
}
export function installSectionEditor(options){
  context=options;if(ids('beamSectionDialog')){renderSectionPickers();return;}
  const dialog=element('dialog');dialog.id='beamSectionDialog';dialog.setAttribute('aria-labelledby','sectionTitle');
  dialog.innerHTML='<div class="dialoghead"><h2 id="sectionTitle">梁斷面</h2><button type="button" class="iconbtn" id="sectionClose" aria-label="關閉梁斷面">×</button></div><div class="dialogbody"><form id="beamSectionForm"><p id="sectionIntro"></p><div class="section-formgrid"><label>搜尋型鋼<input id="sectionFilter" type="search" placeholder="型號或尺寸"></label><label>型鋼表<select id="sectionPreset"></select></label><label>斷面類型<select id="sectionShape"></select></label><label>斷面名稱<input id="sectionName" required maxlength="120"></label></div><div id="sectionDimensions" class="section-formgrid"></div><label class="section-axis">受彎軸<select id="sectionAxis"><option value="h">水平形心軸 h（Ih）</option><option value="v">垂直形心軸 v（Iv）</option></select></label><figure id="sectionDrawing"></figure><dl id="sectionProperties"></dl><div id="sectionSource"></div><p id="sectionValidation" role="status"></p><div class="section-actions"><button type="submit" class="primary" id="sectionApply">套用斷面到此跨</button><button type="button" id="sectionClear">解除斷面連結</button></div></form></div>';
  document.body.append(dialog);allShapes();
  ids('sectionFilter').oninput=()=>presetChoices(draft.id);
  ids('sectionPreset').onchange=e=>applyPreset(e.target.value);
  ids('sectionShape').onchange=e=>changeShape(e.target.value);
  ids('sectionAxis').onchange=e=>{draft.axis=e.target.value;plotAndSummarize();};
  ids('sectionName').oninput=e=>{draft.name=e.target.value;};
  ids('beamSectionForm').onsubmit=e=>{e.preventDefault();commit();};
  ids('sectionClose').onclick=()=>dialog.close();dialog.onclick=e=>{if(e.target===dialog)dialog.close();};
  ids('sectionClear').onclick=()=>{const s=context.getConfig().spans[index];delete s.section;dialog.close();context.onChange();};
  renderSectionPickers();
}
