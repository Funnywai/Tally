import { type AppConfig, loadConfig } from '../../src/config.js';

const DEFAULT_TEST_DATABASE_URL = 'postgres://tally:test@127.0.0.1:5433/tally_test';

export function resolveTestDatabaseUrl(raw: string | undefined): string {
  const url = raw ?? DEFAULT_TEST_DATABASE_URL;
  let databaseName: string;
  try {
    databaseName = new URL(url).pathname.replace(/^\/+|\/+$/g, '');
  } catch {
    throw new Error('TEST_DATABASE_URL is not a valid URL');
  }
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests against database "${databaseName}": the name must end with _test`,
    );
  }
  return url;
}

// Never fall back to DATABASE_URL: a shell that loaded a production .env must not
// let `pnpm test` truncate production tables.
export const TEST_DATABASE_URL = resolveTestDatabaseUrl(process.env.TEST_DATABASE_URL);

export const TEST_PASSCODE = 'test-passcode-0123456789abcdef0123456789';
export const TEST_SESSION_SECRET = 'test-session-secret-0123456789abcdef0123';

export interface ConfigOverrides {
  readonly cookieSecure?: boolean;
  readonly appPasscode?: string;
  readonly sessionSecret?: string;
}

export function makeConfig(overrides: ConfigOverrides = {}): AppConfig {
  return loadConfig({
    NODE_ENV: 'test',
    PORT: '3000',
    TZ: 'Asia/Hong_Kong',
    LOG_LEVEL: 'silent',
    DATABASE_URL: TEST_DATABASE_URL,
    APP_PASSCODE: overrides.appPasscode ?? TEST_PASSCODE,
    SESSION_SECRET: overrides.sessionSecret ?? TEST_SESSION_SECRET,
    COOKIE_SECURE: String(overrides.cookieSecure ?? true),
  });
}
