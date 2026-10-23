import { useEffect, useState } from 'react';
import { isApiError, type RecordItem, updateRecord } from '../lib/api';
import { formatDateLong } from '../lib/date';
import { LoaderIcon } from './Icons';
import { Sheet } from './Sheet';

interface Draft {
  readonly playerId: string;
  readonly name: string;
  readonly score: string;
}

interface EditRecordDialogProps {
  readonly open: boolean;
  readonly record: RecordItem | null;
  readonly onClose: () => void;
  readonly onSaved: (record: RecordItem) => void;
}

export function EditRecordDialog({ open, record, onClose, onSaved }: EditRecordDialogProps) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && record !== null) {
      setDrafts(
        record.players.map((player) => ({
          playerId: player.playerId,
          name: player.name,
          score: String(player.score),
        })),
      );
      setError(null);
      setLoading(false);
      setDate(record.date);
    }
  }, [open, record]);

  const update = (index: number, field: 'name' | 'score', value: string) => {
    setDrafts((current) =>
      current.map((draft, draftIndex) =>
        draftIndex === index ? { ...draft, [field]: value } : draft,
      ),
    );
  };

  const save = async () => {
    if (record === null || loading) {
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
      setError('請選擇有效日期。');
      return;
    }
    const players: { playerId: string; name: string; score: number }[] = [];
    const seenNames = new Set<string>();
    for (const draft of drafts) {
      const name = draft.name.trim();
      const score = Number.parseFloat(draft.score);
      if (name === '') {
        setError('名稱不可空白。');
        return;
      }
      if (!Number.isFinite(score)) {
        setError('分數必須是數字。');
        return;
      }
      if (seenNames.has(name)) {
        setError('同一筆記錄不可有重複玩家。');
        return;
      }
      seenNames.add(name);
      players.push({ playerId: draft.playerId, name, score });
    }
    setLoading(true);
    setError(null);
    try {
      const updated = await updateRecord(record.id, date, players);
      onSaved(updated);
    } catch (caught: unknown) {
      setError(isApiError(caught) ? caught.message : '更新失敗，請再試一次。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet
      open={open && record !== null}
      title="編輯記錄"
      description={record === null ? undefined : formatDateLong(date === '' ? record.date : date)}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="button button--ghost"
            onClick={onClose}
            disabled={loading}
          >
            取消
          </button>
          <button
            type="button"
            className="button button--primary"
            onClick={() => void save()}
            disabled={loading}
          >
            {loading ? <LoaderIcon size={18} className="spin" /> : null}
            {loading ? '儲存中…' : '儲存'}
          </button>
        </>
      }
    >
      <div className="form-stack">
        <label className="field">
          <span className="field__label">日期</span>
          <input
            className="field__input"
            type="date"
            aria-label="記錄日期"
            value={date}
            onChange={(event) => {
              setDate(event.target.value);
              setError(null);
            }}
          />
        </label>
        {drafts.map((draft, index) => (
          <div key={draft.playerId} className="edit-row">
            <label className="field">
              <span className="field__label">名稱</span>
              <input
                className="field__input"
                value={draft.name}
                aria-label={`第 ${index + 1} 位玩家名稱`}
                maxLength={7}
                onChange={(event) => update(index, 'name', event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">分數</span>
              <input
                className="field__input"
                type="number"
                inputMode="decimal"
                step="0.1"
                aria-label={`第 ${index + 1} 位玩家分數`}
                value={draft.score}
                onChange={(event) => update(index, 'score', event.target.value)}
              />
            </label>
          </div>
        ))}
      </div>
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Sheet>
  );
}
