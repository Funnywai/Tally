import { describe, expect, it } from 'vitest';
import {
  hkDate,
  hkDateFromTimestamp,
  hkToday,
  hkYear,
  isValidDateString,
  round1,
} from '../../src/time.js';

describe('Asia/Hong_Kong date helpers', () => {
  it('keeps 23:59 HK on the same day at 15:59 UTC', () => {
    const instant = new Date('2026-10-21T15:59:00.000Z');
    expect(hkDate(instant)).toBe('2026-10-21');
    expect(hkToday(instant)).toBe('2026-10-21');
    expect(hkYear(instant)).toBe(2026);
  });

  it('rolls over to 00:00 HK at 16:00 UTC', () => {
    const instant = new Date('2026-10-21T16:00:00.000Z');
    expect(hkDate(instant)).toBe('2026-10-22');
    expect(hkToday(instant)).toBe('2026-10-22');
  });

  it('rolls over to 00:01 HK at 16:01 UTC', () => {
    expect(hkDate(new Date('2026-10-21T16:01:00.000Z'))).toBe('2026-10-22');
  });

  it('converts timestamps using Hong Kong time', () => {
    expect(hkDateFromTimestamp(Date.parse('2026-10-21T15:59:00.000Z'))).toBe('2026-10-21');
    expect(hkDateFromTimestamp(Date.parse('2026-10-21T16:00:00.000Z'))).toBe('2026-10-22');
  });

  it('validates real calendar dates only', () => {
    expect(isValidDateString('2026-02-28')).toBe(true);
    expect(isValidDateString('2024-02-29')).toBe(true);
    expect(isValidDateString('2026-02-29')).toBe(false);
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('2026-13-01')).toBe(false);
    expect(isValidDateString('2026-1-01')).toBe(false);
    expect(isValidDateString('not-a-date')).toBe(false);
  });

  it('rounds to one decimal place', () => {
    expect(round1(12.34)).toBe(12.3);
    expect(round1(12.35)).toBe(12.4);
    expect(round1(-12.34)).toBe(-12.3);
    expect(round1(0)).toBe(0);
  });
});
