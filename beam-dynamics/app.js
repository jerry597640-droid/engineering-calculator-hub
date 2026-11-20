import {applyVehicleModel,renderVehiclePicker,vehicleLane,vehicleShape,vehiclePlotBounds} from './vehicle-models.js?v=1.11.2';
import {installSteelDesign,currentSteelDesign} from './steel-design-ui.js?v=1.9.0';
import {vehicleLabelLayout,vehicleChartOverlay} from './chart-vehicle.js?v=1.11.2';
import {peakSummary,peakLocation,components} from './extrema.js';
import {installLiveLoads,closestFrame,movingAtDistance} from './live-loads.js?v=1.7.1';
import {installSectionCursor} from './section-cursor.js?v=1.10.0';
import {installDiagramEditor} from './diagram-editor.js';
import {installLayoutEditor} from './span-layout.js';
import {build,statics,moving,dynamic,axleLoads,maxSpans,total,vehicleLength,validate as validateBeam} from './solver.js?v=1.9.0';
import {unitSystem, resultDimensions, displayNumber} from './units.js';
import {installWorkspace, arrangePins, selectView} from './workspace.js?v=1.4';
import {openMaterial,installMaterialEditor,renderMaterialPickers,reconcileManualSpanEdit,assertSpanMaterial} from './material-editor.js?v=1.4.1';
import {openSection,installSectionEditor,renderSectionPickers,reconcileManualSectionEdit,assertSpanSection} from './section-editor.js?v=1.4.1';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)],fmt=(x,n=2)=>Math.abs(x)<1e-7?(0).toFixed(n):Number(x).toFixed(n),clone=x=>JSON.parse(JSON.stringify(x));
function validate(input,options) {
 validateBeam(input,options);
 for(const s of input.spans){
   if(s.A!=null&&!(Number.isFinite(s.A)&&s.A>0))throw Error('斷面積必須為正數。');
   assertSpanMaterial(s);
   assertSpanSection(s);
 }
}
const span=(L=10)=>({L,E:200,I:.0008,mass:800});
const base={spans:[span(10),span(10)],supports:['pin','roller','roller'],loads:[{type:'line',a:0,b:20,w1:10,w2:10},{type:'point',x:5,p:50}],axles:[{p:60,offset:0},{p:120,offset:4},{p:120,offset:5.4}],mode:'static',mesh:12,selfWeight:false,direction:1,factor:1,speed:60,step:.2,dt:.01,damping:2,tail:1};
let c=clone(base),model=null,analysis=null,current=null,frameIndex=0,playing=false,raf=0,dirty=false,busy=false,tab='geometry',preset='continuous';
try{let v=JSON.parse(localStorage.getItem('beamlab-model-v1'));if(v){validate(v,{allowMechanism:true});c=v;preset='';}}catch{}
let generation=0, autoTimer=0, autoPending=false, travel=null, movingSweep=null;
let units = unitSystem(c.displayUnits);
const labelOf = unit => units.label(unit);
const numberOf = (value, unit, digits = 2) => displayNumber(units.show(unit, value), digits);
const quantity = (value, unit, digits = 2) => `${numberOf(value, unit, digits)} ${labelOf(unit)}`;
const entryValue = (value, unit) => Number(units.show(unit, value).toPrecision(14));
function readPosition(selector) {
  const input = $(selector);
  return input.value === '' ? NaN : units.base('m', input.valueAsNumber);
}
function field(label, value, kind, index, key, unit) {
  return `<label>${label}<em>${labelOf(unit)}</em><input type="number" step="any" value="${entryValue(value, unit)}" data-kind="${kind}" data-index="${index}" data-key="${key}" data-dimension="${unit}"></label>`;
}
function updateUnits(preferences) {
  const positions = ['#queryX', '#probeX'].map(readPosition);
  units = unitSystem(preferences);
  c.displayUnits = units.prefs;
  ['#queryX', '#probeX'].forEach((selector, index) => {
    $(selector).value = Number.isFinite(positions[index]) ? entryValue(positions[index], 'm') : '';
  });
  editors();
  persist();
  if (analysis && !dirty && !busy) { renderResults(); history(); }
  else drawBeam();
}
function unitLabels() {
  $$('[data-unit]').forEach(el => el.textContent = labelOf(el.dataset.unit));
  $$('[data-pref]').forEach(el => el.value = units.prefs[el.dataset.pref]);
  $('#unitsBtn').textContent = `單位設定 · ${labelOf('kN')} / ${labelOf('m')}`;
  $('#unitSummary').textContent = `線載重 ${labelOf('kN/m')}，彎矩 ${labelOf('kN·m')}，單位長度質量 ${labelOf('kg/m')}。`;
  $('#step').min = entryValue(0.01, 'm');
  $('#step').step = 'any';
  for (const selector of ['#queryX', '#probeX']) {
    $(selector).max = entryValue(total(c), 'm');
    $(selector).step = 'any';
  }
}
const supportNames={pin:'鉸支承',roller:'滾動支承',fixed:'固定端',free:'自由／無支承'};
function editors(){
 renderVehiclePicker(c,quantity);
 $('#spanList').innerHTML=c.spans.map((s,i)=>`<div class="spanbox"><div class="boxhead"><span><span class="index">${String(i+1).padStart(2,'0')}</span> 第 ${i+1} 跨</span>${c.spans.length>1?`<button class="iconbtn" data-delete="span" data-index="${i}" aria-label="刪除第 ${i+1} 跨">×</button>`:''}</div><div class="field-grid">${field('跨長',s.L,'spans',i,'L','m')}${field('彈性模數 E',s.E,'spans',i,'E','GPa')}${field('慣性矩 I',s.I,'spans',i,'I','m⁴')}${field('單位長度質量',s.mass,'spans',i,'mass','kg/m')}</div></div>`).join('');
 let x=0;$('#supportList').innerHTML=c.supports.map((s,i)=>{if(i)x+=c.spans[i-1].L;return `<div class="supportrow"><b>${String.fromCharCode(65+i)}</b><select data-support="${i}" aria-label="${String.fromCharCode(65+i)} 支承">${Object.entries(supportNames).map(([k,v])=>`<option value="${k}" ${s===k?'selected':''}>${v}</option>`).join('')}</select><small>${quantity(x,'m')}</small></div>`;}).join('');
 $('#loadList').innerHTML=c.loads.length?c.loads.map((l,i)=>`<div class="loadbox"><div class="boxhead"><span>${l.type==='point'?'集中力 P':l.type==='moment'?'集中彎矩 M':'線性分布載重 w'}</span><button class="iconbtn" data-delete="load" data-index="${i}" aria-label="刪除第 ${i+1} 筆載重">×</button></div><div class="field-grid">${l.type==='line'?field('起點',l.a,'loads',i,'a','m')+field('終點',l.b,'loads',i,'b','m')+field('起點強度',l.w1,'loads',i,'w1','kN/m')+field('終點強度',l.w2,'loads',i,'w2','kN/m'):field('位置 x',l.x,'loads',i,'x','m')+field('大小',l.p,'loads',i,'p',l.type==='point'?'kN':'kN·m')}</div>${l.type==='line'?'<p class="hint">等值為均布；一端設 0 為三角形。</p>':''}</div>`).join(''):'<p class="hint">尚無靜態載重，可用下方按鈕新增。</p>';
 $('#axleList').innerHTML=c.axles.map((a,i)=>`<div class="axlebox"><div class="boxhead"><span>第 ${i+1} 軸</span>${c.axles.length>1?`<button class="iconbtn" data-delete="axle" data-index="${i}" aria-label="刪除第 ${i+1} 軸">×</button>`:''}</div><div class="field-grid">${field('軸重',a.p,'axles',i,'p','kN')}${field('距前軸',a.offset,'axles',i,'offset','m')}</div></div>`).join('');
 for(let key of ['direction','factor','speed','step','damping','dt','tail','mesh'])$('#'+key).value=key==='step'?entryValue(c.step,'m'):c[key];$('#selfWeight').checked=c.selfWeight;
 $$('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===c.mode));$$('[data-preset]').forEach(b=>b.classList.toggle('selected',b.dataset.preset===preset));
 let hv=$('#historyType').value;$('#historyType').innerHTML='<option value="M">彎矩 M</option><option value="V">剪力 V</option><option value="D">撓度 δ</option>'+c.supports.map((s,i)=>s==='free'?'':`<option value="R:${i}">${String.fromCharCode(65+i)} 支承反力</option>`).join('');if([...$('#historyType').options].some(o=>o.value===hv))$('#historyType').value=hv;
 $('#modelBadge').textContent=c.spans.length===1?'單跨梁':c.spans.length+' 跨連續梁';$('#layoutBadge').textContent=c.spans.length+' 跨';$('#addSpan').disabled=c.spans.length>=maxSpans;$('#addAxle').disabled=c.axles.length>=12;unitLabels();renderMaterialPickers();renderSectionPickers();liveLoads.refresh();
}
function persist(){try{localStorage.setItem('beamlab-model-v1',JSON.stringify(c));$('#saveStatus').textContent='設定已保存在此瀏覽器';}catch{$('#saveStatus').textContent='無法自動儲存，請匯出模型';}}
function stale(){document.querySelectorAll('.chart-vehicle').forEach(el=>el.remove());clearPeaks();generation++;clearTimeout(autoTimer);autoPending=false;stop();dirty=true;sectionCursor.clear();document.body.classList.add('stale');$('#csvBtn').disabled=true;$('#reportBtn').disabled=true;$('#exchangeBtn').disabled=true;$('#printBtn').disabled=true;notice('設定已變更，請按「計算分析」更新結果。');persist();try{drawBeam();}catch{}}
function notice(s,error=false){$('#notice').hidden=!s;$('#notice').textContent=s;$('#notice').classList.toggle('error',error);$('#settingsStatus').textContent=s;$('#settingsStatus').hidden=!s;$('#settingsStatus').classList.toggle('error',error);}
function toast(t){$('#toast').textContent=t;$('#toast').classList.add('visible');setTimeout(()=>$('#toast').classList.remove('visible'),2400);}
function svgText(x,y,text,color='#6b7e83',anchor='middle',size=12){return `<text x="${x}" y="${y}" fill="${color}" text-anchor="${anchor}" style="font-size:${size}px">${text}</text>`;}
function loadGroup(key, name){
 const editing=$('#loadDialog').open && $('#liveChoice').value===key;
 return `<g class="beam-load${editing?' is-editing':''}" data-load-key="${key}" tabindex="0" role="button" aria-haspopup="dialog" aria-controls="loadDialog" aria-label="調整${name}"><title>調整${name}</title>`;
}
function loadHit(path,width=20){
 return `<path class="load-hit" d="${path}" fill="none" stroke="transparent" stroke-width="${width}" vector-effect="non-scaling-stroke" pointer-events="stroke"/>`;
}
function drawBeam(){renderVehiclePicker(c,quantity);let L=total(c);if(!(L>0))return;let W=Math.max(310,Math.min(1000,Math.floor($('#beamWrap').clientWidth || 700)-12)),H=c.mode==='static'?230:350,pad=W<540?35:65,scale=(W-2*pad)/L,X=x=>pad+x*scale,y=125;
 if(c.mode!=='static'){const fit=vehiclePlotBounds(c,L,pad,W-pad,W);pad=fit.left;scale=fit.scale;}
 const shift=c.mode==='static'?0:Math.max(120,vehicleShape(c).height*scale+30-y);H=230+shift;
 let out=`<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" data-beam-offset="${shift}" data-plot-left="${pad}" data-plot-right="${W-pad}" role="group" aria-label="梁模型、支承與載重"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 5L5 0" stroke="#819b9f" stroke-width="1"/></pattern></defs>`;
 if(c.mode!=='static')out+=vehicleLane(c,{front:vehicleTravel(),length:L,left:pad,right:W-pad,width:W,contactY:y+shift});
 out+=`<g transform="translate(0,${shift})">`;
 out+=`<rect x="${pad}" y="${y}" width="${W-pad*2}" height="8" rx="2" fill="#27434c"/>`;
 let x=0;
 c.spans.forEach((member,i)=>{
   const a=X(x);x+=member.L;const b=X(x),letter=String.fromCharCode(65+i,66+i);
   out+=`<g class="beam-span" role="button" tabindex="0" data-span="${i}" aria-haspopup="dialog" aria-label="編輯第 ${i+1} 跨 ${letter} 梁斷面與材質"><title>第 ${i+1} 跨 ${letter} · 變更斷面或材質</title><rect class="span-hit" fill="transparent" stroke="none" pointer-events="all" x="${a}" y="${y-16}" width="${b-a}" height="115"/><rect class="span-rail" fill="transparent" stroke="none" pointer-events="none" x="${a}" y="${y}" width="${b-a}" height="8" rx="2"/><path d="M${a},205H${b}M${a},200v10M${b},200v10" stroke="#a8babc"/>`+svgText((a+b)/2,201,quantity(member.L,'m',1))+'</g>';
 });
 x=0;
 c.supports.forEach((s,i)=>{
   const xx=X(x),letter=String.fromCharCode(65+i);
   const left=i?Math.min(30,c.spans[i-1].L*scale/2):30;
   const right=i<c.spans.length?Math.min(30,c.spans[i].L*scale/2):30;
   out+=`<g class="beam-support" role="button" tabindex="0" data-node="${i}" aria-haspopup="dialog" aria-label="變更 ${letter} 點支承（${supportNames[s]}）"><title>${letter} 點 · ${supportNames[s]}，點選變更</title><rect class="support-hit" fill="transparent" stroke="none" pointer-events="all" x="${xx-left}" y="${y-21}" width="${left+right}" height="85" rx="6"/><g class="support-mark">`;
   if(s==='fixed'){
     const end=i===c.supports.length-1;
     out+=`<rect x="${xx-(end?0:13)}" y="${y-21}" width="13" height="59" fill="url(#hatch)"/><path d="M${xx},${y-21}v59" stroke="#27434c" stroke-width="2"/>`;
   }else if(s==='free'){
     out+=`<circle cx="${xx}" cy="${y+4}" r="4" fill="white" stroke="#527c7a" stroke-width="2"/>`;
   }else{
     out+=`<path d="M${xx},${y+8}l-11 17h22z" fill="#edf4f3" stroke="#527c7a" stroke-width="1.5"/>`;
     if(s==='roller')out+=`<circle cx="${xx-6}" cy="${y+29}" r="3" fill="white" stroke="#527c7a"/><circle cx="${xx+6}" cy="${y+29}" r="3" fill="white" stroke="#527c7a"/>`;
     out+=`<path d="M${xx-17},${y+35}h34" stroke="#78918f"/>`;
   }
   out+=svgText(xx,y+55,letter,'#244b50')+'</g></g>';
   if(i<c.spans.length)x+=c.spans[i].L;
 });
 const captions=[];
 function loadLabel(key,x,preferredY,text,color){
   const width=Math.min(W-8,Math.max(24,text.length*7.5)),cx=Math.max(width/2+3,Math.min(W-width/2-3,x));
   for(const yLabel of [preferredY,preferredY-16,preferredY+16,preferredY-32,preferredY+32]){
     if(yLabel<12||yLabel>y-13)continue;
     if(captions.some(b=>Math.abs(b.cx-cx)<(b.width+width)/2+4&&Math.abs(b.y-yLabel)<16))continue;
     const id='beam-label-'+captions.length;
     captions.push({key,cx,y:yLabel,width,id});
     // The separate painted caption layer keeps its text above crossing arrows.
     return '<g opacity="0" pointer-events="none">'+svgText(cx,yLabel,text,color).replace('<text ','<text id="'+id+'" ')+'</g>';
   }
   return '';
 }
 let row=0;
 const pointLoads=[];
 for(const [index,load] of c.loads.entries()){
   if(load.type!=='line'){pointLoads.push({load,key:'loads:'+index,name:'第 '+(index+1)+' 筆'+(load.type==='moment'?'集中彎矩':'集中力')});continue;}
   const {a,b,w1,w2}=load;
   const mx=Math.max(Math.abs(w1),Math.abs(w2),1);
   const bottom=y-20-Math.min(row++,4)*10,baseY=bottom-30*Math.max(0,-w1,-w2)/mx;
   const xa=X(a),xb=X(b),ya=baseY-30*w1/mx,yb=baseY-30*w2/mx;
   const edge=`M${xa},${ya}L${xb},${yb}`;
   out+=loadGroup('loads:'+index,'第 '+(index+1)+' 筆分布載重');
   out+=`<path d="${edge}L${xb},${baseY}H${xa}Z" fill="transparent" pointer-events="fill"/>`+loadHit(edge,14);
   out+=`<path class="load-ink" d="${edge}" fill="none" stroke="#087a70" stroke-width="1.5"/>`;
   for(let j=0;j<=12;j++){
     const t=j/12,x=xa+(xb-xa)*t,w=w1+(w2-w1)*t;
     if(w!==0)out+=`<path class="load-ink" d="M${x},${baseY-30*w/mx}V${baseY}" stroke="#087a70" stroke-width="1.3" marker-end="url(#arrow)"/>`;
   }
   const caption=numberOf(w1,'kN/m')+(w1===w2?'':' → '+numberOf(w2,'kN/m'))+' '+labelOf('kN/m');
   out+=loadLabel('loads:'+index,(xa+xb)/2,Math.max(13,Math.min(ya,yb,baseY)-8),caption,'#087a70')+'</g>';
 }
 if(c.mode!=='static'){
   const wheels=axleLoads({c,L},vehicleTravel());
   const active=Number($('#liveChoice').value.replace('axles:',''));
   for(const load of wheels.sort((a,b)=>Number(b.axleIndex===active)-Number(a.axleIndex===active))){
     pointLoads.push({load,key:'axles:'+load.axleIndex,name:'車輛第 '+(load.axleIndex+1)+' 軸'});
   }
 }
 for(const {load:l,key,name} of pointLoads){
   const xx=X(l.x),selected=l.vehicle&&$('#liveChoice').value===key;
   const color=l.vehicle?(selected?'#a7500f':'#d88a3b'):'#087a70';
   let path,caption;
   if(l.type==='moment'){
     path=`M${xx+(l.p<0?-13:13)},${y-17}a18 18 0 1 ${l.p<0?1:0} ${l.p<0?25:-25} -10`;
     caption=loadLabel(key,xx,y-45,quantity(l.p,'kN·m',1),color);
   }else{
     const top=y-3-(l.p===0?0:28+70*Math.abs(l.p)/(Math.abs(l.p)+35));
     path=`M${xx},${l.p<0?(l.vehicle?y:y-3):top}V${l.p<0?top:(l.vehicle?y:y-3)}`;
     caption=loadLabel(key,xx,top-9,quantity(l.p,'kN',1),color);
   }
   out+=loadGroup(key,name)+loadHit(path)+`<path class="load-ink" d="${path}" fill="none" stroke="${color}" stroke-width="2" marker-end="url(#arrow)"/>`+caption;
   if(l.vehicle){
     out+=`<circle cx="${xx}" cy="${y}" r="11" fill="transparent" pointer-events="all"/><circle data-axle="${l.axleIndex}" aria-label="${name}，x = ${quantity(l.x,'m',3)}，軸重 ${quantity(l.p,'kN',2)}" cx="${xx}" cy="${y}" r="3" fill="${selected?'#ffe3bb':'#fff5e8'}" stroke="${color}" stroke-width="2"/>`;
   }
   out+='</g>';
 }
 for(const {key,cx,y:baseline,width,id} of captions){
   const active=$('#loadDialog').open&&$('#liveChoice').value===key;
   out+=`<g class="load-caption${active?' is-editing':''}" data-load-key="${key}" aria-hidden="true"><rect x="${cx-width/2-2}" y="${baseline-11}" width="${width+4}" height="15" rx="2" fill="transparent" pointer-events="all"/><use href="#${id}" pointer-events="none"/></g>`;
 }
 const target=document.activeElement?.closest('#beamWrap [role="button"]')?.dataset;
 out+='</g></svg>';$('#beamWrap').innerHTML=out;
 if(target){
   const key=target.loadKey!==undefined?'loadKey':target.node!==undefined?'node':'span';
   const attr=key==='loadKey'?'load-key':key;
   $('#beamWrap [data-'+attr+'="'+target[key]+'"]')?.focus({preventScroll:true});
 }
$('#modelInfo').textContent=`${c.spans.length} 跨 · 全長 ${quantity(L,'m')} · ${c.loads.length} 筆靜載${c.selfWeight?' ＋ 自重':''}`;
}
function chart(id,pts,key,color,env=null,opts={}){let W=Math.max(300,Math.min(1000,Math.floor($('#'+id).clientWidth || 700)-12)),l=W<540?65:77,r=15,bottom=30,end=opts.end??model.L;const vehicle=!opts.time&&c.mode!=='static';if(vehicle){const fit=vehiclePlotBounds(model.c,model.L,l,W-r,W);l=fit.left;r=W-fit.right;}const layout=vehicle?vehicleLabelLayout(model.c,model.L,l,W-r,quantity):null,band=layout?.height??0,H=190+band,top=20+band;let values=pts.map(p=>p[key]);if(env)values.push(...env.map(p=>p[key+'max']),...env.map(p=>p[key+'min']));let mx=Math.max(...values.map(Math.abs),.01),up=key==='M'&&!opts.time;let X=x=>l+(W-l-r)*x/end,Y=v=>top+(H-top-bottom)/2+(up?1:-1)*v/mx*((H-top-bottom)/2-7),base=Y(0);let lines='';
 for(let v of [-mx,0,mx])lines+=`<path d="M${l},${Y(v)}H${W-r}" stroke="${v===0?'#b8c8ca':'#e8eeee'}" ${v===0?'':'stroke-dasharray="3 5"'}/>`+svgText(l-9,Y(v)+4,numberOf(v,resultDimensions[key],Math.abs(units.show(resultDimensions[key],v))>100?0:2),'#819194','end',11);
 for(let i=0;i<=5;i++){let x=end*i/5;lines+=svgText(X(x),H-8,(opts.time?fmt(x,2):numberOf(x,'m',1)),'#819194','middle',11);}
 const path=arr=>arr.map((p,i)=>`${i?'L':'M'}${X(p.x).toFixed(2)},${Y(p.val).toFixed(2)}`).join('');
 if(env){let max=env.map(p=>({x:p.x,val:p[key+'max']})),min=env.map(p=>({x:p.x,val:p[key+'min']}));lines+=`<path d="${path(max)} ${path([...min].reverse()).replace(/^M/,'L')}Z" fill="${color}" opacity=".09"/><path d="${path(max)}" stroke="${color}" fill="none" stroke-dasharray="5 4" opacity=".6"/><path d="${path(min)}" stroke="${color}" fill="none" stroke-dasharray="5 4" opacity=".6"/>`;}
 let ds=path(pts.map(p=>({x:p.x,val:p[key]})));lines+=`<path d="M${X(pts[0].x)},${base} ${ds.replace(/^M/,'L')} L${X(pts.at(-1).x)},${base}Z" fill="${color}" opacity=".12"/><path d="${ds}" stroke="${color}" stroke-width="2.2" fill="none" stroke-linejoin="round"/>`;
 if(!opts.time)model.ss.forEach(x=>{lines+=`<path d="M${X(x)},${top}V${H-bottom}" stroke="#b3c7c8" stroke-dasharray="2 5" opacity=".55"/>`;});
 let peak=pts.reduce((a,p)=>Math.abs(p[key])>Math.abs(a[key])?p:a,pts[0]);lines+=`<circle cx="${X(peak.x)}" cy="${Y(peak[key])}" r="3" fill="${color}"/>`+svgText(Math.max(l+30,Math.min(W-r-30,X(peak.x))),Math.max(top-6,Math.min(H-bottom-5,Y(peak[key])+(peak[key]*(up?1:-1)>0?16:-10))),numberOf(peak[key],resultDimensions[key]),color);
 if(vehicle)lines+=vehicleChartOverlay({layout,wheels:axleLoads(model,analysis.frames[frameIndex].front),left:l,right:W-r,bottom:H-bottom,X,Y,result:{at:current.at,length:model.L},key,quantity,time:analysis.frames[frameIndex].t,config:model.c,front:analysis.frames[frameIndex].front});
 $('#'+id).innerHTML=`<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}" ${opts.time?'':`data-plot-left="${l}" data-plot-right="${W-r}" data-plot-top="${top}" data-plot-bottom="${H-bottom}" data-plot-zero="${base}" data-plot-scale="${(up?1:-1)*((H-top-bottom)/2-7)/mx}"`} role="img" aria-label="${key} ${opts.time?'歷時':'分布'}圖"><title>${key}，${opts.time?'時間 s':'座標 '+labelOf('m')}</title>${lines}</svg>`;
}
function vehicleTravel(){
 const length=total(c),end=length+vehicleLength(c)+(c.mode==='dynamic'?c.speed/3.6*c.tail:0);
 return Math.min(end,Math.max(0,travel??(length+vehicleLength(c))*.4));
}
function seekVehicle(x){
 stop();travel=c.direction===1?x:total(c)-x;
 if(analysis&&!busy&&!dirty&&c.mode!=='static'){
   selectTravelFrame(travel);renderResults();
 }else drawBeam();
}
function selectTravelFrame(distance){
 if(c.mode==='moving'&&movingSweep){
   const station=movingAtDistance(movingSweep,model,distance,statics);
   analysis=station.analysis;frameIndex=station.index;
 }else frameIndex=closestFrame(analysis.frames,distance);
 $('#frameRange').max=analysis.frames.length-1;
}
function scheduleLiveAnalysis(){
 clearTimeout(autoTimer);autoPending=true;
 autoTimer=setTimeout(()=>{if(!busy&&autoPending)run();},c.mode==='static'?75:230);
}
function editLiveLoad(kind,index,key,value){
 const row=c[kind]?.[index],L=total(c);
 if(!row)return '找不到選取的載重。';
 if(['a','b','x'].includes(key)&&(value<0||value>L))return '位置必須在梁長範圍內。';
 if((key==='a'&&value>=row.b)||(key==='b'&&value<=row.a))return '分布載重的終點必須大於起點。';
 if(kind==='axles'&&(key==='p'?value<=0:value<0))return '軸重須大於零，軸距須大於或等於零。';
 if(key==='offset'&&value!==0&&!c.axles.some((a,i)=>i!==index&&a.offset===0))return '至少一軸的距前軸距離須為 0。';
 if(row[key]===value)return '';
 row[key]=value;preset='';$$('[data-preset]').forEach(b=>b.classList.remove('selected'));
 const side=$('.sidebar input[data-kind="'+kind+'"][data-index="'+index+'"][data-key="'+key+'"]');
 if(side&&side!==document.activeElement)side.value=entryValue(value,side.dataset.dimension);
 stale();notice('梁圖已更新，正在更新分析結果。');scheduleLiveAnalysis();
 return '';
}
const liveLoads=installLiveLoads({
 config:()=>c,units:()=>units,length:()=>total(c),stop,
 onSelect:()=>{drawBeam();if(!dirty&&!busy)sectionCursor.refresh();},front:()=>c.direction===1?vehicleTravel():total(c)-vehicleTravel(),seek:seekVehicle,edit:editLiveLoad,
 enableVehicle:selection=>{c.mode='moving';travel=null;editors();liveLoads.selectVehicle(selection);stale();run();}
});
function refreshStepInfo() {
  if (!analysis || c.mode==='static') return;
  const detail = c.mode === 'dynamic' ? `時間步長 ${fmt(analysis.dt,5)} s` : `移動步長 ≤ ${quantity(analysis.step,'m',3)}`;
  $('#stepInfo').textContent = `${detail} · ${analysis.frames.length} ${c.mode === 'dynamic' ? '時刻' : '位置'}`;
}
const peakCards=new Map(components.map(([key])=>[key,$('[data-peak="'+key+'"]')]));
const chartKeys={M:'moment',V:'shear',D:'deflection'};
let displayedPeaks=null;
function clearPeaks(){
 displayedPeaks=null;$('#peakCards').hidden=true;$('#peakScope').textContent='';
 $('#peakEmpty').hidden=false;$('#peakEmpty').textContent='等待更新分析結果';
}
function renderPeaks(fullSweep){
 const peaks=peakSummary(analysis,fullSweep?null:frameIndex);
 displayedPeaks=peaks;
 $('#peakEmpty').hidden=true;$('#peakCards').hidden=false;
 $('#peakScope').textContent=(c.mode==='static'?'靜力':fullSweep?(c.mode==='dynamic'?'全程動力歷時':'全程移動載重'):(c.mode==='dynamic'?'目前時刻':'目前車位'))+' · 按絕對值比較';
 for(const [key,,unit] of components){
   const card=peakCards.get(key),part=name=>card.querySelector('[data-part="'+name+'"]');
   const {min,max,control}=peaks[key],value=control.value,frame=analysis.frames[control.frame];
   const sign=value===0?'':key==='D'?(value<0?'向下':'向上'):(value<0?'負':'正')+(key==='M'?'彎矩':'剪力');
   part('value').textContent=numberOf(Math.abs(value),unit);
   part('unit').textContent=labelOf(unit);part('sense').textContent=sign;
   part('range').textContent='最小 '+numberOf(min.value,unit)+' ／ 最大 '+numberOf(max.value,unit);
   part('section').textContent=value===0?'全梁為零':peakLocation(model,analysis,key,control)+' · x = '+quantity(control.x,'m',3);
   const moving=value!==0&&c.mode!=='static';
   part('frame').hidden=!moving;
   if(moving)part('frame').textContent='前軸 x = '+quantity(c.direction===1?frame.front:model.L-frame.front,'m',3)+(c.mode==='dynamic'?' · t = '+fmt(frame.t,3)+' s':'');
   card.querySelector('button').disabled=value===0;
 }
}
$('#peakCards').addEventListener('click',event=>{
 const button=event.target.closest('.peak-jump');
 if(!button||!displayedPeaks||dirty||busy)return;
 const key=button.closest('[data-peak]').dataset.peak,peak=displayedPeaks[key].control;
 stop();frameIndex=peak.frame;$('#queryX').value=entryValue(peak.x,'m');
 $('[data-result="'+chartKeys[key]+'"]').click();renderResults();
 $('#'+chartKeys[key]+'Chart').closest('.card').scrollIntoView({block:'nearest'});
});
function renderResults(){if(!analysis)return;refreshStepInfo();current=analysis.frames[frameIndex].result;if(c.mode!=='static')travel=analysis.frames[frameIndex].front;liveLoads.sync(document.activeElement);let env=c.mode!=='static'&&$('#showEnvelope').checked?analysis.envelope:null;
 drawBeam();chart('momentChart',current.points,'M','#087a70',env?.rows);chart('shearChart',current.points,'V','#4a75ba',env?.rows);chart('deflectionChart',current.points,'D','#9b75ae',env?.rows);
 renderPeaks(Boolean(env));
 $('#reactionBody').innerHTML=current.reactions.filter(p=>p.type!=='free').map(p=>{let i=current.reactions.indexOf(p),e=analysis.envelope?.R[i];return `<tr><td>${p.label} · ${supportNames[p.type]}</td><td>${numberOf(p.x,'m')}</td><td>${numberOf(p.R,'kN')}</td><td>${numberOf(p.T,'kN·m')}</td><td>${e?numberOf(e.min,'kN'):'—'}</td><td>${e?numberOf(e.max,'kN'):'—'}</td></tr>`;}).join('');
 $('#resultMode').textContent=c.mode==='static'?'靜力':c.mode==='moving'?(env?'移動包絡':'目前位置'):(env?'動力包絡':'目前時刻');
 let frame=analysis.frames[frameIndex];$('#positionLabel').textContent=`前軸 ${quantity(c.direction===1?frame.front:model.L-frame.front,'m')}`;$('#timeLabel').textContent=`t = ${fmt(frame.t,3)} s`;$('#frameRange').value=frameIndex;
 $('#analysisInfo').textContent=`${model.els.length} 個梁元素 · 第一頻率 ${fmt(model.omega/(2*Math.PI),3)} Hz · 求解器平衡殘差（基準單位） ${current.residual.toExponential(1)} kN／kN·m`;
 sectionCursor.refresh();}
function history(){if(!analysis||c.mode==='static')return;let type=$('#historyType').value,isReaction=type.startsWith('R:'),x=readPosition('#probeX');$('#probeX').disabled=isReaction;if(!isReaction&&(!Number.isFinite(x)||x<0||x>model.L)){$('#historyText').textContent='查詢位置超出梁長';return;}let key=isReaction?'R':type,ri=Number(type.split(':')[1]),unit=key==='M'?'kN·m':key==='D'?'mm':'kN',data=analysis.frames.map(f=>({x:f.t,[key]:isReaction?f.result.reactions[ri].R:f.result.at(x)[key]}));chart('historyChart',data,key,key==='V'?'#4a75ba':'#087a70',null,{time:true,end:analysis.frames.at(-1).t});$('#historyText').textContent=`${isReaction?String.fromCharCode(65+ri)+' 支承':('x = '+quantity(x,'m'))} · ${$('#historyType').selectedOptions[0].text}（${labelOf(unit)}），橫軸時間（s）。完整歷時可匯出 CSV。`;}
async function run(goToResults=false){if(busy)return;clearTimeout(autoTimer);autoPending=false;const started=generation;stop();sectionCursor.clear();busy=true;$('#reportBtn').disabled=true;$('#exchangeBtn').disabled=true;$('#runBtn').disabled=true;$('#commandRun').disabled=true;$('#runBtn').textContent='計算中…';$('.sidebar').classList.add('busy');$$('[data-mode]').forEach(b=>b.disabled=true);$('#importBtn').disabled=true;
 try{validate(c);const nextModel=build(clone(c));let nextAnalysis;let progress=p=>{if(started!==generation)throw Error('superseded');$('#runBtn').textContent=`計算中 ${Math.round(p*100)}%`;};if(c.mode==='static'){nextAnalysis={frames:[{t:0,front:0,result:statics(nextModel)}]};}else nextAnalysis=await(c.mode==='moving'?moving(nextModel,progress):dynamic(nextModel,progress));
 if(started!==generation)return;model=nextModel;analysis=nextAnalysis;
 if(!(readPosition('#queryX')>=0&&readPosition('#queryX')<=model.L))$('#queryX').value=entryValue(model.L/2,'m');
 movingSweep=c.mode==='moving'?analysis:null;frameIndex=0;if(c.mode!=='static')selectTravelFrame(vehicleTravel());current=analysis.frames[frameIndex].result;dirty=false;document.body.classList.remove('stale','analysis-invalid');$('#csvBtn').disabled=false;$('#reportBtn').disabled=false;$('#exchangeBtn').disabled=false;$('#printBtn').disabled=false;$('#playback').hidden=c.mode==='static';$('#historyPanel').hidden=c.mode==='static';$('#frameRange').max=analysis.frames.length-1;refreshStepInfo();

 notice(c.mode==='dynamic'?'動力模式：考慮梁的質量與阻尼；車輛採移動力模型，未含車橋耦合。':c.mode==='moving'?'移動包絡採逐位置靜力計算，不含振動慣性效應。':'');persist();arrangePins();if(goToResults===true)selectView('results',true);renderResults();history();
 }catch(e){if(started!==generation)return;clearPeaks();dirty=true;document.body.classList.add('stale','analysis-invalid');notice(e.message,true);$('#csvBtn').disabled=true;$('#reportBtn').disabled=true;$('#exchangeBtn').disabled=true;$('#printBtn').disabled=true;}finally{busy=false;$('#runBtn').disabled=false;$('#commandRun').disabled=false;$('#runBtn').textContent='計算分析';$('.sidebar').classList.remove('busy');$$('[data-mode]').forEach(b=>b.disabled=false);$('#importBtn').disabled=false;if(autoPending)scheduleLiveAnalysis();}}
function stop(){playing=false;cancelAnimationFrame(raf);$('#playBtn').textContent='播放';}
function play(){if(!analysis||dirty)return;if(playing){stop();return;}playing=true;$('#playBtn').textContent='暫停';let last=0;function tick(t){if(!playing)return;if(t-last>70){last=t;frameIndex=(frameIndex+Math.max(1,Math.floor(analysis.frames.length/180)))%analysis.frames.length;renderResults();}raf=requestAnimationFrame(tick);}raf=requestAnimationFrame(tick);}
function download(name,type,data){let a=document.createElement('a'),url=URL.createObjectURL(new Blob([data],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
function csv() {
  if (dirty || !analysis) return;
  let probe = readPosition('#probeX');
  if (!(probe >= 0 && probe <= model.L)) probe = model.L / 2;
  const length = labelOf('m'), force = labelOf('kN'), moment = labelOf('kN·m'), deflection = labelOf('mm');
  const value = (n, dim) => n == null ? '' : units.show(dim, n);
  const section = p => [value(p.V,'kN'), value(p.M,'kN·m'), value(p.D,'mm')];
  const rows = [
    ['BeamLab v1.8', `force ${force}`, `length ${length}`, `mass ${units.prefs.mass}`, `deflection ${deflection}`],
    ['mode', c.mode], ['mesh_elements',model.els.length], ['vehicle_factor',c.factor], ['direction',c.direction],
    ['frequency_Hz',model.omega/(2*Math.PI)], ['time_step_s',analysis.dt ?? ''], ['CURRENT DIAGRAM'],
    [`x_${length}`,`V_${force}`,`M_${moment}`,`D_${deflection}`],
  ];
  current.points.forEach(p => rows.push([value(p.x,'m'), ...section(p)]));
  for(const scope of (analysis.envelope?['CURRENT','FULL SWEEP']:['CURRENT'])){
    const summary=peakSummary(analysis,scope==='CURRENT'?frameIndex:null);
    rows.push([scope+' BEAM PEAKS'],['quantity','unit','max_abs','signed_at_peak','min','max','span_and_side','x_'+length,'frame','front_x_'+length,'time_s']);
    for(const [key,,unit] of components){
      const {control,min,max}=summary[key],f=analysis.frames[control.frame],hasPeak=control.value!==0;
      rows.push([key,labelOf(unit),value(Math.abs(control.value),unit),value(control.value,unit),value(min.value,unit),value(max.value,unit),
        hasPeak?peakLocation(model,analysis,key,control):'',hasPeak?value(control.x,'m'):'',hasPeak?control.frame:'',
        hasPeak&&c.mode!=='static'?value(c.direction===1?f.front:model.L-f.front,'m'):'',hasPeak&&c.mode!=='static'?f.t:'']);
    }
  }
  rows.push(['SUPPORT REACTIONS'],['support',`x_${length}`,`R_${force}`,`T_${moment}`,`Rmin_${force}`,`Rmax_${force}`]);
  current.reactions.forEach((r,i) => {
    const bounds=analysis.envelope?.R[i];
    rows.push([r.label,value(r.x,'m'),value(r.R,'kN'),value(r.T,'kN·m'),value(bounds?.min,'kN'),value(bounds?.max,'kN')]);
  });
  if (analysis.envelope) {
    const keys = ['Vmin','Vmax','Mmin','Mmax','Dmin','Dmax'];
    rows.push(['ENVELOPE'], [`x_${length}`,'side', ...keys.map(k=>`${k}_${labelOf(resultDimensions[k[0]])}`), ...keys.slice(0,4).map(k=>`${k}_front_distance_${length}`)]);
    for (const row of analysis.envelope.rows) {
      const extrema=keys.map(k=>value(row[k],resultDimensions[k[0]]));
      const positions=keys.slice(0,4).map(k=>value(analysis.frames[row[k+'Frame']].front,'m'));
      rows.push([value(row.x,'m'),row.side,...extrema,...positions]);
    }
    rows.push([`TIME HISTORY AT x=${quantity(probe,'m')}`], ['time_s',`front_distance_${length}`,`V_${force}`,`M_${moment}`,`D_${deflection}`,...current.reactions.flatMap(r=>[`R_${r.label}_${force}`,`T_${r.label}_${moment}`])]);
    for (const f of analysis.frames) rows.push([f.t,value(f.front,'m'),...section(f.result.at(probe)),...f.result.reactions.flatMap(r=>[value(r.R,'kN'),value(r.T,'kN·m')])]);
  }
  download('BeamLab_results.csv','text/csv;charset=utf-8','\ufeff'+rows.map(row=>row.join(',')).join('\n'));
  toast('分析結果 CSV 已匯出');
}
function usePreset(name){travel=null;preset=name;c={...clone(base),displayUnits:units.prefs};if(name==='simple'){c.spans=[span(10)];c.supports=['pin','roller'];c.loads=[{type:'line',a:0,b:10,w1:10,w2:10}];}if(name==='cantilever'){c.spans=[span(5)];c.supports=['fixed','free'];c.loads=[{type:'point',x:5,p:50}];}editors();stale();run();}
const isLoadField=el=>['loads','axles'].includes(el.dataset.kind);
$('.sidebar').addEventListener('input',e=>{if(isLoadField(e.target))liveLoads.sidebarInput(e.target);});
$('.sidebar').addEventListener('focusout',e=>{
 const el=e.target;
 if(isLoadField(el)&&el.validity.customError){
   el.value=entryValue(c[el.dataset.kind][Number(el.dataset.index)][el.dataset.key],el.dataset.dimension);
   el.setCustomValidity('');el.removeAttribute('aria-invalid');
 }
});
$('.sidebar').addEventListener('change',e=>{let el=e.target;if(isLoadField(el)){liveLoads.sidebarInput(el);return;}if(el.dataset.kind){c[el.dataset.kind][Number(el.dataset.index)][el.dataset.key]=units.base(el.dataset.dimension,el.valueAsNumber);if(el.value==='')c[el.dataset.kind][Number(el.dataset.index)][el.dataset.key]=NaN;if(el.dataset.kind==='spans'){const s=c.spans[Number(el.dataset.index)];reconcileManualSectionEdit(s,el.dataset.key);reconcileManualSpanEdit(s,el.dataset.key);if(el.dataset.key==='L'||el.dataset.key==='I')editors();else {renderMaterialPickers();renderSectionPickers();}}}else if(el.dataset.support!=null){changeSupport(Number(el.dataset.support),el.value,'sidebar');return;}else if(el.id==='selfWeight')c.selfWeight=el.checked;else if(el.id in c)c[el.id]=el.type==='checkbox'?el.checked:el.id==='step'?units.base('m',el.valueAsNumber):Number(el.value);else return;preset='';$$('[data-preset]').forEach(b=>b.classList.remove('selected'));stale();});
$('.sidebar').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.tab){tab=b.dataset.tab;$$('.config-panel').forEach(p=>p.hidden=p.id!==tab);$$('[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));}if(b.dataset.preset)usePreset(b.dataset.preset);if(b.dataset.addload){if(c.loads.length>=50)return toast('最多 50 筆靜態載重');let type=b.dataset.addload;c.loads.push(type==='line'?{type,a:0,b:total(c),w1:10,w2:10}:{type,x:total(c)/2,p:type==='point'?50:20});editors();stale();}if(b.dataset.delete){let i=Number(b.dataset.index);if(b.dataset.delete==='span'){c.spans.splice(i,1);c.supports.splice(i===0?1:i,1);}if(b.dataset.delete==='load')c.loads.splice(i,1);if(b.dataset.delete==='axle')c.axles.splice(i,1);editors();stale();}});
$('#addSpan').onclick=()=>{if(c.spans.length<maxSpans){c.spans.push(structuredClone(c.spans.at(-1)));c.supports.splice(-1,0,'roller');preset='';editors();stale();}};$('#addAxle').onclick=()=>{if(c.axles.length<12){c.axles.push({p:120,offset:vehicleLength(c)+1.4});editors();stale();}};
$$('[data-mode]').forEach(b=>b.onclick=()=>{travel=null;c.mode=b.dataset.mode;editors();stale();run();});$('#runBtn').onclick=()=>run(true);$('#playBtn').onclick=play;$('#frameRange').oninput=e=>{if(dirty||busy)return;stop();frameIndex=Number(e.target.value);renderResults();};$('#showEnvelope').onchange=()=>{if(!dirty&&!busy)renderResults();};$('#probeX').onchange=history;$('#historyType').onchange=history;$('#csvBtn').onclick=csv;$('#printBtn').onclick=()=>{stop();window.print();};$('#saveBtn').onclick=()=>{try{validate(c);download('BeamLab_model.json','application/json',JSON.stringify(c,null,2));toast('模型 JSON 已匯出');}catch(e){notice(e.message,true);}};$('#importBtn').onclick=()=>$('#fileInput').click();$('#fileInput').onchange=async e=>{try{let f=e.target.files[0];if(!f)return;if(f.size>1000000)throw Error('模型檔案過大');let obj=JSON.parse(await f.text());validate(obj);travel=null;c=obj;preset='';dirty=true;updateUnits(obj.displayUnits || units.prefs);stale();await run();toast('模型已匯入');}catch(err){notice('匯入失敗：'+err.message,true);}e.target.value='';};$('#methodBtn').onclick=()=>$('#methodDialog').showModal();$('#closeMethod').onclick=()=>$('#methodDialog').close();$('#methodDialog').onclick=e=>{if(e.target===$('#methodDialog'))$('#methodDialog').close();};
$('#exchangeBtn').onclick=async()=>{
  if(!model||!analysis||busy||dirty)return;
  stop();
  try{
    const {openExchange}=await import('./exchange-ui.js?v=1.4');
    if(!busy&&!dirty)openExchange(model,analysis,frameIndex,units);
  }catch(err){notice('無法開啟匯出視窗：'+err.message,true);}
};
$('#reportBtn').onclick=async()=>{
  if(!model||!analysis||busy||dirty)return;
  stop();
  try {
    const {openCalculationReport}=await import('./report-ui.js?v=1.10.0');
    if(model&&analysis&&!busy&&!dirty)openCalculationReport(model,analysis,frameIndex,readPosition('#queryX'),units,currentSteelDesign());
  } catch(err) {notice('無法開啟計算報告：'+err.message,true);}
};
function changeSupport(i,type,origin){
 if(busy||!Object.hasOwn(supportNames,type)||!Number.isInteger(i)||i<0||i>=c.supports.length||c.supports[i]===type)return;
 c.supports[i]=type;preset='';editors();stale();
 const selector=origin==='diagram'?'#beamWrap [data-node="'+i+'"]':'#supportList [data-support="'+i+'"]';
 $(selector)?.focus({preventScroll:true});run();
}
const sectionCursor=installSectionCursor({
 getState:()=>({model,current,analysis,frameIndex,dirty,busy,showEnvelope:$('#showEnvelope').checked}),
 quantity,numberOf,labelOf,readX:()=>readPosition('#queryX'),writeX:x=>{$('#queryX').value=entryValue(x,'m');},stop
});
const diagramEditor=installDiagramEditor({
 getConfig:()=>c,quantity,property:(v,u)=>Number(units.show(u,v).toPrecision(7))+' '+labelOf(u),supportNames,openMaterial,openSection,stop,
 ready:()=>{if(busy)toast('分析進行中，完成後即可編輯圖面');return !busy;},
 changeSupport:(i,type)=>changeSupport(i,type,'diagram')
});
function memberChanged(){
 preset='';editors();stale();
 if(diagramEditor.editingSpan())run();
}
installLayoutEditor({getConfig:()=>c,getUnits:()=>units,validate,onApply:next=>{c=next;preset='';editors();stale();run(true);}});
installMaterialEditor({getConfig:()=>c,getUnits:()=>units,onChange:memberChanged});
installSectionEditor({getConfig:()=>c,getUnits:()=>units,onChange:memberChanged});
installWorkspace(() => {drawBeam();if (analysis && !dirty && !busy) {renderResults();history();}});
$('#unitDialog').querySelectorAll('[data-pref]').forEach(el => el.onchange = () => updateUnits({...units.prefs,[el.dataset.pref]:el.value}));
$('#unitsBtn').onclick=()=>$('#unitDialog').showModal();
for (const id of ['#unitDone','#closeUnits']) $(id).onclick=()=>$('#unitDialog').close();
for (const id of ['#queryX','#probeX']) $(id).value=entryValue(5,'m');
$('#commandRun').onclick=()=>run(true);
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !document.querySelector('dialog[open]')) {
    event.preventDefault();
    document.activeElement?.blur();
    run(true);
  }
});
$('#vehicleType').addEventListener('change',event=>{
 event.stopPropagation();stop();c=applyVehicleModel(c,event.target.value);travel=null;if(c.mode==='static'&&event.target.value!=='custom')c.mode='moving';editors();stale();run();
});
installSteelDesign({getConfig:()=>c,getUnits:()=>units,persist,stop});
editors();drawBeam();run();


