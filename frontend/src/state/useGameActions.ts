import { useCallback, useEffect, useRef } from 'react';
import { useToast } from '../components/ToastProvider';
import { formatMoney } from '../lib/money';
import type { ColumnIndex, PlayerIndex, Quad } from '../lib/types';
import { useGame } from './GameProvider';
import { describeUndo } from './gameReducer';

export interface GameActions {
  readonly setName: (index: PlayerIndex, name: string) => void;
  readonly setCell: (column: ColumnIndex, row: number, value: number | null) => void;
  readonly tikai: (column: ColumnIndex) => void;
  readonly zhao: (column: ColumnIndex) => void;
  readonly adjust: (index: PlayerIndex, value: number) => void;
  readonly divide: (divisor: 2 | 3 | 4) => void;
  readonly markWritten: () => void;
  readonly special: (index: PlayerIndex, kind: 'win' | 'lose', score: 5 | 10) => void;
  readonly food: (paid: Quad<number>, owed: Quad<number>) => void;
  readonly reset: () => void;
  readonly renameAll: (names: Quad<string>) => void;
  readonly swap: (a: PlayerIndex, b: PlayerIndex) => void;
  readonly undo: () => void;
}

export function useGameActions(): GameActions {
  const { state, dispatch } = useGame();
  const { showToast } = useToast();
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const undo = useCallback(() => {
    const current = stateRef.current;
    const snapshot = current.undoStack.at(-1);
    if (snapshot === undefined) {
      showToast('沒有可復原的操作');
      return;
    }
    dispatch({ type: 'UNDO' });
    showToast(describeUndo(snapshot), 'success');
  }, [dispatch, showToast]);

  const withUndo = useCallback(
    (message: string) => {
      showToast(message, 'success', { label: '復原', onClick: undo });
    },
    [showToast, undo],
  );

  const setName = useCallback(
    (index: PlayerIndex, name: string) => {
      dispatch({ type: 'SET_NAME', index, name });
    },
    [dispatch],
  );

  const setCell = useCallback(
    (column: ColumnIndex, row: number, value: number | null) => {
      dispatch({ type: 'SET_CELL', column, row, value });
    },
    [dispatch],
  );

  const tikai = useCallback(
    (column: ColumnIndex) => {
      dispatch({ type: 'TIKAI', column });
    },
    [dispatch],
  );

  const zhao = useCallback(
    (column: ColumnIndex) => {
      const current = stateRef.current;
      if (current.outputs[column] === 0) {
        showToast('分數為 0，無需找數');
        return;
      }
      dispatch({ type: 'ZHAO', column });
      withUndo('已找數');
    },
    [dispatch, showToast, withUndo],
  );

  const adjust = useCallback(
    (index: PlayerIndex, value: number) => {
      const current = stateRef.current;
      if (value === current.accumulated[index]) {
        return;
      }
      dispatch({ type: 'ADJUST', index, value });
      withUndo(`${current.names[index]} → ${formatMoney(value)}`);
    },
    [dispatch, withUndo],
  );

  const divide = useCallback(
    (divisor: 2 | 3 | 4) => {
      dispatch({ type: 'DIVIDE', divisor });
      withUndo(`已 ÷${divisor}`);
    },
    [dispatch, withUndo],
  );

  const markWritten = useCallback(() => {
    dispatch({ type: 'MARK_WRITTEN' });
  }, [dispatch]);

  const special = useCallback(
    (index: PlayerIndex, kind: 'win' | 'lose', score: 5 | 10) => {
      const current = stateRef.current;
      dispatch({ type: 'SPECIAL', index, kind, score });
      withUndo(`${current.names[index]} ${kind === 'win' ? '贏' : '賠'} ${score} 分`);
    },
    [dispatch, withUndo],
  );

  const food = useCallback(
    (paid: Quad<number>, owed: Quad<number>) => {
      const totalPaid = paid.reduce((sum, value) => sum + value, 0);
      const totalOwed = owed.reduce((sum, value) => sum + value, 0);
      if (totalPaid === 0 && totalOwed === 0) {
        return;
      }
      dispatch({ type: 'FOOD', paid, owed });
      withUndo('已計算飯錢');
    },
    [dispatch, withUndo],
  );

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
    showToast('已重設牌局', 'success');
  }, [dispatch, showToast]);

  const renameAll = useCallback(
    (names: Quad<string>) => {
      dispatch({ type: 'RENAME_ALL', names });
      showToast('已更新名稱', 'success');
    },
    [dispatch, showToast],
  );

  const swap = useCallback(
    (a: PlayerIndex, b: PlayerIndex) => {
      const current = stateRef.current;
      dispatch({ type: 'SWAP', a, b });
      showToast(`已交換 ${current.names[a]} ↔ ${current.names[b]}`, 'success');
    },
    [dispatch, showToast],
  );

  return {
    setName,
    setCell,
    tikai,
    zhao,
    adjust,
    divide,
    markWritten,
    special,
    food,
    reset,
    renameAll,
    swap,
    undo,
  };
}
