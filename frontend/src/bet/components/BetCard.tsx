import { formatTimeHK } from '../../lib/date';
import {
  betTypeLabel,
  formatBetMoney,
  formatOdds,
  formatStake,
  marketLabel,
  profitTone,
  resultLabel,
} from '../lib/format';
import type { BetItem } from '../types';

export function BetCard({
  bet,
  onEdit,
  onSettle,
}: {
  readonly bet: BetItem;
  readonly onEdit: () => void;
  readonly onSettle: () => void;
}) {
  const time = formatTimeHK(new Date(bet.recordedAt));

  return (
    <article className={`bet-card ${bet.result === 'pending' ? 'bet-card--pending' : ''}`}>
      <button type="button" className="bet-card__main" onClick={onEdit}>
        <span className="bet-card__top">
          <span className="bet-type">{betTypeLabel(bet.legs.length)}</span>
          <span className="bet-card__time">{time}</span>
          <span className={`bet-result bet-result--${bet.result}`}>{resultLabel(bet.result)}</span>
        </span>

        <span className="bet-legs">
          {bet.legs.map((leg) => (
            <span className="bet-leg" key={leg.position}>
              <span className="bet-leg__index">{String(leg.position).padStart(2, '0')}</span>
              <span className="bet-leg__body">
                <span className="bet-leg__meta">
                  {marketLabel(leg.market)} · @{formatOdds(leg.odds)}
                </span>
                <span className="bet-leg__match">{leg.match}</span>
                <span className="bet-leg__selection">{leg.selection}</span>
              </span>
            </span>
          ))}
        </span>

        <span className="bet-card__foot">
          <span className="bet-card__stake">注碼 {formatStake(bet.stake)}</span>
          <span className="bet-card__odds">總賠率 {formatOdds(bet.totalOdds)}</span>
          <span className={`bet-card__profit ${profitTone(bet.profit)}`}>
            {bet.profit === null ? '待結算' : formatBetMoney(bet.profit)}
          </span>
        </span>
      </button>

      {bet.result === 'pending' ? (
        <button type="button" className="bet-card__settle" onClick={onSettle}>
          結算
        </button>
      ) : null}
    </article>
  );
}
