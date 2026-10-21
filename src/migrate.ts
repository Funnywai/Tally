import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Pool } from 'pg';
import { type AppConfig, loadConfig } from './config.js';
import { createDb } from './db.js';
import { createLogger, type Logger } from './logger.js';

const MIGRATION_LOCK_KEY = 7_465_116_001;

export async function runMigrations(
  pool: Pool,
  migrationsDir: string,
  logger?: Logger,
): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];

  try {
    await client.query('select pg_advisory_lock($1::bigint)', [MIGRATION_LOCK_KEY]);
    await client.query(`
      create table if not exists schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const files = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql')).sort();
    const existing = await client.query<{ version: string }>(
      'select version from schema_migrations',
    );
    const alreadyApplied = new Set(existing.rows.map((row) => row.version));

    for (const file of files) {
      if (alreadyApplied.has(file)) {
        continue;
      }
      const sql = await readFile(path.join(migrationsDir, file), 'utf8');
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (version) values ($1)', [file]);
        await client.query('commit');
        applied.push(file);
        logger?.info({ migration: file }, 'migration applied');
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }

    return applied;
  } finally {
    try {
      await client.query('select pg_advisory_unlock($1::bigint)', [MIGRATION_LOCK_KEY]);
    } catch (error) {
      logger?.warn({ err: error }, 'failed to release migration advisory lock');
    }
    client.release();
  }
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

async function runCli(): Promise<void> {
  let config: AppConfig;
  try {
    config = loadConfig();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Invalid environment configuration'}\n`,
    );
    process.exitCode = 1;
    return;
  }

  const logger = createLogger(config);
  const db = createDb(config.databaseUrl);
  try {
    const migrationsDir = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), 'migrations');
    const applied = await runMigrations(db.pool, migrationsDir, logger);
    logger.info({ applied }, 'migrations complete');
  } catch (error) {
    logger.error({ err: error }, 'migration failed');
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}

if (isMain) {
  await runCli();
}
