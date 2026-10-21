import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeTestDb, getTestDb, resetDb } from '../helpers/app.js';
import { TEST_DATABASE_URL } from '../helpers/config.js';

const SCRIPT = path.resolve(process.cwd(), 'scripts/import-firebase-json.mjs');
const FIXTURE = path.resolve(process.cwd(), 'tests/fixtures/firebase-sample.json');

function runImport(args: string[]): string {
  return execFileSync(process.execPath, [SCRIPT, FIXTURE, ...args], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    encoding: 'utf8',
  });
}

async function counts(): Promise<{ games: number; settlements: number; players: number }> {
  const db = await getTestDb();
  const result = await db.pool.query<{
    games: number;
    settlements: number;
    players: number;
  }>(
    `select (select count(*)::int from games) as games,
            (select count(*)::int from settlements) as settlements,
            (select count(*)::int from players) as players`,
  );
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error('Count query returned no row');
  }
  return row;
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closeTestDb();
});

describe('firebase import script', () => {
  it('imports the fixture and is idempotent on rerun', async () => {
    const first = runImport([]);
    expect(first).toContain('4 inserted, 0 skipped, 2 warnings');
    expect(first).toContain('Names containing "_"');
    expect(await counts()).toEqual({ games: 4, settlements: 14, players: 5 });

    const second = runImport([]);
    expect(second).toContain('0 inserted, 4 skipped, 2 warnings');
    expect(await counts()).toEqual({ games: 4, settlements: 14, players: 5 });
  });

  it('reconciles totals with --verify', async () => {
    runImport([]);
    const output = runImport(['--verify']);
    expect(output).toContain('verify: 0 differences across 5 players');
  });

  it('does not write in --dry-run mode', async () => {
    const output = runImport(['--dry-run']);
    expect(output).toContain('dry-run: 4 valid, 2 warnings, 0 writes');
    expect(await counts()).toEqual({ games: 0, settlements: 0, players: 0 });
  });
});
