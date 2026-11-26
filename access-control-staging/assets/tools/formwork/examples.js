(function(root){
function makeExample(type){
 const d=Formwork.defaults(type);d.members.forEach(m=>m.sim=1);d.def='both';
 if(type==='plate'){Object.assign(d,{wd:.84,wi:.2,wl:.2,support:'frame',capacity:2});Formwork.setInput(d,'X',100);Formwork.setInput(d,'Y',80);}
 if(type==='beam'){Object.assign(d,{H:.6,rho:2350,wi:.1,wl:.2,support:'frame',capacity:2,tieSp:.5,tieCapacity:1433});Formwork.setInput(d,'X',100);Formwork.setInput(d,'Y',50);}
 if(type==='column'||type==='wall'){Object.assign(d,{H:3,rho:2350,R:1,T:25,pressure:'hydro',tieSp:.5,tieCapacity:1433});d.members[0].L=.2;d.members[1].L=.4;d.members[2].L=.5;}
 return d;
}
root.FormworkExamples={makeExample};if(typeof module!=='undefined')module.exports=root.FormworkExamples;
if(typeof document==='undefined')return;
const fmt=(x,k=4)=>Number(x.toFixed(k)).toLocaleString('en-US',{maximumFractionDigits:k});
const tbl=(headers,rows)=>'<div class="help-table"><table><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</table></div>';
const types=['plate','beam','column','wall'];
let html='<p>以下是完整教學資料，不是工地核定配置。材料數值承接原程式示範值；2 tf 支架容量為教學假設，並非特定產品證明。範例刻意保留可能的 NG，方便練習判讀。實際使用須替換為本案資料。</p><p>手動操作：選模式 → 依下表填載重及每組構件 → 填支撐／緊結器 → 選容許撓度 → 核對結果。全部採「簡支」及「min(0.3 cm, L/240)」。也可按一鍵載入；會取代該模式現有輸入，可按頁首「復原載入前資料」撤銷最近一次載入。</p>';
for(const type of types){const d=makeExample(type),r=Formwork.calculate(d),vertical=type==='plate'||type==='beam';
 html+='<h3>'+names[type]+'完整輸入範例</h3><button type="button" class="load-example" data-example="'+type+'">載入'+names[type]+'範例</button>';
 let rows=type==='plate'?[['靜載重 WD','0.84 tf/m²'],['衝擊 WI／施工活載 WL','0.20／0.20 tf/m²']]:type==='beam'?[['梁高 H／密度 ρ','0.60 m／2350 kg/m³'],['衝擊 WI／施工活載 WL','0.10／0.20 tf/m²']]:[['側壓計算方式','靜水壓 γH（新增比較）'],['澆置高度 H／密度 ρ','3.00 m／2350 kg/m³'],['澆置速度 R／混凝土溫度 T','1 m/hr／25°C（本靜水壓範例不參與計算）']];
 if(vertical)rows.push(['支撐種類／容許承載力','重型鋼架／指定容量；2 tf（假設值）'],['支撐分攤寬 X／長 Y',d.X+'／'+d.Y+' cm（由 L3／L2 連動）']);
 if(type!=='plate')rows.push(['緊結器間距 S／每組容許拉力 Ta','0.50 m／1433 kgf（示範值）']);
 rows.push(['支承模型／容許撓度','所有構件簡支／min(0.3 cm, L/240)']);html+=tbl(['輸入欄位','照著填入'],rows);
 html+=tbl(['構件／跨距 m','斷面資料 cm 系列','E／Fb／Fv kgf/cm²'],d.members.map(m=>[m.name+'；L = '+m.L,m.shape==='rect'?'矩形 b = '+m.b+'、h = '+m.h+(m.name.includes('模板')?'（b 固定，只填厚度 h）':''):'自行指定 A = '+m.A+' cm²；I = '+m.I+' cm⁴；Z = '+m.Z+' cm³',m.E+'／'+m.Fb+'／'+m.Fv]));
 html+='<p>'+(vertical?'支架採指定容量，鋼管 D、t、Lb 或木柱欄位不必填。':'')+(type==='beam'?'快速調整欄僅控制底部三構件，側 L1、側 L2 請在側模板、側直材內填寫。':type==='plate'?'L1 = 0.35 m、L2 = 0.80 m、L3 = 1.00 m；應同步顯示 Y = 80 cm、X = 100 cm。':'柱牆無垂直支柱；S 與 L3 是不同欄位，本範例同填 0.50 m，仍須分別輸入。')+'</p>';
 html+='<h3>'+names[type]+'預期結果</h3>';
 let expected=vertical?[['總垂直載重 q',fmt(r.q)+' tf/m²'],['單支撐需求 P／容許 Pa',fmt(r.s.P)+'／2000 kgf']]:[];
 if(type!=='plate')expected.push(['混凝土側壓 p',fmt(r.p)+' kgf/m² = '+fmt(r.p/1000)+' tf/m²'],['緊結器 T'+(type==='beam'?'':'／2T'),fmt(r.tie.force)+(type==='beam'?'':'／'+fmt(r.tie.doubleForce))+' kgf']);
 expected.push(['總覽最大需求／容許比',fmt(r.max)+'；'+(r.pass?'已列數值通過':'有項目超限')]);html+=tbl(['核對項目','預期值'],expected);
 html+=tbl(['構件','fb／fv kgf/cm²','撓度 δ cm／判定'],r.rows.map(m=>[m.name,fmt(m.fb)+'／'+fmt(m.fv),fmt(m.delta,6)+'／'+(m.ratio<1?'OK':'NG')]));
 html+='<p>手算核對：'+(vertical?'q = '+(type==='plate'?'0.84 + 0.20 + 0.20':'2400 × 0.60 ÷ 1000 + 0.10 + 0.20')+' = '+fmt(r.q)+' tf/m²；P = q × (X/100) × (Y/100) × 1000 = '+fmt(r.s.P)+' kgf。':'p = 2400 × 3 = 7200 kgf/m²；T = 7200 × 0.50 × 0.40 ÷ 2 = 720 kgf；2T = 1440 kgf，大於 Ta = 1433 kgf，所以緊結器 2T 應顯示 NG。')+'</p>';
 if(type==='plate')html+='<p>練習調整：只把 L3 改成 0.80 m，X 應變成 80 cm。確認貫材彎曲及撓度降低、支撐 P 變成 793.6 kgf，再看全系統結果；不是只改畫面標示。</p>';
}
helpChapters.push({title:'九　可照著輸入的完整範例',html});
const ix=helpChapters.length-1;helpBody.insertAdjacentHTML('beforeend','<section id="help-ch-'+ix+'" class="help-chapter"><h2>'+helpChapters[ix].title+'</h2>'+html+'</section>');helpNav.insertAdjacentHTML('beforeend','<button type="button" data-chapter="'+ix+'">'+helpChapters[ix].title+'</button>');
const open=document.createElement('button');open.textContent='輸入範例';open.id='examples-open';open.onclick=()=>{helpSearch.value='';filterHelp();helpDialog.showModal();document.getElementById('help-ch-'+ix).scrollIntoView({block:'start'});};document.querySelector('.header-actions').prepend(open);
const undo=document.createElement('button');undo.textContent='復原載入前資料';undo.hidden=true;document.querySelector('.header-actions').append(undo);let previous;
helpBody.addEventListener('click',e=>{const b=e.target.closest('[data-example]');if(!b)return;const type=b.dataset.example;previous={type,data:JSON.parse(JSON.stringify(states[type]))};states[type]=makeExample(type);document.querySelector('#modes [data-mode="'+type+'"]').click();helpDialog.close();setWorkspace('overview');undo.hidden=false;});
undo.onclick=()=>{if(!previous)return;states[previous.type]=previous.data;document.querySelector('#modes [data-mode="'+previous.type+'"]').click();previous=null;undo.hidden=true;};
filterHelp();
})(typeof window!=='undefined'?window:globalThis);

