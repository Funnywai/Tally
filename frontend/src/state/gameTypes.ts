import {
  type Column,
  type ColumnIndex,
  MAX_NAME_LENGTH,
  type PlayerIndex,
  type Quad,
  type Triple,
} from '../lib/types';

export const DEFAULT_NAMES: Quad<string> = ['user 1', 'user 2', 'user 3', 'me'];

export type UndoKind = 'zhao' | 'adjust' | 'divide' | 'special' | 'food';

export interface UndoSnapshot {
  readonly accumulated: Quad<number>;
  readonly inputs: Triple<Column>;
  readonly outputs: Triple<number>;
  readonly tikai: Triple<boolean>;
  readonly who: string;
  readonly whoIdx: number;
  readonly score: number;
  readonly kind?: UndoKind;
}

export interface GameState {
  readonly names: Quad<string>;
  readonly inputs: Triple<Column>;
  readonly outputs: Triple<number>;
  readonly tikai: Triple<boolean>;
  readonly accumulated: Quad<number>;
  readonly undoStack: UndoSnapshot[];
}

export type GameAction =
  | { readonly type: 'SET_NAME'; readonly index: PlayerIndex; readonly name: string }
  | {
      readonly type: 'SET_CELL';
      readonly column: ColumnIndex;
      readonly row: number;
      readonly value: number | null;
    }
  | { readonly type: 'TIKAI'; readonly column: ColumnIndex }
  | { readonly type: 'ZHAO'; readonly column: ColumnIndex }
  | { readonly type: 'ADJUST'; readonly index: PlayerIndex; readonly value: number }
  | { readonly type: 'DIVIDE'; readonly divisor: 2 | 3 | 4 }
  | {
      readonly type: 'SPECIAL';
      readonly index: PlayerIndex;
      readonly kind: 'win' | 'lose';
      readonly score: 5 | 10;
    }
  | { readonly type: 'FOOD'; readonly paid: Quad<number>; readonly owed: Quad<number> }
  | { readonly type: 'RESET' }
  | { readonly type: 'RENAME_ALL'; readonly names: Quad<string> }
  | { readonly type: 'SWAP'; readonly a: PlayerIndex; readonly b: PlayerIndex }
  | { readonly type: 'UNDO' }
  | { readonly type: 'HYDRATE'; readonly state: GameState };

export function emptyColumn(): Column {
  return [null, null, null, null, null, null, null];
}

export function emptyInputs(): Triple<Column> {
  return [emptyColumn(), emptyColumn(), emptyColumn()];
}

export const initialGameState: GameState = {
  names: [...DEFAULT_NAMES],
  inputs: emptyInputs(),
  outputs: [0, 0, 0],
  tikai: [false, false, false],
  accumulated: [0, 0, 0, 0],
  undoStack: [],
};

export function normalizeName(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (trimmed === '') {
    return fallback;
  }
  return [...trimmed].slice(0, MAX_NAME_LENGTH).join('');
}

export function cloneInputs(inputs: Triple<Column>): Triple<Column> {
  return [[...inputs[0]], [...inputs[1]], [...inputs[2]]];
}
