import { describe, expect, it } from 'vitest';
import { resolveTestDatabaseUrl } from '../helpers/config.js';

describe('test database safety guard', () => {
  it('accepts a database ending in _test', () => {
    const url = 'postgres://tally:test@127.0.0.1:5433/tally_test';
    expect(resolveTestDatabaseUrl(url)).toBe(url);
  });

  it('accepts the default when the environment variable is undefined', () => {
    expect(resolveTestDatabaseUrl(undefined)).toContain('/tally_test');
  });

  it('rejects a database without the _test suffix', () => {
    expect(() => resolveTestDatabaseUrl('postgres://tally:test@127.0.0.1:5433/tally')).toThrow(
      /end with _test/,
    );
  });

  it('rejects an invalid URL', () => {
    expect(() => resolveTestDatabaseUrl('not-a-url')).toThrow(/valid URL/);
  });
});
