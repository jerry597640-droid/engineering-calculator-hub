const parameterDefinitions={"basis": ["規範基準", "台灣模式使用官方第10章；AISC模式為360-22交叉檢核，兩者的長焊道門檻分開。", "契約、結構設計準則", "台灣"], "method": ["設計方法 ASD／LRFD", "ASD填服務載重組合；LRFD填已係數化組合。切換方法不會替載重加係數。", "核定載重組合與分析報告", "ASD"], "F": ["焊材 FEXX（ksi）", "焊條或焊絲的最低抗拉分類強度；不是母材Fy。1 ksi=6.894757 MPa。", "材質證明與核定WPS", "E70=70 ksi"], "w": ["等腳焊腳 s（mm）", "填角焊兩個等長腳的尺寸，圖面標6mm就是填6。程式te=s/√2；不計補強或未證明的熔深。", "焊接符號、詳圖與WPS", "6"], "t1": ["板厚 t₁（mm）", "接合第一片板的實際設計厚度。兩片取厚者檢查最小焊腳、薄者檢查板邊最大焊腳。", "鋼材詳圖、材料表", "12"], "t2": ["板厚 t₂（mm）", "接合第二片板的厚度，不是焊腳或喉厚。", "鋼材詳圖、材料表", "12"], "preset": ["快速配置", "只建立幾何。雙面焊須有實際間距；按套用後載重位置保持原值。", "接合詳圖", "平行直線"], "L": ["配置 L／圓直徑（cm）", "第1、2、4、6–9型為直線高；第3、5型為橫長；圓形為直徑。套用後以端點為準。", "CAD尺寸與詳圖", "30"], "K": ["配置 K（cm）", "第1–3型是線間距；矩形為另邊尺寸；C／L型為橫臂長。", "CAD尺寸與詳圖", "20"], "endloaded": ["AISC端部受力", "依力流判斷端部受力，長度超過100s時需另算折減。台灣縱向70s限制不會因取消此項而關閉。", "接合力流與設計判斷", "勾選"], "intermittent": ["斷續焊道", "斷續每個實體段都須輸入；每段有效長≥max(4s,40mm)。間斷部分不可當焊長。", "斷續焊符號、節距與CAD", "依圖勾選"], "force-unit": ["輸入力單位", "kg代表公斤力kgf；切換tf會換算已輸入的力與力矩，不會改變實際物理載重。", "分析報告單位設定", "10000 kg=10 tf"], "output-unit": ["結果單位", "切換只改顯示。應力以kg/cm²、線力以kg/mm、力矩以kg·m顯示；幾何慣性積仍為mm³。", "使用者呈現需求", "kg"], "detail-output-unit": ["詳細結果單位", "與結果單位同步；內部仍用N、mm、MPa精確計算。", "使用者呈現需求", "kg"], "drag-step": ["拖曳格距（cm）", "端點位置吸附格距；整條平移按位移吸附，保持原長。取消或復原可回到原配置。", "CAD精度與操作需求", "0.1"], "seg-0": ["x₁（cm）", "焊線起點的X座標。所有焊線及施力位置採同一原點，X向右、Y向上；負值可輸入。", "接合詳圖、CAD有效焊線中心線", "0／30"], "seg-1": ["y₁（cm）", "焊線起點的Y座標。所有焊線及施力位置採同一原點，X向右、Y向上；負值可輸入。", "接合詳圖、CAD有效焊線中心線", "0／30"], "seg-2": ["x₂（cm）", "焊線終點的X座標。所有焊線及施力位置採同一原點，X向右、Y向上；負值可輸入。", "接合詳圖、CAD有效焊線中心線", "0／30"], "seg-3": ["y₂（cm）", "焊線終點的Y座標。所有焊線及施力位置採同一原點，X向右、Y向上；負值可輸入。", "接合詳圖、CAD有效焊線中心線", "0／30"], "load-0": ["x（cm）", "施力點相對共同原點的位置；Z正值朝觀看者，離面偏心由程式自動計入。", "結構分析載重組合及接合詳圖", "Py=-10000 kg；其餘力矩0"], "load-1": ["y（cm）", "施力點相對共同原點的位置；Z正值朝觀看者，離面偏心由程式自動計入。", "結構分析載重組合及接合詳圖", "Py=-10000 kg；其餘力矩0"], "load-2": ["z（cm）", "施力點相對共同原點的位置；Z正值朝觀看者，離面偏心由程式自動計入。", "結構分析載重組合及接合詳圖", "Py=-10000 kg；其餘力矩0"], "load-3": ["Px（kg或tf）", "作用力分量；向右／向上／朝外為正，依欄位方向輸入。", "結構分析載重組合及接合詳圖", "Py=-10000 kg；其餘力矩0"], "load-4": ["Py（kg或tf）", "作用力分量；向右／向上／朝外為正，依欄位方向輸入。", "結構分析載重組合及接合詳圖", "Py=-10000 kg；其餘力矩0"], "load-5": ["Pz（kg或tf）", "作用力分量；向右／向上／朝外為正，依欄位方向輸入。", "結構分析載重組合及接合詳圖", "Py=-10000 kg；其餘力矩0"], "load-6": ["Mx（kg·m或tf·m）", "額外自由力矩，依右手定則；由座標造成的偏心矩不要再填一次。", "結構分析載重組合及接合詳圖", "Py=-10000 kg；其餘力矩0"], "load-7": ["My（kg·m或tf·m）", "額外自由力矩，依右手定則；由座標造成的偏心矩不要再填一次。", "結構分析載重組合及接合詳圖", "Py=-10000 kg；其餘力矩0"], "load-8": ["Mz（kg·m或tf·m）", "額外自由力矩，依右手定則；由座標造成的偏心矩不要再填一次。", "結構分析載重組合及接合詳圖", "Py=-10000 kg；其餘力矩0"], "j-type": ["形式", "CJP全滲透、PJP部分滲透、PLUG塞孔、SLOT塞槽。本頁採同心均勻分配，沒有群組偏心矩。", "接合詳圖", "PJP"], "j-method": ["設計方法", "本頁使用台灣ASD／極限設計第10章，不隨填角焊頁規範選項改變。", "專案設計準則", "ASD"], "j-mode": ["受力模式", "CJP可單獨檢核垂直有效面積拉力或剪力；PJP剪力限平行於焊軸；塞孔／塞槽只能剪力。未處理拉剪同時作用。", "分析內力與接頭方向", "剪力"], "j-t": ["開孔／第一片板厚（mm）", "塞孔塞槽為開孔板厚，用來決定孔寬與焊厚；開槽焊與t₂比較取薄板。", "詳圖與材料表", "12"], "j-t2": ["第二片板厚（mm）", "接合另一片板厚；兩板厚度不同須使用相應核定接頭。", "詳圖與材料表", "12"], "j-F": ["FEXX（ksi）", "焊材抗拉分類強度。CJP垂直拉力以母材局部降伏控制，仍需確認相稱焊材。", "材質證明、WPS", "70"], "j-Fy": ["母材 Fy（kg/cm²）", "只用於CJP局部拉力降伏。本頁ASD用0.60Fy，極限設計用0.90Fy；兩種鋼材請填較低值。", "母材規格與材質證明", "2500"], "j-length": ["有效焊長（cm）", "實際可傳力的開槽焊總長，不含缺陷；本頁各焊段同厚、同心均勻受力。", "詳圖、CAD與WPS", "30"], "j-te": ["PJP有效喉厚（mm）", "依接頭型式、焊法、開槽角與WPS決定；不一定等於槽深。雙面填不重疊喉厚總和，仍須另核每側最小喉厚。", "規範接頭詳圖、核定WPS／PQR", "6"], "j-count": ["孔／槽數 n", "相同尺寸的有效孔槽數，整數。本頁採均分剪力，無偏心。", "詳圖與孔槽配置", "4"], "j-diameter": ["孔徑／槽寬（mm）", "塞孔焊填直徑d；塞槽填寬b。這不是孔內填角焊。", "接合詳圖", "21"], "j-depth": ["焊厚（mm）", "塞孔塞槽熔合填充厚度，用於尺寸限制，不拿來乘接觸面積。", "詳圖、WPS與品質檢驗", "12"], "j-slotLength": ["槽總長（mm）", "含兩端半圓的外部總長；本頁只分析封閉兩端半圓槽。", "詳圖、CAD", "60"], "j-pitch": ["孔間距／槽橫向間距（mm）", "孔用最小中心距；槽用相鄰行橫向中心距。單孔／單槽不檢查間距。", "孔槽配置圖", "84"], "j-pitchL": ["槽縱向中心距（mm）", "多槽沿槽長方向之最小中心距；無該方向鄰槽可填不小於要求值並於圖面註明。", "孔槽配置圖", "120"], "j-P": ["同心需求 P（kg）", "輸入非負公斤力大小，依本頁方法使用服務或已係數化組合；只檢核所選單一受力。", "結構分析與接合力流", "5000"], "j-bm": ["母材可用承載 Rbm（kg）", "由外部母材計算書取得同一方向／同一設計方法的最小承載，須涵蓋兩母材的適用破壞模式。CJP剪力的極限設計母材上限須另按0.90×0.60Fy及相應有效面積檢核；ASD母材依適用章節計算。0代表尚未完成，不會判為符合。不能直接填需求P。", "母材降伏／斷裂／塊狀剪裂等計算書", "教學先填0；工程依計算書"], "j-qualified": ["接頭／WPS已確認", "勾選表示已有人核對全滲透、PJP有效喉厚或孔槽熔合資料；這不是程式自動認證。", "核定WPS、PQR、詳圖與材質證明", "教學未勾選"]};
function parameterFor(e){if(parameterDefinitions[e.id])return parameterDefinitions[e.id];const tr=e.closest('tr');if(tr&&tr.parentElement.id==='seg')return parameterDefinitions['seg-'+[...tr.querySelectorAll('input')].indexOf(e)];if(tr&&tr.parentElement.id==='loads')return parameterDefinitions['load-'+[...tr.querySelectorAll('input')].indexOf(e)];return null;}
function showParameter(e){const d=parameterFor(e);if(!d)return;$('parameter-context').hidden=false;$('parameter-title').textContent=d[0];$('parameter-text').textContent=d[1]+' 資料來源：'+d[2]+' 範例：'+d[3];}
document.addEventListener('focusin',e=>{if(e.target.matches('input,select'))showParameter(e.target);});
$('parameter-close').onclick=()=>$('parameter-context').hidden=true;
$('quick-example').onclick=()=>$('load-example').click();
$('parameter-search').oninput=()=>{const q=$('parameter-search').value.trim().toLowerCase();document.querySelectorAll('#parameter-rows tr').forEach(tr=>tr.hidden=!tr.textContent.toLowerCase().includes(q));};
function updatePro(){
 document.querySelectorAll('#seg tr').forEach((tr,i)=>{let e=tr.querySelector('.length-cell');if(!e){e=document.createElement('td');e.className='length-cell';tr.insertBefore(e,tr.lastElementChild);}const a=[...tr.querySelectorAll('input')].map(v=>v.value.trim()===''?NaN:Number(v.value));e.textContent=a.every(Number.isFinite)?fmt(Math.hypot(a[2]-a[0],a[3]-a[1]),2):'—';});
 $('pro-summary').textContent=result?`控制焊線 #${result.critical.i} · 總有效長 ${fmt(result.L/10,2)} cm · ${result.long?'超過本模型長焊道範圍：數值僅供參考':$('basis').value+'/'+$('method').value+'，未採方向增益'}`:'請修正輸入後檢核。';
}
let jointResult=null;
const jointNames=['type','method','mode','t','t2','F','Fy','length','te','count','diameter','depth','slotLength','pitch','pitchL','P','bm','qualified'];
function jointState(){return Object.fromEntries(jointNames.map(k=>[k,k==='qualified'?$('j-'+k).checked:['type','method','mode'].includes(k)?$('j-'+k).value:$('j-'+k).value.trim()===''?NaN:Number($('j-'+k).value)]));}
function updateJoint(){
 const type=$('j-type').value,groove=['CJP','PJP'].includes(type);if(!groove)$('j-mode').value='shear';$('j-mode').querySelector('[value="tension"]').disabled=!groove;$('j-mode').querySelector('[value="shear"]').textContent=type==='PJP'?'平行於焊軸剪力':groove?'有效面積剪力':'接觸面平行剪力';
 document.querySelectorAll('[data-joint-types]').forEach(e=>e.hidden=!e.dataset.jointTypes.split(' ').includes(type));
 $('j-Fy').closest('.field').hidden=!(type==='CJP'&&$('j-mode').value==='tension');
 $('joint-diagram').innerHTML=jointDiagram(type);
 jointResult=null;$('j-word').disabled=true;
 try{const r=jointResult=JointEngine.analyze(jointState());$('joint-error').hidden=true;$('joint-status').textContent=r.pass?'本頁已列項目符合':'尚有不符合／待確認項目';$('joint-status').className='badge '+(r.pass?'good':'bad');$('joint-result').innerHTML=`<div class="metrics"><div class="metric"><span>焊道／局部利用率</span><strong>${fmt(r.ratio)}</strong></div><div class="metric"><span>局部可用承載</span><strong>${fmt(r.capacity,1)} kg</strong></div><div class="metric"><span>有效面積</span><strong>${fmt(r.area/100,2)} cm²</strong></div><div class="metric"><span>可用應力 fd</span><strong>${fmt(r.fd/.0980665,1)} kg/cm²</strong></div></div>`+r.checks.map(c=>`<div class="check"><span>${esc(c.name)}</span><strong class="${c.ok?'good-text':'bad-text'}">${c.ok?'符合':'待處理'} · ${esc(c.value)}</strong></div>`).join('');$('joint-trace').innerHTML=r.steps.map(e=>`<div class="trace-step"><h4>${esc(e.title)}</h4><p>${esc(e.formula)}</p><p>${esc(e.value)} ${esc(e.unit)}</p></div>`).join('')+`<p>${esc(r.source)}</p><p>${esc(r.scope)}</p>`;$('j-word').disabled=false;}catch(e){$('joint-error').hidden=false;$('joint-error').textContent=e.message;$('joint-status').textContent='輸入無效';$('joint-status').className='badge bad';$('joint-result').innerHTML='';$('joint-trace').innerHTML='';}
}
function jointDiagram(t){const slot=t==='SLOT',holes=t==='PLUG'||slot;return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 540 230" role="img" aria-label="${t}示意圖"><rect width="540" height="230" fill="#f2f6fa"/><text x="25" y="30" fill="#18324c" font-size="18">${t} · ${holes?'平面示意':'接頭斷面示意'}（非比例施工詳圖）</text>${holes?`<rect x="70" y="60" width="400" height="130" fill="#d4e0ec" stroke="#60758b"/>${[130,240,350].map(x=>slot?`<rect x="${x-25}" y="90" width="70" height="45" rx="22.5" fill="#1c699b"/>`:`<circle cx="${x}" cy="115" r="23" fill="#1c699b"/>`).join('')}`:`<path d="M65 90H210L240 165H65Z M475 90H330L300 165H475Z" fill="#d4e0ec" stroke="#60758b"/><path d="M210 90H330L${t==='CJP'?'300 165H240':'292 130H248'}Z" fill="#1c699b"/>`}<text x="25" y="214" fill="#18324c" font-size="14">${holes?'有效面積為接觸面孔／槽面積，不是周長×喉厚。':t==='CJP'?'全滲透：有效喉厚取較薄板厚；須確認全滲透與相稱焊材。':'部分滲透：有效喉厚由核定接頭／WPS決定，不一定等於槽深。'}</text></svg>`;}
jointNames.forEach(k=>$('j-'+k).addEventListener('input',()=>{if(!['qualified','P','bm','method'].includes(k))$('j-qualified').checked=false;updateJoint();}));
$('j-example').onclick=()=>{const type=$('j-type').value,values={method:'ASD',mode:type==='CJP'?'tension':'shear',t:12,t2:12,F:70,Fy:2500,length:30,te:6,count:4,diameter:21,depth:12,slotLength:60,pitch:84,pitchL:120,P:5000,bm:0};Object.entries(values).forEach(([k,v])=>$('j-'+k).value=v);$('j-qualified').checked=false;updateJoint();};
$('j-export').onclick=()=>download(JSON.stringify({kind:'weld-other-v1',...jointState()},null,2),'其他焊接形式_輸入.json','application/json');
$('j-import').onclick=()=>$('j-file').click();$('j-file').onchange=async()=>{try{const f=$('j-file').files[0];if(!f)return;if(f.size>100000)throw Error('檔案過大');const s=JSON.parse(await f.text());if(s.kind!=='weld-other-v1')throw Error('不是其他焊接形式資料');JointEngine.analyze(s);jointNames.forEach(k=>{if(k==='qualified')$('j-'+k).checked=s[k]===true;else $('j-'+k).value=s[k];});updateJoint();}catch(e){alert(e.message);}$('j-file').value='';};
$('j-word').onclick=async()=>{try{const r=jointResult;if(!r)throw Error('先修正輸入');await CalculationDocx.download({title:r.type+'其他焊接形式計算書',summary:r.scope,valid:true,inputs:jointNames.filter(k=>!$('j-'+k).closest('.field')?.hidden).map(k=>({label:parameterDefinitions['j-'+k]?.[0]||k,value:r[k],unit:''})),steps:r.steps.map(e=>({title:e.title,formula:e.formula,substitution:String(e.value),result:e.value,unit:e.unit,source:r.source})),tables:[],diagram:{svg:$('joint-diagram').innerHTML,width:540,height:230,caption:'形式示意，非施工詳圖'},conclusions:r.checks.map(c=>c.name+'：'+c.value+'；'+(c.ok?'符合':'待處理'))},r.type+'_焊接計算書.docx');}catch(e){alert(e.message);}};
const tutorialChapters=[{"index": 1, "title": "載入範例", "start": 0, "audioStart": 0.8, "audioEnd": 14.090667, "end": 14.890667, "duration": 14.890667, "text": "先用範例核對，再換成工程資料。按載入教學範例，材料、焊線和載重會一起更新。已有案件時，請先匯出輸入資料。", "asset": "start"}, {"index": 2, "title": "規範與材料", "start": 14.890667, "audioStart": 15.690667, "audioEnd": 29.450667, "end": 30.250667, "duration": 15.36, "text": "選擇台灣或國際交叉基準。容許應力法使用服務載重，極限設計使用已係數化載重。焊腳是圖面的腳長，不是有效喉厚。", "asset": "material"}, {"index": 3, "title": "焊線位置", "start": 30.250667, "audioStart": 31.050667, "audioEnd": 45.237333, "end": 46.037333, "duration": 15.786667, "text": "範例使用兩條三十公分焊線，間距二十公分。端點採同一原點，橫向向右、縱向向上。表格會顯示每條有效長度。", "asset": "geometry"}, {"index": 4, "title": "滑鼠拖曳", "start": 46.037333, "audioStart": 46.837333, "audioEnd": 60.661333, "end": 61.461333, "duration": 15.424, "text": "拖白色端點，調整焊接長度和方向。拖藍色線段，整條平移並保持長度。座標和利用率同步更新，按復原即可回到原配置。", "asset": "drag"}, {"index": 5, "title": "載重與偏心", "start": 61.461333, "audioStart": 62.261333, "audioEnd": 74.101333, "end": 74.901333, "duration": 13.44, "text": "範例在座標二十五、十五公分，輸入向下一萬公斤力。位置造成的偏心力矩會自動計入，額外力矩不要重複填寫。", "asset": "loads"}, {"index": 6, "title": "看懂結果", "start": 74.901333, "audioStart": 75.701333, "audioEnd": 90.058667, "end": 90.858667, "duration": 15.957333, "text": "範例利用率約零點六零一，強度所需焊腳約三點六一毫米。也要查看尺寸和有效長度檢核，數值符合不代表整個接合設計已完成。", "asset": "results"}, {"index": 7, "title": "其他焊接形式", "start": 90.858667, "audioStart": 91.658667, "audioEnd": 105.376, "end": 106.176, "duration": 15.317333, "text": "其他形式頁提供全滲透、部分滲透、塞孔與塞槽焊。先選形式，再核對有效面積與受力方向。母材承載須來自另外的計算書。", "asset": "joints"}, {"index": 8, "title": "參數與規範", "start": 106.176, "audioStart": 106.976, "audioEnd": 123.296, "end": 124.096, "duration": 17.92, "text": "點選欄位可查看定義、資料來源和範例。台灣縱向受力檢查七十倍焊腳限制，國際端部受力檢查一百倍門檻。斷續焊每段另檢查四十毫米下限。", "asset": "parameters"}, {"index": 9, "title": "報告與離線", "start": 124.096, "audioStart": 124.896, "audioEnd": 140.277333, "end": 141.077333, "duration": 16.981333, "text": "詳細計算列出公式與代入值，可匯出可編輯的文字報告。完整離線包含影片與旁白，請保留媒體資料夾。單一網頁檔也能離線計算和閱讀逐字稿。", "asset": "report"}];
const video=$('tutorial-video');
$('tutorial-speed').onchange=()=>video.playbackRate=Number($('tutorial-speed').value);
document.querySelectorAll('[data-chapter]').forEach(b=>b.onclick=()=>{const seek=()=>{video.currentTime=tutorialChapters[Number(b.dataset.chapter)].start;};if(video.readyState>=1)seek();else{video.addEventListener('loadedmetadata',seek,{once:true});video.load();}});
video.addEventListener('timeupdate',()=>{document.querySelectorAll('[data-chapter]').forEach((b,i)=>b.classList.toggle('active',video.currentTime>=tutorialChapters[i].start&&video.currentTime<tutorialChapters[i].end));});
video.addEventListener('error',()=>$('video-status').textContent='影片尚未載入。離線請保留media資料夾與index.html相鄰；單一HTML可查閱下方逐字稿。');
updatePro();updateJoint();

const captionCues=[
  {
    "start": 0.89996,
    "end": 4.885861,
    "text": "先用範例核對，再換成工程資料。"
  },
  {
    "start": 4.835881,
    "end": 10.083775,
    "text": "按載入教學範例，材料、焊線和載重會一起更新。"
  },
  {
    "start": 10.083775,
    "end": 14.019695,
    "text": "已有案件時，請先匯出輸入資料。"
  },
  {
    "start": 15.797632,
    "end": 19.140294,
    "text": "選擇台灣或國際交叉基準。"
  },
  {
    "start": 19.086811,
    "end": 25.143714,
    "text": "容許應力法使用服務載重，極限設計使用已係數化載重。"
  },
  {
    "start": 25.143714,
    "end": 29.39558,
    "text": "焊腳是圖面的腳長，不是有效喉厚。"
  },
  {
    "start": 31.162197,
    "end": 36.599304,
    "text": "範例使用兩條三十公分焊線，間距二十公分。"
  },
  {
    "start": 36.543539,
    "end": 41.785467,
    "text": "端點採同一原點，橫向向右、縱向向上。"
  },
  {
    "start": 41.785467,
    "end": 45.159262,
    "text": "表格會顯示每條有效長度。"
  },
  {
    "start": 46.939461,
    "end": 51.20329,
    "text": "拖白色端點，調整焊接長度和方向。"
  },
  {
    "start": 51.152227,
    "end": 55.364993,
    "text": "拖藍色線段，整條平移並保持長度。"
  },
  {
    "start": 55.364993,
    "end": 60.599035,
    "text": "座標和利用率同步更新，按復原即可回到原配置。"
  },
  {
    "start": 62.363261,
    "end": 68.173179,
    "text": "範例在座標二十五、十五公分，輸入向下一萬公斤力。"
  },
  {
    "start": 68.122215,
    "end": 74.03406,
    "text": "位置造成的偏心力矩會自動計入，額外力矩不要重複填寫。"
  },
  {
    "start": 75.810101,
    "end": 82.349758,
    "text": "範例利用率約零點六零一，強度所需焊腳約三點六一毫米。"
  },
  {
    "start": 82.295374,
    "end": 89.990687,
    "text": "也要查看尺寸和有效長度檢核，數值符合不代表整個接合設計已完成。"
  },
  {
    "start": 91.757381,
    "end": 97.384094,
    "text": "其他形式頁提供全滲透、部分滲透、塞孔與塞槽焊。"
  },
  {
    "start": 97.334737,
    "end": 101.91261,
    "text": "先選形式，再核對有效面積與受力方向。"
  },
  {
    "start": 101.91261,
    "end": 105.318252,
    "text": "母材承載須來自另外的計算書。"
  },
  {
    "start": 107.083595,
    "end": 111.898468,
    "text": "點選欄位可查看定義、資料來源和範例。"
  },
  {
    "start": 111.844671,
    "end": 119.107329,
    "text": "台灣縱向受力檢查七十倍焊腳限制，國際端部受力檢查一百倍門檻。"
  },
  {
    "start": 119.107329,
    "end": 123.222835,
    "text": "斷續焊每段另檢查四十毫米下限。"
  },
  {
    "start": 124.995983,
    "end": 130.844968,
    "text": "詳細計算列出公式與代入值，可匯出可編輯的文字報告。"
  },
  {
    "start": 130.794977,
    "end": 135.8566,
    "text": "完整離線包含影片與旁白，請保留媒體資料夾。"
  },
  {
    "start": 135.8566,
    "end": 140.205845,
    "text": "單一網頁檔也能離線計算和閱讀逐字稿。"
  }
];
const captionsEnabled=$('video-captions');captionsEnabled.checked=location.protocol==='file:';if(captionsEnabled.checked)video.querySelector('track')?.remove();
function updateVideoCaption(){const cue=captionCues.find(c=>video.currentTime>=c.start&&video.currentTime<c.end),el=$('video-caption');el.hidden=!captionsEnabled.checked||!cue;el.textContent=cue?cue.text:'';}
captionsEnabled.onchange=()=>{if(captionsEnabled.checked)for(const t of video.textTracks)t.mode='disabled';updateVideoCaption();};
video.addEventListener('timeupdate',updateVideoCaption);video.addEventListener('seeked',updateVideoCaption);
video.addEventListener('loadedmetadata',()=>{for(const t of video.textTracks)t.mode=captionsEnabled.checked?'disabled':'showing';});
video.addEventListener('error',()=>$('video-status').textContent='影片無法載入。離線使用請確認media資料夾完整；仍可閱讀本頁逐字稿。');
