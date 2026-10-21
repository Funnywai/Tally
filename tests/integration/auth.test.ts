import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeTestDb, createTestApp, resetDb, sessionCookieFrom } from '../helpers/app.js';
import { TEST_PASSCODE } from '../helpers/config.js';

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeTestDb();
});

describe('authentication', () => {
  it('returns 401 without a cookie', async () => {
    const { app } = await createTestApp();
    const response = await request(app).get('/api/records');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { code: 'UNAUTHORIZED', message: '未授權' },
    });
  });

  it('returns 401 for a wrong passcode', async () => {
    const { app } = await createTestApp();
    const response = await request(app).post('/api/auth').send({ passcode: 'wrong' });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns the same 401 for malformed bodies', async () => {
    const { app } = await createTestApp();
    const wrong = await request(app).post('/api/auth').send({ passcode: 'wrong' });
    const missing = await request(app).post('/api/auth').send({});
    const wrongType = await request(app).post('/api/auth').send({ passcode: 123 });
    const invalidJson = await request(app)
      .post('/api/auth')
      .set('Content-Type', 'application/json')
      .send('{not json');

    for (const response of [missing, wrongType, invalidJson]) {
      expect(response.status).toBe(401);
      expect(response.body).toEqual(wrong.body);
    }
  });

  it('rate limits the sixth rapid attempt', async () => {
    const { app } = await createTestApp();
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await request(app).post('/api/auth').send({ passcode: 'wrong' });
      expect(response.status).toBe(401);
    }
    const blocked = await request(app).post('/api/auth').send({ passcode: 'wrong' });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('sets the required cookie flags and never returns the token in the body', async () => {
    const { app } = await createTestApp();
    const response = await request(app).post('/api/auth').send({ passcode: TEST_PASSCODE });

    expect(response.status).toBe(204);
    const header = response.headers['set-cookie'];
    const raw = Array.isArray(header) ? header[0] : header;
    expect(raw).toBeDefined();
    if (raw === undefined) {
      return;
    }
    expect(raw).toContain('mj_session=');
    expect(raw).toContain('HttpOnly');
    expect(raw).toContain('Secure');
    expect(raw).toContain('SameSite=Lax');
    expect(raw).toContain('Max-Age=2592000');
    expect(raw).toContain('Path=/');
    expect(response.text).toBe('');
    expect(JSON.stringify(response.body)).not.toContain('mj_session');
  });

  it('accepts the session cookie on protected routes', async () => {
    const { app } = await createTestApp();
    const login = await request(app).post('/api/auth').send({ passcode: TEST_PASSCODE });
    const cookie = sessionCookieFrom(login);
    const response = await request(app).get('/api/records').set('Cookie', cookie);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ items: [], nextCursor: null });
  });

  it('rejects a tampered cookie', async () => {
    const { app } = await createTestApp();
    const login = await request(app).post('/api/auth').send({ passcode: TEST_PASSCODE });
    const cookie = sessionCookieFrom(login);
    const token = cookie.slice('mj_session='.length);
    const dot = token.indexOf('.');
    const payload = token.slice(0, dot);
    const signature = token.slice(dot + 1);
    const tamperedSignature = `${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`;
    const tampered = `mj_session=${payload}.${tamperedSignature}`;
    const response = await request(app).get('/api/records').set('Cookie', tampered);
    expect(response.status).toBe(401);
  });

  it('clears the cookie on logout and subsequent unauthenticated calls fail', async () => {
    const { app } = await createTestApp();
    const login = await request(app).post('/api/auth').send({ passcode: TEST_PASSCODE });
    const cookie = sessionCookieFrom(login);

    const logout = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(logout.status).toBe(204);
    const header = logout.headers['set-cookie'];
    const raw = Array.isArray(header) ? header[0] : header;
    expect(raw).toContain('Max-Age=0');

    const after = await request(app).get('/api/records');
    expect(after.status).toBe(401);
  });

  it('rejects non-JSON bodies with 415', async () => {
    const { app } = await createTestApp();
    const login = await request(app).post('/api/auth').send({ passcode: TEST_PASSCODE });
    const cookie = sessionCookieFrom(login);
    const response = await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .set('Content-Type', 'text/plain')
      .send('hello');
    expect(response.status).toBe(415);
    expect(response.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects bodies over 32kb with 413', async () => {
    const { app } = await createTestApp();
    const login = await request(app).post('/api/auth').send({ passcode: TEST_PASSCODE });
    const cookie = sessionCookieFrom(login);
    const response = await request(app)
      .post('/api/records')
      .set('Cookie', cookie)
      .send({
        date: '2026-10-21',
        players: [
          { name: 'A', score: 1 },
          { name: 'B', score: -1 },
          { name: 'C', score: 0 },
          { name: 'D', score: 0 },
        ],
        padding: 'x'.repeat(40_000),
      });
    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('health and static', () => {
  it('reports health without auth and disables caching', async () => {
    const { app } = await createTestApp();
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, db: true });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('sets security headers and hides x-powered-by', async () => {
    const { app } = await createTestApp();
    const response = await request(app).get('/api/health');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('same-origin');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('serves the placeholder and SPA fallback with no-cache', async () => {
    const { app } = await createTestApp();
    const root = await request(app).get('/');
    expect(root.status).toBe(200);
    expect(root.headers['content-type']).toContain('text/html');
    expect(root.headers['cache-control']).toBe('no-cache');

    const fallback = await request(app).get('/ledger');
    expect(fallback.status).toBe(200);
    expect(fallback.headers['cache-control']).toBe('no-cache');
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const { app } = await createTestApp();
    const response = await request(app).get('/api/nope');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
