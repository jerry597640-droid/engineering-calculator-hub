'use strict';
(()=>{
 const note=document.getElementById('project-note');
 const sources={geometry:'柱表、型錄或經確認的實測尺寸；mm 除以 10 換為 cm。',material:'結構總說明、材料規格與鋼種板厚；Fy 採設計值，不逕用較高試驗值。',lengths:'支撐圖、接頭詳圖與穩定分析；各方向分別判斷。',loads:'同一 ASD 組合、同一檢核位置的構材內力；核對模型局部軸及正負號。',coeffs:'ASD 第 8.2 節；按各平面側移、橫載及端彎矩條件判定。'};
 for(const [group,items] of Object.entries(specs))for(const [id,label,unit,value,tip] of items){
  const wrap=document.getElementById('wrap-'+id),d=document.createElement('details');d.className='parameter-help';
  const summary=document.createElement('summary');summary.textContent='定義與資料來源';d.append(summary);
  const p=document.createElement('p');p.id='help-'+id;p.textContent=tip+' 資料來源：'+sources[group];d.append(p);wrap.append(d);
  document.getElementById(id).setAttribute('aria-describedby',p.id);
 }
 const ids=['shape','fabrication','weld',...Object.values(specs).flat().map(x=>x[0]),'report-project','report-member','report-author'];
 document.getElementById('save-project').onclick=()=>{
 const inputs=Object.fromEntries(ids.map(id=>[id,document.getElementById(id).value]));
 const blob=new Blob([JSON.stringify({format:'steel-column-project',version:1,inputs},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='steel-column-project.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);note.textContent='已匯出案件 JSON，可用「載入案件」還原參數。';};
 document.getElementById('load-project').onchange=async e=>{try{
 const file=e.target.files[0];if(!file)return;if(file.size>100000)throw Error('檔案過大');
 const data=JSON.parse(await file.text());if(data.format!=='steel-column-project'||data.version!==1||!data.inputs)throw Error('不是支援的案件檔');
 const v={};for(const id of ids){if(typeof data.inputs[id]!=='string')throw Error('欄位缺漏：'+id);v[id]=data.inputs[id];}
 const nums=Object.values(specs).flat().map(x=>x[0]);const cv={...v};for(const id of nums){if(v[id].trim()==='')throw Error(id+' 不可空白');cv[id]=Number(v[id]);}
 const r=compute(cv);if(r.errors.length)throw Error(r.errors.join('；'));
 for(const id of ids)document.getElementById(id).value=v[id];updateShape(false);note.textContent='案件已載入並重新計算。';
 }catch(err){note.textContent='未載入：'+err.message;}finally{e.target.value='';}};
 document.querySelectorAll('[data-video-time]').forEach(b=>b.onclick=()=>{const v=document.getElementById('tutorial-video');v.currentTime=Number(b.dataset.videoTime);v.play().catch(()=>{});});
})();
