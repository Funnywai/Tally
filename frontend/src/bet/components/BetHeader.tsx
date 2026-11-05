import type { BetOverview } from '../types';
import { BetGridIcon, BetPitchMarkIcon } from './BetIcons';

export function BetHeader({
  onExit,
  pending,
}: {
  readonly onExit: () => void;
  readonly pending: BetOverview['pending'] | null;
}) {
  const pendingValue = pending === null ? '—' : `${pending.count} 注`;

  return (
    <header className="bet-header">
      <div className="bet-header__brand">
        <BetPitchMarkIcon size={22} className="bet-header__mark" />
        <div className="bet-header__names">
          <span className="bet-header__wordmark">Tally</span>
          <span className="bet-header__sub">賭球</span>
        </div>
      </div>
      <div className="bet-header__actions">
        <span className="bet-pending-chip">
          <span className="bet-pending-chip__label">待結算</span>
          <span className="bet-pending-chip__value">{pendingValue}</span>
        </span>
        <button type="button" className="bet-switch" onClick={onExit} aria-label="切換到麻雀">
          <BetGridIcon size={14} />
          <span>麻雀</span>
        </button>
      </div>
    </header>
  );
}
