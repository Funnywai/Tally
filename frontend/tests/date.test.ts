import { describe, expect, it } from 'vitest';
import {
  formatDateLong,
  formatDateSlash,
  formatTimeHK,
  groupByDate,
  hkToday,
  hkYear,
} from '../src/lib/date';

describe('hkToday', () => {
  it('uses Hong Kong time at the end of the UTC day', () => {
    expect(hkToday(new Date('2026-05-09T15:59:59Z'))).toBe('2026-05-09');
  });

  it('rolls over at Hong Kong midnight', () => {
    expect(hkToday(new Date('2026-05-09T16:00:00Z'))).toBe('2026-05-10');
  });
});

describe('hkYear', () => {
  it('returns the Hong Kong year', () => {
    expect(hkYear(new Date('2026-12-31T16:00:00Z'))).toBe(2027);
  });
});

describe('formatDateLong', () => {
  it('formats a date as a Chinese date', () => {
    expect(formatDateLong('2026-05-09')).toBe('2026年05月09日');
  });
});

describe('formatDateSlash', () => {
  it('formats a date with slashes', () => {
    expect(formatDateSlash('2026-05-09')).toBe('2026/05/09');
  });
});

describe('formatTimeHK', () => {
  it('formats an instant in Hong Kong time', () => {
    expect(formatTimeHK(new Date('2026-05-09T06:05:00Z'))).toBe('14:05');
  });
});

describe('groupByDate', () => {
  it('groups records by date, newest date first, preserving input order', () => {
    const records = [
      { id: 'a', date: '2026-05-09' },
      { id: 'b', date: '2026-05-10' },
      { id: 'c', date: '2026-05-09' },
    ];
    expect(groupByDate(records)).toEqual([
      { date: '2026-05-10', records: [{ id: 'b', date: '2026-05-10' }] },
      {
        date: '2026-05-09',
        records: [
          { id: 'a', date: '2026-05-09' },
          { id: 'c', date: '2026-05-09' },
        ],
      },
    ]);
  });

  it('returns an empty array for no records', () => {
    expect(groupByDate([])).toEqual([]);
  });
});
