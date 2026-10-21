import { useEffect, useState } from 'react';
import { deleteRecord, isApiError, type RecordItem } from '../lib/api';
import { formatDateLong } from '../lib/date';
import { formatSignedScore } from '../lib/money';
import { ConfirmDialog } from './ConfirmDialog';

interface DeleteRecordDialogProps {
  readonly open: boolean;
  readonly record: RecordItem | null;
  readonly onClose: () => void;
  readonly onDeleted: () => void;
}

export function DeleteRecordDialog({ open, record, onClose, onDeleted }: DeleteRecordDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(false);
      setError(null);
    }
  }, [open]);

  const confirm = async () => {
    if (record === null || loading) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await deleteRecord(record.id);
      onDeleted();
    } catch (caught: unknown) {
      setError(isApiError(caught) ? caught.message : '刪除失敗，請再試一次。');
    } finally {
      setLoading(false);
    }
  };

  const summary =
    record === null
      ? ''
      : record.players
          .map((player) => `${player.name}: ${formatSignedScore(player.score)}`)
          .join('、');

  return (
    <ConfirmDialog
      open={open && record !== null}
      title="刪除記錄"
      confirmLabel="確認刪除"
      danger
      loading={loading}
      onConfirm={() => void confirm()}
      onClose={onClose}
      message={
        record === null ? null : (
          <>
            <p className="confirm-message__date">{formatDateLong(record.date)}</p>
            <p className="confirm-message__summary">{summary}</p>
            <p className="confirm-message__warning">
              此操作無法復原，將同時刪除遊戲記錄及玩家歷史數據。
            </p>
          </>
        )
      }
    >
      {error === null ? null : (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </ConfirmDialog>
  );
}
