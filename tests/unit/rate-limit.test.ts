import { describe, expect, it } from 'vitest';
import { createRateLimiter } from '../../src/auth/rate-limit.js';

describe('auth rate limiter', () => {
  it('allows five attempts per window and blocks the sixth', () => {
    const now = 1_000_000;
    const limiter = createRateLimiter({ now: () => now });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect(limiter('1.2.3.4').allowed).toBe(true);
    }

    const blocked = limiter('1.2.3.4');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it('resets after the window elapses', () => {
    let now = 1_000_000;
    const limiter = createRateLimiter({ now: () => now });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      limiter('1.2.3.4');
    }
    expect(limiter('1.2.3.4').allowed).toBe(false);

    now += 60_001;
    expect(limiter('1.2.3.4').allowed).toBe(true);
  });

  it('tracks clients independently', () => {
    const limiter = createRateLimiter({ now: () => 1_000_000 });
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      limiter('1.2.3.4');
    }
    expect(limiter('1.2.3.4').allowed).toBe(false);
    expect(limiter('5.6.7.8').allowed).toBe(true);
  });
});
