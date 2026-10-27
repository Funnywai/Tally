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
    legs: [singleLeg({ odds: 1.5 }), singleLeg({ odds: 2 })],
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

    const response = await request(app).get('/api/bets/stats?period=month').set('Cookie', cookie);

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
    const response = await request(app).get('/api/bets/stats?period=week').set('Cookie', cookie);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION');
  });

  it('picks the biggest win and loss numerically, not lexicographically', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const today = hkToday();

    const win1000 = await createBet(app, cookie, {
      date: today,
      stake: 1000,
      result: 'win',
      legs: [singleLeg({ odds: 2 })],
    });
    await createBet(app, cookie, {
      date: today,
      stake: 999,
      result: 'win',
      legs: [singleLeg({ odds: 2 })],
    });
    await createBet(app, cookie, {
      date: today,
      stake: 1,
      result: 'loss',
      legs: [singleLeg({ odds: 2 })],
    });
    await createBet(app, cookie, {
      date: today,
      stake: 10,
      result: 'loss',
      legs: [singleLeg({ odds: 2 })],
    });

    expect(win1000.profit).toBe(1000);

    const response = await request(app).get('/api/bets/stats?period=all').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.biggestWin).toMatchObject({
      betId: win1000.id,
      profit: 1000,
      date: today,
      label: '曼聯 vs 車路士',
    });
    expect(response.body.biggestLoss).toMatchObject({ profit: -10 });
  });
});
