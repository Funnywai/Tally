import { useEffect, useState } from 'react';
import { PLAYER_INDICES, type PlayerIndex, type Quad } from '../lib/types';
import { Sheet } from './Sheet';

interface SwapDialogProps {
  readonly open: boolean;
  readonly names: Quad<string>;
  readonly onClose: () => void;
  readonly onSwap: (a: PlayerIndex, b: PlayerIndex) => void;
}

export function SwapDialog({ open, names, onClose, onSwap }: SwapDialogProps) {
  const [picks, setPicks] = useState<PlayerIndex[]>([]);

  useEffect(() => {
    if (open) {
      setPicks([]);
    }
  }, [open]);

  const toggle = (index: PlayerIndex) => {
    setPicks((current) => {
      if (current.includes(index)) {
        return current.filter((value) => value !== index);
      }
      if (current.length >= 2) {
        return current;
      }
      return [...current, index];
    });
  };

  const first = picks[0];
  const second = picks[1];

  return (
    <Sheet
      open={open}
      title="換位"
      description="交換名稱與分數；兩位都在番數欄時，輸入與輸出會一併交換。"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="button button--primary"
            disabled={first === undefined || second === undefined}
            onClick={() => {
              if (first !== undefined && second !== undefined) {
                onSwap(first, second);
              }
            }}
          >
            確認換位
          </button>
        </>
      }
    >
      <div className="chip-grid chip-grid--two">
        {PLAYER_INDICES.map((index) => (
          <button
            key={index}
            type="button"
            className={`chip ${picks.includes(index) ? 'is-selected' : ''}`}
            aria-pressed={picks.includes(index)}
            onClick={() => toggle(index)}
          >
            {names[index]}
          </button>
        ))}
      </div>
      <p className="dialog-note">其中一位是「我」時，該位在番數欄的輸入、輸出與踢半標記會清空。</p>
    </Sheet>
  );
}
