# RC 柱配筋設計與檢核

依台灣112年《建築物混凝土結構設計規範》及113年2月勘誤，計算矩形箍筋柱周邊對稱單層配筋的軸力、雙向彎矩、剪力、細則及長細篩選。含特殊抗彎矩構架柱圍束檢核、配筋搜尋、斷面與互制圖、輸入來源、操作說明及可跟做範例。

直接開啟 `index.html` 即可離線操作，無 CDN、無外部字型或套件。`manual.html` 為可列印說明。網頁可儲存／開啟專案 JSON、下載離線版、匯出 Word 可開啟的 HTML .doc，以及列印另存 PDF。

## 驗證與範圍

`VALIDATION.md`、`validation-results.json` 保留數值比對；外部單向與雙向公開案例最大差異小於0.1%。採應變相容、Whitney壓力塊幾何積分及逐筋力平衡，雙向檢核使用固定Pu的彎矩容量包絡線。120方向取樣已與720方向比較。

本版是斷面與指定細則檢核工具。長細柱需輸入已處理二階效應的內力；特殊構架尚需另完成接頭、強柱弱梁、容量剪力、錨定及續接。幾何圖為配置示意，箍／繫筋彎鉤與施工詳圖须由工程設計確認。程式狀態明確標示這些待完成項目。

## 重建

Node.js執行 `node verify.cjs`；Python 3執行 `python3 build.py`。來源模板為 `page.html`，核心為 `core.js`；產物為 `dist/index.html` 與 `dist/manual.html`，發布時將其放置本資料夾根目錄。

官方來源：https://www.nlma.gov.tw/ch/legislation/regsearch/6874
