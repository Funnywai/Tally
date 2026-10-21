import { type MouseEvent, type ReactNode, useEffect, useId, useRef } from 'react';
import { XIcon } from './Icons';

interface SheetProps {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string | undefined;
  readonly onClose: () => void;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
}

export function Sheet({ open, title, description, onClose, children, footer }: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      document.body.classList.add('sheet-open');
      window.requestAnimationFrame(() => {
        if (panelRef.current !== null) {
          panelRef.current.scrollTop = 0;
        }
      });
    }
    if (!open && dialog.open) {
      dialog.close();
      document.body.classList.remove('sheet-open');
    }
    return () => {
      if (dialog.open) {
        dialog.close();
      }
      document.body.classList.remove('sheet-open');
    };
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    const handleCancel = (event: Event) => {
      event.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  const handleBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialogRef.current) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby={titleId}
      aria-describedby={description === undefined ? undefined : descriptionId}
      onClick={handleBackdrop}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className={`sheet__panel ${children === undefined || children === null ? 'sheet__panel--bodyless' : ''}`}
      >
        <div className="sheet__handle" aria-hidden="true" />
        <header className="sheet__header">
          <div>
            <h2 id={titleId} className="sheet__title">
              {title}
            </h2>
            {description === undefined ? null : (
              <p id={descriptionId} className="sheet__description">
                {description}
              </p>
            )}
          </div>
          <button type="button" className="icon-button" aria-label="關閉" onClick={onClose}>
            <XIcon size={20} />
          </button>
        </header>
        {children === undefined || children === null ? null : (
          <div className="sheet__body">{children}</div>
        )}
        {footer === undefined ? null : <footer className="sheet__footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
