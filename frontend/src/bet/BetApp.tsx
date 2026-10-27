import { useCallback, useEffect, useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { BetHeader } from './components/BetHeader';
import { BetNav, type BetTab } from './components/BetNav';
import { BetToast, type BetToastState } from './components/BetToast';
import { SlipPage } from './pages/SlipPage';
import { StatsPage } from './pages/StatsPage';
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
  const online = useOnlineStatus();
  const showOffline = offline || !online;
  const dismissToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    document.body.classList.add('bet-mode');
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previous = meta?.content;
    if (meta !== null) {
      meta.content = '#050b14';
    }
    return () => {
      document.body.classList.remove('bet-mode');
      if (meta !== null && previous !== undefined) {
        meta.content = previous;
      }
    };
  }, []);

  return (
    <div className="bet-shell">
      <BetHeader onExit={onExit} />
      {showOffline ? (
        <div className="bet-banner" role="status">
          離線模式 · 未能連線
        </div>
      ) : null}
      <main className="bet-main">
        <div key={tab} className="bet-page-enter">
          {tab === 'slip' ? (
            <SlipPage onNotify={(message, kind) => setToast({ message, kind })} />
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
