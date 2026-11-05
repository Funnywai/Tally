import { useCallback, useEffect, useRef, useState } from 'react';
import { messageOf } from '../hooks/useAsync';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { fetchBetOverview } from './api';
import { BetHeader } from './components/BetHeader';
import { BetNav, type BetTab } from './components/BetNav';
import { BetToast, type BetToastState } from './components/BetToast';
import { SlipPage } from './pages/SlipPage';
import { StatsPage } from './pages/StatsPage';
import type { BetOverview } from './types';
import './bet.css';

export function BetApp({
  onExit,
  offline,
}: {
  readonly onExit: () => void;
  readonly offline: boolean;
}) {
  const [tab, setTab] = useState<BetTab>('slip');
  const [toast, setToast] = useState<BetToastState | null>(null);
  const [overview, setOverview] = useState<BetOverview | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const online = useOnlineStatus();
  const showOffline = offline || !online;
  const dismissToast = useCallback(() => setToast(null), []);
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

  useEffect(() => {
    document.body.classList.add('bet-mode');
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previous = meta?.content;
    if (meta !== null) {
      meta.content = '#0a1b45';
    }
    return () => {
      document.body.classList.remove('bet-mode');
      if (meta !== null && previous !== undefined) {
        meta.content = previous;
      }
    };
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  return (
    <div className="bet-shell">
      <BetHeader onExit={onExit} pending={overview?.pending ?? null} />
      {showOffline ? (
        <div className="bet-banner" role="status">
          離線模式 · 未能連線
        </div>
      ) : null}
      <main className="bet-main">
        <div key={tab} className="bet-page-enter">
          {tab === 'slip' ? (
            <SlipPage
              overview={overview}
              overviewLoading={overviewLoading}
              overviewError={overviewError}
              onRefreshOverview={loadOverview}
              onNotify={(message, kind) => setToast({ message, kind })}
            />
          ) : (
            <StatsPage />
          )}
        </div>
      </main>
      <BetNav active={tab} onNavigate={setTab} />
      <BetToast toast={toast} onDismiss={dismissToast} />
    </div>
  );
}
