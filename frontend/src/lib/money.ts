import { round1 } from './scoring';

export function formatMoney(value: number): string {
  const rounded = round1(value);
  if (rounded === 0) {
    return ' $0.0';
  }
  return rounded > 0 ? ` $${rounded.toFixed(1)}` : `-$${Math.abs(rounded).toFixed(1)}`;
}

export function formatStatMoney(value: number): string {
  const rounded = round1(value);
  if (rounded === 0) {
    return '$0.0';
  }
  return rounded > 0 ? `+$${rounded.toFixed(1)}` : `-$${Math.abs(rounded).toFixed(1)}`;
}

export function formatSignedScore(value: number): string {
  const rounded = round1(value);
  if (rounded === 0) {
    return '0.0';
  }
  return rounded > 0 ? `+${rounded.toFixed(1)}` : `-${Math.abs(rounded).toFixed(1)}`;
}

export function formatWinRate(rate: number | null): string {
  return rate === null ? '—' : `${rate.toFixed(1)}%`;
}

export function formatPlainScore(value: number): string {
  const rounded = round1(value);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
