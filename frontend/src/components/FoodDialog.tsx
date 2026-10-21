import { useEffect, useState } from 'react';
import { round1 } from '../lib/scoring';
import { PLAYER_INDICES, type PlayerIndex, type Quad } from '../lib/types';
import { Sheet } from './Sheet';

interface FoodDialogProps {
  readonly open: boolean;
  readonly names: Quad<string>;
  readonly onClose: () => void;
  readonly onConfirm: (paid: Quad<number>, owed: Quad<number>) => void;
}

const ZERO: Quad<string> = ['0', '0', '0', '0'];

function setAt(quad: Quad<string>, index: PlayerIndex, value: string): Quad<string> {
  const next: Quad<string> = [...quad];
  next[index] = value;
  return next;
}

function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function FoodDialog({ open, names, onClose, onConfirm }: FoodDialogProps) {
  const [paid, setPaid] = useState<Quad<string>>([...ZERO]);
  const [owed, setOwed] = useState<Quad<string>>([...ZERO]);

  useEffect(() => {
    if (open) {
      setPaid([...ZERO]);
      setOwed([...ZERO]);
    }
  }, [open]);

  const totalPaid = paid.reduce((sum, value) => sum + parseAmount(value), 0);
  const totalOwed = owed.reduce((sum, value) => sum + parseAmount(value), 0);

  const split = () => {
    const share = round1(totalPaid / 4);
    setOwed([String(share), String(share), String(share), String(share)]);
  };

  const confirm = () => {
    if (totalPaid === 0 && totalOwed === 0) {
      onClose();
      return;
    }
    onConfirm(
      [parseAmount(paid[0]), parseAmount(paid[1]), parseAmount(paid[2]), parseAmount(paid[3])],
      [parseAmount(owed[0]), parseAmount(owed[1]), parseAmount(owed[2]), parseAmount(owed[3])],
    );
  };

  return (
    <Sheet
      open={open}
      title="計算飯錢"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="button button--primary" onClick={confirm}>
            確認
          </button>
        </>
      }
    >
      <div className="dialog-section">
        <div className="dialog-section__head">
          <p className="dialog-label">負責俾錢</p>
          <span className="dialog-total">合計 {totalPaid.toFixed(1)}</span>
        </div>
        <div className="amount-grid">
          {PLAYER_INDICES.map((index) => (
            <label key={index} className="amount-field">
              <span className="amount-field__name">{names[index]}</span>
              <input
                className="field__input"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={paid[index]}
                aria-label={`${names[index]} 負責俾錢`}
                onChange={(event) => setPaid(setAt(paid, index, event.target.value))}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="dialog-section">
        <div className="dialog-section__head">
          <p className="dialog-label">費用平攤</p>
          <span className="dialog-total">合計 {totalOwed.toFixed(1)}</span>
        </div>
        <div className="amount-grid">
          {PLAYER_INDICES.map((index) => (
            <label key={index} className="amount-field">
              <span className="amount-field__name">{names[index]}</span>
              <input
                className="field__input"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={owed[index]}
                aria-label={`${names[index]} 費用平攤`}
                onChange={(event) => setOwed(setAt(owed, index, event.target.value))}
                onFocus={(event) => event.currentTarget.select()}
              />
            </label>
          ))}
        </div>
        <button type="button" className="button button--outline button--block" onClick={split}>
          平攤（總額 ÷ 4）
        </button>
      </div>
    </Sheet>
  );
}
