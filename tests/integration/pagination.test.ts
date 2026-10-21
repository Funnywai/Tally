import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
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

async function seedGames(count: number): Promise<void> {
  const db = await getTestDb();
  await db.pool.query("insert into players (name) values ('A'), ('B'), ('C'), ('D')");
  await db.pool.query(
    `insert into games (played_at, recorded_at)
     select date '2026-01-01' + i,
            timestamptz '2026-01-01 00:00:00+00' + (i || ' seconds')::interval
       from generate_series(0, $1) as i`,
    [count - 1],
  );
  await db.pool.query(
    `insert into settlements (game_id, player_id, score)
     select g.id, p.id,
            case p.name when 'A' then 1 when 'B' then -1 else 0 end
       from games g
       cross join players p`,
  );
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeTestDb();
});

describe('record pagination', () => {
  it('pages through 65 records without duplicates or gaps', async () => {
    await seedGames(65);
    const { app } = await createTestApp();
    const cookie = await login(app);

    const ids: string[] = [];
    const dates: string[] = [];
    let cursor: string | null = null;
    let pages = 0;

    while (pages < 10) {
      const url: string =
        cursor === null
          ? '/api/records?limit=20'
          : `/api/records?limit=20&cursor=${encodeURIComponent(cursor)}`;
      const response = await request(app).get(url).set('Cookie', cookie);
      expect(response.status).toBe(200);
      ids.push(...response.body.items.map((item: { id: string }) => item.id));
      dates.push(...response.body.items.map((item: { date: string }) => item.date));
      const nextCursor: unknown = response.body.nextCursor;
      cursor = typeof nextCursor === 'string' ? nextCursor : null;
      pages += 1;
      if (cursor === null) {
        break;
      }
    }

    expect(ids).toHaveLength(65);
    expect(new Set(ids).size).toBe(65);
    expect(dates).toEqual([...dates].sort().reverse());

    const db = await getTestDb();
    const expected = await db.pool.query<{ id: string }>(
      'select id from games order by played_at desc, recorded_at desc, id desc',
    );
    expect(ids).toEqual(expected.rows.map((row) => row.id));
  });

  it('returns all records with limit 200 and no next cursor', async () => {
    await seedGames(65);
    const { app } = await createTestApp();
    const cookie = await login(app);
    const response = await request(app).get('/api/records?limit=200').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(65);
    expect(response.body.nextCursor).toBeNull();
  });

  it('caps a 210-record dataset at 200 per page and continues', async () => {
    await seedGames(210);
    const { app } = await createTestApp();
    const cookie = await login(app);

    const first = await request(app).get('/api/records?limit=200').set('Cookie', cookie);
    expect(first.status).toBe(200);
    expect(first.body.items).toHaveLength(200);
    expect(first.body.nextCursor).not.toBeNull();

    const second = await request(app)
      .get(`/api/records?limit=200&cursor=${encodeURIComponent(first.body.nextCursor)}`)
      .set('Cookie', cookie);
    expect(second.status).toBe(200);
    expect(second.body.items).toHaveLength(10);
    expect(second.body.nextCursor).toBeNull();
  });
});
