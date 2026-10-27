# 賭球投注記錄頁 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully separate football-betting ledger to Tally: server-backed bet slips (single and 2–8 leg parlays), pending/settlement states, profit calculation, and a stadium-night betting UI reachable from a header switch.

**Architecture:** New `bets` + `bet_legs` tables and `/api/bets` routes; a standalone `frontend/src/bet/` module with its own API, types, components, pages, icons, CSS, header, and bottom nav. Mahjong and betting share only auth, the generic HTTP/date/online helpers, and the same web app shell. `#bet` renders the betting shell; `#fan/#mai/#ledger` render the existing mahjong shell.

**Tech Stack:** Node 22, Express 5, raw `pg`, Zod 4, TypeScript 5.9, React 19, Vite 8, Vitest. No new dependencies.

## Global Constraints

- **Do not run `git commit` unless the user explicitly approves implementation commits.** The design spec commit is separate; this plan uses verification checkpoints instead of automatic commits. Suggested commit messages are listed for later use only.
- No new npm dependencies. No external fonts, CDNs, or chart libraries.
- No `as any`, `@ts-ignore`, or `@ts-expect-error`. Strict TypeScript is on.
- All SQL is parameterized. Bet text is rendered as React text, never HTML.
- Money is 2 decimal places (HK cents). `round2` is half away from zero and normalizes `-0` to `0`.
- All dates/times use `Asia/Hong_Kong`; `bet_date` is a `date`.
- Betting UI must not use mahjong components, mahjong CSS classes, `GameProvider`, or `ToastProvider`. It may use generic `lib/http.ts`, `lib/date.ts`, `useOnlineStatus.ts`, and auth.
- The only mahjong UI change is the header switch button. Keep the existing three mahjong workflows intact.
- Mobile target: 375px and 430px; max width 480px; 44px touch targets; 16px inputs; safe-area top/bottom; `100dvh`.
- Every task ends with the listed verification. If integration tests need PostgreSQL, set `TEST_DATABASE_URL` to a database whose name ends with `_test`.
- Source of truth: `docs/superpowers/specs/2026-10-26-betting-recording-design.md`.

## File Map

**Backend**

- Create `migrations/003_bets.sql`
- Create `src/bets/types.ts`
- Create `src/bets/profit.ts`
- Create `src/bets/cursor.ts`
- Create `src/bets/read.ts`
- Create `src/bets/write.ts`
- Create `src/bets/stats.ts`
- Create `src/routes/bets.ts`
- Modify `src/schemas.ts`
- Modify `src/app.ts`
- Modify `tests/helpers/app.ts`
- Create `tests/helpers/bets.ts`
- Create `tests/unit/bets-profit.test.ts`
- Create `tests/unit/bets-schemas.test.ts`
- Create `tests/integration/bets-crud.test.ts`
- Create `tests/integration/bets-stats.test.ts`

**Frontend**

- Create `frontend/src/lib/http.ts`
- Modify `frontend/src/lib/api.ts`
- Modify `frontend/src/hooks/useHashRoute.ts`
- Modify `frontend/src/App.tsx`
- Modify `frontend/src/components/AppHeader.tsx`
- Modify `frontend/src/components/Icons.tsx` (add `FootballIcon`)
- Create `frontend/BET-DESIGN.md`
- Create `frontend/src/bet/BetApp.tsx`
- Create `frontend/src/bet/api.ts`
- Create `frontend/src/bet/types.ts`
- Create `frontend/src/bet/lib/profit.ts`
- Create `frontend/src/bet/lib/format.ts`
- Create `frontend/src/bet/lib/form.ts`
- Create `frontend/src/bet/components/BetIcons.tsx`
- Create `frontend/src/bet/components/BetSheet.tsx`
- Create `frontend/src/bet/components/BetHeader.tsx`
- Create `frontend/src/bet/components/BetNav.tsx`
- Create `frontend/src/bet/components/BetSummary.tsx`
- Create `frontend/src/bet/components/BetCard.tsx`
- Create `frontend/src/bet/components/BetForm.tsx`
- Create `frontend/src/bet/components/BetConfirmDialog.tsx`
- Create `frontend/src/bet/components/BetToast.tsx`
- Create `frontend/src/bet/pages/SlipPage.tsx`
- Create `frontend/src/bet/pages/StatsPage.tsx`
- Create `frontend/src/bet/bet.css`
- Create `frontend/tests/bet-profit.test.ts`
- Create `frontend/tests/bet-format.test.ts`
- Create `frontend/tests/bet-form.test.ts`
- Modify `README.md`
- Modify `docs/api.http`

---

## Task 1: Backend Schema, Profit Math, and Validation

**Files:**
- Create: `migrations/003_bets.sql`
- Create: `src/bets/types.ts`
- Create: `src/bets/profit.ts`
- Modify: `src/schemas.ts`
- Test: `tests/unit/bets-profit.test.ts`
- Test: `tests/unit/bets-schemas.test.ts`

**Interfaces:**
- Produces `BetResult`, `BetMarket`, `BetLegInput`, `BetLeg`, `BetItem`, `BetRow`, `BetLegRow`, `BetStatusFilter`, `BetPeriod`, `BetOverview`, `BetStats` types from `src/bets/types.ts`.
- Produces `round2(value)`, `computeTotalOdds(legs)`, `computeProfit(stake, totalOdds, result)` and constants `MIN_ODDS`, `MAX_ODDS`, `MIN_STAKE`, `MAX_STAKE`, `MAX_TOTAL_ODDS` from `src/bets/profit.ts`.
- Produces `createBetSchema`, `patchBetSchema`, `listBetsQuerySchema`, `betStatsQuerySchema`, `betIdSchema`, `CreateBetInput`, `PatchBetInput` from `src/schemas.ts`.

- [ ] **Step 1: Write the failing profit tests**

Create `tests/unit/bets-profit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeProfit, computeTotalOdds, round2 } from '../../src/bets/profit.js';

describe('round2', () => {
  it('rounds half away from zero and normalizes -0', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(1.004)).toBe(1);
    expect(Object.is(round2(-0.001), -0)).toBe(false);
    expect(round2(-0.001)).toBe(0);
  });
});

describe('computeTotalOdds', () => {
  it('rounds a single leg to 2dp', () => {
    expect(computeTotalOdds([{ odds: 1.95 }])).toBe(1.95);
    expect(computeTotalOdds([{ odds: 1.955 }])).toBe(1.96);
  });

  it('multiplies legs and rounds once', () => {
    expect(computeTotalOdds([{ odds: 1.95 }, { odds: 1.95 }])).toBe(3.8);
    expect(computeTotalOdds([{ odds: 1.95 }, { odds: 1.95 }, { odds: 1.95 }])).toBe(7.41);
  });

  it('handles eight legs', () => {
    expect(computeTotalOdds(Array.from({ length: 8 }, () => ({ odds: 2 })))).toBe(256);
  });
});

describe('computeProfit', () => {
  it('returns null for pending', () => {
    expect(computeProfit(500, 1.95, 'pending')).toBeNull();
  });

  it('pays win and half win', () => {
    expect(computeProfit(500, 1.95, 'win')).toBe(475);
    expect(computeProfit(500, 1.95, 'half_win')).toBe(237.5);
  });

  it('returns zero for push', () => {
    expect(computeProfit(500, 1.95, 'push')).toBe(0);
  });

  it('charges half loss and loss', () => {
    expect(computeProfit(500, 1.95, 'half_loss')).toBe(-250);
    expect(computeProfit(500, 1.95, 'loss')).toBe(-500);
  });

  it('rounds money to 2dp half away from zero', () => {
    expect(computeProfit(0.01, 1.95, 'half_loss')).toBe(-0.01);
    expect(computeProfit(100, 1.955, 'win')).toBe(96);
  });
});
```

- [ ] **Step 2: Run the profit tests to verify they fail**

Run: `pnpm exec vitest run tests/unit/bets-profit.test.ts`
Expected: FAIL because `src/bets/profit.ts` does not exist.

- [ ] **Step 3: Create the types and profit module**

Create `src/bets/types.ts`:

```ts
export type BetResult = 'pending' | 'win' | 'half_win' | 'push' | 'half_loss' | 'loss';
export type BetMarket = '1x2' | 'handicap' | 'totals' | 'other';
export type BetStatusFilter = 'all' | 'pending' | 'settled';
export type BetPeriod = 'month' | 'year' | 'all';

export interface BetLegInput {
  readonly match: string;
  readonly market: BetMarket;
  readonly selection: string;
  readonly odds: number;
}

export interface BetLeg extends BetLegInput {
  readonly position: number;
}

export interface BetItem {
  readonly id: string;
  readonly date: string;
  readonly recordedAt: string;
  readonly stake: number;
  readonly result: BetResult;
  readonly legs: BetLeg[];
  readonly totalOdds: number;
  readonly profit: number | null;
}

export interface BetRow {
  readonly id: string;
  readonly bet_date: string;
  readonly stake: string;
  readonly total_odds: string;
  readonly result: BetResult;
  readonly profit: string | null;
  readonly created_at: Date;
}

export interface BetLegRow {
  readonly bet_id: string;
  readonly position: number;
  readonly match: string;
  readonly market: BetMarket;
  readonly selection: string;
  readonly odds: string;
}

export interface BetOverviewDay {
  readonly profit: number;
  readonly settledStake: number;
  readonly settledBets: number;
  readonly pendingBets: number;
}

export interface BetOverview {
  readonly today: BetOverviewDay;
  readonly month: BetOverviewDay;
  readonly pending: { readonly count: number; readonly stake: number };
}

export interface BetTotals {
  readonly settledStake: number;
  readonly profit: number;
  readonly roi: number | null;
  readonly settledBets: number;
  readonly wins: number;
  readonly winRate: number | null;
  readonly avgOdds: number | null;
  readonly pendingCount: number;
  readonly pendingStake: number;
}

export interface BetTypeStats {
  readonly type: 'single' | 'parlay';
  readonly bets: number;
  readonly stake: number;
  readonly profit: number;
  readonly roi: number | null;
}

export interface BetMarketStats {
  readonly market: BetMarket;
  readonly bets: number;
  readonly stake: number;
  readonly profit: number;
  readonly roi: number | null;
}

export interface BetMonthlyPoint {
  readonly month: string;
  readonly profit: number;
}

export interface BetBiggest {
  readonly betId: string;
  readonly profit: number;
  readonly date: string;
  readonly label: string;
}

export interface BetStats {
  readonly period: BetPeriod;
  readonly totals: BetTotals;
  readonly byType: BetTypeStats[];
  readonly byMarket: BetMarketStats[];
  readonly monthly: BetMonthlyPoint[];
  readonly biggestWin: BetBiggest | null;
  readonly biggestLoss: BetBiggest | null;
}
```

Create `src/bets/profit.ts`:

```ts
import type { BetLegInput, BetResult } from './types.js';

export const MIN_ODDS = 1.01;
export const MAX_ODDS = 1000;
export const MIN_STAKE = 0.01;
export const MAX_STAKE = 9_999_999.99;
export const MAX_TOTAL_ODDS = 99_999.99;

export function round2(value: number): number {
  const rounded = Math.sign(value) * (Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100);
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function computeTotalOdds(legs: readonly Pick<BetLegInput, 'odds'>[]): number {
  let product = 1;
  for (const leg of legs) {
    product *= round2(leg.odds);
  }
  return round2(product);
}

export function computeProfit(
  stake: number,
  totalOdds: number,
  result: BetResult,
): number | null {
  const s = round2(stake);
  const o = round2(totalOdds);
  switch (result) {
    case 'pending':
      return null;
    case 'win':
      return round2(s * (o - 1));
    case 'half_win':
      return round2((s * (o - 1)) / 2);
    case 'push':
      return 0;
    case 'half_loss':
      return round2(-s / 2);
    case 'loss':
      return round2(-s);
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}
```

- [ ] **Step 4: Create the migration**

Create `migrations/003_bets.sql`:

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

- [ ] **Step 5: Add the bet schemas**

In `src/schemas.ts`, add this import at the top:

```ts
import {
  computeTotalOdds,
  MAX_ODDS,
  MAX_STAKE,
  MAX_TOTAL_ODDS,
  MIN_ODDS,
  MIN_STAKE,
  round2,
} from './bets/profit.js';
```

Add this code after `recordIdSchema`:

```ts
function betTextSchema(max: number, message: string) {
  return z
    .string()
    .trim()
    .refine((value) => codePointLength(value) >= 1 && codePointLength(value) <= max, {
      message,
    })
    .refine((value) => !hasControlChar(value), { message: '不可包含控制字元' });
}

export const betMarketSchema = z.enum(['1x2', 'handicap', 'totals', 'other']);
export const betResultSchema = z.enum([
  'pending',
  'win',
  'half_win',
  'push',
  'half_loss',
  'loss',
]);

const betOddsSchema = z
  .number()
  .refine(Number.isFinite, { message: '賠率必須是有限數字' })
  .refine((value) => value >= MIN_ODDS && value <= MAX_ODDS, {
    message: `賠率必須介乎 ${MIN_ODDS} 與 ${MAX_ODDS}`,
  })
  .transform(round2);

const betStakeSchema = z
  .number()
  .refine(Number.isFinite, { message: '注碼必須是有限數字' })
  .refine((value) => value >= MIN_STAKE && value <= MAX_STAKE, {
    message: `注碼必須介乎 ${MIN_STAKE} 與 ${MAX_STAKE}`,
  })
  .transform(round2);

export const betLegSchema = z.object({
  match: betTextSchema(80, '賽事必須為 1–80 個字元'),
  market: betMarketSchema,
  selection: betTextSchema(60, '選擇必須為 1–60 個字元'),
  odds: betOddsSchema,
});

function totalOddsIssue(
  legs: readonly { readonly odds: number }[],
): { readonly message: string } | null {
  if (computeTotalOdds(legs) > MAX_TOTAL_ODDS) {
    return { message: `總賠率不可超過 ${MAX_TOTAL_ODDS}` };
  }
  return null;
}

export const createBetSchema = z
  .object({
    date: dateSchema.optional(),
    stake: betStakeSchema,
    result: betResultSchema.default('pending'),
    legs: z.array(betLegSchema).min(1).max(8),
  })
  .superRefine((value, ctx) => {
    const issue = totalOddsIssue(value.legs);
    if (issue !== null) {
      ctx.addIssue({ code: 'custom', path: ['legs'], message: issue.message });
    }
  });

export const patchBetSchema = z
  .object({
    date: dateSchema.optional(),
    stake: betStakeSchema.optional(),
    result: betResultSchema.optional(),
    legs: z.array(betLegSchema).min(1).max(8).optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.date === undefined &&
      value.stake === undefined &&
      value.result === undefined &&
      value.legs === undefined
    ) {
      ctx.addIssue({ code: 'custom', message: '至少需要提供一個欄位' });
    }
    if (value.legs !== undefined) {
      const issue = totalOddsIssue(value.legs);
      if (issue !== null) {
        ctx.addIssue({ code: 'custom', path: ['legs'], message: issue.message });
      }
    }
  });

export const listBetsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
  status: z.enum(['all', 'pending', 'settled']).default('all'),
});

export const betStatsQuerySchema = z.object({
  period: z.enum(['month', 'year', 'all']).default('month'),
});

export const betIdSchema = z.uuid();

export type CreateBetInput = z.infer<typeof createBetSchema>;
export type PatchBetInput = z.infer<typeof patchBetSchema>;
```

- [ ] **Step 6: Write the failing schema tests**

Create `tests/unit/bets-schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createBetSchema, patchBetSchema } from '../../src/schemas.js';

const validLeg = {
  match: '曼聯 vs 車路士',
  market: 'handicap' as const,
  selection: '曼聯 -0.5',
  odds: 1.95,
};

describe('createBetSchema', () => {
  it('accepts a single bet and applies defaults', () => {
    const parsed = createBetSchema.safeParse({ stake: 500, legs: [validLeg] });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.result).toBe('pending');
    expect(parsed.data.stake).toBe(500);
    expect(parsed.data.legs[0]?.odds).toBe(1.95);
  });

  it('rounds stake and odds to 2dp', () => {
    const parsed = createBetSchema.safeParse({
      stake: 12.345,
      legs: [{ ...validLeg, odds: 1.955 }],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.stake).toBe(12.35);
    expect(parsed.data.legs[0]?.odds).toBe(1.96);
  });

  it('rejects legs outside 1-8', () => {
    expect(createBetSchema.safeParse({ stake: 10, legs: [] }).success).toBe(false);
    expect(
      createBetSchema.safeParse({
        stake: 10,
        legs: Array.from({ length: 9 }, () => validLeg),
      }).success,
    ).toBe(false);
  });

  it('rejects invalid odds, stake, market, result, date, and text lengths', () => {
    expect(createBetSchema.safeParse({ stake: 10, legs: [{ ...validLeg, odds: 1 }] }).success).toBe(
      false,
    );
    expect(
      createBetSchema.safeParse({ stake: 10, legs: [{ ...validLeg, odds: 1000.01 }] }).success,
    ).toBe(false);
    expect(createBetSchema.safeParse({ stake: 0, legs: [validLeg] }).success).toBe(false);
    expect(createBetSchema.safeParse({ stake: 10_000_000, legs: [validLeg] }).success).toBe(false);
    expect(
      createBetSchema.safeParse({ stake: 10, legs: [{ ...validLeg, market: 'bogus' }] }).success,
    ).toBe(false);
    expect(
      createBetSchema.safeParse({ stake: 10, result: 'bogus', legs: [validLeg] }).success,
    ).toBe(false);
    expect(
      createBetSchema.safeParse({ date: '2026-02-30', stake: 10, legs: [validLeg] }).success,
    ).toBe(false);
    expect(
      createBetSchema.safeParse({
        stake: 10,
        legs: [{ ...validLeg, match: 'x'.repeat(81) }],
      }).success,
    ).toBe(false);
    expect(
      createBetSchema.safeParse({
        stake: 10,
        legs: [{ ...validLeg, selection: 'x'.repeat(61) }],
      }).success,
    ).toBe(false);
    expect(
      createBetSchema.safeParse({
        stake: 10,
        legs: [{ ...validLeg, match: 'a\u0000b' }],
      }).success,
    ).toBe(false);
  });

  it('rejects total odds above the cap', () => {
    expect(
      createBetSchema.safeParse({
        stake: 10,
        legs: [
          { ...validLeg, odds: 300 },
          { ...validLeg, odds: 400 },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('patchBetSchema', () => {
  it('accepts a partial update', () => {
    expect(patchBetSchema.safeParse({ result: 'win' }).success).toBe(true);
    expect(patchBetSchema.safeParse({ legs: [validLeg] }).success).toBe(true);
  });

  it('rejects an empty patch', () => {
    expect(patchBetSchema.safeParse({}).success).toBe(false);
  });

  it('rejects total odds above the cap when legs are replaced', () => {
    expect(
      patchBetSchema.safeParse({
        legs: [
          { ...validLeg, odds: 300 },
          { ...validLeg, odds: 400 },
        ],
      }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 7: Run the unit tests**

Run:

```bash
pnpm exec vitest run tests/unit/bets-profit.test.ts tests/unit/bets-schemas.test.ts
pnpm typecheck
pnpm lint
```

Expected: all pass/clean.

**Checkpoint:** Do not commit. Suggested later commit: `feat(bets): add schema and profit calculation`.

---

## Task 2: Backend Cursor, Read/Write, CRUD Routes

**Files:**
- Create: `src/bets/cursor.ts`
- Create: `src/bets/read.ts`
- Create: `src/bets/write.ts`
- Create: `src/routes/bets.ts`
- Modify: `src/app.ts`
- Modify: `tests/helpers/app.ts`
- Create: `tests/helpers/bets.ts`
- Test: `tests/integration/bets-crud.test.ts`

**Interfaces:**
- Produces `encodeBetCursor(cursor)`, `decodeBetCursor(value)`, `BetCursor`.
- Produces `listBets(db, limit, cursor, status)`, `getBet(db, id)`, `loadBetLegs(db, id)`.
- Produces `createBet(db, data)`, `updateBet(db, id, data)`, `deleteBet(db, id)`.
- Produces `createBetsRouter(db)` mounted at `/api/bets`.

- [ ] **Step 1: Create the cursor module**

Create `src/bets/cursor.ts`:

```ts
import { z } from 'zod';
import { isValidDateString } from '../time.js';

const cursorSchema = z.object({
  betDate: z.string().refine(isValidDateString),
  createdAt: z.iso.datetime(),
  id: z.uuid(),
});

export type BetCursor = z.infer<typeof cursorSchema>;

export function encodeBetCursor(cursor: BetCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeBetCursor(value: string): BetCursor | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const result = cursorSchema.safeParse(parsed);
  return result.success ? result.data : null;
}
```

- [ ] **Step 2: Create the read module**

Create `src/bets/read.ts`:

```ts
import type { Pool, PoolClient } from 'pg';
import { encodeBetCursor, type BetCursor } from './cursor.js';
import type { BetItem, BetLegRow, BetRow, BetStatusFilter } from './types.js';

