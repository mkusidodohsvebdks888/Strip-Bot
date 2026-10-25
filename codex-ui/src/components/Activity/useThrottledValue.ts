import {useEffect, useRef, useState} from 'react';

/** Commit at most one stream update per `wait` ms, while always converging on the latest value. */
export function useThrottledValue<T>(value: T, wait = 150): T {
  const [shown, setShown] = useState(value);
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof window.setTimeout> | undefined>(undefined);
  useEffect(() => {
    const now = performance.now();
    const remaining = wait - (now - last.current);
    if (timer.current !== undefined) window.clearTimeout(timer.current);
    if (remaining <= 0) {
      last.current = now;
      setShown(value);
    } else {
      timer.current = window.setTimeout(() => {
        last.current = performance.now();
        setShown(value);
        timer.current = undefined;
      }, remaining);
    }
    return () => {
      if (timer.current !== undefined) window.clearTimeout(timer.current);
    };
  }, [value, wait]);
  return shown;
}
