# 麻雀計分 — 重建 Brief（現況 UI／邏輯 + 新物流約束）

> 用途：交給負責「整支重寫」的 agent，作為**行為與資料規格**，不是視覺或架構的指定。
> 邊界：**新功能、新視覺風格由業主另行提供**，本文件不臆測、不預先設計。
> **架構與外觀不繼承現況**：單頁／多頁、SPA／MPA、深色／淺色／跟隨系統、是否零 build、字型與配色，
> 全部由新 agent 自行決定（見 §3.5）；只有「三個工作流、計分公式、結算語意、資料不丟」是硬需求。
> 來源：`mahjong-scorer.html`（1571 行，單檔）、`firebase-config.js`、`README.md`、`vercel.json`（commit `a64b033`）。

---

## 1. 產品定位

單一使用者群（4 人一檯：3 位閒家 + 1 位「我」）的**麻雀計分器**。三個工作流：

1. **番數記錄** — 逐局輸入三家的番數，即時算出應收金額。
2. **埋數** — 累積四家的當日戰績，支援除數、特別賞罰、飯錢分攤，最後「寫入小氣簿」。
3. **小氣簿** — 跨日共享的歷史記錄、個人統計、排名榜。

介面全繁體中文（zh-Hant），行動優先。現況為單頁 + 深色主題，**這不是要求**（見 §3.5）。

---

## 2. 資訊架構與導航（現況描述，非要求）

> 頁面架構（SPA／MPA／SSR）、路由、導航元件樣式**一律由新 agent 決定**。
> 唯一不變：三個工作流都必須存在、可互相到達，且切換時當日牌局狀態不遺失。

- **App shell**：`max-width: 520px` 置中；`padding: 16px 14px calc(nav-h + safe-area + 24px)`。
- **Header**：左「麻雀計分」（「計分」二字金色），右側小字頁面標籤（`番數` / `埋數` / `小氣簿`）。
- **底部導航（現況，形態自由）**：3 個 tab（番數記錄 / 埋數 / 小氣簿），高 64px，半透明 + `backdrop-filter: blur(14px)`，上方 1px 邊線。Active tab 有強調色 + 頂端 24×3px 指示條。每個 tab 有 22px SVG 線性圖示。
- **頁面切換**：`display:none ↔ block` + `fadeSlide`（opacity 0→1、translateY 6px→0，200ms）。網址 hash 同步（`#fan` / `#mai` / `#ledger`），支援上一頁/下一頁。
- **FAB**：右下固定 56px 金色圓形「+」，位於導航列上方 16px；展開時旋轉 45°，上方彈出 4 個膠囊按鈕（間隔 50ms 依序進場）；點擊選單外部自動收起。
- **Safe area**：`viewport-fit=cover`，底部 `env(safe-area-inset-bottom)`；`maximum-scale=1`（禁用雙指縮放）；`overscroll-behavior-y: none`。
- **無路由框架、無 build step、無依賴**（現況描述）。

---

## 3. 設計系統（現況參考，可整套替換）

> 以下 tokens 只用來說明「現在的視覺長怎樣」，方便理解既有截圖與元件。
> **新 agent 不需要沿用**：配色、字型、圓角、動效曲線都可重做。
> 必須保留的只有：正／負／零的**語意區分**（不能只靠顏色，需有符號或粗細輔助）、對比度、觸控尺寸、reduced-motion。

### 3.1 色彩 token（`:root`）

| Token | 值 | 用途 |
|---|---|---|
| `--bg` | `#0f0f0f` | 頁面底色 |
| `--surface` | `#171717` | 卡片 / sheet |
| `--surface-2` | `#1f1f23` | 次級按鈕、modal 按鈕 |
| `--surface-3` | `#27272a` | 按下態 |
| `--border` | `#2a2a2e` | 全域邊線 |
| `--text` | `#e5e7eb` | 主文字 |
| `--muted` | `#71717a` | 次要文字、空值 |
| `--gold` | `#f59e0b` | 主強調色（品牌色） |
| `--gold-soft` | `#fbbf24` | 金色漸層亮端 |
| `--rose` | `#f43f5e` | 負數 / 危險 |
| `--emerald` | `#10b981` | 正數 / 成功 |

### 3.2 字型

- UI：`Noto Sans HK`（400/500/700/900），fallback `Inter` / system-ui。
- 數字：`Inter` + `font-variant-numeric: tabular-nums`，統一 `.num` class。

### 3.3 形狀／尺寸

- 圓角階層：卡片 12–14px、玩家卡 18px、sheet/modal 頂部 20px、FAB 50%。
- 觸控目標下限 42–52px（多數按鈕 `min-height: 44–52px`）。
- 分頁／欄位間距 6–14px；主要區塊間距 14–22px。

### 3.4 動效 token

