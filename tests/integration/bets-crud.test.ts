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

    for (const response of [getList, postBet, getOverview, getStats, patchBet, deleteBetResponse]) {
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
          singleLeg({
            match: '阿仙奴 vs 利物浦',
            market: 'totals',
            selection: '大 2.5',
            odds: 1.9,
          }),
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
