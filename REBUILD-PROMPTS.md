# 重建用 Prompts

> 搭配 `REBUILD-SUMMARY.md` 使用。順序建議：**A（基建/後端）→ B（前端）→ C（整合驗收）**。
> 每個 prompt 都留了「業主補充區」；新功能與新風格由你填，agent 不得自行臆測。

---

## Prompt A — 基建與後端（Postgres + Docker + Cloudflare Tunnel）

```
角色：你是資深 backend / DevOps 工程師，負責把一個原本「單檔 HTML + Firebase RTDB + Vercel」的麻雀計分 app，
改造成「自架 Linux + Docker + PostgreSQL + Cloudflare Tunnel」的三層架構。

必讀輸入（先完整讀完再動手）：
- ./REBUILD-SUMMARY.md   ← 現況 UI／邏輯／資料模型的唯一事實來源
- ./mahjong-scorer.html  ← 現況可運作版本，行為需等價重現
- ./firebase-config.js   ← 即將淘汰的 Firebase 設定（僅供比對資料形狀）

【硬約束 — 不可協商】
1. 不再使用 Vercel、Firebase（任何形式，含 CDN SDK）。
2. 部署目標：單台 Linux + Docker Compose。服務至少包含：
   - web：HTTP API + 靜態前端（單一 origin，免 CORS）
   - db：postgres:16-alpine，具名 volume，healthcheck
   - cloudflared：用 TUNNEL_TOKEN 連 Cloudflare Tunnel，指向 http://web:3000
3. 對外只經 Cloudflare Tunnel；不 publish 任何 inbound port（db 不映射到 host）。
4. 瀏覽器**絕對不可**直連 Postgres，也不可在前端出現任何 DB 憑證。
5. Secrets 一律走 .env / Docker secret：POSTGRES_PASSWORD、DATABASE_URL、TUNNEL_TOKEN、APP_PASSCODE、SESSION_SECRET。
   .env 必須在 .gitignore，且不得出現在任何 commit、log、前端 bundle。
6. 容器 TZ=Asia/Hong_Kong（「日期」以香港時區為準，否則跨日統計會錯）。
7. 所有 migration 必須 idempotent（重啟可安全重跑）。

【資料模型（依 summary 第 6 節，正規化）】
players(id, name unique, created_at)
games(id, played_at date, recorded_at timestamptz, external_id text unique, note text)
settlements(game_id fk cascade, player_id fk, score numeric(10,1), pk(game_id, player_id))
重點：一筆小氣簿記錄 = 1 games + N settlements。改名只改 players.name，歷史自動跟隨，
      不要重現 Firebase 的「雙寫 + 手動搬歷史」邏輯。**不要**加 group_id（單一帳簿，不做多檯）。

【存取控制：共用密語 + HttpOnly cookie（已決策）】
- .env 持有 APP_PASSCODE（≥32 字元隨機字串）+ SESSION_SECRET；前端不得硬編碼。
- POST /api/auth { passcode } → 成功回 204/200 並 Set-Cookie：
  mj_session=<signed-token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
- Token 用 HMAC 簽章、含 iat/exp（30 天）。**不要**回傳 token 給 JS，**不要**用 Authorization: Bearer。
- 密碼比對 constant-time；錯誤一律 401 且訊息一致；/api/auth 需 rate limit（同 IP 每分鐘 5 次）。
- 除 /api/auth、/api/health 外，全部 /api/* 需有效 cookie；失效／過期 → 401。
- POST /api/auth/logout → 清 cookie。
- 不做使用者帳號、角色、權限分級。
- 因為單一 origin，不需要 CORS；但需設定：只接受 application/json、X-Content-Type-Options: nosniff、
  Referrer-Policy: same-origin。

【PWA 靜態資源（後端責）】
- 正確 MIME：manifest.webmanifest → application/manifest+json；sw.js → text/javascript。
- Cache-Control: no-cache（或 max-age=0, must-revalidate）給 index.html / sw.js / manifest.webmanifest。
- 健康檢查與 API 不可被 service worker 或 CDN 快取。

【Cloudflare Tunnel（已決策）】
- 必須用 Named Tunnel + 固定自有網域（例 mj.example.com），**不可**用 trycloudflare Quick Tunnel
  （每次重啟換網址會讓已加入主畫面的 PWA 失效）。
- cloudflared 以 TUNNEL_TOKEN 啟動，ingress 指向 http://web:3000；HTTPS 由 Cloudflare 提供。
- 交付：cloudflared 的 ingress 設定（或 dashboard 設定步驟）+ 驗證對外可達且憑證有效。

【API（名稱可調，語意不可變）】
POST   /api/auth                    → { passcode } → Set-Cookie（HttpOnly session）
POST   /api/auth/logout             → 清 cookie
GET    /api/health                  → { ok, db:true|false }（免 cookie）
GET    /api/records?limit=&cursor=  → played_at desc 分頁（預設 50、上限 200；含四家分數與 record id）
POST   /api/records                 → 寫入一筆（date, players[]{name, score}）；同名玩家 reuse
PATCH  /api/records/:id             → 改分數、改名（改名 = 改 players.name 或建立新 player 並改 settlement）
DELETE /api/records/:id             → 刪記錄（cascade settlements）
GET    /api/players                 → 名稱清單（供 datalist）
GET    /api/stats?player=&year=     → 全量：年度總額/勝率 + 全期最佳/最差（含日期）/平均勝敗
GET    /api/ranking                 → 全量總額排序 + 勝/敗場次
要求：輸入驗證（分數 numeric、名稱長度 1–7、日期合法）、明確 4xx/5xx JSON 錯誤、寫入用 transaction、參數化查詢（禁字串拼接 SQL）。

【必須交付】
- docker-compose.yml（web / db / cloudflared，含 healthcheck、depends_on、restart policy、volume）
- Dockerfile（multi-stage、非 root 使用者、映像精簡）
- .env.example、.gitignore（含 .env、data/*.json）、README 的「自架部署 + 還原」章節
- 靜態資源標頭：manifest.webmanifest → application/manifest+json；sw.js / index.html / manifest.webmanifest → Cache-Control: no-cache
- migrations/（初始 schema + 索引：games.played_at, settlements.player_id, games.external_id unique）
- **Firebase 匯入腳本 scripts/import-firebase-json.mjs**（已決策要搬）：
  · 讀 Firebase RTDB 匯出 JSON（data/ 下，不 commit）
  · records/{ts} → 1 games（external_id=timestamp）+ N settlements；played_at 取 date，缺則以 Asia/Hong_Kong 換算
  · 冪等（external_id unique），重跑不重複；players 為空的記錄跳過並記 warning
  · 玩家名不還原 sanitize，直接用 key；列出以 `_` 結尾的名稱供人工核對
  · 輸出報告：新增/跳過/警告數 + 抽 5 筆並列 diff
- curl 範例或 .http 檔，證明每個 endpoint 可用（含未帶 cookie 的 401）
- 備份方案：每日 pg_dump cron 容器或 host cron + 保留 14 份 + 還原步驟（實測一次）

【絕對不要】
- 不要引入 ORM 之外的魔法（若用 ORM 需說明選型理由）
- 不要在前端呼叫 DB
- 不要用 `latest` tag 當正式版本
- 不要動到 UI 樣式與互動（那是 Prompt B 的範圍）
- 不要在未確認下引入需要付費的雲服務
- 不要把 APP_PASSCODE / SESSION_SECRET / TUNNEL_TOKEN 寫進任何前端檔案或 commit
- 不要自行加入多檯、群組、使用者帳號功能

【業主補充區（已決策，勿再詢問）】
- 存取控制：**共用密語**（見上方規格）
- 既有 Firebase 資料：**要搬**（用上面的 import script）
- 多檯／多群組：**不要**
- 統計／排名：**全量**
- 新功能（未列則不做）：

【驗收（你必須實際跑過）】
1. docker compose up -d 後三個容器 healthy。
2. GET /api/health 回 ok:true。
3. 未帶 cookie → 401；錯誤密語 → 401 且連續錯誤觸發 rate limit；
   正確密語 → Set-Cookie 含 HttpOnly/Secure/SameSite=Lax → 可讀寫；回傳 body 不含 token；
   curl -v 貼出 Set-Cookie 標頭證明。logout 後再呼叫 → 401。
4. POST → GET → PATCH → DELETE 全流程 curl 成功（貼出實際輸出）。
5. 重啟容器後資料仍在（volume 生效）。
6. 重建 db 容器後以 dump 還原成功。
7. 匯入 Firebase JSON 後：/api/ranking 各家總額 = 對原始 JSON 全量求和（誤差 0）；重跑腳本不產生重複。
8. 全 repo 搜不到 firebase / vercel 殘留（除非在文件說明歷史）。
9. 回報格式：先給結論（PASS/FAIL）再列證據，最後列「待業主決策」。
```

