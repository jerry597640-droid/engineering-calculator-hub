# XJTC 工程協作中心 R4 共用帳號試辦

- 這是 Cloudflare 的獨立測試入口，不會載入或改動現有 ChatGPT Sites R4、原工具管控站、工具授權或任何正式專案資料。
- 沿用既有 Supabase Auth 的電子郵件、密碼和已註冊的手機驗證器。R4 Cookie 為各站獨立、僅 HTTPS、HttpOnly，最多 15 分鐘。不沿用工具站登入階段，不建立新帳號，也不傳回 refresh token。
- R4 獨立查詢本人的專案授權，來源為 `xj_r4_staging_project_grants`，與工具站的 `ech_*` 權限分開。相同帳號通過驗證但無 R4 權限時回 403。權限撤銷會在下一個請求生效。
- 試辦僅提供唯讀合成示範 RFI。專案 A 用於正向驗收，專案 B 保持不授權，用於隔離測試。路由斷線、授權查詢失敗或無可驗證身分時不回傳測試資料。

## 佈署與驗收

1. 由 Supabase 測試專案管理者執行 `authz.sql`。只給已經確認身分的測試管理者專案 A 權限。勿新增或覆寫現有工具權限。這版透過 Supabase 後台管理測試授權，沒有 R4 授權管理介面。
2. Node 22 或以上執行 `node --test worker.test.mjs`，再以 `npx --yes wrangler@4.92.0 deploy --dry-run` 檢查。GitHub Actions 此處只檢查、不部署，也不使用工具管控站的憑證。若以 Cloudflare 已連接的 GitHub 專案部署，設定分支 `codex/r4-login-staging-20261126`、根目錄 `r4-access-staging`，部署指令 `npx --yes wrangler@4.92.0 deploy`，Worker 名稱只用 `xjtc-r4-access-staging`，不要選擇既有的工程工具 Worker。
3. 使用自己的既有測試帳號登入，自己輸入手機 6 位碼。應只能列出專案 A，直接前往 `/workspace/R4-DEMO-B` 應被拒絕。未獲 R4 授權但有工具權限的獨立帳號應可通過 MFA，隨後看到「已驗證帳號，但未開通 R4」。
4. 登出 R4 後，直接開啟 `/workspace/R4-DEMO-A` 應回登入頁，`/api/projects/R4-DEMO-A` 應回 401。R4 登出不會登出原工具站。本機模擬測試不能取代雲端真實登入端到端驗收。
