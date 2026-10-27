import { BetLoaderIcon } from './BetIcons';
import { BetSheet } from './BetSheet';

export function BetConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '確認刪除',
  loading = false,
  error = null,
  onConfirm,
  onClose,
}: {
  readonly open: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel?: string;
  readonly loading?: boolean;
  readonly error?: string | null;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
}) {
  return (
    <BetSheet
      open={open}
      title={title}
      description={message}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="bet-button bet-button--ghost"
            onClick={onClose}
            disabled={loading}
          >
            取消
          </button>
          <button
            type="button"
            className="bet-button bet-button--danger"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <BetLoaderIcon size={16} className="bet-spin" /> : null}
            {loading ? '處理中…' : confirmLabel}
          </button>
        </>
      }
    >
      {error === null ? null : (
        <p className="bet-confirm__error" role="alert">
          {error}
        </p>
      )}
    </BetSheet>
  );
}