type Queryable = Pool | PoolClient;

const BET_COLUMNS = `b.id,
       to_char(b.bet_date, 'YYYY-MM-DD') as bet_date,
       b.stake::text as stake,
       b.total_odds::text as total_odds,
       b.result,
       b.profit::text as profit,
       b.created_at`;

function mapLeg(row: BetLegRow): BetItem['legs'][number] {
  return {
    position: row.position,
    match: row.match,
    market: row.market,
    selection: row.selection,
    odds: Number(row.odds),
  };
}

function mapBet(row: BetRow, legs: BetLegRow[]): BetItem {
  return {
    id: row.id,
    date: row.bet_date,
    recordedAt: row.created_at.toISOString(),
    stake: Number(row.stake),
    result: row.result,
    legs: legs.map(mapLeg),
    totalOdds: Number(row.total_odds),
    profit: row.profit === null ? null : Number(row.profit),
  };
}

async function loadLegsForBets(
  db: Queryable,
  betIds: readonly string[],
): Promise<Map<string, BetLegRow[]>> {
  if (betIds.length === 0) {
    return new Map();
  }
  const result = await db.query<BetLegRow>(
    `select bet_id, position, match, market, selection, odds::text
       from bet_legs
      where bet_id = any($1::uuid[])
      order by bet_id asc, position asc`,
    [betIds],
  );
  const byBet = new Map<string, BetLegRow[]>();
  for (const row of result.rows) {
    const list = byBet.get(row.bet_id) ?? [];
    list.push(row);
    byBet.set(row.bet_id, list);
  }
  return byBet;
}

export async function loadBetLegs(db: Queryable, betId: string): Promise<BetLegRow[]> {
  const byBet = await loadLegsForBets(db, [betId]);
  return byBet.get(betId) ?? [];
}

export async function getBet(db: Queryable, id: string): Promise<BetItem | null> {
  const result = await db.query<BetRow>(
    `select ${BET_COLUMNS} from bets b where b.id = $1`,
    [id],
  );
  const row = result.rows[0];
  if (row === undefined) {
    return null;
  }
  return mapBet(row, await loadBetLegs(db, row.id));
}

export interface ListBetsResult {
  readonly items: BetItem[];
  readonly nextCursor: string | null;
}

export async function listBets(
  db: Queryable,
  limit: number,
  cursor: BetCursor | null,
  status: BetStatusFilter,
): Promise<ListBetsResult> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (status === 'pending') {
    conditions.push(`b.result = 'pending'`);
  }
  if (status === 'settled') {
    conditions.push(`b.result <> 'pending'`);
  }
  if (cursor !== null) {
    params.push(cursor.betDate, cursor.createdAt, cursor.id);
    conditions.push(
      `(b.bet_date, b.created_at, b.id) < ($1::date, $2::timestamptz, $3::uuid)`,
    );
  }

  params.push(limit + 1);
  const where = conditions.length === 0 ? '' : `where ${conditions.join(' and ')}`;
  const result = await db.query<BetRow>(
    `select ${BET_COLUMNS}
       from bets b
       ${where}
      order by b.bet_date desc, b.created_at desc, b.id desc
      limit $${params.length}`,
    params,
  );

  const hasMore = result.rows.length > limit;
  const pageRows = hasMore ? result.rows.slice(0, limit) : result.rows;
  const legsByBet = await loadLegsForBets(
    db,
    pageRows.map((row) => row.id),
  );
  const items = pageRows.map((row) => mapBet(row, legsByBet.get(row.id) ?? []));
  const last = items.at(-1);
  const nextCursor =
    hasMore && last !== undefined
      ? encodeBetCursor({ betDate: last.date, createdAt: last.recordedAt, id: last.id })
      : null;

  return { items, nextCursor };
}
```

- [ ] **Step 3: Create the write module**

Create `src/bets/write.ts`:

```ts
import type { PoolClient } from 'pg';
import type { Db } from '../db.js';
import { computeProfit, computeTotalOdds, round2 } from './profit.js';
import { getBet, loadBetLegs } from './read.js';
import type { BetItem, BetLegInput, BetResult } from './types.js';

export interface CreateBetData {
  readonly date: string;
  readonly stake: number;
  readonly result: BetResult;
  readonly legs: readonly BetLegInput[];
}

export interface UpdateBetData {
  readonly date?: string;
  readonly stake?: number;
  readonly result?: BetResult;
  readonly legs?: readonly BetLegInput[];
}

async function insertLegs(
  client: PoolClient,
  betId: string,
  legs: readonly BetLegInput[],
): Promise<void> {
  for (const [index, leg] of legs.entries()) {
    await client.query(
      `insert into bet_legs (bet_id, position, match, market, selection, odds)
       values ($1, $2, $3, $4, $5, $6)`,
      [betId, index + 1, leg.match, leg.market, leg.selection, round2(leg.odds)],
    );
  }
}