---

## Prompt B — 前端重建（UI 與互動）

```
角色：你是資深 frontend engineer，專長 mobile-first、高密度表單、觸控與可及性。
任務：依規格重寫麻雀計分 app 的前端。行為需等價重現；頁面架構與視覺風格由你設計（業主另有指示則以業主為準）。

必讀輸入：
- ./REBUILD-SUMMARY.md   ← 逐節照做（尤其 3.5「你的自由度」、4. 功能與版面、8. 驗收清單、9. 已知瑕疵）
- ./mahjong-scorer.html  ← 現況實作，互動細節以它為準（視覺僅供理解，不是範本）
- 後端 API 契約見 Prompt A（若尚未完成，先用 mock 並集中於單一 api client 模組，之後只換實作）

【硬約束】
1. 三個工作流（番數記錄 / 埋數 / 小氣簿）都必須存在且可互相到達；
   頁面架構（SPA / MPA / SSR）、路由、導航形態**由你決定**，但切換時當日牌局狀態不得遺失。
2. 計分公式不可改：output = ceil(Σ r_i · 1.5^(n-1-i))，只計非空值、由上而下。
3. 找數語意不可改：閒家 −output、我 +output、清空該欄、可復原。
4. 埋數金額格式：永遠 1 位小數，正 ` $12.5`、負 `-$12.5`、零 ` $0.0`。
5. 特別賞罰零和：收 = +3× 於該家、其餘各 −1×；賠相反。
6. 飯錢 = paid − owed，round 1dp。
7. 當日牌局狀態只存 localStorage（keys 見 summary §5），重整不丟；斷網仍可記分。
8. 小氣簿走 API，不得直連資料庫；失敗要有明確提示 + 可重試，不可白屏。
9. 共用密語：首次進入（或任何 API 回 401）顯示「輸入通行碼」；登入成功靠伺服器 Set-Cookie
   （HttpOnly），**前端不儲存 token、不自行加 Authorization header**；請用 fetch 的 credentials:"same-origin"。
   passcode 本身不得寫死、不得長期儲存。
10. 375–430px 無橫向滾動、無文字裁切、底部內容不被固定元素遮擋；**上下** safe-area 都要處理。
11. 完整實作 prefers-reduced-motion 替代動效（summary §3.4）。
12. 可及性：可點元素 ≥44px、focus 可見、按鈕用 <button>、輸入有 label、不要用 maximum-scale=1 擋縮放、
    輸入框字級 ≥16px（iOS 聚焦不自動放大）、輸入面板開啟時鎖住背景滾動（修正現況瑕疵 7）。
13. 視覺與主題（深色／淺色／跟隨系統）、配色、字型、元件形態、動效語彙**由你決定**（summary §3.5）。
    請以產品體驗為依據，不要照抄現況，也不要為了「看起來不一樣」而刻意改成淺色或多頁。
14. 正／負／零不可只靠顏色區分（需符號、粗細或文字輔助）；對比度達 WCAG AA。
15. 分發形式固定為 **A2HS PWA**（Safari → 加入主畫面 → standalone）。不可假設使用者會開 Safari 分頁。
16. 高度單位用 `100dvh`（不用 `100vh`）；standalone 沒有瀏覽器返回鍵，所有返回／關閉都要在介面內。

【PWA / iOS 主畫面（必須實作，summary §7.3.2）】
- manifest.webmanifest：name / short_name / start_url:"/" / scope:"/" / display:"standalone" /
  theme_color / background_color / icons 192+512（含 maskable）
- apple-touch-icon 180×180 PNG（不透明）；apple-mobile-web-app-capable / -title / -status-bar-style
- viewport：width=device-width, initial-scale=1, viewport-fit=cover（移除 maximum-scale）
- Service Worker：pre-cache app shell；HTML/SW network-first、API 不快取；離線開啟仍可進記分頁；
  更新時顯示「有新版本」提示（不要讓使用者卡在舊版）
- apple-touch-startup-image（常見 iPhone 尺寸）避免白屏
- 安裝引導：`navigator.standalone === false` 且 `display-mode` 非 standalone 時，顯示「分享 → 加入主畫面」提示（可關閉）
- 狀態列為 black-translucent 時，內容頂部需留 safe-area-top

【必須交付】
- 元件化但輕量的前端（若維持零 build，請說明；若用 Vite/框架，需提供 build 產物與 Dockerfile 掛載方式）
- 狀態管理集中化（單一 store 或 reducer），禁止散落的全域可變狀態
- 純函式抽出：computeRaw / roundTo1 / formatMoney / groupByDate（可單元測試）
- 單元測試覆蓋：公式（含負數、空值、單筆、滿 7 筆）、踢半、找數零和、特別賞罰、飯錢、統計聚合
- 空狀態／載入中／錯誤狀態（歷史、統計、排名各有）
- 通行碼輸入畫面（首次／401 時），含錯誤提示
- PWA 完整資產：manifest、icons（含 180/192/512）、apple-touch-startup-image、sw.js、offline fallback
- 截圖證據：375px 與 430px 各主要視圖（含輸入面板、確認對話框、輔助選單、載入態、登入畫面、reduced-motion）
- **實機證據（iPhone）**：加入主畫面後的 standalone 截圖、飛航模式重開截圖
- 「設計決策」一段：為何選此架構（SPA/MPA）、主題、元件形態，以及與現況差異的理由

【絕對不要】
- 不要改計分公式或結算語意
- 不要自作主張新增功能（新功能由【業主補充區】提供）
- 不要用 as any / @ts-ignore 之類壓制型別（若用 TS）
- 不要為了「好看」犧牲資訊密度（4 家 × 7 列必須能順暢操作）
- 不要在元件內直接 fetch；一律經 api client
- 不要留下 console.log 或死碼（如現況的 confirmUndo）
- 不要把 passcode 寫死在前端、不要用 localStorage 存 session
- 不要用 Quick Tunnel 的隨機網址當 start_url

【業主補充區（已決策，勿再詢問）】
- 存取控制：共用密語 + HttpOnly cookie（規格見 Prompt A；前端只做登入畫面）
- 分發：A2HS PWA（見上方 PWA 區）
- 統計／排名：全量（不要在前端用「最近 200 筆」自行聚合，改呼叫 /api/stats、/api/ranking）
- 歷史列表：分頁／載入更多（後端 limit + cursor）
- 新風格指示（配色／字型／氛圍／參考網站）：
- 新功能（逐項列，含互動與邊界條件）：
- 現況瑕疵：全部依 summary §9 的「建議」處理（踢半防連點、逐筆編輯刪除、加刷新、鎖滾動、移除縮放限制）

【驗收（實際操作，非推論）】
1. 逐步跑 summary §8 全部 checklist，逐項標 PASS/FAIL。
2. 貼出單元測試輸出（全綠）。
3. 貼出 375/430 截圖，並確認無裁切。
4. 登入流程：錯誤密語→提示；正確→進入；重整後仍保持登入（cookie）；DevTools 確認 cookie 為 HttpOnly
   且 JS 讀不到 document.cookie 中的 session；刪 cookie → 回登入畫面。
5. 模擬 API 500 / 離線：有提示、可重試、localStorage 資料未損。
6. 統計／排名：新增 60 筆以上測試資料，確認結果不受「最近 200 筆」邏輯影響（與 SQL 全量結果一致）。
7. PWA（實機 iPhone）：Safari → 分享 → 加入主畫面；從主畫面啟動無 Safari 網址列；
   icon 不透明且名稱正確；上下 safe-area 不遮內容；輸入框聚焦不放大；
   飛航模式重開仍能載入記分頁；重新部署後有「新版本」提示且能更新。
7. 回報格式：結論先行（PASS/FAIL），再列證據與未解問題。
```

