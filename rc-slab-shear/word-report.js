/* Editable Word uses the exact steps returned by calculate(). No second model. */
(function(){
'use strict';
const source='台灣112年混凝土結構設計規範／113年勘誤；https://www.nlma.gov.tw/filesys/file/EMMA/c1130219-1.pdf';
const number=n=>Number.isFinite(n)?String(n):n===Infinity?'∞（強度為零）':'待確認';
function activeKeys(s,mode){
 const common=['project','fc','h','lambda','phi','gamma','D','L'];
 if(mode==='one')return common.concat(['bw','Nu','dmode','asmode','onemode'],s.dmode==='auto'?['cover','offset','bar']:['dmanual'],s.asmode==='bars'?['bar','spacing']:['Asmanual'],s.onemode==='uniform'?['support','span']:['Vu']).filter((x,i,a)=>a.indexOf(x)===i);
 return common.concat(['position','cx','cy','dx','dy','punchmode','stressmode'],s.punchmode==='net'?['pVu']:['Ru','pqu'],s.stressmode==='moments'?['Mx','My']:['vmax']);
}
function capture(){
 const s=structuredClone(state),mode=lastMode,keys=activeKeys(s,mode);
 for(const key of keys){const el=document.querySelector('[data-key="'+key+'"]');if(el){const raw=typeof BASE[key]==='number'?(el.value.trim()===''?NaN:Number(el.value)):el.value;if(!Object.is(raw,s[key]))throw Error('輸入已變更，請重新計算後匯出。');}}
 for(const key of ['eligible','special'])if($(key).checked!==s[key])throw Error('条件已變更，請重新計算後匯出。');
 const r=calculate(s,mode);if(!r.valid)throw Error('本次資料無效或模式未支援，請修正輸入後匯出。');
 let svg=draw(r).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ').replace(/(<svg[^>]*>)/,'$1<style>text{font-family:Microsoft JhengHei,Arial,sans-serif;font-size:16px;fill:#38516a}</style>');
 const inputs=keys.map(k=>({label:F[k][0],value:s[k],unit:F[k][1]}));
 inputs.push({label:'支承面 d 條件',value:s.eligible?'符合三項':'未確認／不符合',unit:''},{label:'特殊幾何',value:s.special?'有':'無',unit:''});
 const tables=[{title:'本次輸入資料定義',headers:['項目','定義及來源'],rows:keys.map(k=>[F[k][0],F[k][2]]),widths:[2800,6200],source}];
 if(mode==='one'&&(s.dmode==='auto'||s.asmode==='bars'))tables.push({title:'實際採用的鋼筋尺寸查表',headers:['原表列','直徑 cm','名義面積 cm²'],rows:[[s.bar,BARS[s.bar][0],BARS[s.bar][1]]],source:'本工具 BARS 名義鋼筋資料；列='+s.bar+'；欄0=db，欄1=Ab。未做內插或修正。'});
 const steps=r.steps.map(([title,text])=>({title,substitution:text,source}));
 steps.push({title:'顯示取整與最終判定',formula:'判定使用完整精度 D/C ≤ 1 且設計強度大於零',substitution:'計算中間值不取整；畫面及既有明細採固定小數位顯示，Word保留同一份明細。D/C完整值='+number(r.ratio),condition:r.status+'；'+r.warnings.join('；'),source});
 return {title:(s.project||'RC樓版剪力檢核')+' '+(mode==='one'?'單向剪力':'沖切剪力')+'計算書',summary:'本報告列出本次實際輸入、詳細公式代入與所選斷面的剪力檢核；判定：'+r.status+'。',inputs,steps,tables,conclusions:['需求='+number(r.demand)+(mode==='one'?' tf':' kgf/cm²')+'；設計強度='+number(r.capacity)+(mode==='one'?' tf':' kgf/cm²')+'；D/C='+number(r.ratio)+'。',r.status,...r.warnings,'僅非預力實心無剪力鋼筋樓版的所選斷面剪力檢核；彎曲、撓度、錨定、耐震與完整組合另核。'],diagram:{svg,width:560,height:mode==='one'?286:344,caption:mode==='one'?'本次板帶、支承與距支承面臨界斷面；示意不按比例。':'本次柱面與 d/2 臨界周界；X向右、Y向下，紅線為自由邊。'},valid:true};
}
let busy=false;
async function exportWord(){if(busy)return;try{const report=capture();busy=true;refreshButtons();await CalculationDocx.download(report,'RC樓版剪力_詳細計算.docx');toast('已匯出可編輯 Word 計算書。');}catch(e){toast(e.message);}finally{busy=false;refreshButtons();}}
function addButton(parent){if(!parent)return;const existing=parent.querySelector('[data-word]');if(existing){existing.onclick=exportWord;return;}const b=document.createElement('button');b.type='button';b.dataset.word='true';b.textContent='匯出可編輯 Word';b.onclick=exportWord;parent.appendChild(b);}
function refreshButtons(){for(const b of document.querySelectorAll('[data-word]'))b.disabled=busy||!window.currentResult?.valid;}
const originalReport=renderReport;renderReport=function(){originalReport();addButton($('report-page').querySelector('.actions'));refreshButtons();};
const originalUpdate=update;update=function(){originalUpdate();const box=document.querySelector('.drawing'),r=window.currentResult;if(box&&r?.valid){const note=document.createElement('p');note.className='diagram-values';note.textContent=r.mode==='one'?'本次 bw='+state.bw+' cm；h='+state.h+' cm；d='+r.d+' cm；As='+r.As+' cm²；Vu='+r.demand+' tf；φVc='+r.capacity+' tf。':'本次柱 cx×cy='+state.cx+'×'+state.cy+' cm；d='+r.d+' cm；d/2='+r.d/2+' cm；b0='+r.b0+' cm。';box.appendChild(note)}refreshButtons();};
addButton(document.querySelector('.top .actions'));refreshButtons();
const style=document.createElement('style');style.textContent='.workspace>*,.panel,.top>*{min-width:0}.drawing{overflow-x:auto;max-width:100%}.drawing svg{width:100%;min-width:0;max-width:100%;max-height:none}.drawing text{font-size:16px}.diagram-values{font-size:13px;line-height:1.7;overflow-wrap:anywhere}@media print{.drawing svg{min-width:0}}';document.head.appendChild(style);
window.SlabWord={capture,activeKeys};
})();
