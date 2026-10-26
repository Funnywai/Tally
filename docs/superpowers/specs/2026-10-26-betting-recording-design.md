# 賭球投注記錄頁 — 設計

日期：2026-10-26

狀態：與使用者逐段確認完成（架構／UI／驗證與範圍）。

## 1. 背景與目標

Tally 目前是四人麻雀計分 PWA（番數、埋數、小氣簿），品牌已叫「Tally — Mahjong & Football」，但未有任何足球功能。

今次新增一個**個人足球投注記錄頁**：

- 記錄自己每一張投注注單，包括單場與過關（2–8 場）。
- 每張注單可之後補結果；輸贏由注碼與賠率自動計算。
- 有今日／本月輸贏、待結算摘要，以及獨立統計頁。
- 資料存 PostgreSQL，跨裝置同步，納入現有備份。
- 賭球 UI 與麻雀 UI **完全分離**：同一個 web app、同一個登入，但登入後可由 header 的 switch button 切換到另一個獨立外殼、視覺與導航。

今次只記「我自己」，不做分人；schema 之後可加 nullable bettor，不需重做。

## 2. 已確認決策

| 項目 | 決策 |
|---|---|
| 用途 | 個人投注紀錄，不是朋友找數 |
| 核心欄位 | 賽事、盤口／注項、注碼、賠率、結果 |
| 結果 | 未開、贏、半贏、走水、半輸、輸 |
| 過關 | 支援 2–8 場；整張注單一個結果，不逐場結算 |
| 儲存 | 伺服器 PostgreSQL＋API |
| 入口 | 麻雀 header 加 switch button；賭球 header 可返回麻雀 |
| 分離 | 賭球有自己的 header、底部導航、CSS、元件、icons；不重用麻雀 UI |
| 與小氣簿 | 完全分開，不互通、不影響麻雀排行 |
| 視覺 | 球場夜燈：深藍黑夜景、球場白線、floodlight volt、賠率板／注單排版 |
| 第一版 | 注單頁＋摘要＋歷史＋統計頁 |

## 3. 架構

### 3.1 方案

採用**獨立賭球模組**：

- 新增 `bets`、`bet_legs` 兩張表。
- 新增 `/api/bets`、`/api/bets/overview`、`/api/bets/stats`。
- 新增 `frontend/src/bet/` 模組，自帶 API、types、components、pages、CSS、icons。
- `App.tsx` 依 hash route 切換整個外殼：`#fan`／`#mai`／`#ledger` 是麻雀；`#bet` 是賭球。
- 不重用麻雀的 `components/`、`styles/tokens.css`、`lib/api.ts`、`GameProvider`。

### 3.2 檔案邊界

後端：

```
migrations/003_bets.sql
src/bets/types.ts
src/bets/profit.ts
src/bets/cursor.ts
src/bets/read.ts
src/bets/write.ts
src/bets/stats.ts
src/routes/bets.ts
src/schemas.ts            （加 bet schemas）
src/app.ts                （mount /api/bets）
```

前端：

```
frontend/src/bet/
  BetApp.tsx
  api.ts
  types.ts
  lib/profit.ts
  lib/format.ts
  components/BetHeader.tsx
  components/BetNav.tsx
  components/BetSummary.tsx
  components/BetCard.tsx
  components/BetForm.tsx
  components/BetConfirmDialog.tsx
  components/BetToast.tsx
  components/BetIcons.tsx
  pages/SlipPage.tsx
  pages/StatsPage.tsx
  bet.css
frontend/src/lib/http.ts   （由 lib/api.ts 抽出的通用 fetch／ApiError）
frontend/BET-DESIGN.md     （賭球視覺合約）
```

共用但不含 UI：

- 登入／session／`GET /api/players` 的 auth probe。
- `frontend/src/lib/http.ts`：`ApiError`、`isApiError`、`isNetworkError`、`doFetch`、`requestJson`、`requestVoid`、`jsonInit`、401 事件。
- `frontend/src/hooks/useOnlineStatus.ts`。
- `frontend/src/lib/date.ts` 的 `hkToday`、`formatDateLong`、`formatTimeHK`、`groupByDate`（generic）。