```
--ease-out: cubic-bezier(0.23,1,0.32,1)
--ease-in-out: cubic-bezier(0.77,0,0.175,1)
--ease-drawer: cubic-bezier(0.32,0.72,0,1)
--ease-overshoot: cubic-bezier(.5,1.6,.4,1)
--dur-press:120ms  --dur-fast:150ms  --dur-base:200ms
--dur-sheet:280ms  --dur-emphasis:300ms  --dur-scrim:180ms
```

已實作的動效：頁面淡入上移、輸出格金光閃（`flashGold` 1→1.12→1 + text-shadow）、找數綠色擴散圈、分數 bump（1→1.18→1）、按鈕 `:active scale(.96~.94)`、FAB overshoot 旋轉、sheet/modal 由下滑入、toast 上下滑＋淡出、skeleton shimmer、金色輸出格內陰影。

**`prefers-reduced-motion: reduce` 全套替代方案必須保留**：頁面只淡入、輸出改光暈、找數改靜態邊框、分數改透明度脈動、FAB 立即切換、toast 只淡入淡出、skeleton 靜止、sheet 只淡入。

### 3.5 由新 agent 自由決定（明確不繼承現況）

以下項目**沒有**既定答案，請自行判斷並在實作文件中說明選擇理由：

| 項目 | 自由度 | 唯一底線 |
|---|---|---|
| 頁面架構 | SPA、MPA、SSR、單檔 HTML 皆可 | 三個工作流存在且可到達 |
| 路由 | hash、path、無路由皆可 | 重整後不迷路（或回到預設頁） |
| 主題 | 深色、淺色、跟隨系統皆可 | 對比度達 WCAG AA；正/負/零有意義區分 |
| 配色／品牌 | 整套重做 | 不靠顏色單一管道傳達正負（需符號或粗細） |
| 字型 | 自選（含系統字） | 中文不掉字、數字對齊（tabular） |
| 元件形態 | 底部 sheet、全螢幕、inline 皆可 | 拇指可及、關閉方式明確 |
| 動效 | 自選 | 尊重 `prefers-reduced-motion` |
| Build | 零 build 或 Vite/框架 | 產物可由 Docker 映像提供 |
| 程式風格 | 函式庫／框架自選 | 狀態集中、可測試、無全域散落狀態 |

**不在自由範圍（已決策）**：分發形式固定為 **A2HS PWA**（§7.3.2）、認證固定為共用密語 + HttpOnly cookie（§7.3.1）、
資料庫固定 PostgreSQL（§7.3.3）、不做多檯。

**不要**因為「現況是這樣」就照抄上述任一項；也**不要**為了彰顯差異而刻意改成多頁或淺色 —— 以產品體驗為準。

---

## 4. 功能與版面規格

> 版面描述以現況為示意（顏色、位置、元件形態可重排），**行為與可用控制項必須齊備**。
> 判斷標準：使用者能在不看說明的情況下完成同一批操作。

### 4.1 番數記錄（現況 `#page-fan`）

由上而下 5 個 3 欄 grid（`gap: 8px / 6px`），欄位對應 **閒1 / 閒2 / 閒3**（「我」不出現在此頁）：

1. **名稱列**：可編輯 input（金色、粗體、`maxlength=7`、focus 全選）。失焦後自動存檔並重繪；空值回復預設名。
2. **輸出列**：金色漸層大格（30px / 900 字重，`min-height 64px`），值變動時觸發金光閃。
3. **踢半列**：三顆按鈕，`踢半`（金字）。點擊 → 該欄輸出 `floor(output / 2)`，輸入值不動，輸出閃一下，寫入 localStorage。
4. **找數列**：三顆按鈕，綠色漸層（`#0e3a2a → #0a2a20`，字 `#a7f3d0`）。
5. **輸入 grid**：3 欄 × **固定 7 列**，row-major 排列（每列左至右為閒1/閒2/閒3）。
   - 空格顯示 `-`（muted、400 字重）；有值顯示數字（18px / 700）；負數顯示玫紅色。
   - 點任一格 → 開啟數字鍵盤 sheet。

**計分公式**（每次輸入確認後即時重算，`Math.ceil`）：

```
output = ceil( Σ_{i=0..n-1} r_i · 1.5^(n-1-i) )
```

- 只取**非 null** 的格，依「由上而下」順序組成 `r_0 … r_{n-1}`；空格不佔權重（不是補 0）。
- 最底一筆權重 `1.5^0 = 1`，越上面複利越重。
- 允許負數輸入（簽名鍵切換），公式照算，最後向上取整。

**找數（結算某一家）**：

1. `score = outputs[c]`（若曾按踢半，就是減半後的值）。
2. `score === 0` → toast「分數為 0，無需找數」，中止。
3. 先把快照推入 undo stack（`accumulated` / `inputs` / `outputs` / `tikai` / `who` / `whoIdx` / `score`）。
4. `accumulated[c] -= score`；`accumulated[3] += score`（我收錢）。
5. 清空該欄 inputs、輸出歸 0、清除該欄 tikai 標記。
6. 寫入 localStorage → 重繪輸入／輸出／埋數 → 該家與「我」的埋數卡片 bump → 綠色擴散動效 → toast「已找數 ✓」。

