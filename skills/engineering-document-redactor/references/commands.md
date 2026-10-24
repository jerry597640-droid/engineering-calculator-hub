# 指令與環境

需要Python 3.10以上及PyMuPDF、Pillow、lxml。OCR另需本機Tesseract與chi_tra、eng資料；程式處理文件時不會連網。

## 專用環境

```bash
python -m venv .venv
# Windows
.venv\Scripts\python -m pip install -r <skill-dir>\scripts\requirements.txt
# macOS / Linux
.venv/bin/python -m pip install -r <skill-dir>/scripts/requirements.txt
```

後續用該環境python執行scripts/redact_engineering.py。先跑doctor，不假定Codex環境已裝好OCR。

```bash
python <skill-dir>/scripts/redact_engineering.py doctor
python <skill-dir>/scripts/redact_engineering.py doctor --tessdata /local/tessdata
```

繁中資料來源：https://github.com/tesseract-ocr/tessdata_fast 。把chi_tra.traineddata與eng.traineddata放同一目錄，用--tessdata指定。資料備妥即可離線處理。不執行遠端安裝腳本。

## 工作流程

1. `inspect INPUT --workdir NEW_DIR [--terms terms.json] [--ocr] [--ocr-lang chi_tra+eng] [--tessdata DIR]`：建立私有預覽、候選及來源hash綁定的設定草稿。
2. 開啟`review.private.html`，選名稱、畫框並確認圖片，下載已檢查的policy；亦可由已授權agent實際檢視後編輯。
3. `apply INPUT --policy POLICY --output OUTPUT`：副檔名須與原件相同。原件、既有輸出及既有報告不覆寫。
4. `verify OUTPUT --policy POLICY [--ocr] [--tessdata DIR]`：搜尋已知詞。含影像／向量圖形或無文字層的PDF未啟用OCR、影像未啟用OCR、Word含圖片、OCR空頁或沒有文字目標時回INCONCLUSIVE，並列coverage_warnings。Word的獨立驗證只覆蓋可讀XML文字；Word傳入--ocr會明確拒絕，不宣稱已OCR。

## 回傳碼

0表示指令完成；inspect仍是REVIEW_REQUIRED。1表示驗證FAIL／INCONCLUSIVE或缺依賴。2表示設定／格式／OCR／處理錯誤。stdout不回顯原始詞。

Word圖片與純Logo區域仍可經明確圖像覆核後由apply處理。若verify因圖片或無文字目標回INCONCLUSIVE，須以逐圖／逐頁視覺覆核及apply的像素／套件檢查補足，將覆核範圍寫入報告；不得把獨立文字檢查改稱全檔通過。

## 私有資料

workdir含原文與圖片，須留在受控本機目錄。POSIX主要目錄／JSON用0700／0600；Windows須另以NTFS ACL控制，不宣稱等同OS隔離。輸出旁`.report.json`僅含hash、數量、狀態。原件與私有資料依使用者需求保留／清理，程式不自動刪除原件。
