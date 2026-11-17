import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { PAGINATION } from '@/config/constants';

type Unsubscribe = () => void;

interface ActiveSub {
  key: string;
  count: number;
  unsubscribe: Unsubscribe;
  listeners: Set<(val: unknown) => void>;
  lastValue: unknown;
  hasValue: boolean;
}

const activeSubscriptions = new Map<string, ActiveSub>();
const listenerCountSubscribers = new Set<(count: number) => void>();

function notifyCountChange(): void {
  const count = activeSubscriptions.size;
  if (count > PAGINATION.DIAGNOSTICS_LISTENER_WARN_THRESHOLD) {
    logger.warn('High active Firestore listener count', { activeListeners: count });
  }
  for (const cb of listenerCountSubscribers) {
    cb(count);
  }
}

export function getActiveListenerCount(): number {
  return activeSubscriptions.size;
}

export function detachAllSubscriptions(): void {
  for (const sub of activeSubscriptions.values()) {
    try {
      sub.unsubscribe();
    } catch {
      // ignore teardown errors
    }
  }
  activeSubscriptions.clear();
  notifyCountChange();
}

export function useActiveListenerCount(): number {
  const [count, setCount] = useState(() => activeSubscriptions.size);
  useEffect(() => {
    listenerCountSubscribers.add(setCount);
    return () => {
      listenerCountSubscribers.delete(setCount);
    };
  }, []);
  return count;
}

export interface UseFirestoreSubscriptionOptions {
  enabled?: boolean;
  pauseWhenHidden?: boolean;
}

export function useFirestoreSubscription<T>(
  key: string | null,
  subscribeFn: (onData: (val: T) => void, onError: (err: Error) => void) => Unsubscribe,
  options: UseFirestoreSubscriptionOptions = {},
): { data: T | undefined; loading: boolean; error: Error | null } {
  const { enabled = true, pauseWhenHidden = false } = options;
  const [result, setResult] = useState<{
    key: string | null;
    data: T | undefined;
    error: Error | null;
  }>({ key: null, data: undefined, error: null });
  const [isHidden, setIsHidden] = useState<boolean>(() =>
    typeof document !== 'undefined' ? document.hidden : false,
  );

  useEffect(() => {
    if (!pauseWhenHidden || typeof document === 'undefined') return;
    const onVis = () => setIsHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [pauseWhenHidden]);

  useEffect(() => {
    if (!key || !enabled || (pauseWhenHidden && isHidden)) {
      return;
    }

    let sub = activeSubscriptions.get(key);
    const handler = (val: unknown) => {
      setResult({ key, data: val as T, error: null });
    };

    if (!sub) {
      const listeners = new Set<(val: unknown) => void>([handler]);
      const unsubscribe = subscribeFn(
        (val: T) => {
          const current = activeSubscriptions.get(key);
          if (!current) return;
          current.lastValue = val;
          current.hasValue = true;
          for (const listener of current.listeners) {
            listener(val);
          }
        },
        (err: Error) => {
          setResult({ key, data: undefined, error: err });
        },
      );

      sub = {
        key,
        count: 1,
        unsubscribe,
        listeners,
        lastValue: undefined,
        hasValue: false,
      };
      activeSubscriptions.set(key, sub);
      notifyCountChange();
    } else {
      sub.count += 1;
      sub.listeners.add(handler);
      if (sub.hasValue) {
        queueMicrotask(() => {
          setResult({ key, data: sub!.lastValue as T, error: null });
        });
      }
    }

    return () => {
      const existing = activeSubscriptions.get(key);
      if (!existing) return;
      existing.listeners.delete(handler);
      existing.count -= 1;
      if (existing.count <= 0) {
        try {
          existing.unsubscribe();
        } catch {
          // ignore
        }
        activeSubscriptions.delete(key);
        notifyCountChange();
      }
    };
    // subscribeFn is keyed by `key`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, pauseWhenHidden, isHidden]);

  const active = Boolean(key && enabled);
  const resolved = active && result.key === key;
  return {
    data: resolved ? result.data : undefined,
    loading: active && !(pauseWhenHidden && isHidden) && !resolved,
    error: resolved ? result.error : null,
  };
}
