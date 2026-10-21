import type { Express } from 'express';
import request from 'supertest';
import { sessionCookieFrom } from './app.js';
import { TEST_PASSCODE } from './config.js';

export async function login(app: Express): Promise<string> {
  const response = await request(app).post('/api/auth').send({ passcode: TEST_PASSCODE });
  return sessionCookieFrom(response);
}

export function fourPlayers(prefix = ''): { name: string; score: number }[] {
  return [
    { name: `A${prefix}`, score: 12.5 },
    { name: `B${prefix}`, score: -12.5 },
    { name: `C${prefix}`, score: 0 },
    { name: `D${prefix}`, score: 0 },
  ];
}
