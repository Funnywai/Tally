import { formatBetMoney } from '../lib/format';
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
  const last30Days = overview?.last30Days;
  const last90Days = overview?.last90Days;

  return (
    <section className="bet-summary" aria-label="投注摘要" aria-busy={loading}>
      <div className="bet-summary__cell">
        <span className="bet-summary__label">近 30 日輸贏</span>
        <span
          className={`bet-summary__value ${
            last30Days === undefined ? 'is-zero' : toneOf(last30Days.profit)
          }`}
        >
          {last30Days === undefined ? '—' : formatBetMoney(last30Days.profit)}
        </span>
      </div>
      <div className="bet-summary__cell">
        <span className="bet-summary__label">近 90 日輸贏</span>
        <span
          className={`bet-summary__value ${
            last90Days === undefined ? 'is-zero' : toneOf(last90Days.profit)
          }`}
        >
          {last90Days === undefined ? '—' : formatBetMoney(last90Days.profit)}
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
