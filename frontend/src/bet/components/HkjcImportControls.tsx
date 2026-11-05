import { type RefObject, useId } from 'react';
import { BetAlertIcon, BetInfoIcon, BetUploadIcon } from './BetIcons';

interface HkjcImportPickerProps {
  readonly fileName: string | null;
  readonly busy: boolean;
  readonly inputRef: RefObject<HTMLInputElement | null>;
  readonly onFile: (file: File) => void;
}

export function HkjcImportPicker({ fileName, busy, inputRef, onFile }: HkjcImportPickerProps) {
  const fileId = useId();
  const privacyId = useId();

  return (
    <div className="bet-import__picker">
      <input
        ref={inputRef}
        id={fileId}
        className="bet-import__input"
        type="file"
        accept=".html,text/html"
        disabled={busy}
        aria-describedby={privacyId}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file !== undefined) {
            onFile(file);
          }
        }}
      />
      <label className={`bet-import__choose ${busy ? 'is-disabled' : ''}`} htmlFor={fileId}>
        <BetUploadIcon size={18} />
        <span className="bet-import__choose-text">{fileName ?? '選擇 HKJC 結單 HTML'}</span>
      </label>
      <p id={privacyId} className="bet-import__privacy">
        <BetInfoIcon size={14} />
        <span>檔案只在本機解析，原檔不會上傳</span>
      </p>
    </div>
  );
}

interface HkjcImportSummaryProps {
  readonly importable: number;
  readonly duplicates: number;
  readonly warningCount: number;
  readonly warnings: readonly string[];
  readonly busy: boolean;
  readonly onSelectAll: () => void;
}

export function HkjcImportSummary({
  importable,
  duplicates,
  warningCount,
  warnings,
  busy,
  onSelectAll,
}: HkjcImportSummaryProps) {
  return (
    <>
      <div className="bet-import__summary" aria-live="polite">
        <span className="bet-import__count">
          可匯入 <strong>{importable}</strong>
        </span>
        <span className="bet-import__count">
          重複 <strong>{duplicates}</strong>
        </span>
        <span className="bet-import__count">
          警告 <strong>{warningCount}</strong>
        </span>
      </div>

      {warnings.length === 0 ? null : (
        <ul className="bet-import__warnings">
          {warnings.map((warning) => (
            <li key={warning}>
              <BetAlertIcon size={14} />
              <span>{warning}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="bet-import__bulk">
        <button
          type="button"
          className="bet-button bet-button--outline"
          onClick={onSelectAll}
          disabled={busy || importable === 0}
        >
          全選
        </button>
      </div>
    </>
  );
}

interface HkjcImportEmptyStateProps {
  readonly emptyReason: string | null;
  readonly showHint: boolean;
  readonly busy: boolean;
  readonly onChoose: () => void;
}

export function HkjcImportEmptyState({
  emptyReason,
  showHint,
  busy,
  onChoose,
}: HkjcImportEmptyStateProps) {
  if (emptyReason !== null) {
    return (
      <div className="bet-import__empty">
        <p className="bet-import__empty-title">未能讀取注單</p>
        <p className="bet-import__empty-text">{emptyReason}</p>
        <button
          type="button"
          className="bet-button bet-button--outline"
          onClick={onChoose}
          disabled={busy}
        >
          再選檔案
        </button>
      </div>
    );
  }
  if (!showHint) {
    return null;
  }
  return (
    <p className="bet-import__hint">
      選擇檔案後會先在本機解析，再檢查哪些注單已經存在；重複的注單不會再匯入。
    </p>
  );
}
