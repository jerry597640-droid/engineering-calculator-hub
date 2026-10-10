# 基樁分析工作台 v2.0
線上：https://jerry597640-droid.github.io/engineering-calculator-hub/pile/

九個工作區：樁體、鑽探、軸向結果、操作說明、公式與驗算、樁身配筋、群樁、沉陷、側向。

1. 先開啟index.html，載入現行SPT手算範例。
2. 四個進階工作區各有獨立範例與載重；輸入旁附單位、定義及來源。
3. 地盤採工作載重，樁身採因數化載重，不得混用。各項有獨立結果／適用範圍。
4. JSON保留全部输入；「下載離線版」產生含目前案件及教學影片的單一HTML，無網路可計算／播放／匯出Word與CSV。
5. 返回入口與官方規範連結需網路。

教學：五章台灣女性旁白v2，影片已嵌入HTML，另於media/tutorial.mp4。
來源與限制：ADVANCED-METHODS.md、REGULATIONS.md；驗證：VERIFICATION.md及各log。

計算：原有軸向19組＋新增33組獨立／邊界測試。樁身限場鑄實心圓樁單向P–M；群樁限規則矩形同勁度；沉陷採Vesic／等似墩概估；側向採分層線彈性Winkler。未含完整非線性p-y、雙軸長柱、差異沉陷、液化、承台板與全部錨定搭接、試樁。

重建：python build.py；驗算：node verify.js、node advanced-verify.js。index.html已內嵌各JS與DOCX依賴，開啟即可使用，不需安裝。
