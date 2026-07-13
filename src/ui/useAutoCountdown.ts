import { useEffect, useState } from 'react';
import { AUTO_RELIC_DELAY_MS } from '../game';

// Live seconds-remaining for the auto-pick, restarted whenever the hosting modal
// mounts (a new offer/event) — mirrors the loop's own timer within a frame.
export function useAutoCountdown(active: boolean): number {
  const [left, setLeft] = useState(AUTO_RELIC_DELAY_MS / 1000);
  useEffect(() => {
    if (!active) return;
    const t0 = performance.now();
    setLeft(AUTO_RELIC_DELAY_MS / 1000);
    const id = setInterval(() => {
      const rem = Math.max(0, (AUTO_RELIC_DELAY_MS - (performance.now() - t0)) / 1000);
      setLeft(rem);
      if (rem <= 0) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [active]);
  return left;
}