> 註：**踢半**目前沒有 undo 記錄，且可重複點擊（每點一次再減半）。重建時「保留原行為」或「修成只作用一次」需業主決定。

### 4.2 埋數（`#page-mai`）

**菱形佈局**（玩家卡 140px 寬、18px 圓角、`:active scale(.97)`）：

```
        [閒2 / pc-1]
   [閒1 / pc-0]  [閒3 / pc-2]
        [我  / pc-3]   ← 金色邊框 + 金色漸層底
```

- 卡片內容：小字名稱（muted，我為金色）+ 28px 分數。
- 分數格式：**永遠 1 位小數**，正數 ` $12.5`、負數 `-$12.5`、零 ` $0.0`（負號在錢號前）。
- 顏色：正 emerald／負 rose／零 muted；數值變動時 `bump` 動效。
- **點卡片** → 開啟「調整分數」數字鍵盤（可直接加減，見 4.5）。

**除數列**：`÷4`、`÷3`、`÷2` 三顆按鈕。
- 四家分數全為 0 → toast「分數全為 0，無需除數」。
- 否則推 undo 快照 → 全部 `round(v/d, 1dp)` → 重繪 → toast「已 ÷N ✓」。

**特別賞罰** modal：
- 玩家選擇（4 顆並排，選中金色邊框 + 深金底）。
- 類型：`收`（emerald 選中）/ `賠`（rose 選中）。
- 分數：`5` 或 `10`（二選一）。
- 三項都選了「確認」才可作用（未齊時 opacity .4）。
- 結算（**零和**）：`收` → 該家 `+3 × score`，其餘三家各 `-score`；`賠` → 該家 `-3 × score`，其餘各 `+score`。
- 推 undo → 重繪 → 關閉 → toast「{名} 贏/賠 {分} 分」。

**計算飯錢** modal：
- 「負責俾錢」4 個數字輸入（type=number、inputmode=decimal、focus 全選）。
- 「費用平攤」4 個數字輸入 + `平攤` 按鈕 → 總 paid ÷ 4，`round(1dp)` 寫入四個 owed 欄。
- 確認 → `accumulated[i] = round(accumulated[i] + paid[i] - owed[i], 1dp)`，推 undo，關閉，toast「已計算飯錢 ✓」。
- 兩邊合計皆為 0 → 直接關閉，不寫入。

**寫入小氣簿**：滿寬金色漸層按鈕（16px / 900 / `min-height 52px`）。
- 送出中：`disabled` + 文案改「寫入中…」；成功 toast「已寫入小氣簿 ✓」、失敗「寫入失敗」。
- 寫入內容：當下四家的 `accumulated`（含 1 位小數）+ 日期 + timestamp。

### 4.3 小氣簿（`#page-ledger`）

**三顆子分頁**（容器為 4px padding 的圓角底，active 為 surface-2 + 金色字）：`歷史記錄` / `個人數據` / `排名榜`。

#### (a) 歷史記錄
- 進入此 tab 時載入（**沒有重新整理按鈕，也沒有下拉刷新**；載入中顯示 3 個 skeleton shimmer）。
- 資料分組：依 `date`（YYYY-MM-DD）分組，**日期新→舊**。
- 每個日期區塊：卡片（14px 圓角、surface 底），標題為「YYYY年MM月DD日」（金色、字距 1px），右側兩顆 28px 小按鈕：`✎` 編輯、`✕` 刪除（玫紅）。
- 每筆記錄一列：玩家數等分欄位，上方小字名、下方 20px 分數（正 emerald／負 rose／零 muted）。
- 空狀態：「尚無記錄」；連線失敗：「載入失敗」；無後端：「Firebase 未連線」（重寫後改為對應文案，如「未連線資料庫」）。
- **編輯記錄** modal：每位玩家一組「名稱 + 分數」輸入；儲存時更新該筆記錄，並同步遷移該玩家的個人歷史（改名時把舊名下的歷史搬到新名，未改名則更新分數）。
- **刪除記錄** modal：顯示日期 + 各家分數摘要 + 紅字警告「此操作無法復原，將同時刪除遊戲記錄及玩家歷史數據。」；確認後刪除該筆記錄與四家對應的個人歷史。

#### (b) 個人數據
- 玩家名稱輸入框（`datalist` 自動補齊所有歷史出現過的名字），輸入即時重算。
- **全年累積（YYYY）**：總金額（`+$x.x` / `-$x.x`）、勝率（`xx.x%`，以該年有記錄的場次計）。
- **個人記錄**：最佳（含日期，`YYYY/MM/DD`）、最差（含日期）、平均勝場金額、平均敗場金額。
- 無資料一律顯示 `—`；數值顏色同上。

