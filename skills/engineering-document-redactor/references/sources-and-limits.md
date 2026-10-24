# 來源與能力限制

版本0.1.0，建立日期2026-10-24（UTC）。

## 來源

- 工作流程參考：https://github.com/qwertyzhu/legal-redactor 。本技能工程規則、介面及後端另行實作，未複製上游程式碼或套用法律案件模式。
- 繁中方向參考：https://github.com/danyuchn/pii-guard 。本版本未包含CKIP／Ollama，不宣稱具有其NER覆蓋率。
- PyMuPDF redaction API：https://pymupdf.readthedocs.io/en/latest/page.html#Page.apply_redactions 。黑框本身不能證明原始物件已移除。
- Tesseract繁中模型：https://github.com/tesseract-ocr/tessdata_fast 。測試chi_tra.traineddata SHA256：529c5b5797d64b126065cd55f2bb4c7fd7b15790798091b1ff259941a829330b。
- 台灣統編新版規則：https://www.fia.gov.tw/singlehtml/3?cntId=c4d9cff38c8642ef8872774ee9987283 。使用modulo-5及第7碼為7分支；檢查碼有效不證明公司真實存在。

## 限制

1. 候選以本地規則、標籤與檢查碼偵測。無標籤人名、少見公司名與上下文可識別資訊須補查。
2. Logo由agent或使用者逐頁視覺辨識並選區，程式確定性處理選區／圖片。沒有保證辨識所有商標的通用模型。
3. PDF預設raster重建，失去可搜尋文字、可編輯向量、表單互動及原數位簽章；仍需視覺／OCR驗證。
4. Word替代字串與套件清理可能改變分頁。交付前渲染檢查。
5. 不支援舊DOC、CAD、PPTX、XLSX、加密文件及不可處理的向量圖片；不把未處理項目當成成功。
6. 本地工具不呼叫外部API；雲端agent若讀原文／圖片仍會接觸內容。完全不上雲需本機人工檢視。
7. 指定目標檢查成功不代表完整匿名化或取得合規認證。
8. DOCX內嵌圖片不支援自動OCR；需視覺選區。獨立verify會明示圖片文字未涵蓋，不能只依文字結果宣稱全檔成功。

## 依賴

測試版本：PyMuPDF1.26.6、Pillow12.3.0、lxml6.1.1。OCR另裝Tesseract及語系資料。第三方套件各有授權，以實際版本上游LICENSE為準；本技能不授予額外第三方權利。
