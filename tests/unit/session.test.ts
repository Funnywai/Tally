import { describe, expect, it } from 'vitest';
import { SESSION_MAX_AGE_SECONDS, signSession, verifySession } from '../../src/auth/session.js';

const SECRET = 'unit-test-session-secret-0123456789abcdef';
const NOW = 1_700_000_000;

function splitToken(token: string): { payload: string; signature: string } {
  const parts = token.split('.');
  const payload = parts[0];
  const signature = parts[1];
  if (payload === undefined || signature === undefined) {
    throw new Error('Malformed token in test');
  }
  return { payload, signature };
}

describe('session tokens', () => {
  it('signs and verifies a payload', () => {
    const token = signSession(SECRET, NOW);
    expect(verifySession(token, SECRET, NOW)).toEqual({
      v: 1,
      iat: NOW,
      exp: NOW + SESSION_MAX_AGE_SECONDS,
    });
  });

  it('rejects a tampered payload', () => {
    const token = signSession(SECRET, NOW);
    const { payload, signature } = splitToken(token);
    const decoded: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof decoded !== 'object' || decoded === null) {
      throw new Error('Unexpected payload');
    }
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...decoded, exp: NOW + 999_999 }),
      'utf8',
    ).toString('base64url');
    expect(verifySession(`${tamperedPayload}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it('rejects a tampered signature', () => {
    const token = signSession(SECRET, NOW);
    const { payload } = splitToken(token);
    expect(verifySession(`${payload}.not-a-signature`, SECRET, NOW)).toBeNull();
  });

  it('rejects an expired token', () => {
    const token = signSession(SECRET, NOW);
    expect(verifySession(token, SECRET, NOW + SESSION_MAX_AGE_SECONDS)).toBeNull();
  });

  it('rejects a token signed with another secret', () => {
    const token = signSession(SECRET, NOW);
    expect(verifySession(token, `${SECRET}-other`, NOW)).toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifySession('', SECRET, NOW)).toBeNull();
    expect(verifySession('one-part', SECRET, NOW)).toBeNull();
    expect(verifySession('a.b.c', SECRET, NOW)).toBeNull();
    expect(verifySession('!!!.???', SECRET, NOW)).toBeNull();
  });
});