`lib/api.ts` 保留麻雀 schemas，改成從 `lib/http.ts` 匯入，並 re-export `ApiError`／`isApiError`／`isNetworkError`，避免改動既有 imports。

### 3.3 App shell 切換

- `useHashRoute` 的 `Route` 加入 `'bet'`；預設仍是 `#fan`。
- `AppContent` 完成 auth probe 後：
  - `route === 'bet'` → `<BetApp onExit={() => navigate('fan')} />`，不包 `GameProvider`、不包麻雀 `ToastProvider`。
  - 其他 route → `<GameProvider><MahjongShell /></GameProvider>`，`ToastProvider` 移到麻雀 shell 內。
- 麻雀 header 加一個 icon switch button（足球圖示，aria-label「切換到賭球」），放於 today chip 與工具鍵之間；375px 不擠爆。
- 賭球 header 有「麻雀」switch button 返回 `#fan`。
- 登入頁維持現狀，不改文案、不改視覺。

## 4. 資料模型

`migrations/003_bets.sql`，只新增表，不改現有表；idempotent，啟動時自動套用。

```sql
create table if not exists bets (
  id uuid primary key default gen_random_uuid(),
  bet_date date not null,
  stake numeric(10,2) not null,
  total_odds numeric(12,2) not null,
  result text not null default 'pending',
  profit numeric(14,2),
  created_at timestamptz(3) not null default now(),
  updated_at timestamptz(3) not null default now(),
  constraint bets_stake_check check (stake > 0),
  constraint bets_total_odds_check check (total_odds > 0),
  constraint bets_result_check check (
    result in ('pending', 'win', 'half_win', 'push', 'half_loss', 'loss')
  ),
  constraint bets_profit_check check (
    (result = 'pending' and profit is null)
    or (result <> 'pending' and profit is not null)
  )
);

create table if not exists bet_legs (
  bet_id uuid not null references bets(id) on delete cascade,
  position smallint not null,
  match text not null,
  market text not null,
  selection text not null,
  odds numeric(6,2) not null,
  primary key (bet_id, position),
  constraint bet_legs_position_check check (position between 1 and 8),
  constraint bet_legs_market_check check (
    market in ('1x2', 'handicap', 'totals', 'other')
  ),
  constraint bet_legs_odds_check check (odds >= 1.01 and odds <= 1000)
);

create index if not exists bets_pagination_idx
  on bets (bet_date desc, created_at desc, id desc);
```

- 單場 = 1 個 leg；過關 = 2–8 個 legs。
- `position` 由 1 開始，按 UI 順序。
- `total_odds`、`profit` 在寫入時由 `src/bets/profit.ts` 的同一套純函數計算並儲存；列表、統計、前端預覽都用同一結果，避免 SQL 與 JS 的 rounding 差異。
- `result = 'pending'` 時 `profit` 必須為 null；其他結果必須有值（DB check 強制）。
- 所有寫入（create／update legs／update stake／update result）都重新計算 `total_odds` 與 `profit`，再寫回。
- `PATCH` 成功時 `updated_at = now()`；`created_at` 不變。
- 不存 player／bettor；日後加 nullable `bettor text` 或 `bettor_id uuid`。

## 5. API

全部需要現有 session auth。錯誤格式沿用：

```json
{ "error": { "code": "VALIDATION", "message": "…" } }
```

### 5.1 型別

```ts
type BetResult = 'pending' | 'win' | 'half_win' | 'push' | 'half_loss' | 'loss';
type BetMarket = '1x2' | 'handicap' | 'totals' | 'other';

interface BetLeg {
  position: number;   // 1-based
  match: string;
  market: BetMarket;
  selection: string;
  odds: number;       // 2 dp
}

interface BetItem {
  id: string;
  date: string;        // YYYY-MM-DD (bet_date)
  recordedAt: string;  // ISO (created_at)
  stake: number;       // 2 dp
  result: BetResult;
  legs: BetLeg[];
  totalOdds: number;   // 2 dp
  profit: number | null;
}
```

