# 工程文件遮蔽 Skill

**版本：0.1.0** · Skill 名稱：`engineering-document-redactor`

針對工程文件的名稱、聯絡資訊、Logo、印章與簽名進行去識別化，保留未選取的尺寸、公式、單位與工程圖。支援 DOCX、PDF、PNG、JPEG，採「建立候選 → 覆核 → 實際移除 → 檢查輸出」流程。

完整技能在 [`engineering-document-redactor/`](engineering-document-redactor/)，入口為 [`SKILL.md`](engineering-document-redactor/SKILL.md)。本資料夾保存可執行的 Python 程式與 Skill 定義；在 ChatGPT／Codex 中註冊 Skill 是另一個安裝步驟。

## 功能與使用界線

| 格式／項目 | 處理方式 | 使用界線 |
| --- | --- | --- |
| 工程名稱、人名、公司中英文名稱 | 規則與標籤產生候選；支援自訂完整名稱與別名 | 候選可能漏列，須覆核全文 |
| Word 文字 | 在 OOXML 中替換，處理跨 run、表格、文字方塊及頁首頁尾 | 替換後重新渲染確認分頁與版面 |
| Word 圖片 | 每張圖明確選擇保留、整圖遮蔽或局部框選；共享引用一起更新 | DOCX 內嵌圖片不支援自動 OCR，需視覺檢查 |
| PDF | 預設渲染、填除選區，再建立全新 PDF | 預設失去可搜尋文字、可編輯向量、互動表單與原數位簽章 |
| 掃描 PDF、PNG、JPEG | 本機 Tesseract OCR 與選區像素清除 | OCR 可能誤讀；需確認繁中／英文語系資料 |
| Logo、印章、簽名 | 由使用者或 agent 檢視後指定位置 | 沒有保證找出所有 Logo 的通用辨識模型 |

程式保護原始文件與既有輸出。它會檢查來源雜湊、覆核紀錄、指定詞殘留及支援範圍內的圖片／套件清理，並產生不含原始遮蔽詞的處理報告。

## 執行環境

- Python 3.10 以上。
- Python 套件：[requirements.txt](engineering-document-redactor/scripts/requirements.txt)。建議在專用虛擬環境安裝。
- 掃描件另需本機 Tesseract；繁中需 `chi_tra` 與 `eng` 語系資料。
- 程式處理文件時不呼叫外部 API。套件與 OCR 模型須事先備妥。

在儲存庫根目錄建立虛擬環境，並用該環境的 Python 安裝依賴：

```bash
python -m venv skills/.venv
# macOS / Linux
skills/.venv/bin/python -m pip install -r skills/engineering-document-redactor/scripts/requirements.txt
```

Windows 對應的 Python 路徑是 `skills\.venv\Scripts\python.exe`。以下指令中的 `python` 請使用該虛擬環境的 Python。

## 操作流程

### 1. 檢查依賴與建立私有預覽

```bash
python skills/engineering-document-redactor/scripts/redact_engineering.py doctor
python skills/engineering-document-redactor/scripts/redact_engineering.py inspect INPUT.docx --workdir skills/.private/review-001
```

掃描 PDF 改用：

```bash
python skills/engineering-document-redactor/scripts/redact_engineering.py inspect INPUT.pdf --workdir skills/.private/review-002 --ocr --ocr-lang chi_tra+eng
```

每次使用新的工作目錄。可加 `--terms terms.json` 匯入名稱清單，格式見 [terms.example.json](engineering-document-redactor/assets/terms.example.json)。自訂 OCR 語系目錄使用 `--tessdata DIR`。

### 2. 覆核文字與全部圖片

在本機開啟工作目錄中的 `review.private.html`：

1. 勾選要遮蔽的名稱，補上工程名、人名、公司全名與中英文別名。
2. 檢視全部圖片／頁面，選定 Logo、印章、簽名及圖片中的敏感文字。
3. 對要保留的工程圖明確標示已檢查。
4. 完成文字與視覺覆核後，匯出 `policy.reviewed.private.json`，放回私有工作目錄。

### 3. 處理並檢查輸出

