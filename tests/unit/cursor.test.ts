import { describe, expect, it } from 'vitest';
import { decodeCursor, encodeCursor } from '../../src/records/cursor.js';

const CURSOR = {
  playedAt: '2026-10-21',
  recordedAt: '2026-10-21T12:34:56.789Z',
  id: '00000000-0000-4000-8000-000000000000',
};

describe('record cursor', () => {
  it('round-trips a valid cursor', () => {
    expect(decodeCursor(encodeCursor(CURSOR))).toEqual(CURSOR);
  });

  it('rejects invalid base64url payloads', () => {
    expect(decodeCursor('not-a-cursor')).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });

  it('rejects JSON with the wrong shape', () => {
    const encoded = Buffer.from(JSON.stringify({ playedAt: '2026-10-21' }), 'utf8').toString(
      'base64url',
    );
    expect(decodeCursor(encoded)).toBeNull();
  });

  it('rejects invalid dates and ids', () => {
    const badDate = Buffer.from(
      JSON.stringify({ ...CURSOR, playedAt: '2026-02-30' }),
      'utf8',
    ).toString('base64url');
    expect(decodeCursor(badDate)).toBeNull();

    const badId = Buffer.from(JSON.stringify({ ...CURSOR, id: 'nope' }), 'utf8').toString(
      'base64url',
    );
    expect(decodeCursor(badId)).toBeNull();
  });
});
