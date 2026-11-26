/* RC column graphical coordinate editor. No capacity formulas here. */
let dragSelected=0,dragState=null,dragUndo=null,dragUndoAfter='';
const copyBarRows=()=>customRows.map(r=>({...r}));
function dragGeometry(){
  const s=read();
  if(s.layout!=='custom'||!Number.isFinite(s.b)||!Number.isFinite(s.h)||s.b<=0||s.h<=0||!Number.isFinite(s.cover)||!RCC.BARS[s.tie]||!customRows.length)return null;
  if(customRows.some(r=>!RCC.BARS[r.bar]||!Number.isInteger(r.n)||r.n<1||r.n>50||['x1','y1'].concat(r.n>1?['x2','y2']:[]).some(k=>!Number.isFinite(r[k]))))return null;
  const count=customRows.reduce((a,r)=>a+r.n,0);if(count>200)return null;
  return {s,g:RCC.geometry(s),scale:330/Math.max(s.b,s.h),ox:240,oy:235};
}
function dragCoordinates(e,svg,v){
  const matrix=svg.getScreenCTM();if(!matrix)return null;
  const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
  return {x:(p.x-v.ox)/v.scale+v.s.b/2,y:(v.oy-p.y)/v.scale+v.s.h/2,sx:p.x,sy:p.y};
}
function flattenedBars(v){return v.g.bars.map(p=>({bar:p.bar,...(p.layer?{layer:p.layer}:{}),n:1,x1:Number((p.x+v.s.b/2).toFixed(8)),y1:Number((p.y+v.s.h/2).toFixed(8)),x2:Number((p.x+v.s.b/2).toFixed(8)),y2:Number((p.y+v.s.h/2).toFixed(8))}));}
function rememberGraphicEdit(before){dragUndo=before;dragUndoAfter=JSON.stringify(customRows);$('undoDrag').disabled=false;}
function updateDragInfo(v=dragGeometry()){
  if(!v)return;
  const p=v.g.bars[dragSelected];if(!p)return;
  $('dragInfo').textContent='第 '+(dragSelected+1)+' 根 '+p.bar+' · X '+fmt(p.x+v.s.b/2,2)+' / Y '+fmt(p.y+v.s.h/2,2)+' cm';
}
function drawDragEditor(){
  if(dragState)return;updateLayerSummary();
  const v=dragGeometry();$('undoDrag').disabled=!dragUndo||dragUndoAfter!==JSON.stringify(customRows);
  $('expandBars').disabled=!v||!customRows.some(r=>r.n>1);
  if(!v){$('dragCanvas').innerHTML='<p class="help" style="padding:16px">請先填入有效柱尺寸、筋徑、整數根數及座標，以顯示拖曳圖。</p>';$('dragBarSelect').innerHTML='';$('dragInfo').textContent='';return;}
  dragSelected=Math.min(Math.max(0,dragSelected),v.g.bars.length-1);
  const {s,g,scale,ox,oy}=v,X=x=>ox+(x-s.b/2)*scale,Y=y=>oy-(y-s.h/2)*scale;
  const left=X(0),right=X(s.b),top=Y(s.h),bottom=Y(0),tie=s.cover+g.dt/2;
  let svg='<svg id="dragSvg" viewBox="0 0 480 470" tabindex="0" role="application" aria-label="主筋位置編輯圖；按住橙色主筋拖曳，方向鍵移動選取主筋，Esc取消拖曳"><defs><pattern id="dragGrid" width="'+(scale*5)+'" height="'+(scale*5)+'" x="'+left+'" y="'+top+'" patternUnits="userSpaceOnUse"><path d="M '+(scale*5)+' 0 L 0 0 0 '+(scale*5)+'" stroke="#dce7f1" fill="none" stroke-width=".7"/></pattern></defs><rect width="480" height="470" fill="#f8fbfe"/><rect x="'+left+'" y="'+top+'" width="'+(s.b*scale)+'" height="'+(s.h*scale)+'" fill="url(#dragGrid)" stroke="#617b96" stroke-width="1.5"/><rect x="'+X(tie)+'" y="'+Y(s.h-tie)+'" width="'+((s.b-2*tie)*scale)+'" height="'+((s.h-2*tie)*scale)+'" fill="none" stroke="#2465b4" stroke-width="2"/>';
  const p=g.bars[dragSelected],px=X(p.x+s.b/2),py=Y(p.y+s.h/2);
  svg+='<g stroke="#2465b4" stroke-width="1" stroke-dasharray="4 4" pointer-events="none"><line id="dragCrossX" x1="'+px+'" x2="'+px+'" y1="'+top+'" y2="'+bottom+'"/><line id="dragCrossY" x1="'+left+'" x2="'+right+'" y1="'+py+'" y2="'+py+'"/></g>';
  g.bars.forEach((bar,i)=>{const x=X(bar.x+s.b/2),y=Y(bar.y+s.h/2),r=Math.max(4,bar.d*scale/2),active=i===dragSelected;
    svg+='<g data-dragbar="'+i+'" transform="translate('+x+' '+y+')"><circle r="'+Math.max(14,r+6)+'" fill="transparent"/><circle r="'+r+'" fill="'+(active?'#2465b4':layerColor(bar.layer))+'" stroke="'+(active?'#0f3e72':'white')+'" stroke-width="'+(active?2:1)+'"/><text y="'+(-r-5)+'" text-anchor="middle" font-size="10" fill="#354b65" pointer-events="none">'+(i+1)+'</text><title>第'+(i+1)+'根 '+bar.bar+'；X '+fmt(bar.x+s.b/2)+'，Y '+fmt(bar.y+s.h/2)+' cm</title></g>';});
  svg+='<g fill="#354b65" font-size="13" font-family="system-ui"><text x="240" y="35" text-anchor="middle">b = '+s.b+' cm</text><text x="24" y="235" text-anchor="middle" transform="rotate(-90 24 235)">h = '+s.h+' cm</text><text x="'+left+'" y="'+(bottom+25)+'">(0, 0) 左下角</text><text x="'+right+'" y="'+(bottom+25)+'" text-anchor="end">X → / Y ↑</text><text x="240" y="450" text-anchor="middle">主筋圓點可拖曳 · 藍色為選取筋及外框箍</text></g></svg>';
  $('dragCanvas').innerHTML=svg;
  $('dragBarSelect').innerHTML=g.bars.map((b,i)=>'<option value="'+i+'" '+(i===dragSelected?'selected':'')+'>第 '+(i+1)+' 根 · '+(b.layer?'L'+b.layer+' · ':'')+b.bar+'</option>').join('');updateDragInfo(v);
  const root=$('dragSvg');root.onpointerdown=startBarDrag;root.onpointermove=moveBarDrag;root.onpointerup=e=>finishBarDrag(e,false);root.onpointercancel=e=>finishBarDrag(e,true);root.onlostpointercapture=e=>{if(dragState&&e.pointerId===dragState.id)finishBarDrag(e,true);};root.onkeydown=keyBarMove;
}
function clearGraphicResults(){
  result=null;clearSurface3D('主筋位置編輯中，放開後重建3D圖。');clearTimeout(timer);invalidateDesign();$('error').classList.add('hidden');
  for(const k of ['sectionSvg','chartSvg','checks','caseResults','calculation','sectionMini'])$(k).innerHTML='';
  $('resultSummary').innerHTML='<div class="status-card pending"><strong>主筋位置編輯中</strong>放開後依更新座標重算，請勿使用前一配置的結果。</div>';
  $('scopeNotice').textContent='主筋位置編輯中，放開後重新檢核。';
}
function startBarDrag(e){
  if(dragState||e.button!==0)return;
  const v=dragGeometry(),svg=e.currentTarget;if(!v)return;
  const q=dragCoordinates(e,svg,v);if(!q)return;
  let nearest=-1,distance=Infinity;
  const matrix=svg.getScreenCTM(),pixelScale=Math.hypot(matrix.a,matrix.b);
  v.g.bars.forEach((p,i)=>{const d=Math.hypot(q.sx-(v.ox+p.x*v.scale),q.sy-(v.oy-p.y*v.scale));if(d<distance){distance=d;nearest=i;}});
  if(nearest<0||distance*pixelScale>24)return;
  const p=v.g.bars[nearest],min=v.s.cover+v.g.dt+p.d/2;
  if(min>Math.min(v.s.b,v.s.h)/2){$('dragMessage').textContent='目前柱尺寸無法容納這個筋徑，請先修正尺寸或保護層。';return;}
  e.preventDefault();dragSelected=nearest;
  dragState={id:e.pointerId,svg,v,before:copyBarRows(),offsetX:q.x-(p.x+v.s.b/2),offsetY:q.y-(p.y+v.s.h/2),min,changed:false};
  if(customRows.some(r=>r.n>1)){customRows=flattenedBars(v);barEditor();$('dragMessage').textContent='整排配置已展開為逐根；其餘鋼筋位置保持相同。';}
  for(const id of ['undoDrag','expandBars','dragBarSelect','dragSnap'])$(id).disabled=true;
  svg.setPointerCapture(e.pointerId);svg.classList.add('dragging');svg.focus({preventScroll:true});clearGraphicResults();
  for(const el of svg.querySelectorAll('[data-dragbar]')){const active=Number(el.dataset.dragbar)===nearest,c=el.querySelectorAll('circle')[1];c.setAttribute('fill',active?'#2465b4':layerColor(v.g.bars[Number(el.dataset.dragbar)].layer));c.setAttribute('stroke',active?'#0f3e72':'white');}
  $('dragBarSelect').value=String(nearest);updateDragInfo(v);
}
function clampedDragPosition(x,y,v,min){
  const step=Number($('dragSnap').value)||.01;
  const snap=a=>Math.round(a/step)*step;
  return {x:Number(Math.max(min,Math.min(v.s.b-min,snap(x))).toFixed(8)),y:Number(Math.max(min,Math.min(v.s.h-min,snap(y))).toFixed(8))};
}
function moveBarDrag(e){
  const d=dragState;if(!d||e.pointerId!==d.id)return;
  e.preventDefault();const q=dragCoordinates(e,d.svg,d.v);if(!q)return;
  const p=clampedDragPosition(q.x-d.offsetX,q.y-d.offsetY,d.v,d.min),r=customRows[dragSelected];if(!r||r.n!==1)return;
  d.changed||=r.x1!==p.x||r.y1!==p.y;r.x1=r.x2=p.x;r.y1=r.y2=p.y;
  const x=d.v.ox+(p.x-d.v.s.b/2)*d.v.scale,y=d.v.oy-(p.y-d.v.s.h/2)*d.v.scale;
  d.svg.querySelector('[data-dragbar="'+dragSelected+'"]').setAttribute('transform','translate('+x+' '+y+')');
  $('dragCrossX').setAttribute('x1',x);$('dragCrossX').setAttribute('x2',x);$('dragCrossY').setAttribute('y1',y);$('dragCrossY').setAttribute('y2',y);
  for(const key of ['x1','x2','y1','y2']){const input=$('customBarEditor').querySelector('[data-row="'+dragSelected+'"][data-key="'+key+'"]');if(input)input.value=r[key];}
  $('dragInfo').textContent='第 '+(dragSelected+1)+' 根 '+r.bar+' · X '+fmt(p.x,2)+' / Y '+fmt(p.y,2)+' cm';
}
function finishBarDrag(e,cancel){
  const d=dragState;if(!d||e.pointerId!==d.id)return;
  dragState=null;if(d.svg.hasPointerCapture(d.id))d.svg.releasePointerCapture(d.id);
  $('dragBarSelect').disabled=false;$('dragSnap').disabled=false;
  if(cancel){customRows=d.before;$('dragMessage').textContent='已取消本次拖曳，座標已還原。';}
  else if(JSON.stringify(customRows)!==JSON.stringify(d.before)){rememberGraphicEdit(d.before);$('supported').checked=false;$('dragMessage').textContent='位置已更新；請重新核對側撐與有效深度。';}
  barEditor();recalc();
}
function keyBarMove(e){
  if(e.key==='Escape'&&dragState){e.preventDefault();finishBarDrag({pointerId:dragState.id},true);return;}
  const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]}[e.key];if(!delta||dragState)return;
  const v=dragGeometry();if(!v)return;e.preventDefault();
  const before=copyBarRows(),p=v.g.bars[dragSelected],min=v.s.cover+v.g.dt+p.d/2;
  if(min>Math.min(v.s.b,v.s.h)/2)return;
  if(customRows.some(r=>r.n>1))customRows=flattenedBars(v);
  const step=(Number($('dragSnap').value)||.1)*(e.shiftKey?10:1),q=clampedDragPosition(p.x+v.s.b/2+delta[0]*step,p.y+v.s.h/2+delta[1]*step,v,min),r=customRows[dragSelected];
  r.x1=r.x2=q.x;r.y1=r.y2=q.y;rememberGraphicEdit(before);$('supported').checked=false;barEditor();recalc();$('dragSvg')?.focus({preventScroll:true});
}
$('dragBarSelect').onchange=()=>{dragSelected=Number($('dragBarSelect').value);drawDragEditor();};
$('expandBars').onclick=()=>{const v=dragGeometry();if(!v||!customRows.some(r=>r.n>1))return;const before=copyBarRows();customRows=flattenedBars(v);rememberGraphicEdit(before);barEditor();recalc();$('dragMessage').textContent='已展開為逐根，根數、筋徑與位置保持相同。';};
$('undoDrag').onclick=()=>{if(!dragUndo||dragUndoAfter!==JSON.stringify(customRows))return;customRows=dragUndo;dragUndo=null;dragUndoAfter='';$('supported').checked=false;barEditor();recalc();$('dragMessage').textContent='已復原上次圖形操作；請重新核對側撐。';};
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&dragState){e.preventDefault();finishBarDrag({pointerId:dragState.id},true);}});

