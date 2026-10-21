import { describe, expect, it } from 'vitest';
import { formatMoney, formatSignedScore, formatStatMoney, formatWinRate } from '../src/lib/money';

describe('formatMoney', () => {
  it('always shows one decimal with a leading space for positive values', () => {
    expect(formatMoney(12.5)).toBe(' $12.5');
    expect(formatMoney(0.04)).toBe(' $0.0');
  });

  it('puts the minus before the dollar sign', () => {
    expect(formatMoney(-12.5)).toBe('-$12.5');
  });

  it('shows zero with a leading space and one decimal', () => {
    expect(formatMoney(0)).toBe(' $0.0');
    expect(formatMoney(-0.04)).toBe(' $0.0');
  });
});

describe('formatStatMoney', () => {
  it('uses an explicit plus sign for positive values', () => {
    expect(formatStatMoney(12.5)).toBe('+$12.5');
  });

  it('uses a minus sign for negative values', () => {
    expect(formatStatMoney(-12.5)).toBe('-$12.5');
  });

  it('shows zero without a sign', () => {
    expect(formatStatMoney(0)).toBe('$0.0');
  });
});

describe('formatSignedScore', () => {
  it('signs positive and negative scores', () => {
    expect(formatSignedScore(12.5)).toBe('+12.5');
    expect(formatSignedScore(-12.5)).toBe('-12.5');
    expect(formatSignedScore(0)).toBe('0.0');
  });
});

describe('formatWinRate', () => {
  it('formats a percentage with one decimal', () => {
    expect(formatWinRate(50)).toBe('50.0%');
    expect(formatWinRate(33.333)).toBe('33.3%');
  });

  it('returns an em dash when there is no data', () => {
    expect(formatWinRate(null)).toBe('—');
  });
});
