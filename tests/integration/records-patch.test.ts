import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeTestDb, createTestApp, getTestDb, resetDb } from '../helpers/app.js';
import { fourPlayers, login } from '../helpers/records.js';

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeTestDb();
});

describe('record patching semantics', () => {
  it('renames a player globally and updates history everywhere', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);

    const first = await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .send({ date: '2026-10-20', players: fourPlayers() });
    const second = await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .send({ date: '2026-10-21', players: fourPlayers() });

    const alice = first.body.players.find((player: { name: string }) => player.name === 'A');
    const patched = await request(app)
      .patch(`/api/records/${first.body.id}`)
      .set('Cookie', cookie)
      .send({
        players: first.body.players.map(
          (player: { playerId: string; name: string; score: number }) => ({
            playerId: player.playerId,
            name: player.name === 'A' ? 'Alicia' : player.name,
            score: player.score,
          }),
        ),
      });

    expect(patched.status).toBe(200);
    expect(
      patched.body.players.find((player: { name: string }) => player.name === 'Alicia')?.playerId,
    ).toBe(alice.playerId);

    const secondAfter = await request(app).get('/api/records').set('Cookie', cookie);
    const secondItem = secondAfter.body.items.find(
      (item: { id: string }) => item.id === second.body.id,
    );
    expect(secondItem.players.some((player: { name: string }) => player.name === 'Alicia')).toBe(
      true,
    );
    expect(secondItem.players.some((player: { name: string }) => player.name === 'A')).toBe(false);

    const playersResponse = await request(app).get('/api/players').set('Cookie', cookie);
    const names = playersResponse.body.players.map((player: { name: string }) => player.name);
    expect(names).toContain('Alicia');
    expect(names).not.toContain('A');

    const stats = await request(app)
      .get('/api/stats?player=Alicia&year=2026')
      .set('Cookie', cookie);
    expect(stats.body.allTimeGames).toBe(2);

    const oldStats = await request(app).get('/api/stats?player=A&year=2026').set('Cookie', cookie);
    expect(oldStats.body.allTimeGames).toBe(0);
  });

  it('rejects renaming to a player in the same record', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const created = await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .send({ date: '2026-10-21', players: fourPlayers() });

    const before = created.body;
    const response = await request(app)
      .patch(`/api/records/${created.body.id}`)
      .set('Cookie', cookie)
      .send({
        players: created.body.players.map(
          (player: { playerId: string; name: string; score: number }) => ({
            playerId: player.playerId,
            name: player.name === 'A' ? 'B' : player.name,
            score: player.score,
          }),
        ),
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');

    const after = await request(app).get('/api/records').set('Cookie', cookie);
    const item = after.body.items.find((entry: { id: string }) => entry.id === created.body.id);
    expect(item.players).toHaveLength(4);
    expect(item.players.map((player: { name: string }) => player.name).sort()).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
    for (const player of before.players) {
      const current = item.players.find(
        (entry: { name: string; playerId: string; score: number }) => entry.name === player.name,
      );
      expect(current?.playerId).toBe(player.playerId);
      expect(current?.score).toBe(player.score);
    }

    const playersResponse = await request(app).get('/api/players').set('Cookie', cookie);
    const names = playersResponse.body.players.map((player: { name: string }) => player.name);
    expect(names).toContain('A');
    expect(names).toContain('B');
  });

  it('merges a player into a name that exists in another record', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const first = await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .send({ date: '2026-10-20', players: fourPlayers() });
    const second = await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .send({ date: '2026-10-21', players: fourPlayers('2') });

    const target = second.body.players.find((player: { name: string }) => player.name === 'A2');
    const response = await request(app)
      .patch(`/api/records/${first.body.id}`)
      .set('Cookie', cookie)
      .send({
        players: first.body.players.map(
          (player: { playerId: string; name: string; score: number }) => ({
            playerId: player.playerId,
            name: player.name === 'A' ? 'A2' : player.name,
            score: player.score,
          }),
        ),
      });

    expect(response.status).toBe(200);
    expect(response.body.players).toHaveLength(4);
    const merged = response.body.players.find((player: { name: string }) => player.name === 'A2');
    expect(merged.playerId).toBe(target.playerId);
    expect(merged.score).toBe(12.5);

    const stats = await request(app).get('/api/stats?player=A2&year=2026').set('Cookie', cookie);
    expect(stats.body.allTimeGames).toBe(2);
    const old = await request(app).get('/api/stats?player=A&year=2026').set('Cookie', cookie);
    expect(old.body.allTimeGames).toBe(0);
  });

  it('rejects two rows that resolve to the same player in another record', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const first = await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .send({ date: '2026-10-20', players: fourPlayers() });
    await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .send({ date: '2026-10-21', players: fourPlayers('2') });

    const response = await request(app)
      .patch(`/api/records/${first.body.id}`)
      .set('Cookie', cookie)
      .send({
        players: first.body.players.map(
          (player: { playerId: string; name: string; score: number }) => ({
            playerId: player.playerId,
            name: player.name === 'A' || player.name === 'B' ? 'A2' : player.name,
            score: player.score,
          }),
        ),
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');

    const after = await request(app).get('/api/records').set('Cookie', cookie);
    const item = after.body.items.find((entry: { id: string }) => entry.id === first.body.id);
    expect(item.players).toHaveLength(4);
    expect(item.players.map((player: { name: string }) => player.name).sort()).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
    for (const player of first.body.players) {
      const current = item.players.find(
        (entry: { name: string; playerId: string; score: number }) => entry.name === player.name,
      );
      expect(current?.playerId).toBe(player.playerId);
      expect(current?.score).toBe(player.score);
    }
  });

  it('rejects a no-playerId row that resolves to a player already in the record', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const created = await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .send({ date: '2026-10-21', players: fourPlayers() });

    const alice = created.body.players.find((player: { name: string }) => player.name === 'A');
    const response = await request(app)
      .patch(`/api/records/${created.body.id}`)
      .set('Cookie', cookie)
      .send({
        players: [
          { playerId: alice.playerId, name: 'A', score: alice.score },
          { name: 'A', score: 5 },
        ],
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');

    const after = await request(app).get('/api/records').set('Cookie', cookie);
    const item = after.body.items.find((entry: { id: string }) => entry.id === created.body.id);
    expect(item.players).toHaveLength(4);

    const db = await getTestDb();
    const settlements = await db.pool.query('select count(*)::int as count from settlements');
    expect(settlements.rows[0]?.count).toBe(4);
  });

  it('rejects a playerId that does not belong to the record', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const first = await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .send({ date: '2026-10-20', players: fourPlayers() });
    const second = await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .send({ date: '2026-10-21', players: fourPlayers('2') });

    const foreign = second.body.players[0];
    const response = await request(app)
      .patch(`/api/records/${first.body.id}`)
      .set('Cookie', cookie)
      .send({
        players: [
          { playerId: foreign.playerId, name: foreign.name, score: 1 },
          { playerId: first.body.players[1].playerId, name: 'B', score: -1 },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION');
  });

  it('returns 409 for duplicate players in the same record', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const created = await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .send({ date: '2026-10-21', players: fourPlayers() });

    const response = await request(app)
      .patch(`/api/records/${created.body.id}`)
      .set('Cookie', cookie)
      .send({
        players: [
          { name: 'X', score: 1 },
          { name: 'X', score: 2 },
        ],
      });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('replaces the settlement set when players are provided', async () => {
    const { app } = await createTestApp();
    const cookie = await login(app);
    const created = await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .send({ date: '2026-10-21', players: fourPlayers() });

    const response = await request(app)
      .patch(`/api/records/${created.body.id}`)
      .set('Cookie', cookie)
      .send({
        players: [
          { playerId: created.body.players[0].playerId, name: 'A', score: 5 },
          { playerId: created.body.players[1].playerId, name: 'B', score: -5 },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.players).toHaveLength(2);

    const db = await getTestDb();
    const settlements = await db.pool.query('select count(*)::int as count from settlements');
    expect(settlements.rows[0]?.count).toBe(2);
  });
});
