import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config.js';

const base = {
  NODE_ENV: 'production',
  PORT: '3000',
  TZ: 'Asia/Hong_Kong',
  LOG_LEVEL: 'silent',
  DATABASE_URL: 'postgres://tally:secret@db:5432/tally',
  APP_PASSCODE: 'a'.repeat(32),
  SESSION_SECRET: 'b'.repeat(32),
  COOKIE_SECURE: 'true',
} as const;

function env(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return { ...base, ...overrides };
}

describe('environment configuration', () => {
  it('accepts a valid production configuration', () => {
    const config = loadConfig(env());
    expect(config.nodeEnv).toBe('production');
    expect(config.cookieSecure).toBe(true);
    expect(config.appPasscode).toBe(base.APP_PASSCODE);
  });

  it('rejects a short production passcode', () => {
    expect(() => loadConfig(env({ APP_PASSCODE: 'short' }))).toThrow(/APP_PASSCODE/);
  });

  it('rejects an insecure production cookie', () => {
    expect(() => loadConfig(env({ COOKIE_SECURE: 'false' }))).toThrow(/COOKIE_SECURE/);
  });

  it('rejects identical passcode and session secret', () => {
    expect(() => loadConfig(env({ SESSION_SECRET: base.APP_PASSCODE }))).toThrow(/SESSION_SECRET/);
  });

  it('rejects a short session secret', () => {
    expect(() => loadConfig(env({ SESSION_SECRET: 'short' }))).toThrow(/SESSION_SECRET/);
  });

  it('rejects a non-Hong-Kong timezone', () => {
    expect(() => loadConfig(env({ TZ: 'UTC' }))).toThrow(/TZ/);
  });

  it('allows a short passcode and insecure cookie in development', () => {
    const config = loadConfig(
      env({ NODE_ENV: 'development', APP_PASSCODE: 'short', COOKIE_SECURE: 'false' }),
    );
    expect(config.nodeEnv).toBe('development');
    expect(config.cookieSecure).toBe(false);
  });
});
