#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import {
  collectUnderscoreNames,
  computeExpectedTotals,
  extractRecords,
  mapRecord,
} from './lib/firebase-import.mjs';

const { Pool } = pg;

function parseArgs(argv) {
  const file = argv.find((arg) => !arg.startsWith('--'));
  return {
    file,
    dryRun: argv.includes('--dry-run'),
    verify: argv.includes('--verify'),
  };
}

async function insertRecord(pool, value) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const game = await client.query(
      `insert into games (played_at, recorded_at, external_id)
       values ($1, $2, $3)
       on conflict (external_id) do nothing
       returning id`,
      [value.playedAt, value.recordedAt, value.externalId],
    );
    if (game.rows.length === 0) {
      await client.query('commit');
      return 'skipped';
    }

    const gameId = game.rows[0].id;
    for (const player of value.players) {
      const inserted = await client.query(
        `insert into players (name) values ($1)
         on conflict (name) do update set name = excluded.name
         returning id`,
        [player.name],
      );
      await client.query(
        'insert into settlements (game_id, player_id, score) values ($1, $2, $3)',
        [gameId, inserted.rows[0].id, player.score],
      );
    }

    await client.query('commit');
    return 'inserted';
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function loadSamples(pool, keys) {
  if (keys.length === 0) {
    return new Map();
  }
  const result = await pool.query(
    `select g.external_id, to_char(g.played_at, 'YYYY-MM-DD') as played_at, p.name, s.score
       from games g
       join settlements s on s.game_id = g.id
       join players p on p.id = s.player_id
      where g.external_id = any($1::text[])
      order by g.external_id, p.name`,
    [keys],
  );
  const samples = new Map();
  for (const row of result.rows) {
    const entry = samples.get(row.external_id) ?? { date: row.played_at, players: {} };
    entry.players[row.name] = Number(row.score);
    samples.set(row.external_id, entry);
  }
  return samples;
}

async function verify(pool, records, nowMs) {
  const expected = computeExpectedTotals(records, nowMs);
  const result = await pool.query(
    `select p.name, sum(s.score)::text as total
       from settlements s
       join players p on p.id = s.player_id
      group by p.name`,
  );
  const actual = new Map(result.rows.map((row) => [row.name, Number(row.total)]));
  const names = [...new Set([...expected.keys(), ...actual.keys()])].sort();

  let differences = 0;
  for (const name of names) {
    const expectedTotal = expected.get(name) ?? 0;
    const actualTotal = actual.get(name) ?? 0;
    const diff = Math.abs(expectedTotal - actualTotal);
    if (diff > 0.05) {
      differences += 1;
      console.log(
        `DIFF ${name}: expected ${expectedTotal.toFixed(1)} actual ${actualTotal.toFixed(1)} diff ${diff.toFixed(1)}`,
      );
    }
  }

  if (differences === 0) {
    console.log(`verify: 0 differences across ${names.length} players`);
    return true;
  }
  console.log(`verify: ${differences} player(s) differ`);
  return false;
}

async function main() {
  const { file, dryRun, verify: shouldVerify } = parseArgs(process.argv.slice(2));
  if (file === undefined) {
    console.error('Usage: node scripts/import-firebase-json.mjs <path> [--dry-run] [--verify]');
    process.exitCode = 1;
    return;
  }
  if (dryRun && shouldVerify) {
    console.error('--dry-run and --verify cannot be combined');
    process.exitCode = 1;
    return;
  }

  const parsed = JSON.parse(await readFile(file, 'utf8'));
  const records = extractRecords(parsed);
  const nowMs = Date.now();
  const entries = Object.entries(records);

  const underscoreNames = collectUnderscoreNames(records, nowMs);
  if (underscoreNames.length > 0) {
    console.log(`Names containing "_" (manual review): ${underscoreNames.join(', ')}`);
  }

  if (dryRun) {
    let valid = 0;
    let warnings = 0;
    for (const [key, record] of entries) {
      const mapped = mapRecord(key, record, nowMs);
      if (mapped.ok) {
        valid += 1;
      } else {
        warnings += 1;
        console.log(`WARN ${key}: ${mapped.reason}`);
      }
    }
    console.log(`dry-run: ${valid} valid, ${warnings} warnings, 0 writes`);
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl === '') {
    console.error('DATABASE_URL is required');
    process.exitCode = 1;
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl, application_name: 'tally-import' });
  let inserted = 0;
  let skipped = 0;
  let warnings = 0;
  const sampleKeys = [];

  try {
    for (const [key, record] of entries) {
      const mapped = mapRecord(key, record, nowMs);
      if (!mapped.ok) {
        warnings += 1;
        console.log(`WARN ${key}: ${mapped.reason}`);
        continue;
      }
      try {
        const outcome = await insertRecord(pool, mapped.value);
        if (outcome === 'inserted') {
          inserted += 1;
          if (sampleKeys.length < 5) {
            sampleKeys.push(mapped.value.externalId);
          }
        } else {
          skipped += 1;
        }
      } catch (error) {
        warnings += 1;
        console.log(`WARN ${key}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(`import: ${inserted} inserted, ${skipped} skipped, ${warnings} warnings`);

    const samples = await loadSamples(pool, sampleKeys);
    for (const [index, key] of sampleKeys.entries()) {
      const mapped = mapRecord(key, records[key], nowMs);
      const dbSample = samples.get(key);
      console.log(`Sample ${index + 1}: ${key}`);
      console.log(
        `  JSON: date=${mapped.ok ? mapped.value.playedAt : '?'} players=${JSON.stringify(
          mapped.ok ? Object.fromEntries(mapped.value.players.map((p) => [p.name, p.score])) : {},
        )}`,
      );
      console.log(
        `  DB:   date=${dbSample?.date ?? '?'} players=${JSON.stringify(dbSample?.players ?? {})}`,
      );
    }

    if (shouldVerify) {
      const ok = await verify(pool, records, nowMs);
      if (!ok) {
        process.exitCode = 1;
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
