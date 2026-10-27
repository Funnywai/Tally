import type { BetMarket, BetResult } from '../types';
import { round2 } from './profit';

const moneyFormatter = new Intl.NumberFormat('en-HK', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatBetMoney(value: number): string {
  const rounded = round2(value);
  if (rounded === 0) {
    return '$0.00';
  }
  return `${rounded > 0 ? '+' : '-'}$${moneyFormatter.format(Math.abs(rounded))}`;
}

export function formatStake(value: number): string {
  return `$${moneyFormatter.format(round2(value))}`;
}

export function formatOdds(value: number | null): string {
  return value === null ? '—' : round2(value).toFixed(2);
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${round2(value).toFixed(2)}%`;
}

export function formatSignedNumber(value: number): string {
  const rounded = round2(value);
  if (rounded === 0) {
    return '0';
  }
  const absolute = Number.isInteger(rounded)
    ? String(Math.abs(rounded))
    : Math.abs(rounded).toFixed(2);
  return rounded > 0 ? `+${absolute}` : `-${absolute}`;
}

export function resultLabel(result: BetResult): string {
  switch (result) {
    case 'pending':
      return '待結算';
    case 'win':
      return '贏';
    case 'half_win':
      return '半贏';
    case 'push':
      return '走水';
    case 'half_loss':
      return '半輸';
    case 'loss':
      return '輸';
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

export function marketLabel(market: BetMarket): string {
  switch (market) {
    case '1x2':
      return '主客和';
    case 'handicap':
      return '讓球';
    case 'totals':
      return '大細';
    case 'other':
      return '其他';
    default: {
      const exhaustive: never = market;
      return exhaustive;
    }
  }
}

export function betTypeLabel(legCount: number): string {
  return legCount === 1 ? '單場' : `${legCount}串1`;
}

export function profitTone(value: number | null): string {
  if (value === null || value === 0) {
    return 'is-zero';
  }
  return value > 0 ? 'is-win' : 'is-loss';
}
