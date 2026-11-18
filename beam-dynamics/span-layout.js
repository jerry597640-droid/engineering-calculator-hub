import {maxSpans,total} from './solver.js?v=1.4';

export function changeLayout(model,lengths,loadRule='relative') {
  if(!Array.isArray(lengths)||lengths.length<1||lengths.length>maxSpans||
     !lengths.every(n=>Number.isFinite(n)&&n>=.1&&n<=200))throw Error('每跨長度須介於 0.1 至 200 m。');
  const before=total(model),after=lengths.reduce((sum,n)=>sum+n,0);
  if(loadRule!=='fixed'&&loadRule!=='relative')throw Error('請選擇載重座標的處理方式。');
  if(loadRule==='relative'&&!(before>0&&Number.isFinite(before)))throw Error('原梁總長無法換算，請使用固定座標。');
  const loads=model.loads.map((load,index)=>{
    const copy={...load};
    for(const key of load.type==='line'?['a','b']:['x']){
      const x=load[key];
      let mapped=loadRule==='relative'?(x===before?after:x/before*after):x;
      if(Math.abs(mapped-after)<1e-10)mapped=after;
      if(!Number.isFinite(mapped)||mapped<0||mapped>after)throw Error('第 '+(index+1)+' 筆靜載超出新梁長。請改用全長比例，或先調整載重位置。');
      copy[key]=mapped;
    }
    return copy;
  });
  const spans=lengths.map((L,i)=>({...structuredClone(model.spans[Math.min(i,model.spans.length-1)]),L}));
  const supports=[model.supports[0],...lengths.slice(1).map((_,i)=>i+1<model.spans.length?model.supports[i+1]:'roller'),model.supports.at(-1)];
  return {...model,spans,supports,loads};
}

export function installLayoutEditor({getConfig,getUnits,onApply,validate}) {
  const el=id=>document.getElementById(id),dialog=el('layoutDialog'),count=el('layoutCount'),grid=el('layoutLengths');
  const error=el('layoutError'),rule=el('layoutLoadRule'),continuous=el('layoutContinuous');
  let lengths=[],lastMultiple=2;
  const units=()=>getUnits(),show=n=>Number(units().show('m',n).toPrecision(12));
  const read=()=>[...grid.querySelectorAll('input')].map(input=>units().base('m',input.valueAsNumber));
  function render(n){
    count.value=n;count.disabled=n===1;continuous.checked=n>1;el('layoutSingle').checked=n===1;
    const rows=Array.from({length:n},(_,i)=>{
      const input=document.createElement('input'),label=document.createElement('label');
      label.textContent='第 '+(i+1)+' 跨 '+units().label('m');input.type='number';input.step='any';input.min=show(.1);input.max=show(200);
      const value=lengths[i];input.value=Number.isFinite(value)?show(value):'';label.append(input);return label;
    });
    grid.replaceChildren(...rows);error.textContent='';summary();
  }
  function summary(){
    const vals=read(),L=vals.reduce((a,b)=>a+b,0);
    el('layoutSummary').textContent=Number.isFinite(L)&&vals.every(n=>n>0)?vals.length+' 跨 · 全長 '+show(L)+' '+units().label('m')+' · '+(vals.length+1)+' 個節點':'請填寫所有跨長。';
  }
  function resize(n){
    read().forEach((v,i)=>lengths[i]=v);
    while(lengths.length<n)lengths.push(lengths.at(-1)??10);
    if(n>1)lastMultiple=n;
    render(n);
  }
  count.add(new Option('1 跨',1));count.options[0].disabled=true;
  for(let i=2;i<=maxSpans;i++)count.add(new Option(i+' 跨',i));
  el('openLayout').onclick=()=>{
    lengths=getConfig().spans.map(s=>s.L);lastMultiple=Math.max(2,lengths.length);
    rule.value='relative';render(lengths.length);dialog.showModal();
  };
  el('layoutSingle').onchange=()=>resize(1);
  continuous.onchange=()=>resize(lastMultiple);
  count.onchange=()=>resize(Number(count.value));
  grid.oninput=()=>{error.textContent='';summary();};
  el('layoutEqual').onclick=()=>{
    const vals=read();if(!(vals[0]>=.1&&vals[0]<=200)){error.textContent='請先填寫有效的第 1 跨長度。';return;}
    lengths=vals.map(()=>vals[0]);render(vals.length);
  };
  el('layoutApply').onclick=()=>{
    try{
      const next=changeLayout(getConfig(),read(),rule.value);validate(next);
      dialog.close();onApply(next);
    }catch(e){error.textContent=e.message;}
  };
  el('layoutClose').onclick=()=>dialog.close();
}