#### (c) 排名榜
- 表格 4 欄：`排名` / `玩家` / `贏/輸` / `金額`。
- 以「所有已載入記錄的總金額」由高到低排序，名次為 1,2,3…（金色）。
- `贏/輸` 顯示 `wins/losses` 兩個場次數。
- 無資料：「尚無數據」。

### 4.4 FAB 選單（4 項）

| 項目 | 行為 |
|---|---|
| ↺ 重設牌局（玫紅） | 確認 modal（「所有番數、輸入、埋數將清零（玩家名稱保留）」）→ 清空 inputs / outputs / tikai / accumulated / undo stack，保留 names |
| ✎ 改名（金色） | 4 個輸入框（標籤 `User 1..3`、`我 (User 0)`），儲存後重繪全部；空值回復預設名 |
| ⇄ 換位 | 選兩位玩家（選中金框）→ 交換「名稱 + 分數」；兩者都在 grid（idx<3）時連 inputs/outputs/tikai 一起換；其中一方是「我」時，該 grid 欄位直接清空 |
| ⟲ 復原 | 直接 pop undo stack（**目前無確認**；`confirmUndo()` 為死碼）→ 還原 accumulated/inputs/outputs/tikai → toast「已復原」；空堆疊時 toast「沒有可復原的操作」 |

### 4.5 共用元件

**數字鍵盤 sheet（`numpad`）** — 底部滑入、scrim `rgba(0,0,0,.65)`、點 scrim 關閉。
- 標題置中 12px muted：番數模式「{名} · 第 {n} 行」；埋數模式「{名} · 調整分數」。
- 顯示區：右對齊、28px/800、金色（負數玫紅）、`min-height 48px`。
- 5×3 網格，兩種配置：
  - **番數**：`[-] [空白] [完成]` / `1 2 3` / `4 5 6` / `7 8 9` / `[空白] [0] [⌫]`
  - **埋數**：`[+] [−] [完成]` / `1 2 3` / `4 5 6` / `7 8 9` / `[.] [0] [⌫]`
- 番數模式：整數（`parseInt`）、最多 6 位、`-` 切換正負、空白送確認＝清空該格；確認後重算輸出並觸發金光閃。
- 埋數模式：小數（最多 1 位有效計算精度）；顯示「累計值 運算子 當前輸入」；`+`/`−` 可連續串接；確認時 `round(1dp)`，與原值相同則直接關閉；有變動則推 undo、bump、toast「{名} → {值}」。
- 按鍵 42px 高、`:active scale(.94)`；`完成` 綠底、`⌫` 金色、`−` 玫紅、`+` emerald。

**通用 modal**：同為底部滑入面板（20px 頂部圓角），標題 18px/800、說明 muted 14px；底部兩顆等寬按鈕（`取消` ghost / `確認` 金色 / 危險操作玫紅漸層）。

**Toast**：固定於頂部（safe-area + 14px）居中，卡片 + 邊框，2.5s 後移除；`success` / `error` 各有語意色邊框。

**Skeleton**：`linear-gradient` shimmer 橫掃 1.2s infinite。

---

## 5. 狀態模型（現況）

```js
names       // string[4]                  [閒1, 閒2, 閒3, 我]
inputs      // (number|null)[3][7]        三欄 × 7 列，null = 空
outputs     // number[3]                  當前輸出（可能已被踢半）
tikai       // boolean[3]                 該欄是否已踢半
accumulated // number[4]                  累積戰績（1 位小數）
undoStack   // Snapshot[]                 LIFO，無上限
```

`Snapshot = { accumulated, inputs, outputs, tikai, who, whoIdx, score }`

**持久化**：全部存 `localStorage`（key 前綴 `mj_`），任何一次 mutation 後呼叫 `persist()` 全量寫回；啟動時讀回並重繪。後端只負責小氣簿，**不參與當日牌局狀態**。

| Key | 內容 |
|---|---|
| `mj_names` | `string[4]` |
| `mj_inputs` | `(number\|null)[3][7]` |
| `mj_outputs` | `number[3]` |
| `mj_tikai` | `boolean[3]` |
| `mj_accumulated` | `number[4]` |
| `mj_undo_stack` | `Snapshot[]`（README 寫 `mj_undo_snapshot`，程式實際用 `mj_undo_stack`） |

預設名稱：`['user 1','user 2','user 3','me']`。

---

## 6. 資料模型（小氣簿）

**現況（Firebase RTDB）** — 同一筆結算寫兩份，屬於反正規化：

```jsonc
{
  "records": {
    "1715200000000": {
      "date": "2026-05-09",
      "timestamp": 1715200000000,
      "players": { "我": 50, "閒1": 0, "閒2": -50, "閒3": 0 }
    }
  },
  "players": {
    "我": { "history": { "<pushId>": { "timestamp": 1715200000000, "date": "2026-05-09", "score": 50 } } }
  }
}
```

