import { formatBetMoney, formatStake } from '../lib/format';
import type { BetOverview } from '../types';
import { BetRefreshIcon } from './BetIcons';

function toneOf(value: number): string {
  if (value === 0) {
    return 'is-zero';
  }
  return value > 0 ? 'is-win' : 'is-loss';
}

export function BetSummary({
  overview,
  loading,
  error,
  onRetry,
}: {
  readonly overview: BetOverview | null;
  readonly loading: boolean;
  readonly error: string | null;
  readonly onRetry: () => void;
}) {
  const today = overview?.today;
  const month = overview?.month;
  const pending = overview?.pending;

  return (
    <section className="bet-summary" aria-label="投注摘要" aria-busy={loading}>
      <div className="bet-summary__cell">
        <span className="bet-summary__label">今日輸贏</span>
        <span
          className={`bet-summary__value ${today === undefined ? 'is-zero' : toneOf(today.profit)}`}
        >
          {today === undefined ? '—' : formatBetMoney(today.profit)}
        </span>
      </div>
      <div className="bet-summary__cell">
        <span className="bet-summary__label">本月輸贏</span>
        <span
          className={`bet-summary__value ${month === undefined ? 'is-zero' : toneOf(month.profit)}`}
        >
          {month === undefined ? '—' : formatBetMoney(month.profit)}
        </span>
      </div>
      <div className="bet-summary__cell">
        <span className="bet-summary__label">待結算</span>
        <span className="bet-summary__value is-pending">
          {pending === undefined ? '—' : `${pending.count} 注`}
        </span>
        <span className="bet-summary__meta">
          {pending === undefined ? '' : formatStake(pending.stake)}
        </span>
      </div>
      {error === null ? null : (
        <button type="button" className="bet-summary__retry" onClick={onRetry}>
          <BetRefreshIcon size={14} />
          重試
        </button>
      )}
    </section>
  );
}
