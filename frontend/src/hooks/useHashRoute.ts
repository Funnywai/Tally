import { useCallback, useEffect, useState } from 'react';

export type Route = 'fan' | 'mai' | 'ledger' | 'bet';

const ROUTES: readonly Route[] = ['fan', 'mai', 'ledger', 'bet'];

function parseHash(hash: string): Route {
  const value = hash.replace(/^#/, '');
  return ROUTES.find((route) => route === value) ?? 'fan';
}

export function useHashRoute(): {
  readonly route: Route;
  readonly navigate: (route: Route) => void;
} {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    if (window.location.hash === '') {
      window.history.replaceState(null, '', '#fan');
    }
    const handleChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', handleChange);
    return () => window.removeEventListener('hashchange', handleChange);
  }, []);

  const navigate = useCallback((next: Route) => {
    if (window.location.hash !== `#${next}`) {
      window.location.hash = next;
    }
    setRoute(next);
  }, []);

  return { route, navigate };
}
