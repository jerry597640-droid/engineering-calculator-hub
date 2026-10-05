# 地錨設計工作台 v1.0

單一 HTML、無外部依賴、離線互動計算。開啟 `index.html` 即可使用。

- 網頁：https://jerry597640-droid.github.io/engineering-calculator-hub/ground-anchorage/
- 入口：https://jerry597640-droid.github.io/engineering-calculator-hub/
- 查核日期：2026-10-05

## 功能

單支承拉式摩擦型地錨：抗張材拉力、地層/漿體抗拔、漿體/抗張材握裹；自由段與破壞面交點配置；tf、kgf、kN；鋼絞線金屬面積、實心鋼棒面積；極限/直接容許應力；臺北市02492安全係數、原版係數及自訂；可勾選FHWA補充；詳列代入式、內嵌操作手冊及3例；JSON備份、HTML計算書及列印PDF。

## 來源與修正

原始計算來源為使用者提供的 GroundAnchorage_20121009_SourceCode(1).zip，FormMain.vb CAL_Engine。原式能力保持可追溯；破壞面座標與相交判斷改用解析幾何；鋼絞線不套用名義圓面積；極限與容許應力分離，避免重複折減。

臺灣依據：112年版建築物基礎構造設計規範 §7.3.9(3)、§8.7.3解說(8)引用地錨準則與公路邊坡規範。臺北市工程施工規範02492 §§1.5.3、1.6.1提供最低錨長及安全係數參考（地方施工規範不是全臺統一門檻）。公路邊坡規範111/4/27修订公告所述變動為排水條文。FHWA-IF-99-015為1999技術手冊補充，不能稱為新的臺灣法規。

官方來源：
- https://www.nlma.gov.tw/ch/legislation/regsearch/962
- https://www.nlma.gov.tw/filesys/file/EMMA/a1120620.pdf
- https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL103224
- https://www.motc.gov.tw/ch/app/divpubreg_list/view?id=740&module=divpubreg&serno=405
- https://highways.dot.gov/sites/fhwa.dot.gov/files/FHWA-IF-99-015.pdf

## 計算範圍

均勻界面應力、各支平均分力、鋼材握裹長度等於有效地層錨碇長度。砂土 n 與 αCu 保留為原程式經驗式，須現地試驗校正；n 的單位為tf/m，不是SPT N。平面滑動面僅供均質水平地表、近似垂直牆估算；另支援外部分析交點。FHWA補充後退沿軸保守取max(指定值,1.5m,L2/5)，並以L2作牆高代理。

整體邊坡穩定、群錨效應、錨頭承壓、橫擋、壁體、預力損失、防蝕、潛變、現場證明/適用性/驗收試驗需另外完成。La超過10m須以有效傳力與現地試驗確認，不可無限制線性增長。

## 驗算

`engine.cjs`是與HTML內嵌同內容的計算核心，`verification.json`記錄21項數值測試及範例輸出。使用獨立Python SI公式核對力與伸長。瀏覽器驗证五種寬度(320/390/768/1024/1440px)、無JS錯誤、斷網計算、JSON匯入匯出、下載離線頁及計算書/PDF。

離線版 HTML的「依據與驗算」頁可重跑10項內建算術檢查。
