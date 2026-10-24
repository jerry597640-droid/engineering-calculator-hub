---
name: engineering-document-redactor
description: 在 engineering-calculator-hub 專案中遮蔽工程 DOCX、PDF、PNG、JPEG 的工程名稱、人名、中英文公司名稱、聯絡資訊、Logo、印章與簽名。Use for engineering document redaction, 去識別化, 遮蔽 or 隱名 while preserving unselected dimensions, formulas, units and drawings. This repository entry loads the complete workflow and tools from skills/engineering-document-redactor.
---

# 工程文件遮蔽：專案入口

此檔位於 `<repo-root>/.agents/skills/engineering-document-redactor/SKILL.md`，供 Codex 在這個儲存庫中發現技能。完整工作流程與程式保存在同一儲存庫的 `skills/engineering-document-redactor/`。

## 載入完整技能

1. 從本檔所在資料夾向上三層，得到儲存庫根目錄；不要用目前工作目錄猜測位置。
2. 將 `<repo-root>/skills/engineering-document-redactor` 設為後續操作的 **skill-dir**。先確認該目錄的 `SKILL.md` 與 `scripts/redact_engineering.py` 存在。
3. 完整讀取並遵循 [工作流程](../../../skills/engineering-document-redactor/SKILL.md)。其中的相對資源與所有 `<skill-dir>` 均以第 2 步的完整技能目錄為準。
4. 先執行 `python <skill-dir>/scripts/redact_engineering.py doctor`，再承接使用者已授權的文件遮蔽工作。缺少 Python 套件或 OCR 語系時，依完整技能的環境指引處理。
5. 保留完整技能的文字／圖片覆核、原檔保護與輸出驗證要求。若使用者要求原始資料完全不上雲，交由使用者在本機檢視頁覆核，不讀取原文或原始圖片。

若第 2 步的完整技能目錄不存在，停止並說明此入口須搭配完整儲存庫使用。跨專案的個人安裝應使用 GitHub 中的 `skills/engineering-document-redactor/` 完整資料夾，而非只複製這個入口。
