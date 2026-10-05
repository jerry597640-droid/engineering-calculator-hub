# RC 樓版剪力工作台 v1.0

單一 HTML、無外部依賴，可在 GitHub Pages 或本機離線開啟。

## 分析範圍

- 非預力實心等厚樓版、未配置剪力鋼筋。
- 單向剪力：台灣表 22.5.5.1(c)，計入有效受拉筋比、尺寸效應、軸力項及上下限。
- 沖切剪力：矩形內／齊平邊／齊平角柱，表 22.6.5.2 三式取小。
- 內柱雙軸彎矩：規範 R8.4.4.2.3 的 Jc，保留 d³ 項。
- 邊、角柱：輸入含形心偏移、彎矩傳遞的完整最大 vu；未提供則停止判定。
- 開孔近於柱面 4h、厚度變化、柱頭板、剪力帽蓋及非標準承載面需另外分析。

## 使用

直接開啟 index.html。操作說明、各輸入資料來源、两個範例、規範連結及基準驗算均已內嵌。
支援專案 JSON 匯入／匯出、自動保存、離線 HTML 下載、靜態 HTML 計算書及列印／另存 PDF。

單位為 kgf、cm、tf；1 tf = 1000 kgf = 9.80665 kN。
樓版自重自動納入，額外 D 不得重複計入自重。反力扣減模式必須輸入與 Ru 相同組合的 qu，不能用其他組合最大值扣減。

## 規範來源

查核日期：2026-10-05。

- 國土署：https://www.nlma.gov.tw/ch/legislation/regsearch/6874
- 官方 112 年版 PDF：https://www.nlma.gov.tw/filesys/file/EMMA/c1130219-1.pdf
- 113 年勘誤發布：https://gazette.nat.gov.tw/EG_FileManager/eguploadpub/eg030031/ch02/type7/gov10/num3/Eg.htm
- ACI 技術交叉參照：https://www.concrete.org/frequentlyaskedquestions.aspx?faqid=910

台灣單位原式單向係數採 2.12，沖切採 1.06／0.53／0.265；不以 ACI SI 係數替代。

## 驗證

verification.json 為獨立 Python 算出的 21 組基準。verify_independent.py 可用 Python 3 重建基準；網頁「規範與驗算」可執行 JavaScript 比對。

範例 A：d=17.365 cm、As=8.446666667 cm²、qu=1.416 tf/m²；Vu=2.5861116 tf、φVc=7.828065491 tf、D/C=0.330364073。

範例 B：d=21.2 cm、b0=244.8 cm；Vu=45 tf、vu=8.670921199 kgf/cm²、φvc=13.302894422 kgf/cm²、D/C=0.651807112。

驗證包括：單向簡支／懸臂、支承面、厚版尺寸效應、軸壓上限、軸拉零強度、高 fc′上限、內柱雙軸彎矩、β及大周界控制、邊角柱輸入、同組合反力扣減、零間距／錯誤深度／缺少完整應力／特殊幾何／不合理反力。

瀏覽器 QA：桌面 1440 px、手機 390 px；無頁面橫向溢出，無 JavaScript 例外。已實測離線 HTML 下載後重新開啟與 21 項基準檢查。

這是公式實作與介面測試，並非第三方認證；所選斷面的剪力符合不等於樓版其他設計已完成。
