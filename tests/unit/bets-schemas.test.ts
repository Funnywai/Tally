import { describe, expect, it } from 'vitest';
import { createBetSchema, patchBetSchema } from '../../src/schemas.js';

const validLeg = {
  match: '曼聯 vs 車路士',
  market: 'handicap' as const,
  selection: '曼聯 -0.5',
  odds: 1.95,
};

describe('createBetSchema', () => {
  it('accepts a single bet and applies defaults', () => {
    const parsed = createBetSchema.safeParse({ stake: 500, legs: [validLeg] });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.result).toBe('pending');
    expect(parsed.data.stake).toBe(500);
    expect(parsed.data.legs[0]?.odds).toBe(1.95);
  });

  it('rounds stake and odds to 2dp', () => {
    const parsed = createBetSchema.safeParse({
      stake: 12.345,
      legs: [{ ...validLeg, odds: 1.955 }],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.stake).toBe(12.35);
    expect(parsed.data.legs[0]?.odds).toBe(1.96);
  });

  it('rejects legs outside 1-8', () => {
    expect(createBetSchema.safeParse({ stake: 10, legs: [] }).success).toBe(false);
    expect(
      createBetSchema.safeParse({
        stake: 10,
        legs: Array.from({ length: 9 }, () => validLeg),
      }).success,
    ).toBe(false);
  });

  it('rejects invalid odds, stake, market, result, date, and text lengths', () => {
    expect(createBetSchema.safeParse({ stake: 10, legs: [{ ...validLeg, odds: 1 }] }).success).toBe(
      false,
    );
    expect(
      createBetSchema.safeParse({ stake: 10, legs: [{ ...validLeg, odds: 1000.01 }] }).success,
    ).toBe(false);
    expect(createBetSchema.safeParse({ stake: 0, legs: [validLeg] }).success).toBe(false);
    expect(createBetSchema.safeParse({ stake: 10_000_000, legs: [validLeg] }).success).toBe(false);
    expect(
      createBetSchema.safeParse({ stake: 10, legs: [{ ...validLeg, market: 'bogus' }] }).success,
    ).toBe(false);
    expect(
      createBetSchema.safeParse({ stake: 10, result: 'bogus', legs: [validLeg] }).success,
    ).toBe(false);
    expect(
      createBetSchema.safeParse({ date: '2026-02-30', stake: 10, legs: [validLeg] }).success,
    ).toBe(false);
    expect(
      createBetSchema.safeParse({
        stake: 10,
        legs: [{ ...validLeg, match: 'x'.repeat(81) }],
      }).success,
    ).toBe(false);
    expect(
      createBetSchema.safeParse({
        stake: 10,
        legs: [{ ...validLeg, selection: 'x'.repeat(61) }],
      }).success,
    ).toBe(false);
    expect(
      createBetSchema.safeParse({
        stake: 10,
        legs: [{ ...validLeg, match: 'a\u0000b' }],
      }).success,
    ).toBe(false);
  });

  it('rejects total odds above the cap', () => {
    expect(
      createBetSchema.safeParse({
        stake: 10,
        legs: [
          { ...validLeg, odds: 300 },
          { ...validLeg, odds: 400 },
        ],
      }).success,
    ).toBe(false);
  });
});

describe('patchBetSchema', () => {
  it('accepts a partial update', () => {
    expect(patchBetSchema.safeParse({ result: 'win' }).success).toBe(true);
    expect(patchBetSchema.safeParse({ legs: [validLeg] }).success).toBe(true);
  });

  it('rejects an empty patch', () => {
    expect(patchBetSchema.safeParse({}).success).toBe(false);
  });

  it('rejects total odds above the cap when legs are replaced', () => {
    expect(
      patchBetSchema.safeParse({
        legs: [
          { ...validLeg, odds: 300 },
          { ...validLeg, odds: 400 },
        ],
      }).success,
    ).toBe(false);
  });
});
