import type { ComponentType } from 'react';
import { BetChartIcon, type BetIconProps, BetSlipIcon } from './BetIcons';

export type BetTab = 'slip' | 'stats';

interface Tab {
  readonly id: BetTab;
  readonly label: string;
  readonly Icon: ComponentType<BetIconProps>;
}

const TABS: readonly Tab[] = [
  { id: 'slip', label: '注單', Icon: BetSlipIcon },
  { id: 'stats', label: '統計', Icon: BetChartIcon },
];

export function BetNav({
  active,
  onNavigate,
}: {
  readonly active: BetTab;
  readonly onNavigate: (tab: BetTab) => void;
}) {
  return (
    <nav className="bet-nav" aria-label="賭球導航">
      <div className="bet-nav__inner">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={`bet-nav__tab ${active === id ? 'is-active' : ''}`}
            aria-current={active === id ? 'page' : undefined}
            onClick={() => onNavigate(id)}
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
