import { describe, expect, it } from 'vitest';
import { passcodeMatches } from '../../src/auth/passcode.js';

describe('passcode comparison', () => {
  it('accepts the exact passcode', () => {
    expect(passcodeMatches('correct horse battery staple', 'correct horse battery staple')).toBe(
      true,
    );
  });

  it('rejects a different passcode', () => {
    expect(passcodeMatches('wrong', 'correct horse battery staple')).toBe(false);
  });

  it('rejects a prefix and a longer value', () => {
    expect(passcodeMatches('correct', 'correct horse battery staple')).toBe(false);
    expect(passcodeMatches('correct horse battery staple!', 'correct horse battery staple')).toBe(
      false,
    );
  });

  it('handles unicode passcodes', () => {
    expect(passcodeMatches('麻雀密語-1234', '麻雀密語-1234')).toBe(true);
    expect(passcodeMatches('麻雀密語-1235', '麻雀密語-1234')).toBe(false);
  });
});
