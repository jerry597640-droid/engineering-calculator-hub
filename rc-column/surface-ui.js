/* Offline Canvas 3D viewer. Drawing never changes section-strength checks. */
let pm3dModel=null,pm3dKey='',pm3dJob=null,pm3dEpoch=0,pm3dFrame=0,pm3dYaw=-.72,pm3dPitch=.42,pm3dZoom=1,pm3dHits=[],pm3dPointers=new Map(),pm3dMoved=false,pm3dStale=false;
const pm3dCanvas=$('pm3dCanvas'),pm3dContext=pm3dCanvas.getContext('2d');
function pm3dQuality(){return $('pm3dQuality').value==='high'?{levels:44,angles:120}:{levels:28,angles:60};}
function clearSurface3D(message='輸入無效，3D圖已清除。'){
 pm3dEpoch++;pm3dStale=true;pm3dJob=null;pm3dModel=null;pm3dKey='';pm3dHits=[];$('pm3dReadout').textContent='';$('pm3dCaption').textContent='';$('pm3dStatus').textContent=message;$('pm3dPNG').disabled=true;$('pm3dProgress').hidden=true;paintSurface3D();
}
function pauseSurface3D(){pm3dStale=true;pm3dEpoch++;pm3dJob=null;if(!pm3dModel)pm3dKey='';$('pm3dPNG').disabled=true;$('pm3dProgress').hidden=true;$('pm3dReadout').textContent='';$('pm3dStatus').textContent='輸入正在變更，等待重新計算。';queueSurface3D();}
function updateSurface3D(){
 if(!result){clearSurface3D();return;}
 pm3dStale=false;const opt=pm3dQuality(),key=RCSurface.key(result.s,opt.levels,opt.angles);
 $('pm3dCase').innerHTML=result.cases.map((c,i)=>'<option value="'+i+'" '+(i===selected?'selected':'')+'>'+esc(c.load.name)+'</option>').join('');
 if(key===pm3dKey){if(pm3dModel){$('pm3dPNG').disabled=false;$('pm3dStatus').textContent='設計強度曲面：'+(pm3dModel.levels+1)+'個軸力層 × '+pm3dModel.angles+'個法向角；φPn,max '+fmt(pm3dModel.Pmax,2)+' tf。';queueSurface3D();}return;}
 const epoch=++pm3dEpoch;pm3dKey=key;pm3dModel=null;pm3dHits=[];$('pm3dPNG').disabled=true;$('pm3dProgress').hidden=false;$('pm3dProgress').value=0;$('pm3dStatus').textContent='正在建立設計強度曲面…';
 pm3dJob=RCSurface.generate(RCC,result.s,opt);queueSurface3D();
 const step=()=>{
  if(epoch!==pm3dEpoch)return;
  try{const start=performance.now();let next;do{next=pm3dJob.next();if(next.done)break;$('pm3dProgress').value=next.value.progress;}while(performance.now()-start<18);
   if(next.done){pm3dModel=next.value;pm3dJob=null;$('pm3dProgress').hidden=true;$('pm3dPNG').disabled=false;$('pm3dStatus').textContent='設計強度曲面：'+(opt.levels+1)+'個軸力層 × '+opt.angles+'個法向角；φPn,max '+fmt(pm3dModel.Pmax,2)+' tf。';queueSurface3D();}
   else setTimeout(step,0);
  }catch(e){clearSurface3D('無法繪製3D圖：'+e.message);}
 };setTimeout(step,0);
}
function queueSurface3D(){if(pm3dFrame)return;pm3dFrame=requestAnimationFrame(()=>{pm3dFrame=0;paintSurface3D();});}
function paintSurface3D(){
 const box=pm3dCanvas.getBoundingClientRect(),width=Math.max(250,box.width||800),height=width<500?350:520,dpr=Math.min(2,devicePixelRatio||1);
 pm3dCanvas.style.height=height+'px';if(pm3dCanvas.width!==Math.round(width*dpr)||pm3dCanvas.height!==Math.round(height*dpr)){pm3dCanvas.width=Math.round(width*dpr);pm3dCanvas.height=Math.round(height*dpr);}
 const ctx=pm3dContext;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle='#f8fbff';ctx.fillRect(0,0,width,height);pm3dHits=[];
 if(!pm3dModel||!result||pm3dStale){ctx.fillStyle='#61738a';ctx.font='14px system-ui';ctx.textAlign='center';ctx.fillText(pm3dJob?'正在建立容量曲面…':pm3dStale&&result?'等待重新計算…':'請填入有效斷面與主筋資料。',width/2,height/2);return;}
 const model=pm3dModel,c=result.cases[selected],visible=$('pm3dAll').checked?result.cases:[c],vertices=model.rings.flat(),all=[...vertices,...visible.map(v=>({mx:v.load.Mx,my:v.load.My,P:v.load.P}))];
 const mmax=Math.max(1,...all.map(v=>Math.max(Math.abs(v.mx),Math.abs(v.my))))*1.12,pmin=Math.min(-model.Tmax,...visible.map(v=>v.load.P)),pmax=Math.max(model.Pmax,...visible.map(v=>v.load.P)),prange=Math.max(1,pmax-pmin),pcenter=(pmax+pmin)/2,scale=Math.min(width/(width<500?3.1:3.9),height/3.4)*pm3dZoom;
 const cy=Math.cos(pm3dYaw),sy=Math.sin(pm3dYaw),cp=Math.cos(pm3dPitch),sp=Math.sin(pm3dPitch);
 const project=p=>{const x=p.mx/mmax,y=p.my/mmax,z=(p.P-pcenter)/prange*2,u=cy*x-sy*y,v=sy*x+cy*y;return {x:width/2+scale*u,y:height/2+12-scale*(cp*z-sp*v),depth:cp*v+sp*z};};
 const path=(ps,color,line,width_=1,dash=[])=>{ctx.beginPath();ps.forEach((p,i)=>{const q=project(p);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y)});if(color){ctx.closePath();ctx.fillStyle=color;ctx.fill();}if(line){ctx.strokeStyle=line;ctx.lineWidth=width_;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);}};
 const label=(p,text,color='#48617e',align='center',dx=0,dy=0)=>{const q=project(p);ctx.font='12px system-ui';ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(text,q.x+dx,q.y+dy);};
 const base=pmin;
 for(const k of [-1,-.5,0,.5,1]){path([{mx:-mmax,my:k*mmax,P:base},{mx:mmax,my:k*mmax,P:base}],null,'#d8e2ed');path([{mx:k*mmax,my:-mmax,P:base},{mx:k*mmax,my:mmax,P:base}],null,'#d8e2ed');}
 const faces=[];
 if($('pm3dStyle').value==='surface'){
  for(let j=0;j<model.levels;j++)for(let i=0;i<model.angles;i++){const k=(i+1)%model.angles,ps=[model.rings[j][i],model.rings[j][k],model.rings[j+1][k],model.rings[j+1][i]],t=j/model.levels;faces.push({ps,depth:ps.reduce((a,p)=>a+project(p).depth,0)/4,color:'hsla('+(218-35*t)+',60%,'+(60-12*t)+'%,.37)'});}
  const top=model.rings[model.levels];faces.push({ps:top,depth:top.reduce((a,p)=>a+project(p).depth,0)/top.length,color:'rgba(33,133,146,.45)'});faces.sort((a,b)=>a.depth-b.depth);faces.forEach(f=>path(f.ps,f.color,null));
 }
 for(let j=1;j<=model.levels;j++)if(j%2===0||j===model.levels){const ring=model.rings[j];path([...ring,ring[0]],null,'#3977a575',.65);}
 for(let i=0;i<model.angles;i+=Math.max(1,Math.floor(model.angles/20)))path(model.rings.map(r=>r[i]),null,'#3977a585',.7);
 path([{mx:-mmax,my:0,P:base},{mx:mmax,my:0,P:base}],null,'#cb6658',1.4);path([{mx:0,my:-mmax,P:base},{mx:0,my:mmax,P:base}],null,'#40927c',1.4);path([{mx:0,my:0,P:pmin},{mx:0,my:0,P:pmax}],null,'#516ca8',1.4);
 for(const k of [-1,1]){label({mx:k*mmax,my:0,P:base},fmt(k*mmax,0),'#ac5046','center',0,14);label({mx:0,my:k*mmax,P:base},fmt(k*mmax,0),'#27816c','center',0,14);}
 label({mx:mmax*1.13,my:0,P:base},'Mx (tf·m)','#ac5046','center',0,-14);label({mx:0,my:mmax*1.13,P:base},'My (tf·m)','#27816c','center',0,-14);
 for(const P of [pmin,0,pmax]){if(P<pmin||P>pmax)continue;label({mx:0,my:0,P},'P='+fmt(P,0),'#47659b','left',8,P===pmin?14:-5);}
 label({mx:0,my:0,P:pmax+prange*.08},'P (tf)','#47659b');
 if($('pm3dSlice').checked&&c.envelope.length){const ring=c.envelope.map(v=>({mx:v.mx,my:v.my,P:c.load.P}));if(ring.length>1)path([...ring,ring[0]],null,'#9450b7',2.4);else {const q=project(ring[0]);ctx.beginPath();ctx.arc(q.x,q.y,4,0,Math.PI*2);ctx.fillStyle='#9450b7';ctx.fill();}}
 const dots=visible.map(v=>({v,q:project({mx:v.load.Mx,my:v.load.My,P:v.load.P})})).sort((a,b)=>a.q.depth-b.q.depth);
 for(const {v,q} of dots){const p={mx:v.load.Mx,my:v.load.My,P:v.load.P};path([{...p,P:base},p],null,v.pass?'#18775690':'#b4424290',1,[4,4]);ctx.beginPath();ctx.arc(q.x,q.y,v===c?7:5,0,Math.PI*2);ctx.fillStyle=v.pass?'#187756':'#c34242';ctx.fill();ctx.strokeStyle=v===c?'#112136':'#fff';ctx.lineWidth=v===c?2:1.5;ctx.stroke();pm3dHits.push({x:q.x,y:q.y,case:result.cases.indexOf(v),point:p});}
 ctx.font='12px system-ui';ctx.textAlign='left';ctx.fillStyle='#61738a';ctx.fillText('設計強度 φPn–φMnx–φMny',14,24);ctx.fillText('各軸依範圍縮放；數值單位如軸標',14,height-16);
 $('pm3dReadout').textContent=c.load.name+'：Pu '+fmt(c.load.P,2)+' tf；Mx '+fmt(c.load.Mx,2)+'、My '+fmt(c.load.My,2)+' tf·m；彎矩／軸力 '+(c.pass?'容量內':'容量外')+'；D/C '+fmt(c.ratio,4)+'。';
 $('pm3dCaption').textContent='紫色輪廓為目前 Pu='+fmt(c.load.P,2)+' tf 的精確檢核切片；'+(c.envelope.length?'':'本Pu無可用輪廓。')+'綠／紅點僅表示軸力與彎矩是否符合，剪力及配置細則另看檢核表。';
}
function pm3dReset(view='iso'){pm3dYaw=view==='top'?0:view==='x'?0:view==='y'?Math.PI/2:-.72;pm3dPitch=view==='top'?Math.PI/2:view==='iso'?.42:0;pm3dZoom=1;queueSurface3D();}
function pm3dHit(x,y){const q=pm3dHits.filter(p=>Math.hypot(p.x-x,p.y-y)<20).sort((a,b)=>Math.hypot(a.x-x,a.y-y)-Math.hypot(b.x-x,b.y-y))[0];if(q){selected=q.case;render();}}
pm3dCanvas.addEventListener('pointerdown',e=>{if(e.button&&e.pointerType==='mouse')return;pm3dCanvas.setPointerCapture(e.pointerId);pm3dPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});pm3dMoved=false;});
pm3dCanvas.addEventListener('pointermove',e=>{const last=pm3dPointers.get(e.pointerId);if(!last)return;const dx=e.clientX-last.x,dy=e.clientY-last.y;if(Math.abs(dx)+Math.abs(dy)>1)pm3dMoved=true;if(pm3dPointers.size===1){pm3dYaw+=dx*.009;pm3dPitch=Math.max(-1.5,Math.min(1.5,pm3dPitch+dy*.009));}else {const other=[...pm3dPointers.entries()].find(([id])=>id!==e.pointerId)[1],before=Math.hypot(last.x-other.x,last.y-other.y),after=Math.hypot(e.clientX-other.x,e.clientY-other.y);if(before>1)pm3dZoom=Math.max(.45,Math.min(2.5,pm3dZoom*after/before));}pm3dPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});queueSurface3D();});
for(const event of ['pointerup','pointercancel','lostpointercapture'])pm3dCanvas.addEventListener(event,e=>{if(event==='pointerup'&&!pm3dMoved&&pm3dPointers.size===1){const box=pm3dCanvas.getBoundingClientRect();pm3dHit(e.clientX-box.left,e.clientY-box.top);}pm3dPointers.delete(e.pointerId);});
pm3dCanvas.addEventListener('wheel',e=>{e.preventDefault();pm3dZoom=Math.max(.45,Math.min(2.5,pm3dZoom*Math.exp(-e.deltaY*.001)));queueSurface3D();},{passive:false});
pm3dCanvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','0'].includes(e.key))return;e.preventDefault();if(e.key==='0')return pm3dReset();if(e.key==='+'||e.key==='-')pm3dZoom=Math.max(.45,Math.min(2.5,pm3dZoom*(e.key==='+'?1.1:1/1.1)));else if(e.key.includes('Left')||e.key.includes('Right'))pm3dYaw+=e.key==='ArrowRight'?.1:-.1;else pm3dPitch=Math.max(-1.5,Math.min(1.5,pm3dPitch+(e.key==='ArrowDown'?.1:-.1)));queueSurface3D();});
$('pm3dCase').onchange=()=>{selected=Number($('pm3dCase').value);render();};$('pm3dQuality').onchange=updateSurface3D;$('pm3dView').onchange=()=>pm3dReset($('pm3dView').value);$('pm3dReset').onclick=()=>{$('pm3dView').value='iso';pm3dReset();};
for(const id of ['pm3dStyle','pm3dAll','pm3dSlice'])$(id).onchange=queueSurface3D;
$('pm3dPlus').onclick=()=>{pm3dZoom=Math.min(2.5,pm3dZoom*1.15);queueSurface3D();};$('pm3dMinus').onclick=()=>{pm3dZoom=Math.max(.45,pm3dZoom/1.15);queueSurface3D();};
$('pm3dPNG').onclick=()=>{if(!pm3dModel)return;paintSurface3D();const a=document.createElement('a');a.href=pm3dCanvas.toDataURL('image/png');a.download='RC柱_3D_P-M互制圖.png';a.click();};
new ResizeObserver(queueSurface3D).observe(pm3dCanvas.parentElement);