---

## Prompt C — 整合與驗收（跑在 A、B 都完成之後）

```
角色：你是嚴格的驗收者（QA + reviewer），只做驗證與最小修補，不重構、不加功能。

輸入：
- ./REBUILD-SUMMARY.md（規格）
- 前端與後端實作
- 已啟動的 docker compose stack

任務：
1. 逐條驗證 summary §8（必須等價重現的行為）與 §9（瑕疵裁決）— 每條給 PASS/FAIL + 證據（指令輸出／截圖／DOM 片段）。
2. 端到端：以真實流程走一遍 — 輸入 7 列 → 踢半 → 找數 → 除數 → 特別賞罰 → 飯錢 → 寫入小氣簿 →
   歷史編輯 → 歷史刪除 → 個人數據 → 排名榜，確認數字一致（手算比對至少 3 組）。
3. 邊界：全 0 找數、全 0 除數、空輸入送確認、負數輸入、單筆輸入、7 列填滿、同日多筆記錄的逐筆編輯/刪除。
4. 物流：重啟容器資料不丟；db 還原流程可用；TZ 正確（跨日邊界測試：23:59 與 00:01）；
   tunnel 對外可達且為**固定網域**（Named Tunnel，重啟後 hostname 不變）；db port 未暴露；
   repo 無 secrets；無 firebase/vercel 殘留。
5. 安全（共用密語 + cookie）：未帶 cookie → 401；錯誤密語 → 401；連續錯誤觸發 rate limit；
   cookie 竄改／過期 → 401；cookie 具 HttpOnly+Secure+SameSite=Lax；回應 body 不含 session；
   passcode 不出現在前端 bundle／localStorage／log；logout 後立即失效。
   另測 SQL 注入（名稱含 `'`、`;`、`--`）與 XSS（名稱含 `<img onerror>`）。