export async function createBet(db: Db, data: CreateBetData): Promise<BetItem> {
  return db.withTransaction(async (client) => {
    const totalOdds = computeTotalOdds(data.legs);
    const profit = computeProfit(data.stake, totalOdds, data.result);
    const inserted = await client.query<{ id: string }>(
      `insert into bets (bet_date, stake, total_odds, result, profit)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [data.date, round2(data.stake), totalOdds, data.result, profit],
    );
    const id = inserted.rows[0]?.id;
    if (id === undefined) {
      throw new Error('Bet insert returned no row');
    }
    await insertLegs(client, id, data.legs);
    const item = await getBet(client, id);
    if (item === null) {
      throw new Error('Created bet could not be read back');
    }
    return item;
  });
}

export async function updateBet(
  db: Db,
  id: string,
  data: UpdateBetData,
): Promise<BetItem | null> {
  return db.withTransaction(async (client) => {
    const current = await client.query<{
      bet_date: string;
      stake: string;
      result: BetResult;
    }>(
      `select to_char(bet_date, 'YYYY-MM-DD') as bet_date, stake::text, result
         from bets
        where id = $1
        for update`,
      [id],
    );
    const row = current.rows[0];
    if (row === undefined) {
      return null;
    }

    const legs =
      data.legs ??
      (await loadBetLegs(client, id)).map((leg) => ({
        match: leg.match,
        market: leg.market,
        selection: leg.selection,
        odds: Number(leg.odds),
      }));
    const stake = data.stake ?? Number(row.stake);
    const result = data.result ?? row.result;
    const totalOdds = computeTotalOdds(legs);
    const profit = computeProfit(stake, totalOdds, result);

    await client.query(
      `update bets
          set bet_date = $2,
              stake = $3,
              total_odds = $4,
              result = $5,
              profit = $6,
              updated_at = now()
        where id = $1`,
      [id, data.date ?? row.bet_date, round2(stake), totalOdds, result, profit],
    );

    if (data.legs !== undefined) {
      await client.query('delete from bet_legs where bet_id = $1', [id]);
      await insertLegs(client, id, data.legs);
    }

    const item = await getBet(client, id);
    if (item === null) {
      throw new Error('Updated bet could not be read back');
    }
    return item;
  });
}

export async function deleteBet(db: Db, id: string): Promise<boolean> {
  const result = await db.pool.query('delete from bets where id = $1 returning id', [id]);
  return result.rowCount === 1;
}
```

- [ ] **Step 4: Create the CRUD router**

Create `src/routes/bets.ts`:

```ts
import { Router } from 'express';
import { decodeBetCursor } from '../bets/cursor.js';
import { listBets } from '../bets/read.js';
import { createBet, deleteBet, updateBet } from '../bets/write.js';
import type { Db } from '../db.js';
import { AppError } from '../errors.js';
import {
  betIdSchema,
  createBetSchema,
  firstIssueMessage,
  listBetsQuerySchema,
  patchBetSchema,
} from '../schemas.js';
import { hkToday } from '../time.js';

export function createBetsRouter(db: Db): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const parsed = listBetsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const cursor =
      parsed.data.cursor === undefined ? null : decodeBetCursor(parsed.data.cursor);
    if (parsed.data.cursor !== undefined && cursor === null) {
      throw new AppError('VALIDATION', '分頁游標無效');
    }

    res.json(
      await listBets(db.pool, parsed.data.limit, cursor, parsed.data.status),
    );
  });

  router.post('/', async (req, res) => {
    const parsed = createBetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const item = await createBet(db, {
      date: parsed.data.date ?? hkToday(),
      stake: parsed.data.stake,
      result: parsed.data.result,
      legs: parsed.data.legs,
    });
    res.status(201).json(item);
  });

  router.patch('/:id', async (req, res) => {
    const id = betIdSchema.safeParse(req.params.id);
    if (!id.success) {
      throw new AppError('VALIDATION', '注單 ID 無效');
    }
    const parsed = patchBetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const item = await updateBet(db, id.data, parsed.data);
    if (item === null) {
      throw new AppError('NOT_FOUND');
    }
    res.json(item);
  });

  router.delete('/:id', async (req, res) => {
    const id = betIdSchema.safeParse(req.params.id);
    if (!id.success) {
      throw new AppError('VALIDATION', '注單 ID 無效');
    }

    const deleted = await deleteBet(db, id.data);
    if (!deleted) {
      throw new AppError('NOT_FOUND');
    }
    res.status(204).end();
  });

  return router;
}
```

- [ ] **Step 5: Mount the router and update the test reset**

In `src/app.ts`, add:

```ts
import { createBetsRouter } from './routes/bets.js';
```

and after the records mount:

```ts
  app.use('/api/bets', auth, createBetsRouter(deps.db));
```

In `tests/helpers/app.ts`, replace the truncate statement with:

```ts
  await db.pool.query(
    'truncate table bet_legs, bets, settlements, games, players restart identity cascade',
  );
```

- [ ] **Step 6: Create the bet test helpers**

Create `tests/helpers/bets.ts`:

```ts
import type { Express } from 'express';
import request from 'supertest';
import type { BetItem } from '../../src/bets/types.js';
import { hkToday } from '../../src/time.js';

export function singleLeg(
  overrides: Partial<{
    match: string;
    market: '1x2' | 'handicap' | 'totals' | 'other';
    selection: string;
    odds: number;
  }> = {},
): { match: string; market: string; selection: string; odds: number } {
  return {
    match: '曼聯 vs 車路士',
    market: 'handicap',
    selection: '曼聯 -0.5',
    odds: 1.95,
    ...overrides,
  };
}

export async function createBet(
  app: Express,
  cookie: string,
  payload: Record<string, unknown>,
): Promise<BetItem> {
  const response = await request(app).post('/api/bets').set('Cookie', cookie).send(payload);
  if (response.status !== 201) {
    throw new Error(`create bet failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body as BetItem;
}

export function monthDate(monthsAgo: number, day = 10): string {
  const [yearText, monthText] = hkToday().split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const date = new Date(Date.UTC(year, month - 1 - monthsAgo, day));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function currentMonthOtherDay(): string {
  return hkToday().endsWith('-01') ? monthDate(0, 2) : monthDate(0, 1);
}
```

- [ ] **Step 7: Write the failing CRUD integration tests**

Create `tests/integration/bets-crud.test.ts`:

```ts
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { hkToday } from '../../src/time.js';
import { closeTestDb, createTestApp, getTestDb, resetDb } from '../helpers/app.js';
import { createBet, singleLeg } from '../helpers/bets.js';
import { login } from '../helpers/records.js';

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeTestDb();
});

describe('bets CRUD', () => {
  it('requires auth for every endpoint', async () => {
    const { app } = await createTestApp();
    const getList = await request(app).get('/api/bets');
    const postBet = await request(app).post('/api/bets').send({});
    const getOverview = await request(app).get('/api/bets/overview');
    const getStats = await request(app).get('/api/bets/stats');
    const patchBet = await request(app)
      .patch('/api/bets/00000000-0000-4000-8000-000000000000')
      .send({ result: 'win' });
    const deleteBetResponse = await request(app).delete(
      '/api/bets/00000000-0000-4000-8000-000000000000',
    );

    for (const response of [
      getList,
      postBet,
      getOverview,
      getStats,
      patchBet,
      deleteBetResponse,
    ]) {
      expect(response.status).toBe(401);
    }
  });

  it('creates a single pending bet and reads it back', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);

    const created = await request(app)
      .post('/api/bets')
      .set('Cookie', cookie)
      .send({ date: '2026-10-26', stake: 500, legs: [singleLeg()] });

    expect(created.status).toBe(201);
    expect(created.body.date).toBe('2026-10-26');
    expect(created.body.recordedAt).toMatch(/Z$/);
    expect(created.body.stake).toBe(500);
    expect(created.body.result).toBe('pending');
    expect(created.body.totalOdds).toBe(1.95);
    expect(created.body.profit).toBeNull();
    expect(created.body.legs).toEqual([
      {
        position: 1,
        match: '曼聯 vs 車路士',
        market: 'handicap',
        selection: '曼聯 -0.5',
        odds: 1.95,
      },
    ]);
  });

  it('creates a parlay and multiplies leg odds', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);

    const created = await request(app)
      .post('/api/bets')
      .set('Cookie', cookie)
      .send({
        date: '2026-10-26',
        stake: 200,
        legs: [
          singleLeg({ odds: 1.95 }),
          singleLeg({ match: '阿仙奴 vs 利物浦', market: 'totals', selection: '大 2.5', odds: 1.9 }),
          singleLeg({ match: '皇馬 vs 巴塞', market: '1x2', selection: '主', odds: 2.1 }),
        ],
      });

    expect(created.status).toBe(201);
    expect(created.body.totalOdds).toBe(7.78);
    expect(created.body.legs.map((leg: { position: number }) => leg.position)).toEqual([1, 2, 3]);
  });

  it('stores settled profit and enforces the pending null rule', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);

    const created = await request(app)
      .post('/api/bets')
      .set('Cookie', cookie)
      .send({
        date: '2026-10-26',
        stake: 500,
        result: 'win',
        legs: [singleLeg({ odds: 1.95 })],
      });

    expect(created.status).toBe(201);
    expect(created.body.profit).toBe(475);

    const db = await getTestDb();
    const row = await db.pool.query<{ total_odds: string; profit: string | null }>(
      'select total_odds::text, profit::text from bets where id = $1',
      [created.body.id],
    );
    expect(row.rows[0]).toEqual({ total_odds: '1.95', profit: '475.00' });
  });

  it('lists newest first with keyset pagination and status filter', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);

    await createBet(app, cookie, { date: '2026-01-01', stake: 10, legs: [singleLeg()] });
    await createBet(app, cookie, { date: '2026-01-02', stake: 10, legs: [singleLeg()] });
    await createBet(app, cookie, {
      date: '2026-01-03',
      stake: 10,
      result: 'win',
      legs: [singleLeg({ odds: 2 })],
    });

    const first = await request(app).get('/api/bets?limit=2').set('Cookie', cookie);
    expect(first.status).toBe(200);
    expect(first.body.items.map((item: { date: string }) => item.date)).toEqual([
      '2026-01-03',
      '2026-01-02',
    ]);
    expect(typeof first.body.nextCursor).toBe('string');

    const second = await request(app)
      .get(`/api/bets?limit=2&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .set('Cookie', cookie);
    expect(second.status).toBe(200);
    expect(second.body.items.map((item: { date: string }) => item.date)).toEqual(['2026-01-01']);
    expect(second.body.nextCursor).toBeNull();

    const settled = await request(app).get('/api/bets?status=settled').set('Cookie', cookie);
    expect(settled.body.items).toHaveLength(1);
    expect(settled.body.items[0].result).toBe('win');

    const pending = await request(app).get('/api/bets?status=pending').set('Cookie', cookie);
    expect(pending.body.items).toHaveLength(2);

    const invalidCursor = await request(app)
      .get('/api/bets?cursor=not-a-cursor')
      .set('Cookie', cookie);
    expect(invalidCursor.status).toBe(400);
    expect(invalidCursor.body.error.code).toBe('VALIDATION');
  });

  it('patches fields, replaces legs, and recomputes profit', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const bet = await createBet(app, cookie, {
      date: '2026-10-26',
      stake: 500,
      legs: [singleLeg()],
    });

    const settled = await request(app)
      .patch(`/api/bets/${bet.id}`)
      .set('Cookie', cookie)
      .send({ result: 'win' });
    expect(settled.status).toBe(200);
    expect(settled.body.profit).toBe(475);

    const replaced = await request(app)
      .patch(`/api/bets/${bet.id}`)
      .set('Cookie', cookie)
      .send({
        date: '2026-10-27',
        stake: 100,
        legs: [singleLeg({ match: '新賽事', odds: 2 })],
      });
    expect(replaced.status).toBe(200);
    expect(replaced.body.date).toBe('2026-10-27');
    expect(replaced.body.stake).toBe(100);
    expect(replaced.body.totalOdds).toBe(2);
    expect(replaced.body.profit).toBe(100);
    expect(replaced.body.legs).toEqual([
      {
        position: 1,
        match: '新賽事',
        market: 'handicap',
        selection: '曼聯 -0.5',
        odds: 2,
      },
    ]);

    const pendingAgain = await request(app)
      .patch(`/api/bets/${bet.id}`)
      .set('Cookie', cookie)
      .send({ result: 'pending' });
    expect(pendingAgain.body.profit).toBeNull();

    const missing = await request(app)
      .patch('/api/bets/00000000-0000-4000-8000-000000000000')
      .set('Cookie', cookie)
      .send({ result: 'win' });
    expect(missing.status).toBe(404);
  });

  it('defaults the date to Hong Kong today', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);

    const created = await createBet(app, cookie, { stake: 10, legs: [singleLeg()] });
    expect(created.date).toBe(hkToday());
  });

  it('deletes a bet and cascades legs', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const bet = await createBet(app, cookie, { stake: 10, legs: [singleLeg()] });

    const deleted = await request(app).delete(`/api/bets/${bet.id}`).set('Cookie', cookie);
    expect(deleted.status).toBe(204);

    const db = await getTestDb();
    const legs = await db.pool.query<{ count: number }>(
      'select count(*)::int as count from bet_legs where bet_id = $1',
      [bet.id],
    );
    expect(legs.rows[0]?.count).toBe(0);

    const missing = await request(app).delete(`/api/bets/${bet.id}`).set('Cookie', cookie);
    expect(missing.status).toBe(404);
  });

  it('rejects invalid payloads', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);

    const cases = [
      { stake: 10, legs: [] },
      { stake: 0, legs: [singleLeg()] },
      { stake: 10, legs: [{ ...singleLeg(), odds: 1 }] },
      { stake: 10, legs: [{ ...singleLeg(), market: 'bogus' }] },
      { stake: 10, result: 'bogus', legs: [singleLeg()] },
      { date: '2026-02-30', stake: 10, legs: [singleLeg()] },
    ];

    for (const payload of cases) {
      const response = await request(app).post('/api/bets').set('Cookie', cookie).send(payload);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION');
    }
  });
});
```

- [ ] **Step 8: Run the CRUD integration tests**

Run:

```bash
TEST_DATABASE_URL="postgres://tally:test@127.0.0.1:5433/tally_test" pnpm exec vitest run tests/integration/bets-crud.test.ts
pnpm typecheck
pnpm lint
```

Expected: all pass/clean. If the test database is not running, start it per `README.md` or point `TEST_DATABASE_URL` at an existing `_test` database.

**Checkpoint:** Do not commit. Suggested later commit: `feat(bets): add CRUD API and storage`.

---

## Task 3: Backend Overview and Stats

**Files:**
- Create: `src/bets/stats.ts`
- Modify: `src/routes/bets.ts`
- Test: `tests/integration/bets-stats.test.ts`

**Interfaces:**
- Produces `getOverview(pool): Promise<BetOverview>` and `getBetStats(pool, period): Promise<BetStats>`.
- Adds `GET /api/bets/overview` and `GET /api/bets/stats?period=month|year|all`; both must be registered before `/:id` (they are; CRUD router has no `GET /:id`).
- Stats aggregate stored `bets.total_odds` and `bets.profit`, not re-derived.

- [ ] **Step 1: Create the stats module**

Create `src/bets/stats.ts`:

```ts
import type { Pool } from 'pg';
import { round2 } from './profit.js';
import type {
  BetBiggest,
  BetMarket,
  BetMarketStats,
  BetMonthlyPoint,
  BetOverview,
  BetOverviewDay,
  BetPeriod,
  BetStats,
  BetTotals,
  BetTypeStats,
} from './types.js';

function emptyOverviewDay(): BetOverviewDay {
  return { profit: 0, settledStake: 0, settledBets: 0, pendingBets: 0 };
}

function emptyOverview(): BetOverview {
  return { today: emptyOverviewDay(), month: emptyOverviewDay(), pending: { count: 0, stake: 0 } };
}

function toNumber(value: string | null): number {
  return value === null ? 0 : Number(value);
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : round2((numerator / denominator) * 100);
}

function periodClause(period: BetPeriod): string {
  switch (period) {
    case 'month':
      return `b.bet_date >= date_trunc('month', current_date)::date
              and b.bet_date < (date_trunc('month', current_date) + interval '1 month')::date`;
    case 'year':
      return `b.bet_date >= date_trunc('year', current_date)::date
              and b.bet_date < (date_trunc('year', current_date) + interval '1 year')::date`;
    case 'all':
      return 'true';
    default: {
      const exhaustive: never = period;
      return exhaustive;
    }
  }
}

interface OverviewRow {
  readonly today_profit: string;
  readonly today_stake: string;
  readonly today_settled: number;
  readonly today_pending: number;
  readonly month_profit: string;
  readonly month_stake: string;
  readonly month_settled: number;
  readonly month_pending: number;
  readonly pending_count: number;
  readonly pending_stake: string;
}

export async function getOverview(pool: Pool): Promise<BetOverview> {
  const result = await pool.query<OverviewRow>(
    `select
       coalesce(sum(profit) filter (
         where bet_date = current_date and result <> 'pending'
       ), 0)::text as today_profit,
       coalesce(sum(stake) filter (
         where bet_date = current_date and result <> 'pending'
       ), 0)::text as today_stake,
       count(*) filter (
         where bet_date = current_date and result <> 'pending'
       )::int as today_settled,
       count(*) filter (
         where bet_date = current_date and result = 'pending'
       )::int as today_pending,
       coalesce(sum(profit) filter (
         where bet_date >= date_trunc('month', current_date)::date
           and bet_date < (date_trunc('month', current_date) + interval '1 month')::date
           and result <> 'pending'
       ), 0)::text as month_profit,
       coalesce(sum(stake) filter (
         where bet_date >= date_trunc('month', current_date)::date
           and bet_date < (date_trunc('month', current_date) + interval '1 month')::date
           and result <> 'pending'
       ), 0)::text as month_stake,
       count(*) filter (
         where bet_date >= date_trunc('month', current_date)::date
           and bet_date < (date_trunc('month', current_date) + interval '1 month')::date
           and result <> 'pending'
       )::int as month_settled,
       count(*) filter (
         where bet_date >= date_trunc('month', current_date)::date
           and bet_date < (date_trunc('month', current_date) + interval '1 month')::date
           and result = 'pending'
       )::int as month_pending,
       count(*) filter (where result = 'pending')::int as pending_count,
       coalesce(sum(stake) filter (where result = 'pending'), 0)::text as pending_stake
     from bets`,
  );

  const row = result.rows[0];
  if (row === undefined) {
    return emptyOverview();
  }

  return {
    today: {
      profit: round2(toNumber(row.today_profit)),
      settledStake: round2(toNumber(row.today_stake)),
      settledBets: row.today_settled,
      pendingBets: row.today_pending,
    },
    month: {
      profit: round2(toNumber(row.month_profit)),
      settledStake: round2(toNumber(row.month_stake)),
      settledBets: row.month_settled,
      pendingBets: row.month_pending,
    },
    pending: {
      count: row.pending_count,
      stake: round2(toNumber(row.pending_stake)),
    },
  };
}

interface TotalsRow {
  readonly settled_stake: string;
  readonly profit: string;
  readonly settled_bets: number;
  readonly wins: number;
  readonly avg_odds: string | null;
  readonly pending_count: number;
  readonly pending_stake: string;
}

interface TypeRow {
  readonly type: 'single' | 'parlay';
  readonly bets: number;
  readonly stake: string;
  readonly profit: string;
}

interface MarketRow {
  readonly market: BetMarket;
  readonly bets: number;
  readonly stake: string;
  readonly profit: string;
}

interface MonthlyRow {
  readonly month: string;
  readonly profit: string;
}

interface BiggestRow {
  readonly id: string;
  readonly date: string;
  readonly profit: string;
  readonly label: string;
}

async function getBiggest(
  pool: Pool,
  where: string,
  kind: 'win' | 'loss',
): Promise<BetBiggest | null> {
  const operator = kind === 'win' ? '>' : '<';
  const order = kind === 'win' ? 'desc' : 'asc';
  const result = await pool.query<BiggestRow>(
    `with candidates as (
       select b.id,
              to_char(b.bet_date, 'YYYY-MM-DD') as date,
              b.profit,
              (select count(*) from bet_legs l where l.bet_id = b.id)::int as leg_count,
              (select l.match
                 from bet_legs l
                where l.bet_id = b.id
                order by l.position asc
                limit 1) as first_match
         from bets b
        where ${where}
          and b.result <> 'pending'
     )
     select id,
            date,
            profit::text,
            case
              when leg_count = 1 then first_match
              else leg_count::text || '串1'
            end as label
       from candidates
      where profit ${operator} 0
      order by profit ${order}, date asc, id asc
      limit 1`,
  );
  const row = result.rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    betId: row.id,
    profit: round2(Number(row.profit)),
    date: row.date,
    label: row.label,
  };
}

export async function getBetStats(pool: Pool, period: BetPeriod): Promise<BetStats> {
  const where = periodClause(period);

  const [totalsResult, typeResult, marketResult, monthlyResult, biggestWin, biggestLoss] =
    await Promise.all([
      pool.query<TotalsRow>(
        `select
           coalesce(sum(b.stake) filter (where b.result <> 'pending'), 0)::text as settled_stake,
           coalesce(sum(b.profit) filter (where b.result <> 'pending'), 0)::text as profit,
           count(*) filter (where b.result <> 'pending')::int as settled_bets,
           count(*) filter (where b.result <> 'pending' and b.profit > 0)::int as wins,
           avg(b.total_odds) filter (where b.result <> 'pending')::text as avg_odds,
           count(*) filter (where b.result = 'pending')::int as pending_count,
           coalesce(sum(b.stake) filter (where b.result = 'pending'), 0)::text as pending_stake
         from bets b
         where ${where}`,
      ),
      pool.query<TypeRow>(
        `with per_bet as (
           select b.id,
                  b.stake,
                  b.profit,
                  b.result,
                  (select count(*) from bet_legs l where l.bet_id = b.id)::int as leg_count
             from bets b
            where ${where}
         )
         select case when leg_count = 1 then 'single' else 'parlay' end as type,
                count(*) filter (where result <> 'pending')::int as bets,
                coalesce(sum(stake) filter (where result <> 'pending'), 0)::text as stake,
                coalesce(sum(profit) filter (where result <> 'pending'), 0)::text as profit
           from per_bet
          group by 1`,
      ),
      pool.query<MarketRow>(
        `with single_bets as (
           select bet_id from bet_legs group by bet_id having count(*) = 1
         )
         select l.market,
                count(*)::int as bets,
                coalesce(sum(b.stake), 0)::text as stake,
                coalesce(sum(b.profit), 0)::text as profit
           from bets b
           join single_bets s on s.bet_id = b.id
           join bet_legs l on l.bet_id = b.id
          where ${where}
            and b.result <> 'pending'
          group by l.market
          order by sum(b.stake) desc, l.market asc`,
      ),
      pool.query<MonthlyRow>(
        `with months as (
           select generate_series(
             date_trunc('month', current_date) - interval '5 months',
             date_trunc('month', current_date),
             interval '1 month'
           )::date as month_start
         ),
         totals as (
           select date_trunc('month', bet_date)::date as month_start,
                  coalesce(sum(profit), 0)::text as profit
             from bets
            where result <> 'pending'
            group by 1
         )
         select to_char(m.month_start, 'YYYY-MM') as month,
                coalesce(t.profit, '0') as profit
           from months m
           left join totals t on t.month_start = m.month_start
          order by m.month_start`,
      ),
      getBiggest(pool, where, 'win'),
      getBiggest(pool, where, 'loss'),
    ]);

  const totalsRow = totalsResult.rows[0];
  const settledStake = round2(toNumber(totalsRow?.settled_stake ?? '0'));
  const profit = round2(toNumber(totalsRow?.profit ?? '0'));
  const settledBets = totalsRow?.settled_bets ?? 0;
  const wins = totalsRow?.wins ?? 0;
  const totals: BetTotals = {
    settledStake,
    profit,
    roi: ratio(profit, settledStake),
    settledBets,
    wins,
    winRate: ratio(wins, settledBets),
    avgOdds:
      totalsRow?.avg_odds === null || totalsRow?.avg_odds === undefined
        ? null
        : round2(Number(totalsRow.avg_odds)),
    pendingCount: totalsRow?.pending_count ?? 0,
    pendingStake: round2(toNumber(totalsRow?.pending_stake ?? '0')),
  };

  const byType: BetTypeStats[] = (['single', 'parlay'] as const).map((type) => {
    const row = typeResult.rows.find((item) => item.type === type);
    const stake = round2(toNumber(row?.stake ?? '0'));
    const typeProfit = round2(toNumber(row?.profit ?? '0'));
    return {
      type,
      bets: row?.bets ?? 0,
      stake,
      profit: typeProfit,
      roi: ratio(typeProfit, stake),
    };
  });

  const byMarket: BetMarketStats[] = marketResult.rows.map((row) => {
    const stake = round2(toNumber(row.stake));
    const marketProfit = round2(toNumber(row.profit));
    return {
      market: row.market,
      bets: row.bets,
      stake,
      profit: marketProfit,
      roi: ratio(marketProfit, stake),
    };
  });

  const monthly: BetMonthlyPoint[] = monthlyResult.rows.map((row) => ({
    month: row.month,
    profit: round2(Number(row.profit)),
  }));

  return { period, totals, byType, byMarket, monthly, biggestWin, biggestLoss };
}
```

- [ ] **Step 2: Add the overview and stats routes**

In `src/routes/bets.ts`, add:

```ts
import { getBetStats, getOverview } from '../bets/stats.js';
import { betStatsQuerySchema } from '../schemas.js';
```

Register before the CRUD routes:

```ts
  router.get('/overview', async (_req, res) => {
    res.json(await getOverview(db.pool));
  });

  router.get('/stats', async (req, res) => {
    const parsed = betStatsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }
    res.json(await getBetStats(db.pool, parsed.data.period));
  });
```

- [ ] **Step 3: Write the failing overview/stats integration tests**

Create `tests/integration/bets-stats.test.ts`:

```ts
import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { hkToday } from '../../src/time.js';
import { closeTestDb, createTestApp, resetDb } from '../helpers/app.js';
import { createBet, currentMonthOtherDay, monthDate, singleLeg } from '../helpers/bets.js';
import { login } from '../helpers/records.js';

async function seed(app: Express, cookie: string): Promise<void> {
  const today = hkToday();
  const otherDay = currentMonthOtherDay();
  await createBet(app, cookie, {
    date: today,
    stake: 500,
    result: 'win',
    legs: [singleLeg({ odds: 1.95 })],
  });
  await createBet(app, cookie, {
    date: otherDay,
    stake: 200,
    result: 'pending',
    legs: [singleLeg({ odds: 2 }), singleLeg({ odds: 1.5 })],
  });
  await createBet(app, cookie, {
    date: otherDay,
    stake: 100,
    result: 'loss',
    legs: [singleLeg({ market: '1x2', selection: '和', odds: 2 })],
  });
  await createBet(app, cookie, {
    date: otherDay,
    stake: 50,
    result: 'push',
    legs: [singleLeg({ market: 'totals', selection: '大 2.5', odds: 1.9 })],
  });
  await createBet(app, cookie, {
    date: otherDay,
    stake: 200,
    result: 'half_win',
    legs: [singleLeg({ odds: 3 }), singleLeg({ odds: 1 })],
  });
  await createBet(app, cookie, {
    date: monthDate(1, 10),
    stake: 300,
    result: 'win',
    legs: [singleLeg({ odds: 2 })],
  });
  await createBet(app, cookie, {
    date: monthDate(13, 10),
    stake: 100,
    result: 'loss',
    legs: [singleLeg({ odds: 2 })],
  });
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeTestDb();
});

describe('bets overview', () => {
  it('returns today, current month, and all pending totals', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    await seed(app, cookie);

    const response = await request(app).get('/api/bets/overview').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      today: { profit: 475, settledStake: 500, settledBets: 1, pendingBets: 0 },
      month: { profit: 575, settledStake: 850, settledBets: 4, pendingBets: 1 },
      pending: { count: 1, stake: 200 },
    });
  });

  it('returns zeroes on an empty ledger', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const response = await request(app).get('/api/bets/overview').set('Cookie', cookie);
    expect(response.body).toEqual({
      today: { profit: 0, settledStake: 0, settledBets: 0, pendingBets: 0 },
      month: { profit: 0, settledStake: 0, settledBets: 0, pendingBets: 0 },
      pending: { count: 0, stake: 0 },
    });
  });
});

describe('bets stats', () => {
  it('computes the current month', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    await seed(app, cookie);

    const response = await request(app)
      .get('/api/bets/stats?period=month')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body.period).toBe('month');
    expect(response.body.totals).toEqual({
      settledStake: 850,
      profit: 575,
      roi: 67.65,
      settledBets: 4,
      wins: 2,
      winRate: 50,
      avgOdds: 2.21,
      pendingCount: 1,
      pendingStake: 200,
    });
    expect(response.body.byType).toEqual([
      { type: 'single', bets: 3, stake: 650, profit: 375, roi: 57.69 },
      { type: 'parlay', bets: 1, stake: 200, profit: 200, roi: 100 },
    ]);
    expect(response.body.byMarket).toEqual([
      { market: 'handicap', bets: 1, stake: 500, profit: 475, roi: 95 },
      { market: '1x2', bets: 1, stake: 100, profit: -100, roi: -100 },
      { market: 'totals', bets: 1, stake: 50, profit: 0, roi: 0 },
    ]);
    expect(response.body.monthly).toHaveLength(6);
    expect(response.body.monthly.at(-1)).toEqual({
      month: hkToday().slice(0, 7),
      profit: 575,
    });
    expect(response.body.biggestWin).toMatchObject({ profit: 475, date: hkToday() });
    expect(response.body.biggestLoss).toMatchObject({ profit: -100 });
  });

  it('includes earlier months in year and everything in all', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    await seed(app, cookie);

    const year = await request(app).get('/api/bets/stats?period=year').set('Cookie', cookie);
    expect(year.status).toBe(200);
    expect(year.body.totals.settledBets).toBeGreaterThanOrEqual(4);
    expect(year.body.totals.pendingCount).toBe(1);

    const all = await request(app).get('/api/bets/stats?period=all').set('Cookie', cookie);
    expect(all.status).toBe(200);
    expect(all.body.totals.settledBets).toBe(6);
    expect(all.body.totals.profit).toBe(775);
    expect(all.body.totals.settledStake).toBe(1250);
  });

  it('returns a six-month zero chart and null ratios when empty', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const response = await request(app).get('/api/bets/stats').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.totals).toEqual({
      settledStake: 0,
      profit: 0,
      roi: null,
      settledBets: 0,
      wins: 0,
      winRate: null,
      avgOdds: null,
      pendingCount: 0,
      pendingStake: 0,
    });
    expect(response.body.byType).toEqual([
      { type: 'single', bets: 0, stake: 0, profit: 0, roi: null },
      { type: 'parlay', bets: 0, stake: 0, profit: 0, roi: null },
    ]);
    expect(response.body.byMarket).toEqual([]);
    expect(response.body.monthly).toHaveLength(6);
    expect(response.body.biggestWin).toBeNull();
    expect(response.body.biggestLoss).toBeNull();
  });

  it('rejects an invalid period', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const response = await request(app)
      .get('/api/bets/stats?period=week')
      .set('Cookie', cookie);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION');
  });
});
```

- [ ] **Step 4: Run the stats tests**

Run:

```bash
TEST_DATABASE_URL="postgres://tally:test@127.0.0.1:5433/tally_test" pnpm exec vitest run tests/integration/bets-stats.test.ts
pnpm typecheck
pnpm lint
```

Expected: all pass/clean. If the month boundary makes a seeded date fall outside the current month, adjust the seed helpers (`currentMonthOtherDay`, `monthDate`) rather than weakening assertions.

**Checkpoint:** Do not commit. Suggested later commit: `feat(bets): add overview and stats API`.

---

## Task 4: Extract the Shared Frontend HTTP Client

**Files:**
- Create: `frontend/src/lib/http.ts`
- Modify: `frontend/src/lib/api.ts`

**Interfaces:**
- Produces `ApiError`, `isApiError`, `isNetworkError`, `doFetch`, `jsonInit`, `requestJson`, `requestVoid`.
- `lib/api.ts` keeps all mahjong schemas and re-exports the error helpers so existing imports continue to work.

- [ ] **Step 1: Move the generic HTTP code into `http.ts`**

Create `frontend/src/lib/http.ts` using the exact code currently at `frontend/src/lib/api.ts` lines 57–160, with these exports:

```ts
import { z } from 'zod';

const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

function notifyUnauthorized(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('tally:unauthorized'));
  }
}

function defaultMessage(status: number): string {
  if (status === 429) {
    return '嘗試次數過多，請稍後再試';
  }
  if (status >= 500) {
    return '伺服器暫時無法使用';
  }
  return '請求失敗';
}

const REQUEST_TIMEOUT_MS = 8_000;

export async function doFetch(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', controller.signal.aborted ? '連線逾時' : '網絡連線失敗');
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) {
    notifyUnauthorized();
    throw new ApiError(401, 'UNAUTHORIZED', '未授權');
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const parsed = errorBodySchema.safeParse(body);
    const code = parsed.success ? parsed.data.error.code : 'INTERNAL';
    const message = parsed.success ? parsed.data.error.message : defaultMessage(response.status);
    throw new ApiError(response.status, code, message);
  }

  return response;
}

export function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function requestJson<T>(
  path: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await doFetch(path, init);
  const body: unknown = await response.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(500, 'INVALID_RESPONSE', '伺服器回應格式錯誤');
  }
  return parsed.data;
}

export async function requestVoid(path: string, init: RequestInit): Promise<void> {
  await doFetch(path, init);
}
```

- [ ] **Step 2: Slim down `lib/api.ts`**

In `frontend/src/lib/api.ts`:

1. Remove `errorBodySchema`, `ApiError`, `isApiError`, `isNetworkError`, `notifyUnauthorized`, `defaultMessage`, `REQUEST_TIMEOUT_MS`, `doFetch`, `jsonInit`, `requestJson`, and `requestVoid`.
2. Keep the existing `z` import and all mahjong schemas/types (`playerSchema`, `recordSchema`, `recordsResponseSchema`, `playersResponseSchema`, `scoreDateSchema`, `statsSchema`, `rankingEntrySchema`, `rankingResponseSchema`, `RecordItem`, etc.).
3. Add:

```ts
import { jsonInit, requestJson, requestVoid } from './http';

export { ApiError, isApiError, isNetworkError } from './http';
```

4. Keep `login`, `fetchPlayers`, `fetchRecords`, `createRecord`, `updateRecord`, `deleteRecord`, `fetchStats`, `fetchRanking` exactly as they are.

- [ ] **Step 3: Verify the refactor**

Run:

```bash
pnpm typecheck:web
pnpm test:web
pnpm lint
```

Expected: all existing frontend tests pass; no import errors.

**Checkpoint:** Do not commit. Suggested later commit: `refactor(web): extract shared HTTP client`.

---

## Task 5: Frontend Bet Types, API, Math, Formatting, and Draft Validation

**Files:**
- Create: `frontend/src/bet/types.ts`
- Create: `frontend/src/bet/api.ts`
- Create: `frontend/src/bet/lib/profit.ts`
- Create: `frontend/src/bet/lib/format.ts`
- Create: `frontend/src/bet/lib/form.ts`
- Test: `frontend/tests/bet-profit.test.ts`
- Test: `frontend/tests/bet-format.test.ts`
- Test: `frontend/tests/bet-form.test.ts`

**Interfaces:**
- `types.ts` mirrors the server DTOs and adds draft/payload types.
- `api.ts` exposes `fetchBets({ status, cursor? })`, `fetchBetOverview()`, `createBet(payload)`, `updateBet(id, payload)`, `deleteBet(id)`, `fetchBetStats(period)`.
- `lib/profit.ts` exposes `round2`, `computeTotalOdds`, `computeProfit`, `computePotentialReturn`, and the same min/max constants as the backend.
- `lib/format.ts` exposes `formatBetMoney`, `formatStake`, `formatOdds`, `formatPercent`, `formatSignedNumber`, `resultLabel`, `marketLabel`, `betTypeLabel`, `profitTone`.
- `lib/form.ts` exposes `emptyDraft`, `draftFromBet`, `parseDraft`, `BetDraft`, `BetDraftLeg`, `BetDraftErrors`.

- [ ] **Step 1: Create the frontend types**

Create `frontend/src/bet/types.ts`:

```ts
export type BetResult = 'pending' | 'win' | 'half_win' | 'push' | 'half_loss' | 'loss';
export type BetMarket = '1x2' | 'handicap' | 'totals' | 'other';
export type BetStatusFilter = 'all' | 'pending' | 'settled';
export type BetPeriod = 'month' | 'year' | 'all';

export interface BetLeg {
  readonly position: number;
  readonly match: string;
  readonly market: BetMarket;
  readonly selection: string;
  readonly odds: number;
}

export interface BetItem {
  readonly id: string;
  readonly date: string;
  readonly recordedAt: string;
  readonly stake: number;
  readonly result: BetResult;
  readonly legs: BetLeg[];
  readonly totalOdds: number;
  readonly profit: number | null;
}

export interface BetListResponse {
  readonly items: BetItem[];
  readonly nextCursor: string | null;
}

export interface BetOverviewDay {
  readonly profit: number;
  readonly settledStake: number;
  readonly settledBets: number;
  readonly pendingBets: number;
}

export interface BetOverview {
  readonly today: BetOverviewDay;
  readonly month: BetOverviewDay;
  readonly pending: { readonly count: number; readonly stake: number };
}

export interface BetTotals {
  readonly settledStake: number;
  readonly profit: number;
  readonly roi: number | null;
  readonly settledBets: number;
  readonly wins: number;
  readonly winRate: number | null;
  readonly avgOdds: number | null;
  readonly pendingCount: number;
  readonly pendingStake: number;
}

export interface BetTypeStats {
  readonly type: 'single' | 'parlay';
  readonly bets: number;
  readonly stake: number;
  readonly profit: number;
  readonly roi: number | null;
}

export interface BetMarketStats {
  readonly market: BetMarket;
  readonly bets: number;
  readonly stake: number;
  readonly profit: number;
  readonly roi: number | null;
}

export interface BetMonthlyPoint {
  readonly month: string;
  readonly profit: number;
}

export interface BetBiggest {
  readonly betId: string;
  readonly profit: number;
  readonly date: string;
  readonly label: string;
}

export interface BetStats {
  readonly period: BetPeriod;
  readonly totals: BetTotals;
  readonly byType: BetTypeStats[];
  readonly byMarket: BetMarketStats[];
  readonly monthly: BetMonthlyPoint[];
  readonly biggestWin: BetBiggest | null;
  readonly biggestLoss: BetBiggest | null;
}

export interface BetLegPayload {
  readonly match: string;
  readonly market: BetMarket;
  readonly selection: string;
  readonly odds: number;
}

export interface BetPayload {
  readonly date: string;
  readonly stake: number;
  readonly result: BetResult;
  readonly legs: BetLegPayload[];
}

export interface BetDraftLeg {
  readonly match: string;
  readonly market: BetMarket;
  readonly selection: string;
  readonly odds: string;
}

export interface BetDraft {
  readonly date: string;
  readonly stake: string;
  readonly result: BetResult;
  readonly legs: BetDraftLeg[];
}
```

- [ ] **Step 2: Create the frontend math and formatting modules**

Create `frontend/src/bet/lib/profit.ts` with the same constants and functions as the backend. Copy the backend `round2`, `computeTotalOdds`, and `computeProfit` logic verbatim, importing types from `../types`. Add:

```ts
export function computePotentialReturn(stake: number, totalOdds: number): number {
  return round2(stake * totalOdds);
}
```

Create `frontend/src/bet/lib/format.ts`:

```ts
import type { BetMarket, BetResult } from '../types';
import { round2 } from './profit';

const moneyFormatter = new Intl.NumberFormat('en-HK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBetMoney(value: number): string {
  const rounded = round2(value);
  if (rounded === 0) {
    return '$0.00';
  }
  return `${rounded > 0 ? '+' : '-'}$${moneyFormatter.format(Math.abs(rounded))}`;
}

export function formatStake(value: number): string {
  return `$${moneyFormatter.format(round2(value))}`;
}

export function formatOdds(value: number | null): string {
  return value === null ? '—' : round2(value).toFixed(2);
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${round2(value).toFixed(2)}%`;
}

