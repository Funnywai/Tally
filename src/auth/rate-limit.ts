export interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterSeconds: number;
}

export interface RateLimiterOptions {
  readonly limit?: number;
  readonly windowMs?: number;
  readonly now?: () => number;
}

export type RateLimiter = (key: string) => RateLimitResult;

export function createRateLimiter(options: RateLimiterOptions = {}): RateLimiter {
  const limit = options.limit ?? 5;
  const windowMs = options.windowMs ?? 60_000;
  const now = options.now ?? Date.now;
  const hits = new Map<string, number[]>();

  return (key: string): RateLimitResult => {
    const current = now();
    const cutoff = current - windowMs;
    const timestamps = (hits.get(key) ?? []).filter((timestamp) => timestamp > cutoff);

    if (timestamps.length >= limit) {
      const oldest = timestamps[0] ?? current;
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + windowMs - current) / 1000));
      hits.set(key, timestamps);
      return { allowed: false, retryAfterSeconds };
    }

    timestamps.push(current);
    hits.set(key, timestamps);

    if (hits.size > 10_000) {
      for (const [entryKey, entryTimestamps] of hits) {
        if (entryTimestamps.every((timestamp) => timestamp <= cutoff)) {
          hits.delete(entryKey);
        }
      }
    }

    return { allowed: true, retryAfterSeconds: 0 };
  };
}
