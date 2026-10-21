import { describe, expect, it } from 'vitest';
import {
  createRecordSchema,
  dateSchema,
  nameSchema,
  patchRecordSchema,
  scoreSchema,
  statsQuerySchema,
} from '../../src/schemas.js';

function player(name: string, score: number): { name: string; score: number } {
  return { name, score };
}

describe('boundary schemas', () => {
  it('trims names and accepts 1–7 code points', () => {
    expect(nameSchema.parse('  Alice  ')).toBe('Alice');
    expect(nameSchema.safeParse('一二三四五六七').success).toBe(true);
    expect(nameSchema.safeParse('😀😀😀😀😀😀😀').success).toBe(true);
  });

  it('rejects empty, 8-code-point, and whitespace-only names', () => {
    expect(nameSchema.safeParse('').success).toBe(false);
    expect(nameSchema.safeParse('   ').success).toBe(false);
    expect(nameSchema.safeParse('一二三四五六七八').success).toBe(false);
    expect(nameSchema.safeParse('😀😀😀😀😀😀😀😀').success).toBe(false);
  });

  it('accepts finite scores only', () => {
    expect(scoreSchema.safeParse(12.5).success).toBe(true);
    expect(scoreSchema.safeParse(-3).success).toBe(true);
    expect(scoreSchema.safeParse(0).success).toBe(true);
    expect(scoreSchema.safeParse(999_999_999.9).success).toBe(true);
    expect(scoreSchema.safeParse(-999_999_999.9).success).toBe(true);
    expect(scoreSchema.safeParse(Number.NaN).success).toBe(false);
    expect(scoreSchema.safeParse(Number.POSITIVE_INFINITY).success).toBe(false);
    expect(scoreSchema.safeParse(1_000_000_000).success).toBe(false);
    expect(scoreSchema.safeParse(-1_000_000_000).success).toBe(false);
  });

  it('accepts real calendar dates only', () => {
    expect(dateSchema.safeParse('2026-10-21').success).toBe(true);
    expect(dateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(dateSchema.safeParse('21-10-2026').success).toBe(false);
  });

  it('requires exactly four unique players on create', () => {
    const valid = createRecordSchema.safeParse({
      date: '2026-10-21',
      players: [player('A', 1), player('B', -1), player('C', 0), player('D', 0)],
    });
    expect(valid.success).toBe(true);

    const duplicate = createRecordSchema.safeParse({
      players: [player('A', 1), player('A', -1), player('C', 0), player('D', 0)],
    });
    expect(duplicate.success).toBe(false);

    const three = createRecordSchema.safeParse({
      players: [player('A', 1), player('B', -1), player('C', 0)],
    });
    expect(three.success).toBe(false);
  });

  it('requires at least one field on patch', () => {
    expect(patchRecordSchema.safeParse({}).success).toBe(false);
    expect(patchRecordSchema.safeParse({ date: '2026-10-21' }).success).toBe(true);
  });

  it('accepts 2–8 players on patch and allows null playerId', () => {
    const two = patchRecordSchema.safeParse({
      players: [player('A', 1), player('B', -1)],
    });
    expect(two.success).toBe(true);

    const eight = patchRecordSchema.safeParse({
      players: Array.from({ length: 8 }, (_, index) => player(`P${index}`, index)),
    });
    expect(eight.success).toBe(true);

    const nine = patchRecordSchema.safeParse({
      players: Array.from({ length: 9 }, (_, index) => player(`P${index}`, index)),
    });
    expect(nine.success).toBe(false);

    const nullId = patchRecordSchema.safeParse({
      players: [
        { playerId: null, name: 'A', score: 1 },
        { playerId: '00000000-0000-4000-8000-000000000000', name: 'B', score: -1 },
      ],
    });
    expect(nullId.success).toBe(true);
  });

  it('validates stats query parameters', () => {
    expect(statsQuerySchema.safeParse({ player: 'Alice' }).success).toBe(true);
    expect(statsQuerySchema.safeParse({ player: '   ' }).success).toBe(false);
    expect(statsQuerySchema.safeParse({ player: 'Alice', year: '2026' }).success).toBe(true);
    expect(statsQuerySchema.safeParse({ player: 'Alice', year: '26' }).success).toBe(false);
    expect(statsQuerySchema.safeParse({ player: 'Alice', year: '1800' }).success).toBe(false);
  });
});
