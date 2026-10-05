# SRC 梁柱構材分析設計工作台

線上：https://jerry597640-droid.github.io/engineering-calculator-hub/src-beam-column/

## 使用

直接以瀏覽器開啟 `index.html`。HTML內含所有CSS、計算程式、操作說明與驗算摘要，不需網路或外部函式庫。網頁「下載離線版」會保存梁及柱兩套目前輸入；引用規範與工程入口連結需網路。

預設為柱／梁柱，側欄可切换梁模組。每個輸入欄位可展開「定義與來源」。詳細公式、代入數值與各主筋內力表位於「柱梁柱計算」及「梁計算過程」，可列印或儲存PDF。

## 計算

採國土管理署公開的《鋼骨鋼筋混凝土構造設計規範與解說》100年修正版。查核日2026-10-05。應變相容參考《建築物混凝土結構設計規範》112年版。研究草案不當作已生效規範。

- 梁：SRC5.4.1強度疊加；兩方向RC中性軸解；SRC5.5鋼骨與RC按標稱彎矩比分攤剪力，RC一般剪力與剪力摩擦取小值。
- 柱抗壓：SRC6.4，強弱軸有效迴轉半徑、鋼骨挫屈及RC短柱／Euler上限，φcs=0.85，φcrc=0.65。
- 梁柱：SRC7.3，按EsAs、0.55EcAc分配軸力，按EsIs、0.35EcIg分配各軸彎矩；鋼骨採7.3-7/8交互作用。
- RC柱：二維平面應變相容；等值壓力塊、逐支主筋彈塑性；以多邊形裁切與圓面積積分扣除鋼骨／主筋占用的混凝土，求分配軸力與彎矩方向對應的抗彎邊界。固定採保守φ=0.65，並檢核6.4.3長柱軸壓上限。
- 二階：輸入已包含整體和局部二階效應的Mu，或按SRC7.4計算B1Mnt+B2Mlt。B2依使用者提供的整層θ求得。

## 適用範圍

矩形常重混凝土、完全包覆H型。梁為無軸力強軸正負彎矩與剪力；柱限置中H鋼、雙對稱主筋、橫箍筋、軸壓及雙向不利彎矩。fc′210–420 kgf/cm²、Fys≤3520、Fyr≤5600。幾何採直角板塊，不含圓角。

柱剪力、耐震圍束、強柱弱梁、接頭、施工裸鋼、伸展錨定、使用性、防火、開孔、扭矩、軸拉、箱型與十字型鋼骨不在本版自動檢核範圍。初始剛度分配不滿足時不自動重新分配外力；RC柱固定保守φ，可能比完整最佳化設計保守。P–M通過只代表本頁涵蓋項目通過。

## 範例

柱80×80 cm、H450×350×14×22 mm、12-D25、fc′280、Fys3500、Fyr4200，4肢D13@15cm，L360cm、Kx=Ky=1。Pu400tf、二階Mx60tf-m、My20tf-m。軸壓容量合計1500.7446tf（仍須按分配外力檢核），鋼骨交互作用0.421384，RC最大比0.377368。

梁50×80 cm、H500×200×10×16 mm、四角兩層共8-D32；主筋x7/43cm、y8/14/66/72cm。2肢D13@15cm、fc′280、Fys3500、Fyr4200、Mu±100tf-m、Vu35tf。抗彎設計強度145.1681tf-m。

## 驗證

47項獨立公式與回歸測試通過。RC柱另以0.02cm獨立Cartesian網格积分核對雙向壓力區與力矩，差異小於0.003%。測試涵蓋面積、慣性矩、挫屈、內力守恆、二階放大、長柱控制、純軸壓、純彎曲、双向彎曲、剪力摩擦及無效輸入。

這些驗證適用於所列模型與案例，並不宣稱所有SRC構材、耐震與施工要求均已完成。正式工程須按專案條件完成其餘設計及審核。

## 規範來源

- https://www.nlma.gov.tw/ch/legislation/regsearch/977
- SRC第3章 https://www.nlma.gov.tw/uploads/files/bb28d35b9a579aa2352ddac6b4cdc35e.pdf
- SRC第4章 https://www.nlma.gov.tw/uploads/files/d5379a671495190301c8cf82c2279245.pdf
- SRC第5章 https://www.nlma.gov.tw/uploads/files/1f2700a836544dafdc81c7a1130158c5.pdf
- SRC第6章 https://www.nlma.gov.tw/uploads/files/c0ec0fcd843b9fc64ed10865c5f03741.pdf
- SRC第7章 https://www.nlma.gov.tw/uploads/files/de33d9841890f8f82630e6bb88f3acd2.pdf
- RC112年版 https://www.nlma.gov.tw/uploads/files/34f8103d5ef2b7f82dde347c52758207.pdf

## 可重現驗算

以 Node.js 執行 `node tests/verify-regression.js`（20項測試並產生核對輸入），再以已安裝 NumPy 的 Python 執行 `python3 tests/verify-independent.py`（27項独立計算）。不需其他JavaScript套件。獨立網格驗算採0.02cm間距，可能需數秒及較多記憶體。`tests/mobile-preview.html` 提供390px寬度響應式預覽。
