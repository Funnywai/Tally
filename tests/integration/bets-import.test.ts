import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { hkToday } from '../../src/time.js';
import { closeTestDb, createTestApp, getTestDb, resetDb } from '../helpers/app.js';
import { singleLeg } from '../helpers/bets.js';
import { login } from '../helpers/records.js';

const VALID_EXTERNAL_ID = 'hkjc-2026-10-26-1';

function betFields(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    date: '2026-10-26',
    stake: 100,
    result: 'pending',
    legs: [singleLeg()],
    ...overrides,
  };
}

function importItem(
  externalId: string | undefined,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...(externalId === undefined ? {} : { externalId }),
    ...betFields(overrides),
  };
}

async function postImport(
  app: Express,
  cookie: string,
  payload: Record<string, unknown>,
): Promise<request.Response> {
  return request(app).post('/api/bets/import').set('Cookie', cookie).send(payload);
}

async function countBets(): Promise<number> {
  const db = await getTestDb();
  const result = await db.pool.query<{ count: number }>('select count(*)::int as count from bets');
  return result.rows[0]?.count ?? 0;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeTestDb();
});

describe('POST /api/bets/import', () => {
  it('requires auth', async () => {
    const { app } = await createTestApp();
    const response = await request(app)
      .post('/api/bets/import')
      .send({ bets: [importItem(VALID_EXTERNAL_ID)] });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('reports new items during a dry run without writing', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const bets = [
      importItem('hkjc-dry-a', { stake: 100 }),
      importItem('hkjc-dry-b', { date: '2026-10-27', stake: 50 }),
    ];

    const response = await postImport(app, cookie, { dryRun: true, bets });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      dryRun: true,
      imported: 0,
      skipped: 0,
      items: [
        { externalId: 'hkjc-dry-a', status: 'new' },
        { externalId: 'hkjc-dry-b', status: 'new' },
      ],
    });
    expect(await countBets()).toBe(0);
  });

  it('accepts a 200-item dry run above the global 32 KB JSON limit', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const bets = Array.from({ length: 200 }, (_, index) => ({
      externalId: `hkjc-bulk-${String(index + 1).padStart(3, '0')}`,
      date: '2026-11-05',
      stake: 100 + index,
      result: 'pending',
      legs: [
        singleLeg({
          match: '曼聯 vs 車路士',
          market: 'handicap',
          selection: '曼聯 -0.5',
          odds: 1.95,
        }),
      ],
    }));
    const payload = { dryRun: true, bets };
    const serialized = JSON.stringify(payload);
    expect(serialized.length).toBeGreaterThan(32 * 1024);
    expect(Buffer.byteLength(serialized, 'utf8')).toBeGreaterThan(32 * 1024);

    const response = await postImport(app, cookie, payload);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      dryRun: true,
      imported: 0,
      skipped: 0,
      items: bets.map((bet) => ({ externalId: bet.externalId, status: 'new' })),
    });
    expect(await countBets()).toBe(0);
  });

  it('imports new items once and reports duplicates on reruns', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const bets = [
      importItem('hkjc-run-a', { stake: 100 }),
      importItem('hkjc-run-b', { date: '2026-10-27', stake: 200 }),
    ];

    const first = await postImport(app, cookie, { bets });
    expect(first.status).toBe(200);
    expect(first.body).toEqual({
      dryRun: false,
      imported: 2,
      skipped: 0,
      items: [
        { externalId: 'hkjc-run-a', status: 'imported' },
        { externalId: 'hkjc-run-b', status: 'imported' },
      ],
    });

    const db = await getTestDb();
    const rows = await db.pool.query<{ external_id: string }>(
      'select external_id from bets order by external_id asc',
    );
    expect(rows.rows.map((row) => row.external_id)).toEqual(['hkjc-run-a', 'hkjc-run-b']);

    const list = await request(app).get('/api/bets').set('Cookie', cookie);
    expect(list.status).toBe(200);
    for (const item of list.body.items) {
      expect(item.externalId).toBeUndefined();
    }

    const dryRerun = await postImport(app, cookie, { dryRun: true, bets });
    expect(dryRerun.body).toEqual({
      dryRun: true,
      imported: 0,
      skipped: 2,
      items: [
        { externalId: 'hkjc-run-a', status: 'duplicate' },
        { externalId: 'hkjc-run-b', status: 'duplicate' },
      ],
    });

    const actualRerun = await postImport(app, cookie, { bets });
    expect(actualRerun.body).toEqual({
      dryRun: false,
      imported: 0,
      skipped: 2,
      items: [
        { externalId: 'hkjc-run-a', status: 'duplicate' },
        { externalId: 'hkjc-run-b', status: 'duplicate' },
      ],
    });
    expect(await countBets()).toBe(2);
  });

  it('stores parlay odds, profit, and legs, and leaves pending profit null', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const bets = [
      importItem('hkjc-parlay', {
        date: '2026-10-25',
        stake: 200,
        result: 'win',
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
      }),
      importItem('hkjc-pending', {
        date: '2026-10-26',
        stake: 50,
        result: 'pending',
        legs: [singleLeg({ odds: 1.5 })],
      }),
    ];

    const response = await postImport(app, cookie, { bets });
    expect(response.status).toBe(200);
    expect(response.body.imported).toBe(2);

    const db = await getTestDb();
    const settled = await db.pool.query<{
      total_odds: string;
      profit: string | null;
      result: string;
    }>(
      `select total_odds::text, profit::text, result
         from bets
        where external_id = $1`,
      ['hkjc-parlay'],
    );
    expect(settled.rows[0]).toEqual({ total_odds: '7.78', profit: '1356.00', result: 'win' });

    const legs = await db.pool.query<{ position: number; odds: string }>(
      `select l.position, l.odds::text
         from bet_legs l
         join bets b on b.id = l.bet_id
        where b.external_id = $1
        order by l.position asc`,
      ['hkjc-parlay'],
    );
    expect(legs.rows).toEqual([
      { position: 1, odds: '1.95' },
      { position: 2, odds: '1.90' },
      { position: 3, odds: '2.10' },
    ]);

    const pending = await db.pool.query<{ total_odds: string; profit: string | null }>(
      'select total_odds::text, profit::text from bets where external_id = $1',
      ['hkjc-pending'],
    );
    expect(pending.rows[0]).toEqual({ total_odds: '1.50', profit: null });
  });

  it('rejects invalid batches with 400 VALIDATION', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);

    const nineLegs = Array.from({ length: 9 }, () => singleLeg());
    const cases: Record<string, unknown>[] = [
      { bets: [importItem(undefined)] },
      { bets: [importItem('   ')] },
      { bets: [importItem('bad\u0000id')] },
      { bets: [importItem('x'.repeat(121))] },
      {
        bets: [
          importItem('hkjc-dup', { date: '2026-10-26' }),
          importItem('hkjc-dup', { date: '2026-10-27' }),
        ],
      },
      { bets: [importItem('hkjc-no-legs', { legs: [] })] },
      { bets: [importItem('hkjc-nine-legs', { legs: nineLegs })] },
      { bets: [importItem('hkjc-bad-stake', { stake: 0 })] },
      {
        bets: [importItem('hkjc-bad-odds', { legs: [{ ...singleLeg(), odds: 1 }] })],
      },
      {
        bets: [
          importItem('hkjc-bad-total-odds', {
            legs: [
              { ...singleLeg(), odds: 300 },
              { ...singleLeg(), odds: 400 },
            ],
          }),
        ],
      },
      { bets: [importItem('hkjc-bad-date', { date: '2026-02-30' })] },
      { bets: [] },
      {},
    ];

    for (const payload of cases) {
      const response = await postImport(app, cookie, payload);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION');
    }

    expect(await countBets()).toBe(0);
  });

  it('keeps normal bet creation working with a null external_id', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);

    const created = await request(app)
      .post('/api/bets')
      .set('Cookie', cookie)
      .send(betFields({ stake: 300 }));

    expect(created.status).toBe(201);
    expect(created.body.stake).toBe(300);
    expect(created.body.externalId).toBeUndefined();

    const db = await getTestDb();
    const row = await db.pool.query<{ external_id: string | null }>(
      'select external_id from bets where id = $1',
      [created.body.id],
    );
    expect(row.rows[0]?.external_id).toBeNull();
  });
});