#### 顯示標籤

| Result | 顯示 |
|---|---|
| `pending` | 未開／待結算 |
| `win` | 贏 |
| `half_win` | 半贏 |
| `push` | 走水 |
| `half_loss` | 半輸 |
| `loss` | 輸 |

| Market | 顯示 |
|---|---|
| `1x2` | 主客和 |
| `handicap` | 讓球 |
| `totals` | 大細 |
| `other` | 其他 |

- 1 個 leg = `單場`；N 個 legs = `N串1`（例：2 個 = `2串1`）。

### 5.2 Endpoints

| Method | Path | 說明 |
|---|---|---|
| `GET` | `/api/bets?limit=&cursor=&status=` | 列表，新到舊，keyset 分頁 |
| `POST` | `/api/bets` | 新增注單＋legs，201 |
| `PATCH` | `/api/bets/:id` | 局部更新，200 |
| `DELETE` | `/api/bets/:id` | 刪除注單，legs cascade，204 |
| `GET` | `/api/bets/overview` | 今日／本月／待結算摘要 |
| `GET` | `/api/bets/stats?period=` | 統計 |

路由註冊順序：`overview`、`stats` 必須在 `/:id` 之前。

#### GET /api/bets

- `limit`：1–200，預設 50。
- `cursor`：opaque base64url，內容 `{ betDate, createdAt, id }`；無效回 400。
- `status`：`all`（預設）／`pending`／`settled`。
  - `pending` → `result = 'pending'`
  - `settled` → `result <> 'pending'`
- 排序：`bet_date desc, created_at desc, id desc`。
- `legs` 按 `position asc` 回傳；單場只有 1 個 leg。
- 回傳：

```json
{
  "items": [
    {
      "id": "uuid",
      "date": "2026-10-26",
      "recordedAt": "2026-10-26T12:34:56.789Z",
      "stake": 500,
      "result": "pending",
      "legs": [
        {
          "position": 1,
          "match": "曼聯 vs 車路士",
          "market": "handicap",
          "selection": "曼聯 -0.5",
          "odds": 1.95
        }
      ],
      "totalOdds": 1.95,
      "profit": null
    }
  ],
  "nextCursor": null
}
```

#### POST /api/bets

```json
{
  "date": "2026-10-26",
  "stake": 500,
  "result": "pending",
  "legs": [
    { "match": "曼聯 vs 車路士", "market": "handicap", "selection": "曼聯 -0.5", "odds": 1.95 },
    { "match": "阿仙奴 vs 利物浦", "market": "totals", "selection": "大 2.5", "odds": 1.9 }
  ]
}
```

- `date` 省略時用香港今日。
- `result` 省略時用 `pending`。
- `legs` 以陣列順序寫入，伺服器指定 `position = index + 1`（1–8）。
- 回傳 201＋完整 `BetItem`。

#### PATCH /api/bets/:id

- 可提供 `date`、`stake`、`result`、`legs` 任一或多個；至少一個。
- `legs` 有提供就整組替換（delete + insert，transaction），position 重新由 1 開始。
- 任何更新都重新計算並寫回 `total_odds`、`profit`。
- 不存在回 404。
- 回傳 200＋完整 `BetItem`。

#### DELETE /api/bets/:id

- 成功 204；不存在 404。

#### GET /api/bets/overview

```json
{
  "today": {
    "profit": 120.5,
    "settledStake": 500,
    "settledBets": 2,
    "pendingBets": 1
  },
  "month": {
    "profit": 415.5,
    "settledStake": 3200,
    "settledBets": 9,
    "pendingBets": 3
  },
  "pending": {
    "count": 3,
    "stake": 900
  }
}
```

- `today`／`month` 以 `bet_date` 對香港今日／當前月。
- `profit`、`settledStake`、`settledBets` 只計非 pending。
- `pendingBets` 是該期間內 pending 的注單數。
- `pending` 是全資料的 pending 總數與注碼。

