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
