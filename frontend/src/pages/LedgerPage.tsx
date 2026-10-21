import { type KeyboardEvent, useCallback, useState } from 'react';
import { HistoryTab } from './ledger/HistoryTab';
import { RankingTab } from './ledger/RankingTab';
import { StatsTab } from './ledger/StatsTab';

const TABS = [
  { id: 'history', label: '歷史記錄' },
  { id: 'stats', label: '個人數據' },
  { id: 'ranking', label: '排名榜' },
] as const;

type LedgerTab = (typeof TABS)[number]['id'];

export function LedgerPage() {
  const [tab, setTab] = useState<LedgerTab>('history');
  const [dataVersion, setDataVersion] = useState(0);

  const handleRecordsChanged = useCallback(() => {
    setDataVersion((version) => version + 1);
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (index + delta + TABS.length) % TABS.length;
    const next = TABS[nextIndex];
    if (next === undefined) {
      return;
    }
    setTab(next.id);
    document.getElementById(`ledger-tab-${next.id}`)?.focus();
  };

  return (
    <section className="page page--ledger" aria-labelledby="ledger-title">
      <div className="page-heading">
        <div>
          <p className="eyebrow">LEDGER</p>
          <h1 id="ledger-title" className="page-title">
            小氣簿
          </h1>
        </div>
      </div>

      <div className="segmented segmented--tabs" role="tablist" aria-label="小氣簿分頁">
        {TABS.map((item, index) => (
          <button
            key={item.id}
            id={`ledger-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`ledger-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            className={`segmented__item ${tab === item.id ? 'is-selected' : ''}`}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        id="ledger-panel-history"
        role="tabpanel"
        aria-labelledby="ledger-tab-history"
        hidden={tab !== 'history'}
      >
        <HistoryTab onRecordsChanged={handleRecordsChanged} />
      </div>
      <div
        id="ledger-panel-stats"
        role="tabpanel"
        aria-labelledby="ledger-tab-stats"
        hidden={tab !== 'stats'}
      >
        <StatsTab refreshKey={dataVersion} />
      </div>
      <div
        id="ledger-panel-ranking"
        role="tabpanel"
        aria-labelledby="ledger-tab-ranking"
        hidden={tab !== 'ranking'}
      >
        <RankingTab refreshKey={dataVersion} />
      </div>
    </section>
  );
}