#### GET /api/bets/stats?period=month|year|all

- `period` 預設 `month`；`month`＝香港當前月、`year`＝香港當前年、`all`＝全部。
- 回傳：

```json
{
  "period": "month",
  "totals": {
    "settledStake": 3200,
    "profit": 415.5,
    "roi": 12.98,
    "settledBets": 9,
    "wins": 5,
    "winRate": 55.56,
    "avgOdds": 2.14,
    "pendingCount": 3,
    "pendingStake": 900
  },
  "byType": [
    { "type": "single", "bets": 5, "stake": 1500, "profit": 200, "roi": 13.33 },
    { "type": "parlay", "bets": 4, "stake": 1700, "profit": 215.5, "roi": 12.68 }
  ],
  "byMarket": [
    { "market": "handicap", "bets": 3, "stake": 900, "profit": 100, "roi": 11.11 }
  ],
  "monthly": [
    { "month": "2026-05", "profit": -120 },
    { "month": "2026-06", "profit": 0 },
    { "month": "2026-07", "profit": 80 },
    { "month": "2026-08", "profit": 0 },
    { "month": "2026-09", "profit": 300 },
    { "month": "2026-10", "profit": 415.5 }
  ],
  "biggestWin": {
    "betId": "uuid",
    "profit": 800,
    "date": "2026-10-12",
    "label": "曼聯 vs 車路士"
  },
  "biggestLoss": {
    "betId": "uuid",
    "profit": -500,
    "date": "2026-10-03",
    "label": "3串1"
  }
}
```

- `totals.settledStake`、`profit`、`settledBets`、`wins`、`winRate`、`avgOdds` 只計非 pending。
- `pendingCount`／`pendingStake` 是該 period 內的 pending。
- `byType` 固定兩行（single／parlay），無資料時為 0。
- `byMarket` 只計**單場**已結算注單；只回有資料的 market，按 `stake desc, market asc` 排序；無資料時空陣列。
- `monthly` 固定近 6 個曆月（含本月），只計已結算；缺月份補 0。
- `biggestWin`／`biggestLoss` 只計 period 內已結算；無正／負輸贏時為 null。label 單場用第一 leg 的 match，過關用 `N串1`。Tie-break：profit 相同時取較早 `bet_date`，再較早 `id`。
- 所有比率 round 2；ROI／winRate／avgOdds 在分母為 0 時為 null。

## 6. 計算規則

### 6.0 Rounding

- `round2`：四捨五入（half away from zero）至 2 位小數；`-0` 正規化為 `0`。
- 先計總賠率並 round2，再用該值計 profit；兩者都寫入 DB。
- 前端預覽使用同一個 `round2` 規則，測試案例需與後端一致。

### 6.1 總賠率

以各 leg 已 round 至 2 位的賠率相乘，再 round 至 2 位小數：

```
totalOdds = round2(odds1 × odds2 × … × oddsN)
```

- 總賠率上限 99,999.99（round2 後檢查）；超過回 400 VALIDATION。
- 單場總賠率就是該場賠率。

### 6.2 輸贏

```
pending   → null
win       → stake × (totalOdds − 1)
half_win  → stake × (totalOdds − 1) / 2
push      → 0
half_loss → −stake / 2
loss      → −stake
```

結果一律 round 2 位小數（HK 仙）。`profit > 0` 才算勝；半贏算勝，走水／半輸／輸不算。

### 6.3 統計

```
settledStake = Σ stake (result <> 'pending')
profit       = Σ profit (result <> 'pending')
roi          = profit / settledStake × 100
winRate      = count(profit > 0) / count(result <> 'pending') × 100
avgOdds      = avg(totalOdds) (result <> 'pending')
```

- 分母 0 → null。
- 金額顯示 2 位小數；比率顯示 2 位小數。
- 伺服器以 `src/bets/profit.ts` 計算並儲存；stats 直接聚合 `bets.total_odds`／`bets.profit`，不重算。
- 前端預覽用同一公式，測試需對齊後端案例。

