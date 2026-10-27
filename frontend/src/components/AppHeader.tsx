import { formatStatMoney } from '../lib/money';
import { FootballIcon, WrenchIcon } from './Icons';
import { TallyMark } from './TallyMark';

interface AppHeaderProps {
  readonly todayTotal: number;
  readonly onOpenTools: () => void;
  readonly onEnterBet: () => void;
}

export function AppHeader({ todayTotal, onOpenTools, onEnterBet }: AppHeaderProps) {
  const tone = todayTotal > 0 ? 'positive' : todayTotal < 0 ? 'negative' : 'zero';
  return (
    <header className="app-header">
      <div className="app-header__brand">
        <TallyMark size={22} className="app-header__mark" />
        <div className="app-header__names">
          <span className="app-header__wordmark">Tally</span>
          <span className="app-header__sub">麻雀計分</span>
        </div>
      </div>
      <div className="app-header__actions">
        <button
          type="button"
          className="app-header__mode-switch"
          aria-label="切換到賭球"
          title="賭球"
          onClick={onEnterBet}
        >
          <FootballIcon size={16} />
          <span>賭球</span>
        </button>
        <span className={`today-chip today-chip--${tone}`}>
          <span className="today-chip__label">今日</span>
          <span className="today-chip__value">{formatStatMoney(todayTotal)}</span>
        </span>
        <button type="button" className="icon-button" aria-label="工具" onClick={onOpenTools}>
          <WrenchIcon size={20} />
        </button>
      </div>
    </header>
  );
}
