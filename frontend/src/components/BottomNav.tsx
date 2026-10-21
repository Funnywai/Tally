import type { ComponentType } from 'react';
import type { Route } from '../hooks/useHashRoute';
import { BookIcon, CoinsIcon, GridIcon, type IconProps } from './Icons';

interface Tab {
  readonly route: Route;
  readonly label: string;
  readonly Icon: ComponentType<IconProps>;
}

const TABS: readonly Tab[] = [
  { route: 'fan', label: '番數', Icon: GridIcon },
  { route: 'mai', label: '埋數', Icon: CoinsIcon },
  { route: 'ledger', label: '小氣簿', Icon: BookIcon },
];

interface BottomNavProps {
  readonly active: Route;
  readonly onNavigate: (route: Route) => void;
}

export function BottomNav({ active, onNavigate }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="主要導航">
      <div className="bottom-nav__inner">
        {TABS.map(({ route, label, Icon }) => (
          <button
            key={route}
            type="button"
            className={`bottom-nav__tab ${active === route ? 'is-active' : ''}`}
            aria-current={active === route ? 'page' : undefined}
            onClick={() => onNavigate(route)}
          >
            <Icon size={22} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