## 7. 前端資料流

### 7.1 注單頁

- Mount：並行 fetch `overview` 與 `bets`（status=all, limit=50）。
- 兩者各自 loading／error；overview 失敗不阻止列表顯示，反之亦然。摘要失敗時顯示「—」與細字重試。
- Filter chip 改變：重設 items／cursor，fetch 第一頁。
- 載入更多：沿用 `nextCursor`，append。
- 新增／編輯成功：關 sheet、顯示 bet toast、重抓目前 filter 第一頁＋overview。
- 刪除成功：同上。
- 失敗：sheet 不關、保留輸入、inline error。
- Request sequence guard：舊 response 不可覆蓋新 filter／新 reload。

### 7.2 統計頁

- Mount 或 period 改變：fetch `/api/bets/stats?period=…`。
- 切走再切回即重新 mount、重新 fetch；不共享 cache。
- 失敗顯示 bet 版 error＋重試。
- 無已結算注單：顯示空狀態，不畫空圖。

### 7.3 表單

- 新增預設：`date = hkToday()`、1 個空白 leg、`result = pending`。
- 編輯：由 `BetItem` 預填。
- `match`、`selection`、`odds`、`stake` 用 string state，提交時 parse；避免 input 空白時 NaN。
- 加 leg：最多 8；刪 leg：最少留 1。
- 總賠率即時計算；任何 leg 未填好顯示「—」。
- 結果 chips；pending 顯示「待結算」＋潛在回報（stake × totalOdds），已結算顯示輸贏。
- 儲存中停用；成功後關閉。
- 編輯模式有刪除，開 bet 版確認對話框。

## 8. UI／UX

### 8.1 賭球外殼

- 全畫面 `.bet-shell`，自己的 max-width 480px、背景、safe-area、header、底部導航。
- Header：左邊賭球 mark＋`Tally`＋「賭球」；右邊「麻雀」switch。
- 底部導航：`注單`、`統計` 兩格，獨立 active 樣式。內部 tab 用 component state，不寫 URL；reload 回注單頁。
- `body.bet-mode`：設定賭球背景，避免 overscroll 露麻雀底色；`<meta name="theme-color">` 進出時切換並還原。
- 不載入 `GameProvider`、不使用麻雀的元件與 CSS class。麻雀 CSS 仍由 `main.tsx` 全域載入，但賭球外殼不依賴它。

### 8.2 注單頁

1. 記分牌摘要三格：今日輸贏、本月輸贏、待結算（注數＋注碼）。
2. 全寬 volt `新增注單` CTA。
3. Filter chips：全部／待結算／已結算。
4. 按 `date` 分組；日期標頭顯示日期。為避免分頁造成不完整彙總，不在日期標頭顯示當日總輸贏。
5. 注單卡：
   - 頂行：`單場`／`N串1` badge、記錄時間、result badge。
   - Legs：盤口標籤、賽事、選擇、賠率；leg 編號 `01/02`。
   - 底行：注碼、總賠率、輸贏；pending 顯示「待結算」。
   - 點卡開編輯；pending 卡有「結算」文字鍵，開同一個 sheet。
6. 空狀態、skeleton、錯誤重試、離線 banner 全部賭球樣式。
7. 載入更多。

### 8.3 新增／編輯 sheet

- 全螢幕、由下往上；賭球自己的 sheet，不用麻雀 `Sheet`。
- 日期 input（16px、`inputMode` 合適）。
- Legs：賽事、盤口 chips（主客和／讓球／大細／其他）、選擇、賠率；`加一場`；每 leg 可刪（>1）。
- 注碼 input，`inputMode="decimal"`。
- 總賠率唯讀大字。
- 結果 chips：未開／贏／半贏／走水／半輸／輸。
- 輸贏預覽。
- Sticky footer：`儲存`；編輯模式另有 `刪除`。
- Focus trap、Esc 關閉、背景 scroll lock、關閉後 focus 返回觸發鍵。

