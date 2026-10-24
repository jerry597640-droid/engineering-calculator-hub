---
name: engineering-document-redactor
description: 遮蔽工程文件的工程名稱、人名、中英文公司名稱、聯絡資訊、Logo、印章與簽名。Use for redaction, de-identification, 去識別化, 遮蔽 or 隱名 of local or user-provided DOCX, PDF, PNG and JPEG, with private review, actual content removal and residual checks. Preserve engineering dimensions, formulas, units and unselected drawing content. Use for requested document redaction, not general editing or watermark removal.
---

# 工程文件遮蔽

以本地程式執行文字替換、圖片像素修改與 PDF 重建。先辨識候選，再按使用者已授權的範圍確認清單與圖形位置；不把候選偵測等同完整匿名化。

## 執行前

1. 取得使用者指定的本地副本。Library 檔依 Library 工作流程取得；不要把敏感文件提交 Git 或其他網站。
2. 執行 `python <skill-dir>/scripts/redact_engineering.py doctor`。缺少的依賴安裝到專用環境，使用 `scripts/requirements.txt`。掃描件另需本機 Tesseract 及 `chi_tra`、`eng` 語系；見 [commands.md](references/commands.md)。
3. 承接既有遮蔽範圍。工程文件去識別化預設查找工程名稱、人名、公司中英文名稱及別名、聯絡資訊、Logo、印章、簽名。不要重複索取已授權的同意。
4. 保留尺寸、材料強度、公式、單位及非敏感工程圖。圖號、構件編號、案號和金額依任務語境設定，不任意移除技術內容。
5. 支援 DOCX、PDF、PNG、JPEG。舊DOC、PPTX、XLSX、CAD、加密文件及不支援的向量圖片需先轉換／另行處理，不能改副檔名冒充支援。

## 隱私邊界

程式不呼叫外部 API。`manifest.private.json`、`policy.*.json`、`review.private.html` 與預覽含原始敏感內容，只留在私有工作目錄。

一般已授權文件處理可讀候選與預覽。若使用者要求原始資料完全不上雲，主 agent **不要讀原文、私有候選或圖片**；只執行本地指令，讓使用者在本機 review 頁完成確認。本地程式執行不等於雲端 agent 無法接觸資料；Skill 不是作業系統隔離邊界。

## 1 建立候選與預覽

每次使用新的工作目錄：

```bash
python <skill-dir>/scripts/redact_engineering.py inspect INPUT.docx --workdir WORKDIR
python <skill-dir>/scripts/redact_engineering.py inspect INPUT.pdf --workdir WORKDIR --ocr --ocr-lang chi_tra+eng
```

可加 `--terms terms.json` 匯入指定名稱，格式見 [terms.example.json](assets/terms.example.json)。自訂語系目錄用 `--tessdata DIR`。

先讀安全回執。一般模式再讀私有 manifest 與必要預覽；完全不上雲模式只提供本機檢視路徑。

## 2 審查文字與 Logo

### 文字

- 偵測是規則／標籤／檢查碼，不是完整NER。無標籤人名、少見公司名、英文縮寫與特殊案名可能漏辨。
- 從完整文件補上必要的中英文全名、簡稱及別名，每個別名一個 terms 項。
- 使用精確名稱，避免模糊比對把鋼筋代號、構件尺寸或公式誤遮。
- Word可用 `[已遮蔽]`、`[工程名稱]` 等替換；PDF／影像以純色填除，replacement不會插回PDF。

### 圖片與 Logo

**逐一檢視全部頁面與 Word 內嵌圖片，文字沒命中也不能跳過。**

- 區分公司Logo、印章、簽名與工程圖。Logo文字和圖案均需覆蓋，不只遮圖案下的公司名。
- PDF／影像以 regions 指定一基頁碼與0–1比例框，覆蓋整個敏感圖形；座標以旋轉後可見頁面預覽為準。
- Word對每個media ID選 blank、regions，或 keep 且 reviewed:true。同一圖檔多處引用時一起修改。
- Word內嵌圖片的文字須人工／agent視覺查找並框選；DOCX目前不支援--ocr，不能聲稱已自動檢查圖片文字。需要OCR時，明確轉換副本成PDF或另行檢查抽出的圖片。
- 不確定區域可用本機review補框；不可把所有小圖一律刪除。SVG／EMF等無法處理格式必須說明並停止該項。
- 用影像檢視工具查看原始預覽；不要用生成式影像重新繪製敏感頁面。

`review.private.html` 可勾選名稱、拖曳畫框並下載 `policy.reviewed.private.json`。Agent亦可根據實際檢視編輯草稿，但完成檢查後才能把 `review.text_checked`、`review.visual_checked` 設為true。不能為通過程式而虛填檢查旗標。

詳見 [policy.md](references/policy.md)。source_sha256綁定原檔，不可修改hash繞過來源異動。

## 3 執行遮蔽

```bash
python <skill-dir>/scripts/redact_engineering.py apply INPUT.docx --policy policy.reviewed.private.json --output OUTPUT.docx
python <skill-dir>/scripts/redact_engineering.py apply INPUT.pdf --policy policy.reviewed.private.json --output OUTPUT.pdf
```

- Word替換OOXML原文、重寫選定圖片、清理套件中的批註、修訂及中繼資料。原件與既有輸出不覆寫。
- PDF預設 raster：渲染、填除指定區域，再建立全新PDF，不保留原文字層、影像物件及附件。視覺版面保留，搜尋文字與互動表單不保留。
- 只有需要可搜尋文字且文件符合後端限制時才用 text模式；圖片、表單、註解等不支援情況需raster或另處理。
- 掃描文字遮蔽必須OCR。語系缺失、定位失敗、來源變更、未檢視圖片或殘留檢查失敗就停止交付。

`SELECTED_TARGET_CHECKS_PASSED`只表示指定目標的技術檢查通過，不代表所有可識別資訊都已被發現。

## 4 檢核輸出

1. 讀報告核對hash、文字命中數、處理圖片／區域、驗證結果與警示。警示須查明。
2. 獨立搜尋已知詞：

```bash
python <skill-dir>/scripts/redact_engineering.py verify OUTPUT.docx --policy policy.reviewed.private.json
python <skill-dir>/scripts/redact_engineering.py verify OUTPUT.pdf --policy policy.reviewed.private.json --ocr --ocr-lang chi_tra+eng
```

3. PDF／圖片逐頁看輸出；Word用可用DOCX renderer產生頁面圖檢查表格、公式、尺寸、頁首頁尾與Logo區域。不能只看XML就宣稱版面正常。
4. OCR可能漏讀。`INCONCLUSIVE`不是PASS；空文字層不是遮蔽成功的證明。Word含圖片、PDF含未OCR的視覺內容、OCR空頁或純Logo無文字目標時，獨立文字驗證會列出未涵蓋範圍。逐圖／逐頁覆核並配合apply的像素／套件檢查補足，在報告保留此限制，不能把文字檢查稱為全檔驗證。
5. 原件hash不變。原件、候選、policy及原始預覽不放在公開儲存庫或交付資料夾。

## 交付

交付遮蔽後文件與不含原始詞的報告，說明處理範圍、格式及待檢查項目，依使用者目的地保存。原始預覽與含敏感詞policy僅在使用者明確要求時交付。

沒有執行不聲稱已遮蔽；未逐頁辨識與覆核不聲稱所有Logo已清除。功能與來源見 [sources-and-limits.md](references/sources-and-limits.md)。
