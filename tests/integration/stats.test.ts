import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { hkToday, hkYear } from '../../src/time.js';
import {
  closeTestDb,
  createTestApp,
  getTestDb,
  resetDb,
  sessionCookieFrom,
} from '../helpers/app.js';
import { TEST_PASSCODE } from '../helpers/config.js';

async function login(app: Express): Promise<string> {
  const response = await request(app).post('/api/auth').send({ passcode: TEST_PASSCODE });
  return sessionCookieFrom(response);
}

async function createRecord(
  app: Express,
  cookie: string,
  date: string,
  aliceScore: number,
  bobScore: number,
): Promise<void> {
  const response = await request(app)
    .post('/api/records')
    .set('Cookie', cookie)
    .send({
      date,
      players: [
        { name: 'Alice', score: aliceScore },
        { name: 'Bob', score: bobScore },
        { name: 'Carol', score: 0 },
        { name: 'Dave', score: 0 },
      ],
    });
  expect(response.status).toBe(201);
}

async function seedStatsFixture(app: Express, cookie: string): Promise<void> {
  await createRecord(app, cookie, '2025-12-31', 20, -20);
  await createRecord(app, cookie, '2026-01-10', 10, -10);
  await createRecord(app, cookie, '2026-02-10', -5, 5);
  await createRecord(app, cookie, '2026-03-10', 0, 0);
  await createRecord(app, cookie, '2026-04-10', 7.5, -7.5);
  await createRecord(app, cookie, '2026-05-10', -2.5, 2.5);
  await createRecord(app, cookie, '2026-06-10', 4, -4);
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeTestDb();
});

describe('player stats', () => {
  it('computes year totals, win rate, records, and averages', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    await seedStatsFixture(app, cookie);

    const response = await request(app)
      .get('/api/stats?player=Alice&year=2026')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      player: 'Alice',
      year: 2026,
      yearTotal: 14,
      yearGames: 6,
      yearWins: 3,
      winRate: 50,
      best: { score: 20, date: '2025-12-31' },
      worst: { score: -5, date: '2026-02-10' },
      avgWin: 10.4,
      avgLoss: -3.7,
      allTimeGames: 7,
    });
  });

  it('returns zeros and nulls for an unknown player', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const response = await request(app)
      .get('/api/stats?player=Nobody&year=2026')
      .set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      player: 'Nobody',
      year: 2026,
      yearTotal: 0,
      yearGames: 0,
      yearWins: 0,
      winRate: null,
      best: null,
      worst: null,
      avgWin: null,
      avgLoss: null,
      allTimeGames: 0,
    });
  });

  it('defaults the year to the current Hong Kong year', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    await createRecord(app, cookie, hkToday(), 3, -3);

    const response = await request(app).get('/api/stats?player=Alice').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.year).toBe(hkYear());
    expect(response.body.yearGames).toBe(1);
    expect(response.body.yearTotal).toBe(3);
  });

  it('rejects a missing player parameter', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const response = await request(app).get('/api/stats').set('Cookie', cookie);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION');
  });
});

describe('ranking', () => {
  it('aggregates all-time totals, wins, losses, and games', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    await seedStatsFixture(app, cookie);

    const response = await request(app).get('/api/ranking').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.ranking.map((entry: { name: string }) => entry.name)).toEqual([
      'Alice',
      'Carol',
      'Dave',
      'Bob',
    ]);

    const alice = response.body.ranking[0];
    expect(alice).toMatchObject({
      name: 'Alice',
      total: 34,
      wins: 4,
      losses: 2,
      games: 7,
    });
    expect(alice.playerId).toMatch(/^[0-9a-f-]{36}$/);

    const bob = response.body.ranking[3];
    expect(bob).toMatchObject({
      name: 'Bob',
      total: -34,
      wins: 2,
      losses: 4,
      games: 7,
    });
  });

  it('does not cap ranking or stats at 200 records', async () => {
    const db = await getTestDb();
    await db.pool.query("insert into players (name) values ('Alice'), ('Bob')");
    await db.pool.query(
      `insert into games (played_at, recorded_at)
       select date '2026-01-01' + (i % 365),
              timestamptz '2026-01-01 00:00:00+00' + (i || ' seconds')::interval
         from generate_series(0, 209) as i`,
    );
    await db.pool.query(
      `insert into settlements (game_id, player_id, score)
       select g.id, p.id, case p.name when 'Alice' then 1 else -1 end
         from games g
         cross join players p`,
    );

    const { app } = await createTestApp();
    const cookie = await login(app);

    const ranking = await request(app).get('/api/ranking').set('Cookie', cookie);
    expect(ranking.status).toBe(200);
    const alice = ranking.body.ranking.find((entry: { name: string }) => entry.name === 'Alice');
    expect(alice).toMatchObject({ total: 210, wins: 210, losses: 0, games: 210 });

    const stats = await request(app).get('/api/stats?player=Alice&year=2026').set('Cookie', cookie);
    expect(stats.body.allTimeGames).toBe(210);
    expect(stats.body.yearGames).toBe(210);
    expect(stats.body.yearTotal).toBe(210);
  });
});