export function formatSignedNumber(value: number): string {
  const rounded = round2(value);
  if (rounded === 0) {
    return '0';
  }
  const absolute = Number.isInteger(rounded)
    ? String(Math.abs(rounded))
    : Math.abs(rounded).toFixed(2);
  return rounded > 0 ? `+${absolute}` : `-${absolute}`;
}

export function resultLabel(result: BetResult): string {
  switch (result) {
    case 'pending':
      return '待結算';
    case 'win':
      return '贏';
    case 'half_win':
      return '半贏';
    case 'push':
      return '走水';
    case 'half_loss':
      return '半輸';
    case 'loss':
      return '輸';
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

export function marketLabel(market: BetMarket): string {
  switch (market) {
    case '1x2':
      return '主客和';
    case 'handicap':
      return '讓球';
    case 'totals':
      return '大細';
    case 'other':
      return '其他';
    default: {
      const exhaustive: never = market;
      return exhaustive;
    }
  }
}

export function betTypeLabel(legCount: number): string {
  return legCount === 1 ? '單場' : `${legCount}串1`;
}

export function profitTone(value: number | null): string {
  if (value === null || value === 0) {
    return 'is-zero';
  }
  return value > 0 ? 'is-win' : 'is-loss';
}
```

- [ ] **Step 3: Create the draft validation module**

Create `frontend/src/bet/lib/form.ts`:

```ts
import type { BetDraft, BetItem, BetLegPayload, BetMarket, BetPayload } from '../types';
import {
  computeTotalOdds,
  MAX_ODDS,
  MAX_STAKE,
  MAX_TOTAL_ODDS,
  MIN_ODDS,
  MIN_STAKE,
  round2,
} from './profit';

export interface BetDraftLegErrors {
  readonly match?: string;
  readonly selection?: string;
  readonly odds?: string;
}

export interface BetDraftErrors {
  readonly date?: string;
  readonly stake?: string;
  readonly legs: BetDraftLegErrors[];
  readonly totalOdds?: string;
}

export interface ParsedDraft {
  readonly payload: BetPayload | null;
  readonly errors: BetDraftErrors;
  readonly totalOdds: number | null;
}

export function emptyDraft(date: string): BetDraft {
  return {
    date,
    stake: '',
    result: 'pending',
    legs: [{ match: '', market: '1x2', selection: '', odds: '' }],
  };
}

export function draftFromBet(bet: BetItem): BetDraft {
  return {
    date: bet.date,
    stake: String(bet.stake),
    result: bet.result,
    legs: bet.legs.map((leg) => ({
      match: leg.match,
      market: leg.market,
      selection: leg.selection,
      odds: String(leg.odds),
    })),
  };
}

function codePointLength(value: string): number {
  return [...value].length;
}

export function parseDraft(draft: BetDraft): ParsedDraft {
  const legErrors: BetDraftLegErrors[] = draft.legs.map(() => ({}));
  const errors: BetDraftErrors = { legs: legErrors };

  if (draft.date.trim() === '') {
    errors.date = '請選擇日期';
  }

  const stake = Number(draft.stake);
  if (!Number.isFinite(stake) || stake < MIN_STAKE || stake > MAX_STAKE) {
    errors.stake = `注碼必須介乎 ${MIN_STAKE} 與 ${MAX_STAKE}`;
  }

  const legs: BetLegPayload[] = [];
  draft.legs.forEach((leg, index) => {
    const current: { match?: string; selection?: string; odds?: string } = {};
    const match = leg.match.trim();
    if (codePointLength(match) < 1 || codePointLength(match) > 80) {
      current.match = '賽事必須為 1–80 個字元';
    }
    const selection = leg.selection.trim();
    if (codePointLength(selection) < 1 || codePointLength(selection) > 60) {
      current.selection = '選擇必須為 1–60 個字元';
    }
    const odds = Number(leg.odds);
    if (!Number.isFinite(odds) || odds < MIN_ODDS || odds > MAX_ODDS) {
      current.odds = `賠率必須介乎 ${MIN_ODDS} 與 ${MAX_ODDS}`;
    }
    legErrors[index] = current;
    if (Object.keys(current).length === 0) {
      legs.push({
        match,
        market: leg.market as BetMarket,
        selection,
        odds: round2(odds),
      });
    }
  });

  const hasLegErrors = legErrors.some((leg) => Object.keys(leg).length > 0);
  const totalOdds = hasLegErrors ? null : computeTotalOdds(legs);
  if (totalOdds !== null && totalOdds > MAX_TOTAL_ODDS) {
    errors.totalOdds = `總賠率不可超過 ${MAX_TOTAL_ODDS}`;
  }

  const valid =
    errors.date === undefined &&
    errors.stake === undefined &&
    !hasLegErrors &&
    errors.totalOdds === undefined;

  return {
    payload: valid
      ? {
          date: draft.date,
          stake: round2(stake),
          result: draft.result,
          legs,
        }
      : null,
    errors,
    totalOdds,
  };
}
```

- [ ] **Step 4: Create the bet API client**

Create `frontend/src/bet/api.ts`:

```ts
import { z } from 'zod';
import { jsonInit, requestJson, requestVoid } from '../lib/http';
import type {
  BetItem,
  BetListResponse,
  BetMarket,
  BetOverview,
  BetPayload,
  BetPeriod,
  BetResult,
  BetStats,
  BetStatusFilter,
} from './types';

const marketSchema = z.enum(['1x2', 'handicap', 'totals', 'other']);
const resultSchema = z.enum(['pending', 'win', 'half_win', 'push', 'half_loss', 'loss']);

const legSchema = z.object({
  position: z.number().int().positive(),
  match: z.string(),
  market: marketSchema,
  selection: z.string(),
  odds: z.number(),
});

const itemSchema = z.object({
  id: z.string(),
  date: z.string(),
  recordedAt: z.string(),
  stake: z.number(),
  result: resultSchema,
  legs: z.array(legSchema),
  totalOdds: z.number(),
  profit: z.number().nullable(),
});

const listSchema = z.object({
  items: z.array(itemSchema),
  nextCursor: z.string().nullable(),
});

const overviewDaySchema = z.object({
  profit: z.number(),
  settledStake: z.number(),
  settledBets: z.number(),
  pendingBets: z.number(),
});

const overviewSchema = z.object({
  today: overviewDaySchema,
  month: overviewDaySchema,
  pending: z.object({ count: z.number(), stake: z.number() }),
});

const totalsSchema = z.object({
  settledStake: z.number(),
  profit: z.number(),
  roi: z.number().nullable(),
  settledBets: z.number(),
  wins: z.number(),
  winRate: z.number().nullable(),
  avgOdds: z.number().nullable(),
  pendingCount: z.number(),
  pendingStake: z.number(),
});

const typeSchema = z.object({
  type: z.enum(['single', 'parlay']),
  bets: z.number(),
  stake: z.number(),
  profit: z.number(),
  roi: z.number().nullable(),
});

const marketStatsSchema = z.object({
  market: marketSchema,
  bets: z.number(),
  stake: z.number(),
  profit: z.number(),
  roi: z.number().nullable(),
});

const monthlySchema = z.object({
  month: z.string(),
  profit: z.number(),
});

const biggestSchema = z.object({
  betId: z.string(),
  profit: z.number(),
  date: z.string(),
  label: z.string(),
});

const statsSchema = z.object({
  period: z.enum(['month', 'year', 'all']),
  totals: totalsSchema,
  byType: z.array(typeSchema),
  byMarket: z.array(marketStatsSchema),
  monthly: z.array(monthlySchema),
  biggestWin: biggestSchema.nullable(),
  biggestLoss: biggestSchema.nullable(),
});

export async function fetchBets(options: {
  readonly status: BetStatusFilter;
  readonly cursor?: string;
}): Promise<BetListResponse> {
  const params = new URLSearchParams({ limit: '50', status: options.status });
  if (options.cursor !== undefined) {
    params.set('cursor', options.cursor);
  }
  return requestJson(`/api/bets?${params.toString()}`, {}, listSchema);
}

export async function fetchBetOverview(): Promise<BetOverview> {
  return requestJson('/api/bets/overview', {}, overviewSchema);
}

export async function createBet(payload: BetPayload): Promise<BetItem> {
  return requestJson('/api/bets', jsonInit('POST', payload), itemSchema);
}

export async function updateBet(
  id: string,
  payload: Partial<BetPayload>,
): Promise<BetItem> {
  return requestJson(
    `/api/bets/${encodeURIComponent(id)}`,
    jsonInit('PATCH', payload),
    itemSchema,
  );
}

export async function deleteBet(id: string): Promise<void> {
  await requestVoid(`/api/bets/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function fetchBetStats(period: BetPeriod): Promise<BetStats> {
  const params = new URLSearchParams({ period });
  return requestJson(`/api/bets/stats?${params.toString()}`, {}, statsSchema);
}
```

- [ ] **Step 5: Write the frontend unit tests**

Create `frontend/tests/bet-profit.test.ts` by copying the backend profit test cases, importing from `../src/bet/lib/profit` and adding:

```ts
import { computePotentialReturn } from '../src/bet/lib/profit';

it('computes potential return', () => {
  expect(computePotentialReturn(200, 3.71)).toBe(742);
});
```

Create `frontend/tests/bet-format.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  betTypeLabel,
  formatBetMoney,
  formatOdds,
  formatPercent,
  formatSignedNumber,
  formatStake,
  marketLabel,
  profitTone,
  resultLabel,
} from '../src/bet/lib/format';

describe('bet formatting', () => {
  it('formats money with signs and 2dp', () => {
    expect(formatBetMoney(1355)).toBe('+$1,355.00');
    expect(formatBetMoney(-500)).toBe('-$500.00');
    expect(formatBetMoney(0)).toBe('$0.00');
    expect(formatStake(500)).toBe('$500.00');
  });

  it('formats odds and percentages', () => {
    expect(formatOdds(3.705)).toBe('3.71');
    expect(formatOdds(null)).toBe('—');
    expect(formatPercent(67.647)).toBe('67.65%');
    expect(formatPercent(null)).toBe('—');
  });

  it('formats signed chart numbers', () => {
    expect(formatSignedNumber(475)).toBe('+475');
    expect(formatSignedNumber(-100)).toBe('-100');
    expect(formatSignedNumber(0)).toBe('0');
    expect(formatSignedNumber(12.5)).toBe('+12.50');
  });

  it('maps labels', () => {
    expect(resultLabel('pending')).toBe('待結算');
    expect(resultLabel('half_win')).toBe('半贏');
    expect(marketLabel('1x2')).toBe('主客和');
    expect(marketLabel('handicap')).toBe('讓球');
    expect(betTypeLabel(1)).toBe('單場');
    expect(betTypeLabel(3)).toBe('3串1');
    expect(profitTone(10)).toBe('is-win');
    expect(profitTone(-10)).toBe('is-loss');
    expect(profitTone(null)).toBe('is-zero');
  });
});
```

Create `frontend/tests/bet-form.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { draftFromBet, emptyDraft, parseDraft } from '../src/bet/lib/form';
import type { BetItem } from '../src/bet/types';

describe('bet draft validation', () => {
  it('returns a valid single payload and rounds', () => {
    const draft = {
      ...emptyDraft('2026-10-26'),
      stake: '12.345',
      legs: [{ match: ' 曼聯 vs 車路士 ', market: 'handicap' as const, selection: ' 曼聯 -0.5 ', odds: '1.955' }],
    };
    const parsed = parseDraft(draft);
    expect(parsed.totalOdds).toBe(1.96);
    expect(parsed.payload).toEqual({
      date: '2026-10-26',
      stake: 12.35,
      result: 'pending',
      legs: [
        {
          match: '曼聯 vs 車路士',
          market: 'handicap',
          selection: '曼聯 -0.5',
          odds: 1.96,
        },
      ],
    });
  });

  it('rejects missing fields', () => {
    const parsed = parseDraft(emptyDraft(''));
    expect(parsed.payload).toBeNull();
    expect(parsed.errors.date).toBe('請選擇日期');
    expect(parsed.errors.stake).toBeDefined();
    expect(parsed.errors.legs[0]?.match).toBeDefined();
    expect(parsed.errors.legs[0]?.selection).toBeDefined();
    expect(parsed.errors.legs[0]?.odds).toBeDefined();
  });

  it('rejects total odds above the cap', () => {
    const draft = {
      ...emptyDraft('2026-10-26'),
      stake: '10',
      legs: [
        { match: 'A', market: '1x2' as const, selection: '主', odds: '300' },
        { match: 'B', market: '1x2' as const, selection: '客', odds: '400' },
      ],
    };
    const parsed = parseDraft(draft);
    expect(parsed.payload).toBeNull();
    expect(parsed.errors.totalOdds).toBeDefined();
  });

  it('prefills from a bet', () => {
    const bet: BetItem = {
      id: 'id',
      date: '2026-10-26',
      recordedAt: '2026-10-26T12:00:00.000Z',
      stake: 500,
      result: 'win',
      legs: [
        {
          position: 1,
          match: '曼聯 vs 車路士',
          market: 'handicap',
          selection: '曼聯 -0.5',
          odds: 1.95,
        },
      ],
      totalOdds: 1.95,
      profit: 475,
    };
    expect(draftFromBet(bet)).toEqual({
      date: '2026-10-26',
      stake: '500',
      result: 'win',
      legs: [
        {
          match: '曼聯 vs 車路士',
          market: 'handicap',
          selection: '曼聯 -0.5',
          odds: '1.95',
        },
      ],
    });
  });
});
```

- [ ] **Step 6: Run the frontend domain tests**

Run:

```bash
pnpm typecheck:web
pnpm test:web
pnpm lint
```

Expected: all pass/clean.

**Checkpoint:** Do not commit. Suggested later commit: `feat(bets): add web domain model and API client`.

---

## Task 6: Betting Design Contract and CSS Foundation

**Files:**
- Create: `frontend/BET-DESIGN.md`
- Create: `frontend/src/bet/bet.css`

**Interfaces:**
- `BET-DESIGN.md` is the visual source of truth for the betting module. Every betting CSS value must trace to a `--bet-*` token or a listed component rule.
- `bet.css` defines the `--bet-*` tokens on `:root`, the `body.bet-mode` / `body.bet-sheet-open` states, and the shell/header/nav/button/sheet foundation. Later tasks add component styles to the same file.

- [ ] **Step 1: Write `frontend/BET-DESIGN.md`**

Create `frontend/BET-DESIGN.md` with this content (expand the component descriptions as the implementation grows, but keep these exact values):

```md
# Tally Betting — Design System

> Separate visual contract for the football-betting ledger. Mahjong tokens and components must not be used here.

## 1. Atmosphere

**Floodlit night match.** Deep navy-black sky, faint chalk pitch lines, a scoreboard/odds-board typography, and a floodlight volt accent. The interface should feel like a betting slip laid on a dark stadium table: dense, numeric, calm, and separate from the mahjong felt.

- No mahjong felt green, cinnabar, jade/coral money semantics, or tally marks.
- No external fonts, CDNs, logos, or brand assets.
- Numbers are the light: monospace, tabular, high contrast.

## 2. Color Tokens

All tokens are namespaced `--bet-*` on `:root`.

| Token | Value | Usage |
|---|---|---|
| `--bet-bg` | `#050b14` | Page background |
| `--bet-bg-2` | `#081120` | Gradient / raised page area |
| `--bet-surface` | `#0c1626` | Cards, summary cells |
| `--bet-raised` | `#122033` | Inputs, active surfaces |
| `--bet-line` | `#1e3147` | Default border |
| `--bet-line-strong` | `#2c4a63` | Selected / focused border |
| `--bet-text` | `#f3f7f2` | Primary text |
| `--bet-dim` | `#b8c4cf` | Secondary text |
| `--bet-muted` | `#7f92a3` | Metadata, hints |
| `--bet-volt` | `#d8ff4f` | Primary action, active nav, focus |
| `--bet-volt-ink` | `#0a1204` | Text on volt |
| `--bet-win` | `#5ee6a8` | Profit, win |
| `--bet-loss` | `#ff6b6b` | Loss, destructive |
| `--bet-pending` | `#ffc857` | Pending / waiting |
| `--bet-push` | `#9fb0bf` | Push / neutral |
| `--bet-scrim` | `rgba(2, 6, 12, 0.78)` | Dialog backdrop |
| `--bet-glow` | `rgba(216, 255, 79, 0.10)` | Floodlight wash |
| `--bet-pitch-line` | `rgba(243, 247, 242, 0.045)` | Chalk lines |
| `--bet-shadow` | `0 18px 48px rgba(0, 0, 0, 0.38)` | Sheets/toasts |

Contrast rules: text ≥ 4.5:1 on its surface; UI boundaries ≥ 3:1; never rely on colour alone. Money always carries a sign; results always carry a text label.

## 3. Typography

- UI: `-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang HK', 'PingFang TC', 'Noto Sans CJK TC', 'Microsoft JhengHei', sans-serif`.
- Numbers: `ui-monospace, 'SF Mono', Menlo, 'Roboto Mono', monospace` with `font-variant-numeric: tabular-nums`.
- Scale: Display 32/1.05 700; H1 22/1.2 700; H2 18/1.3 600; body 16/1.5 400; data 15/1.3 700; small 14/1.45; label 12/1.35 500 uppercase mono; micro 10/1.3 600 tracking 0.08em.
- No letter-spacing below 0.02em on CJK body text.

## 4. Layout & Density

- 4px base unit; page gutter 16px; card padding 14–16px; gap 8/12/16.
- Shell max-width 480px; full `100dvh`; safe-area top/bottom.
- Touch target 44px minimum; inputs 16px; primary button 52px.
- Single column only; no desktop layout.

## 5. Components

- **Shell**: `.bet-shell`, `.bet-header`, `.bet-main`, `.bet-nav`, `.bet-page-enter`.
- **Header**: pitch mark, `Tally` wordmark, 「賭球」 sub, 「麻雀」 switch pill.
- **Nav**: two tabs, 注單 / 統計; volt active bar, not a mahjong pill.
- **Summary**: 3 scoreboard cells; today/month profit and all pending count/stake.
- **CTA**: full-width volt pill/square, `新增注單`.
- **Filters**: 全部 / 待結算 / 已結算; selected uses volt wash + border.
- **Bet card**: type badge, record time, result badge; numbered legs `01/02`; dotted separators; stake / total odds / profit footer; pending card has a `結算` text action.
- **Sheet**: full-screen for the bet form; bottom sheet for confirmation. Native `<dialog>` + focus trap + Escape.
- **Form**: date, leg fieldsets, market chips, result chips, total-odds readout, profit preview, sticky footer.
- **Stats**: period segmented control, hero P/L, 2×2 KPI, type rows, market diverging bars, 6-month CSS column chart, biggest win/loss cards.
- **States**: `.bet-empty`, `.bet-inline-error`, `.bet-skeleton*`, `.bet-toast*`, `.bet-banner`.

## 6. Motion

- 120–180ms; `--bet-ease: cubic-bezier(0.23, 1, 0.32, 1)`.
- Sheet slides up; page fades/slides 4px; bars grow on mount; number updates may flash once.
- Under `prefers-reduced-motion: reduce`, disable all transforms/animations.

## 7. Accessibility

- Focus ring: 2px `--bet-volt`, 2px offset, only `:focus-visible`.
- Dialog focus trap, Escape close, focus return to trigger, body scroll lock.
- `aria-live="polite"` for toast and profit preview; `role="alert"` for inline errors.
- Inputs have visible labels; errors use `aria-invalid` and text.
- Charts have text alternatives (`aria-label` and numbers).
```

- [ ] **Step 2: Create the CSS token and shell foundation**

Create `frontend/src/bet/bet.css`:

```css
:root {
  --bet-bg: #050b14;
  --bet-bg-2: #081120;
  --bet-surface: #0c1626;
  --bet-raised: #122033;
  --bet-line: #1e3147;
  --bet-line-strong: #2c4a63;
  --bet-text: #f3f7f2;
  --bet-dim: #b8c4cf;
  --bet-muted: #7f92a3;
  --bet-volt: #d8ff4f;
  --bet-volt-ink: #0a1204;
  --bet-win: #5ee6a8;
  --bet-loss: #ff6b6b;
  --bet-pending: #ffc857;
  --bet-push: #9fb0bf;
  --bet-scrim: rgba(2, 6, 12, 0.78);
  --bet-glow: rgba(216, 255, 79, 0.10);
  --bet-pitch-line: rgba(243, 247, 242, 0.045);
  --bet-shadow: 0 18px 48px rgba(0, 0, 0, 0.38);
  --bet-radius: 14px;
  --bet-ease: cubic-bezier(0.23, 1, 0.32, 1);
}

body.bet-mode {
  background:
    radial-gradient(120% 70% at 18% -10%, var(--bet-glow), transparent 58%),
    radial-gradient(80% 60% at 100% 100%, rgba(31, 185, 120, 0.06), transparent 60%),
    linear-gradient(180deg, var(--bet-bg), var(--bet-bg-2));
  background-attachment: fixed;
}

body.bet-mode::before {
  background-image:
    repeating-linear-gradient(90deg, transparent 0 47px, var(--bet-pitch-line) 47px 48px),
    repeating-linear-gradient(0deg, transparent 0 47px, var(--bet-pitch-line) 47px 48px);
  opacity: 1;
}

body.bet-sheet-open {
  overflow: hidden;
}

.bet-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 480px;
  height: 100dvh;
  min-height: 0;
  margin: 0 auto;
  overflow: hidden;
  color: var(--bet-text);
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'PingFang HK',
    'PingFang TC', 'Noto Sans CJK TC', 'Microsoft JhengHei', sans-serif;
}

.bet-shell *,
.bet-shell *::before,
.bet-shell *::after {
  box-sizing: border-box;
}

.bet-header {
  position: relative;
  z-index: 20;
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: calc(56px + env(safe-area-inset-top, 0px) + 10px);
  padding: calc(env(safe-area-inset-top, 0px) + 10px) 16px 0;
  background: rgba(5, 11, 20, 0.86);
  border-bottom: 1px solid var(--bet-line);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}

.bet-header__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.bet-header__mark {
  flex: none;
  color: var(--bet-volt);
}

.bet-header__names {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.05;
}

.bet-header__wordmark {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.bet-header__sub {
  color: var(--bet-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
}

.bet-switch {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 44px;
  padding: 0 10px;
  color: var(--bet-dim);
  font-size: 11px;
  font-weight: 600;
  background: var(--bet-surface);
  border: 1px solid var(--bet-line);
  border-radius: 999px;
}

.bet-switch:hover {
  color: var(--bet-text);
  border-color: var(--bet-line-strong);
}

.bet-main {
  flex: 1 1 auto;
  min-height: 0;
  padding: 16px;
  padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px) + 24px);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}

.bet-sheet-open .bet-main {
  overflow: hidden;
}

.bet-page-enter {
  animation: bet-page-in 160ms var(--bet-ease);
}

@keyframes bet-page-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.bet-nav {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  display: flex;
  justify-content: center;
  min-height: calc(64px + env(safe-area-inset-bottom, 0px));
  padding-bottom: env(safe-area-inset-bottom, 0px);
  background: rgba(5, 11, 20, 0.94);
  border-top: 1px solid var(--bet-line);
  -webkit-backdrop-filter: blur(14px);
  backdrop-filter: blur(14px);
}

.bet-nav__inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  max-width: 480px;
}

.bet-nav__tab {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  min-height: 64px;
  color: var(--bet-muted);
  font-size: 10px;
  font-weight: 600;
  background: transparent;
  border: 0;
}

.bet-nav__tab.is-active {
  color: var(--bet-volt);
}

.bet-nav__tab.is-active::before {
  position: absolute;
  top: 0;
  width: 32px;
  height: 2px;
  content: '';
  background: var(--bet-volt);
  border-radius: 0 0 2px 2px;
}

.bet-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 16px;
  font-size: 14px;
  font-weight: 600;
  border: 1px solid transparent;
  border-radius: 999px;
}

.bet-button:disabled {
  opacity: 0.5;
}

.bet-button--primary {
  color: var(--bet-volt-ink);
  background: var(--bet-volt);
}

.bet-button--outline {
  color: var(--bet-text);
  background: transparent;
  border-color: var(--bet-line-strong);
}

.bet-button--ghost {
  color: var(--bet-dim);
  background: transparent;
}

.bet-button--danger {
  color: var(--bet-text);
  background: var(--bet-loss);
}

.bet-button--danger-ghost {
  color: var(--bet-loss);
  background: transparent;
  border-color: rgba(255, 107, 107, 0.35);
}

.bet-icon-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  color: var(--bet-dim);
  background: transparent;
  border: 0;
  border-radius: 999px;
}

