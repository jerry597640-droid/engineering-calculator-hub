const supportDescription={
  pin:'固定水平、垂直位移，可轉動',
  roller:'可沿梁向滑移、可轉動',
  fixed:'固定位移及轉角',
  free:'解除此節點的支承約束'
};
const supportIcons={
  pin:'<path d="m16 7-9 13h18zM4 24h24"/>',
  roller:'<path d="m16 4-8 12h16zM4 26h24"/><circle cx="11" cy="20" r="2.4"/><circle cx="21" cy="20" r="2.4"/>',
  fixed:'<path d="M12 4v24m0-20-6 5m6 1-6 5m6 1-6 5m6-9h16"/>',
  free:'<path d="M4 16h24"/><circle cx="16" cy="16" r="4" fill="white"/>'
};
export function installDiagramEditor({getConfig,quantity,property,supportNames,openMaterial,openSection,stop,ready,changeSupport}){
  const byId=id=>document.getElementById(id);
  const beam=byId('beamWrap'),dialog=byId('supportDialog'),nearby=byId('nearbySupport');
  const supports=byId('supportOptions'),members=byId('spanOptions');
  let kind='node',index=0,detailOpen=false;
  const trigger=()=>beam.querySelector('[data-'+kind+'="'+index+'"]');
  const letter=i=>String.fromCharCode(65+i);
  function restoreFocus(){
    if(!document.querySelector('dialog[open]')&&(document.activeElement===document.body||!document.activeElement?.isConnected))
      trigger()?.focus({preventScroll:true});
  }
  function position(){
    if(!dialog.open||matchMedia('(max-width:600px)').matches)return;
    const box=trigger()?.getBoundingClientRect();if(!box)return;
    const w=dialog.offsetWidth,h=dialog.offsetHeight,m=10;
    const x=kind==='span'?(box.left+box.right)/2:box.right;
    const alternative=kind==='span'?x:box.left;
    dialog.style.left=Math.max(m,Math.min(innerWidth-w-m,x+m+w<=innerWidth-m?x+m:alternative-w-m))+'px';
    dialog.style.top=Math.max(m,Math.min(innerHeight-h-m,box.top+(box.height-h)/2))+'px';
  }
  function selectTarget(i){
    index=i;const c=getConfig(),s=c.spans[i];nearby.value=String(i);
    supports.hidden=kind!=='node';members.hidden=kind!=='span';
    beam.querySelectorAll('.editing-target').forEach(el=>el.classList.remove('editing-target'));
    trigger()?.classList.add('editing-target');
    if(kind==='node'){
      const x=c.spans.slice(0,i).reduce((sum,span)=>sum+span.L,0);
      byId('supportTitle').textContent=letter(i)+' 點支承';
      byId('supportStation').textContent='x = '+quantity(x,'m')+' · 目前為'+supportNames[c.supports[i]];
      for(const b of supports.children)b.setAttribute('aria-pressed',String(b.dataset.type===c.supports[i]));
    }else{
      byId('supportTitle').textContent='第 '+(i+1)+' 跨 · '+letter(i)+'–'+letter(i+1);
      byId('supportStation').textContent='跨長 '+quantity(s.L,'m');
      byId('graphSectionName').textContent=s.section?s.section.name+' · '+(s.section.axis==='v'?'垂直軸':'水平軸'):'手動輸入 I = '+property(s.I,'m⁴');
      byId('graphMaterialName').textContent=s.material?.name||'手動輸入 E = '+property(s.E,'GPa');
    }
    byId('supportClose').setAttribute('aria-label',kind==='node'?'關閉支承選單':'關閉梁段選單');
    position();
  }
  function open(target){
    if(!target||!ready())return;
    stop();kind=target.hasAttribute('data-node')?'node':'span';
    const c=getConfig(),options=kind==='node'?c.supports.map((s,i)=>letter(i)+' 點 · '+supportNames[s]):c.spans.map((s,i)=>'第 '+(i+1)+' 跨 · '+letter(i)+'–'+letter(i+1));
    const rects=[...beam.querySelectorAll('[data-'+kind+']')].map(el=>el.querySelector(kind==='node'?'text':'.span-hit').getBoundingClientRect());
    const narrow=kind==='span'?rects.some(r=>r.width<44):rects.some((r,i)=>i&&(r.left+r.right-rects[i-1].left-rects[i-1].right)/2<44);
    byId('nearbyNodes').hidden=!narrow;byId('targetLabel').textContent=kind==='node'?'選取節點':'選取梁段';
    nearby.replaceChildren(...options.map((name,i)=>new Option(name,i)));
    selectTarget(Number(target.dataset[kind]));dialog.showModal();position();
    (kind==='node'?supports.querySelector('[aria-pressed="true"]'):byId('graphSection')).focus({preventScroll:true});
  }
  for(const [type,name] of Object.entries(supportNames)){
    const b=document.createElement('button');b.type='button';b.dataset.type=type;
    b.innerHTML='<svg aria-hidden="true" viewBox="0 0 32 32"><g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round">'+supportIcons[type]+'</g></svg><span><strong>'+name+'</strong><small>'+supportDescription[type]+'</small></span>';
    supports.append(b);
  }
  function openDetails(which){
    detailOpen=true;dialog.close();
    const isSection=which==='section';
    const child=byId(isSection?'beamSectionDialog':'beamMaterialDialog');
    child.addEventListener('close',()=>{detailOpen=false;restoreFocus();},{once:true});
    (isSection?openSection:openMaterial)(index);
  }
  byId('graphSection').onclick=()=>openDetails('section');
  byId('graphMaterial').onclick=()=>openDetails('material');
  const targetSelector='[data-node],[data-span]';
  for(const type of ['pointerdown','focusin'])beam.addEventListener(type,e=>{if(e.target.closest(targetSelector))stop();});
  beam.addEventListener('click',e=>open(e.target.closest(targetSelector)));
  beam.addEventListener('keydown',e=>{
    const b=e.target.closest(targetSelector);
    if(b&&['Enter',' '].includes(e.key)){e.preventDefault();if(!e.repeat)open(b);}
  });
  nearby.onchange=()=>selectTarget(Number(nearby.value));
  supports.onclick=e=>{const b=e.target.closest('button[data-type]');if(b){dialog.close();changeSupport(index,b.dataset.type);}};
  byId('supportClose').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{
    if(e.target!==dialog)return;
    const b=dialog.getBoundingClientRect();
    if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)dialog.close();
  });
  dialog.addEventListener('close',()=>{
    beam.querySelectorAll('.editing-target').forEach(el=>el.classList.remove('editing-target'));
    if(!detailOpen)restoreFocus();
  });
  window.addEventListener('resize',position);
  return {editingSpan:()=>detailOpen};
}
