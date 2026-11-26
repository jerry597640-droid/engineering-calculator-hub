// In-page manual: no calculation state is changed when help opens.
(()=>{
 const sections=[
 ['新版斷面複核與影片',`<p>首頁「操作影片・台灣女聲」提供六段影片與字幕。規範核對頁新增獨立斷面檢查，使用主表材料、板厚及所選位置實配筋，另輸入下列資料。</p>${table([['實際 d（cm）','受壓緣至受拉鋼筋重心距離。','配筋剖面；扣除淨保護層、半徑與層位。'],['Mu（tf·m/m）','同一板帶的設計彎矩絕對值。','外部結構分析及適用載重組合包絡。'],['Vu（tf/m）','單向剪力需求，不是沖切或整板總剪力。','外部分析的臨界斷面剪力包絡。'],['複核位置／板系統','取用該位置 As 與間距；選實際單向或雙向系統。','配筋圖、傳力分析；不能只依跨比。']])}<p>Mu、Vu、d 初值為示範；修改主表不會自動更新這三個值。一般斷面四項通過，仍需完成沖切、撓度、錨定與其他適用檢查。112 年版含 113 年勘誤，版本查核日 2026-10-10。</p>`],
 ['快速開始與手機操作',`<ol><li>備妥結構平面圖、配筋圖、結構總說明及載重計算表。</li><li>輸入幾何、邊界、材料與面載重，再選鋼筋號數。</li><li>在分析結果逐處輸入實配間距，或使用「套用六處」。</li><li>依序查看分析檢核、詳細公式、規範核對，最後匯出 Word。</li></ol><p>桌面：左側輸入、右側分析，各面板可獨立捲動。手機：底部「設計參數／分析結果／計算報告」切換。修改數值即時計算；操作說明關閉後保留當下輸入。「還原範例」會重設計算參數；預設值僅供操作示範。</p>`],
 ['幾何與邊界｜跨度、板厚、保護層',table([
 ['短跨 S／長跨 L','填較短／較長方向跨度（m），需 0 < S ≤ L。','結構平面、梁柱配置圖。須確認採用淨跨、中心距或有效跨度；程式不會自動扣梁寬，原係數法跨度前提仍待確認。'],
 ['樓板厚度 h','填結構板厚（cm），不含一般裝修面層。','樓板表、配筋圖、剖面圖；輸入後自動計算板自重。'],
 ['原程式保護層 c','填原程式有效深度扣除尺寸（cm），0 ≤ c < h。','結構總說明、配筋剖面。程式採 d=h−c，未另扣鋼筋半徑，也未區分兩方向層位，不能視為已完整處理實際有效深度。'],
 ['邊界條件','依四邊實際連續情況選擇，核對右側實線／虛線。','相鄰板跨、支承、端部上層筋及錨定詳圖；不能只憑有沒有梁判斷。']])+`<p><strong>連續邊</strong>具有支承處彎矩連續條件；<strong>不連續邊仍有支承，不是自由邊</strong>。DSL＝兩條長邊中不連續邊數；DSS＝兩條短邊中不連續邊數，皆為 0～2，由選項自動決定。懸臂或自由邊不能直接套用本選項。</p>`],
 ['材料與面載重｜f′c、fy、額外 D、活載重',table([
 ['混凝土 f′c','設計抗壓強度（kgf/cm²）。','結構總說明、強度分區表。既有結構依評估目的及試驗資料決定採用值。'],
 ['鋼筋 fy','設計降伏強度（kgf/cm²）。','結構總說明、材料規格；既有建物配合竣工資料與材料調查。'],
 ['額外靜載重 D','樓板自重以外的永久面載重（tf/m²），不得重複加入板自重。','裝修表、剖面、隔間圖、設備資料及載重計算表。'],
 ['活載重 Lₗ','實際用途對應的活載重（tf/m²）。','適用建築載重規定、核定用途及專案設計準則。住宅、走廊、倉儲等須分別確認。']])+`<p>1 tf/m²＝1,000 kgf/m²；200 kgf/m² 請輸入 <strong>0.200</strong>。單位重固定採 2.4 tf/m³，特殊或輕質混凝土不能直接沿用。</p>`],
 ['額外靜載重的資料來源與計算範例',table([
 ['地坪、砂漿、整平層','各層厚度（m）×單位重（tf/m³）後加總。','裝修詳圖、材料規格。'],
 ['防水、隔熱、天花與固定管線','各層或系統單位面積重量。','屋頂剖面、產品資料、天花與機電設計。'],
 ['隔間牆','依重量、配置及合理載重模型處理。','隔間圖、牆厚、牆高與材料單位重。'],
 ['固定設備','依重量與實際傳力方式處理。','設備型錄、基座圖、支點反力。']])+`<p>牆體線載重與設備集中載重不能一律除以整片面積後代入；本工具主要採均布面載重，局部受力須另行分析。</p><div class="help-example">示範：h＝20 cm、額外 D＝0.440、活載重＝0.200 tf/m²<br>自重＝20÷100×2.4＝<strong>0.480 tf/m²</strong><br>D總＝0.480＋0.440＝0.920 tf/m²<br>wᵤ＝1.2×0.920＋1.6×0.200＝<strong>1.424 tf/m²</strong></div><p>額外 D 應填 0.440，不能填 0.920，否則自重重複計入。此為原程式組合示範，其他必要組合請看規範核對。</p>`],
 ['實配鋼筋｜號數、間距與六個位置',table([
 ['統一鋼筋號數','選 #3～#11，六處共用相同號數。','樓板配筋圖、鋼筋配置表；不同位置採不同號數時，本設定無法完整表達。'],
 ['統一實配間距','填 cm，再按「套用六處」。','設計配置或實際配筋資料；套用後仍可逐處修改。'],
 ['各列實配間距','填鋼筋中心間距（cm），不是淨距。','圖面 #4@150 mm → 選 #4、間距填 15 cm。']])+`<ul><li>短向／長向「連續端 −M」：各方向連續支承附近負彎矩區，查支承上層筋。</li><li>短向／長向「不連續端 −M」：各方向不連續支承端部區，查端部上層筋與錨定。</li><li>短向／長向「跨中 +M」：各方向跨中正彎矩區，查跨中下層筋。</li></ul><p>以上對應一般重力載重。進入單向板分支時，長向三欄依原碼均為最小分布筋。實配 Aₛ＝單支面積×100÷間距（cm），單位 cm²/m。</p>`],
 ['結果表格｜每一欄的意思',table([
 ['C × 10³','自動顯示原碼彎矩係數的 1,000 倍；58 即 C＝0.058。','原始係數表與邊界分支，不需填寫。'],
 ['|Mᵤ|','每公尺板帶設計彎矩絕對值（tf·m/m）。','程式計算；正負性質看列名。'],
 ['所需 Aₛ','需求鋼筋面積（cm²/m）。','原程式撓曲與最小鋼筋計算。'],
 ['原碼建議','原程式建議號數及間距。','仍須比對實配結果與規範核對。'],
 ['實配 Aₛ','配置的鋼筋面積（cm²/m）。','由號數及實配間距計算。'],
 ['結果','通過、面積不足、間距超限或無需求等。','原碼範圍內比較；「—」或無需求不代表可取消構造鋼筋。']])+`<p>表格只有「實配間距」需逐列填寫，其他欄位自動計算。</p>`],
 ['分析檢核、詳細公式與規範核對',`<ul><li><strong>分析檢核：</strong>查看板厚、剪力與配筋，紅色代表原碼條件下未通過。</li><li><strong>詳細公式：</strong>展開載重、查表、彎矩、配筋、板厚及剪力，核對代入值。</li><li><strong>完整原始係數表：</strong>不需填寫；來源為原始程式，疑似異常值保留並提示。</li><li><strong>規範核對：</strong>查看載重組合、最少鋼筋、間距及其他差異。需修正／待補算項目仍需完成。</li></ul><p><strong>原碼範圍內通過不等於完整符合現行規範。</strong>係數法適用性、實際有效深度、現行剪力、撓度、沖切及構造細節等尚未完整處理。原始計算來源為 Slab_20121009_SourceCode 的 Form1.vb；規範條文與官方連結請見「規範核對」。</p>`],
 ['計算書資料、Word 匯出與來源紀錄',table([
 ['工程名稱','正式工程名稱。','契約、圖說封面或專案資料。'],
 ['樓板編號','建議含樓層及板號，例如 3F－S1。','結構樓板平面圖。'],
 ['計算日期','本次計算或修訂日期。','實際作業日期。']])+`<p>按「匯出 Word 計算書」，依當下參數產生可編輯 .docx，含公式代入、六處配筋、板厚、剪力與規範核對。修改參數後需重新匯出。</p><p>目前沒有專用的資料來源輸入欄，請在匯出 Word 後補上圖號、版次、材料及載重依據，例如：</p><div class="help-example">幾何及配筋：結構圖 S-○○，○年○月○日版。<br>材料強度：結構總說明 S-○○。<br>額外靜載重：裝修圖 A-○○及載重計算表。<br>活載重：使用用途、適用條文及設計準則。</div>`]
 ];
 function table(rows){return '<table class="help-table"><thead><tr><th>欄位／項目</th><th>填寫方式／意義</th><th>資料來源／注意事項</th></tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map((c,i)=>`<td data-label="${['項目','填寫方式／意義','資料來源／注意事項'][i]}">${c}</td>`).join('')+'</tr>').join('')+'</tbody></table>';}
 const trigger=document.createElement('button');trigger.id='open-help';trigger.type='button';trigger.textContent='操作說明';trigger.setAttribute('aria-haspopup','dialog');document.querySelector('.header-right').prepend(trigger);
 const dialog=document.createElement('dialog');dialog.id='operation-help';dialog.setAttribute('aria-labelledby','help-title');dialog.innerHTML=`<div class="help-top"><div><h2 id="help-title">操作說明與資料來源</h2><p>依欄位查詢，帶著圖說就能逐步完成輸入。</p></div><button type="button" id="close-help" aria-label="關閉操作說明">關閉 ✕</button></div><div class="help-search"><label for="help-query">搜尋說明</label><input type="search" id="help-query" placeholder="例如：額外靜載重、保護層、間距、Word"><p id="help-count" role="status"></p></div><div class="help-content">${sections.map(([t,c],i)=>`<details class="help-section" ${i===0?'open':''}><summary>${String(i+1).padStart(2,'0')}　${t}</summary>${c}</details>`).join('')}<p id="help-empty" hidden>找不到相符說明，請改用「跨度」、「載重」或「配筋」等關鍵字。</p></div>`;
 document.body.append(dialog);trigger.addEventListener('click',()=>dialog.showModal());dialog.querySelector('#close-help').addEventListener('click',()=>dialog.close());
 const query=dialog.querySelector('#help-query'),items=[...dialog.querySelectorAll('.help-section')];
 query.addEventListener('input',()=>{const q=query.value.trim().toLowerCase();let count=0;items.forEach((item,i)=>{const match=!q||item.textContent.toLowerCase().includes(q);item.hidden=!match;item.open=q?match:i===0;if(match)count++;});dialog.querySelector('#help-count').textContent=q?`找到 ${count} 個相關章節`:'';dialog.querySelector('#help-empty').hidden=count>0;});
})();
