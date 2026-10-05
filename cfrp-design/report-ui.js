function traceText(steps){return steps.map((s,i)=>`${i+1}. ${s.title}\n公式：${s.formula}\n代入：${s.substitution}\n結果：${s.result} ${s.unit||''}\n條件：${s.condition||'未額外取整'}\n來源：${s.source||'原工具計算框架'}`).join('\n\n');}
function makeWordReport(){
 if(!result||result.inputSnapshot!==JSON.stringify(lastInputs)||JSON.stringify(params())!==JSON.stringify(lastInputs))throw Error('結果已過期或無效，請重新計算');
 const inputs=[];for(const group of ['geometry','common',lastMode])for(const el of document.querySelectorAll(`[data-group="${group}"] input`)){const label=el.previousElementSibling;inputs.push({label:label.childNodes[0].textContent,value:lastInputs[el.dataset.key],unit:label.querySelector('span')?.textContent||''});}
 inputs.push(...['shape','wrap','ties'].map(k=>({label:k,value:lastInputs[k],unit:''})),{label:'長期活載',value:$('long-live').checked,unit:''});
 const svg=$('diagram').cloneNode(true);svg.setAttribute('style','font-family:Microsoft JhengHei,sans-serif;font-size:14px');
 const steps=[...JSON.parse(JSON.stringify(result.trace))];
 if(searchTrace&&searchTrace.mode===lastMode&&searchTrace.selectedSnapshot===JSON.stringify(lastInputs))steps.push(...JSON.parse(JSON.stringify(searchTrace.steps)));
 steps.push({title:'未補強同引擎計算',formula:'n=0',substitution:traceText(baseResult.trace),result:baseResult.capacity,unit:units[lastMode],condition:'CFRP損失情境使用此結果',source:'同一CFRP計算引擎'});
 return {title:'CFRP 詳細計算報告',summary:`${$('project').value}；${labels[lastMode]}；補強容量 ${result.capacity} ${units[lastMode]}；需求比 ${result.ratio}；${$('status').textContent}。`,inputs,steps,conclusions:[$('status').textContent,...[...$('checks').querySelectorAll('li')].map(el=>el.textContent),'本報告限所列斷面計算，不是全部規範符合證明；錨定、服務性、耐火及構件整體尚待檢核。'],diagram:{svg:new XMLSerializer().serializeToString(svg),width:540,height:405,caption:`${labels[lastMode]}；b=${lastInputs.b} cm、h=${lastInputs.h} cm；CFRP ${lastInputs.n} 層，總厚度 ${result.t} mm。青色為本次CFRP位置；尺寸與模式依當次輸入。`}};
}
$('docx-report').onclick=async()=>{try{render();if(!result)throw Error('輸入無效，無法匯出');const report=makeWordReport();await CalculationDocx.download(report,'CFRP_'+lastMode+'_詳細計算.docx');toast('已匯出可編輯Word')}catch(e){toast(e.message)}};
