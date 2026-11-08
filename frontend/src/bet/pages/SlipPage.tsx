import { useCallback, useEffect, useRef, useState } from 'react';
import { messageOf } from '../../hooks/useAsync';
import { formatDateLong, groupByDate } from '../../lib/date';
import { deleteBet, fetchBets, updateBet } from '../api';
import { BetCard } from '../components/BetCard';
import { BetConfirmDialog } from '../components/BetConfirmDialog';
import { BetForm } from '../components/BetForm';
import { BetUploadIcon } from '../components/BetIcons';
import { BetSummary } from '../components/BetSummary';
import type { BetToastKind } from '../components/BetToast';
import { HkjcImportSheet } from '../components/HkjcImportSheet';
import { draftFromBet } from '../lib/form';
import type { BetItem, BetOverview, BetPayload, BetStatusFilter } from '../types';

const FILTERS: readonly { id: BetStatusFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'pending', label: '待結算' },
  { id: 'settled', label: '已結算' },
];

export function SlipPage({
  overview,
  overviewLoading,
  overviewError,
  onRefreshOverview,
  onNotify,
}: {
  readonly overview: BetOverview | null;
  readonly overviewLoading: boolean;
  readonly overviewError: string | null;
  readonly onRefreshOverview: () => Promise<void>;
  readonly onNotify: (message: string, kind: BetToastKind) => void;
}) {
  const [status, setStatus] = useState<BetStatusFilter>('all');
  const [items, setItems] = useState<BetItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [editing, setEditing] = useState<BetItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BetItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const loadSeq = useRef(0);

  const loadFirst = useCallback(
    async (showLoading = true) => {
      const seq = ++loadSeq.current;
      if (showLoading) {
        setListLoading(true);
      }
      setListError(null);
      try {
        const response = await fetchBets({ status });
        if (seq !== loadSeq.current) {
          return;
        }
        setItems(response.items);
        setNextCursor(response.nextCursor);
      } catch (caught: unknown) {
        if (seq !== loadSeq.current) {
          return;
        }
        setListError(messageOf(caught));
      } finally {
        if (seq === loadSeq.current) {
          setListLoading(false);
        }
      }
    },
    [status],
  );

  useEffect(() => {
    setItems([]);
    setNextCursor(null);
    void loadFirst();
  }, [loadFirst]);

  const loadMore = async () => {
    if (nextCursor === null || loadingMore) {
      return;
    }
    const seq = loadSeq.current;
    setLoadingMore(true);
    setListError(null);
    try {
      const response = await fetchBets({ status, cursor: nextCursor });
      if (seq !== loadSeq.current) {
        return;
      }
      setItems((current) => [...current, ...response.items]);
      setNextCursor(response.nextCursor);
    } catch (caught: unknown) {
      if (seq !== loadSeq.current) {
        return;
      }
      setListError(messageOf(caught));
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSave = async (payload: BetPayload) => {
    if (editing === null) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await updateBet(editing.id, payload);
      setEditing(null);
      onNotify('注單已更新', 'success');
      await Promise.all([loadFirst(false), onRefreshOverview()]);
    } catch (caught: unknown) {
      setSaveError(messageOf(caught));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting === null) {
      return;
    }
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await deleteBet(deleting.id);
      setDeleting(null);
      setEditing(null);
      onNotify('注單已刪除', 'success');
      await Promise.all([loadFirst(false), onRefreshOverview()]);
    } catch (caught: unknown) {
      setDeleteError(messageOf(caught));
    } finally {
      setDeleteLoading(false);
    }
  };

  const groups = groupByDate(items);
  const initialDraft = editing === null ? null : draftFromBet(editing);

  return (
    <div className="bet-slip">
      <BetSummary
        overview={overview}
        loading={overviewLoading}
        error={overviewError}
        onRetry={() => void onRefreshOverview()}
      />

      <div className="bet-cta-row">
        <button type="button" className="bet-cta" onClick={() => setImportOpen(true)}>
          <BetUploadIcon size={18} />
          匯入 HKJC
        </button>
      </div>

      <fieldset className="bet-filters" aria-label="注單篩選">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            aria-pressed={status === filter.id}
            className={`bet-filters__item ${status === filter.id ? 'is-selected' : ''}`}
            onClick={() => setStatus(filter.id)}
          >
            {filter.label}
          </button>
        ))}
      </fieldset>

      {listLoading && items.length === 0 ? (
        <div className="bet-skeleton-stack" aria-hidden="true">
          {['a', 'b', 'c'].map((key) => (
            <div className="bet-skeleton" key={key} />
          ))}
        </div>
      ) : null}

      {!listLoading && listError !== null && items.length === 0 ? (
        <div className="bet-empty">
          <p className="bet-empty__title">載入失敗</p>
          <p className="bet-empty__description">{listError}</p>
          <button
            type="button"
            className="bet-button bet-button--outline"
            onClick={() => void loadFirst()}
          >
            重試
          </button>
        </div>
      ) : null}

      {!listLoading && listError === null && items.length === 0 ? (
        <div className="bet-empty">
          <p className="bet-empty__title">未有注單</p>
          <p className="bet-empty__description">由 HKJC 匯入注單，之後可在這裡檢視及結算。</p>
          <button
            type="button"
            className="bet-button bet-button--primary"
            onClick={() => setImportOpen(true)}
          >
            <BetUploadIcon size={16} />
            匯入 HKJC
          </button>
        </div>
      ) : null}

      {groups.map((group) => (
        <section className="bet-date-group" key={group.date}>
          <header className="bet-date-group__header">
            <h2>{formatDateLong(group.date)}</h2>
          </header>
          <div className="bet-date-group__list">
            {group.records.map((bet) => (
              <BetCard
                key={bet.id}
                bet={bet}
                onEdit={() => {
                  setSaveError(null);
                  setEditing(bet);
                }}
                onSettle={() => {
                  setSaveError(null);
                  setEditing(bet);
                }}
                onDelete={
                  bet.result === 'cash_out'
                    ? () => {
                        setDeleteError(null);
                        setDeleting(bet);
                      }
                    : undefined
                }
              />
            ))}
          </div>
        </section>
      ))}

      {listError !== null && items.length > 0 ? (
        <div className="bet-inline-error" role="alert">
          <span>{listError}</span>
          <button
            type="button"
            className="bet-button bet-button--ghost"
            onClick={() => void loadFirst()}
          >
            重試
          </button>
        </div>
      ) : null}

      {nextCursor === null ? null : (
        <button
          type="button"
          className="bet-button bet-button--outline bet-button--block"
          onClick={() => void loadMore()}
          disabled={loadingMore}
        >
          {loadingMore ? '載入中…' : '載入更多'}
        </button>
      )}

      {editing === null || initialDraft === null ? null : (
        <BetForm
          key={editing.id}
          initial={initialDraft}
          saving={saving}
          error={saveError}
          onClose={() => {
            if (!saving) {
              setEditing(null);
              setSaveError(null);
            }
          }}
          onSave={(payload) => void handleSave(payload)}
          onDelete={() => {
            setDeleteError(null);
            setDeleting(editing);
          }}
        />
      )}

      {importOpen ? (
        <HkjcImportSheet
          onClose={() => setImportOpen(false)}
          onImported={() => {
            void Promise.all([loadFirst(false), onRefreshOverview()]);
          }}
          onNotify={onNotify}
        />
      ) : null}

      <BetConfirmDialog
        open={deleting !== null}
        title="刪除注單"
        message="確定刪除這張注單？此操作無法復原。"
        loading={deleteLoading}
        error={deleteError}
        onClose={() => {
          if (!deleteLoading) {
            setDeleting(null);
            setDeleteError(null);
          }
        }}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
