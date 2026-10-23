import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AlertIcon, CheckIcon, InfoIcon } from './Icons';

export type ToastKind = 'info' | 'success' | 'error';

export interface ToastAction {
  readonly label: string;
  readonly onClick: () => void;
}

interface ToastItem {
  readonly id: number;
  readonly message: string;
  readonly kind: ToastKind;
  readonly action?: ToastAction;
}

interface ToastApi {
  readonly showToast: (message: string, kind?: ToastKind, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

function ToastCard({
  toast,
  onDismiss,
}: {
  readonly toast: ToastItem;
  readonly onDismiss: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.action ? 4500 : 2500);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.action, onDismiss]);

  const Icon = toast.kind === 'success' ? CheckIcon : toast.kind === 'error' ? AlertIcon : InfoIcon;

  return (
    <div className={`toast toast--${toast.kind}`} role="status">
      <Icon size={18} className="toast__icon" />
      <span className="toast__message">{toast.message}</span>
      {toast.action === undefined ? null : (
        <button
          type="button"
          className="toast__action"
          onClick={() => {
            toast.action?.onClick();
            onDismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = 'info', action?: ToastAction) => {
      idRef.current += 1;
      const id = idRef.current;
      setToasts([{ id, message, kind, ...(action === undefined ? {} : { action }) }]);
    },
    [],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const value = useContext(ToastContext);
  if (value === null) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return value;
}