- 讀取：`records` 依 `timestamp` 排序取**最近 200 筆**（`limitToLast(200)`）。
- 玩家名作 key，需 sanitize（`.#$/$[]` → `_`），因此改名要手動搬歷史（現況最脆弱的一段）。
- 無認證；URL 即權限。

**目標（PostgreSQL）建議正規化**（僅提案，等業主確認）：

```sql
players   (id uuid pk, name text unique not null, created_at timestamptz default now())
games     (id uuid pk, played_at date not null,
           recorded_at timestamptz default now(),
           external_id text unique,          -- 由 Firebase 匯入時存原始 timestamp，保證冪等
           note text)
settlements (game_id uuid fk→games on delete cascade,
             player_id uuid fk→players,
             score numeric(10,1) not null,
             primary key (game_id, player_id))
```

- 「一筆小氣簿記錄」= 1 個 `games` + 4 筆 `settlements`，**單一真相來源**，個人歷史用查詢得出（改名只改 `players.name`，歷史自動跟隨，不再有遷移邏輯）。
- 統計與排名由 SQL 聚合（`sum` / `count` / `avg` / `filter (where score > 0)`），**全量**計算，不受載入筆數影響。
- **無** `group_id`（單一帳簿，不做多檯）。

---

## 7. 物流（Logistics）

### 7.1 現況

| 項目 | 現況 |
|---|---|
| 交付形式 | 單一 HTML（68KB）＋ `firebase-config.js`，無 build、無套件管理 |
| 前端資料層 | 瀏覽器**直連** Firebase RTDB（compat 9.23 CDN） |
| 認證 | 無（安全規則在 Firebase 端） |
| 託管 | Vercel 靜態託管；`vercel.json` 將所有路徑 rewrite 到 `mahjong-scorer.html` |
| 資料庫 | Firebase RTDB（`asia-southeast1`），`records` + `players/{name}/history` 雙寫 |
| 離線 | localStorage；小氣簿必須連網 |
| 備份 | 依賴 Firebase（本專案無自建備份） |

### 7.2 新目標（業主指定，硬約束）

1. **不再使用 Vercel**。
2. **部署在自架 Linux**，以 **Docker** 執行（建議 Docker Compose 單一 stack）。
3. **對外只透過 Cloudflare Tunnel**（`cloudflared`）曝光，不開 inbound port、不需要公開 IP、憑證由 Cloudflare 托管。
4. **不再使用 Firebase**；資料庫改為 **PostgreSQL，跑在同一台 Linux 的 Docker 內**。
5. **固定網域（必要）**：使用 **Named Tunnel + 自有網域 `tally.funnywai.tech`**，
   **不可用 Quick Tunnel**（`trycloudflare.com` 每次重啟換網址）。原因：PWA 的 `start_url` 會被寫進主畫面圖示，
   網址一變，已安裝的 app 就開不起來。HTTPS 由 Cloudflare 提供（HttpOnly+Secure cookie 的前提）。

### 7.3 由此推出的架構要求

- **瀏覽器不得直連 Postgres**（Postgres 協定不可暴露給瀏覽器，也不該穿過 tunnel）。必須有一個 **HTTP API 層**：前端 → REST/JSON → Postgres。
- 建議 stack（可替換，但必須維持「前端 / API / DB 三層」）：
  - `web`：Node.js（Express/Fastify）或 Go，同時**供應靜態前端**與 `/api/*`；單一 origin，免 CORS。
  - `db`：`postgres:16-alpine`，具名 volume 持久化，`healthcheck` + `depends_on: condition: service_healthy`。
  - `cloudflared`：以 tunnel token 啟動（`cloudflared tunnel --no-autoupdate run --token $TUNNEL_TOKEN`），指向 `http://web:3000`。
  - `backup`（選配）：cron 容器定期 `pg_dump`，輸出到掛載目錄。
- **只開兩個 Docker network 內部連線**；`db` 不 publish port（或僅 bind `127.0.0.1` 供本機除錯）。
- **Secrets 全部走 `.env` / Docker secret**（`POSTGRES_PASSWORD`、`DATABASE_URL`、`TUNNEL_TOKEN`、`APP_PASSCODE`、`SESSION_SECRET`），`.env` 進 `.gitignore`，不得進 repo 或前端 bundle。
- **遷移（migration）**：啟動時自動套用（如 node-pg-migrate / go migrate / 初始化 SQL），且可重複執行（idempotent）。
- **健康檢查**：`GET /api/health` 回 DB 連線狀態；Compose `healthcheck` 依此判斷。
- **資料備份**：`pg_dump` 每日排程 + 保留 N 份；文件化還原步驟（重建 volume → `psql < dump`）。
- **前端 API 介面**（對應現況操作，名稱可調）：
  - `POST /api/auth` → `{ passcode }`，成功以 `Set-Cookie` 發 session（見 7.3.1；唯一免 cookie 的寫入端點）
  - `GET  /api/health` → 免 cookie，只回 `{ ok, db }`
  - `GET  /api/records?limit=&cursor=` → 日期新→舊，**分頁**（預設 50、上限 200），前端「載入更多」
  - `POST /api/records` → 寫入一筆（四家分數）
  - `PATCH /api/records/:id` → 編輯分數／改名（**逐筆 id**，不是按日期群組）
  - `DELETE /api/records/:id` → 刪除（連同 settlements）
  - `GET  /api/players` → 名稱清單（供 datalist）
  - `GET  /api/stats?player=&year=` → **全量**：年度總額／勝率（`year` 篩選）＋ 全期最佳／最差／平均勝敗
  - `GET  /api/ranking` → **全量**總額排序 + 勝/敗場次
