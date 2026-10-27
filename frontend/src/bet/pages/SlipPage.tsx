import { useCallback, useEffect, useRef, useState } from 'react';
import { messageOf } from '../../hooks/useAsync';
import { formatDateLong, groupByDate, hkToday } from '../../lib/date';
import { createBet, deleteBet, fetchBetOverview, fetchBets, updateBet } from '../api';
import { BetCard } from '../components/BetCard';
import { BetConfirmDialog } from '../components/BetConfirmDialog';
import { BetForm } from '../components/BetForm';
import { BetSummary } from '../components/BetSummary';
import type { BetToastKind } from '../components/BetToast';
import { draftFromBet, emptyDraft } from '../lib/form';
import type { BetItem, BetOverview, BetPayload, BetStatusFilter } from '../types';

type FormState = { readonly mode: 'create' } | { readonly mode: 'edit'; readonly bet: BetItem };

const FILTERS: readonly { id: BetStatusFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'pending', label: '待結算' },
  { id: 'settled', label: '已結算' },
];

export function SlipPage({
  onNotify,
}: {
  readonly onNotify: (message: string, kind: BetToastKind) => void;
}) {
  const [status, setStatus] = useState<BetStatusFilter>('all');
  const [items, setItems] = useState<BetItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [overview, setOverview] = useState<BetOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<BetItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadSeq = useRef(0);
  const overviewSeq = useRef(0);

  const loadOverview = useCallback(async () => {
    const seq = ++overviewSeq.current;
    setOverviewLoading(true);
    setOverviewError(null);
    try {
      const data = await fetchBetOverview();
      if (seq !== overviewSeq.current) {
        return;
      }
      setOverview(data);
    } catch (caught: unknown) {
      if (seq !== overviewSeq.current) {
        return;
      }
      setOverviewError(messageOf(caught));
    } finally {
      if (seq === overviewSeq.current) {
        setOverviewLoading(false);
      }
    }
  }, []);

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
    void loadOverview();
  }, [loadOverview]);

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
    if (form === null) {
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (form.mode === 'edit') {
        await updateBet(form.bet.id, payload);
      } else {
        await createBet(payload);
      }
      const message = form.mode === 'edit' ? '注單已更新' : '注單已新增';
      setForm(null);
      onNotify(message, 'success');
      await Promise.all([loadFirst(false), loadOverview()]);
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
      setForm(null);
      onNotify('注單已刪除', 'success');
      await Promise.all([loadFirst(false), loadOverview()]);
    } catch (caught: unknown) {
      setDeleteError(messageOf(caught));
    } finally {
      setDeleteLoading(false);
    }
  };

  const groups = groupByDate(items);
  const initialDraft =
    form === null ? null : form.mode === 'edit' ? draftFromBet(form.bet) : emptyDraft(hkToday());

  return (
    <div className="bet-slip">
      <BetSummary
        overview={overview}
        loading={overviewLoading}
        error={overviewError}
        onRetry={() => void loadOverview()}
      />

      <button
        type="button"
        className="bet-cta"
        onClick={() => {
          setSaveError(null);
          setForm({ mode: 'create' });
        }}
      >
        新增注單
      </button>

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
          <p className="bet-empty__description">新增第一張注單，之後可在這裡補上結果。</p>
          <button
            type="button"
            className="bet-button bet-button--primary"
            onClick={() => {
              setSaveError(null);
              setForm({ mode: 'create' });
            }}
          >
            新增第一張
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
                  setForm({ mode: 'edit', bet });
                }}
                onSettle={() => {
                  setSaveError(null);
                  setForm({ mode: 'edit', bet });
                }}
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

      {form === null || initialDraft === null ? null : (
        <BetForm
          key={form.mode === 'edit' ? form.bet.id : 'new'}
          mode={form.mode}
          initial={initialDraft}
          saving={saving}
          error={saveError}
          onClose={() => {
            if (!saving) {
              setForm(null);
              setSaveError(null);
            }
          }}
          onSave={(payload) => void handleSave(payload)}
          onDelete={
            form.mode === 'edit'
              ? () => {
                  setDeleteError(null);
                  setDeleting(form.bet);
                }
              : undefined
          }
        />
      )}

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
