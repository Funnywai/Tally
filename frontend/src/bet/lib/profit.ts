import type { BetLegPayload, BetResult } from '../types';

export const MIN_ODDS = 1.01;
export const MAX_ODDS = 1000;
export const MIN_STAKE = 0.01;
export const MAX_STAKE = 9_999_999.99;
export const MAX_TOTAL_ODDS = 99_999.99;

export function round2(value: number): number {
  if (!Number.isFinite(value)) {
    return value;
  }
  const sign = Math.sign(value) || 1;
  const abs = Math.abs(value);
  const nudged = abs + Math.max(Number.EPSILON, abs * Number.EPSILON * 2);
  const result = (sign * Math.round(nudged * 100)) / 100;
  return Object.is(result, -0) ? 0 : result;
}

export function computeTotalOdds(legs: readonly Pick<BetLegPayload, 'odds'>[]): number {
  let product = 1;
  for (const leg of legs) {
    product *= round2(leg.odds);
  }
  return round2(product);
}

export function computeProfit(stake: number, totalOdds: number, result: BetResult): number | null {
  const s = round2(stake);
  const o = round2(totalOdds);
  switch (result) {
    case 'pending':
      return null;
    case 'win':
      return round2(s * (o - 1));
    case 'half_win':
      return round2((s * (o - 1)) / 2);
    case 'push':
      return 0;
    case 'half_loss':
      return round2(-s / 2);
    case 'loss':
      return round2(-s);
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

export function computePotentialReturn(stake: number, totalOdds: number): number {
  return round2(stake * totalOdds);
}
