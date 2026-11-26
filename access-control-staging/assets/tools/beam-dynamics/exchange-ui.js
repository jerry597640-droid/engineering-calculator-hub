import {exchangeModel,vehicleForcingCsv,stationMapCsv} from './exchange-model.js';
import {writeMgt,mgtSectionMode} from './export-mgt.js';
import {writeS2k,s2kSectionMode} from './export-s2k.js';

const get=id=>document.getElementById(id);
const dialog=get('exchangeDialog'),select=get('exchangeScope'),ready=get('exchangeReady');
const labels={base:'常駐靜載',current:'所選車位（靜力）',all:'全部車位（逐位置靜力）',history:'車輛動力歷時（直接積分）'};
const descriptions={
  base:'BL_BASE 包含常駐載重；已勾選的自重換成梁上線載重。',
  current:'BL_BASE 表示常駐載重。BL_POS 工況已包含常駐載重及該車位的軸重，可直接用來核對靜力。',
  all:'每個 BL_POS 工況均含常駐載重及對應車位的軸重。可下載車位對照表，依步號、前軸座標與時間建立包絡。',
  history:'BL_DYN 為車輛增量反應。比較總反應時，將同時刻的增量與 BL_BASE 靜力結果相加。車軸使用等效節點力及彎矩；質量矩陣和元素內力回復方式會影響各軟體的動力結果。'
};
let session,url;
function resetLink(){
  ready.hidden=true;ready.removeAttribute('href');
  if(url){const old=url;setTimeout(()=>URL.revokeObjectURL(old),30000);url=undefined;}
}
function updateScope(){
  resetLink();const {model:m,analysis:a,index,units}=session,k=select.value;
  const f=a.frames[index];
  get('exchangeDescription').textContent=descriptions[k];
  const n=k==='all'?a.frames.length+1:k==='current'?2:1;
  let text=m.xs.length+' 個節點 · '+m.els.length+' 個梁元素 · '+n+' 個靜力工況';
  if(k==='current'){const x=m.c.direction===1?f.front:m.L-f.front;text+=' · 第 '+index+' 步，前軸 x = '+Number(units.show('m',x).toPrecision(7))+' '+units.label('m');}
  if(k==='history')text+=' · 1 個歷時工況，'+(a.frames.length-1)+' 個時間步';
  get('exchangeSummary').textContent=text;
  get('exchangeAux').hidden=!(k==='all'||k==='history');
  get('exchangeAux').textContent=k==='all'?'下載車位對照 CSV':'下載節點載重歷時 CSV';
  get('exchangeStatus').textContent='';
}
function deliver(content,name,type){
  resetLink();url=URL.createObjectURL(new Blob([content],{type}));
  ready.href=url;ready.download=name;ready.textContent='再次下載 '+name;ready.hidden=false;ready.click();
  get('exchangeStatus').textContent='已產生 '+name+'。';
}
function output(format){
  if(!session)return;
  const {model,analysis,index}=session,scope=select.value;
  try{
    if(format==='csv'){
      const positions=scope==='all';
      deliver(positions?stationMapCsv(model,analysis):vehicleForcingCsv(model,analysis),positions?'BeamLab_Case_Positions.csv':'BeamLab_Vehicle_Forcing.csv','text/csv;charset=utf-8');return;
    }
    const data=exchangeModel(model,analysis,index,scope);
    const suffix=scope==='current'?'Position_'+String(index).padStart(4,'0'):{base:'Static',all:'All_Positions',history:'Dynamic'}[scope];
    deliver(format==='mgt'?writeMgt(data):writeS2k(data),'BeamLab_'+suffix+'.'+format,'application/octet-stream');
  }catch(err){get('exchangeStatus').textContent='無法匯出：'+err.message;}
}
get('exchangeMgt').onclick=()=>output('mgt');
get('exchangeS2k').onclick=()=>output('s2k');
get('exchangeAux').onclick=()=>output('csv');
get('exchangeClose').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>{resetLink();session=null;});
select.addEventListener('change',updateScope);
export function openExchange(model,analysis,index,units) {
  session={model,analysis,index,units};
  const keys=model.c.mode==='static'?['base']:model.c.mode==='dynamic'?['history','current','base']:['all','current','base'];
  select.replaceChildren(...keys.map(k=>new Option(labels[k],k)));select.value=keys[0];
  const inferred=model.c.spans.some(s=>!s.A||s.areaEstimated);
  get('exchangeSection').textContent='依各跨斷面傳遞面積 A、面內 EI 和線質量。'+(inferred?'未指定面積的跨，採相同 I 的實心方形。':'')+'木材以順紋彎曲分析。';
  const modes={shape:'原生斷面',properties:'數值斷面',equivalent:'等效矩形'};
  const list=get('exchangeProfiles');
  list.replaceChildren(...exchangeModel(model,analysis,index,'base').spans.map(s=>{
    const item=document.createElement('li');item.textContent='第 '+s.id+' 跨 '+(s.section?.name||'直接輸入 I')+' · MIDAS '+modes[mgtSectionMode(s)]+' / SAP '+modes[s2kSectionMode(s)];
    return item;
  }));
  updateScope();dialog.showModal();
}
