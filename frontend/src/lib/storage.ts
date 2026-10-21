import {
  DEFAULT_NAMES,
  emptyColumn,
  type GameState,
  type UndoKind,
  type UndoSnapshot,
} from '../state/gameReducer';
import { type Column, MAX_NAME_LENGTH, type Quad, ROW_COUNT, type Triple } from './types';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const STORAGE_KEYS = {
  names: 'mj_names',
  inputs: 'mj_inputs',
  outputs: 'mj_outputs',
  tikai: 'mj_tikai',
  accumulated: 'mj_accumulated',
  undoStack: 'mj_undo_stack',
} as const;

const UNDO_KINDS: readonly UndoKind[] = ['zhao', 'adjust', 'divide', 'special', 'food'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function readJson(storage: StorageLike, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return parsed;
  } catch {
    return null;
  }
}

function parseNames(value: unknown): Quad<string> | null {
  if (!Array.isArray(value) || value.length !== 4) {
    return null;
  }
  const names: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    const entry = value[index];
    if (typeof entry !== 'string') {
      return null;
    }
    const trimmed = entry.trim();
    const fallback = DEFAULT_NAMES[index] ?? 'user';
    names.push(trimmed === '' ? fallback : [...trimmed].slice(0, MAX_NAME_LENGTH).join(''));
  }
  return [
    names[0] ?? DEFAULT_NAMES[0],
    names[1] ?? DEFAULT_NAMES[1],
    names[2] ?? DEFAULT_NAMES[2],
    names[3] ?? DEFAULT_NAMES[3],
  ];
}

function parseColumn(value: unknown): Column | null {
  if (!Array.isArray(value) || value.length !== ROW_COUNT) {
    return null;
  }
  const column: Column = [];
  for (const cell of value) {
    if (cell === null) {
      column.push(null);
    } else if (isFiniteNumber(cell)) {
      column.push(cell);
    } else {
      return null;
    }
  }
  return column;
}

function parseInputs(value: unknown): Triple<Column> | null {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  const first = parseColumn(value[0]);
  const second = parseColumn(value[1]);
  const third = parseColumn(value[2]);
  if (first === null || second === null || third === null) {
    return null;
  }
  return [first, second, third];
}

function parseTripleNumbers(value: unknown): Triple<number> | null {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  const [first, second, third] = value;
  if (!isFiniteNumber(first) || !isFiniteNumber(second) || !isFiniteNumber(third)) {
    return null;
  }
  return [first, second, third];
}

function parseQuadNumbers(value: unknown): Quad<number> | null {
  if (!Array.isArray(value) || value.length !== 4) {
    return null;
  }
  const [first, second, third, fourth] = value;
  if (
    !isFiniteNumber(first) ||
    !isFiniteNumber(second) ||
    !isFiniteNumber(third) ||
    !isFiniteNumber(fourth)
  ) {
    return null;
  }
  return [first, second, third, fourth];
}

function parseTripleBooleans(value: unknown): Triple<boolean> | null {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }
  const [first, second, third] = value;
  if (typeof first !== 'boolean' || typeof second !== 'boolean' || typeof third !== 'boolean') {
    return null;
  }
  return [first, second, third];
}

function parseUndoKind(value: unknown): UndoKind | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  return UNDO_KINDS.find((kind) => kind === value);
}

function parseSnapshot(value: unknown): UndoSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }
  const accumulated = parseQuadNumbers(value.accumulated);
  const inputs = parseInputs(value.inputs);
  const outputs = parseTripleNumbers(value.outputs);
  const tikai = parseTripleBooleans(value.tikai);
  const who = typeof value.who === 'string' ? value.who : null;
  const whoIdx = isFiniteNumber(value.whoIdx) ? value.whoIdx : null;
  const score = isFiniteNumber(value.score) ? value.score : null;
  if (
    accumulated === null ||
    inputs === null ||
    outputs === null ||
    tikai === null ||
    who === null ||
    whoIdx === null ||
    score === null
  ) {
    return null;
  }
  const kind = parseUndoKind(value.kind);
  return {
    accumulated,
    inputs,
    outputs,
    tikai,
    who,
    whoIdx,
    score,
    ...(kind === undefined ? {} : { kind }),
  };
}

function parseUndoStack(value: unknown): UndoSnapshot[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const snapshots: UndoSnapshot[] = [];
  for (const entry of value) {
    const snapshot = parseSnapshot(entry);
    if (snapshot !== null) {
      snapshots.push(snapshot);
    }
  }
  return snapshots.slice(-50);
}

function emptyInputs(): Triple<Column> {
  return [emptyColumn(), emptyColumn(), emptyColumn()];
}

export function loadGameState(storage: StorageLike): GameState {
  return {
    names: parseNames(readJson(storage, STORAGE_KEYS.names)) ?? [...DEFAULT_NAMES],
    inputs: parseInputs(readJson(storage, STORAGE_KEYS.inputs)) ?? emptyInputs(),
    outputs: parseTripleNumbers(readJson(storage, STORAGE_KEYS.outputs)) ?? [0, 0, 0],
    tikai: parseTripleBooleans(readJson(storage, STORAGE_KEYS.tikai)) ?? [false, false, false],
    accumulated: parseQuadNumbers(readJson(storage, STORAGE_KEYS.accumulated)) ?? [0, 0, 0, 0],
    undoStack: parseUndoStack(readJson(storage, STORAGE_KEYS.undoStack)),
  };
}

export function saveGameState(storage: StorageLike, state: GameState): void {
  storage.setItem(STORAGE_KEYS.names, JSON.stringify(state.names));
  storage.setItem(STORAGE_KEYS.inputs, JSON.stringify(state.inputs));
  storage.setItem(STORAGE_KEYS.outputs, JSON.stringify(state.outputs));
  storage.setItem(STORAGE_KEYS.tikai, JSON.stringify(state.tikai));
  storage.setItem(STORAGE_KEYS.accumulated, JSON.stringify(state.accumulated));
  storage.setItem(STORAGE_KEYS.undoStack, JSON.stringify(state.undoStack));
}
