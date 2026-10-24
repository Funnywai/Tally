import { describe, expect, it } from 'vitest';
import {
  applyTikai,
  computeFood,
  computeOutput,
  computeSpecial,
  divideAll,
  round1,
} from '../src/lib/scoring';

describe('computeOutput', () => {
  it('returns 0 for an empty column', () => {
    expect(computeOutput([null, null, null, null, null, null, null])).toBe(0);
  });

  it('returns the single value unchanged', () => {
    expect(computeOutput([5, null, null, null, null, null, null])).toBe(5);
  });

  it('applies the 1.5 compounding weight top-to-bottom', () => {
    expect(computeOutput([1, 1, 1, null, null, null, null])).toBe(5);
  });

  it('handles a full seven-row column', () => {
    expect(computeOutput([1, 1, 1, 1, 1, 1, 1])).toBe(33);
  });

  it('skips null cells instead of treating them as zero', () => {
    expect(computeOutput([null, 2, null, 3, null, null, null])).toBe(6);
  });

  it('rounds negative sums down, away from zero', () => {
    expect(computeOutput([-49, -18, null, null, null, null, null])).toBe(-92);
    expect(computeOutput([-49, -19, null, null, null, null, null])).toBe(-93);
    expect(computeOutput([-1, -1, null, null, null, null, null])).toBe(-3);
    expect(computeOutput([-1, null, null, null, null, null, null])).toBe(-1);
  });

  it('ceils a fractional positive result', () => {
    expect(computeOutput([1, 1, null, null, null, null, null])).toBe(3);
    expect(computeOutput([10, 20, null, null, null, null, null])).toBe(35);
  });
});

describe('applyTikai', () => {
  it('floors half of a positive output', () => {
    expect(applyTikai(5)).toBe(2);
    expect(applyTikai(35)).toBe(17);
  });

  it('rounds negative halves toward zero with ceil', () => {
    expect(applyTikai(-1)).toBe(0);
    expect(applyTikai(-3)).toBe(-1);
    expect(applyTikai(-91)).toBe(-45);
    expect(applyTikai(-92)).toBe(-46);
    expect(applyTikai(-93)).toBe(-46);
  });

  it('leaves zero at zero', () => {
    expect(applyTikai(0)).toBe(0);
  });
});

describe('computeSpecial', () => {
  it('pays the selected player 3x and charges the others 1x on 收', () => {
    expect(computeSpecial([0, 0, 0, 0], 1, 'win', 5)).toEqual([-5, 15, -5, -5]);
  });

  it('charges the selected player 3x and pays the others 1x on 賠', () => {
    expect(computeSpecial([0, 0, 0, 0], 1, 'lose', 5)).toEqual([5, -15, 5, 5]);
  });

  it('is zero-sum', () => {
    const result = computeSpecial([10, -2, 3, -11], 2, 'win', 10);
    expect(result.reduce((sum, value) => sum + value, 0)).toBe(0);
  });
});

describe('computeFood', () => {
  it('adds paid minus owed and rounds to one decimal', () => {
    expect(computeFood([10, 0, 0, 0], [100, 0, 0, 0], [25, 25, 25, 25])).toEqual([
      85, -25, -25, -25,
    ]);
  });

  it('rounds each player independently', () => {
    expect(computeFood([0, 0, 0, 0], [10, 0, 0, 0], [3.33, 3.33, 3.33, 3.34])).toEqual([
      6.7, -3.3, -3.3, -3.3,
    ]);
  });
});

describe('divideAll', () => {
  it('divides every player and rounds to one decimal', () => {
    expect(divideAll([10, 5, -3, 0], 3)).toEqual([3.3, 1.7, -1, 0]);
  });

  it('normalises negative zero', () => {
    expect(divideAll([-0.04, 0, 0, 0], 4)).toEqual([0, 0, 0, 0]);
  });

  it('preserves a zero total by giving the residual to the fourth player', () => {
    const result = divideAll([10, 5, -3, -12], 4);
    expect(result).toEqual([2.5, 1.3, -0.7, -3.1]);
    expect(round1(result.reduce((sum, value) => sum + value, 0))).toBe(0);
  });

  it('keeps a nonzero total at the rounded divided total', () => {
    const result = divideAll([10, 5, -3, 0], 3);
    expect(round1(result.reduce((sum, value) => sum + value, 0))).toBe(4);
  });
});

describe('round1', () => {
  it('rounds to one decimal and normalises negative zero', () => {
    expect(round1(1.25)).toBe(1.3);
    expect(round1(-0.04)).toBe(0);
  });
});
