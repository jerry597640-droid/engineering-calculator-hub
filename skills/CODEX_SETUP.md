# 在 Codex 使用工程文件遮蔽 Skill

本專案提供兩種使用方式。兩者使用相同的 `engineering-document-redactor` 核心程式。

## 方式一：在工程工具專案中使用

1. 在 Codex 開啟 `jerry597640-droid/engineering-calculator-hub` 專案，使用最新的 `main`。
2. 專案的 `.agents/skills/engineering-document-redactor/SKILL.md` 會引導 Codex 讀取完整技能。首次更新後若技能尚未出現，重新開啟 Codex。
3. 輸入以下內容，讓 Codex 先檢查環境：

```text
$engineering-document-redactor
請先檢查這個專案的遮蔽工具環境，回報 Python 套件與繁體中文 OCR 是否可用。
```

4. 環境備妥後，提供要處理的本機文件或其路徑，例如：

```text
$engineering-document-redactor
請處理這份工程文件，遮蔽工程名稱、人名、中英文公司名稱與 Logo。
保留尺寸、材料強度、公式、單位和工程示意圖。
先列出文字候選並檢視全部圖片，依我已授權的範圍完成遮蔽及輸出檢查，保留原檔。
```

這個方式適用於開啟本儲存庫的 Codex 工作環境。Python、Tesseract 與語系資料仍須在實際執行環境可用；GitHub 中存在入口不代表這些依賴已安裝。

## 方式二：安裝成跨專案使用的個人 Skill

在具有正常安裝權限的個人 Codex 環境貼上：

```text
$skill-installer
請安裝下列 GitHub 儲存庫中的完整工程文件遮蔽 Skill：
儲存庫：jerry597640-droid/engineering-calculator-hub
路徑：skills/engineering-document-redactor
版本：main

請使用此 Codex 環境支援的個人技能安裝位置，保留完整 scripts、references、assets、agents 目錄。
安裝後執行 scripts/redact_engineering.py doctor，分別回報技能檔案、Python 依賴及繁中 OCR 的狀態。
若遇到權限拒絕，停止並回報，不修改權限設定或改用其他方式繞過。
```

若要固定到原始已驗證核心版本，可將版本改為 `c0773c127e157c3ac66e8eeb53b5010b380c06f5`。下載方式可能會先下載該版完整儲存庫；不是僅下載技能子資料夾。

不要將 `.agents/skills/engineering-document-redactor/` 的專案入口單獨安裝成個人技能，它需要同一儲存庫的完整工具目錄。若同時安裝同名個人技能並使用專案入口，選單可能出現兩個同名項目；選擇一種使用方式即可。

## 完成的判斷

- Codex 能列出或明確載入 `engineering-document-redactor`。
- `doctor` 回報所需 Python 套件可用。
- 要處理繁中掃描件時，另確認 `traditional_chinese_ocr_ready` 為 `true`。
- 用非敏感合成文件試跑 `inspect → review → apply → verify`，並檢視輸出。

`doctor` 的 `status: READY` 只代表必要 Python 模組可用；掃描件仍須另外檢查 Tesseract 與語系欄位。本次測試環境的 Python 依賴齊全，但預設 OCR 只有 `eng`、`osd`，`traditional_chinese_ocr_ready` 為 `false`。你的電腦須重新執行檢查。

Logo 仍須視覺辨識並選區；Word 圖片不支援自動 OCR；`INCONCLUSIVE` 表示尚有未涵蓋的驗證範圍。完整流程與限制見 [操作說明](README.md)。

## 本次設定與驗證範圍

專案入口屬於 GitHub 儲存庫設定，不會修改目前對話環境的受保護個人 Skills 目錄。入口路徑與 Python 指令可用性可在隔離的合成專案配置中檢查；本次環境沒有 Codex 可執行程式，因此不宣稱已完成使用者電腦上的選單顯示或自動載入驗收。

已完成同深度測試配置的入口解析、完整技能載入與 `doctor` 執行；12 個核心檔案與原始開發驗證快照一致。詳見 [專案入口驗證紀錄](validation/codex-project-entry.json)。

## 官方依據

核對日期：2026-10-25（臺灣時間）。OpenAI 官方文件說明 Codex 會搜尋儲存庫內的 `.agents/skills`，並支援以 `$skill-installer` 從其他儲存庫安裝技能。技能未顯示時可重新開啟 Codex。

- [OpenAI：Build skills](https://learn.chatgpt.com/docs/build-skills)
