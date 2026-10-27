import { describe, expect, it } from 'vitest';
import {
  betTypeLabel,
  formatBetMoney,
  formatOdds,
  formatPercent,
  formatSignedNumber,
  formatStake,
  marketLabel,
  profitTone,
  resultLabel,
} from '../src/bet/lib/format';

describe('bet formatting', () => {
  it('formats money with signs and 2dp', () => {
    expect(formatBetMoney(1355)).toBe('+$1,355.00');
    expect(formatBetMoney(-500)).toBe('-$500.00');
    expect(formatBetMoney(0)).toBe('$0.00');
    expect(formatStake(500)).toBe('$500.00');
  });

  it('formats odds and percentages', () => {
    expect(formatOdds(3.705)).toBe('3.71');
    expect(formatOdds(null)).toBe('—');
    expect(formatPercent(67.647)).toBe('67.65%');
    expect(formatPercent(null)).toBe('—');
  });

  it('formats signed chart numbers', () => {
    expect(formatSignedNumber(475)).toBe('+475');
    expect(formatSignedNumber(-100)).toBe('-100');
    expect(formatSignedNumber(0)).toBe('0');
    expect(formatSignedNumber(12.5)).toBe('+12.50');
  });

  it('maps labels', () => {
    expect(resultLabel('pending')).toBe('待結算');
    expect(resultLabel('half_win')).toBe('半贏');
    expect(marketLabel('1x2')).toBe('主客和');
    expect(marketLabel('handicap')).toBe('讓球');
    expect(betTypeLabel(1)).toBe('單場');
    expect(betTypeLabel(3)).toBe('3串1');
    expect(profitTone(10)).toBe('is-win');
    expect(profitTone(-10)).toBe('is-loss');
    expect(profitTone(null)).toBe('is-zero');
  });
});