6. 資料完整性：重跑 Firebase 匯入腳本不產生重複（external_id unique 生效）；
   匯入後排名總額 = 原始 JSON 全量求和（誤差 0）；抽 5 筆逐欄比對。
7. 全量驗證：統計與排名結果不受載入筆數影響（以 SQL 直接聚合對照）。
8. 效能：冷啟到可操作 < 3s；歷史分頁首屏渲染 < 500ms；無明顯 layout shift。
9. PWA：manifest 欄位完整、icon 存在且不透明、sw.js 註冊成功、快取標頭正確（sw/index/manifest 為 no-cache）；
   standalone 啟動、離線重開、safe-area、16px 輸入、安裝引導皆 PASS。
10. 設計自由度：確認前端未擅自更改計分／結算語意，且架構與主題選擇有書面理由（summary §3.5）。

限制：
- 只做「讓 checklist 由 FAIL 變 PASS」的最小修補，且每次修補後重跑相關驗證。
- 不改設計、不加功能、不動 schema（除非是 bug 且已說明）。
- 不確定就列為「待業主決策」，不要猜。

輸出格式（結論先行）：
- 總結論：PASS / PASS-with-issues / FAIL
- 表格：項目 | 結果 | 證據
- 阻斷級問題（必須修才能上線）
- 非阻斷問題（建議）
- 待業主決策清單
```

---

## 使用順序與交接

**方案一（單一 agent，最省事）**：直接用 **Prompt D**（已合併 A/B/C），把 `REBUILD-SUMMARY.md` 與 Firebase 匯出檔放好即可。

**方案二（分工，品質較穩）**：
1. 先把 `REBUILD-SUMMARY.md` 貼給 agent（或放 repo 根目錄讓它自己讀）。
2. 已決策：共用密語(cookie)、Firebase 資料要搬、不做多檯、統計全量、A2HS PWA、固定網域 — 已寫進 A、B，無需再填。
   仍可補的只有「新功能」與「風格指示」（不填就由 agent 自行決定）。
3. 匯出 Firebase JSON 給 A（放 `data/`，不要 commit），並提供 `APP_PASSCODE` 與 `SESSION_SECRET`。
4. A 完成後把 API 契約（實際路徑與 payload）回填給 B。
5. B 完成後用 C 做一次完整驗收，再上線。

---

## Prompt D — 單一 Agent 全流程（A + B + C 合併）

> 給「一個 agent 由零做到上線」用。與 A/B/C 二選一，不要同時餵。

```
角色：你是資深 full-stack + DevOps 工程師。把一個現有的「單檔 HTML + Firebase RTDB + Vercel」麻雀計分 app，
重寫成「自架 Linux + Docker Compose + PostgreSQL + Cloudflare Tunnel」的可安裝 PWA（iOS 加入主畫面）。