- **錯誤處理**：API 失敗時前端要有明確提示／空狀態，不可白屏；寫入按鈕需有 loading 與防止重複送出。

### 7.3.1 存取控制：共用密語（已決策）

- 伺服器持有 `APP_PASSCODE`（`.env`，**≥32 字元隨機字串**）與 `SESSION_SECRET`；前端不得硬編碼、不得寫進 bundle。
- `POST /api/auth { passcode }` → 驗證成功後 **`Set-Cookie`**：

  ```
  mj_session=<signed-token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
  ```

- **Token 只存在 HttpOnly cookie，不存在 localStorage**（前端 JS 讀不到）。簽章用 HMAC，載荷含 `iat`/`exp`（30 天）。
- 不使用 `Authorization: Bearer`。除 `/api/auth`、`/api/health` 外，所有 `/api/*` 要求有效 cookie；無效／過期 → 401。
- 密碼比對用 **constant-time**；錯誤一律 401，訊息不得區分「格式錯／密碼錯」。
- 登入端點需 **rate limit**（例：同 IP 每分鐘 5 次），防暴力嘗試。
- CSRF：`SameSite=Lax` + 只接受 `application/json`（非簡單請求）即可；不需額外 token。
- `POST /api/auth/logout` → 清除 cookie（可選但建議）。
- 換密碼 → 輪換 `SESSION_SECRET` → 全部 session 失效、全員重新輸入（可接受）。
- **不做**使用者帳號、角色、權限分級；玩家身分仍以記錄中的名字表達。

> 為何用 cookie 而非 localStorage：iOS 在儲存壓力下會回收網站資料，localStorage 裡的憑證可能消失；
> HttpOnly cookie 不受 JS 存取、XSS 偷不到，且單一 origin 下不需要 CORS。

### 7.3.2 PWA / iOS 主畫面（已決策）

**分發形式**：Safari →「加入主畫面」（A2HS），以 standalone 模式全螢幕啟動。**不做 App Store、不做原生殼**。

**品牌／網域**：`name: "Tally — Mahjong & Football"`、`short_name: "Tally"`、`start_url: "https://tally.funnywai.tech/"`、
`scope: "/"`。不要在名稱或 domain 使用 bet／wager／casino 字眼。

必須具備：

| 項目 | 要求 |
|---|---|
| `manifest.webmanifest` | `name`、`short_name`、`start_url:"/"`、`scope:"/"`、`display:"standalone"`、`theme_color`、`background_color`、192/512 icons（含 maskable） |
| `apple-touch-icon` | 180×180 PNG，**不透明**（透明會被填黑），iOS 自動加圓角 |
| Meta | `apple-mobile-web-app-capable=yes`、`apple-mobile-web-app-title`、`apple-mobile-web-app-status-bar-style`（`black-translucent` 需配頂部 safe-area） |
| Viewport | `width=device-width, initial-scale=1, viewport-fit=cover`；**移除 `maximum-scale=1`** |
| Safe area | 上下都要 `env(safe-area-inset-*)`；高度用 `100dvh`，不用 `100vh` |
| Service Worker | pre-cache app shell；HTML/SW 用 network-first（避免更新卡住）；API 不 cache；離線開啟顯示可用介面 |
| Splash | `apple-touch-startup-image`（常見 iPhone 尺寸），避免白屏 |
| 安裝提示 | iOS **沒有**自動安裝彈窗；首次在 Safari 開啟時顯示「分享 → 加入主畫面」引導（`navigator.standalone === false` 且 `display-mode` 非 standalone 時） |
| 輸入框字級 | **≥16px**，否則 iOS 聚焦時自動放大 |
| 導航 | standalone 無瀏覽器返回鍵，所有關閉／返回路徑必須在介面內 |
| 快取標頭 | `sw.js`、`index.html`、`manifest.webmanifest` 用 `Cache-Control: no-cache` |

已知限制（接受，不處理）：

