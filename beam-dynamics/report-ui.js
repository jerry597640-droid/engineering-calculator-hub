import {reportBlocks} from './calculation-report.js';
import {wordReport} from './word-report.js';
import {reportFigures} from './report-plots.js';

const el = (tag,text) => { const node=document.createElement(tag); if(text!=null)node.textContent=text;return node; };
const get = id => document.getElementById(id);
const modes = {static:'靜力',moving:'移動包絡',dynamic:'動力歷時'};
let reportSession;
function revoke(session) {
  if(session.file){ URL.revokeObjectURL(session.file); session.file=null; }
  for(const url of session.images||[])URL.revokeObjectURL(url);
  session.images=[];
}
function tablePreview(block) {
  const wrap=el('div');wrap.className='report-data';const t=el('table'),head=t.createTHead().insertRow();
  for(const value of block.headers) { const th=el('th',value);th.scope='col';head.append(th); }
  const body=t.createTBody();let next=0;
  function addRows(count) {
    for(const end=Math.min(next+count,block.rows.length);next<end;next++){
      const row=body.insertRow();
      for(const value of block.rows[next])row.append(el('td',value));
    }
  }
  addRows(8);wrap.append(t);
  if(next<block.rows.length) {
    const more=el('button');more.type='button';
    function update(){more.textContent='顯示更多資料（已顯示 '+next+' / '+block.rows.length+' 列）';}
    update();more.onclick=()=>{addRows(100);if(next===block.rows.length)more.remove();else update();};wrap.append(more);
  }
  return wrap;
}
function preview(session,blocks) {
  const root=get('reportPreview');root.replaceChildren();let sub;
  for (const b of blocks){
    if(b.type==='title')continue;
    if(b.type==='h1'){const details=el('details');details.append(el('summary',b.text));root.append(details);sub=details;continue;}
    const target=sub||root;
    if(b.type==='table')target.append(tablePreview(b));
    else if(b.type==='figure'){
      const fig=el('figure'),img=el('img');
      const url=URL.createObjectURL(new Blob([b.png],{type:'image/png'}));session.images.push(url);
      img.src=url;img.alt=b.title;img.loading='lazy';fig.append(img,el('figcaption',b.title+'　'+b.description));target.append(fig);
    }else if(b.type!=='page'){const item=el(b.type==='h2'?'h4':'p',b.text);if(b.type==='formula')item.className='report-formula';target.append(item);}
  }
  root.querySelector('details')?.setAttribute('open','');
}
function settings(){
  return {project:get('reportProject').value.trim(),engineer:get('reportEngineer').value.trim(),detail:get('reportDetail').checked,history:get('reportHistory').checked};
}
function invalidate() {
  if(!reportSession)return;reportSession.version++;revoke(reportSession);get('reportReady').hidden=true;get('reportReady').removeAttribute('href');
  get('reportPreview').replaceChildren();get('reportStatus').textContent='可預覽計算過程，或直接匯出 Word。';
}
async function generate(download) {
  const session=reportSession;if(!session)return;
  const {model,analysis,frameIndex,units,version}=session, x=units.base('m',get('reportX').valueAsNumber);
  if (!Number.isFinite(x)||x<0||x>model.L+1e-10){get('reportStatus').textContent='請輸入梁範圍內的斷面座標。';get('reportX').focus();return;}
  const at=Math.min(x,model.L); const configs=settings();
  const valid=()=>reportSession===session && version===session.version;
  const buttons=['reportBuild','wordExport'];buttons.forEach(id=>get(id).disabled=true);
  get('reportStatus').textContent='正在整理計算式、數值與工程圖…';
  try {
    if(!session.figures||session.plotX!==at){
      const plots=await reportFigures(model,analysis,frameIndex,units,at);
      if(!valid())return;session.figures=plots;session.plotX=at;
    }
    const blocks=reportBlocks(model,analysis,frameIndex,at,units,{...configs,figures:session.figures});
    if(!valid())return;
    if(download) {
      const blob=wordReport(blocks);
      if(session.file)URL.revokeObjectURL(session.file);
      const link=get('reportReady');session.file=URL.createObjectURL(blob);link.href=session.file;
      const name=(configs.project||'BeamLab').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,55);
      link.download=name+'_'+modes[model.c.mode]+'_計算報告.docx';link.hidden=false;link.click();
      get('reportStatus').textContent='Word 報告已產生。若未自動下載，請點「下載已產生的 Word」。';
    }else{
      for(const url of session.images)URL.revokeObjectURL(url);session.images=[];
      preview(session,blocks);get('reportStatus').textContent='展開章節可檢視計算式、表格與圖面。';
    }
  }catch(error){if(valid())get('reportStatus').textContent='產生報告失敗：'+error.message;}
  finally {if(reportSession===session)buttons.forEach(id=>get(id).disabled=false);}
}
const dialog=get('reportDialog');
dialog.onclose=()=>{if(reportSession)revoke(reportSession);reportSession=null;get('reportPreview').replaceChildren();};
get('reportClose').onclick=()=>dialog.close();
get('reportBuild').onclick=()=>generate(false);get('wordExport').onclick=()=>generate(true);
for(const id of ['reportX','reportProject','reportEngineer','reportDetail','reportHistory'])get(id).addEventListener('input',invalidate);
export function openCalculationReport(model,analysis,frameIndex,queryX,units) {
  if(reportSession)revoke(reportSession);
  reportSession={model,analysis,frameIndex,units,version:0,images:[]};
  const x=Number.isFinite(queryX)&&queryX>=0&&queryX<=model.L?queryX:model.L/2;
  get('reportX').max=units.show('m',model.L);get('reportX').value=Number(units.show('m',x).toPrecision(14));get('reportXUnit').textContent=units.label('m');
  get('historyOption').hidden=model.c.mode==='static';get('reportHistory').checked=false;
  get('historyCount').textContent=analysis.frames.length;
  get('reportFrame').textContent=modes[model.c.mode]+' · '+model.c.spans.length+' 跨 · '+(model.c.mode==='static'?'單一載重配置':'第 '+frameIndex+' 步 / '+(analysis.frames.length-1)+'，t = '+Number(analysis.frames[frameIndex].t.toPrecision(6))+' s');
  get('reportBuild').disabled=false;get('wordExport').disabled=false;
  invalidate();dialog.showModal();
}