必讀輸入（先完整讀完，再輸出計畫，再動手）：
- ./REBUILD-SUMMARY.md   ← 唯一事實來源（行為、版面、資料、物流、驗收、瑕疵）
- ./mahjong-scorer.html  ← 現況可運作版本，行為以它為準（視覺不是範本）
- ./firebase-config.js   ← 即將淘汰，只用來理解資料形狀
- data/*.json            ← 業主提供的 Firebase 匯出（若存在；含個資，不得 commit）

【已決策 — 不要再問】
- 品牌：**Tally**（manifest name "Tally — Mahjong & Football"、short_name "Tally"）
- 網域：**tally.funnywai.tech**（Cloudflare Named Tunnel）
- 託管：自架 Linux + Docker Compose（web / db / cloudflared）
- 主機：`funnywai@192.168.68.52`（Ubuntu 24.04.4、Docker 29.6.1、Compose v5.3.1、x86_64、15GiB RAM）
- DB：PostgreSQL 16（同機容器），不用 Firebase / Vercel
- 認證：共用密語 + HttpOnly cookie session（30 天）
- 分發：A2HS PWA（Safari 加入主畫面、standalone），不做 App Store、不做原生殼
- 範圍：單一帳簿，**不做**多檯／群組／使用者帳號
- 統計／排名：**全量**（不受 200 筆限制）；歷史列表可分頁
- 時區：Asia/Hong_Kong
- 瑕疵：全部依 summary §9「建議」處理

【主機既有環境 — 不要破壞】
- 專案目錄：`/home/funnywai/Tally`、compose project name `tally`
- 已有一個**不相關**的 stack：`/home/funnywai/WorldCup`（project `worldcup`，postgres + FastAPI + Next.js + cloudflared）。
  **不要**動它的容器、network、volume、`.env`、tunnel token。
- host nginx 佔用 80/443；`127.0.0.1:8000`、3001、3002、8080、8081、8090 已被佔用。
- `web` 不需 publish port（cloudflared 走 compose 網路到 `web:3000`）；除錯可 `127.0.0.1:3100:3000`。
- `db` **完全不 publish**。
- sudo 需要密碼 → 需要 sudo 的步驟（防火牆等）列出來由業主手動執行，不要假設 passwordless。
- 使用者無 crontab；備份需自行新增（見下）。
- 可沿用 worldcup 慣例：logging `json-file` max-size 10m / max-file 3、healthcheck、`depends_on: service_healthy`、
  各專案自己的 `.env`（chmod 600）。

【技術約束】
1. web：Node.js（Express/Fastify）或 Go，同時供應靜態前端與 /api/*，單一 origin（免 CORS）。
2. db：postgres:16-alpine，具名 volume、healthcheck；**不 publish port**。
3. cloudflared：**獨立** tunnel（不要共用 worldcup 的 token），TUNNEL_TOKEN 啟動，
   public hostname `tally.funnywai.tech` → `http://web:3000`；HTTPS 由 Cloudflare 提供。
4. 瀏覽器不得直連 DB；前端不得出現任何 DB 憑證。
5. Secrets 全走 .env：POSTGRES_PASSWORD、DATABASE_URL、TUNNEL_TOKEN、APP_PASSCODE、SESSION_SECRET。
   .env 進 .gitignore（chmod 600）；data/*.json 一併排除。
6. 容器 TZ=Asia/Hong_Kong；日期換算與 SQL 聚合都用同一時區。
7. Migration 必須 idempotent；啟動自動套用。
8. 靜態標頭：manifest.webmanifest → application/manifest+json；
   sw.js / index.html / manifest → Cache-Control: no-cache。
9. 健康檢查 GET /api/health（免 cookie）回 { ok, db }。
10. 備份：`pg_dump` 每日一次寫入 `/home/funnywai/Tally/backups/`，保留 14 份；
    用 user crontab 或備份容器（專案目前無 cron，需自行建立並在 README 寫明）。

【資料模型】
players(id uuid pk, name text unique, created_at)
games(id uuid pk, played_at date, recorded_at timestamptz, external_id text unique, note text)
settlements(game_id fk→games cascade, player_id fk→players, score numeric(10,1), pk(game_id,player_id))
索引：games.played_at, settlements.player_id。一筆記錄 = 1 game + N settlements。
改名只改 players.name（歷史自動跟隨），不要雙寫、不要手動搬歷史。

【API】
POST   /api/auth                { passcode } → Set-Cookie: mj_session=<signed>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
POST   /api/auth/logout         → 清 cookie
GET    /api/health              → { ok, db }（免 cookie）
GET    /api/records?limit=&cursor=  → played_at desc 分頁（預設 50、上限 200），含 record id 與四家分數
POST   /api/records             → { date, players:[{name,score}] }（同名 reuse；transaction）
PATCH  /api/records/:id         → 改分數／改名（逐筆 id）
DELETE /api/records/:id         → 刪記錄（cascade）
GET    /api/players             → 名稱清單
GET    /api/stats?player=&year= → 全量：年度總額/勝率 + 全期最佳/最差（含日期）/平均勝敗
GET    /api/ranking             → 全量總額排序 + 勝/敗場次
要求：constant-time 比對密碼；錯誤一律 401 且訊息一致；/api/auth rate limit（同 IP 每分鐘 5 次）；
     只接受 application/json；參數化查詢；明確 4xx/5xx JSON 錯誤；回應 body 不含 session。

【行為規格 — 必須等價】
A. 番數記錄
- 3 欄（閒1/閒2/閒3）× 7 列輸入（null = 空），點格開數字鍵盤（整數、±、⌫、完成；最多 6 位）。
- 輸出 = ceil(Σ r_i · 1.5^(n-1-i))，只計非空值、由上而下、最後向上取整。
- 踢半 = floor(output/2)，輸入不動；**每欄只作用一次**（已踢半則禁用，重新輸入才重置）。
- 找數：score=output；score=0 → 提示中止；閒家 −score、我 +score、清空該欄、推 undo、成功回饋。
- 名稱可改（≤7 字），空值回預設。
B. 埋數
- 四家分數同屏（現況菱形，可重排），金額永遠 1 位小數：` $12.5` / `-$12.5` / ` $0.0`（負號在錢號前）。
- 點卡片可直接調分（小數、+ / − 可連續運算），確認時 round 1dp。
- ÷4/÷3/÷2：全 0 則拒絕；否則全部 round(v/d, 1dp)，可復原。
- 特別賞罰：選玩家 + 收/賠 + 5 或 10。收 → 該家 +3×、其餘各 −1×；賠相反（零和），可復原。
- 計算飯錢：4 個「負責俾錢」+ 4 個「費用平攤」；「平攤」= round(總 paid / 4, 1dp) 填入 owed；
  確認 → accumulated += paid − owed（round 1dp），可復原；兩邊皆 0 則不寫入。
- 寫入小氣簿：loading 態、防重複送出、成功／失敗提示。
C. 小氣簿
- 歷史：日期分組、新→舊、skeleton 載入、空/錯誤狀態、**可重試／刷新**。
  每筆記錄各自可編輯（名稱+分數）與刪除（含警告），**不得只作用在當日第一筆**。
- 個人數據：名稱輸入（datalist 歷史名字）；年度總額、勝率、全期最佳/最差（含日期）、平均勝場/敗場。
- 排名榜：全量總額排序 + 贏/輸場次。
D. 輔助操作（位置形態自由）
- 重設（清 inputs/outputs/tikai/accumulated/undo，保留名稱）、改名、換位（交換名稱+分數；含「我」時清空該 grid 欄）、復原（pop undo）。
E. 狀態
- 當日牌局只存 localStorage（mj_names / mj_inputs / mj_outputs / mj_tikai / mj_accumulated / mj_undo_stack），
  重整不丟、斷網可記分；伺服器是帳簿唯一真相。
- iOS 可能回收本機儲存 → 不得把 session 或唯一資料放 localStorage。

【PWA（必須）】
- manifest：name / short_name / start_url:"/" / scope:"/" / display:"standalone" / theme_color / background_color / icons 192+512（含 maskable）
- apple-touch-icon 180×180（不透明）、apple-mobile-web-app-capable / -title / -status-bar-style
- viewport：width=device-width, initial-scale=1, viewport-fit=cover（移除 maximum-scale）
- 上下 safe-area；高度 100dvh；輸入框字級 ≥16px（防聚焦放大）
- Service Worker：pre-cache app shell；HTML/SW network-first、API 不快取；離線可進記分頁；部署後有「新版本」提示
- apple-touch-startup-image（常見 iPhone 尺寸）避免白屏
- 安裝引導：navigator.standalone === false 且非 display-mode standalone 時顯示「分享 → 加入主畫面」（可關閉）
- standalone 無瀏覽器返回鍵 → 所有返回／關閉都在介面內

【UI 自由度】
- 頁面架構（SPA/MPA/SSR）、路由、深色/淺色/跟隨系統、配色、字型、元件形態、動效語彙由你決定（summary §3.5）。
- 必須：可點元素 ≥44px、focus 可見、正/負/零不只靠顏色、對比度 WCAG AA、尊重 prefers-reduced-motion、
  375–430px 無橫向滾動／裁切／被遮擋。
- 不要照抄現況，也不要為差異而差異；在 README 寫一段「設計決策」說明理由。

【Firebase 資料搬移（已決策要搬）】
- 腳本 scripts/import-firebase-json.mjs：讀 data/*.json → games + settlements。
- external_id = 原始 timestamp（unique）→ 冪等，重跑不重複。
- played_at 取 date，缺則以 Asia/Hong_Kong 由 timestamp 換算。
- 玩家名不還原 sanitize，直接用 key；以 `_` 結尾或含 `_` 者列清單供人工核對。
- 分數全 0 仍匯入；players 為空的記錄跳過並記 warning。
- 輸出報告：新增/跳過/警告數 + 抽 5 筆與原始 JSON 並列 diff。
- 驗收：/api/ranking 各家總額 = 直接對 JSON 全量求和（誤差 0）。

【必須交付】
- docker-compose.yml（healthcheck、depends_on、restart、volume）、Dockerfile（multi-stage、非 root）
- migrations/、scripts/import-firebase-json.mjs、.env.example、.gitignore
- 前端原始碼 + 建置產物（若用 bundler）、manifest、icons、sw.js、offline fallback、splash
- 單元測試：公式（負數/空值/單筆/7 列）、踢半、找數、賞罰、飯錢、統計聚合、格式（round/formatMoney）
- API 整合測試或 curl 範例（含 401、rate limit、cookie flags）
- README：本機開發、部署（Compose + Named Tunnel）、secrets、備份與還原、設計決策
- 每日 pg_dump 備份（保留 14 份）+ 實測還原紀錄

【絕對不要】
- 不要 Firebase / Vercel（含 CDN SDK）殘留
- 不要瀏覽器直連 Postgres；不要在前端出現 secrets
- 不要用 Bearer/localStorage 存 session
- 不要 Quick Tunnel 隨機網址
- 不要改計分公式、結算語意、金額格式
- 不要加多檯／群組／使用者帳號（新功能只做業主在下方列出的）
- 不要 as any / @ts-ignore；不要刪測試來「通過」
- 不要留下 console.log 或死碼

【業主補充（未列則不做）】
- 新功能：
- 風格指示：
- 網域：tally.funnywai.tech（已定）
- Firebase 匯出檔位置：

【執行方式】
Phase 0：讀完輸入 → 輸出 1 頁計畫（架構、schema、風險、待確認事項）→ 才開始寫。
Phase 1：infra（compose/Dockerfile/migrations/health）
Phase 2：API + auth + 匯入腳本
Phase 3：前端三工作流 + localStorage 狀態
Phase 4：PWA（manifest/icon/SW/splash/安裝引導/safe-area）
Phase 5：測試 + 實機驗收 + README
每階段結束貼出證據（指令輸出／截圖），再做下一階段。

【驗收（缺一不可，全部要證據）】
1. docker compose up -d → 三個容器 healthy；GET /api/health ok:true。
2. 未帶 cookie → 401；錯誤密語 → 401 且觸發 rate limit；正確 → Set-Cookie 具 HttpOnly/Secure/SameSite=Lax，body 無 session。
3. POST→GET→PATCH→DELETE 全流程 curl 成功（貼輸出）。
4. 重啟容器資料仍在；pg_dump 還原成功。
5. 匯入後排名總額與原始 JSON 全量求和一致（誤差 0）；重跑腳本不重複。
6. summary §8 全部 checklist 逐項 PASS/FAIL + 證據。
7. 單元／整合測試全綠（貼輸出）。
8. 375/430 截圖無裁切；iPhone 實機：加入主畫面、standalone 啟動、飛航模式重開、safe-area、鍵盤不遮、無聚焦放大。
9. 全量驗證：統計／排名與 SQL 直接聚合一致。
10. repo 無 secrets、無 firebase/vercel 殘留；TZ 跨日邊界（23:59/00:01）正確。

回報格式（結論先行）：
- 總結論：PASS / PASS-with-issues / FAIL
- 逐項 結果 + 證據
- 阻斷級問題 / 非阻斷問題
- 與規格的偏離（若有）及理由
- 尚未解決或需業主決定的事項（只列真正必要的）
```
