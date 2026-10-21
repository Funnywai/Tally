import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NAMES,
  describeUndo,
  type GameState,
  gameReducer,
  initialGameState,
} from '../src/state/gameReducer';

function withCell(
  state: GameState,
  column: 0 | 1 | 2,
  row: number,
  value: number | null,
): GameState {
  return gameReducer(state, { type: 'SET_CELL', column, row, value });
}

describe('initialGameState', () => {
  it('uses the legacy default names and empty values', () => {
    expect(initialGameState.names).toEqual(DEFAULT_NAMES);
    expect(initialGameState.outputs).toEqual([0, 0, 0]);
    expect(initialGameState.tikai).toEqual([false, false, false]);
    expect(initialGameState.accumulated).toEqual([0, 0, 0, 0]);
    expect(initialGameState.undoStack).toEqual([]);
  });
});

describe('SET_CELL', () => {
  it('recomputes the column output and clears the tikai flag', () => {
    let state = withCell(initialGameState, 0, 0, 1);
    state = withCell(state, 0, 1, 1);
    expect(state.outputs[0]).toBe(3);
    state = gameReducer(state, { type: 'TIKAI', column: 0 });
    expect(state.tikai[0]).toBe(true);
    state = withCell(state, 0, 2, 1);
    expect(state.tikai[0]).toBe(false);
    expect(state.outputs[0]).toBe(5);
  });

  it('clears a cell when the value is null', () => {
    let state = withCell(initialGameState, 1, 0, 4);
    state = withCell(state, 1, 0, null);
    expect(state.inputs[1][0]).toBeNull();
    expect(state.outputs[1]).toBe(0);
  });
});

describe('TIKAI', () => {
  it('floors half the output without touching inputs and without an undo snapshot', () => {
    let state = withCell(initialGameState, 0, 0, 5);
    state = gameReducer(state, { type: 'TIKAI', column: 0 });
    expect(state.outputs[0]).toBe(2);
    expect(state.inputs[0][0]).toBe(5);
    expect(state.tikai[0]).toBe(true);
    expect(state.undoStack).toHaveLength(0);
  });

  it('is a no-op when the column was already halved', () => {
    let state = withCell(initialGameState, 0, 0, 5);
    state = gameReducer(state, { type: 'TIKAI', column: 0 });
    const once = state;
    state = gameReducer(state, { type: 'TIKAI', column: 0 });
    expect(state.outputs[0]).toBe(once.outputs[0]);
  });
});

describe('ZHAO', () => {
  it('does nothing when the output is zero', () => {
    const state = gameReducer(initialGameState, { type: 'ZHAO', column: 0 });
    expect(state).toEqual(initialGameState);
  });

  it('moves the score from the player to me, clears the column, and pushes undo', () => {
    let state = withCell(initialGameState, 0, 0, 1);
    state = withCell(state, 0, 1, 1);
    state = gameReducer(state, { type: 'ZHAO', column: 0 });
    expect(state.accumulated).toEqual([-3, 0, 0, 3]);
    expect(state.inputs[0]).toEqual([null, null, null, null, null, null, null]);
    expect(state.outputs[0]).toBe(0);
    expect(state.tikai[0]).toBe(false);
    expect(state.undoStack).toHaveLength(1);
    expect(state.undoStack[0]?.who).toBe('user 1');
    expect(state.undoStack[0]?.score).toBe(3);
  });

  it('restores the previous state on UNDO', () => {
    let state = withCell(initialGameState, 0, 0, 5);
    const before = state;
    state = gameReducer(state, { type: 'ZHAO', column: 0 });
    state = gameReducer(state, { type: 'UNDO' });
    expect(state.accumulated).toEqual(before.accumulated);
    expect(state.inputs).toEqual(before.inputs);
    expect(state.outputs).toEqual(before.outputs);
    expect(state.undoStack).toHaveLength(0);
  });
});

describe('SPECIAL', () => {
  it('applies a zero-sum 3:1 win and pushes undo', () => {
    const state = gameReducer(initialGameState, {
      type: 'SPECIAL',
      index: 1,
      kind: 'win',
      score: 5,
    });
    expect(state.accumulated).toEqual([-5, 15, -5, -5]);
    expect(state.undoStack).toHaveLength(1);
  });

  it('applies a zero-sum 3:1 loss', () => {
    const state = gameReducer(initialGameState, {
      type: 'SPECIAL',
      index: 1,
      kind: 'lose',
      score: 10,
    });
    expect(state.accumulated).toEqual([10, -30, 10, 10]);
  });
});