- Web Push 需 iOS 16.4+ 且已加入主畫面；本 app 不需要。
- 無背景同步 → 「寫入小氣簿」離線時排隊（IndexedDB outbox）列為 **P2 可選**，非必要。
- 無 `navigator.vibrate`、不能鎖螢幕方向。
- A2HS 的儲存與 Safari 分頁**各自獨立**；刪除主畫面圖示 = 本機草稿消失（伺服器資料不受影響）。
- iOS 可能回收本機儲存 → **伺服器是唯一真相**，localStorage 只存當日草稿。

### 7.3.3 Firebase 資料搬移（已決策：要搬）

- **來源**：RTDB `/records`（主）＋ `/players/{name}/history`（僅補漏）。兩者不一致時**以 `records` 為準**。
- **匯出**：Firebase Console → RTDB → Export JSON（或 `firebase database:get / --output export.json`）。
  原始檔放 `data/` 且**不得 commit**（含個資）；`.gitignore` 要含 `data/*.json`。
- **匯入腳本** `scripts/import-firebase-json.mjs`：
  - 一筆 `records/{ts}` → 1 `games` + N `settlements`；`played_at` 取 `date`，缺則由 `timestamp` 以 `Asia/Hong_Kong` 換算。
  - 玩家名**不做還原**（`_` 可能是原名也可能是 sanitize 產物），直接用 JSON key；若出現以 `_` 結尾的名稱，列出清單請業主人工核對。
  - **冪等**：`games.external_id = 原始 timestamp`，加 `unique` 約束；重跑不產生重複。
  - 分數全 0 的記錄仍匯入（保留歷史真實性）；`players` 為空的記錄跳過並記 warning。
  - 輸出報告：新增／跳過／警告 數量 + 抽 5 筆與原始 JSON 並列 diff。
- **驗收**：匯入後 `/api/ranking` 各家總額 = 直接對 Firebase JSON 全量求和（誤差 0）。

### 7.4 已決策（業主確認，勿再詢問）

| 項目 | 決定 |
|---|---|
| 品牌 | **Tally**（`name: "Tally — Mahjong & Football"`、`short_name: "Tally"`；不用中文品牌、不用拼音） |
| 存取控制 | **共用密語**（HttpOnly cookie session，見 7.3.1） |
| 分發形式 | **A2HS PWA**（Safari 加入主畫面、standalone，見 7.3.2）；不做 App Store、不做原生殼 |
| 網域 | **`tally.funnywai.tech`**（Cloudflare Named Tunnel；Quick Tunnel 不可用） |
| 舊 Firebase 資料 | **要搬**（見 7.3.3） |
| 多檯／多群組 | **不要**；schema 不加 `group_id`，全站單一帳簿 |
| 統計範圍 | **全量**（stats / ranking 不受 200 筆限制；歷史列表可分頁） |
| 前端形態 | 由新 agent 決定（§3.5） |
| 時區 | `Asia/Hong_Kong`（容器 `TZ` + 日期換算一致） |
| 備份 | 每日 `pg_dump`，保留 14 份，實測還原一次 |

仍待業主裁決的只剩 **§9 已知瑕疵要修還是保留**（下方已附建議）。

### 7.5 實際主機環境（2026-10-21 探勘）

| 項目 | 實況 |
|---|---|
| 主機 | Ubuntu 24.04.4 LTS、kernel 6.8、x86_64、hostname `mgshing`、區網 `192.168.68.52` |
| 資源 | 15 GiB RAM、`/` 492G（已用 65G，可用 407G） |
| Docker | Engine **29.6.1**、Compose **v5.3.1**；使用者 `funnywai` 已在 docker group（免 sudo 可用） |
| sudo | **需要密碼**（非 passwordless）→ 需要 sudo 的步驟要人手執行 |
| 既有 stack | `worldcup`（`/home/funnywai/WorldCup`）：postgres:16-alpine + FastAPI(app) + Next.js(web) + cloudflared，全部已 running |
| 既有網路 | `worldcup_default`、`friend-league_default`（不同 compose project，互不相通） |
| 既有連接埠 | host nginx 佔用 **80/443**（sites-enabled: `myWeb`）；`127.0.0.1:8000` 給 worldcup app；3001/3002/8080/8081/8090 已被佔用 |
| 既有的 3000 | 由 worldcup `web` 容器**內部**使用（未 publish）→ 新 stack 可用自己的 3000，不衝突 |
| cloudflared | 只以容器形式存在（worldcup profile `tunnel`），host 沒有 binary、無 systemd unit |
| cron | 使用者無 crontab（備份要自行加） |
| 慣例（可沿用） | 專案放 `/home/funnywai/<Project>`；compose `name:` 小寫；logging `json-file` max-size 10m/max-file 3；DB 不 publish、只走 compose 網路；healthcheck + `depends_on: service_healthy`；secrets 在該專案 `.env`（600） |

**新專案建議**：`/home/funnywai/Tally`、compose project `tally`、**獨立** cloudflared 容器與**獨立** tunnel（不與 worldcup 共用），
public hostname `tally.funnywai.tech` → `http://web:3000`；`web` 不 publish port（除錯可 `127.0.0.1:3100:3000`）；`db` 完全不 publish。
避免動到 `worldcup`：不要共用其 network / volume / `.env` / tunnel token。

