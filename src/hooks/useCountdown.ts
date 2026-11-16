import { useCallback, useEffect, useState } from 'react';

/** Counts down whole seconds (e.g. the "resend code in 30 s" wait). `start(n)` restarts it; it stops at 0. */
export function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  return { seconds, start: useCallback((value: number) => setSeconds(Math.max(0, Math.ceil(value))), []) };
}
