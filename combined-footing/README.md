# 聯合基礎分析設計工作台

直接開啟 `index.html`，不需安裝、伺服器或網路。操作說明、欄位定義、資料來源、三個教學範例與數值驗算都已內嵌。

線上版：https://jerry597640-droid.github.io/engineering-calculator-hub/combined-footing/

## 功能

- 長方形、梯形聯合基礎、懸臂聯合基礎（兩基腳與不承壓連梁）。
- 使用土壤總反力、1.4D／1.2D＋1.6L 分別分析包絡、自訂單一 Pu 組合。
- 幾何、反力、剪力、彎矩、單向剪力、沖切與供筋強度。
- 普通重混凝土、kgf/cm²、cm、m、tf、tf/m²。
- JSON 參數匯入／匯出、單檔離線下載、詳細計算書 HTML 與列印 PDF。
- 桌機側欄工作台，手機改為橫向頁籤與直向工作區。

## 規範與原程式

原檔：CombinedFooting_20121009_SourceCode.zip（Form1.vb，2016 年存檔）。

規範：國土署 112 年版《建築物基礎構造設計規範》，112 年版《建築物混凝土結構設計規範》（含 113 年勘誤）。參照表 5.3.1、13.2.6～13.3、表 22.5.5.1、表 22.6.5.2、21.2、7.6、8.6、9.6、9.7。

- https://www.nlma.gov.tw/ch/legislation/regsearch/962
- https://www.nlma.gov.tw/ch/legislation/regsearch/6874
- https://www.nlma.gov.tw/filesys/file/EMMA/c1130219-1.pdf

修正舊載重組合；右柱沖切原式的 K3−K3 改為臨界區完整淨反力積分。無箍筋基腳採提供縱向鋼筋比之混凝土剪力公式。沖切採三式最小值。基腳尺寸效應依 13.2.6.2 取 λs＝1；不接觸土壤的連梁另依梁規定。

短向為原程式柱帶分配法與直接土壓懸臂法較大需求。此為簡化分析，不是二維板元素模型。

## 適用範圍

兩柱向下軸力、橫向置中、完全接觸剛性基腳、普通重混凝土、直接接觸土壤澆置（保護層至少 7.5 cm）。Qa 必須為工址總容許承載力。若土壓為負，停止強度評定。邊柱沖切或周界涉及另一柱，只顯示平均剪力參考值，不能評定通過。

不包含土壤參數推估、沉陷、液化、浮力、滑動、柱底彎矩、完整風震組合、開孔、粗骨材淨距限制、鋼筋伸展、接頭與施工圖細部。連梁深梁範圍（淨跨小於 4h）停止分析。

## 重新生成與驗算

```bash
node generate-cases.js
python3 verify.py
node edge-tests.js
node strength-tests.js
python3 build.py
```

`engine.js` 為計算核心；`ui.js` 為操作介面；`template.html` 為樣式與說明；`build.py` 產生完整單一 HTML。測試資料採固定種子，驗算紀錄見 `validation.json` 與 `VALIDATION.md`。
