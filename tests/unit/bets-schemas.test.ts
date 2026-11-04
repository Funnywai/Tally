import { describe, expect, it } from 'vitest';
import { createBetSchema, importBetItemSchema, patchBetSchema } from '../../src/schemas.js';

const validLeg = {
  match: '曼聯 vs 車路士',
  market: 'handicap' as const,
  selection: '曼聯 -0.5',
  odds: 1.95,
};

const importItem = {
  externalId: 'hkjc-1',
  date: '2026-10-26',
  stake: 10,
  legs: [validLeg],
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

  it('rejects cash_out because only import may create it', () => {
    expect(
      createBetSchema.safeParse({ stake: 10, result: 'cash_out', legs: [validLeg] }).success,
    ).toBe(false);
    expect(
      createBetSchema.safeParse({
        stake: 10,
        result: 'cash_out',
        legs: [validLeg],
        profitOverride: 7.3,
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

describe('importBetItemSchema', () => {
  it('accepts cash_out with a finite override and rounds it to 2dp', () => {
    const parsed = importBetItemSchema.safeParse({
      ...importItem,
      result: 'cash_out',
      profitOverride: 7.305,
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.result).toBe('cash_out');
    expect(parsed.data.profitOverride).toBe(7.31);
  });

  it('requires a numeric override for cash_out', () => {
    expect(importBetItemSchema.safeParse({ ...importItem, result: 'cash_out' }).success).toBe(
      false,
    );
    expect(
      importBetItemSchema.safeParse({
        ...importItem,
        result: 'cash_out',
        profitOverride: null,
      }).success,
    ).toBe(false);
  });

  it('rejects a numeric override for every non-cash_out result', () => {
    for (const result of ['pending', 'win', 'half_win', 'push', 'half_loss', 'loss'] as const) {
      expect(
        importBetItemSchema.safeParse({ ...importItem, result, profitOverride: 7.3 }).success,
      ).toBe(false);
    }
    expect(
      importBetItemSchema.safeParse({ ...importItem, result: 'pending', profitOverride: 7.3 })
        .success,
    ).toBe(false);
  });

  it('allows a null or absent override for non-cash_out results', () => {
    expect(importBetItemSchema.safeParse({ ...importItem, result: 'pending' }).success).toBe(true);
    expect(
      importBetItemSchema.safeParse({ ...importItem, result: 'pending', profitOverride: null })
        .success,
    ).toBe(true);
    expect(importBetItemSchema.safeParse({ ...importItem, result: 'win' }).success).toBe(true);
    expect(
      importBetItemSchema.safeParse({ ...importItem, result: 'loss', profitOverride: null })
        .success,
    ).toBe(true);
  });

  it('rejects non-finite overrides', () => {
    expect(
      importBetItemSchema.safeParse({
        ...importItem,
        result: 'cash_out',
        profitOverride: Number.NaN,
      }).success,
    ).toBe(false);
    expect(
      importBetItemSchema.safeParse({
        ...importItem,
        result: 'cash_out',
        profitOverride: Number.POSITIVE_INFINITY,
      }).success,
    ).toBe(false);
  });

  it('keeps the total-odds cap', () => {
    expect(
      importBetItemSchema.safeParse({
        ...importItem,
        result: 'cash_out',
        profitOverride: 7.3,
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

  it('rejects cash_out because only import may create it', () => {
    expect(patchBetSchema.safeParse({ result: 'cash_out' }).success).toBe(false);
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
