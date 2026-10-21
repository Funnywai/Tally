import type { ReactNode } from 'react';
import { LoaderIcon } from './Icons';
import { Sheet } from './Sheet';

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly message?: ReactNode;
  readonly confirmLabel?: string;
  readonly cancelLabel?: string;
  readonly danger?: boolean;
  readonly loading?: boolean;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
  readonly children?: ReactNode;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = '確認',
  cancelLabel = '取消',
  danger = false,
  loading = false,
  onConfirm,
  onClose,
  children,
}: ConfirmDialogProps) {
  const body =
    message === undefined || message === null ? (
      children
    ) : (
      <>
        <div className="confirm-message">{message}</div>
        {children}
      </>
    );

  return (
    <Sheet
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="button button--ghost"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`button ${danger ? 'button--danger' : 'button--primary'}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <LoaderIcon size={18} className="spin" /> : null}
            {loading ? '處理中…' : confirmLabel}
          </button>
        </>
      }
    >
      {body}
    </Sheet>
  );
}