.bet-icon-button:hover {
  color: var(--bet-text);
  background: var(--bet-raised);
}

.bet-banner {
  flex: none;
  padding: 8px 16px;
  color: var(--bet-pending);
  font-size: 12px;
  background: rgba(255, 200, 87, 0.08);
  border-bottom: 1px solid rgba(255, 200, 87, 0.24);
}

.bet-toast {
  position: fixed;
  right: 50%;
  bottom: calc(80px + env(safe-area-inset-bottom, 0px));
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: min(360px, calc(100vw - 32px));
  padding: 10px 14px;
  color: var(--bet-text);
  font-size: 13px;
  background: var(--bet-raised);
  border: 1px solid var(--bet-line-strong);
  border-radius: 999px;
  box-shadow: var(--bet-shadow);
  transform: translateX(50%);
}

.bet-toast--success {
  border-color: rgba(94, 230, 168, 0.4);
}

.bet-toast--error {
  border-color: rgba(255, 107, 107, 0.5);
}

.bet-toast--info {
  border-color: var(--bet-line-strong);
}

.bet-sheet {
  width: 100%;
  max-width: 480px;
  height: 100%;
  margin: 0 auto;
  padding: 0;
  color: var(--bet-text);
  background: transparent;
  border: 0;
}

.bet-sheet::backdrop {
  background: var(--bet-scrim);
}

.bet-sheet__panel {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  max-height: 92dvh;
  background: var(--bet-surface);
  border: 1px solid var(--bet-line);
  border-bottom: 0;
  border-radius: 20px 20px 0 0;
  box-shadow: var(--bet-shadow);
  animation: bet-sheet-up 180ms var(--bet-ease);
}

.bet-sheet--full .bet-sheet__panel {
  top: 0;
  height: 100%;
  max-height: none;
  padding-top: env(safe-area-inset-top, 0px);
  border-radius: 0;
}

@keyframes bet-sheet-up {
  from {
    transform: translateY(24px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.bet-sheet__handle {
  flex: none;
  width: 36px;
  height: 4px;
  margin: 8px auto 0;
  background: var(--bet-line-strong);
  border-radius: 999px;
}

.bet-sheet--full .bet-sheet__handle {
  display: none;
}

.bet-sheet__header {
  display: flex;
  flex: none;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid var(--bet-line);
}

.bet-sheet__title {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}

.bet-sheet__description {
  margin-top: 4px;
  color: var(--bet-muted);
  font-size: 12px;
}

.bet-sheet__body {
  flex: 1 1 auto;
  min-height: 0;
  padding: 16px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.bet-sheet__footer {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  background: var(--bet-surface);
  border-top: 1px solid var(--bet-line);
}

.bet-shell :focus-visible {
  outline: 2px solid var(--bet-volt);
  outline-offset: 2px;
}

.bet-shell ::selection {
  color: var(--bet-volt-ink);
  background: var(--bet-volt);
}

.bet-spin {
  animation: bet-spin 900ms linear infinite;
}

@keyframes bet-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bet-page-enter,
  .bet-sheet__panel,
  .bet-toast,
  .bet-month__bar {
    animation: none !important;
    transition: none !important;
  }
}
```

Later tasks append component styles to this file. Every class used in the betting TSX must have a rule here by the end of Task 11.

- [ ] **Step 3: Verify the foundation**

Run:

```bash
pnpm typecheck:web
pnpm build:web
pnpm lint
```

Expected: build passes; no TS/lint errors.

**Checkpoint:** Do not commit. Suggested later commit: `feat(bets): add betting design system foundation`.

---

## Task 7: Betting Shell, Header Switch, Routing, and Icons

**Files:**
- Modify: `frontend/src/hooks/useHashRoute.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/AppHeader.tsx`
- Modify: `frontend/src/components/Icons.tsx`
- Create: `frontend/src/bet/components/BetIcons.tsx`
- Create: `frontend/src/bet/components/BetHeader.tsx`
- Create: `frontend/src/bet/components/BetNav.tsx`
- Create: `frontend/src/bet/components/BetToast.tsx`
- Create: `frontend/src/bet/BetApp.tsx`
- Create: `frontend/src/bet/pages/SlipPage.tsx` (initial shell; replaced in Task 8)
- Create: `frontend/src/bet/pages/StatsPage.tsx` (initial shell; replaced in Task 10)

**Interfaces:**
- `Route = 'fan' | 'mai' | 'ledger' | 'bet'`.
- `BetApp({ onExit })`.
- `BetHeader({ onExit })`, `BetNav({ active, onNavigate })`, `BetToast({ toast, onDismiss })`.
- `BetTab = 'slip' | 'stats'`, `BetToastState = { message: string; kind: 'success' | 'error' | 'info' }`.
- `AppHeader` gains `onEnterBet: () => void`.

- [ ] **Step 1: Add the `bet` route**

In `frontend/src/hooks/useHashRoute.ts`, change:

```ts
export type Route = 'fan' | 'mai' | 'ledger' | 'bet';

const ROUTES: readonly Route[] = ['fan', 'mai', 'ledger', 'bet'];
```

- [ ] **Step 2: Add the football entry icon to the mahjong header**

In `frontend/src/components/Icons.tsx`, add:

```tsx
export function FootballIcon({ size = 20, className }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7l4.5 3.2-1.7 5.3H9.2L7.5 10.2z" />
      <path d="M12 3v4M20.5 9.5l-4 0.8M18 20l-2.6-3.4M6.6 20l2.6-3.4M3.5 9.5l4 0.8" />
    </svg>
  );
}
```

In `frontend/src/components/AppHeader.tsx`:

```tsx
import { FootballIcon, WrenchIcon } from './Icons';

interface AppHeaderProps {
  readonly todayTotal: number;
  readonly onOpenTools: () => void;
  readonly onEnterBet: () => void;
}

export function AppHeader({ todayTotal, onOpenTools, onEnterBet }: AppHeaderProps) {
  // existing tone computation stays
  return (
    <header className="app-header">
      {/* existing brand stays */}
      <div className="app-header__actions">
        <button
          type="button"
          className="app-header__mode-switch"
          aria-label="切換到賭球"
          title="賭球"
          onClick={onEnterBet}
        >
          <FootballIcon size={16} />
          <span>賭球</span>
        </button>
        <span className={`today-chip today-chip--${tone}`}>
          <span className="today-chip__label">今日</span>
          <span className="today-chip__value">{formatStatMoney(todayTotal)}</span>
        </span>
        <button type="button" className="icon-button" aria-label="工具" onClick={onOpenTools}>
          <WrenchIcon size={20} />
        </button>
      </div>
    </header>
  );
}
```

Add to `frontend/src/styles/layout.css` near `.app-header__actions`:

```css
.app-header__mode-switch {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 44px;
  padding: 0 8px;
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  background: var(--ink-850);
  border: var(--border-hairline) solid var(--line);
  border-radius: var(--radius-pill);
  white-space: nowrap;
}

.app-header__mode-switch:hover {
  color: var(--ivory);
  border-color: var(--line-strong);
}
```

At 375px the header order is brand → 賭球 pill → today chip → tools. Verify no horizontal overflow in Task 11.

- [ ] **Step 3: Create the betting icons**

Create `frontend/src/bet/components/BetIcons.tsx`:

```tsx
// biome-ignore-all lint/a11y/noSvgWithoutTitle: decorative icons are labelled by their parent controls
export interface BetIconProps {
  readonly size?: number;
  readonly className?: string;
}

function base(size: number, className?: string) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
    className,
  };
}

export function BetPitchMarkIcon({ size = 22, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4v16M3 12h18" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function BetGridIcon({ size = 16, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function BetSlipIcon({ size = 22, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z" />
      <path d="M8 7h8M8 11h6M8 15h4" />
    </svg>
  );
}

