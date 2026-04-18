import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Zap, Flame } from "lucide-react";

interface Props {
  visitorId: string;
  currentStreak: number;
}

/**
 * Combo Multiplier — multiplier naik tiap claim beruntun pada window 24 jam.
 * Disimpan di localStorage. Murni client-side, hanya UI motivasi.
 */
export default function StreakComboMultiplier({ visitorId, currentStreak }: Props) {
  const key = `streak_combo_${visitorId}`;
  const [combo, setCombo] = useState(0);
  const [lastTs, setLastTs] = useState<number>(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const p = JSON.parse(raw);
        // reset jika lebih dari 36 jam
        if (Date.now() - p.ts > 36 * 3600_000) {
          setCombo(0); setLastTs(0);
        } else {
          setCombo(p.combo || 0); setLastTs(p.ts || 0);
        }
      }
    } catch { /* noop */ }
  }, [key]);

  // Sinkronkan combo dengan currentStreak (grow gently)
  useEffect(() => {
    const target = Math.min(10, currentStreak);
    if (target > combo) {
      const next = target;
      setCombo(next);
      const ts = Date.now();
      setLastTs(ts);
      try { localStorage.setItem(key, JSON.stringify({ combo: next, ts })); } catch { /* noop */ }
    }
  }, [currentStreak, combo, key]);

  const multiplier = 1 + combo * 0.1;
  const pct = Math.min(100, (combo / 10) * 100);

  return (
    <div className="cyber-card-pink rounded-2xl p-3 relative overflow-hidden">
      <div className="absolute -right-4 -top-4 w-20 h-20 bg-pink-500/30 rounded-full blur-2xl neon-pulse" />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Flame className="w-4 h-4 icon-3d-flame" strokeWidth={2.5} />
            <span className="text-[11px] font-black neon-text-pink tracking-widest uppercase">Combo Multiplier</span>
          </div>
          <motion.span
            key={combo}
            initial={{ scale: 0.5 }} animate={{ scale: 1 }}
            className="text-lg font-black neon-text-yellow tabular-nums flex items-center gap-1"
          >
            <Zap className="w-4 h-4 icon-3d-zap" strokeWidth={3} /> x{multiplier.toFixed(1)}
          </motion.span>
        </div>
        <div className="h-2 bg-black/40 rounded-full overflow-hidden mb-1">
          <motion.div
            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
            className="h-full bg-gradient-to-r from-pink-500 via-yellow-400 to-orange-500 shadow-[0_0_10px_hsl(var(--neon-pink)/0.7)]"
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-white/60">
          <span>Combo {combo}/10</span>
          <span>{combo === 10 ? "MAX!" : `+${((combo + 1) * 0.1).toFixed(1)}x next claim`}</span>
        </div>
      </div>
    </div>
  );
}
