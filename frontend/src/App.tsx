import { useCallback, useEffect, useState } from 'react';
import { BetApp } from './bet/BetApp';
import { AppHeader } from './components/AppHeader';
import { InstallBanner, OfflineBanner, UpdateBanner } from './components/Banners';
import { BottomNav } from './components/BottomNav';
import { ConfirmDialog } from './components/ConfirmDialog';
import { RenameDialog } from './components/RenameDialog';
import { SwapDialog } from './components/SwapDialog';
import { TallyMark } from './components/TallyMark';
import { ToastProvider } from './components/ToastProvider';
import { type ToolAction, ToolsSheet } from './components/ToolsSheet';
import { type Route, useHashRoute } from './hooks/useHashRoute';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { fetchPlayers, isApiError } from './lib/api';
import { FanPage } from './pages/FanPage';
import { LedgerPage } from './pages/LedgerPage';
import { LoginPage } from './pages/LoginPage';
import { MaiPage } from './pages/MaiPage';
import { GameProvider, useGame } from './state/GameProvider';
import { useGameActions } from './state/useGameActions';

type AuthState = 'probing' | 'login' | 'ready' | 'offline';
type ToolDialog = 'none' | 'reset' | 'rename' | 'swap';

function LoadingScreen() {
  return (
    <main className="loading-screen" role="status" aria-live="polite">
      <TallyMark size={56} className="loading-screen__mark" />
      <p className="loading-screen__text">載入中…</p>
    </main>
  );
}

function MahjongShell({
  route,
  navigate,
  offline,
  onRetry,
}: {
  readonly route: Exclude<Route, 'bet'>;
  readonly navigate: (route: Route) => void;
  readonly offline: boolean;
  readonly onRetry: () => void;
}) {
  const { state } = useGame();
  const actions = useGameActions();
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolDialog, setToolDialog] = useState<ToolDialog>('none');

  const handleTool = (action: ToolAction) => {
    setToolsOpen(false);
    if (action === 'undo') {
      actions.undo();
      return;
    }
    setToolDialog(action);
  };

  return (
    <div className="app-shell">
      <AppHeader
        todayTotal={state.accumulated[3]}
        onOpenTools={() => setToolsOpen(true)}
        onEnterBet={() => navigate('bet')}
      />
      <div className="banner-stack">
        <UpdateBanner />
        <OfflineBanner offline={offline} onRetry={onRetry} />
        <InstallBanner />
      </div>
      <main className="app-main">
        <div key={route} className="page-enter">
          {route === 'fan' ? <FanPage /> : null}
          {route === 'mai' ? <MaiPage /> : null}
          {route === 'ledger' ? <LedgerPage /> : null}
        </div>
      </main>
      <BottomNav active={route} onNavigate={navigate} />

      <ToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} onAction={handleTool} />

      <ConfirmDialog
        open={toolDialog === 'reset'}
        title="重設牌局"
        confirmLabel="確認重設"
        danger
        onConfirm={() => {
          actions.reset();
          setToolDialog('none');
        }}
        onClose={() => setToolDialog('none')}
      />

      <RenameDialog
        open={toolDialog === 'rename'}
        names={state.names}
        onClose={() => setToolDialog('none')}
        onSave={(names) => {
          actions.renameAll(names);
          setToolDialog('none');
        }}
      />

      <SwapDialog
        open={toolDialog === 'swap'}
        names={state.names}
        onClose={() => setToolDialog('none')}
        onSwap={(a, b) => {
          actions.swap(a, b);
          setToolDialog('none');
        }}
      />
    </div>
  );
}

function AuthenticatedApp({
  offline,
  onRetry,
}: {
  readonly offline: boolean;
  readonly onRetry: () => void;
}) {
  const { route, navigate } = useHashRoute();

  if (route === 'bet') {
    return <BetApp onExit={() => navigate('fan')} offline={offline} />;
  }

  return (
    <GameProvider>
      <ToastProvider>
        <MahjongShell route={route} navigate={navigate} offline={offline} onRetry={onRetry} />
      </ToastProvider>
    </GameProvider>
  );
}

function AppContent() {
  const [auth, setAuth] = useState<AuthState>('probing');
  const online = useOnlineStatus();

  const probe = useCallback(async () => {
    setAuth('probing');
    try {
      await fetchPlayers();
      setAuth('ready');
    } catch (caught: unknown) {
      if (isApiError(caught) && caught.status === 401) {
        setAuth('login');
      } else {
        setAuth('offline');
      }
    }
  }, []);

  useEffect(() => {
    void probe();
  }, [probe]);

  useEffect(() => {
    const handleUnauthorized = () => setAuth('login');
    window.addEventListener('tally:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('tally:unauthorized', handleUnauthorized);
  }, []);

  if (auth === 'probing') {
    return <LoadingScreen />;
  }

  if (auth === 'login') {
    return <LoginPage onAuthenticated={() => setAuth('ready')} />;
  }

  return <AuthenticatedApp offline={auth === 'offline' || !online} onRetry={() => void probe()} />;
}

export default function App() {
  return <AppContent />;
}