```bash
python skills/engineering-document-redactor/scripts/redact_engineering.py apply INPUT.docx --policy skills/.private/review-001/policy.reviewed.private.json --output skills/.private/OUTPUT.docx
python skills/engineering-document-redactor/scripts/redact_engineering.py verify skills/.private/OUTPUT.docx --policy skills/.private/review-001/policy.reviewed.private.json
```

PDF 使用前面 `review-002` 所匯出的設定：

```bash
python skills/engineering-document-redactor/scripts/redact_engineering.py apply INPUT.pdf --policy skills/.private/review-002/policy.reviewed.private.json --output skills/.private/OUTPUT.pdf
python skills/engineering-document-redactor/scripts/redact_engineering.py verify skills/.private/OUTPUT.pdf --policy skills/.private/review-002/policy.reviewed.private.json --ocr --ocr-lang chi_tra+eng
```

設定須對應同一份原始文件；來源變更時重新 inspect。輸出旁的 `.report.json` 記錄雜湊、處理數量、驗證狀態與警示。

PDF 與圖片須逐頁檢視輸出；Word 須用可用的 DOCX renderer 檢查版面、表格、尺寸與頁首頁尾。

## 驗證狀態

| 狀態 | 意義 |
| --- | --- |
| `SELECTED_TARGET_CHECKS_PASSED` | `apply` 對已選目標與支援清理項目完成技術檢查 |
| `KNOWN_TEXT_TARGETS_ABSENT` | 在實際檢查的文字／OCR 中沒有找到已知詞 |
| `INCONCLUSIVE` | 尚有未涵蓋範圍，例如 Word 圖片、未 OCR 的 PDF 視覺內容、OCR 空頁或沒有文字目標 |
| `FAIL` | 在檢查範圍找到指定殘留詞 |

`INCONCLUSIVE` 需要依 `coverage_warnings` 補足逐圖／逐頁覆核。Word 圖片可由 `apply` 處理，但獨立文字驗證不包含 DOCX 圖片 OCR。指定目標檢查成功不等於完整匿名化或合規認證。

## 隱私與檔案管理

`manifest.private.json`、`policy.*.json`、`review.private.html` 及原始預覽含敏感內容，放在受控私有目錄。範例使用已由本目錄 `.gitignore` 排除的 `.private/`。不要把真實工程文件或私有覆核資料加入 Git。

若要求原始資料完全不上雲，請在本機人工覆核，避免讓雲端 agent 閱讀原文與圖片。Skill 本身不是作業系統隔離機制。

舊 DOC、CAD、PPTX、XLSX、加密文件及不支援的向量圖片需先明確轉換或另行處理。

## 開發驗證紀錄

見 [2026-10-24 開發驗證快照](validation/engineering-document-redactor-v0.1.0.json)。這是開發環境的驗證紀錄，不是 GitHub Actions CI 執行結果。

- 37 項核心測試通過：候選偵測 14、Word 後端 9、PDF／影像後端 14。
- 15 項預覽頁 JavaScript 行為測試通過；使用模擬 DOM／Canvas，未完成真實瀏覽器互動與 CSP 驗收。
- 修正後的 6 項驗證邊界案例通過；其中含原案例重測，不能直接加總為全部獨立測試數。
- 合成 Word 範例完成 3 個名稱目標、9 次替換，Logo 像素已清除，工程圖像素保持一致，尺寸與材料強度保留為原生文字。
- 已進行 Word／PDF 渲染視覺檢查；未使用 Microsoft Word 進行互動編輯測試。
- 12 個核心來源檔與快照中的 SHA-256 一致。

快照中的安裝與同步欄位記錄提交前的原開發環境狀態；目前 GitHub 來源版本以本分支為準。GitHub 來源提交不會自動完成 Skills 註冊。

## 來源與進一步說明

- [Skill 工作流程](engineering-document-redactor/SKILL.md)
- [指令與環境](engineering-document-redactor/references/commands.md)
- [設定與座標](engineering-document-redactor/references/policy.md)
- [來源、依賴與限制](engineering-document-redactor/references/sources-and-limits.md)

工作流程參考 [legal-redactor](https://github.com/qwertyzhu/legal-redactor)，繁中方向參考 [pii-guard](https://github.com/danyuchn/pii-guard)。本版本的工程規則、介面與後端為另行實作，未複製這兩個專案的程式碼。第三方套件授權依各上游實際版本為準。
