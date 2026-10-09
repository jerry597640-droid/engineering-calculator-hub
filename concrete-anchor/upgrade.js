/* v2: source-linked field dictionary, accessible contextual help, narrated tutorial. */
(()=>{'use strict';
const sources=FIELD_SOURCE_DATA;
const detail={
vsaSeis:['Vsa,seis','產品認證','後置式耐震用鋼材標稱剪力，須取模擬地震試驗值。單位kgf，未乘φ或灌漿0.8；0為缺資料。','適用型號、埋深及工況的產品耐震認證試驗','17.10.3'],
name:['工程與載重組合識別','案件與材料','例如：設備基座／ULS-01；每一完整組合另存案件。','設計案件清單與結構計算書','識別用途'],
type:['錨定受力機制','案件與材料','依實際預埋、機械後置或黏結機制選擇，圖示同步切換。','設計詳圖、產品認證與安裝手冊','17.1／17.3'],
metric:['公制粗牙面積快捷值','案件與材料','M20 載入2cm及2.45cm²；仍應核對產品與剪力面。','螺紋標準及產品有效截面','17.6.1／17.7.1'],
da:['dₐ','案件與材料','標稱桿徑；20mm應填2cm。不可將mm數字直接填入。','製造圖、型號尺寸表','17.2'],
AsN:['Ase,N','案件與材料','受拉有效鋼材斷面，扣除螺牙或縮頸影響；M20範例2.45。','材料證明與產品認證有效面積表','17.6.1'],
AsV:['Ase,V','案件與材料','剪力面上的有效面積；剪力面位於螺牙時須採相應有效斷面。','剪力面位置圖、產品認證','17.7.1'],
fy:['fya','案件與材料','錨栓鋼材降伏強度。2400kgf/cm²約235.4MPa。','該批鋼材試驗證明','17.6.1'],
fu:['futa','案件與材料','極限抗拉強度；容量計算限制為min(fu,1.9fy,8750)。','鋼材拉伸試驗證明','17.6.1／17.7.1'],
ductile:['韌性鋼材條件','案件與材料','是否符合規範韌性條件影響φ。須有伸長率與斷面縮減率依據。','材料試驗與規範韌性定義','17.2／表17.5.3'],
hef:['hₑf','案件與材料','混凝土表面至有效錨定受力位置的深度；不是總長或鑽孔深度。範例20cm。','錨定詳圖、產品認證與施工尺寸','17.2／17.6'],
Ab:['Abrg','案件與材料','擴頭抵壓混凝土的淨面積＝頭部承壓面積－桿身截面。範例8cm²。','頭部製造尺寸圖','17.6.3'],
eh:['eₕ','案件與材料','彎鉤有效伸出長度；本模式檢查3da≤eh≤4.5da。','J/L型彎鉤詳圖','17.6.3'],
fc:['f′c','混凝土與配置','指定抗壓強度。範例280kgf/cm²約27.46MPa，非280MPa。','結構圖與混凝土強度報告','17.3'],
ha:['hₐ','混凝土與配置','沿埋設方向至背面自由表面的構材總厚度。範例40cm。','混凝土剖面圖、現場量測','17.2／17.9'],
nx:['nₓ','混凝土與配置','X向列數1～3；nx×ny為總支數，最多9支。','基板及錨栓平面配置圖','本工具矩形規則群錨'],
ny:['nᵧ','混凝土與配置','Y向列數1～3；範例nx=ny=2為四支。','基板及錨栓平面配置圖','本工具矩形規則群錨'],
sx:['sₓ','混凝土與配置','相鄰錨栓X向中心間距，非桿身淨距。單列不作用。範例20cm。','錨栓中心定位圖','17.9'],
sy:['sᵧ','混凝土與配置','相鄰錨栓Y向中心間距。範例20cm。','錨栓中心定位圖','17.9'],
cL:['cL','混凝土與配置','最左列錨栓中心至左自由邊；不是群錨中心至邊。範例25cm。','平面尺寸圖與現場量測','17.6／17.7／17.9'],
cR:['cR','混凝土與配置','最右列錨栓中心至右自由邊。範例25cm。','平面尺寸圖與現場量測','17.6／17.7／17.9'],
cB:['cB','混凝土與配置','最下列錨栓中心至下自由邊（−y）。範例25cm。','平面尺寸圖與現場量測','17.6／17.7／17.9'],
cT:['cT','混凝土與配置','最上列錨栓中心至上自由邊（＋y）。範例25cm。','平面尺寸圖與現場量測','17.6／17.7／17.9'],
cracked:['開裂／未開裂','混凝土與配置','預設開裂。要取消，需證明使用載重及收縮等作用下錨定區不開裂。','結構使用性、收縮與應力分析','17.6／17.7'],
N:['Nu','因數化載重','整組因數化軸拉力，拉為正；範例8tf。不得再乘載重因數。','結構分析完整載重組合、設備反力','第5章／17.5'],
Mx:['Mx','因數化載重','對群中心彎矩，正值使＋y側增拉。範例0.3tf·m；包含剪力作用高度效應。','結構分析與荷載作用點轉換','剛性基板彈性分配'],
My:['My','因數化載重','本工具正值使＋x側增拉。範例0.2tf·m；請核對外部軟體符號。','結構分析與群中心轉換','剛性基板彈性分配'],
Vx:['Vx','因數化載重','整組剪力，正值向右（＋x）；範例1.2tf。','完整因數化載重組合','17.7'],
Vy:['Vy','因數化載重','整組剪力，正值向上（＋y）；範例0.6tf。','完整因數化載重組合','17.7'],
Tz:['Tz','因數化載重','對群中心平面扭矩，正值逆時針。範例0.1tf·m。','完整因數化載重組合及作用點','彈性扭剪分配'],
sustained:['Ns/N','因數化載重','0～1。整組模式依各支拉力乘此比例求Ns；例如0.6代表60%。不同持續分布用逐支模式。','持續載重分解與長期受力分析','17.6.5／17.5'],
np:['Np','產品認證','認證基本標稱拔出強度，尚未乘φ。0代表缺資料；不能填產品容許拉力。','對應型號、埋深、開裂狀態之認證表','17.6.3'],
tauCr:['τcr','產品認證','開裂特徵握裹應力。依適用溫濕度、載重型態取認證值，不能用膠體抗拉強度。','黏結式產品認證特徵握裹表','17.6.5'],
tauUn:['τuncr','產品認證','未開裂特徵握裹應力；計算cNa仍需要，即使本案選開裂。','同一產品／環境之認證報告','17.6.5'],
category:['安裝敏感度1／2／3','產品認證','由認證指定，影響拉破及拔出強度折減係數；不能自行選1。','產品認證分類表','表17.5.3'],
cac:['cac','產品認證','用於劈裂修正的臨界邊距；0使用本版規範預設。不能與產品最小邊距混用。','產品認證及表17.9.5','17.9.5'],
prodS:['smin','產品認證','允許安裝的最小中心間距；不代表可忽略群錨影響。','對應型號及埋深的認證尺寸表','17.9'],
prodC:['cmin','產品認證','產品允許最小中心邊距；保護層、粒料及破壞容量另需檢核。','產品認證最小邊距表','17.9'],
prodH:['hmin','產品認證','產品允許最小構材厚度，須對應指定埋深。','產品認證尺寸表','17.9'],
prodMinHef:['hef,min','產品認證','該產品認證的有效埋深下限；不可超出認證範圍外插容量。','產品認證埋深範圍表','17.3／17.9'],
prodMaxHef:['hef,max','產品認證','該产品認證的有效埋深上限；鑽孔長度另按安裝手冊。','產品認證埋深範圍表','17.3／17.9'],
report:['證明文件識別','產品認證','填報告編號、日期／版次、型號及材料批次，便於追溯。','有效認證報告與材料證明','17.3／第26章'],
qualified:['適用條件確認','產品認證','逐項確認開裂、鑽清孔、濕度、溫度、方向、養護與有效斷面。勾選不會自動產生產品容量。','產品認證與現場施工紀錄','17.3／第26章'],
age:['安裝齡期','產品認證','安裝當日距澆置的日數；黏結式至少21日，並符合產品規定。','澆置、強度與安裝紀錄','17.3'],
seismic:['耐震設計啟用','耐震與細部','依工程設計需求確認。本工具採已放大地震分量的載重路徑，需外部分析。','結構耐震設計說明','17.10'],
seisPath:['Ωo載重路徑已確認','耐震與細部','只放大地震分量E，再形成完整載重組合。不能將全部N、V一律乘Ωo代替。','耐震載重組合計算書','17.10.5.3(d)／17.10.6.3(c)'],
seisQualified:['後置耐震資格','耐震與細部','確認認證覆蓋實際產品、混凝土、埋深與耐震條件；仍須分析載重。','產品耐震試驗及認證','17.10.3'],
plasticHinge:['塑鉸區位置','耐震與細部','可能形成塑鉸區需專項設計，本工具列待檢核而非完成。','結構塑鉸分布與耐震設計圖','17.10.2'],
supp:['輔助鋼筋條件','耐震與細部','須跨潛在破壞面且有合適錨定與配置。不等同以錨定鋼筋代替混凝土破壞容量。','配筋圖及發展長度計算','17.5'],
edgeRebar:['ψc,V配置','耐震與細部','無／未確認為1.0；符合D13邊緣筋1.2，並符合密箍條件1.4。不可僅憑有鋼筋就選較大值。','邊緣筋、箍筋與錨定詳圖','17.7.2.5.1'],
torqued:['安裝扭力條件','耐震與細部','預埋螺栓是否受安裝扭力影響最小间距與邊距；依實際施工程序。','施工扭力規定與紀錄','17.9'],
headWidth:['錨定端包絡寬','耐震與細部','鋼材錨定端最外尺寸，用於端部保護層檢查。','製造圖及剖面','20.5.1／17.9'],
tipExtra:['超出有效錨定點深度','耐震與細部','有效受力點至鋼材最底端尺寸，例如頭部厚度；範例1.5cm。','錨定端剖面製造圖','20.5.1／17.9'],
cover:['淨保護層','耐震與細部','依暴露、接觸土壤等條件指定。中心邊距與淨保護層差半徑等幾何尺寸。','20.5.1與工程圖說','20.5.1'],
aggregate:['最大粒料','耐震與細部','混凝土配比的最大粒料尺寸；後置最小邊距另檢查2倍粒料。','混凝土配比與出貨單','17.9'],
grout:['基板灌漿','耐震與細部','基板下灌漿層會使本式鋼材剪力乘0.80；懸空段彎曲須專項處理。','基板剖面與灌漿施工圖','17.7.1.2.1'],
leMode:['ℓe','耐震與細部','一般模式min(hef,8da)；具分離定距套筒產品採2da。','產品受剪構造圖','17.7.2'],
manualN:['Ni','逐支與搜尋','逐支因數化拉力，tf，拉力正；外部模型須含底板接觸與撬力。','底板／錨栓非線性或合理分析','17.5'],
manualV:['Vxi／Vyi','逐支與搜尋','逐支有正負號剪力，tf；合力由程式計算，正向同平面坐標。','外部錨栓受力分析','17.7'],
manualNs:['Nsi','逐支與搜尋','逐支持續拉力，tf，0≤Ns≤N；不是整組持續拉力。','持續載重組合的逐支分析','17.6.5'],
scanMin:['搜尋下限','逐支與搜尋','有效埋深搜尋起點cm，須落在認證埋深及構材可用範圍。','允許埋深範圍與厚度圖','每0.5cm搜尋'],
scanMax:['搜尋上限','逐支與搜尋','有效埋深搜尋終點cm；候選全部檢查幾何、容量及資料完整性。','產品認證與構材尺寸','候選通過後仍需套用'],
outUnit:['結果顯示單位','逐支與搜尋','tf／kgf／kN僅切換輸出。輸入力仍為tf、彎矩tf·m；1tf=9.80665kN。','精確單位換算','1kgf=9.80665N']
};
const defs=Object.entries(detail).map(([key,d])=>({key,symbol:d[0],group:d[1],definition:d[2],source:d[3],reference:d[4],label:fields[key]?.[0]||d[0],unit:fields[key]?.[1]||(['scanMin','scanMax'].includes(key)?'cm':key.startsWith('manual')?'tf':''),hint:sources[key]?.instruction||'',example:Object.hasOwn(E.DEFAULT,key)?(typeof E.DEFAULT[key]==='boolean'?(E.DEFAULT[key]?'勾選':'不勾選'):E.DEFAULT[key]):'依本案資料'}));
window.AnchorParameterDefinitions=defs;
const nav=document.querySelector('.nav'),workspace=document.querySelector('.workspace');
for(const [key,label]of [['parameters','05　參數字典'],['tutorial','06　操作影片'],['code','07　規範依據']]){const b=document.createElement('button');b.dataset.tab=key;b.textContent=label;nav.append(b)}
workspace.insertAdjacentHTML('afterbegin','<div class="version-line"><span class="badge">工作台 v2.0</span><span>台灣112年版＋113勘誤 · 核對2026-10-09</span><button data-tab="code">查看規範依據</button></div><div class="workflow" aria-label="快速定位"><button data-jump="materialFields">① 材料</button><button data-jump="geometryFields">② 配置</button><button data-jump="globalFields">③ 載重</button><button data-jump="productFields">④ 認證</button><button data-jump="overall">⑤ 結果</button><button data-tab="tutorial">觀看教學</button></div>');
workspace.insertAdjacentHTML('beforeend',`<div id="view-parameters" class="wide help" hidden><section class="panel"><div class="panel-head"><h2>輸入參數字典</h2><span class="badge">${defs.length}項定義</span></div><div class="panel-body"><p>輸入前查符號、單位、填法與來源。預設值用於教學範例，實案請填入可追溯資料。</p><div class="parameter-tools"><input id="parameterSearch" type="search" aria-label="搜尋參數" placeholder="搜尋：埋深、hef、邊距、認證…"><select id="parameterGroup" aria-label="參數類別"><option value="">全部類別</option>${[...new Set(defs.map(d=>d.group))].map(g=>`<option>${esc(g)}</option>`).join('')}</select></div><p id="parameterCount" role="status" class="step-count"></p><div id="parameterCards" class="parameter-grid"></div></div></section></div><div id="view-tutorial" class="wide help" hidden><section class="panel"><div class="panel-head"><h2>操作影片 · 中文旁白</h2><span class="badge">可按章節跳轉</span></div><div class="panel-body"><video id="tutorialVideo" class="tutorial-video" controls playsinline preload="metadata" aria-label="混凝土錨栓工作台操作教學"></video><div class="video-commands"><button id="loadTutorial" class="primary">載入操作影片</button><button id="saveTutorial">下載MP4</button></div><p id="tutorialStatus" role="status">含中文旁白與畫面字幕；下方提供完整文字稿。首次載入需下載影片資料。</p><div id="tutorialChapters" class="video-commands"></div><details><summary>旁白文字稿與操作步驟</summary><div id="tutorialTranscript"></div></details><div class="note">離線版內含影片，無網路也能播放。教學以預埋M20範例示範；後置式必須另填實際產品認證值。</div></div></section></div><div id="view-code" class="wide help" hidden><section class="panel"><div class="panel-head"><h2>現行規範、版本與實作範圍</h2><span class="badge">2026-10-09核對</span></div><div class="panel-body"><div class="code-status"><strong>計算模式：台灣112年版《建築物混凝土結構設計規範》第17章，含113年勘誤。</strong><p>國土管理署公布頁截至核對日列示112年8月10日修正、113年1月1日施行及113年2月19日勘誤。程式沿用該版本的單位制係數與互制方法。</p></div><h3>規範與計算的對應</h3><div class="table-wrap"><table class="code-table"><thead><tr><th>內容</th><th>章節</th><th>工具行為</th></tr></thead><tbody><tr><td>需求、設計強度與φ</td><td>17.5／表17.5.3</td><td>輸入因數化需求；列示標稱強度、φ與設計強度</td></tr><tr><td>鋼材、拉破、拔出、側面爆裂、握裹</td><td>17.6</td><td>列示逐步公式、幾何投影、群錨與偏心修正</td></tr><tr><td>鋼材剪力、剪破、撬破</td><td>17.7</td><td>剪力方向及子群包絡；灌漿層修正</td></tr><tr><td>拉剪互制</td><td>17.8</td><td>依台灣版門檻、個別容量及互制條件判定</td></tr><tr><td>間距、邊距、厚度</td><td>17.9／20.5.1</td><td>產品認證限制及使用者指定保護層</td></tr><tr><td>耐震</td><td>17.10</td><td>採外部Ωo載重路徑；後置鋼材剪力採認證模擬地震試驗值，缺值待補；塑鉸區另算</td></tr><tr><td>施工與認證</td><td>第26章</td><td>需查產品適用條件與施工紀錄；缺資料列待補</td></tr></tbody></table></div><h3>ACI 318-25 更新追蹤</h3><p>ACI官方更新課程列出拉剪互制、錨定鋼筋及產品資格等更新。ACI 318-25與台灣现行版為不同設計依據，本工具尚未實作完整ACI 318-25計算模式，故不能產出ACI 318-25合規判定。需要該版案件時，應取得完整官方條文及產品資料再作專項分析。</p><h3>適用範圍</h3><p>常重混凝土、規則矩形1～9支群錨；整組模式採剛性底板彈性分配。底板接觸、撬力、錨栓彎曲、剪力榫、錨定鋼筋替代CCD、塑鉸及特殊狹窄幾何需外部專項設計。結果「待補」不等於符合。</p><h3>官方來源</h3><ul><li><a href="https://www.nlma.gov.tw/ch/legislation/regsearch/6874" target="_blank" rel="noopener">國土管理署：公布與勘誤</a></li><li><a href="https://www.nlma.gov.tw/uploads/files/011d9249cac7d6c5547786aa348e352a.pdf" target="_blank" rel="noopener">台灣現行規範全文PDF</a></li><li><a href="https://www.nlma.gov.tw/uploads/files/40e4370d2726960efcc41074b2d99f53.pdf" target="_blank" rel="noopener">113年勘誤PDF</a></li><li><a href="https://aciuniversity.concrete.org/Listing/ACI-318-25-Code-Changes-Part-2-%E2%80%93-Reinforcement-Anchorage-and-Shear-2774" target="_blank" rel="noopener">ACI官方318-25更新：錨栓、鋼筋與剪力</a></li></ul></div></section></div>`);
const oldSwitch=switchTab;switchTab=function(tab){oldSwitch(tab);for(const t of ['parameters','tutorial','code'])$('view-'+t).hidden=t!==tab;document.querySelector('.workflow').hidden=tab!=='calc';};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
function jump(key){switchTab('calc');let el=$(key);if(!el)return;for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;el.classList.add('return-focus');el.scrollIntoView({behavior:'smooth',block:'center'});if(el.matches('input,select'))el.focus({preventScroll:true})}
document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>jump(b.dataset.jump));
const dialog=document.createElement('dialog');dialog.className='parameter-dialog';dialog.innerHTML='<div id="parameterDialogBody"></div><div class="dialog-actions"><button id="parameterLocate">前往欄位</button><button id="parameterClose" class="primary">關閉</button></div>';document.body.append(dialog);let helpKey;
function content(d){return `<h3>${esc(d.label)}</h3><p><span class="badge">${esc(d.symbol)}${d.unit?' · '+esc(d.unit):' · 無因次／選項'}</span></p><p><strong>定義與填法</strong><br>${esc(d.definition)}</p><p><strong>資料來源</strong><br>${esc(d.source)}</p><p><strong>範例／預設</strong>：${esc(d.example)}</p><p><strong>對應條文／模型</strong>：${esc(d.reference)}</p>`}
function showHelp(key){const d=defs.find(d=>d.key===key);if(!d)return;helpKey=key;$('parameterDialogBody').innerHTML=content(d);$('parameterLocate').hidden=!$(key);dialog.showModal()}
$('parameterClose').onclick=()=>dialog.close();$('parameterLocate').onclick=()=>{dialog.close();jump(helpKey)};
for(const [key]of Object.entries(fields)){const el=document.querySelector(`[data-field="${key}"]`);if(!el)continue;const b=document.createElement('button');b.type='button';b.className='field-help';b.textContent='ⓘ 定義與來源';b.setAttribute('aria-label',fields[key][0]+'：定義與來源');b.onclick=()=>showHelp(key);el.append(b)}
for(const k of ['scanMin','scanMax','outUnit']){const el=$(k);const b=document.createElement('button');b.className='field-help';b.textContent='ⓘ';b.setAttribute('aria-label',detail[k][0]+'說明');b.onclick=()=>showHelp(k);el.after(b)}
$('manualInputs').insertAdjacentHTML('afterbegin','<div class="video-commands"><button data-param="manualN">拉力N定義</button><button data-param="manualV">剪力V定義</button><button data-param="manualNs">持續拉力Ns定義</button></div>');document.querySelectorAll('[data-param]').forEach(b=>b.onclick=()=>showHelp(b.dataset.param));
function renderDictionary(){const q=$('parameterSearch').value.trim().toLowerCase(),g=$('parameterGroup').value,list=defs.filter(d=>(!g||d.group===g)&&(!q||Object.values(d).join(' ').toLowerCase().includes(q)));$('parameterCount').textContent=`顯示${list.length}／${defs.length}項`;$('parameterCards').innerHTML=list.map(d=>`<article class="parameter-card">${content(d)}<small>${esc(d.group)}</small>${$(d.key)?`<p><button data-locate="${d.key}">前往輸入欄位</button></p>`:''}</article>`).join('')||'<p>查無相符參數；可試「埋深」或「hef」。</p>';document.querySelectorAll('[data-locate]').forEach(b=>b.onclick=()=>jump(b.dataset.locate))}
$('parameterSearch').oninput=renderDictionary;$('parameterGroup').onchange=renderDictionary;renderDictionary();
const meta=window.AnchorTutorialMeta||{chapters:[],chunks:[]};$('tutorialTranscript').innerHTML=meta.chapters.map(c=>`<div class="transcript-entry"><strong>${esc(c.title)}</strong><p>${esc(c.text)}</p></div>`).join('');
$('tutorialVideo').poster='data:image/svg+xml;charset=utf-8,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#102a43"/><circle cx="640" cy="300" r="65" fill="#057a85"/><path d="M623 267L623 333L674 300Z" fill="white"/><text x="640" y="445" text-anchor="middle" fill="white" font-family="sans-serif" font-size="42">混凝土錨栓操作教學</text><text x="640" y="512" text-anchor="middle" fill="#ffc65c" font-family="sans-serif" font-size="28">中文旁白 · 五個章節 · 點選下方載入影片</text></svg>');
let mediaPromise,mediaUrl;
async function loadMedia(){if(mediaUrl)return mediaUrl;if(mediaPromise)return mediaPromise;mediaPromise=(async()=>{const b=$('loadTutorial');b.disabled=true;$('tutorialStatus').textContent='載入中文旁白影片中…';try{window.AnchorTutorialChunks=window.AnchorTutorialChunks||[];if(!window.AnchorTutorialOffline){const response=await fetch('tutorial/anchor-tutorial.mp4');if(!response.ok)throw Error('影片載入失敗，請連線後重試。');const data=new Uint8Array(await response.arrayBuffer());const encoded=[];for(let offset=0;offset<data.length;offset+=262144){let binary='';for(const value of data.subarray(offset,offset+262144))binary+=String.fromCharCode(value);encoded.push(btoa(binary))}window.AnchorTutorialChunks=encoded};const chunks=window.AnchorTutorialChunks;if(!chunks.length||chunks.length!==meta.chunkCount)throw Error('影片資料不完整');const bytes=chunks.map(x=>Uint8Array.from(atob(x),c=>c.charCodeAt(0)));mediaUrl=URL.createObjectURL(new Blob(bytes,{type:'video/mp4'}));$('tutorialVideo').src=mediaUrl;$('tutorialStatus').textContent='影片已就緒，按播放即可。內含中文旁白與字幕。';return mediaUrl}catch(e){window.AnchorTutorialChunks=[];mediaPromise=null;$('tutorialStatus').textContent=e.message;throw e}finally{b.disabled=false}})();return mediaPromise}
$('loadTutorial').onclick=()=>loadMedia().then(()=>$('tutorialVideo').play()).catch(()=>{});$('saveTutorial').onclick=()=>loadMedia().then(url=>{const a=document.createElement('a');a.href=url;a.download='Concrete_Anchor_Tutorial_zh-TW.mp4';a.click()}).catch(()=>{});
$('tutorialChapters').innerHTML=meta.chapters.map((c,i)=>`<button data-chapter="${i}">${esc(c.title)}</button>`).join('');document.querySelectorAll('[data-chapter]').forEach(b=>b.onclick=()=>loadMedia().then(()=>{const v=$('tutorialVideo');v.currentTime=meta.chapters[Number(b.dataset.chapter)].start;return v.play()}).catch(()=>{}));
$('downloadOffline').onclick=async()=>{const b=$('downloadOffline');b.disabled=true;try{await loadMedia();const clone=document.documentElement.cloneNode(true);clone.querySelectorAll('[data-v2-generated]').forEach(n=>n.remove());clone.querySelector('#toast').hidden=true;clone.querySelector('#downloadOffline').disabled=false;clone.querySelector('#projectFile').value='';for(const t of ['calc','process','help','validation'])clone.querySelector('#view-'+t).hidden=t!=='calc';clone.querySelectorAll('[data-tab]').forEach(n=>{n.classList.toggle('active',n.dataset.tab==='calc');n.removeAttribute('aria-current')});clone.querySelectorAll('dialog').forEach(d=>d.removeAttribute('open'));clone.querySelectorAll('script[src]').forEach(s=>s.remove());clone.querySelectorAll('[data-offline-media]').forEach(s=>s.remove());const seed=clone.querySelector('#offline-case')||document.createElement('script');seed.type='application/json';seed.id='offline-case';seed.textContent=JSON.stringify(state).replace(/</g,'\\u003c');if(!seed.parentNode)clone.querySelector('head').append(seed);const media=document.createElement('script');media.dataset.offlineMedia='true';media.textContent='window.AnchorTutorialOffline=true;window.AnchorTutorialChunks='+JSON.stringify(window.AnchorTutorialChunks)+';';clone.querySelector('head').append(media);download('<!doctype html>\n'+clone.outerHTML,'Concrete_Anchor_Offline_v2.html','text/html;charset=utf-8');notify('離線版已下載，內含本案資料、計算工具與旁白影片。')}catch(e){notify('未下載：'+e.message)}finally{b.disabled=false}};
document.querySelectorAll('#view-parameters,#view-tutorial,#view-code,.version-line,.workflow,.parameter-dialog,.field-help,[data-param],.nav [data-tab=parameters],.nav [data-tab=tutorial],.nav [data-tab=code]').forEach(n=>n.dataset.v2Generated='true');
document.querySelector('.side-note div:last-child').innerHTML='v2.0 · 2026.10<br>離線計算與中文旁白教學。';
document.querySelector('.footer').textContent='錨栓設計工作台 v2.0 · 規範核對2026-10-09 · 本機計算 · 含中文旁白操作影片';
})();
