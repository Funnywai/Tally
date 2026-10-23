import { describe, expect, it } from 'vitest';
import { loadGameState, STORAGE_KEYS, type StorageLike, saveGameState } from '../src/lib/storage';
import { DEFAULT_NAMES, type GameState, initialGameState } from '../src/state/gameReducer';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function stateWithCell(): GameState {
  return {
    ...initialGameState,
    inputs: [
      [5, null, null, null, null, null, null],
      [null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null],
    ],
    outputs: [5, 0, 0],
    accumulated: [10, -5, 0, -5],
  };
}

describe('STORAGE_KEYS', () => {
  it('uses the exact legacy keys', () => {
    expect(STORAGE_KEYS).toEqual({
      names: 'mj_names',
      inputs: 'mj_inputs',
      outputs: 'mj_outputs',
      tikai: 'mj_tikai',
      accumulated: 'mj_accumulated',
      divided: 'mj_divided',
      written: 'mj_written',
      undoStack: 'mj_undo_stack',
    });
  });
});

describe('saveGameState / loadGameState', () => {
  it('round-trips a valid state', () => {
    const storage = new MemoryStorage();
    const state = stateWithCell();
    saveGameState(storage, state);
    expect(loadGameState(storage)).toEqual(state);
  });

  it('round-trips the divided phase flag', () => {
    const storage = new MemoryStorage();
    saveGameState(storage, { ...stateWithCell(), divided: true });
    expect(storage.getItem(STORAGE_KEYS.divided)).toBe('true');
    expect(loadGameState(storage).divided).toBe(true);
  });

  it('defaults divided to false when the key is missing', () => {
    expect(loadGameState(new MemoryStorage()).divided).toBe(false);
  });

  it('defaults divided to false when the stored value is invalid', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEYS.divided, JSON.stringify('yes'));
    expect(loadGameState(storage).divided).toBe(false);
  });

  it('round-trips the written phase flag', () => {
    const storage = new MemoryStorage();
    saveGameState(storage, { ...stateWithCell(), divided: true, written: true });
    expect(storage.getItem(STORAGE_KEYS.written)).toBe('true');
    expect(loadGameState(storage).written).toBe(true);
  });

  it('defaults written to false when the key is missing', () => {
    expect(loadGameState(new MemoryStorage()).written).toBe(false);
  });

  it('defaults written to false when the stored value is invalid', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEYS.written, JSON.stringify('yes'));
    expect(loadGameState(storage).written).toBe(false);
  });

  it('returns defaults for an empty storage', () => {
    expect(loadGameState(new MemoryStorage())).toEqual(initialGameState);
  });

  it('returns defaults for invalid JSON', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEYS.names, '{not json');
    expect(loadGameState(storage).names).toEqual(DEFAULT_NAMES);
  });

  it('keeps valid fields and falls back for invalid ones', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEYS.names, JSON.stringify(['阿明', '阿強', '阿輝', '我']));
    storage.setItem(STORAGE_KEYS.inputs, JSON.stringify('nope'));
    storage.setItem(STORAGE_KEYS.outputs, JSON.stringify([1, 2, 3]));
    const state = loadGameState(storage);
    expect(state.names).toEqual(['阿明', '阿強', '阿輝', '我']);
    expect(state.inputs).toEqual(initialGameState.inputs);
    expect(state.outputs).toEqual([1, 2, 3]);
  });

  it('rejects a names array with the wrong length', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEYS.names, JSON.stringify(['a', 'b']));
    expect(loadGameState(storage).names).toEqual(DEFAULT_NAMES);
  });

  it('rejects non-finite numbers', () => {
    const storage = new MemoryStorage();
    storage.setItem(STORAGE_KEYS.accumulated, JSON.stringify([1, null, 3, 4]));
    expect(loadGameState(storage).accumulated).toEqual([0, 0, 0, 0]);
  });

  it('filters invalid undo snapshots', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEYS.undoStack,
      JSON.stringify([
        {
          accumulated: [0, 0, 0, 0],
          inputs: [
            [null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null],
          ],
          outputs: [0, 0, 0],
          tikai: [false, false, false],
          who: '閒1',
          whoIdx: 0,
          score: 5,
        },
        { nope: true },
      ]),
    );
    const state = loadGameState(storage);
    expect(state.undoStack).toHaveLength(1);
    expect(state.undoStack[0]?.who).toBe('閒1');
  });

  it('parses a legacy snapshot without divided as false', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEYS.undoStack,
      JSON.stringify([
        {
          accumulated: [5, -5, 0, 0],
          inputs: [
            [null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null],
          ],
          outputs: [0, 0, 0],
          tikai: [false, false, false],
          who: '÷4',
          whoIdx: -1,
          score: 0,
          kind: 'divide',
        },
      ]),
    );
    const state = loadGameState(storage);
    expect(state.undoStack).toHaveLength(1);
    expect(state.undoStack[0]?.divided).toBe(false);
  });

  it('preserves a tikai undo kind', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      STORAGE_KEYS.undoStack,
      JSON.stringify([
        {
          accumulated: [0, 0, 0, 0],
          inputs: [
            [null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null],
            [null, null, null, null, null, null, null],
          ],
          outputs: [5, 0, 0],
          tikai: [false, false, false],
          divided: false,
          who: 'user 1',
          whoIdx: 0,
          score: 0,
          kind: 'tikai',
        },
      ]),
    );
    const state = loadGameState(storage);
    expect(state.undoStack[0]?.kind).toBe('tikai');
  });

  it('caps the undo stack at 50 entries', () => {
    const storage = new MemoryStorage();
    const snapshot = {
      accumulated: [0, 0, 0, 0],
      inputs: [
        [null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null],
      ],
      outputs: [0, 0, 0],
      tikai: [false, false, false],
      who: '閒1',
      whoIdx: 0,
      score: 5,
    };
    storage.setItem(STORAGE_KEYS.undoStack, JSON.stringify(Array(80).fill(snapshot)));
    expect(loadGameState(storage).undoStack).toHaveLength(50);
  });
});