### 8.4 統計頁

- Period segmented：本月／今年／全部。
- Hero：總輸贏大字、ROI、已結算注碼。
- KPI 2×2：勝率、平均賠率、已結算注數、本期待結算注碼。
- 單場 vs 過關表現列。
- 盤口分佈（只計單場）：橫向 diverging bar＋注數／注碼／輸贏／ROI。
- 近 6 個月輸贏柱狀圖（純 CSS，正綠負紅、零線）。
- 最大單筆贏／輸卡。
- 無資料空狀態。

## 9. 視覺合約（BET-DESIGN.md）

### 9.1 方向

**球場夜燈**：深夜球場、floodlight、賠率板、注單。與麻雀的墨綠／硃砂／tally mark 完全切割。

- 所有 `--bet-*` tokens 定義在 `:root`（namespaced），不影響麻雀 tokens；`.bet-shell` 使用它們，`body.bet-mode` 才可讀取背景。
- 背景：深藍黑 `#050b14`；surface `#0c1626`；raised `#122033`。
- Line：`#1e3147`；strong `#2c4a63`。
- 文字：`#f3f7f2` / dim `#b8c4cf` / muted `#7f92a3`。
- 主 action／active：floodlight volt `#d8ff4f`，配深墨字 `#0a1204`。
- 贏：`#5ee6a8`；輸：`#ff6b6b`；待結算：`#ffc857`；走水：`#9fb0bf`。
- Focus ring：volt。
- Scrim：`rgba(2, 6, 12, 0.78)`。

### 9.2 排版與質感

- UI 用系統 UI stack；所有數字用 `ui-monospace`＋`tabular-nums`。
- 大字賠率、比分牌式數字、uppercase mono 小標籤。
- 球場白線網格用極淡 1px CSS 漸層；floodlight 用 radial gradient。
- 招牌元素：注單卡、leg 編號、虛線分隔、result badge；不用 tally mark、印章、麻雀字樣。
- 無外部字體、無 CDN、無新 dependency。
- 動效 120–180ms；sheet 上滑、數字微閃、stat bar 生長；`prefers-reduced-motion` 全關。
- 對比：文字至少 4.5:1；UI 邊界至少 3:1；所有金額有正負號與文字，不只靠顏色。

### 9.3 響應式

- 375、430 為主；480px 上限。
- Touch target 最小 44px；input 16px；safe-area top／bottom；`100dvh`。
- 不新增桌面版；保持單欄。

## 10. 驗證與錯誤

### 10.1 輸入

- `date`：合法 `YYYY-MM-DD`；省略時香港今日；容許未來日期。
- `legs`：1–8。
- `match`：trim 後 1–80 Unicode code points；不可有控制字元。
- `selection`：trim 後 1–60；不可有控制字元。
- `market`：4 個 enum。
- `odds`：finite，1.01–1000；round 2 dp。
- `stake`：finite，0.01–9,999,999.99；round 2 dp。
- `result`：6 個 enum。
- `totalOdds`：≤ 99,999.99。
- `PATCH`：至少一個欄位；`legs` 有提供就整組替換。
- 無效回 400 `VALIDATION`；不存在回 404 `NOT_FOUND`；未登入回 401 `UNAUTHORIZED`。

### 10.2 失敗處理

- 表單錯誤保留輸入，sheet 不關。
- 儲存中停用，避免重複提交。
- 列表／統計 request sequence guard。
- 離線顯示賭球版 banner；不做離線寫入隊列、不存 localStorage draft。
- 刪除用賭球版確認對話框。
- 所有 response 經 Zod parse；格式錯顯示一般錯誤。

## 11. 測試

### 11.1 後端 unit

- `computeTotalOdds`：單場、2 場、8 場、round 2、超過上限。
- `computeProfit`：pending／win／half_win／push／half_loss／loss、round 2、-0 正規化。
- Zod：legs 1–8、odds/stake 上下限、enum、PATCH 空 body、控制字元、match／selection 長度。

### 11.2 後端 integration

