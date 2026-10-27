import path from 'node:path';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import type { AppConfig } from '../../src/config.js';
import { createDb, type Db } from '../../src/db.js';
import { createLogger } from '../../src/logger.js';
import { runMigrations } from '../../src/migrate.js';
import { type ConfigOverrides, makeConfig, TEST_DATABASE_URL } from './config.js';

let sharedDb: Db | null = null;

export async function getTestDb(): Promise<Db> {
  if (sharedDb === null) {
    sharedDb = createDb(TEST_DATABASE_URL);
    await runMigrations(sharedDb.pool, path.resolve(process.cwd(), 'migrations'));
  }
  return sharedDb;
}

export async function resetDb(): Promise<void> {
  const db = await getTestDb();
  await db.pool.query(
    'truncate table bet_legs, bets, settlements, games, players restart identity cascade',
  );
}

export async function closeTestDb(): Promise<void> {
  if (sharedDb !== null) {
    await sharedDb.close();
    sharedDb = null;
  }
}

export interface TestApp {
  readonly app: Express;
  readonly db: Db;
  readonly config: AppConfig;
}

export async function createTestApp(overrides: ConfigOverrides = {}): Promise<TestApp> {
  const db = await getTestDb();
  const config = makeConfig(overrides);
  const logger = createLogger(config);
  const app = createApp({
    config,
    db,
    logger,
    publicDir: path.resolve(process.cwd(), 'public'),
  });
  return { app, db, config };
}

export function sessionCookieFrom(response: {
  headers: Record<string, string | string[] | undefined>;
}): string {
  const header = response.headers['set-cookie'];
  const raw = Array.isArray(header) ? header[0] : header;
  if (raw === undefined) {
    throw new Error('Expected a Set-Cookie header');
  }
  const pair = raw.split(';')[0];
  if (pair === undefined) {
    throw new Error('Malformed Set-Cookie header');
  }
  return pair;
}
