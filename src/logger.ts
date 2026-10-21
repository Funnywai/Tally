import { type Logger, pino } from 'pino';
import type { AppConfig } from './config.js';

export type { Logger };

export function createLogger(config: Pick<AppConfig, 'logLevel'>): Logger {
  return pino({
    level: config.logLevel,
    base: { service: 'tally' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'req.headers["set-cookie"]',
        'res.headers["set-cookie"]',
        'passcode',
        'password',
        'secret',
        'databaseUrl',
        'connectionString',
        'DATABASE_URL',
        'err.databaseUrl',
        'err.password',
        'err.secret',
        'err.connectionString',
        'err.options',
        'err.options.connectionString',
        'err.config',
        'err.config.connectionString',
      ],
      censor: '[redacted]',
    },
  });
}
