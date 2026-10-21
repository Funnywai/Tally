import { useCallback, useEffect, useRef, useState } from 'react';
import { isApiError } from '../lib/api';

export interface AsyncState<T> {
  readonly data: T | null;
  readonly error: string | null;
  readonly loading: boolean;
  readonly reload: () => void;
}

export function messageOf(error: unknown): string {
  if (isApiError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '發生未知錯誤';
}

export function useAsync<T>(key: string, load: () => Promise<T>): AsyncState<T> {
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<{
    data: T | null;
    error: string | null;
    loading: boolean;
  }>({ data: null, error: null, loading: true });

  // biome-ignore lint/correctness/useExhaustiveDependencies: key and nonce intentionally trigger a reload
  useEffect(() => {
    let cancelled = false;
    setState({ data: null, error: null, loading: true });
    loadRef
      .current()
      .then((data) => {
        if (!cancelled) {
          setState({ data, error: null, loading: false });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ data: null, error: messageOf(error), loading: false });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key, nonce]);

  const reload = useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  return { ...state, reload };
}
