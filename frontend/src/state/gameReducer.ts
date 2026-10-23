import {
  applyTikai,
  computeFood,
  computeOutput,
  computeSpecial,
  divideAll,
  round1,
} from '../lib/scoring';
import {
  type ColumnIndex,
  type PlayerIndex,
  type Quad,
  ROW_COUNT,
  type Triple,
} from '../lib/types';
import {
  cloneInputs,
  DEFAULT_NAMES,
  emptyColumn,
  emptyInputs,
  type GameAction,
  type GameState,
  normalizeName,
} from './gameTypes';
import { assertNever, pushUndo, snapshotOf } from './undo';

export type { GameAction, GameState, UndoKind, UndoSnapshot } from './gameTypes';
export { DEFAULT_NAMES, emptyColumn, initialGameState } from './gameTypes';
export { describeUndo } from './undo';

function toColumnIndex(index: PlayerIndex): ColumnIndex | null {
  if (index === 0) {
    return 0;
  }
  if (index === 1) {
    return 1;
  }
  if (index === 2) {
    return 2;
  }
  return null;
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_NAME': {
      const names: Quad<string> = [...state.names];
      names[action.index] = normalizeName(action.name, DEFAULT_NAMES[action.index]);
      return { ...state, names };
    }
    case 'SET_CELL': {
      if (action.row < 0 || action.row >= ROW_COUNT) {
        return state;
      }
      if (action.value !== null && !Number.isFinite(action.value)) {
        return state;
      }
      const inputs = cloneInputs(state.inputs);
      const column = inputs[action.column];
      column[action.row] = action.value;
      const outputs: Triple<number> = [...state.outputs];
      outputs[action.column] = computeOutput(column);
      const tikai: Triple<boolean> = [...state.tikai];
      tikai[action.column] = false;
      return { ...state, inputs, outputs, tikai };
    }
    case 'TIKAI': {
      if (state.tikai[action.column]) {
        return state;
      }
      const snapshot = snapshotOf(state, state.names[action.column], action.column, 0, 'tikai');
      const outputs: Triple<number> = [...state.outputs];
      outputs[action.column] = applyTikai(state.outputs[action.column]);
      const tikai: Triple<boolean> = [...state.tikai];
      tikai[action.column] = true;
      return { ...state, outputs, tikai, undoStack: pushUndo(state, snapshot) };
    }
    case 'ZHAO': {
      const score = state.outputs[action.column];
      if (score === 0) {
        return state;
      }
      const snapshot = snapshotOf(state, state.names[action.column], action.column, score, 'zhao');
      const accumulated: Quad<number> = [...state.accumulated];
      accumulated[action.column] = round1(accumulated[action.column] - score);
      accumulated[3] = round1(accumulated[3] + score);
      const inputs = cloneInputs(state.inputs);
      inputs[action.column] = emptyColumn();
      const outputs: Triple<number> = [...state.outputs];
      outputs[action.column] = 0;
      const tikai: Triple<boolean> = [...state.tikai];
      tikai[action.column] = false;
      return {
        ...state,
        accumulated,
        inputs,
        outputs,
        tikai,
        undoStack: pushUndo(state, snapshot),
      };
    }
    case 'ADJUST': {
      if (!Number.isFinite(action.value)) {
        return state;
      }
      const value = round1(action.value);
      if (value === state.accumulated[action.index]) {
        return state;
      }
      const snapshot = snapshotOf(
        state,
        state.names[action.index],
        action.index,
        round1(value - state.accumulated[action.index]),
        'adjust',
      );
      const accumulated: Quad<number> = [...state.accumulated];
      accumulated[action.index] = value;
      return { ...state, accumulated, undoStack: pushUndo(state, snapshot) };
    }
    case 'DIVIDE': {
      const total = round1(state.accumulated.reduce((sum, value) => sum + value, 0));
      if (state.divided || total !== 0) {
        return state;
      }
      const snapshot = snapshotOf(state, `÷${action.divisor}`, -1, 0, 'divide');
      return {
        ...state,
        accumulated: divideAll(state.accumulated, action.divisor),
        divided: true,
        written: false,
        undoStack: pushUndo(state, snapshot),
      };
    }
    case 'MARK_WRITTEN': {
      if (!state.divided || state.written) {
        return state;
      }
      return { ...state, written: true, undoStack: [] };
    }
    case 'SPECIAL': {
      const snapshot = snapshotOf(
        state,
        `特別賞罰·${state.names[action.index]}`,
        action.index,
        action.score,
        'special',
      );
      return {
        ...state,
        accumulated: computeSpecial(state.accumulated, action.index, action.kind, action.score),
        undoStack: pushUndo(state, snapshot),
      };
    }
    case 'FOOD': {
      const totalPaid = action.paid.reduce((sum, value) => sum + value, 0);
      const totalOwed = action.owed.reduce((sum, value) => sum + value, 0);
      if (totalPaid === 0 && totalOwed === 0) {
        return state;
      }
      const snapshot = snapshotOf(state, '計算飯錢', -1, 0, 'food');
      return {
        ...state,
        accumulated: computeFood(state.accumulated, action.paid, action.owed),
        undoStack: pushUndo(state, snapshot),
      };
    }
    case 'RESET':
      return {
        names: [...state.names],
        inputs: emptyInputs(),
        outputs: [0, 0, 0],
        tikai: [false, false, false],
        accumulated: [0, 0, 0, 0],
        divided: false,
        written: false,
        undoStack: [],
      };
    case 'RENAME_ALL': {
      const names: Quad<string> = [
        normalizeName(action.names[0], DEFAULT_NAMES[0]),
        normalizeName(action.names[1], DEFAULT_NAMES[1]),
        normalizeName(action.names[2], DEFAULT_NAMES[2]),
        normalizeName(action.names[3], DEFAULT_NAMES[3]),
      ];
      return { ...state, names };
    }
    case 'SWAP': {
      if (action.a === action.b) {
        return state;
      }
      const names: Quad<string> = [...state.names];
      const accumulated: Quad<number> = [...state.accumulated];
      const nameA = names[action.a];
      names[action.a] = names[action.b];
      names[action.b] = nameA;
      const scoreA = accumulated[action.a];
      accumulated[action.a] = accumulated[action.b];
      accumulated[action.b] = scoreA;

      const aColumn = toColumnIndex(action.a);
      const bColumn = toColumnIndex(action.b);
      if (aColumn !== null && bColumn !== null) {
        const inputs = cloneInputs(state.inputs);
        const inputA = inputs[aColumn];
        inputs[aColumn] = inputs[bColumn];
        inputs[bColumn] = inputA;
        const outputs: Triple<number> = [...state.outputs];
        const outputA = outputs[aColumn];
        outputs[aColumn] = outputs[bColumn];
        outputs[bColumn] = outputA;
        const tikai: Triple<boolean> = [...state.tikai];
        const tikaiA = tikai[aColumn];
        tikai[aColumn] = tikai[bColumn];
        tikai[bColumn] = tikaiA;
        return { ...state, names, accumulated, inputs, outputs, tikai };
      }

      const grid = aColumn ?? bColumn;
      if (grid === null) {
        return { ...state, names, accumulated };
      }
      const inputs = cloneInputs(state.inputs);
      inputs[grid] = emptyColumn();
      const outputs: Triple<number> = [...state.outputs];
      outputs[grid] = 0;
      const tikai: Triple<boolean> = [...state.tikai];
      tikai[grid] = false;
      return { ...state, names, accumulated, inputs, outputs, tikai };
    }
    case 'UNDO': {
      const snapshot = state.undoStack.at(-1);
      if (snapshot === undefined) {
        return state;
      }
      return {
        ...state,
        accumulated: [...snapshot.accumulated],
        inputs: cloneInputs(snapshot.inputs),
        outputs: [...snapshot.outputs],
        tikai: [...snapshot.tikai],
        divided: snapshot.divided,
        undoStack: state.undoStack.slice(0, -1),
      };
    }
    case 'HYDRATE':
      return action.state;
    default:
      return assertNever(action);
  }
}
