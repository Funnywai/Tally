import { createServer } from 'node:http';
import path from 'node:path';
import { createApp } from './app.js';
import { type AppConfig, loadConfig } from './config.js';
import { createDb, type Db } from './db.js';
import { createLogger, type Logger } from './logger.js';
import { runMigrations } from './migrate.js';

const CONNECT_ATTEMPTS = 10;
const CONNECT_DELAY_MS = 2_000;

async function waitForDatabase(db: Db, logger: Logger): Promise<void> {
  for (let attempt = 1; attempt <= CONNECT_ATTEMPTS; attempt += 1) {
    if (await db.health()) {
      return;
    }
    logger.warn({ attempt, attempts: CONNECT_ATTEMPTS }, 'database not ready, retrying');
    await new Promise((resolve) => setTimeout(resolve, CONNECT_DELAY_MS));
  }
  throw new Error('Database did not become ready');
}

async function main(): Promise<void> {
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
    await waitForDatabase(db, logger);
    const migrationsDir = process.env.MIGRATIONS_DIR ?? path.resolve(process.cwd(), 'migrations');
    await runMigrations(db.pool, migrationsDir, logger);

    const publicDir = process.env.PUBLIC_DIR ?? path.resolve(process.cwd(), 'public');
    const app = createApp({ config, db, logger, publicDir });
    const server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(config.port, () => {
        server.off('error', reject);
        resolve();
      });
    });
    logger.info({ port: config.port }, 'server listening');

    let shuttingDown = false;
    const shutdown = (signal: string): void => {
      if (shuttingDown) {
        return;
      }
      shuttingDown = true;
      logger.info({ signal }, 'shutting down');
      server.close(() => {
        void db.close().finally(() => process.exit(0));
      });
      setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logger.error({ err: error }, 'startup failed');
    await db.close();
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Startup failed'}\n`);
  process.exitCode = 1;
});