- 全部 `/api/bets*` 未登入回 401。
- POST 單場 → 201、legs、totalOdds、profit null。
- POST 過關 3 場 → totalOdds 相乘。
- GET 列表：排序、keyset 分頁、status filter、invalid cursor 400。
- PATCH：日期／注碼／legs／result；profit 正確；404。
- POST／PATCH 後 DB 的 `total_odds`、`profit` 與 API 回傳一致；pending 時 profit null；push 時 0。
- DELETE：204；404。
- overview：今日／本月／pending 邊界（香港時區）。
- stats month／year／all：
  - settledStake、profit、roi、settledBets、wins、winRate、avgOdds。
  - byType 固定兩行。
  - byMarket 只計單場。
  - monthly 固定 6 個月、缺月補 0。
  - biggestWin／biggestLoss、null 情況。
- `tests/helpers/app.ts` 的 `resetDb` 改為 truncate `bet_legs, bets, settlements, games, players restart identity cascade`。

### 11.3 前端 unit

- 總賠率、profit 預覽（與後端案例對齊）。
- 金額／賠率／百分比格式化（`+$1,355.00`、`-$500.00`、`$0.00`、`—`）。
- result 標籤、bet type 標籤（單場／2串1）。
- 日期分組、統計顯示格式。
- API schema parse（正常與錯誤 response）。

### 11.4 E2E／視覺 QA

- 375 與 430：
  - 麻雀 header switch → 賭球；賭球 header 返回麻雀。
  - 新增單場、新增 3 關、pending 結算、編輯、刪除。
  - Reload 後資料仍在；換 filter、載入更多。
  - 統計頁 month／year／all 數字正確。
  - 空狀態、錯誤、離線、reduced motion。
  - Header 在 375 不擠爆；focus trap、Esc、safe-area。
- 麻雀三頁 regression：番數、埋數、小氣簿載入正常；現有 tests 全綠。
- Screenshots 存 `docs/evidence/bet/`（gitignored）。

### 11.5 指令

```
pnpm typecheck
pnpm lint
pnpm test
pnpm typecheck:web
pnpm test:web
pnpm build:web
```

Integration tests 使用 `TEST_DATABASE_URL`（名稱需以 `_test` 結尾）。

## 12. 文件與維運

- `README.md`：
  - Repository layout 加 `frontend/src/bet/`、`BET-DESIGN.md`。
  - API contract 加 bets endpoints。
  - Phase B frontend 加賭球 workflow、route `#bet`、switch button。
  - 測試加賭球項目。
- `docs/api.http` 加 bets endpoints 的 REST Client examples。
- `frontend/BET-DESIGN.md`：完整賭球 token 表、元件、動效、a11y、響應式；與 `DESIGN.md` 各自獨立。
- `migrations/003_bets.sql` 啟動自動套用；備份／restore 自動包含新表。
- 不改 Firebase import、不改 manifest、不新增依賴、不改現有 API。

## 13. Out of scope

- 分人／共用錢包（日後加 nullable bettor）。
- 逐場結算過關、現金回贈、Free Bet、現金兌換、貨幣換算。
- 聯賽、投注渠道、開賽時間、備註欄位。
- 圖表 library、舊投注資料匯入、離線寫入隊列、推送通知。
- PWA manifest shortcut、獨立 subdomain、獨立登入。
- 賭球輸贏寫入小氣簿或麻雀排行。

## 14. 完成標準

1. 麻雀 header 一按即入賭球；賭球視覺、header、導航、元件與麻雀完全分離；一按返回。
2. 可新增單場與過關、後補結果、編輯、刪除；reload／換裝置資料仍在；輸贏與統計正確。
3. 統計頁符合第 6 節定義。
4. 麻雀現有流程、tests、build 全部不退化。
5. 375／430、鍵盤 focus、reduced motion、safe-area 全部通過。
6. `pnpm typecheck && pnpm lint && pnpm test && pnpm typecheck:web && pnpm test:web && pnpm build:web` 全綠。
