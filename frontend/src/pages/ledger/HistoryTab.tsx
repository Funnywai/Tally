import { useCallback, useEffect, useRef, useState } from 'react';
import { DeleteRecordDialog } from '../../components/DeleteRecordDialog';
import { EditRecordDialog } from '../../components/EditRecordDialog';
import { EmptyState } from '../../components/EmptyState';
import { LoaderIcon } from '../../components/Icons';
import { RecordRow } from '../../components/RecordRow';
import { Skeleton } from '../../components/Skeleton';
import { useToast } from '../../components/ToastProvider';
import { messageOf } from '../../hooks/useAsync';
import { fetchRecords, type RecordItem } from '../../lib/api';
import { formatDateLong, formatTimeHK, groupByDate } from '../../lib/date';

export function HistoryTab({ onRecordsChanged }: { readonly onRecordsChanged: () => void }) {
  const { showToast } = useToast();
  const [items, setItems] = useState<RecordItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [editing, setEditing] = useState<RecordItem | null>(null);
  const [deleting, setDeleting] = useState<RecordItem | null>(null);
  const loadSeq = useRef(0);

  const loadFirst = useCallback(async (showLoading = true) => {
    const seq = ++loadSeq.current;
    if (showLoading) {
      setLoading(true);
    }
    setError(null);
    try {
      const response = await fetchRecords();
      if (seq !== loadSeq.current) {
        return;
      }
      setItems(response.items);
      setNextCursor(response.nextCursor);
      setLastUpdated(new Date());
    } catch (caught: unknown) {
      if (seq !== loadSeq.current) {
        return;
      }
      setError(messageOf(caught));
    } finally {
      if (seq === loadSeq.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadFirst();
  }, [loadFirst]);

  const loadMore = async () => {
    if (nextCursor === null || loadingMore) {
      return;
    }
    setLoadingMore(true);
    setError(null);
    try {
      const response = await fetchRecords(nextCursor);
      setItems((current) => [...current, ...response.items]);
      setNextCursor(response.nextCursor);
      setLastUpdated(new Date());
    } catch (caught: unknown) {
      setError(messageOf(caught));
    } finally {
      setLoadingMore(false);
    }
  };

  const groups = groupByDate(items);

  return (
    <div className="ledger-panel">
      <div className="ledger-toolbar">
        <div>
          <p className="ledger-toolbar__title">歷史記錄</p>
          <p className="ledger-toolbar__meta">
            {lastUpdated === null ? '尚未更新' : `最後更新 ${formatTimeHK(lastUpdated)}`}
          </p>
        </div>
      </div>

      {loading && items.length === 0 ? <Skeleton lines={3} /> : null}

      {!loading && error !== null && items.length === 0 ? (
        <EmptyState
          title="載入失敗"
          description={error}
          actionLabel="重試"
          onAction={() => void loadFirst()}
        />
      ) : null}

      {!loading && error === null && items.length === 0 ? <EmptyState title="尚無記錄" /> : null}

      {groups.map((group) => (
        <section key={group.date} className="date-group">
          <header className="date-group__header">
            <h3>{formatDateLong(group.date)}</h3>
          </header>
          {group.records.map((record) => (
            <RecordRow
              key={record.id}
              record={record}
              onEdit={() => setEditing(record)}
              onDelete={() => setDeleting(record)}
            />
          ))}
        </section>
      ))}

      {error !== null && items.length > 0 ? (
        <div className="inline-error" role="alert">
          <span>{error}</span>
          <button
            type="button"
            className="button button--small button--ghost"
            onClick={() => void loadFirst()}
          >
            重試
          </button>
        </div>
      ) : null}

      {nextCursor === null ? null : (
        <button
          type="button"
          className="button button--outline button--block"
          onClick={() => void loadMore()}
          disabled={loadingMore}
        >
          {loadingMore ? <LoaderIcon size={16} className="spin" /> : null}
          {loadingMore ? '載入中…' : '載入更多'}
        </button>
      )}

      <EditRecordDialog
        open={editing !== null}
        record={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setEditing(null);
          setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
          showToast('已更新記錄', 'success');
          onRecordsChanged();
          void loadFirst(false);
        }}
      />

      <DeleteRecordDialog
        open={deleting !== null}
        record={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          const deletedId = deleting?.id;
          if (deletedId !== undefined) {
            setItems((current) => current.filter((item) => item.id !== deletedId));
          }
          setDeleting(null);
          showToast('已刪除記錄', 'success');
          onRecordsChanged();
          void loadFirst(false);
        }}
      />
    </div>
  );
}
