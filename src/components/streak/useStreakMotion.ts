import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Motion budget for streak visuals. Reduced-motion users get static visuals;
 * low-end devices (few cores / little memory / save-data) get fewer particles.
 */
export function useStreakMotion() {
  const reduced = !!useReducedMotion();
  const lowPower = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const cores = nav.hardwareConcurrency ?? 8;
    const mem = nav.deviceMemory ?? 8;
    return cores <= 4 || mem <= 3 || !!nav.connection?.saveData;
  }, []);
  return { reduced, lowPower, particleFactor: reduced ? 0 : lowPower ? 0.5 : 1 };
}
