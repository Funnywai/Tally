import { createHash, timingSafeEqual } from 'node:crypto';

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function passcodeMatches(input: string, expected: string): boolean {
  return timingSafeEqual(sha256(input), sha256(expected));
}
