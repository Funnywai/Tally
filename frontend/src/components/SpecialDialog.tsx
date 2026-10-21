import { useEffect, useState } from 'react';
import { formatPlainScore } from '../lib/money';
import { PLAYER_INDICES, type PlayerIndex, type Quad } from '../lib/types';
import { Sheet } from './Sheet';

interface SpecialDialogProps {
  readonly open: boolean;
  readonly names: Quad<string>;
  readonly onClose: () => void;
  readonly onConfirm: (index: PlayerIndex, kind: 'win' | 'lose', score: 5 | 10) => void;
}

const SPECIAL_SCORES: readonly (5 | 10)[] = [5, 10];

function signed(value: number): string {
  return value > 0 ? `+${formatPlainScore(value)}` : formatPlainScore(value);
}

export function SpecialDialog({ open, names, onClose, onConfirm }: SpecialDialogProps) {
  const [index, setIndex] = useState<PlayerIndex | null>(null);
  const [kind, setKind] = useState<'win' | 'lose' | null>(null);
  const [score, setScore] = useState<5 | 10 | null>(null);

  useEffect(() => {
    if (open) {
      setIndex(null);
      setKind(null);
      setScore(null);
    }
  }, [open]);

  const ready = index !== null && kind !== null && score !== null;
  const preview =
    ready && index !== null && kind !== null && score !== null
      ? `${names[index]} ${kind === 'win' ? '收' : '賠'} ${score} 分 · 其餘各 ${signed(kind === 'win' ? -score : score)}`
      : null;

  return (
    <Sheet
      open={open}
      title="特別賞罰"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="button button--primary"
            disabled={!ready}
            onClick={() => {
              if (index !== null && kind !== null && score !== null) {
                onConfirm(index, kind, score);
              }
            }}
          >
            確認
          </button>
        </>
      }
    >
      <div className="dialog-section">
        <p className="dialog-label">玩家</p>
        <div className="chip-grid chip-grid--two">
          {PLAYER_INDICES.map((playerIndex) => (
            <button
              key={playerIndex}
              type="button"
              className={`chip ${index === playerIndex ? 'is-selected' : ''}`}
              aria-pressed={index === playerIndex}
              onClick={() => setIndex(playerIndex)}
            >
              {names[playerIndex]}
            </button>
          ))}
        </div>
      </div>

      <div className="dialog-section">
        <p className="dialog-label">類型</p>
        <div className="segmented segmented--two">
          <button
            type="button"
            className={`segmented__item ${kind === 'win' ? 'is-selected is-positive' : ''}`}
            aria-pressed={kind === 'win'}
            onClick={() => setKind('win')}
          >
            收
          </button>
          <button
            type="button"
            className={`segmented__item ${kind === 'lose' ? 'is-selected is-negative' : ''}`}
            aria-pressed={kind === 'lose'}
            onClick={() => setKind('lose')}
          >
            賠
          </button>
        </div>
      </div>

      <div className="dialog-section">
        <p className="dialog-label">分數</p>
        <div className="segmented segmented--two">
          {SPECIAL_SCORES.map((value) => (
            <button
              key={value}
              type="button"
              className={`segmented__item ${score === value ? 'is-selected' : ''}`}
              aria-pressed={score === value}
              onClick={() => setScore(value)}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {preview === null ? null : <p className="dialog-preview">{preview}</p>}
    </Sheet>
  );
}
