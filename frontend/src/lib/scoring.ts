import type { Quad } from './types';

export function round1(value: number): number {
  const rounded = Math.round(value * 10) / 10;
  return Object.is(rounded, -0) ? 0 : rounded;
}

/**
 * output = ceil(Σ r_i · 1.5^(n-1-i)) over the non-null cells, top to bottom.
 * Null cells are skipped entirely; they do not occupy a weight.
 */
export function computeOutput(column: readonly (number | null)[]): number {
  const filled = column.filter((value): value is number => value !== null);
  if (filled.length === 0) {
    return 0;
  }
  let sum = 0;
  for (let index = 0; index < filled.length; index += 1) {
    const value = filled[index];
    if (value === undefined) {
      continue;
    }
    sum += value * 1.5 ** (filled.length - 1 - index);
  }
  return Math.ceil(sum);
}

export function applyTikai(output: number): number {
  return Math.floor(output / 2);
}

export function computeSpecial(
  accumulated: Quad<number>,
  index: 0 | 1 | 2 | 3,
  kind: 'win' | 'lose',
  score: number,
): Quad<number> {
  const next: Quad<number> = [accumulated[0], accumulated[1], accumulated[2], accumulated[3]];
  const selectedDelta = kind === 'win' ? score * 3 : score * -3;
  const otherDelta = kind === 'win' ? -score : score;
  for (const player of [0, 1, 2, 3] as const) {
    next[player] = round1(accumulated[player] + (player === index ? selectedDelta : otherDelta));
  }
  return next;
}

export function computeFood(
  accumulated: Quad<number>,
  paid: Quad<number>,
  owed: Quad<number>,
): Quad<number> {
  return [
    round1(accumulated[0] + paid[0] - owed[0]),
    round1(accumulated[1] + paid[1] - owed[1]),
    round1(accumulated[2] + paid[2] - owed[2]),
    round1(accumulated[3] + paid[3] - owed[3]),
  ];
}

export function divideAll(accumulated: Quad<number>, divisor: number): Quad<number> {
  const target = round1(accumulated.reduce((sum, value) => sum + value, 0) / divisor);
  const first = round1(accumulated[0] / divisor);
  const second = round1(accumulated[1] / divisor);
  const third = round1(accumulated[2] / divisor);
  const fourth = round1(target - first - second - third);
  return [first, second, third, fourth];
}