export function BetChartIcon({ size = 22, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

export function BetPlusIcon({ size = 16, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function BetXIcon({ size = 20, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function BetTrashIcon({ size = 16, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />
    </svg>
  );
}

export function BetRefreshIcon({ size = 14, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
    </svg>
  );
}

export function BetCheckIcon({ size = 18, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M4 12.5l5 5L20 6" />
    </svg>
  );
}

export function BetAlertIcon({ size = 18, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3l9 17H3z" />
      <path d="M12 9v5M12 17h.01" />
    </svg>
  );
}

export function BetInfoIcon({ size = 18, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  );
}

export function BetLoaderIcon({ size = 16, className }: BetIconProps) {
  return (
    <svg {...base(size, className)}>
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}
```

- [ ] **Step 4: Create the betting header, nav, and toast**

Create `frontend/src/bet/components/BetHeader.tsx`:

```tsx
import { BetGridIcon, BetPitchMarkIcon } from './BetIcons';

export function BetHeader({ onExit }: { readonly onExit: () => void }) {
  return (
    <header className="bet-header">
      <div className="bet-header__brand">
        <BetPitchMarkIcon size={22} className="bet-header__mark" />
        <div className="bet-header__names">
          <span className="bet-header__wordmark">Tally</span>
          <span className="bet-header__sub">賭球</span>
        </div>
      </div>
      <button type="button" className="bet-switch" onClick={onExit} aria-label="切換到麻雀">
        <BetGridIcon size={14} />
        <span>麻雀</span>
      </button>
    </header>
  );
}
```

Create `frontend/src/bet/components/BetNav.tsx`:

```tsx
import type { ComponentType } from 'react';
import { BetChartIcon, type BetIconProps, BetSlipIcon } from './BetIcons';

export type BetTab = 'slip' | 'stats';

interface Tab {
  readonly id: BetTab;
  readonly label: string;
  readonly Icon: ComponentType<BetIconProps>;
}

const TABS: readonly Tab[] = [
  { id: 'slip', label: '注單', Icon: BetSlipIcon },
  { id: 'stats', label: '統計', Icon: BetChartIcon },
];

export function BetNav({
  active,
  onNavigate,
}: {
  readonly active: BetTab;
  readonly onNavigate: (tab: BetTab) => void;
}) {
  return (
    <nav className="bet-nav" aria-label="賭球導航">
      <div className="bet-nav__inner">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`bet-nav__tab ${active === id ? 'is-active' : ''}`}
            aria-current={active === id ? 'page' : undefined}
            onClick={() => onNavigate(id)}
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
```

Create `frontend/src/bet/components/BetToast.tsx`:

```tsx
import { useEffect } from 'react';
import { BetAlertIcon, BetCheckIcon, BetInfoIcon } from './BetIcons';

export type BetToastKind = 'success' | 'error' | 'info';

export interface BetToastState {
  readonly message: string;
  readonly kind: BetToastKind;
}

export function BetToast({
  toast,
  onDismiss,
}: {
  readonly toast: BetToastState | null;
  readonly onDismiss: () => void;
}) {
  useEffect(() => {
    if (toast === null) {
      return;
    }
    const timer = window.setTimeout(onDismiss, 2500);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (toast === null) {
    return null;
  }

  const Icon =
    toast.kind === 'success' ? BetCheckIcon : toast.kind === 'error' ? BetAlertIcon : BetInfoIcon;

  return (
    <div className={`bet-toast bet-toast--${toast.kind}`} role="status" aria-live="polite">
      <Icon size={18} />
      <span>{toast.message}</span>
    </div>
  );
}
```

- [ ] **Step 5: Create the initial BetApp shell and pages**

Create `frontend/src/bet/BetApp.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { BetHeader } from './components/BetHeader';
import { BetNav, type BetTab } from './components/BetNav';
import { BetToast, type BetToastState } from './components/BetToast';
import { SlipPage } from './pages/SlipPage';
import { StatsPage } from './pages/StatsPage';
import './bet.css';

export function BetApp({ onExit }: { readonly onExit: () => void }) {
  const [tab, setTab] = useState<BetTab>('slip');
  const [toast, setToast] = useState<BetToastState | null>(null);
  const online = useOnlineStatus();

  useEffect(() => {
    document.body.classList.add('bet-mode');
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previous = meta?.content;
    if (meta !== null) {
      meta.content = '#050b14';
    }
    return () => {
      document.body.classList.remove('bet-mode');
      if (meta !== null && previous !== undefined) {
        meta.content = previous;
      }
    };
  }, []);

  return (
    <div className="bet-shell">
      <BetHeader onExit={onExit} />
      {online ? null : (
        <div className="bet-banner" role="status">
          離線模式 · 未能連線
        </div>
      )}
      <main className="bet-main">
        <div key={tab} className="bet-page-enter">
          {tab === 'slip' ? (
            <SlipPage onNotify={(message, kind) => setToast({ message, kind })} />
          ) : (
            <StatsPage />
          )}
        </div>
      </main>
      <BetNav active={tab} onNavigate={setTab} />
      <BetToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
```

Create `frontend/src/bet/pages/SlipPage.tsx` (temporary shell; Task 8 replaces the body):

```tsx
import type { BetToastKind } from '../components/BetToast';

export function SlipPage({
  onNotify,
}: {
  readonly onNotify: (message: string, kind: BetToastKind) => void;
}) {
  void onNotify;
  return (
    <div className="bet-empty">
      <p className="bet-empty__title">注單頁</p>
    </div>
  );
}
```

Create `frontend/src/bet/pages/StatsPage.tsx` (temporary shell; Task 10 replaces the body):

```tsx
export function StatsPage() {
  return (
    <div className="bet-empty">
      <p className="bet-empty__title">統計頁</p>
    </div>
  );
}
```

- [ ] **Step 6: Split the app shell**

Replace `frontend/src/App.tsx` with:

```tsx
import { useCallback, useEffect, useState } from 'react';
import { AppHeader } from './components/AppHeader';
import { InstallBanner, OfflineBanner, UpdateBanner } from './components/Banners';
import { BottomNav } from './components/BottomNav';
import { ConfirmDialog } from './components/ConfirmDialog';
import { RenameDialog } from './components/RenameDialog';
import { SwapDialog } from './components/SwapDialog';
import { TallyMark } from './components/TallyMark';
import { ToastProvider } from './components/ToastProvider';
import { type ToolAction, ToolsSheet } from './components/ToolsSheet';
import { type Route, useHashRoute } from './hooks/useHashRoute';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { fetchPlayers, isApiError } from './lib/api';
import { BetApp } from './bet/BetApp';
import { FanPage } from './pages/FanPage';
import { LedgerPage } from './pages/LedgerPage';
import { LoginPage } from './pages/LoginPage';
import { MaiPage } from './pages/MaiPage';
import { GameProvider, useGame } from './state/GameProvider';
import { useGameActions } from './state/useGameActions';

type AuthState = 'probing' | 'login' | 'ready' | 'offline';
type ToolDialog = 'none' | 'reset' | 'rename' | 'swap';

function LoadingScreen() {
  return (
    <main className="loading-screen" role="status" aria-live="polite">
      <TallyMark size={56} className="loading-screen__mark" />
      <p className="loading-screen__text">載入中…</p>
    </main>
  );
}

function MahjongShell({
  route,
  navigate,
  offline,
  onRetry,
}: {
  readonly route: Exclude<Route, 'bet'>;
  readonly navigate: (route: Route) => void;
  readonly offline: boolean;
  readonly onRetry: () => void;
}) {
  const { state } = useGame();
  const actions = useGameActions();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolDialog, setToolDialog] = useState<ToolDialog>('none');

  const handleTool = (action: ToolAction) => {
    setToolsOpen(false);
    if (action === 'undo') {
      actions.undo();
      return;
    }
    setToolDialog(action);
  };

  return (
    <div className="app-shell">
      <AppHeader
        todayTotal={state.accumulated[3]}
        onOpenTools={() => setToolsOpen(true)}
        onEnterBet={() => navigate('bet')}
      />
      <div className="banner-stack">
        <UpdateBanner />
        <OfflineBanner offline={offline} onRetry={onRetry} />
        <InstallBanner />
      </div>
      <main className="app-main">
        <div key={route} className="page-enter">
          {route === 'fan' ? <FanPage /> : null}
          {route === 'mai' ? <MaiPage /> : null}
          {route === 'ledger' ? <LedgerPage /> : null}
        </div>
      </main>
      <BottomNav active={route} onNavigate={navigate} />

      <ToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} onAction={handleTool} />

      <ConfirmDialog
        open={toolDialog === 'reset'}
        title="重設牌局"
        confirmLabel="確認重設"
        danger
        onConfirm={() => {
          actions.reset();
          setToolDialog('none');
        }}
        onClose={() => setToolDialog('none')}
      />

      <RenameDialog
        open={toolDialog === 'rename'}
        names={state.names}
        onClose={() => setToolDialog('none')}
        onSave={(names) => {
          actions.renameAll(names);
          setToolDialog('none');
        }}
      />

      <SwapDialog
        open={toolDialog === 'swap'}
        names={state.names}
        onClose={() => setToolDialog('none')}
        onSwap={(a, b) => {
          actions.swap(a, b);
          setToolDialog('none');
        }}
      />
    </div>
  );
}

function AuthenticatedApp({
  offline,
  onRetry,
}: {
  readonly offline: boolean;
  readonly onRetry: () => void;
}) {
  const { route, navigate } = useHashRoute();

  if (route === 'bet') {
    return <BetApp onExit={() => navigate('fan')} />;
  }

  return (
    <GameProvider>
      <ToastProvider>
        <MahjongShell
          route={route}
          navigate={navigate}
          offline={offline}
          onRetry={onRetry}
        />
      </ToastProvider>
    </GameProvider>
  );
}

function AppContent() {
  const [auth, setAuth] = useState<AuthState>('probing');
  const online = useOnlineStatus();

  const probe = useCallback(async () => {
    setAuth('probing');
    try {
      await fetchPlayers();
      setAuth('ready');
    } catch (caught: unknown) {
      if (isApiError(caught) && caught.status === 401) {
        setAuth('login');
      } else {
        setAuth('offline');
      }
    }
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  useEffect(() => {
    const handleUnauthorized = () => setAuth('login');
    window.addEventListener('tally:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('tally:unauthorized', handleUnauthorized);
  }, []);

  if (auth === 'probing') {
    return <LoadingScreen />;
  }

  if (auth === 'login') {
    return <LoginPage onAuthenticated={() => setAuth('ready')} />;
  }

  return <AuthenticatedApp offline={auth === 'offline' || !online} onRetry={() => void probe()} />;
}

export default function App() {
  return <AppContent />;
}
```

Note: `ToastProvider` moved inside the mahjong shell. `LoginPage` does not use toast, so this is safe.

- [ ] **Step 7: Add initial empty-state CSS**

Append to `frontend/src/bet/bet.css`:

```css
.bet-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 180px;
  padding: 24px 16px;
  text-align: center;
  background: var(--bet-surface);
  border: 1px dashed var(--bet-line-strong);
  border-radius: var(--bet-radius);
}

.bet-empty__title {
  color: var(--bet-dim);
  font-size: 14px;
  font-weight: 600;
}
```

- [ ] **Step 8: Verify the shell**

Run:

```bash
pnpm typecheck:web
pnpm build:web
pnpm lint
```

Expected: build passes; `#fan` still renders the mahjong shell; `#bet` renders the betting shell; the header switch navigates both ways; the body background and theme-color switch.

**Checkpoint:** Do not commit. Suggested later commit: `feat(bets): add separate betting shell and header switch`.

---

## Task 8: Bet Slip Page, Summary, Cards, Form, and CRUD Flow

**Files:**
- Create: `frontend/src/bet/components/BetSummary.tsx`
- Create: `frontend/src/bet/components/BetCard.tsx`
- Create: `frontend/src/bet/components/BetSheet.tsx`
- Create: `frontend/src/bet/components/BetForm.tsx`
- Create: `frontend/src/bet/components/BetConfirmDialog.tsx`
- Replace: `frontend/src/bet/pages/SlipPage.tsx`
- Modify: `frontend/src/bet/bet.css`

**Interfaces:**
- `BetSummary({ overview, loading, error, onRetry })`.
- `BetCard({ bet, onEdit, onSettle })`.
- `BetSheet({ open, title, description?, full?, onClose, children?, footer? })`.
- `BetForm({ mode, initial, saving, error, onClose, onSave, onDelete? })`.
- `BetConfirmDialog({ open, title, message, confirmLabel?, loading?, error?, onConfirm, onClose })`.
- `SlipPage({ onNotify })` now performs list/overview fetch, create/edit/delete, filters, pagination.

- [ ] **Step 1: Create the summary component**

Create `frontend/src/bet/components/BetSummary.tsx`:

```tsx
import type { BetOverview } from '../types';
import { formatBetMoney, formatStake } from '../lib/format';
import { BetRefreshIcon } from './BetIcons';

function toneOf(value: number): string {
  if (value === 0) {
    return 'is-zero';
  }
  return value > 0 ? 'is-win' : 'is-loss';
}

export function BetSummary({
  overview,
  loading,
  error,
  onRetry,
}: {
  readonly overview: BetOverview | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
}) {
  const today = overview?.today;
  const month = overview?.month;
  const pending = overview?.pending;

  return (
    <section className="bet-summary" aria-label="投注摘要" aria-busy={loading}>
      <div className="bet-summary__cell">
        <span className="bet-summary__label">今日輸贏</span>
        <span className={`bet-summary__value ${today === undefined ? 'is-zero' : toneOf(today.profit)}`}>
          {today === undefined ? '—' : formatBetMoney(today.profit)}
        </span>
      </div>
      <div className="bet-summary__cell">
        <span className="bet-summary__label">本月輸贏</span>
        <span className={`bet-summary__value ${month === undefined ? 'is-zero' : toneOf(month.profit)}`}>
          {month === undefined ? '—' : formatBetMoney(month.profit)}
        </span>
      </div>
      <div className="bet-summary__cell">
        <span className="bet-summary__label">待結算</span>
        <span className="bet-summary__value is-pending">
          {pending === undefined ? '—' : `${pending.count} 注`}
        </span>
        <span className="bet-summary__meta">
          {pending === undefined ? '' : formatStake(pending.stake)}
        </span>
      </div>
      {error === null ? null : (
        <button type="button" className="bet-summary__retry" onClick={onRetry}>
          <BetRefreshIcon size={14} />
          重試
        </button>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Create the bet card**

Create `frontend/src/bet/components/BetCard.tsx`:

```tsx
import { formatTimeHK } from '../../lib/date';
import type { BetItem } from '../types';
import {
  betTypeLabel,
  formatBetMoney,
  formatOdds,
  formatStake,
  marketLabel,
  profitTone,
  resultLabel,
} from '../lib/format';

export function BetCard({
  bet,
  onEdit,
  onSettle,
}: {
  readonly bet: BetItem;
  readonly onEdit: () => void;
  readonly onSettle: () => void;
}) {
  const time = formatTimeHK(new Date(bet.recordedAt));
  const firstMatch = bet.legs[0]?.match ?? '注單';

  return (
    <article className={`bet-card ${bet.result === 'pending' ? 'bet-card--pending' : ''}`}>
      <button
        type="button"
        className="bet-card__main"
        aria-label={`編輯注單：${firstMatch}`}
        onClick={onEdit}
      >
        <span className="bet-card__top">
          <span className="bet-type">{betTypeLabel(bet.legs.length)}</span>
          <span className="bet-card__time">{time}</span>
          <span className={`bet-result bet-result--${bet.result}`}>{resultLabel(bet.result)}</span>
        </span>

        <span className="bet-legs">
          {bet.legs.map((leg) => (
            <span className="bet-leg" key={leg.position}>
              <span className="bet-leg__index">{String(leg.position).padStart(2, '0')}</span>
              <span className="bet-leg__body">
                <span className="bet-leg__meta">
                  {marketLabel(leg.market)} · @{formatOdds(leg.odds)}
                </span>
                <span className="bet-leg__match">{leg.match}</span>
                <span className="bet-leg__selection">{leg.selection}</span>
              </span>
            </span>
          ))}
        </span>

        <span className="bet-card__foot">
          <span className="bet-card__stake">注碼 {formatStake(bet.stake)}</span>
          <span className="bet-card__odds">總賠率 {formatOdds(bet.totalOdds)}</span>
          <span className={`bet-card__profit ${profitTone(bet.profit)}`}>
            {bet.profit === null ? '待結算' : formatBetMoney(bet.profit)}
          </span>
        </span>
      </button>

      {bet.result === 'pending' ? (
        <button type="button" className="bet-card__settle" onClick={onSettle}>
          結算
        </button>
      ) : null}
    </article>
  );
}
```

- [ ] **Step 3: Create the betting sheet**

Create `frontend/src/bet/components/BetSheet.tsx`:

```tsx
import { type MouseEvent, type ReactNode, useEffect, useId, useRef } from 'react';
import { BetXIcon } from './BetIcons';

interface BetSheetProps {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string | undefined;
  readonly full?: boolean;
  readonly onClose: () => void;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
}

export function BetSheet({
  open,
  title,
  description,
  full = false,
  onClose,
  children,
  footer,
}: BetSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      document.body.classList.add('bet-sheet-open');
      window.requestAnimationFrame(() => {
        if (panelRef.current !== null) {
          panelRef.current.scrollTop = 0;
        }
      });
    }
    if (!open && dialog.open) {
      dialog.close();
      document.body.classList.remove('bet-sheet-open');
    }
    return () => {
      if (dialog.open) {
        dialog.close();
      }
      document.body.classList.remove('bet-sheet-open');
    };
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  const handleBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={`bet-sheet ${full ? 'bet-sheet--full' : ''}`}
      aria-labelledby={titleId}
      aria-describedby={description === undefined ? undefined : descriptionId}
      onClick={handleBackdrop}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div ref={panelRef} className="bet-sheet__panel">
        <div className="bet-sheet__handle" aria-hidden="true" />
        <header className="bet-sheet__header">
          <div>
            <h2 id={titleId} className="bet-sheet__title">
              {title}
            </h2>
            {description === undefined ? null : (
              <p id={descriptionId} className="bet-sheet__description">
                {description}
              </p>
            )}
          </div>
          <button type="button" className="bet-icon-button" aria-label="關閉" onClick={onClose}>
            <BetXIcon size={20} />
          </button>
        </header>
        {children === undefined || children === null ? null : (
          <div className="bet-sheet__body">{children}</div>
        )}
        {footer === undefined ? null : <footer className="bet-sheet__footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
```

- [ ] **Step 4: Create the bet form**

Create `frontend/src/bet/components/BetForm.tsx`:

```tsx
import { type FormEvent, useId, useState } from 'react';
import type { BetDraft, BetMarket, BetPayload, BetResult } from '../types';
import { formatBetMoney, formatStake } from '../lib/format';
import { parseDraft } from '../lib/form';
import { computePotentialReturn, computeProfit } from '../lib/profit';
import { BetLoaderIcon, BetPlusIcon, BetTrashIcon } from './BetIcons';
import { BetSheet } from './BetSheet';

const MARKETS: readonly { id: BetMarket; label: string }[] = [
  { id: '1x2', label: '主客和' },
  { id: 'handicap', label: '讓球' },
  { id: 'totals', label: '大細' },
  { id: 'other', label: '其他' },
];

const RESULTS: readonly { id: BetResult; label: string }[] = [
  { id: 'pending', label: '未開' },
  { id: 'win', label: '贏' },
  { id: 'half_win', label: '半贏' },
  { id: 'push', label: '走水' },
  { id: 'half_loss', label: '半輸' },
  { id: 'loss', label: '輸' },
];

interface BetFormProps {
  readonly mode: 'create' | 'edit';
  readonly initial: BetDraft;
  readonly saving: boolean;
  readonly error: string | null;
  readonly onClose: () => void;
  readonly onSave: (payload: BetPayload) => void;
  readonly onDelete?: (() => void) | undefined;
}

export function BetForm({
  mode,
  initial,
  saving,
  error,
  onClose,
  onSave,
  onDelete,
}: BetFormProps) {
  const [draft, setDraft] = useState<BetDraft>(initial);
  const [attempted, setAttempted] = useState(false);
  const formId = useId();
  const parsed = parseDraft(draft);

  const showError = (message: string | undefined) =>
    attempted && message !== undefined ? (
      <span className="bet-field__error" role="alert">
        {message}
      </span>
    ) : null;

  const updateLeg = (index: number, patch: Partial<BetDraft['legs'][number]>) => {
    setDraft((current) => ({
      ...current,
      legs: current.legs.map((leg, legIndex) =>
        legIndex === index ? { ...leg, ...patch } : leg,
      ),
    }));
  };

  const addLeg = () => {
    if (draft.legs.length >= 8) {
      return;
    }
    setDraft((current) => ({
      ...current,
      legs: [...current.legs, { match: '', market: '1x2', selection: '', odds: '' }],
    }));
  };

  const removeLeg = (index: number) => {
    if (draft.legs.length <= 1) {
      return;
    }
    setDraft((current) => ({
      ...current,
      legs: current.legs.filter((_, legIndex) => legIndex !== index),
    }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAttempted(true);
    if (parsed.payload === null || saving) {
      return;
    }
    onSave(parsed.payload);
  };

  const stakeValue = Number(draft.stake);
  const validStake = parsed.errors.stake === undefined;
  const previewProfit =
    parsed.totalOdds !== null && validStake
      ? computeProfit(stakeValue, parsed.totalOdds, draft.result)
      : null;
  const potentialReturn =
    parsed.totalOdds !== null && validStake
      ? computePotentialReturn(stakeValue, parsed.totalOdds)
      : null;

  return (
    <BetSheet
      open
      full
      title={mode === 'create' ? '新增注單' : '編輯注單'}
      onClose={onClose}
      footer={
        <>
          {onDelete === undefined ? null : (
            <button
              type="button"
              className="bet-button bet-button--danger-ghost"
              onClick={onDelete}
              disabled={saving}
            >
              <BetTrashIcon size={15} />
              刪除
            </button>
          )}
          <div className="bet-sheet__footer-spacer" />
          <button
            type="button"
            className="bet-button bet-button--ghost"
            onClick={onClose}
            disabled={saving}
          >
            取消
          </button>
          <button
            type="submit"
            form={formId}
            className="bet-button bet-button--primary"
            disabled={saving}
          >
            {saving ? <BetLoaderIcon size={16} className="bet-spin" /> : null}
            {saving ? '儲存中…' : '儲存'}
          </button>
        </>
      }
    >
      <form id={formId} className="bet-form" onSubmit={handleSubmit} noValidate>
        {error === null ? null : (
          <p className="bet-form__server-error" role="alert">
            {error}
          </p>
        )}

        <label className="bet-field">
          <span className="bet-field__label">日期</span>
          <input
            type="date"
            className="bet-field__input"
            value={draft.date}
            onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
            required
          />
          {showError(parsed.errors.date)}
        </label>

        <div className="bet-form__legs">
          {draft.legs.map((leg, index) => (
            <fieldset className="bet-leg-form" key={index}>
              <legend className="bet-leg-form__legend">
                第 {index + 1} 場
                {draft.legs.length > 1 ? (
                  <button
                    type="button"
                    className="bet-leg-form__remove"
                    onClick={() => removeLeg(index)}
                    aria-label={`移除第 ${index + 1} 場`}
                  >
                    <BetTrashIcon size={14} />
                    移除
                  </button>
                ) : null}
              </legend>

              <label className="bet-field">
                <span className="bet-field__label">賽事</span>
                <input
                  className="bet-field__input"
                  value={leg.match}
                  onChange={(event) => updateLeg(index, { match: event.target.value })}
                  placeholder="曼聯 vs 車路士"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={80}
                  required
                />
                {showError(parsed.errors.legs[index]?.match)}
              </label>

              <div className="bet-market-chips" role="group" aria-label={`第 ${index + 1} 場盤口`}>
                {MARKETS.map((market) => (
                  <button
                    key={market.id}
                    type="button"
                    className={`bet-chip ${leg.market === market.id ? 'is-selected' : ''}`}
                    aria-pressed={leg.market === market.id}
                    onClick={() => updateLeg(index, { market: market.id })}
                  >
                    {market.label}
                  </button>
                ))}
              </div>

              <label className="bet-field">
                <span className="bet-field__label">選擇</span>
                <input
                  className="bet-field__input"
                  value={leg.selection}
                  onChange={(event) => updateLeg(index, { selection: event.target.value })}
                  placeholder="曼聯 -0.5"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={60}
                  required
                />
                {showError(parsed.errors.legs[index]?.selection)}
              </label>

              <label className="bet-field">
                <span className="bet-field__label">賠率</span>
                <input
                  className="bet-field__input bet-field__input--number"
                  value={leg.odds}
                  onChange={(event) => updateLeg(index, { odds: event.target.value })}
                  placeholder="1.95"
                  inputMode="decimal"
                  autoComplete="off"
                  required
                />
                {showError(parsed.errors.legs[index]?.odds)}
              </label>
            </fieldset>
          ))}

          <button
            type="button"
            className="bet-button bet-button--outline bet-button--block"
            onClick={addLeg}
            disabled={draft.legs.length >= 8}
          >
            <BetPlusIcon size={15} />
            {draft.legs.length >= 8 ? '最多 8 場' : '加一場'}
          </button>
        </div>

        <div className="bet-total-odds">
          <span className="bet-total-odds__label">總賠率</span>
          <span className="bet-total-odds__value">
            {parsed.totalOdds === null ? '—' : parsed.totalOdds.toFixed(2)}
          </span>
          {showError(parsed.errors.totalOdds)}
        </div>

        <label className="bet-field">
          <span className="bet-field__label">注碼</span>
          <input
            className="bet-field__input bet-field__input--number"
            value={draft.stake}
            onChange={(event) => setDraft((current) => ({ ...current, stake: event.target.value }))}
            placeholder="500"
            inputMode="decimal"
            autoComplete="off"
            required
          />
          {showError(parsed.errors.stake)}
        </label>

        <div className="bet-form__result">
          <span className="bet-field__label">結果</span>
          <div className="bet-result-chips" role="group" aria-label="投注結果">
            {RESULTS.map((result) => (
              <button
                key={result.id}
                type="button"
                className={`bet-chip ${draft.result === result.id ? 'is-selected' : ''}`}
                aria-pressed={draft.result === result.id}
                onClick={() => setDraft((current) => ({ ...current, result: result.id }))}
              >
                {result.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bet-preview" aria-live="polite">
          <span className="bet-preview__label">
            {draft.result === 'pending' ? '待結算' : '輸贏預覽'}
          </span>
          <span
            className={`bet-preview__value ${
              draft.result === 'pending'
                ? 'is-pending'
                : previewProfit !== null && previewProfit > 0
                  ? 'is-win'
                  : previewProfit !== null && previewProfit < 0
                    ? 'is-loss'
                    : 'is-zero'
            }`}
          >
            {draft.result === 'pending'
              ? potentialReturn === null
                ? '—'
                : `潛在回報 ${formatStake(potentialReturn)}`
              : previewProfit === null
                ? '—'
                : formatBetMoney(previewProfit)}
          </span>
        </div>
      </form>
    </BetSheet>
  );
}
```

- [ ] **Step 5: Create the confirm dialog**

Create `frontend/src/bet/components/BetConfirmDialog.tsx`:

```tsx
import { BetLoaderIcon } from './BetIcons';
import { BetSheet } from './BetSheet';

export function BetConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '確認刪除',
  loading = false,
  error = null,
  onConfirm,
  onClose,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly loading?: boolean;
  readonly error?: string | null;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}) {
  return (
    <BetSheet
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="bet-button bet-button--ghost"
            onClick={onClose}
            disabled={loading}
          >
            取消
          </button>
          <button
            type="button"
            className="bet-button bet-button--danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <BetLoaderIcon size={16} className="bet-spin" /> : null}
            {loading ? '處理中…' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="bet-confirm__message">{message}</p>
      {error === null ? null : (
        <p className="bet-confirm__error" role="alert">
          {error}
        </p>
      )}
    </BetSheet>
  );
}
```

- [ ] **Step 6: Replace the slip page with the full CRUD flow**

Replace `frontend/src/bet/pages/SlipPage.tsx` with:

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { messageOf } from '../../hooks/useAsync';
import { formatDateLong, groupByDate, hkToday } from '../../lib/date';
import { createBet, deleteBet, fetchBetOverview, fetchBets, updateBet } from '../api';
import { BetCard } from '../components/BetCard';
import { BetConfirmDialog } from '../components/BetConfirmDialog';
import { BetForm } from '../components/BetForm';
import { BetSummary } from '../components/BetSummary';
import type { BetToastKind } from '../components/BetToast';
import { draftFromBet, emptyDraft } from '../lib/form';
import type { BetItem, BetOverview, BetPayload, BetStatusFilter } from '../types';

type FormState =
  | { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly bet: BetItem };

const FILTERS: readonly { id: BetStatusFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'pending', label: '待結算' },
  { id: 'settled', label: '已結算' },
];

export function SlipPage({
  onNotify,
}: {
  readonly onNotify: (message: string, kind: BetToastKind) => void;
}) {
  const [status, setStatus] = useState<BetStatusFilter>('all');
  const [items, setItems] = useState<BetItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [overview, setOverview] = useState<BetOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BetItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadSeq = useRef(0);
  const overviewSeq = useRef(0);

  const loadOverview = useCallback(async () => {
    const seq = ++overviewSeq.current;
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const data = await fetchBetOverview();
      if (seq !== overviewSeq.current) {
        return;
      }
      setOverview(data);
    } catch (caught: unknown) {
      if (seq !== overviewSeq.current) {
        return;
      }
      setOverviewError(messageOf(caught));
    } finally {
      if (seq === overviewSeq.current) {
        setOverviewLoading(false);
      }
    }
  }, []);

  const loadFirst = useCallback(
    async (showLoading = true) => {
      const seq = ++loadSeq.current;
      if (showLoading) {
        setListLoading(true);
      }
      setListError(null);
      try {
        const response = await fetchBets({ status });
        if (seq !== loadSeq.current) {
          return;
        }
        setItems(response.items);
        setNextCursor(response.nextCursor);
      } catch (caught: unknown) {
        if (seq !== loadSeq.current) {
          return;
        }
        setListError(messageOf(caught));
      } finally {
        if (seq === loadSeq.current) {
          setListLoading(false);
        }
      }
    },
    [status],
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    void loadFirst();
  }, [loadFirst]);

  const loadMore = async () => {
    if (nextCursor === null || loadingMore) {
      return;
    }
    const seq = loadSeq.current;
    setLoadingMore(true);
    setListError(null);
    try {
      const response = await fetchBets({ status, cursor: nextCursor });
      if (seq !== loadSeq.current) {
        return;
      }
      setItems((current) => [...current, ...response.items]);
      setNextCursor(response.nextCursor);
    } catch (caught: unknown) {
      if (seq !== loadSeq.current) {
        return;
      }
      setListError(messageOf(caught));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSave = async (payload: BetPayload) => {
    if (form === null) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (form.mode === 'edit') {
        await updateBet(form.bet.id, payload);
      } else {
        await createBet(payload);
      }
      const message = form.mode === 'edit' ? '注單已更新' : '注單已新增';
      setForm(null);
      onNotify(message, 'success');
      await Promise.all([loadFirst(false), loadOverview()]);
    } catch (caught: unknown) {
      setSaveError(messageOf(caught));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting === null) {
      return;
    }
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteBet(deleting.id);
      setDeleting(null);
      setForm(null);
      onNotify('注單已刪除', 'success');
      await Promise.all([loadFirst(false), loadOverview()]);
    } catch (caught: unknown) {
      setDeleteError(messageOf(caught));
    } finally {
      setDeleteLoading(false);
    }
  };

  const groups = groupByDate(items);
  const initialDraft =
    form === null
      ? null
      : form.mode === 'edit'
        ? draftFromBet(form.bet)
        : emptyDraft(hkToday());

  return (
    <div className="bet-slip">
      <BetSummary
        overview={overview}
        loading={overviewLoading}
        error={overviewError}
        onRetry={() => void loadOverview()}
      />

      <button
        type="button"
        className="bet-cta"
        onClick={() => {
          setSaveError(null);
          setForm({ mode: 'create' });
        }}
      >
        新增注單
      </button>

      <div className="bet-filters" role="group" aria-label="注單篩選">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            aria-pressed={status === filter.id}
            className={`bet-filters__item ${status === filter.id ? 'is-selected' : ''}`}
            onClick={() => setStatus(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {listLoading && items.length === 0 ? (
        <div className="bet-skeleton-stack" aria-hidden="true">
          {['a', 'b', 'c'].map((key) => (
            <div className="bet-skeleton" key={key} />
          ))}
        </div>
      ) : null}

      {!listLoading && listError !== null && items.length === 0 ? (
        <div className="bet-empty">
          <p className="bet-empty__title">載入失敗</p>
          <p className="bet-empty__description">{listError}</p>
          <button
            type="button"
            className="bet-button bet-button--outline"
            onClick={() => void loadFirst()}
          >
            重試
          </button>
        </div>
      ) : null}

      {!listLoading && listError === null && items.length === 0 ? (
        <div className="bet-empty">
          <p className="bet-empty__title">未有注單</p>
          <p className="bet-empty__description">新增第一張注單，之後可在這裡補上結果。</p>
          <button
            type="button"
            className="bet-button bet-button--primary"
            onClick={() => {
              setSaveError(null);
              setForm({ mode: 'create' });
            }}
          >
            新增第一張
          </button>
        </div>
      ) : null}

      {groups.map((group) => (
        <section className="bet-date-group" key={group.date}>
          <header className="bet-date-group__header">
            <h2>{formatDateLong(group.date)}</h2>
          </header>
          <div className="bet-date-group__list">
            {group.records.map((bet) => (
              <BetCard
                key={bet.id}
                bet={bet}
                onEdit={() => {
                  setSaveError(null);
                  setForm({ mode: 'edit', bet });
                }}
                onSettle={() => {
                  setSaveError(null);
                  setForm({ mode: 'edit', bet });
                }}
              />
            ))}
          </div>
        </section>
      ))}

      {listError !== null && items.length > 0 ? (
        <div className="bet-inline-error" role="alert">
          <span>{listError}</span>
          <button type="button" className="bet-button bet-button--ghost" onClick={() => void loadFirst()}>
            重試
          </button>
        </div>
      ) : null}

      {nextCursor === null ? null : (
        <button
          type="button"
          className="bet-button bet-button--outline bet-button--block"
          onClick={() => void loadMore()}
          disabled={loadingMore}
        >
          {loadingMore ? '載入中…' : '載入更多'}
        </button>
      )}

      {form === null || initialDraft === null ? null : (
        <BetForm
          key={form.mode === 'edit' ? form.bet.id : 'new'}
          mode={form.mode}
          initial={initialDraft}
          saving={saving}
          error={saveError}
          onClose={() => {
            if (!saving) {
              setForm(null);
              setSaveError(null);
            }
          }}
          onSave={(payload) => void handleSave(payload)}
          onDelete={
            form.mode === 'edit'
              ? () => {
                  setDeleteError(null);
                  setDeleting(form.bet);
                }
              : undefined
          }
        />
      )}

      <BetConfirmDialog
        open={deleting !== null}
        title="刪除注單"
        message="確定刪除這張注單？此操作無法復原。"
        loading={deleteLoading}
        error={deleteError}
        onClose={() => {
          if (!deleteLoading) {
            setDeleting(null);
            setDeleteError(null);
          }
        }}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
```

- [ ] **Step 7: Add the slip, card, form, and sheet styles**

Append the component styles to `frontend/src/bet/bet.css`. Use these exact selectors and the `--bet-*` tokens; every class used above must be present:

```css
.bet-slip {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bet-summary {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  background: var(--bet-line);
  border: 1px solid var(--bet-line);
  border-radius: var(--bet-radius);
}

.bet-summary__cell {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  padding: 12px 10px;
  background: var(--bet-surface);
}

.bet-summary__label {
  color: var(--bet-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.bet-summary__value {
  overflow: hidden;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bet-summary__value.is-win,
.bet-card__profit.is-win,
.bet-preview__value.is-win {
  color: var(--bet-win);
}

.bet-summary__value.is-loss,
.bet-card__profit.is-loss,
.bet-preview__value.is-loss {
  color: var(--bet-loss);
}

.bet-summary__value.is-pending,
.bet-preview__value.is-pending {
  color: var(--bet-pending);
}

.bet-summary__value.is-zero,
.bet-card__profit.is-zero,
.bet-preview__value.is-zero {
  color: var(--bet-dim);
}

.bet-summary__meta {
  overflow: hidden;
  color: var(--bet-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bet-summary__retry {
  grid-column: 1 / -1;
  min-height: 44px;
  padding: 6px 10px;
  color: var(--bet-pending);
  font-size: 11px;
  background: rgba(255, 200, 87, 0.06);
  border: 0;
  border-top: 1px solid rgba(255, 200, 87, 0.18);
}

.bet-cta {
  width: 100%;
  min-height: 52px;
  color: var(--bet-volt-ink);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.02em;
  background: var(--bet-volt);
  border: 0;
  border-radius: var(--bet-radius);
}

.bet-cta:active {
  transform: translateY(1px);
}

.bet-filters {
  display: flex;
  gap: 6px;
}

.bet-filters__item {
  flex: 1;
  min-height: 44px;
  padding: 0 8px;
  color: var(--bet-muted);
  font-size: 12px;
  font-weight: 600;
  background: transparent;
  border: 1px solid var(--bet-line);
  border-radius: 999px;
}

.bet-filters__item.is-selected {
  color: var(--bet-volt);
  background: var(--bet-glow);
  border-color: rgba(216, 255, 79, 0.45);
}

.bet-date-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bet-date-group__header h2 {
  color: var(--bet-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.bet-date-group__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bet-card {
  position: relative;
  overflow: hidden;
  background: var(--bet-surface);
  border: 1px solid var(--bet-line);
  border-radius: var(--bet-radius);
}

.bet-card__main {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  padding: 12px 14px;
  color: var(--bet-text);
  text-align: left;
  background: transparent;
  border: 0;
}

.bet-card__top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.bet-type {
  flex: none;
  padding: 2px 6px;
  color: var(--bet-volt);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  background: var(--bet-glow);
  border: 1px solid rgba(216, 255, 79, 0.28);
  border-radius: 4px;
}

.bet-card__time {
  flex: 1;
  min-width: 0;
  color: var(--bet-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10px;
}

.bet-result {
  flex: none;
  padding: 2px 7px;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10px;
  font-weight: 700;
  border: 1px solid currentColor;
  border-radius: 999px;
}

.bet-result--pending {
  color: var(--bet-pending);
  background: rgba(255, 200, 87, 0.08);
}

.bet-result--win,
.bet-result--half_win {
  color: var(--bet-win);
  background: rgba(94, 230, 168, 0.08);
}

.bet-result--loss,
.bet-result--half_loss {
  color: var(--bet-loss);
  background: rgba(255, 107, 107, 0.08);
}

.bet-result--push {
  color: var(--bet-push);
  background: rgba(159, 176, 191, 0.08);
}

.bet-legs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bet-leg {
  display: flex;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--bet-line);
}

.bet-leg:first-child {
  padding-top: 0;
  border-top: 0;
}

.bet-leg__index {
  flex: none;
  width: 20px;
  color: var(--bet-volt);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10px;
  font-weight: 700;
  padding-top: 2px;
}

.bet-leg__body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.bet-leg__meta {
  color: var(--bet-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10px;
}

.bet-leg__match {
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bet-leg__selection {
  color: var(--bet-dim);
  font-size: 12px;
}

.bet-card__foot {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--bet-line);
}

.bet-card__stake,
.bet-card__odds {
  color: var(--bet-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 11px;
  white-space: nowrap;
}

.bet-card__odds {
  flex: 1;
}

.bet-card__profit {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.bet-card__settle {
  position: absolute;
  right: 0;
  bottom: 0;
  min-height: 44px;
  padding: 0 12px;
  color: var(--bet-volt);
  font-size: 11px;
  font-weight: 700;
  background: transparent;
  border: 0;
}

.bet-card--pending {
  padding-bottom: 44px;
}

.bet-empty__description {
  color: var(--bet-muted);
  font-size: 12px;
}

.bet-skeleton-stack {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bet-skeleton {
  height: 132px;
  background: linear-gradient(
    100deg,
    var(--bet-surface) 30%,
    var(--bet-raised) 50%,
    var(--bet-surface) 70%
  );
  background-size: 200% 100%;
  border: 1px solid var(--bet-line);
  border-radius: var(--bet-radius);
  animation: bet-skeleton-shimmer 1.4s linear infinite;
}

@keyframes bet-skeleton-shimmer {
  to {
    background-position: -200% 0;
  }
}

.bet-inline-error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  color: var(--bet-loss);
  font-size: 12px;
  background: rgba(255, 107, 107, 0.08);
  border: 1px solid rgba(255, 107, 107, 0.24);
  border-radius: 8px;
}

.bet-sheet__footer-spacer {
  flex: 1;
}

.bet-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.bet-form__server-error {
  padding: 8px 10px;
  color: var(--bet-loss);
  font-size: 12px;
  background: rgba(255, 107, 107, 0.08);
  border: 1px solid rgba(255, 107, 107, 0.24);
  border-radius: 8px;
}

.bet-form__legs {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bet-leg-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--bet-raised);
  border: 1px solid var(--bet-line);
  border-radius: 10px;
}

.bet-leg-form__legend {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0;
  color: var(--bet-volt);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.bet-leg-form__remove {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-height: 44px;
  color: var(--bet-loss);
  font-size: 10px;
  background: transparent;
  border: 0;
}

.bet-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.bet-field__label {
  color: var(--bet-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.bet-field__input {
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  color: var(--bet-text);
  font-size: 16px;
  background: var(--bet-surface);
  border: 1px solid var(--bet-line);
  border-radius: 8px;
}

.bet-field__input--number {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-variant-numeric: tabular-nums;
}

.bet-field__input:focus {
  border-color: var(--bet-volt);
}

.bet-field__error {
  color: var(--bet-loss);
  font-size: 11px;
}

.bet-market-chips,
.bet-result-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.bet-chip {
  min-height: 44px;
  padding: 0 10px;
  color: var(--bet-muted);
  font-size: 12px;
  font-weight: 600;
  background: var(--bet-surface);
  border: 1px solid var(--bet-line);
  border-radius: 999px;
}

.bet-chip.is-selected {
  color: var(--bet-volt);
  background: var(--bet-glow);
  border-color: rgba(216, 255, 79, 0.5);
}

.bet-total-odds {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bet-raised);
  border: 1px solid var(--bet-line-strong);
  border-radius: 10px;
}

.bet-total-odds__label {
  color: var(--bet-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.bet-total-odds__value {
  color: var(--bet-volt);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 24px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.bet-form__result {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.bet-preview {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bet-surface);
  border: 1px dashed var(--bet-line-strong);
  border-radius: 10px;
}

.bet-preview__label {
  color: var(--bet-muted);
  font-size: 11px;
}

.bet-preview__value {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 15px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.bet-confirm__message {
  color: var(--bet-dim);
  font-size: 14px;
  line-height: 1.6;
}

.bet-confirm__error {
  margin-top: 8px;
  color: var(--bet-loss);
  font-size: 12px;
}
```

- [ ] **Step 8: Verify the slip flow**

Run:

```bash
pnpm typecheck:web
pnpm build:web
pnpm lint
pnpm test:web
```

Expected: typecheck/build/test pass.

Manual/browser check (with a local backend or mocked API):
1. `#bet` shows the summary, CTA, filters, and empty state.
2. `新增注單` opens a full-screen sheet; adding a second leg updates the total odds and type badge preview.
3. Saving a pending single shows a card with `待結算`; tapping `結算` opens the same sheet; choosing `贏` and saving updates the profit.
4. Editing legs/stake/result recomputes; deleting asks for confirmation and removes the card.
5. Filter chips reload the list; `載入更多` appends.
6. 375px: no horizontal overflow, inputs are 16px, footer stays visible.

**Checkpoint:** Do not commit. Suggested later commit: `feat(bets): add slip page, form, and CRUD flow`.

---

## Task 9: Betting Stats Page

**Files:**
- Replace: `frontend/src/bet/pages/StatsPage.tsx`
- Modify: `frontend/src/bet/bet.css`

**Interfaces:**
- `StatsPage()` fetches `/api/bets/stats?period=month|year|all`, renders period chips, hero P&L, KPI grid, type split, single-only market bars, 6-month CSS bars, and biggest win/loss.
- No new API or type changes.

- [ ] **Step 1: Replace the stats page**

Replace `frontend/src/bet/pages/StatsPage.tsx` with:

```tsx
import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { formatDateSlash } from '../../lib/date';
import { fetchBetStats } from '../api';
import type { BetPeriod, BetStats } from '../types';
import {
  formatBetMoney,
  formatOdds,
  formatPercent,
  formatSignedNumber,
  formatStake,
  marketLabel,
  profitTone,
} from '../lib/format';

const PERIODS: readonly { id: BetPeriod; label: string }[] = [
  { id: 'month', label: '本月' },
  { id: 'year', label: '今年' },
  { id: 'all', label: '全部' },
];

function periodLabel(period: BetPeriod): string {
  return period === 'month' ? '本月' : period === 'year' ? '今年' : '全部';
}

function Kpi({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone?: string | undefined;
}) {
  return (
    <div className="bet-kpi">
      <span className="bet-kpi__label">{label}</span>
      <span className={`bet-kpi__value ${tone ?? ''}`}>{value}</span>
    </div>
  );
}

function StatsContent({ stats }: { readonly stats: BetStats }) {
  const { totals } = stats;
  const maxMarket = Math.max(1, ...stats.byMarket.map((row) => Math.abs(row.profit)));
  const maxMonth = Math.max(1, ...stats.monthly.map((point) => Math.abs(point.profit)));

  return (
    <>
      <div className="bet-stats-hero">
        <span className="bet-stats-hero__label">{periodLabel(stats.period)}輸贏</span>
        <span className={`bet-stats-hero__value ${profitTone(totals.profit)}`}>
          {formatBetMoney(totals.profit)}
        </span>
        <span className="bet-stats-hero__meta">
          ROI {formatPercent(totals.roi)} · 已結算注碼 {formatStake(totals.settledStake)}
        </span>
      </div>

      <div className="bet-kpi-grid">
        <Kpi label="勝率" value={formatPercent(totals.winRate)} />
        <Kpi label="平均賠率" value={formatOdds(totals.avgOdds)} />
        <Kpi label="已結算注數" value={`${totals.settledBets}`} />
        <Kpi
          label="本期待結算"
          value={`${totals.pendingCount} 注`}
          tone={totals.pendingCount > 0 ? 'is-pending' : undefined}
        />
      </div>

      {totals.pendingStake === 0 ? null : (
        <p className="bet-stats__pending">
          本期待結算注碼 {formatStake(totals.pendingStake)}
        </p>
      )}

      <section className="bet-stats-section" aria-labelledby="bet-type-title">
        <div className="bet-stats-section__header">
          <h2 id="bet-type-title">單場 / 過關</h2>
        </div>
        <div className="bet-type-list">
          {stats.byType.map((row) => (
            <div className="bet-type-row" key={row.type}>
              <span className="bet-type-row__label">
                {row.type === 'single' ? '單場' : '過關'}
              </span>
              <span className="bet-type-row__meta">
                {row.bets} 注 · {formatStake(row.stake)}
              </span>
              <span className={`bet-type-row__profit ${profitTone(row.profit)}`}>
                {formatBetMoney(row.profit)}
              </span>
              <span className="bet-type-row__roi">ROI {formatPercent(row.roi)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bet-stats-section" aria-labelledby="bet-market-title">
        <div className="bet-stats-section__header">
          <h2 id="bet-market-title">盤口分佈</h2>
          <span className="bet-stats-section__note">只計單場</span>
        </div>
        {stats.byMarket.length === 0 ? (
          <p className="bet-stats__hint">未有已結算單場注單。</p>
        ) : (
          <div className="bet-market-list">
            {stats.byMarket.map((row) => (
              <div className="bet-market-row" key={row.market}>
                <span className="bet-market-row__label">{marketLabel(row.market)}</span>
                <span className="bet-market-row__bar" aria-hidden="true">
                  <span
                    className={`bet-market-row__fill ${profitTone(row.profit)}`}
                    style={{ width: `${(Math.abs(row.profit) / maxMarket) * 100}%` }}
                  />
                </span>
                <span className={`bet-market-row__profit ${profitTone(row.profit)}`}>
                  {formatBetMoney(row.profit)}
                </span>
                <span className="bet-market-row__meta">
                  {row.bets} 注 · {formatStake(row.stake)} · ROI {formatPercent(row.roi)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bet-stats-section" aria-labelledby="bet-month-title">
        <div className="bet-stats-section__header">
          <h2 id="bet-month-title">近 6 個月</h2>
        </div>
        <div className="bet-month-chart" role="img" aria-label="近 6 個月輸贏柱狀圖">
          {stats.monthly.map((point) => {
            const height =
              point.profit === 0 ? 0 : Math.max((Math.abs(point.profit) / maxMonth) * 50, 3);
            return (
              <div className="bet-month" key={point.month}>
                <span className={`bet-month__value ${profitTone(point.profit)}`}>
                  {formatSignedNumber(point.profit)}
                </span>
                <span className="bet-month__plot">
                  <span
                    className={`bet-month__bar ${profitTone(point.profit)}`}
                    style={{ height: `${height}%` }}
                  />
                </span>
                <span className="bet-month__label">{point.month.slice(5)}月</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bet-stats-section" aria-labelledby="bet-biggest-title">
        <div className="bet-stats-section__header">
          <h2 id="bet-biggest-title">最大單筆</h2>
        </div>
        <div className="bet-biggest">
          <div className="bet-biggest__card">
            <span className="bet-biggest__label">最大贏</span>
            <span className="bet-biggest__value is-win">
              {stats.biggestWin === null ? '—' : formatBetMoney(stats.biggestWin.profit)}
            </span>
            <span className="bet-biggest__meta">
              {stats.biggestWin === null
                ? ''
                : `${stats.biggestWin.label} · ${formatDateSlash(stats.biggestWin.date)}`}
            </span>
          </div>
          <div className="bet-biggest__card">
            <span className="bet-biggest__label">最大輸</span>
            <span className="bet-biggest__value is-loss">
              {stats.biggestLoss === null ? '—' : formatBetMoney(stats.biggestLoss.profit)}
            </span>
            <span className="bet-biggest__meta">
              {stats.biggestLoss === null
                ? ''
                : `${stats.biggestLoss.label} · ${formatDateSlash(stats.biggestLoss.date)}`}
            </span>
          </div>
        </div>
      </section>
    </>
  );
}

export function StatsPage() {
  const [period, setPeriod] = useState<BetPeriod>('month');
  const stats = useAsync<BetStats>(`bet-stats|${period}`, () => fetchBetStats(period));

  return (
    <div className="bet-stats">
      <div className="bet-periods" role="group" aria-label="統計期間">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={period === item.id}
            className={`bet-periods__item ${period === item.id ? 'is-selected' : ''}`}
            onClick={() => setPeriod(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {stats.loading ? (
        <div className="bet-skeleton-stack" aria-hidden="true">
          {['a', 'b', 'c'].map((key) => (
            <div className="bet-skeleton" key={key} />
          ))}
        </div>
      ) : null}

      {!stats.loading && stats.error !== null ? (
        <div className="bet-empty">
          <p className="bet-empty__title">載入失敗</p>
          <p className="bet-empty__description">{stats.error}</p>
          <button type="button" className="bet-button bet-button--outline" onClick={stats.reload}>
            重試
          </button>
        </div>
      ) : null}

      {!stats.loading && stats.error === null && stats.data !== null ? (
        stats.data.totals.settledBets === 0 ? (
          <div className="bet-empty">
            <p className="bet-empty__title">未有已結算注單</p>
            <p className="bet-empty__description">記錄注單並補上結果後，統計會在這裡出現。</p>
            {stats.data.totals.pendingCount === 0 ? null : (
              <p className="bet-stats__hint">
                本期待結算 {stats.data.totals.pendingCount} 注 ·{' '}
                {formatStake(stats.data.totals.pendingStake)}
              </p>
            )}
          </div>
        ) : (
          <StatsContent stats={stats.data} />
        )
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Add the stats styles**

Append to `frontend/src/bet/bet.css`:

```css
.bet-stats {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.bet-periods {
  display: flex;
  gap: 6px;
}

.bet-periods__item {
  flex: 1;
  min-height: 44px;
  color: var(--bet-muted);
  font-size: 12px;
  font-weight: 600;
  background: transparent;
  border: 1px solid var(--bet-line);
  border-radius: 999px;
}

.bet-periods__item.is-selected {
  color: var(--bet-volt);
  background: var(--bet-glow);
  border-color: rgba(216, 255, 79, 0.45);
}

.bet-stats-hero {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  background:
    linear-gradient(135deg, rgba(216, 255, 79, 0.05), transparent 60%),
    var(--bet-surface);
  border: 1px solid var(--bet-line-strong);
  border-radius: var(--bet-radius);
}

.bet-stats-hero__label {
  color: var(--bet-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.bet-stats-hero__value {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 32px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.05;
}

.bet-stats-hero__value.is-win,
.bet-biggest__value.is-win {
  color: var(--bet-win);
}

.bet-stats-hero__value.is-loss,
.bet-biggest__value.is-loss {
  color: var(--bet-loss);
}

.bet-stats-hero__value.is-zero,
.bet-biggest__value.is-zero {
  color: var(--bet-dim);
}

.bet-stats-hero__meta {
  color: var(--bet-muted);
  font-size: 11px;
}

.bet-kpi-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1px;
  overflow: hidden;
  background: var(--bet-line);
  border: 1px solid var(--bet-line);
  border-radius: var(--bet-radius);
}

.bet-kpi {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 12px;
  background: var(--bet-surface);
}

.bet-kpi__label {
  color: var(--bet-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.bet-kpi__value {
  color: var(--bet-text);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.bet-kpi__value.is-pending {
  color: var(--bet-pending);
}

.bet-stats__pending {
  padding: 8px 10px;
  color: var(--bet-pending);
  font-size: 11px;
  background: rgba(255, 200, 87, 0.06);
  border: 1px solid rgba(255, 200, 87, 0.18);
  border-radius: 8px;
}

.bet-stats-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bet-stats-section__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.bet-stats-section__header h2 {
  color: var(--bet-dim);
  font-size: 13px;
  font-weight: 600;
}

.bet-stats-section__note,
.bet-stats__hint {
  color: var(--bet-muted);
  font-size: 10px;
}

.bet-type-list {
  overflow: hidden;
  background: var(--bet-surface);
  border: 1px solid var(--bet-line);
  border-radius: var(--bet-radius);
}

.bet-type-row {
  display: grid;
  grid-template-columns: 52px 1fr auto;
  gap: 4px 8px;
  align-items: baseline;
  padding: 10px 12px;
  border-top: 1px solid var(--bet-line);
}

.bet-type-row:first-child {
  border-top: 0;
}

.bet-type-row__label {
  color: var(--bet-text);
  font-size: 12px;
  font-weight: 600;
}

.bet-type-row__meta {
  color: var(--bet-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10px;
}

.bet-type-row__profit {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 13px;
  font-weight: 700;
  text-align: right;
}

.bet-type-row__profit.is-win {
  color: var(--bet-win);
}

.bet-type-row__profit.is-loss {
  color: var(--bet-loss);
}

.bet-type-row__profit.is-zero {
  color: var(--bet-dim);
}

.bet-type-row__roi {
  grid-column: 2 / -1;
  color: var(--bet-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10px;
  text-align: right;
}

.bet-market-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: var(--bet-surface);
  border: 1px solid var(--bet-line);
  border-radius: var(--bet-radius);
}

.bet-market-row {
  display: grid;
  grid-template-columns: 48px 1fr auto;
  gap: 4px 8px;
  align-items: center;
}

.bet-market-row__label {
  color: var(--bet-dim);
  font-size: 11px;
  font-weight: 600;
}

.bet-market-row__bar {
  display: flex;
  align-items: center;
  height: 8px;
  overflow: hidden;
  background: var(--bet-raised);
  border-radius: 999px;
}

.bet-market-row__fill {
  display: block;
  height: 100%;
  border-radius: 999px;
}

.bet-market-row__fill.is-win {
  background: var(--bet-win);
}

.bet-market-row__fill.is-loss {
  background: var(--bet-loss);
}

.bet-market-row__fill.is-zero {
  background: var(--bet-push);
}

.bet-market-row__profit {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 11px;
  font-weight: 700;
  text-align: right;
}

.bet-market-row__profit.is-win {
  color: var(--bet-win);
}

.bet-market-row__profit.is-loss {
  color: var(--bet-loss);
}

.bet-market-row__profit.is-zero {
  color: var(--bet-dim);
}

.bet-market-row__meta {
  grid-column: 2 / -1;
  color: var(--bet-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 9px;
  text-align: right;
}

.bet-month-chart {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 4px;
  padding: 12px 8px 8px;
  background: var(--bet-surface);
  border: 1px solid var(--bet-line);
  border-radius: var(--bet-radius);
}

.bet-month {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  min-width: 0;
}

.bet-month__value {
  overflow: hidden;
  max-width: 100%;
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 9px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bet-month__value.is-win {
  color: var(--bet-win);
}

.bet-month__value.is-loss {
  color: var(--bet-loss);
}

.bet-month__value.is-zero {
  color: var(--bet-muted);
}

.bet-month__plot {
  position: relative;
  width: 100%;
  height: 64px;
}

.bet-month__bar {
  position: absolute;
  left: 50%;
  width: 12px;
  border-radius: 2px;
  transform: translateX(-50%);
}

.bet-month__bar.is-win {
  bottom: 50%;
  background: var(--bet-win);
}

.bet-month__bar.is-loss {
  top: 50%;
  background: var(--bet-loss);
}

.bet-month__bar.is-zero {
  display: none;
}

.bet-month__label {
  color: var(--bet-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 9px;
}

.bet-biggest {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.bet-biggest__card {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  padding: 12px;
  background: var(--bet-surface);
  border: 1px solid var(--bet-line);
  border-radius: var(--bet-radius);
}

.bet-biggest__label {
  color: var(--bet-muted);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.bet-biggest__value {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.bet-biggest__meta {
  overflow: hidden;
  color: var(--bet-muted);
  font-size: 9px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 3: Verify the stats page**

Run:

```bash
pnpm typecheck:web
pnpm build:web
pnpm lint
pnpm test:web
```

Expected: typecheck/build/test pass.

Manual/browser check:
1. 本月/今年/全部 switch refetches and changes the hero; the 6-month chart stays 6 columns.
2. Single/parlay rows match the backend values.
3. Market bars render only single-leg markets; zero-profit rows are visible but have no bar.
4. Biggest win/loss cards show label + date; empty values show `—`.
5. No settled bets shows the empty state, not empty charts.
6. 375px: 6 month labels fit; no horizontal overflow.

**Checkpoint:** Do not commit. Suggested later commit: `feat(bets): add betting stats page`.

---

## Task 10: Visual QA, Responsive Polish, and Accessibility

**Required skills:** Load `visual-qa` and `playwright` (or `frontend` if `visual-qa` is unavailable) before this task. This is UI work, so delegate to a `visual-engineering` agent with `load_skills=["visual-qa", "playwright", "ui-ux-pro-max", "frontend-design"]`. Do not skip the visual check.

**Files:**
- Modify: `frontend/src/bet/bet.css`
- Modify: betting TSX only if visual/accessibility defects require it.
- Evidence output: `docs/evidence/bet/` (gitignored).

**Checks:**

- [ ] **Step 1: Start the local stack**

Run the backend and frontend per `README.md`:

```bash
docker compose -f docker-compose.yml -f docker-compose.debug.yml up -d db web
pnpm build:web
pnpm dev:web
```

If Docker is unavailable, run the Vite dev server against a test backend with `pnpm dev:web`; use mocked API responses only if the backend cannot run, and record that in the QA notes.

- [ ] **Step 2: Capture 375px and 430px evidence**

Use Playwright at 375×812 and 430×932. Login if needed, then capture:

```
docs/evidence/bet/375-mahjong-header.png
docs/evidence/bet/375-bet-empty.png
docs/evidence/bet/375-bet-summary.png
docs/evidence/bet/375-bet-form-single.png
docs/evidence/bet/375-bet-form-parlay.png
docs/evidence/bet/375-bet-card-pending.png
docs/evidence/bet/375-bet-card-settled.png
docs/evidence/bet/375-bet-stats.png
docs/evidence/bet/375-bet-stats-empty.png
docs/evidence/bet/430-bet.png
docs/evidence/bet/375-bet-offline.png
docs/evidence/bet/375-bet-reduced-motion.png
```

- [ ] **Step 3: Verify the visual contract**

Check each item and fix `bet.css` if it fails:

1. Betting UI uses only `--bet-*` tokens and `bet-` classes; no mahjong felt/cinnabar/jade/tally mark.
2. Header switch works both ways; mahjong header still fits at 375px with the new `賭球` pill.
3. No horizontal overflow at 375px; long match/selection text truncates with ellipsis.
4. Summary cells show `—` on load/failure and correct signed money after load.
5. Form: 16px inputs, 44px chips, sticky footer, total odds readout, result chips, preview; sheet is full-screen and scrolls internally.
6. Card: leg numbers, dotted separators, result badge, pending settle action; settled cards show signed profit.
7. Stats: hero/KPI/type/market/month/biggest all fit; 6 month labels do not collide.
8. Focus ring is volt; tab order is logical; Escape closes dialogs; focus returns to the trigger.
9. `prefers-reduced-motion` disables page/sheet/toast/bar animations.
10. Safe-area top/bottom respected in standalone mode; nav does not cover the last card or the form footer.
11. Offline banner appears without breaking layout; errors are readable.
12. No console errors, no failed network requests other than intentional offline checks.

- [ ] **Step 4: Mahjong regression**

At 375px:
1. `#fan`, `#mai`, `#ledger` still render and scroll.
2. Header switch pill does not overlap the today chip or tools.
3. Existing mahjong interactions (keypad, sheet, tabs) still work.
4. `#bet` direct reload opens betting; returning to `#fan` restores the mahjong shell.

- [ ] **Step 5: Record the QA result**

Create `docs/evidence/bet/qa.md` with:

```md
# Betting UI QA

- Date:
- Viewports: 375×812, 430×932
- Backend: local Docker / mocked
- Checks: pass/fail per Task 10 list
- Defects found:
- Fixes applied:
- Screenshots:
```

Do not commit evidence files (`docs/evidence/*` is gitignored).

**Checkpoint:** Do not commit. Suggested later commit: `fix(bets): polish responsive betting UI`.

---

## Task 11: Documentation and Full Regression

**Files:**
- Modify: `README.md`
- Modify: `docs/api.http`
- Modify: `frontend/BET-DESIGN.md` only if the implementation refined the contract.

- [ ] **Step 1: Update `README.md`**

Add to the repository layout:

```
frontend/src/bet/            standalone betting ledger (API, pages, components, CSS)
frontend/BET-DESIGN.md       betting visual contract (separate from DESIGN.md)
```

Add to the API contract table:

```
| GET    | /api/bets?limit=&cursor=&status= | yes | Bet list, newest first, keyset pagination |
| POST   | /api/bets                        | yes | Create one bet + 1–8 legs |
| PATCH  | /api/bets/:id                    | yes | Update date/stake/result/legs |
| DELETE | /api/bets/:id                    | yes | Delete bet; legs cascade |
| GET    | /api/bets/overview               | yes | Today/month/pending summary |
| GET    | /api/bets/stats?period=          | yes | month/year/all betting stats |
```

Add a short “Betting ledger” section:

```md
### 賭球（Betting ledger）

`#bet` is a separate shell from the mahjong UI. The mahjong header has a compact `賭球` switch; the betting header switches back to `麻雀`. It stores one row per bet slip in `bets` plus 1–8 `bet_legs`; a single bet has one leg, a parlay has 2–8. The slip-level result is one of `pending/win/half_win/push/half_loss/loss`; `total_odds` and `profit` are calculated on write and stored. Pending bets are excluded from profit/ROI/win-rate and shown as pending stake.

The visual contract is [`frontend/BET-DESIGN.md`](frontend/BET-DESIGN.md). The betting UI does not use mahjong components, tokens, or `GameProvider`.
```

Add betting tests to the test list:

```
frontend/tests/bet-profit.test.ts
frontend/tests/bet-format.test.ts
frontend/tests/bet-form.test.ts
tests/integration/bets-crud.test.ts
tests/integration/bets-stats.test.ts
```

- [ ] **Step 2: Add REST examples to `docs/api.http`**

Append:

```http
### Create a pending single bet
POST {{baseUrl}}/api/bets
Content-Type: application/json
Cookie: {{sessionCookie}}

{
  "date": "2026-10-26",
  "stake": 500,
  "result": "pending",
  "legs": [
    {
      "match": "曼聯 vs 車路士",
      "market": "handicap",
      "selection": "曼聯 -0.5",
      "odds": 1.95
    }
  ]
}

### Create a 2-leg parlay
POST {{baseUrl}}/api/bets
Content-Type: application/json
Cookie: {{sessionCookie}}

{
  "stake": 200,
  "legs": [
    { "match": "曼聯 vs 車路士", "market": "handicap", "selection": "曼聯 -0.5", "odds": 1.95 },
    { "match": "阿仙奴 vs 利物浦", "market": "totals", "selection": "大 2.5", "odds": 1.9 }
  ]
}

### List bets
GET {{baseUrl}}/api/bets?limit=50&status=all
Cookie: {{sessionCookie}}

### Settle a bet
PATCH {{baseUrl}}/api/bets/{{betId}}
Content-Type: application/json
Cookie: {{sessionCookie}}

{ "result": "win" }

### Bet overview
GET {{baseUrl}}/api/bets/overview
Cookie: {{sessionCookie}}

### Bet stats
GET {{baseUrl}}/api/bets/stats?period=month
Cookie: {{sessionCookie}}

### Delete a bet
DELETE {{baseUrl}}/api/bets/{{betId}}
Cookie: {{sessionCookie}}
```

- [ ] **Step 3: Run the full verification**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm typecheck:web
pnpm test:web
pnpm build
pnpm build:web
```

`pnpm test` needs `TEST_DATABASE_URL` pointing at a PostgreSQL database whose name ends with `_test`. Expected: all commands exit 0. Note any pre-existing failures separately; do not hide them.

- [ ] **Step 4: Final manual regression**

1. Login works; boot probe still uses `GET /api/players`.
2. Mahjong fan/mai/ledger unchanged; localStorage keys unchanged.
3. Header switch to `#bet` and back works; direct reload of `#bet` works.
4. Create a single bet, a 3-leg parlay, settle to win/half-win/push/half-loss/loss, edit legs, delete.
5. Overview and stats update after each mutation.
6. Reload after create; data persists.
7. 401 on any bet call returns to login (global event).
8. No new dependencies; no `as any`/`@ts-ignore`; no raw SQL interpolation.

**Checkpoint:** Do not commit unless the user explicitly approves. Suggested final commit after approval: `feat(bets): add football betting ledger`.

---

## Execution Handoff

After the plan is approved, choose one:

1. **Subagent-Driven (recommended):** one fresh agent per task, review between tasks.
2. **Inline Execution:** execute in this session with checkpoints.

For subagent-driven execution, use `superpowers:subagent-driven-development`. For inline execution, use `superpowers:executing-plans`. Do not commit implementation work without explicit user approval.
