# 即時分析本機驗證 — 2026-10-11

來源：新 clone 的 main `edb37fa`，邊坡既有版本 `ec2c3f1` / v1.1.2。
第一階段僅本機修改與驗證；使用者後續已授權發布 main。工程核心 `engine.js` 無變更。

## 通過

- `node tests/verify-controls.cjs`：原幾何、載重、切片數值明細、三工況圖形、滑鼠／鍵盤／合成雙指縮放與平移回歸。
- `node tests/verify-regression.cjs`：60 片／密度 14 與 120 片／密度 20 的三工況 FS 均與儲存庫既有基準完全一致，公開乾／濕七切片案例通過。
- 基準 FS：常時 1.5072443770136377、暴雨 0.8494095215507232、地震 1.2417474637931343。
- `node tests/verify-live.cjs`：真實 Edge Worker；連續輸入 16→18→20 只啟動最後一筆；空白輸入清除結果；待執行及運算中取消；手動重算；舊成功／錯誤回呼忽略；三工況 FS、切片、範例切換、JSON 匯入；縮放不重算；下載單檔在 offline 模式自動分析。瀏覽器與 Node 完整結果以相對容許差 1e-10 比對。
- `node tests/verify-offline.cjs <解壓 index.html> <輸出目錄>`：重建 ZIP 解壓後在 offline 模式完成運算；Worker 建立失敗、核心錯誤回傳及 worker.onerror 均可復原；密度 30 完整運算，期間可操作縮放；影片附件存在。
- `git diff --check` 與 JS 語法檢查通過。

## 證據

`live-output/results.json`、`numerical-regression.json`、`offline-zip-results.json`。
畫面：`desktop-complete.png`、`desktop-running.png`、`invalid-input.png`、`mobile-complete.png`、`mobile-zoom-pan.png`、`offline-zip-complete.png`。
手機為 390×844 瀏覽器尺寸與合成 PointerEvent；未宣稱實體手機測試。

## 尚未完成的獨立檢核

`tests/verify.py` 無法完成：此機原先缺 SciPy，下載到工作區後，Windows 應用程式控制封鎖 NumPy 2.5.4 的 `_multiarray_umath` DLL（ImportError：應用程式控制原則已封鎖此檔案）。未修改安全設定或繞過封鎖。既有 verification.json 未更新；本次通過的是數值回歸，不是新跑完 SciPy 獨立積分／求根驗證。

## 待發布變更清單

- `app.js`：500 ms 延遲、自動啟動、版本與 Worker 身分防競態、停止／手動重算、狀態提示。
- `template.html`：自動分析說明與可及性狀態。
- `index.html`：重新建置的單檔程式。
- `slope-offline-v1.1.zip`：更新程式與測試，保留原影片／附件。
- `README.md`、更新的 `tests/verify-controls.cjs`、新增的 `verify-live.cjs`、`verify-regression.cjs`、`verify-offline.cjs`、`build-offline.py` 及本報告。
- `live-output` 為本機驗證證據；不必隨正式網站發布。發布標籤已更新為 v1.1.3 / LIVE ANALYSIS，HTML 匯出與單檔檔名同步更新。

發布前已 fetch，遠端仍為同一基準；僅提交本批檔案，保留其他工具變更。新增 slope-stability CI 將在 Linux 執行原獨立驗證；本機 DLL 限制仍保留。
