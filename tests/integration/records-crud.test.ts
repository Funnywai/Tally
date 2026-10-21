import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { hkToday } from '../../src/time.js';
import { closeTestDb, createTestApp, getTestDb, resetDb } from '../helpers/app.js';
import { fourPlayers, login } from '../helpers/records.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeTestDb();
});

describe('records CRUD', () => {
  it('creates, reads, patches, and deletes a record', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);

    const created = await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .send({ date: '2026-10-21', players: fourPlayers() });

    expect(created.status).toBe(201);
    const item = created.body;
    expect(item.id).toMatch(UUID_PATTERN);
    expect(item.date).toBe('2026-10-21');
    expect(item.recordedAt).toMatch(/Z$/);
    expect(item.players.map((player: { name: string }) => player.name)).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
    expect(item.players.map((player: { score: number }) => player.score)).toEqual([
      12.5, -12.5, 0, 0,
    ]);

    const list = await request(app).get('/api/records').set('Cookie', cookie);
    expect(list.status).toBe(200);
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0].id).toBe(item.id);
    expect(list.body.nextCursor).toBeNull();

    const patched = await request(app)
      .patch(`/api/records/${item.id}`)
      .set('Cookie', cookie)
      .send({
        date: '2026-10-22',
        players: item.players.map((player: { playerId: string; name: string; score: number }) => ({
          playerId: player.playerId,
          name: player.name,
          score: player.name === 'A' ? 20 : player.score,
        })),
      });

    expect(patched.status).toBe(200);
    expect(patched.body.date).toBe('2026-10-22');
    expect(
      patched.body.players.find((player: { name: string }) => player.name === 'A')?.score,
    ).toBe(20);

    const deleted = await request(app).delete(`/api/records/${item.id}`).set('Cookie', cookie);
    expect(deleted.status).toBe(204);

    const after = await request(app).get('/api/records').set('Cookie', cookie);
    expect(after.body.items).toEqual([]);

    const db = await getTestDb();
    const settlements = await db.pool.query('select count(*)::int as count from settlements');
    expect(settlements.rows[0]?.count).toBe(0);
  });

  it('defaults the date to Hong Kong today', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const created = await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .send({ players: fourPlayers() });
    expect(created.status).toBe(201);
    expect(created.body.date).toBe(hkToday());
  });

  it('rounds scores to one decimal place', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const created = await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .send({
        date: '2026-10-21',
        players: [
          { name: 'A', score: 12.34 },
          { name: 'B', score: -12.34 },
          { name: 'C', score: 0 },
          { name: 'D', score: 0 },
        ],
      });
    expect(created.status).toBe(201);
    expect(created.body.players.map((player: { score: number }) => player.score)).toEqual([
      12.3, -12.3, 0, 0,
    ]);
  });

  it('lists players sorted by name', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .send({ date: '2026-10-21', players: fourPlayers() });

    const response = await request(app).get('/api/players').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body.players.map((player: { name: string }) => player.name)).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
  });
});

describe('record validation', () => {
  it('rejects invalid create payloads', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);

    const cases = [
      { players: fourPlayers().slice(0, 3) },
      { players: [fourPlayers()[0], fourPlayers()[0], fourPlayers()[2], fourPlayers()[3]] },
      {
        players: [
          { name: '12345678', score: 1 },
          { name: 'B', score: -1 },
          { name: 'C', score: 0 },
          { name: 'D', score: 0 },
        ],
      },
      { date: '2026-02-30', players: fourPlayers() },
      {
        players: [
          { name: 'A', score: 'abc' },
          { name: 'B', score: -1 },
          { name: 'C', score: 0 },
          { name: 'D', score: 0 },
        ],
      },
      {
        players: [
          { name: 'A', score: 1_000_000_000 },
          { name: 'B', score: -1 },
          { name: 'C', score: 0 },
          { name: 'D', score: 0 },
        ],
      },
    ];

    for (const body of cases) {
      const response = await request(app).post('/api/records').set('Cookie', cookie).send(body);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION');
    }
  });

  it('rejects invalid patch and query payloads', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const created = await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .send({ date: '2026-10-21', players: fourPlayers() });

    const emptyPatch = await request(app)
      .patch(`/api/records/${created.body.id}`)
      .set('Cookie', cookie)
      .send({});
    expect(emptyPatch.status).toBe(400);

    const badId = await request(app)
      .patch('/api/records/not-a-uuid')
      .set('Cookie', cookie)
      .send({ date: '2026-10-22' });
    expect(badId.status).toBe(400);

    const badCursor = await request(app)
      .get('/api/records?cursor=not-a-cursor')
      .set('Cookie', cookie);
    expect(badCursor.status).toBe(400);

    const badLimit = await request(app).get('/api/records?limit=201').set('Cookie', cookie);
    expect(badLimit.status).toBe(400);

    const zeroLimit = await request(app).get('/api/records?limit=0').set('Cookie', cookie);
    expect(zeroLimit.status).toBe(400);
  });

  it('returns 404 for missing records', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const response = await request(app)
      .delete('/api/records/00000000-0000-4000-8000-000000000000')
      .set('Cookie', cookie);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
