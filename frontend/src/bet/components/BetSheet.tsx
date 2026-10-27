import { type MouseEvent, type ReactNode, useEffect, useId, useRef } from 'react';
import { BetXIcon } from './BetIcons';

interface BetSheetProps {
  readonly open: boolean;
  readonly title: string;
  readonly description?: string | undefined;
  readonly full?: boolean;
  readonly onClose: () => void;
  readonly children?: ReactNode;
  readonly footer?: ReactNode;
}

/**
 * Body scroll is shared by every open sheet (the edit form and the delete
 * confirmation can be stacked). Keep a module-level count so closing the top
 * sheet does not unlock the page behind the sheet that is still open.
 */
let lockedSheetCount = 0;

function acquireBodyLock(): void {
  lockedSheetCount += 1;
  document.body.classList.add('bet-sheet-open');
}

function releaseBodyLock(): void {
  lockedSheetCount = Math.max(0, lockedSheetCount - 1);
  if (lockedSheetCount === 0) {
    document.body.classList.remove('bet-sheet-open');
  }
}

/**
 * `showModal()` normally restores focus on close, but React unmounts the sheet
 * in the same commit, so the browser's restore can land on the body. Restore
 * explicitly to the element that was focused before the sheet opened.
 */
function restoreFocusTo(target: HTMLElement | null): void {
  if (target === null || !target.isConnected) {
    return;
  }
  window.requestAnimationFrame(() => {
    if (target.isConnected) {
      target.focus();
    }
  });
}

export function BetSheet({
  open,
  title,
  description,
  full = false,
  onClose,
  children,
  footer,
}: BetSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const lockedRef = useRef(false);
  const restoreRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (open) {
      if (!dialog.open) {
        const active = document.activeElement;
        restoreRef.current = active instanceof HTMLElement ? active : null;
        dialog.showModal();
      }
      if (!lockedRef.current) {
        lockedRef.current = true;
        acquireBodyLock();
      }
      window.requestAnimationFrame(() => {
        if (bodyRef.current !== null) {
          bodyRef.current.scrollTop = 0;
        }
      });
    } else if (dialog.open) {
      dialog.close();
    }
    return () => {
      const target = restoreRef.current;
      restoreRef.current = null;
      if (dialog.open) {
        dialog.close();
      }
      if (lockedRef.current) {
        lockedRef.current = false;
        releaseBodyLock();
      }
      restoreFocusTo(target);
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
      className={`bet-sheet ${full ? 'bet-sheet--full' : ''}`}
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
      <div className="bet-sheet__panel">
        <div className="bet-sheet__handle" aria-hidden="true" />
        <header className="bet-sheet__header">
          <div>
            <h2 id={titleId} className="bet-sheet__title">
              {title}
            </h2>
            {description === undefined ? null : (
              <p id={descriptionId} className="bet-sheet__description">
                {description}
              </p>
            )}
          </div>
          <button type="button" className="bet-icon-button" aria-label="關閉" onClick={onClose}>
            <BetXIcon size={20} />
          </button>
        </header>
        {children === undefined || children === null ? null : (
          <div ref={bodyRef} className="bet-sheet__body">
            {children}
          </div>
        )}
        {footer === undefined ? null : <footer className="bet-sheet__footer">{footer}</footer>}
      </div>
    </dialog>
  );
}
