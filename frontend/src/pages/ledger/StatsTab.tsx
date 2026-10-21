import { useState } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { UsersIcon } from '../../components/Icons';
import { Skeleton } from '../../components/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { fetchPlayers, fetchStats, type PlayerStats } from '../../lib/api';
import { formatDateSlash, hkYear } from '../../lib/date';
import { formatStatMoney, formatWinRate } from '../../lib/money';

function toneOf(value: number | null): string {
  if (value === null || value === 0) {
    return 'is-zero';
  }
  return value > 0 ? 'is-positive' : 'is-negative';
}

function StatTile({
  label,
  value,
  tone,
  meta,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone: string;
  readonly meta?: string | undefined;
}) {
  return (
    <div className="stat-tile">
      <span className="stat-tile__label">{label}</span>
      <span className={`stat-tile__value ${tone}`}>{value}</span>
      {meta === undefined ? null : <span className="stat-tile__meta">{meta}</span>}
    </div>
  );
}

function StatsContent({ stats, year }: { readonly stats: PlayerStats; readonly year: number }) {
  const hasYear = stats.yearGames > 0;
  return (
    <>
      <div className="stats-hero">
        <span className="stats-hero__label">全年累積（{year}）</span>
        <span className={`stats-hero__value ${toneOf(hasYear ? stats.yearTotal : null)}`}>
          {hasYear ? formatStatMoney(stats.yearTotal) : '—'}
        </span>
        <span className="stats-hero__meta">
          勝率 {formatWinRate(stats.winRate)} · {stats.yearGames} 場
        </span>
      </div>

      <div className="stat-grid">
        <StatTile
          label="最佳"
          value={stats.best === null ? '—' : formatStatMoney(stats.best.score)}
          tone={toneOf(stats.best?.score ?? null)}
          meta={stats.best === null ? undefined : formatDateSlash(stats.best.date)}
        />
        <StatTile
          label="最差"
          value={stats.worst === null ? '—' : formatStatMoney(stats.worst.score)}
          tone={toneOf(stats.worst?.score ?? null)}
          meta={stats.worst === null ? undefined : formatDateSlash(stats.worst.date)}
        />
        <StatTile
          label="平均勝場"
          value={stats.avgWin === null ? '—' : formatStatMoney(stats.avgWin)}
          tone={toneOf(stats.avgWin)}
        />
        <StatTile
          label="平均敗場"
          value={stats.avgLoss === null ? '—' : formatStatMoney(stats.avgLoss)}
          tone={toneOf(stats.avgLoss)}
        />
      </div>

      <p className="ledger-footnote">
        {stats.allTimeGames === 0
          ? '尚無此玩家的記錄。'
          : `全部 ${stats.allTimeGames} 場 · 最佳／最差為全期`}
      </p>
    </>
  );
}

export function StatsTab({ refreshKey }: { readonly refreshKey: number }) {
  const [name, setName] = useState('');
  const debounced = useDebouncedValue(name.trim(), 300);
  const year = hkYear();
  const players = useAsync(`players|${refreshKey}`, fetchPlayers);
  const stats = useAsync<PlayerStats | null>(
    debounced === '' ? `stats-empty|${refreshKey}` : `stats|${debounced}|${year}|${refreshKey}`,
    () => (debounced === '' ? Promise.resolve(null) : fetchStats(debounced, year)),
  );

  return (
    <div className="ledger-panel">
      <div className="ledger-toolbar">
        <div>
          <p className="ledger-toolbar__title">個人數據</p>
          <p className="ledger-toolbar__meta">全量統計 · 不受載入頁數影響</p>
        </div>
      </div>

      <label className="field">
        <span className="field__label">玩家名稱</span>
        <input
          className="field__input"
          list="player-names"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="輸入或選擇名稱"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </label>
      <datalist id="player-names">
        {players.data?.map((player) => (
          <option key={player.id} value={player.name} />
        ))}
      </datalist>
      {players.error === null ? null : (
        <p className="field-hint">名稱清單暫時無法載入，仍可手動輸入。</p>
      )}

      {debounced === '' ? (
        <EmptyState
          icon={<UsersIcon size={24} />}
          title="輸入玩家名稱"
          description="查看全年累積、勝率與個人記錄。"
        />
      ) : null}

      {debounced !== '' && stats.loading ? <Skeleton lines={3} /> : null}

      {debounced !== '' && stats.error !== null ? (
        <EmptyState
          title="載入失敗"
          description={stats.error}
          actionLabel="重試"
          onAction={stats.reload}
        />
      ) : null}

      {debounced !== '' && stats.data !== null ? (
        <StatsContent stats={stats.data} year={year} />
      ) : null}
    </div>
  );
}
