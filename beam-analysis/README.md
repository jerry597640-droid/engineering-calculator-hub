# 梁受力分析工作台 v1.2.0

以瀏覽器開啟 `index.html` 即可使用，所有計算皆在本機執行，無 CDN 或外部計算服務。

支援簡支、固定、懸臂、多跨與懸挑梁；集中力、集中彎矩、均布／三角／梯形分布載重、梁自重、支承沉陷、車軸移動與包絡。提供反力、截面剪力／彎矩、撓度與極值、已設計容量比對、使用載重相對撓度、JSON專案及CSV／HTML計算報告匯出。力單位可切換kN／tf／kgf，長度m、斷面cm系統。

連續梁快速設定可指定2～11跨，分別輸入各跨長度，或一鍵設為等跨。建立n＋1個支承，重設支承型式／沉陷，並可選擇延伸原全長分布載重；其他載重保持絕對座標。無效設定不覆寫原專案。新增三跨、四跨及4＋6＋5m不等跨範例。

輸入模型、載重、剛度或容量後，停頓約0.18秒即更新目前位置結果、反力及剪力／彎矩／撓度圖；保持輸入焦點，不重建正在編輯的輸入欄位。無效或未完成的輸入清空結果並顯示錯誤。車位滑桿立即更新圖形且保留已完成包絡。模型／載重／車輛其他資料改動會清除舊包絡；完整包絡與半步加密透過按鈕另行執行。

行車工作台有固定車位滑桿、精確座標、進場／置中／離場與半步微調，四組控制值可載入車位。可切換分析／使用組合包絡、疊加目前車位並讀取斷面左右側值；反力另有目前車位及包絡極值兩種檢視，避免誤把不同時刻極值合併。掃描精度選項顯示實際工作量及進度。

完整參數定義、資料來源、範例與官方規範連結均在「操作說明與範例」頁。容量需填規範來源與正確的使用／強度基準，不會以未提供的容量宣告通過。內建車為操作示例，非標準設計車。

輸入旁的問號可查定義、單位、來源及照填示例；說明內附搜尋辭典、結果如何接續RC／鋼梁／公路橋梁規範及查核版本。台灣中文女性旁白操作影片約3分鐘，附繁體字幕、六章節定位、逐字稿與MP4下載，嵌入離線HTML。詳見 `tutorial-source/README.md`。

## 分析範圍

全梁等EI、線性彈性、小變形、Euler–Bernoulli梁。沒有軸力、扭矩、二階效應、剪切變形、塑性、RC開裂歷程／長期徐變、梁內鉸、彈簧或單向接觸支承。RC配筋、鋼梁挫屈及接頭容量需由構材設計另行取得。車行為離散準靜態掃描，衝擊及橫向分配由專案輸入；加密差不代表連續解誤差保證。

本需求中的「邊坡檢核規範」不直接適用於梁。土壓與水壓可由大地分析換成梁載重，整體邊坡穩定另行檢核。

## 原始碼及驗證

`shell.html`、`styles.css`、`beam-core.js`、`parameters.js`、`app.js` 與 `tutorial-media.json` 組合為單檔：

```bash
python build.py
node tests/verify.cjs
node tests/verify-spans.cjs
python tests/verify-independent.py
python tests/verify-static.py
node tests/verify-ui.cjs
```

Python獨立驗算需NumPy及SciPy。引擎使用一致節點荷載及支承節點剛度矩陣；獨立驗算採整體平衡與變形相容，沒有重用有限元素公式。

GitHub CI另使用JSDOM驗證操作及離線ZIP；`node tests/verify-ui.cjs`。此為DOM測試，不提供真實瀏覽器的像素排版驗證。手機CSS、觸控及圖形字級已適配，真實裝置目視驗證另列。

## 官方來源（查核2026-10-11）

- 國土署建築物混凝土結構設計規範112年版，113-01-01生效，113-02-19勘誤：https://www.nlma.gov.tw/ch/legislation/regsearch/6874
- 國土署鋼構造建築物鋼結構設計技術規範現行頁，96年發布、99年部分修正：https://www.nlma.gov.tw/ch/legislation/regsearch/7176
- 交通部公路橋梁設計規範官方頁，109-01-03：https://www.motc.gov.tw/ch/app/divpubreg_list/view?id=740&module=divpubreg&serno=424
- MIT Beam Displacements：https://ocw.mit.edu/courses/3-91-mechanical-behavior-of-plastics-spring-2007/db3dd94238ceb7a9796bf5c7773afa0e_14_bdisp.pdf
- TU Delft Euler–Bernoulli beam elements：https://teachbooks.tudelft.nl/computational-modelling/structural_linear/euler_bernouilli.html

選單中的1.4D與1.2D+1.6L為RC純重力範例，其他作用與完整組合需依適用規範補入。橋梁設計車／車道、衝擊、分配、風震、疲勞及材料強度不會由此通用分析器自動確定。
