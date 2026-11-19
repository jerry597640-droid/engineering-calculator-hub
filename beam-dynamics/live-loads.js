// The inspector and the sidebar both edit the same model, in the current display units.
const names = { point: '集中力', moment: '集中彎矩', line: '分布載重' };
const definitions = {
  point: [['p','集中力','kN'],['x','位置 x','m']],
  moment: [['p','集中彎矩','kN·m'],['x','位置 x','m']],
  line: [['w1','起點強度','kN/m'],['w2','終點強度','kN/m'],['a','起點 x','m'],['b','終點 x','m']],
  axle: [['p','軸重','kN'],['offset','距前軸','m'],['front','前軸位置 x','m']]
};

export function closestFrame(frames, distance) {
  let lo=0, hi=frames.length-1;
  while(lo<hi) {
    const mid=(lo+hi)>>>1;
    if(frames[mid].front<distance) lo=mid+1;
    else hi=mid;
  }
  return lo>0 && distance-frames[lo-1].front<=frames[lo].front-distance ? lo-1 : lo;
}

export function installLiveLoads({config,units,length,front,seek,edit,enableVehicle,onSelect,stop}) {
  const panel=document.getElementById('liveLoads');
  const choice=document.getElementById('liveChoice');
  const fields=document.getElementById('liveFields');
  const feedback=document.getElementById('liveFeedback');
  const beam=document.getElementById('beamWrap');
  const dialog=document.getElementById('loadDialog'),dialogTitle=document.getElementById('loadDialogTitle');
  const home=document.createComment('inline load inspector');
  panel.before(home);
  let previousMode,signature='',anchor=null;
  const loadTarget='[data-load-key]';
  function positionDialog(){
    if(!dialog.open||!anchor||matchMedia('(max-width:600px)').matches)return;
    const margin=10,w=dialog.offsetWidth,h=dialog.offsetHeight;
    const x=anchor.x+w+2*margin<=innerWidth?anchor.x+margin:anchor.x-w-margin;
    dialog.style.left=Math.max(margin,Math.min(innerWidth-w-margin,x))+'px';
    dialog.style.top=Math.max(margin,Math.min(innerHeight-h-margin,anchor.y-h/3))+'px';
  }
  function title(){
    const {kind,index,item}=selection();
    if(!item)return;
    dialogTitle.textContent=kind==='axles'?'調整車輛第 '+(index+1)+' 軸':'調整'+names[item.type]+' · 第 '+(index+1)+' 筆';
  }
  function openFromDiagram(target,event){
    if(!target||dialog.open||![...choice.options].some(o=>o.value===target.dataset.loadKey))return;
    stop();
    const box=target.getBoundingClientRect();
    anchor=event.type==='click'&&event.detail>0?{x:event.clientX,y:event.clientY}:{x:box.left+box.width/2,y:box.top+box.height/2};
    choice.value=target.dataset.loadKey;build();title();
    document.getElementById('loadDialogFields').append(panel);
    dialog.showModal();positionDialog();
    document.getElementById('loadDialogClose').focus({preventScroll:true});
    onSelect();
  }
  for(const eventName of ['pointerdown','focusin']){
    beam.addEventListener(eventName,e=>{if(e.target.closest(loadTarget))stop();});
  }
  beam.addEventListener('click',e=>openFromDiagram(e.target.closest(loadTarget),e));
  beam.addEventListener('keydown',e=>{
    const target=e.target.closest(loadTarget);
    if(target&&['Enter',' '].includes(e.key)){e.preventDefault();if(!e.repeat)openFromDiagram(target,e);}
  });
  document.getElementById('loadDialogClose').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{
    if(e.target!==dialog)return;
    const b=dialog.getBoundingClientRect();
    if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();
  });
  dialog.addEventListener('close',()=>{
    home.after(panel);anchor=null;
    onSelect();
    const target=beam.querySelector('[data-load-key="'+choice.value+'"]')||choice;
    target.focus({preventScroll:true});
  });
  window.addEventListener('resize',positionDialog);
  function selection() {
    const [kind,index]=choice.value.split(':');
    const item=config()[kind]?.[Number(index)];
    return {kind,index:Number(index),item,defs:definitions[kind==='axles'?'axle':item?.type]||[]};
  }
  function bounds(key) {
    const c=config(),L=length();
    if(key==='front') {
      const travel=Math.max(...c.axles.map(a=>a.offset))+(c.mode==='dynamic'?c.speed/3.6*c.tail:0);
      return c.direction===1?[0,L+travel]:[-travel,L];
    }
    return [0,L];
  }
  function sync(source=null) {
    const {item,defs}=selection();
    if(!item){document.getElementById('liveAxles').hidden=true;return;}
    const u=units();
    const c=config(),readout=document.getElementById('liveAxles');
    readout.hidden=c.mode==='static';
    if(!readout.hidden){
      const xf=front(),L=length();
      readout.textContent=c.axles.map((a,i)=>{
        const x=xf-c.direction*a.offset;
        const label='第 '+(i+1)+' 軸';
        return x<-.00000001||x>L+.00000001?label+' 在梁外':label+' x = '+Number(u.show('m',x).toFixed(3))+' '+u.label('m')+' · '+Number(u.show('kN',a.p*c.factor).toFixed(2))+' '+u.label('kN');
      }).join('　｜　');
    }
    for(const [key,,dim] of defs){
      const value=key==='front'?front():item[key];
      for(const field of fields.querySelectorAll('[data-key="'+key+'"]')){
        if(field===source)continue;
        const display=Number(u.show(dim,value).toPrecision(12));
        if(field.type==='range'){
          const [a,b]=bounds(key);
          field.min=u.show(dim,a);field.max=u.show(dim,b);
          field.step='any';
        }
        field.value=display;
      }
    }
  }
  function refresh() {
    const c=config(),preferred=choice.value;
    const options=[
      ...(!c.loads.length&&c.mode==='static'?[['','尚無靜態載重']]:[]),
      ...c.loads.map((l,i)=>['loads:'+i,(i+1)+' · '+names[l.type]]),
      ...c.axles.map((a,i)=>['axles:'+i,'車輛第 '+(i+1)+' 軸'+(c.mode==='static'?'（移動分析）':'')])
    ];
    choice.replaceChildren(...options.map(([value,label])=>new Option(label,value)));
    const changedMode=c.mode!==previousMode;
    if(changedMode && c.mode!=='static')choice.value=options.find(o=>o[0].startsWith('axles:'))[0];
    else if((!changedMode||!preferred.startsWith('axles:'))&&options.some(o=>o[0]===preferred))choice.value=preferred;
    else if(c.mode==='static')choice.value=options.find(o=>o[0]==='loads:'+c.loads.findIndex(l=>l.type==='point'))?.[0]??options[0][0];
    previousMode=c.mode;
    build();
  }
  function build() {
    const {defs,kind}=selection();
    const u=units();
    const next=choice.value+'|'+defs.map(d=>d[0]+u.label(d[2])).join('|')+'|'+config().mode;
    if(next!==signature){
      signature=next;
      fields.replaceChildren();
      for(const [key,title,dim] of defs){
        const label=document.createElement('label'),caption=document.createElement('span');
        const input=document.createElement('input');
        caption.textContent=title+' ('+u.label(dim)+')';
        input.type='number';input.step='any';input.dataset.key=key;input.setAttribute('aria-label','圖面'+caption.textContent);
        label.append(caption,input);fields.append(label);
        if(['x','a','b','front'].includes(key)){
          const slider=document.createElement('input');
          slider.type='range';slider.dataset.key=key;slider.setAttribute('aria-label','拖動'+title);
          label.append(slider);label.classList.add('live-position');
        }
      }
      const hint=document.getElementById('liveModeHint');
      hint.hidden=kind!=='axles';
      hint.textContent=config().mode==='dynamic'?'前軸座標由梁左端起算，動力結果取最近的已計算時刻。':'前軸座標由梁左端起算。';
      feedback.textContent='';
    }
    sync();
    if(dialog.open){title();positionDialog();}
  }
  choice.addEventListener('change',()=>{
    if(selection().kind==='axles' && config().mode==='static')enableVehicle(choice.value);
    else {build();onSelect();}
  });
  function selectVehicle(value) {
    if([...choice.options].some(o=>o.value===value)){choice.value=value;build();}
  }
  function changed(el,sidebar) {
    const selected=selection();
    const {kind,index}=sidebar?{kind:el.dataset.kind,index:Number(el.dataset.index)}:selected;
    const key=el.dataset.key;
    const dim=sidebar?el.dataset.dimension:selected.defs.find(d=>d[0]===key)?.[2];
    if(!dim)return;
    const n=units().base(dim,el.valueAsNumber);
    let error='';
    if(!Number.isFinite(n))error='請輸入完整數值。';
    else if(key==='front'){
      const [min,max]=bounds(key);
      if(n<min||n>max)error='前軸座標超出車輛行程。';
      else seek(n);
    }else error=edit(kind,index,key,n)||'';
    el.setCustomValidity(error);
    el.setAttribute('aria-invalid',String(!!error));
    feedback.textContent=error;
    if(!error)sync(el);
  }
  panel.addEventListener('input',e=>{if(e.target.matches('input[data-key]'))changed(e.target,false);});
  function finish(el) {
    if(el.validity?.customError){
      el.setCustomValidity('');el.removeAttribute('aria-invalid');feedback.textContent='已保留上一個有效值。';
    }
    sync();
  }
  fields.addEventListener('focusout',e=>{if(e.target.matches('input[data-key]'))finish(e.target);});
  return {refresh,sync,selectVehicle,sidebarInput:el=>changed(el,true)};
}

