import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
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
