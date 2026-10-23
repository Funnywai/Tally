import { formatPlainScore } from '../lib/money';
import { cloneInputs, type GameState, type UndoKind, type UndoSnapshot } from './gameTypes';

export function pushUndo(state: GameState, snapshot: UndoSnapshot): UndoSnapshot[] {
  return [...state.undoStack, snapshot].slice(-50);
}

export function snapshotOf(
  state: GameState,
  who: string,
  whoIdx: number,
  score: number,
  kind: UndoKind,
): UndoSnapshot {
  return {
    accumulated: [...state.accumulated],
    inputs: cloneInputs(state.inputs),
    outputs: [...state.outputs],
    tikai: [...state.tikai],
    divided: state.divided,
    who,
    whoIdx,
    score,
    kind,
  };
}

export function assertNever(value: never): never {
  throw new Error(`Unhandled undo kind: ${String(value)}`);
}

export function describeUndo(snapshot: UndoSnapshot): string {
  const kind = snapshot.kind ?? 'zhao';
  switch (kind) {
    case 'zhao':
      return `已復原：${snapshot.who} 找數 ${formatPlainScore(snapshot.score)} 分`;
    case 'adjust':
      return `已復原：${snapshot.who} 調整 ${formatPlainScore(snapshot.score)} 分`;
    case 'divide':
      return `已復原：${snapshot.who}`;
    case 'special':
      return `已復原：${snapshot.who}`;
    case 'food':
      return '已復原：計算飯錢';
    default:
      return assertNever(kind);
  }
}
