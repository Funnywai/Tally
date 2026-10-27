import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { formatDateSlash } from '../../lib/date';
import { fetchBetStats } from '../api';
import {
  formatBetMoney,
  formatOdds,
  formatPercent,
  formatSignedNumber,
  formatStake,
  marketLabel,
  profitTone,
} from '../lib/format';
import type { BetPeriod, BetStats } from '../types';

const PERIODS: readonly { id: BetPeriod; label: string }[] = [
  { id: 'month', label: '本月' },
  { id: 'year', label: '今年' },
  { id: 'all', label: '全部' },
];

function periodLabel(period: BetPeriod): string {
  return period === 'month' ? '本月' : period === 'year' ? '今年' : '全部';
}

function Kpi({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone?: string | undefined;
}) {
  return (
    <div className="bet-kpi">
      <span className="bet-kpi__label">{label}</span>
      <span className={`bet-kpi__value ${tone ?? ''}`}>{value}</span>
    </div>
  );
}

function StatsContent({ stats }: { readonly stats: BetStats }) {
  const { totals } = stats;
  const maxMarket = Math.max(1, ...stats.byMarket.map((row) => Math.abs(row.profit)));
  const maxMonth = Math.max(1, ...stats.monthly.map((point) => Math.abs(point.profit)));
  const monthSummary = stats.monthly
    .map((point) => `${Number(point.month.slice(5))}月 ${formatSignedNumber(point.profit)}`)
    .join('、');

  return (
    <>
      <div className="bet-stats-hero">
        <span className="bet-stats-hero__label">{periodLabel(stats.period)}輸贏</span>
        <span className={`bet-stats-hero__value ${profitTone(totals.profit)}`}>
          {formatBetMoney(totals.profit)}
        </span>
        <span className="bet-stats-hero__meta">
          ROI {formatPercent(totals.roi)} · 已結算注碼 {formatStake(totals.settledStake)}
        </span>
      </div>

      <div className="bet-kpi-grid">
        <Kpi label="勝率" value={formatPercent(totals.winRate)} />
        <Kpi label="平均賠率" value={formatOdds(totals.avgOdds)} />
        <Kpi label="已結算注數" value={`${totals.settledBets}`} />
        <Kpi
          label="本期待結算"
          value={`${totals.pendingCount} 注`}
          tone={totals.pendingCount > 0 ? 'is-pending' : undefined}
        />
      </div>

      {totals.pendingStake === 0 ? null : (
        <p className="bet-stats__pending">本期待結算注碼 {formatStake(totals.pendingStake)}</p>
      )}

      <section className="bet-stats-section" aria-labelledby="bet-type-title">
        <div className="bet-stats-section__header">
          <h2 id="bet-type-title">單場 / 過關</h2>
        </div>
        <div className="bet-type-list">
          {stats.byType.map((row) => (
            <div className="bet-type-row" key={row.type}>
              <span className="bet-type-row__label">{row.type === 'single' ? '單場' : '過關'}</span>
              <span className="bet-type-row__meta">
                {row.bets} 注 · {formatStake(row.stake)}
              </span>
              <span className={`bet-type-row__profit ${profitTone(row.profit)}`}>
                {formatBetMoney(row.profit)}
              </span>
              <span className="bet-type-row__roi">ROI {formatPercent(row.roi)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bet-stats-section" aria-labelledby="bet-market-title">
        <div className="bet-stats-section__header">
          <h2 id="bet-market-title">盤口分佈</h2>
          <span className="bet-stats-section__note">只計單場</span>
        </div>
        {stats.byMarket.length === 0 ? (
          <p className="bet-stats__hint">未有已結算單場注單。</p>
        ) : (
          <div className="bet-market-list">
            {stats.byMarket.map((row) => (
              <div className="bet-market-row" key={row.market}>
                <span className="bet-market-row__label">{marketLabel(row.market)}</span>
                <span className="bet-market-row__bar" aria-hidden="true">
                  <span
                    className={`bet-market-row__fill ${profitTone(row.profit)}`}
                    style={{ width: `${(Math.abs(row.profit) / maxMarket) * 100}%` }}
                  />
                </span>
                <span className={`bet-market-row__profit ${profitTone(row.profit)}`}>
                  {formatBetMoney(row.profit)}
                </span>
                <span className="bet-market-row__meta">
                  {row.bets} 注 · {formatStake(row.stake)} · ROI {formatPercent(row.roi)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="bet-stats-section" aria-labelledby="bet-month-title">
        <div className="bet-stats-section__header">
          <h2 id="bet-month-title">近 6 個月</h2>
        </div>
        <div
          className="bet-month-chart"
          role="img"
          aria-label={`近 6 個月輸贏柱狀圖：${monthSummary}`}
        >
          {stats.monthly.map((point) => {
            const height =
              point.profit === 0 ? 0 : Math.max((Math.abs(point.profit) / maxMonth) * 50, 3);
            return (
              <div className="bet-month" key={point.month}>
                <span className={`bet-month__value ${profitTone(point.profit)}`}>
                  {formatSignedNumber(point.profit)}
                </span>
                <span className="bet-month__plot">
                  <span
                    className={`bet-month__bar ${profitTone(point.profit)}`}
                    style={{ height: `${height}%` }}
                  />
                </span>
                <span className="bet-month__label">{point.month.slice(5)}月</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="bet-stats-section" aria-labelledby="bet-biggest-title">
        <div className="bet-stats-section__header">
          <h2 id="bet-biggest-title">最大單筆</h2>
        </div>
        <div className="bet-biggest">
          <div className="bet-biggest__card">
            <span className="bet-biggest__label">最大贏</span>
            <span className={`bet-biggest__value ${profitTone(stats.biggestWin?.profit ?? null)}`}>
              {stats.biggestWin === null ? '—' : formatBetMoney(stats.biggestWin.profit)}
            </span>
            <span className="bet-biggest__meta">
              {stats.biggestWin === null
                ? ''
                : `${stats.biggestWin.label} · ${formatDateSlash(stats.biggestWin.date)}`}
            </span>
          </div>
          <div className="bet-biggest__card">
            <span className="bet-biggest__label">最大輸</span>
            <span className={`bet-biggest__value ${profitTone(stats.biggestLoss?.profit ?? null)}`}>
              {stats.biggestLoss === null ? '—' : formatBetMoney(stats.biggestLoss.profit)}
            </span>
            <span className="bet-biggest__meta">
              {stats.biggestLoss === null
                ? ''
                : `${stats.biggestLoss.label} · ${formatDateSlash(stats.biggestLoss.date)}`}
            </span>
          </div>
        </div>
      </section>
    </>
  );
}

export function StatsPage() {
  const [period, setPeriod] = useState<BetPeriod>('month');
  const stats = useAsync<BetStats>(`bet-stats|${period}`, () => fetchBetStats(period));

  return (
    <div className="bet-stats">
      <fieldset className="bet-periods" aria-label="統計期間">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={period === item.id}
            className={`bet-periods__item ${period === item.id ? 'is-selected' : ''}`}
            onClick={() => setPeriod(item.id)}
          >
            {item.label}
          </button>
        ))}
      </fieldset>

      {stats.loading ? (
        <div className="bet-skeleton-stack" aria-hidden="true">
          {['a', 'b', 'c'].map((key) => (
            <div className="bet-skeleton" key={key} />
          ))}
        </div>
      ) : null}

      {!stats.loading && stats.error !== null ? (
        <div className="bet-empty">
          <p className="bet-empty__title">載入失敗</p>
          <p className="bet-empty__description">{stats.error}</p>
          <button type="button" className="bet-button bet-button--outline" onClick={stats.reload}>
            重試
          </button>
        </div>
      ) : null}

      {!stats.loading && stats.error === null && stats.data !== null ? (
        stats.data.totals.settledBets === 0 ? (
          <div className="bet-empty">
            <p className="bet-empty__title">未有已結算注單</p>
            <p className="bet-empty__description">記錄注單並補上結果後，統計會在這裡出現。</p>
            {stats.data.totals.pendingCount === 0 ? null : (
              <p className="bet-stats__hint">
                本期待結算 {stats.data.totals.pendingCount} 注 ·{' '}
                {formatStake(stats.data.totals.pendingStake)}
              </p>
            )}
          </div>
        ) : (
          <StatsContent stats={stats.data} />
        )
      ) : null}
    </div>
  );
}
