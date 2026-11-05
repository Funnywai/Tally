import { useRef, useState } from 'react';
import { messageOf } from '../../hooks/useAsync';
import { importBets } from '../api';
import { parseHkjcStatementHtml } from '../lib/hkjcImport';
import type { BetImportStatus, BetResult, HkjcImportRow } from '../types';
import { BetLoaderIcon } from './BetIcons';
import { BetSheet } from './BetSheet';
import type { BetToastKind } from './BetToast';
import { HkjcImportEmptyState, HkjcImportPicker, HkjcImportSummary } from './HkjcImportControls';
import { HkjcImportRowCard } from './HkjcImportRowCard';

const MAX_IMPORT_ROWS = 200;

interface PreviewRow {
  readonly row: HkjcImportRow;
  readonly status: BetImportStatus | null;
  readonly include: boolean;
  readonly result: BetResult;
}

type Busy = 'parsing' | 'checking' | 'importing' | null;

interface HkjcImportSheetProps {
  readonly onClose: () => void;
  readonly onImported: () => void;
  readonly onNotify: (message: string, kind: BetToastKind) => void;
}

function toImportBet(item: PreviewRow) {
  return {
    externalId: item.row.externalId,
    date: item.row.date,
    stake: item.row.stake,
    result: item.result,
    legs: item.row.legs,
    profitOverride: item.row.profitOverride,
  };
}

export function HkjcImportSheet({ onClose, onImported, onNotify }: HkjcImportSheetProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [globalWarnings, setGlobalWarnings] = useState<string[]>([]);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const checkDuplicates = async (candidate: PreviewRow[]) => {
    setBusy('checking');
    setError(null);
    try {
      const response = await importBets({
        dryRun: true,
        bets: candidate.map(toImportBet),
      });
      const statuses = new Map(response.items.map((item) => [item.externalId, item.status]));
      setRows((current) =>
        current.map((item) => {
          const status = statuses.get(item.row.externalId) ?? null;
          return {
            ...item,
            status,
            include: status === 'duplicate' ? false : item.include,
          };
        }),
      );
    } catch (caught: unknown) {
      setError(`重複檢查失敗：${messageOf(caught)}`);
    } finally {
      setBusy(null);
    }
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setRows([]);
    setGlobalWarnings([]);
    setEmptyReason(null);
    setError(null);
    setBusy('parsing');
    try {
      const text = await file.text();
      const parsed = parseHkjcStatementHtml(text);
      setGlobalWarnings(parsed.warnings);
      if (parsed.rows.length === 0) {
        setEmptyReason(parsed.warnings[0] ?? '找不到可匯入的注單。');
        setBusy(null);
        return;
      }
      if (parsed.rows.length > MAX_IMPORT_ROWS) {
        setEmptyReason(`找到 ${parsed.rows.length} 筆注單，單次最多可匯入 ${MAX_IMPORT_ROWS} 筆。`);
        setBusy(null);
        return;
      }
      const next: PreviewRow[] = parsed.rows.map((row) => ({
        row,
        status: null,
        include: true,
        result: row.result,
      }));
      setRows(next);
      await checkDuplicates(next);
    } catch (caught: unknown) {
      setError(messageOf(caught));
      setBusy(null);
    }
  };

  const updateRow = (externalId: string, patch: Partial<Omit<PreviewRow, 'row'>>) => {
    setRows((current) =>
      current.map((item) => (item.row.externalId === externalId ? { ...item, ...patch } : item)),
    );
  };

  const selectAll = () => {
    setRows((current) =>
      current.map((item) => (item.status === 'duplicate' ? item : { ...item, include: true })),
    );
  };

  const handleImport = async () => {
    if (busy !== null) {
      return;
    }
    const selected = rows.filter((item) => item.include && item.status !== 'duplicate');
    if (selected.length === 0) {
      return;
    }
    setBusy('importing');
    setError(null);
    try {
      const response = await importBets({ dryRun: false, bets: selected.map(toImportBet) });
      onNotify(`已匯入 ${response.imported} 筆，跳過 ${response.skipped} 筆`, 'success');
      onClose();
      onImported();
    } catch (caught: unknown) {
      setError(`匯入失敗：${messageOf(caught)}`);
      setBusy(null);
    }
  };

  const requestClose = () => {
    if (busy === null) {
      onClose();
    }
  };

  const importable = rows.filter((item) => item.status !== 'duplicate').length;
  const duplicates = rows.filter((item) => item.status === 'duplicate').length;
  const selected = rows.filter((item) => item.include && item.status !== 'duplicate');
  const warningCount = new Set([...globalWarnings, ...rows.flatMap((item) => item.row.warnings)])
    .size;
  const statusesReady = rows.length > 0 && rows.every((item) => item.status !== null);
  const importDisabled = busy !== null || selected.length === 0 || !statusesReady;

  const importLabel =
    busy === 'parsing'
      ? '解析中…'
      : busy === 'checking'
        ? '檢查中…'
        : busy === 'importing'
          ? '匯入中…'
          : `匯入 ${selected.length} 筆`;

  return (
    <BetSheet
      open
      full
      title="匯入 HKJC"
      description="由 HKJC 帳戶結單匯入注單，核對後寫入。"
      onClose={requestClose}
      footer={
        <>
          <div className="bet-sheet__footer-spacer" />
          <button
            type="button"
            className="bet-button bet-button--ghost"
            onClick={requestClose}
            disabled={busy !== null}
          >
            取消
          </button>
          <button
            type="button"
            className="bet-button bet-button--primary"
            onClick={() => void handleImport()}
            disabled={importDisabled}
          >
            {busy === null ? null : <BetLoaderIcon size={16} className="bet-spin" />}
            {importLabel}
          </button>
        </>
      }
    >
      <div className="bet-import">
        <HkjcImportPicker
          fileName={fileName}
          busy={busy !== null}
          inputRef={inputRef}
          onFile={(file) => void handleFile(file)}
        />

        {error === null ? null : (
          <div className="bet-inline-error" role="alert">
            <span>{error}</span>
            {rows.length > 0 && !statusesReady && busy === null ? (
              <button
                type="button"
                className="bet-button bet-button--ghost"
                onClick={() => void checkDuplicates(rows)}
              >
                重試
              </button>
            ) : null}
          </div>
        )}

        {rows.length > 0 ? (
          <>
            <HkjcImportSummary
              importable={importable}
              duplicates={duplicates}
              warningCount={warningCount}
              warnings={globalWarnings}
              busy={busy !== null}
              onSelectAll={selectAll}
            />

            {busy === 'checking' ? (
              <p className="bet-import__status" role="status">
                正在檢查重複注單…
              </p>
            ) : null}

            <div className="bet-import__list">
              {rows.map((item) => (
                <HkjcImportRowCard
                  key={item.row.externalId}
                  row={item.row}
                  status={item.status}
                  include={item.include}
                  result={item.result}
                  onChangeInclude={(include) => updateRow(item.row.externalId, { include })}
                  onChangeResult={(result) => updateRow(item.row.externalId, { result })}
                />
              ))}
            </div>
          </>
        ) : null}

        <HkjcImportEmptyState
          emptyReason={emptyReason}
          showHint={rows.length === 0 && emptyReason === null && busy === null && error === null}
          busy={busy !== null}
          onChoose={() => inputRef.current?.click()}
        />
      </div>
    </BetSheet>
  );
}
