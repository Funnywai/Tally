import { z } from 'zod';

import { jsonInit, requestJson, requestVoid } from '../lib/http';
import type {
  BetItem,
  BetListResponse,
  BetOverview,
  BetPayload,
  BetPeriod,
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

export async function updateBet(id: string, payload: Partial<BetPayload>): Promise<BetItem> {
  return requestJson(`/api/bets/${encodeURIComponent(id)}`, jsonInit('PATCH', payload), itemSchema);
}

export async function deleteBet(id: string): Promise<void> {
  await requestVoid(`/api/bets/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function fetchBetStats(period: BetPeriod): Promise<BetStats> {
  const params = new URLSearchParams({ period });
  return requestJson(`/api/bets/stats?${params.toString()}`, {}, statsSchema);
}
