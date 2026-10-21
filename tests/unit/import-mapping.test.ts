import { describe, expect, it } from 'vitest';
import {
  collectUnderscoreNames,
  computeExpectedTotals,
  extractRecords,
  hkDateFromTimestamp,
  isValidDateString,
  mapRecord,
  numericTimestamp,
} from '../../scripts/lib/firebase-import.mjs';

const NOW = Date.parse('2026-10-21T12:00:00.000Z');

describe('firebase import mapping', () => {
  it('maps a record with an explicit date', () => {
    const result = mapRecord(
      '1715200000000',
      {
        date: '2026-05-09',
        timestamp: 1715200000000,
        players: { 我: 50, 閒1: 0, 閒2: -50, 閒3: 0 },
      },
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.externalId).toBe('1715200000000');
    expect(result.value.playedAt).toBe('2026-05-09');
    expect(result.value.recordedAt).toBe('2024-05-08T20:26:40.000Z');
    expect(result.value.players).toEqual([
      { name: '我', score: 50 },
      { name: '閒1', score: 0 },
      { name: '閒2', score: -50 },
      { name: '閒3', score: 0 },
    ]);
  });

  it('derives the HK date from a numeric timestamp when date is missing', () => {
    const result = mapRecord('1715300000000', { players: { A: 1 } }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.playedAt).toBe('2024-05-10');
  });

  it('derives the HK date from a numeric key when timestamp is missing', () => {
    const result = mapRecord('1715300000000', { players: { A: 1 } }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.playedAt).toBe('2024-05-10');
  });

  it('falls back to the supplied now for push ids without timestamps', () => {
    const result = mapRecord('-NpushId', { players: { A: 1 } }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.playedAt).toBe('2026-10-21');
    expect(result.value.recordedAt).toBe('2026-10-21T12:00:00.000Z');
  });

  it('skips records with empty players', () => {
    expect(mapRecord('1', { players: {} }, NOW)).toEqual({
      ok: false,
      reason: 'players 為空',
    });
    expect(mapRecord('1', {}, NOW)).toEqual({ ok: false, reason: 'players 為空' });
  });

  it('skips records with a non-finite score', () => {
    expect(mapRecord('1', { players: { A: 'abc' } }, NOW).ok).toBe(false);
    expect(mapRecord('1', { players: { A: null } }, NOW).ok).toBe(false);
  });

  it('imports all-zero records', () => {
    const result = mapRecord('1', { date: '2026-05-09', players: { A: 0, B: 0 } }, NOW);
    expect(result.ok).toBe(true);
  });

  it('rounds scores to one decimal place', () => {
    const result = mapRecord('1', { date: '2026-05-09', players: { A: 12.34 } }, NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.value.players[0]?.score).toBe(12.3);
  });

  it('accepts both root shapes', () => {
    expect(extractRecords({ records: { a: { players: { A: 1 } } } })).toEqual({
      a: { players: { A: 1 } },
    });
    expect(extractRecords({ a: { players: { A: 1 } } })).toEqual({
      a: { players: { A: 1 } },
    });
    expect(() => extractRecords([])).toThrow();
  });

  it('computes expected totals and underscore names', () => {
    const records = {
      a: { date: '2026-05-09', players: { 我: 50, 閒_1: -50 } },
      b: { date: '2026-05-10', players: { 我: -12.5, 閒_1: 12.5 } },
      c: { date: '2026-05-11', players: {} },
    };
    const totals = computeExpectedTotals(records, NOW);
    expect(totals.get('我')).toBe(37.5);
    expect(totals.get('閒_1')).toBe(-37.5);
    expect(collectUnderscoreNames(records, NOW)).toEqual(['閒_1']);
  });

  it('parses timestamps and validates dates', () => {
    expect(numericTimestamp(1715200000000)).toBe(1715200000000);
    expect(numericTimestamp('1715200000000')).toBe(1715200000000);
    expect(numericTimestamp('-NpushId')).toBeNull();
    expect(numericTimestamp(null)).toBeNull();
    expect(isValidDateString('2026-02-29')).toBe(false);
    expect(isValidDateString('2024-02-29')).toBe(true);
    expect(hkDateFromTimestamp(Date.parse('2026-10-21T16:00:00.000Z'))).toBe('2026-10-22');
  });
});
