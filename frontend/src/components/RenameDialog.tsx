import { useEffect, useState } from 'react';
import { PLAYER_INDICES, type Quad } from '../lib/types';
import { Sheet } from './Sheet';

interface RenameDialogProps {
  readonly open: boolean;
  readonly names: Quad<string>;
  readonly onClose: () => void;
  readonly onSave: (names: Quad<string>) => void;
}

const LABELS = ['閒 1', '閒 2', '閒 3', '我'] as const;

export function RenameDialog({ open, names, onClose, onSave }: RenameDialogProps) {
  const [drafts, setDrafts] = useState<Quad<string>>([...names]);

  useEffect(() => {
    if (open) {
      setDrafts([...names]);
    }
  }, [open, names]);

  const update = (index: 0 | 1 | 2 | 3, value: string) => {
    const next: Quad<string> = [...drafts];
    next[index] = value;
    setDrafts(next);
  };

  return (
    <Sheet
      open={open}
      title="改名"
      description="最多 7 個字元；留空回復預設名稱。"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button button--ghost" onClick={onClose}>
            取消
          </button>
          <button type="button" className="button button--primary" onClick={() => onSave(drafts)}>
            儲存
          </button>
        </>
      }
    >
      <div className="form-stack">
        {PLAYER_INDICES.map((index) => (
          <label key={index} className="field">
            <span className="field__label">{LABELS[index]}</span>
            <input
              className="field__input"
              value={drafts[index]}
              maxLength={7}
              onChange={(event) => update(index, event.target.value)}
              onFocus={(event) => event.currentTarget.select()}
            />
          </label>
        ))}
      </div>
    </Sheet>
  );
}
