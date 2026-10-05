# 工程單位換算工作台 v1.0

27 類、514 個單位；係數、說明、範例與原版核對表全部嵌入 index.html，無外部網頁資源，支援離線。

## 開啟與操作

- 解壓縮後以 Chrome、Edge、Firefox 或 Safari 開啟 index.html。
- 選類別 → 輸入純數字 → 選原始／目標單位。
- 原始數值來源、每欄填寫說明、27 類範例及公式均在「操作說明」。
- 支援複製、CSV 匯出、交換單位、顯示有效位數及瀏覽器列印。
- 頁首提供「回到工程工具」及單檔離線下載。
- 換算本身不用網路；標準來源連結、返回線上入口需要網路。
- 手機請用支援 JavaScript 的瀏覽器；檔案預覽器可能不執行程式。

## 來源與修正

輸入 ZIP 僅有 Windows .NET EXE 與列印 DLL。透過中間碼解析 FormMain.Show_1 的單位標籤與 Form1_Load.unit_tr 的 545 個係數欄位；未執行原登入／授權功能。

原版 data_1 以比例換算，並使用單精度中間值。新版採雙精度 SI 基準係數與溫度偏移公式，僅在顯示時取位。

明確修正：kg→g、kg→t、角秒、ft/min、台尺、台丈、質量慣性矩、L·atm 等；力與質量分開，IT/th、US/UK 明定義。原版焓頁使用 J/kg·°C，實際為比熱容，已合併；新增獨立溫差類別。

保留 44 個原欄位待確認：歷史定義不明、混用物理量、缺少次方或把 kips 當質量。不把這些舊係數作正式換算；部分另提供明定義替代項。詳見頁內「原版核對」及 original-audit.json。原科學計算機、鋼筋重量表與登入功能不在本單位換算版範圍。

## 係數基準

- 1 kgf = 9.80665 N；1 tf = 1000 kgf。
- 1 in = 0.0254 m；1 ft = 0.3048 m；1 lb = 0.45359237 kg。
- 1 US liquid gal = 3.785411784 L；1 UK gal = 4.54609 L。
- 1 cal(IT) = 4.1868 J；1 cal(th) = 4.184 J。
- 台尺採 10/33 m，坪採 400/121 m²，為傳統單位定義，非 SI。
- Mach 需指定音速、介質與狀態，不使用固定倍率。
- 月採 30 日、年採 365 日，亦另有儒略年；不是日曆加減。

## 來源（核對：2026-10-05）

- [BIPM SI Brochure，第 9 版 v4.01](https://www.bipm.org/en/publications/si-brochure)
- [NIST SP 811 Appendix B.9](https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9)
- [NIST 係數註解](https://www.nist.gov/pml/special-publication-811/nist-guide-si-footnotes)
- [標檢局法定度量衡單位使用指南](https://www.bsmi.gov.tw/wSite/fp?ctNode=8317&mp=111&xItem=91345)
- [教育部長度換算表](https://dict.concised.moe.edu.tw/page.jsp?ID=15&la=0&powerMode=0)

單位符合性不代表構材設計通過規範；本程式不計算強度折減、荷載組合或安全係數。

## 開發與驗算

index.html 是可直接發布或離線使用的完整成品。原始模組另列 engine.js、app.js、template.html、catalog.json、original-audit.json。

在本資料夾執行 `node verify.js`：65 個獨立標準案例、11,768 組全部可用單位雙向回算、輸入錯誤、溫度下限與溢位／下溢檢查。

重建：執行 `python assemble.py`；驗算結果見 validation.json 與 VERIFICATION.md。