---

## 8. 必須等價重現的行為（驗收清單）

- [ ] 三個工作流皆可到達（頁面／路由形式自由）；切換時當日狀態不遺失。
- [ ] 3 欄 × 7 列輸入；空格有明確空態；負數有明確標示；點擊可輸入。
- [ ] 公式 `ceil(Σ r_i · 1.5^(n-1-i))`，只計非空值，順序由上而下。
- [ ] 踢半 = `floor(output/2)`，不動輸入。
- [ ] 找數 = 該家扣、我加、清空該欄、可復原、有成功回饋。
- [ ] 四家分數同屏可見（版面自由）；金額 1 位小數格式（含 `-$` 與零值）。
- [ ] ÷4 / ÷3 / ÷2、特別賞罰（零和 3:1）、飯錢分攤（paid − owed），三者皆可復原。
- [ ] 寫入小氣簿：loading 態、成功／失敗提示。
- [ ] 歷史：日期分組、新→舊、編輯（含改名）、刪除（含警告）。
- [ ] 個人數據：全年累積、勝率、最佳／最差（含日期）、平均勝場／敗場。
- [ ] 排名榜：總額排序 + 贏/輸場次（**全量**，非最近 200 筆）。
- [ ] 存取控制：未帶 cookie 的 `/api/*` 回 401；錯誤密語 401 且受 rate limit；登入後 `Set-Cookie` 為 `HttpOnly; Secure; SameSite=Lax`；前端讀不到 session。
- [ ] Firebase 匯入後：排名總額與原始 JSON 全量求和一致（誤差 0），抽樣 5 筆逐欄相同。
- [ ] 四個輔助操作可達：重設（保留名稱）、改名、換位、復原（位置與形態自由）。
- [ ] localStorage 斷網可用；重整後狀態不丟。
- [ ] Reduced-motion 替代動效。
- [ ] 375–430px 無橫向滾動、無文字裁切、底部內容不被固定元素遮擋。
- [ ] PWA：可「加入主畫面」；以 standalone 啟動（無 Safari 網址列）；icon 不透明、名稱正確。
- [ ] PWA：飛航模式重開仍在 standalone 中載入 app shell，記分頁可操作（小氣簿顯示離線提示）。
- [ ] PWA：上下 safe-area 正確（瀏海／Home indicator 不遮內容）；鍵盤彈出時輸入框與面板不被遮住。
- [ ] PWA：輸入框字級 ≥16px（聚焦不自動放大）；`start_url` 為固定網域。

---

## 9. 現況已知瑕疵（附建議處置；業主未反對即採用「建議」欄）

| # | 問題 | 建議 |
|---|---|---|
| 1 | **踢半可連點**：連點反覆減半，且不進 undo | **修**：該欄已踢半時按鈕禁用（或再按還原）；重新輸入即重置 |
| 2 | **歷史編輯／刪除粒度錯位**：同一天多筆時只作用在該日群組第一筆（`recs[0].timestamp`） | **必修**：每列各自帶 record id，按哪列改哪列 |
| 3 | **復原無確認**：FAB 直接 pop；`confirmUndo()` 是死碼 | 保留即時（低摩擦），但提示要寫明復原了什麼（「已復原：閒1 找數 12 分」） |
| 4 | **無刷新按鈕**：`.refresh-btn` CSS 存在但 markup 沒有；只在切到 tab 時載入 | **修**：加刷新（或下拉刷新）＋顯示最後更新時間 |
| 5 | README 與程式不一致（`mj_undo_snapshot` vs `mj_undo_stack`） | 隨重寫一併重寫文件 |
| 6 | Firebase 雙寫 `records` / `players/*/history` 易不同步 | Postgres 正規化後自動消失 |
| 7 | 輸入面板開啟時背景仍可滾動 | **修**：鎖 body scroll |
| 8 | `maximum-scale=1` 擋縮放 | **修**：移除 |
| 9 | 統計／排名只涵蓋最近 200 筆 | **修**：改全量（已決策） |
| 10 | 無認證，取得網址即可改寫／刪除 | **修**：共用密語（已決策） |

---

## 10. 名詞對照

| 中文 | 意義 |
|---|---|
| 番數 | 單局得分，輸入值 |
| 踢半 | 將該欄輸出減半 |
| 找數 | 結算：閒家付、我收，並清空該欄 |
| 埋數 | 當日累積戰績（可正可負） |
| 小氣簿 | 歷史結算帳簿 |
| 閒1/2/3 | 三位閒家（grid 第 0/1/2 欄） |
| 我 | 使用者本人（index 3） |
| 特別賞罰 | 額外獎懲（收 +3×、賠 −3×，其餘各 ∓1×） |
| 飯錢 | 餐費分攤，墊付 − 應付 |