describe('cash_out import', () => {
  async function importCashOut(
    app: Express,
    cookie: string,
    externalId: string,
    overrides: Record<string, unknown> = {},
  ): Promise<request.Response> {
    return postImport(app, cookie, {
      bets: [
        importItem(externalId, {
          date: hkToday(),
          stake: 10,
          result: 'cash_out',
          profitOverride: 7.3,
          legs: [singleLeg({ odds: 9.24 })],
          ...overrides,
        }),
      ],
    });
  }

  async function betByExternalId(externalId: string): Promise<{
    id: string;
    result: string;
    profit: string | null;
    total_odds: string;
  } | null> {
    const db = await getTestDb();
    const result = await db.pool.query<{
      id: string;
      result: string;
      profit: string | null;
      total_odds: string;
    }>(
      `select id, result, profit::text, total_odds::text
         from bets
        where external_id = $1`,
      [externalId],
    );
    return result.rows[0] ?? null;
  }

  it('imports a cash-out win as actual profit and excludes it from wins and biggest win', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);

    const imported = await importCashOut(app, cookie, 'hkjc-cashout-win');
    expect(imported.status).toBe(200);
    expect(imported.body.imported).toBe(1);

    const list = await request(app).get('/api/bets').set('Cookie', cookie);
    expect(list.status).toBe(200);
    expect(list.body.items[0]).toMatchObject({
      result: 'cash_out',
      stake: 10,
      totalOdds: 9.24,
      profit: 7.3,
    });

    const stats = await request(app).get('/api/bets/stats?period=last30').set('Cookie', cookie);
    expect(stats.status).toBe(200);
    expect(stats.body.totals).toEqual({
      settledStake: 10,
      profit: 7.3,
      roi: 73,
      settledBets: 1,
      wins: 0,
      winRate: null,
      avgOdds: 9.24,
      pendingCount: 0,
      pendingStake: 0,
    });
    expect(stats.body.byType).toEqual([
      { type: 'single', bets: 1, stake: 10, profit: 7.3, roi: 73 },
      { type: 'parlay', bets: 0, stake: 0, profit: 0, roi: null },
    ]);
    expect(stats.body.byMarket).toEqual([
      { market: 'handicap', bets: 1, stake: 10, profit: 7.3, roi: 73 },
    ]);
    expect(stats.body.monthly.at(-1)).toEqual({
      month: hkToday().slice(0, 7),
      profit: 7.3,
    });
    expect(stats.body.biggestWin).toBeNull();
    expect(stats.body.biggestLoss).toBeNull();

    const overview = await request(app).get('/api/bets/overview').set('Cookie', cookie);
    expect(overview.status).toBe(200);
    expect(overview.body.today).toEqual({
      profit: 7.3,
      settledStake: 10,
      settledBets: 1,
      pendingBets: 0,
    });
    expect(overview.body.last30Days).toEqual({
      profit: 7.3,
      settledStake: 10,
      settledBets: 1,
      pendingBets: 0,
    });
    expect(overview.body.last90Days).toEqual({
      profit: 7.3,
      settledStake: 10,
      settledBets: 1,
      pendingBets: 0,
    });

    expect(await betByExternalId('hkjc-cashout-win')).toMatchObject({
      result: 'cash_out',
      profit: '7.30',
      total_odds: '9.24',
    });
  });

  it('imports a cash-out loss as actual profit and excludes it from biggest loss', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);

    const imported = await importCashOut(app, cookie, 'hkjc-cashout-loss', {
      profitOverride: -9.9,
      legs: [singleLeg({ odds: 2.44 })],
    });
    expect(imported.status).toBe(200);
    expect(imported.body.imported).toBe(1);

    const list = await request(app).get('/api/bets').set('Cookie', cookie);
    expect(list.body.items[0]).toMatchObject({
      result: 'cash_out',
      stake: 10,
      totalOdds: 2.44,
      profit: -9.9,
    });

    const stats = await request(app).get('/api/bets/stats?period=last30').set('Cookie', cookie);
    expect(stats.body.totals).toEqual({
      settledStake: 10,
      profit: -9.9,
      roi: -99,
      settledBets: 1,
      wins: 0,
      winRate: null,
      avgOdds: 2.44,
      pendingCount: 0,
      pendingStake: 0,
    });
    expect(stats.body.biggestWin).toBeNull();
    expect(stats.body.biggestLoss).toBeNull();

    const overview = await request(app).get('/api/bets/overview').set('Cookie', cookie);
    expect(overview.body.today.profit).toBe(-9.9);
    expect(overview.body.last30Days.profit).toBe(-9.9);
    expect(overview.body.last90Days.profit).toBe(-9.9);

    expect(await betByExternalId('hkjc-cashout-loss')).toMatchObject({
      result: 'cash_out',
      profit: '-9.90',
      total_odds: '2.44',
    });
  });

  it('rejects invalid override combinations', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);

    const invalidItems = [
      importItem('hkjc-pending-override', { result: 'pending', profitOverride: 7.3 }),
      importItem('hkjc-win-override', { result: 'win', profitOverride: 7.3 }),
      importItem('hkjc-cashout-missing', { result: 'cash_out' }),
      importItem('hkjc-cashout-null', { result: 'cash_out', profitOverride: null }),
    ];

    for (const item of invalidItems) {
      const response = await postImport(app, cookie, { bets: [item] });
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION');
    }

    expect(await countBets()).toBe(0);
  });

  it('keeps the formula for normal imports without an override', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);

    const imported = await postImport(app, cookie, {
      bets: [
        importItem('hkjc-normal-formula', {
          date: hkToday(),
          stake: 100,
          result: 'win',
          legs: [singleLeg({ odds: 2 })],
        }),
      ],
    });
    expect(imported.status).toBe(200);
    expect(imported.body.imported).toBe(1);

    const list = await request(app).get('/api/bets').set('Cookie', cookie);
    expect(list.body.items[0].profit).toBe(100);

    const stats = await request(app).get('/api/bets/stats?period=last30').set('Cookie', cookie);
    expect(stats.body.totals.profit).toBe(100);
    expect(stats.body.totals.wins).toBe(1);

    expect(await betByExternalId('hkjc-normal-formula')).toMatchObject({
      result: 'win',
      profit: '100.00',
      total_odds: '2.00',
    });
  });

  it('rejects cash_out on normal create and patch endpoints', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);

    const createdNow = await request(app)
      .post('/api/bets')
      .set('Cookie', cookie)
      .send(betFields({ result: 'cash_out', stake: 10, profitOverride: 7.3 }));
    expect(createdNow.status).toBe(400);
    expect(createdNow.body.error.code).toBe('VALIDATION');

    const normal = await request(app)
      .post('/api/bets')
      .set('Cookie', cookie)
      .send(betFields({ result: 'win', stake: 10, legs: [singleLeg({ odds: 2 })] }));
    expect(normal.status).toBe(201);

    const patched = await request(app)
      .patch(`/api/bets/${normal.body.id}`)
      .set('Cookie', cookie)
      .send({ result: 'cash_out' });
    expect(patched.status).toBe(400);
    expect(patched.body.error.code).toBe('VALIDATION');

    const db = await getTestDb();
    const row = await db.pool.query<{ result: string; profit: string }>(
      'select result, profit::text from bets where id = $1',
      [normal.body.id],
    );
    expect(row.rows[0]).toEqual({ result: 'win', profit: '10.00' });
  });

  it('preserves actual profit on a date-only patch of a cash-out bet', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    await importCashOut(app, cookie, 'hkjc-cashout-date-patch');
    const before = await betByExternalId('hkjc-cashout-date-patch');
    expect(before).not.toBeNull();

    const patched = await request(app)
      .patch(`/api/bets/${before?.id ?? ''}`)
      .set('Cookie', cookie)
      .send({ date: '2026-10-30' });

    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({
      date: '2026-10-30',
      result: 'cash_out',
      stake: 10,
      totalOdds: 9.24,
      profit: 7.3,
    });
    expect(await betByExternalId('hkjc-cashout-date-patch')).toMatchObject({
      profit: '7.30',
      total_odds: '9.24',
    });
  });

  it('allows stake, leg, and date patches on a cash-out bet and keeps the imported profit', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    await importCashOut(app, cookie, 'hkjc-cashout-patchable');
    const before = await betByExternalId('hkjc-cashout-patchable');
    expect(before).not.toBeNull();

    const stakePatch = await request(app)
      .patch(`/api/bets/${before?.id ?? ''}`)
      .set('Cookie', cookie)
      .send({ stake: 20 });
    expect(stakePatch.status).toBe(200);
    expect(stakePatch.body).toMatchObject({ result: 'cash_out', stake: 20, profit: 7.3 });

    const legsPatch = await request(app)
      .patch(`/api/bets/${before?.id ?? ''}`)
      .set('Cookie', cookie)
      .send({ legs: [singleLeg({ odds: 2 })] });
    expect(legsPatch.status).toBe(200);
    expect(legsPatch.body).toMatchObject({ result: 'cash_out', totalOdds: 2, profit: 7.3 });

    const datePatch = await request(app)
      .patch(`/api/bets/${before?.id ?? ''}`)
      .set('Cookie', cookie)
      .send({ date: '2026-10-31', stake: 20 });
    expect(datePatch.status).toBe(200);
    expect(datePatch.body).toMatchObject({ date: '2026-10-31', result: 'cash_out', profit: 7.3 });

    expect(await betByExternalId('hkjc-cashout-patchable')).toMatchObject({
      result: 'cash_out',
      profit: '7.30',
      total_odds: '2.00',
    });
  });

  it('accepts cash_out in the bets result constraint', async () => {
    const db = await getTestDb();

    const inserted = await db.pool.query<{ result: string }>(
      `insert into bets (bet_date, stake, total_odds, result, profit)
       values (current_date, 10, 2, 'cash_out', 1.5)
       returning result`,
    );
    expect(inserted.rows[0]?.result).toBe('cash_out');

    const constraint = await db.pool.query<{ definition: string }>(
      `select pg_get_constraintdef(oid) as definition
         from pg_constraint
        where conname = 'bets_result_check'
          and conrelid = 'bets'::regclass`,
    );
    expect(constraint.rows[0]?.definition).toContain("'cash_out'");
  });
});
