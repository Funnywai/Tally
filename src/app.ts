import path from 'node:path';
import express, { type Express } from 'express';
import { requireAuth } from './auth/middleware.js';
import type { AppConfig } from './config.js';
import type { Db } from './db.js';
import {
  apiNoStore,
  apiNotFound,
  errorHandler,
  jsonOnly,
  requestLogger,
  securityHeaders,
} from './http/middleware.js';
import { mountStatic } from './http/static.js';
import type { Logger } from './logger.js';
import { createAuthRouter } from './routes/auth.js';
import { createBetsRouter } from './routes/bets.js';
import { createHealthRouter } from './routes/health.js';
import { createPlayersRouter } from './routes/players.js';
import { createRankingRouter } from './routes/ranking.js';
import { createRecordsRouter } from './routes/records.js';
import { createStatsRouter } from './routes/stats.js';

export interface AppDeps {
  readonly config: AppConfig;
  readonly db: Db;
  readonly logger: Logger;
  readonly publicDir?: string;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');

  app.use(securityHeaders);
  app.use(apiNoStore);
  app.use(requestLogger(deps.logger));
  app.use(jsonOnly);
  app.use(express.json({ limit: '32kb' }));

  app.use('/api/health', createHealthRouter(deps.db));
  app.use('/api/auth', createAuthRouter(deps.config));

  const auth = requireAuth(deps.config);
  app.use('/api/records', auth, createRecordsRouter(deps.db));
  app.use('/api/bets', auth, createBetsRouter(deps.db));
  app.use('/api/players', auth, createPlayersRouter(deps.db));
  app.use('/api/stats', auth, createStatsRouter(deps.db));
  app.use('/api/ranking', auth, createRankingRouter(deps.db));
  app.use('/api', apiNotFound);

  mountStatic(app, deps.publicDir ?? path.resolve(process.cwd(), 'public'));
  app.use(apiNotFound);
  app.use(errorHandler(deps.logger));

  return app;
}
