import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** Seconds since `startedAt`, ticking every second (0 when not started). */
export function useElapsed(startedAt?: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Ticks just after each whole elapsed second, so the number changes on time rather than up to a second late.
    const update = () => {
      const t = Date.now();
      setNow(t);
      clearTimeout(timer);
      timer = setTimeout(update, 1000 - ((((t - startedAt) % 1000) + 1000) % 1000) + 5);
    };
    const frame = requestAnimationFrame(update); // the clock read before this session arrived is stale
    const sub = AppState.addEventListener('change', (s) => s === 'active' && update()); // timers pause in the background
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      sub.remove();
    };
  }, [startedAt]);
  return startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
}
