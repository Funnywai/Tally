import { BetGridIcon, BetPitchMarkIcon } from './BetIcons';

export function BetHeader({ onExit }: { readonly onExit: () => void }) {
  return (
    <header className="bet-header">
      <div className="bet-header__brand">
        <BetPitchMarkIcon size={22} className="bet-header__mark" />
        <div className="bet-header__names">
          <span className="bet-header__wordmark">Tally</span>
          <span className="bet-header__sub">賭球</span>
        </div>
      </div>
      <button type="button" className="bet-switch" onClick={onExit} aria-label="切換到麻雀">
        <BetGridIcon size={14} />
        <span>麻雀</span>
      </button>
    </header>
  );
}
