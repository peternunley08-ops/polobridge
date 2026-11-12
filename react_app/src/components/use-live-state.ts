import { MutableRefObject, useCallback, useRef, useState } from 'react';

/**
 * `useState` whose latest value can also be read synchronously through a ref.
 *
 * A timer callback has to see the value a handler set a moment ago, before
 * React has re-rendered. Every write goes through the returned setter, which
 * updates the ref first, so the ref is never behind. Updater functions run
 * once, at call time.
 */
export function useLiveState<T>(
  initial: T | (() => T)
): [T, (next: T | ((previous: T) => T)) => void, MutableRefObject<T>] {
  const [value, setValue] = useState<T>(initial);
  const ref = useRef<T>(value);

  const set = useCallback((next: T | ((previous: T) => T)) => {
    const resolved = typeof next === 'function' ? (next as (previous: T) => T)(ref.current) : next;
    ref.current = resolved;
    setValue(resolved);
  }, []);

  return [value, set, ref];
}
