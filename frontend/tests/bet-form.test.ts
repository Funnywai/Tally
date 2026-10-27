import { describe, expect, it } from 'vitest';
import { draftFromBet, emptyDraft, parseDraft } from '../src/bet/lib/form';
import type { BetItem } from '../src/bet/types';

describe('bet draft validation', () => {
  it('returns a valid single payload and rounds', () => {
    const draft = {
      ...emptyDraft('2026-10-26'),
      stake: '12.345',
      legs: [
        {
          match: ' 曼聯 vs 車路士 ',
          market: 'handicap' as const,
          selection: ' 曼聯 -0.5 ',
          odds: '1.955',
        },
      ],
    };
    const parsed = parseDraft(draft);
    expect(parsed.totalOdds).toBe(1.96);
    expect(parsed.payload).toEqual({
      date: '2026-10-26',
      stake: 12.35,
      result: 'pending',
      legs: [
        {
          match: '曼聯 vs 車路士',
          market: 'handicap',
          selection: '曼聯 -0.5',
          odds: 1.96,
        },
      ],
    });
  });

  it('rejects missing fields', () => {
    const parsed = parseDraft(emptyDraft(''));
    expect(parsed.payload).toBeNull();
    expect(parsed.errors.date).toBe('請選擇日期');
    expect(parsed.errors.stake).toBeDefined();
    expect(parsed.errors.legs[0]?.match).toBeDefined();
    expect(parsed.errors.legs[0]?.selection).toBeDefined();
    expect(parsed.errors.legs[0]?.odds).toBeDefined();
  });

  it('rejects total odds above the cap', () => {
    const draft = {
      ...emptyDraft('2026-10-26'),
      stake: '10',
      legs: [
        { match: 'A', market: '1x2' as const, selection: '主', odds: '300' },
        { match: 'B', market: '1x2' as const, selection: '客', odds: '400' },
      ],
    };
    const parsed = parseDraft(draft);
    expect(parsed.payload).toBeNull();
    expect(parsed.errors.totalOdds).toBeDefined();
  });

  it('rejects zero legs', () => {
    const parsed = parseDraft({ ...emptyDraft('2026-10-26'), stake: '10', legs: [] });
    expect(parsed.payload).toBeNull();
    expect(parsed.errors.legsCount).toBeDefined();
    expect(parsed.totalOdds).toBeNull();
  });

  it('rejects more than eight legs', () => {
    const legs = Array.from({ length: 9 }, (_, index) => ({
      match: String.fromCharCode(65 + index),
      market: '1x2' as const,
      selection: '主',
      odds: '1.01',
    }));
    const parsed = parseDraft({ ...emptyDraft('2026-10-26'), stake: '10', legs });
    expect(parsed.payload).toBeNull();
    expect(parsed.errors.legsCount).toBeDefined();
  });

  it('accepts eight legs', () => {
    const legs = Array.from({ length: 8 }, (_, index) => ({
      match: String.fromCharCode(65 + index),
      market: '1x2' as const,
      selection: '主',
      odds: '1.01',
    }));
    const parsed = parseDraft({ ...emptyDraft('2026-10-26'), stake: '10', legs });
    expect(parsed.payload).not.toBeNull();
    expect(parsed.errors.legsCount).toBeUndefined();
    expect(parsed.totalOdds).toBe(1.08);
  });

  it('prefills from a bet', () => {
    const bet: BetItem = {
      id: 'id',
      date: '2026-10-26',
      recordedAt: '2026-10-26T12:00:00.000Z',
      stake: 500,
      result: 'win',
      legs: [
        {
          position: 1,
          match: '曼聯 vs 車路士',
          market: 'handicap',
          selection: '曼聯 -0.5',
          odds: 1.95,
        },
      ],
      totalOdds: 1.95,
      profit: 475,
    };
    expect(draftFromBet(bet)).toEqual({
      date: '2026-10-26',
      stake: '500',
      result: 'win',
      legs: [
        {
          match: '曼聯 vs 車路士',
          market: 'handicap',
          selection: '曼聯 -0.5',
          odds: '1.95',
        },
      ],
    });
  });
});
