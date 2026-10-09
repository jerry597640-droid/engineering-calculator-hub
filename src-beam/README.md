# SRC 梁斷面分析設計工作台 v1.2

完整 ZIP 解壓後開啟 `src-beam/index.html`，可離線計算與播放影片；請保留旁邊的 `media` 資料夾。單檔 HTML 可離線計算，影片改連線上網址。計算引擎、SVG 斷面、操作說明、資料來源、示範案例及 35 項驗證摘要已內嵌。

線上：https://jerry597640-droid.github.io/engineering-calculator-hub/src-beam/
入口：https://jerry597640-droid.github.io/engineering-calculator-hub/

## 規範及範圍

台灣 SRC 規範（100 年修正）第五章強度疊加法；RC 子斷面參照 112 年混凝土規範、113 年勘誤之矩形應力塊及拉力控制要求。單位 cm、kgf/cm²、tf、tf-m。

只支援完全包覆、矩形常重混凝土、單支對稱 H 型鋼、強軸彎曲、無軸力／扭矩／開孔。鋼骨計算不含圓角。鋼骨與 RC 分別計算後相加；RC 淨混凝土壓力塊扣除鋼骨及主筋占用面積和一次矩，較全寬壓力塊保守。未確認錨定之主筋不計 RC 抗彎貢獻。剪力分別按標稱彎矩比例分配，RC 剪力取一般剪力及剪力摩擦的較小值。

未包含施工裸鋼梁穩定／強度／撓度、長期撓度、裂縫、梁柱接頭、伸展錨定、剪力釘設計、防火及 SRC 第九章完整耐震設計。結果只代表本頁明列之檢核範圍。

## 使用

1. 先載入範例，再依結構圖及材料規格修改混凝土、H 鋼與鋼筋。
2. 正負方向分別輸入因數化彎矩及同工況剪力絕對值。
3. 分層配筋輸入支數、號數、中心 y、第一／最後 x；或切換逐支座標。
4. 同時閱讀強度比與構造適用條件，不能只看容量。
5. 「配筋設計」搜尋四角配置的候選方案，可套用後再核對。
6. 「計算過程」列出正負彎矩的公式、數值代入、90 次中性軸迭代、混凝土淨壓力塊扣除量、逐支主筋應變／應力／降伏／力矩、拉力控制、抗彎疊加、兩種 RC 剪力與構造檢核，可列印為 PDF。完整迭代預設折疊，展開後亦可列印。
7. 輸入欄位旁的「？」可查定義、資料來源、範例、單位及影響；「參數字典」可搜尋 41 項輸入／結果定義。
8. 「儲存專案」下載 JSON 並嘗試保存在這個瀏覽器；「匯入專案」或「還原本機儲存」會重新驗算。請保留 JSON，跨裝置不要依賴本機儲存。
9. 「操作影片」包含約 3 分 11 秒的台灣女性旁白、燒錄中文字幕、10 個跳轉章節及 0.85 倍速。語音為 Microsoft zh-TW-HsiaoChenNeural；旁白文字可直接在網頁查閱。
10. 「下載單檔 HTML」保留目前輸入；「完整離線套件」ZIP 提供程式、影片、字幕與原始碼。

預設案例：b/h = 50/80 cm；H = 50/20/1/1.6 cm；fc′ = 280、Fys/Fyw = 3500、Fyr = 4200、Es = 2100000 kgf/cm²。頂部 y=8,14；底部 y=66,72，各層 2-D32、x=7,43。箍筋 2-D13@15，Fyh=2800；Avf=2.534 cm²、μ=.8、剪力釘貢獻0。正負 Mu=100 tf-m、Vu=35 tf。正負抗彎設計強度=145.168081 tf-m；鋼骨 Mns=73.372600、RC Mnrc=87.925268 tf-m。

## 驗證與重建

由專案父目錄執行：`python3 src-beam/independent_reference.py` 建立獨立 0.001 cm 切片積分基準；`node src-beam/test-engine.js` 驗證 35 項；`python3 src-beam/build.py` 產生單檔 `index.html`。`node src-beam/test-ui.cjs` 驗證主要操作；`node src-beam/test-detail.cjs` 驗證詳細報告、特殊狀態及手機／列印排版。`node src-beam/test-enhancements.cjs` 驗證參數字典、JSON 往返／拒絕無效專案、報告按需展開、10 章節、320–768px 操作及下載 HTML 重開。UI 測試使用 Playwright，可按環境調整 Chromium 路徑。

官方來源連結、條文關聯、所有輸入定義與限制均在內嵌說明中。數值驗證不等同整體工程設計審查。


## 2026-10-09 官方版本查核

- SRC 官方頁：https://www.nlma.gov.tw/ch/legislation/regsearch/977 。目前公開版仍為民國 100 年 3 月 24 日修正，100 年 7 月 1 日施行。
- RC 官方頁：https://www.nlma.gov.tw/ch/legislation/regsearch/6874 。112 年版，113 年 1 月 1 日施行，113 年 2 月 19 日勘誤。
- 113 年 SRC 修訂研究提出草案，不視為已發布新規範：https://www.abri.gov.tw/News_Content_Table.aspx?n=807&s=327815 。
- 條文矩陣在網頁「規範與驗算」；本次不更改原計算引擎及材料表。

## 建置相依與教學來源

`build.py` 會讀取父目錄的 `vendor/docx/docx-9.6.1.iife.js`、`shared/calculation-docx.js`、本資料夾的 `media/chapters.json` 與 `ui-enhancements.js`，保留 Word 匯出能力。ZIP 已附這些來源。教學影片可重製來源收錄在 `tutorial-source.zip`；其中包含旁白音訊、同步字詞時間點、實際介面截圖、HyperFrames composition 與檢查結果。影片 1280×720、24fps、H.264/AAC。