describe('FOOD', () => {
  it('adds paid minus owed and pushes undo', () => {
    const state = gameReducer(initialGameState, {
      type: 'FOOD',
      paid: [100, 0, 0, 0],
      owed: [25, 25, 25, 25],
    });
    expect(state.accumulated).toEqual([75, -25, -25, -25]);
    expect(state.undoStack).toHaveLength(1);
  });

  it('does nothing when both totals are zero', () => {
    const state = gameReducer(initialGameState, {
      type: 'FOOD',
      paid: [0, 0, 0, 0],
      owed: [0, 0, 0, 0],
    });
    expect(state).toEqual(initialGameState);
  });
});

describe('DIVIDE', () => {
  it('does nothing when every score is zero', () => {
    const state = gameReducer(initialGameState, { type: 'DIVIDE', divisor: 4 });
    expect(state).toEqual(initialGameState);
  });

  it('divides every score and pushes undo', () => {
    let state = gameReducer(initialGameState, {
      type: 'ADJUST',
      index: 0,
      value: 10,
    });
    state = gameReducer(state, { type: 'ADJUST', index: 1, value: 5 });
    state = gameReducer(state, { type: 'ADJUST', index: 2, value: -3 });
    state = gameReducer(state, { type: 'DIVIDE', divisor: 3 });
    expect(state.accumulated).toEqual([3.3, 1.7, -1, 0]);
    expect(state.undoStack).toHaveLength(4);
  });
});

describe('ADJUST', () => {
  it('sets the value and records the delta for undo', () => {
    const state = gameReducer(initialGameState, {
      type: 'ADJUST',
      index: 0,
      value: 12.5,
    });
    expect(state.accumulated[0]).toBe(12.5);
    expect(state.undoStack[0]?.score).toBe(12.5);
    expect(state.undoStack[0]?.kind).toBe('adjust');
  });
});

describe('RESET', () => {
  it('clears the day but keeps the names', () => {
    let state = withCell(initialGameState, 0, 0, 5);
    state = gameReducer(state, { type: 'ZHAO', column: 0 });
    state = gameReducer(state, { type: 'RESET' });
    expect(state.names).toEqual(DEFAULT_NAMES);
    expect(state.inputs).toEqual(initialGameState.inputs);
    expect(state.outputs).toEqual([0, 0, 0]);
    expect(state.accumulated).toEqual([0, 0, 0, 0]);
    expect(state.undoStack).toEqual([]);
  });
});

describe('RENAME_ALL', () => {
  it('restores the default name for a blank entry', () => {
    const state = gameReducer(initialGameState, {
      type: 'RENAME_ALL',
      names: ['阿明', '  ', '阿強', '我'],
    });
    expect(state.names).toEqual(['阿明', 'user 2', '阿強', '我']);
  });
});

describe('SWAP', () => {
  it('swaps names, money, and grid columns when both players are in the grid', () => {
    let state = withCell(initialGameState, 0, 0, 5);
    state = gameReducer(state, { type: 'ADJUST', index: 0, value: 10 });
    state = gameReducer(state, { type: 'ADJUST', index: 1, value: -4 });
    state = gameReducer(state, { type: 'SWAP', a: 0, b: 1 });
    expect(state.names).toEqual(['user 2', 'user 1', 'user 3', 'me']);
    expect(state.accumulated).toEqual([-4, 10, 0, 0]);
    expect(state.inputs[0][0]).toBeNull();
    expect(state.inputs[1][0]).toBe(5);
    expect(state.outputs).toEqual([0, 5, 0]);
  });

  it('clears the grid column when one side is me', () => {
    let state = withCell(initialGameState, 0, 0, 5);
    state = gameReducer(state, { type: 'ADJUST', index: 0, value: 10 });
    state = gameReducer(state, { type: 'ADJUST', index: 3, value: -10 });
    state = gameReducer(state, { type: 'SWAP', a: 0, b: 3 });
    expect(state.names).toEqual(['me', 'user 2', 'user 3', 'user 1']);
    expect(state.accumulated).toEqual([-10, 0, 0, 10]);
    expect(state.inputs[0]).toEqual([null, null, null, null, null, null, null]);
    expect(state.outputs[0]).toBe(0);
  });
});

describe('describeUndo', () => {
  it('describes a settlement', () => {
    expect(
      describeUndo({
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
        score: 12,
        kind: 'zhao',
      }),
    ).toBe('已復原：閒1 找數 12 分');
  });

  it('describes a divide', () => {
    expect(
      describeUndo({
        accumulated: [0, 0, 0, 0],
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
      }),
    ).toBe('已復原：÷4');
  });
});
