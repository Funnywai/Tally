import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { loadGameState, saveGameState } from '../lib/storage';
import { type GameAction, type GameState, gameReducer, initialGameState } from './gameReducer';

interface GameContextValue {
  readonly state: GameState;
  readonly dispatch: Dispatch<GameAction>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { readonly children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialGameState, () =>
    loadGameState(window.localStorage),
  );

  useEffect(() => {
    saveGameState(window.localStorage, state);
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame(): GameContextValue {
  const value = useContext(GameContext);
  if (value === null) {
    throw new Error('useGame must be used within GameProvider');
  }
  return value;
}
