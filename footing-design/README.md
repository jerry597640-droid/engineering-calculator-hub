# 基腳設計檢核工作台 v1.1

矩形等厚 RC 獨立基腳的地盤與構材檢核。臺灣《建築物混凝土結構設計規範》112年版含113年勘誤、《建築物基礎構造設計規範》112年版。查核日期2026-10-05。

## 開啟

- 線上： https://jerry597640-droid.github.io/engineering-calculator-hub/footing-design/
- 離線：直接用瀏覽器開啟 `index.html`；無外部程式、字型或計算服务。
- 入口： https://jerry597640-droid.github.io/engineering-calculator-hub/
- 操作說明已內嵌；另有 `驗算與操作說明.html`。
- 範例PDF：`置中基腳_計算範例.pdf`。

## 已實作

服務／因數化荷載分開輸入；每列保存同組合的軸力、兩向彎矩及水平力。基腳、覆土、柱墩自重及地下水浮力，水浮力有獨立組合係數。無拉力接觸面以截切多邊形精確積分，Newton法平衡N、Mx、My，可處理全接觸及單／雙向部分接觸。

地盤承載、滑動及趾點傾覆；柱面四側抗彎、各方向d斷面單向剪力、完整內柱d/2周界沖切與偏心彎矩傳遞試算；新版剪力鋼筋比公式、尺寸效應、最少底筋、高沖切柱帶最少筋、實際柱帶支數、矩形短向均勻增量、兩向有效深度與拉力控制、底筋直線伸展。圖示、即時計算、案例JSON匯入／匯出、單檔HTML下載與計算書列印／PDF。

## 範圍

單一矩形RC柱、常重混凝土、等厚矩形獨立基腳、無孔洞與剪力筋、無塗層竹節底筋。fc′175～700、fy2800～4200 kgf/cm²。qa由地工報告提供，土壓採有效接觸壓力定義；滑動與傾覆FS為可調專案準則，不自動宣告法定值。

PASS只代表已列檢核及目前組合通過。偏心接頭彎矩傳遞、反向彎矩、邊／角柱、部分接觸與採用側向土壓等條件標示REVIEW或NG。沉陷、液化、柱插筋、支承壓應力、彎鉤、抗浮專項安全係數、耐震連結及基腳內水平剪力另核。條形、聯合、筏式、樁帽、鋼柱底板及變厚基腳不適用本工具。

## 驗算

`node verify.cjs` 重現528項數值檢查，結果見 `validation-results.json`。包括三角形部分接觸解析解、80組雙向偏心獨立積分平衡、台灣新版剪力與高沖切最小筋、直線伸展及ACI官方範例的需求／幾何對照。ACI範例採舊版單向剪力式，未把舊容量當作新版驗算值。

UI檢查320、390、768、1440px，六個頁面無整頁水平溢出；驗證範例、無效資料、JSON往返與離線重開，0個JavaScript錯誤、0個離線網路請求。`engine.cjs` 是HTML內核心的同版副本供Node驗算；正式網頁不依賴它。

## 官方來源

- https://www.nlma.gov.tw/ch/legislation/regsearch/6874
- https://www.nlma.gov.tw/filesys/file/EMMA/c1130219-1.pdf
- https://www.nlma.gov.tw/ch/legislation/regsearch/962
- https://www.nlma.gov.tw/filesys/file/EMMA/a1120620.pdf
- https://www.concrete.org/Portals/0/Files/PDF/318-Example-1_RF_R1.pdf
