import { useEffect } from 'react';
import { BetAlertIcon, BetCheckIcon, BetInfoIcon } from './BetIcons';

export type BetToastKind = 'success' | 'error' | 'info';

export interface BetToastState {
  readonly message: string;
  readonly kind: BetToastKind;
}

export function BetToast({
  toast,
  onDismiss,
}: {
  readonly toast: BetToastState | null;
  readonly onDismiss: () => void;
}) {
  useEffect(() => {
    if (toast === null) {
      return;
    }
    const timer = window.setTimeout(onDismiss, 2500);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  const Icon =
    toast?.kind === 'success' ? BetCheckIcon : toast?.kind === 'error' ? BetAlertIcon : BetInfoIcon;

  /*
   * The live region stays mounted for the life of the app so toasts inserted
   * later are still announced. Only its contents come and go.
   */
  return (
    <div className="bet-toast-region" role="status" aria-live="polite" aria-atomic="true">
      {toast === null ? null : (
        <div className={`bet-toast bet-toast--${toast.kind}`}>
          <Icon size={18} />
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
