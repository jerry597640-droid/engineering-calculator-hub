# 地錨設計工作台 v2.0

完整離線套件含 HTML、影片、字幕與計算核心；開啟 `index.html` 即可使用。另提供已嵌入影片的單檔 HTML。

- 網頁：https://jerry597640-droid.github.io/engineering-calculator-hub/ground-anchorage/
- 入口：https://jerry597640-droid.github.io/engineering-calculator-hub/
- 查核日期：2026-10-10

## 功能

單支承拉式摩擦型地錨：抗張材拉力、地層/漿體抗拔、漿體/抗張材握裹；自由段與破壞面交點配置；tf、kgf、kN；鋼絞線金屬面積、實心鋼棒面積；極限/直接容許應力；臺北市02492安全係數、原版係數及自訂；可勾選FHWA補充；詳列代入式、內嵌操作手冊及3例；JSON備份、HTML計算書及列印PDF。

## 來源與修正

原始計算來源為使用者提供的 GroundAnchorage_20121009_SourceCode(1).zip，FormMain.vb CAL_Engine。原式能力保持可追溯；破壞面座標與相交判斷改用解析幾何；鋼絞線不套用名義圓面積；極限與容許應力分離，避免重複折減。

臺灣依據：112年版建築物基礎構造設計規範 §7.3.9(3)、§8.7.3解說(8)引用地錨準則與公路邊坡規範。臺北市工程施工規範02492 §§1.5.3、1.6.1提供最低錨長及安全係數參考（地方施工規範不是全臺統一門檻）。公路邊坡規範111/4/27修订公告所述變動為排水條文。FHWA-IF-99-015為1999技術手冊補充，不能稱為新的臺灣法規。

官方來源：
- https://www.nlma.gov.tw/ch/legislation/law%26regusw/962
- https://www.nlma.gov.tw/uploads/files/53651dae74223e6599e20838bb8c4f2a.pdf
- https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL103224
- https://www.motc.gov.tw/ch/app/divpubreg_list/view?id=740&module=divpubreg&serno=405
- https://highways.dot.gov/sites/fhwa.dot.gov/files/FHWA-IF-99-015.pdf

## 計算範圍

均勻界面應力、各支平均分力、鋼材握裹長度等於有效地層錨碇長度。砂土 n 與 αCu 保留為原程式經驗式，須現地試驗校正；n 的單位為tf/m，不是SPT N。平面滑動面僅供均質水平地表、近似垂直牆估算；另支援外部分析交點。FHWA補充後退沿軸保守取max(指定值,1.5m,L2/5)，並以L2作牆高代理。

整體邊坡穩定、群錨效應、錨頭承壓、橫擋、壁體、預力損失、防蝕、潛變、現場證明/適用性/驗收試驗需另外完成。La超過10m須以有效傳力與現地試驗確認，不可無限制線性增長。

## 驗算

`engine.cjs`是與HTML內嵌同內容的計算核心，`verification.json`記錄25項數值測試及範例輸出。使用獨立Python SI公式核對力與伸長。瀏覽器驗证五種寬度(320/390/768/1024/1440px)、無JS錯誤、斷網計算、JSON匯入匯出、下載離線頁及計算書/PDF。

離線版 HTML的「依據與驗算」頁可重跑12項內建算術檢查。


## v2.0（2026-10-10）
- 操作影片：8章節，台灣華語女性 zh-TW-HsiaoChenNeural，繁體中文字幕、章節跳轉及播放速度。
- 36項參數字典：定義、資料來源、範例B值、公式及常見填寫錯誤；輸入錯誤可跳至欄位。
- 可編輯Word匯出及完整代入步驟保留；手機可填案名。
- FHWA補充：試驗倍率1.33下限，建議鋼腱支數同時考慮設計、鎖定及試驗上限。
- 規範查核日期2026-10-10。現行《建築物基礎構造設計規範》112年版（113/1/1生效）；臺北市02492表列僅在契約適用範圍內採用，不包括鋼棒。FHWA-IF-99-015是1999國外參考，不宣稱完整FHWA設計。
- 開啟index.html可離線計算與觀看影片；保留assets資料夾。單檔HTML版本也含完整影片與字幕。
- 表列通過不代表整體穩定、群錨、錨頭承壓、防蝕、潛變及現地試驗已完成。