// Retain the original sweep and add at most one exact user-selected moving-load station.
export function movingAtDistance(sweep,model,distance,solveStatic) {
  const frames=sweep.frames, near=closestFrame(frames,distance);
  if(Math.abs(frames[near].front-distance)<1e-10)return {analysis:sweep,index:near};
  const index=frames[near].front<distance?near+1:near;
  const result=solveStatic(model,distance);
  const frame={front:distance,t:distance/(model.c.speed/3.6),result};
  const nextFrames=frames.slice();nextFrames.splice(index,0,frame);
  const shift=i=>i>=index?i+1:i;
  const rows=sweep.envelope.rows.map(row=>{
    const updated={...row},response=result.at(row.x,row.side);
    for(const key of ['M','V','D']){
      for(const bound of ['min','max']){
        const name=key+bound,frameKey=name+'Frame';
        updated[frameKey]=shift(row[frameKey]);
        if(bound==='min'?response[key]<row[name]:response[key]>row[name]){
          updated[name]=response[key];updated[frameKey]=index;
        }
      }
    }
    return updated;
  });
  const R=sweep.envelope.R.map((r,i)=>{
    const value=result.reactions[i].R;
    return {min:Math.min(r.min,value),max:Math.max(r.max,value),
      tmin:value<r.min?index:shift(r.tmin),tmax:value>r.max?index:shift(r.tmax)};
  });
  return {analysis:{...sweep,frames:nextFrames,envelope:{rows,R}},index};
}
