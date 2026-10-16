# 鋼梁開孔彎矩與剪力工作台 v1.1

解壓開啟 index.html，計算、說明、公開案例比對、JSON、Word 均可離線使用。圖形有釘選／取消釘選開關，保存在本機；桌面釘選模式使用獨立圖形與結果捲動區，取消釘選時隨頁閱讀。

翼板模組維持 v1.0 臺灣 ASD 4.1／4.2 截面分析。腹板模組新增 AISC DG2（1990／2003 修訂）無補強、單一、孤立矩形或圓形孔的剪力與彎剪交互作用；偏心、孔高、T肢深度、孔角、最近支承淨距與材料限制分列。DG2 是補充方法，未稱為新版臺灣專用條文。

ASD 模式依 DG2 §3.8：工作載重M、V乘1.7，φ=1；LRFD模式使用已因數化需求，φ=.90。不可將兩種載重與折減方式混用。

範圍不含多孔互制、補強板／焊道、同區翼板孔、複合梁貢獻、軸力、疲勞、塑鉸與完整穩定及撓度檢核。受壓T肢ν>4須另核穩定。適用條件不符不會顯示整體通過。

驗證：
- node steel-beam-holes/test.cjs：13 項原翼板回歸。
- node steel-beam-holes/test-web.cjs：18 項腹板測試，含公開 DG2 例1、例1A容量與載重點，以及獨立百萬條薄片積分。
- python3 steel-beam-holes/build.py：內嵌重建HTML及離線ZIP。
- node steel-beam-holes/test-ui.cjs：釘選、模組切換、無效輸入、JSON與真DOCX匯出。

公開案例 W24×55 的 Mm 重現差異0.0024%；Vm閉式公式與原文圖表數值差異0.404%，原樣保留。六個LRFD載重點及五個ASD點之容量判定一致。這不等於所有構造均完成驗證。詳細比對與網址在 web-verification.json 和網頁內。

來源：AISC Design Guide 2 §3.4–3.8、例1／1A；Bentley Systems《STAAD.Pro V8i Technical Reference Manual》§2.4.4（公開副本）交叉確認公式；官方AISC版本目錄。

DOCX library: docx 9.6.1, MIT；離線ZIP含 docx-LICENSE.txt。
