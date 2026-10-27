import { describe, expect, it } from 'vitest';
import { computeProfit, computeTotalOdds, round2 } from '../../src/bets/profit.js';

describe('round2', () => {
  it('rounds half away from zero and normalizes -0', () => {
    expect(round2(1.005)).toBe(1.01);
    expect(round2(-1.005)).toBe(-1.01);
    expect(round2(1.004)).toBe(1);
    expect(Object.is(round2(-0.001), -0)).toBe(false);
    expect(round2(-0.001)).toBe(0);
  });

  it('rounds half away from zero at larger magnitudes', () => {
    expect(round2(2.675)).toBe(2.68);
    expect(round2(4.475)).toBe(4.48);
    expect(round2(10.075)).toBe(10.08);
    expect(round2(1234567.005)).toBe(1234567.01);
  });
});

describe('computeTotalOdds', () => {
  it('rounds a single leg to 2dp', () => {
    expect(computeTotalOdds([{ odds: 1.95 }])).toBe(1.95);
    expect(computeTotalOdds([{ odds: 1.955 }])).toBe(1.96);
  });

  it('multiplies legs and rounds once', () => {
    expect(computeTotalOdds([{ odds: 1.95 }, { odds: 1.95 }])).toBe(3.8);
    expect(computeTotalOdds([{ odds: 1.95 }, { odds: 1.95 }, { odds: 1.95 }])).toBe(7.41);
  });

  it('handles eight legs', () => {
    expect(computeTotalOdds(Array.from({ length: 8 }, () => ({ odds: 2 })))).toBe(256);
  });
});

describe('computeProfit', () => {
  it('returns null for pending', () => {
    expect(computeProfit(500, 1.95, 'pending')).toBeNull();
  });

  it('pays win and half win', () => {
    expect(computeProfit(500, 1.95, 'win')).toBe(475);
    expect(computeProfit(500, 1.95, 'half_win')).toBe(237.5);
  });

  it('returns zero for push', () => {
    expect(computeProfit(500, 1.95, 'push')).toBe(0);
  });

  it('charges half loss and loss', () => {
    expect(computeProfit(500, 1.95, 'half_loss')).toBe(-250);
    expect(computeProfit(500, 1.95, 'loss')).toBe(-500);
  });

  it('rounds money to 2dp half away from zero', () => {
    expect(computeProfit(0.01, 1.95, 'half_loss')).toBe(-0.01);
    expect(computeProfit(100, 1.955, 'win')).toBe(96);
  });

  it('rounds profit halves correctly at larger magnitudes', () => {
    expect(computeProfit(8.95, 1.5, 'win')).toBe(4.48);
    expect(computeProfit(10.03, 1.5, 'win')).toBe(5.02);
  });
});
