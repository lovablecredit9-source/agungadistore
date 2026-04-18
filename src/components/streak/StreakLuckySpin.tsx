import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  visitorId: string;
  currentStreak: number;
  onUpdate?: () => void;
}

const REWARDS = [
  { label: "+10 Coins", coins: 10, color: "from-cyan-400 to-blue-500" },
  { label: "+25 Coins", coins: 25, color: "from-emerald-400 to-green-600" },
  { label: "+5 Coins", coins: 5, color: "from-slate-400 to-slate-600" },
  { label: "+50 Coins", coins: 50, color: "from-yellow-400 to-orange-500" },
  { label: "+15 Coins", coins: 15, color: "from-pink-400 to-rose-500" },
  { label: "+100 Coins", coins: 100, color: "from-purple-500 to-fuchsia-600" },
];

export default function StreakLuckySpin({ visitorId, currentStreak, onUpdate }: Props) {
  const { toast } = useToast();
  const key = `streak_lucky_spin_${visitorId}`;
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [used, setUsed] = useState(false);
  const [resultIdx, setResultIdx] = useState<number | null>(null);
  const locked = currentStreak < 7;

  function todayKey() {
    const d = new Date(Date.now() + 7 * 3600_000);
    return d.toISOString().split("T")[0];
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const p = JSON.parse(raw);
        if (p.date === todayKey()) setUsed(true);
      }
    } catch { /* noop */ }
  }, [key]);

  async function spin() {
    if (locked || used || spinning) return;
    setSpinning(true);
    const idx = Math.floor(Math.random() * REWARDS.length);
    const finalRot = 360 * 6 + (360 - idx * (360 / REWARDS.length));
    setRotation(finalRot);
    setResultIdx(idx);
    setTimeout(async () => {
      const reward = REWARDS[idx];
      try {
        const { data: streak } = await supabase.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
        if (streak) {
          await supabase.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) + reward.coins }).eq("id", streak.id);
        }
      } catch { /* noop */ }
      try { localStorage.setItem(key, JSON.stringify({ date: todayKey() })); } catch { /* noop */ }
      setUsed(true);
      setSpinning(false);
      toast({ title: "🎰 Lucky Spin!", description: `Kamu dapat ${reward.label}` });
      onUpdate?.();
    }, 3500);
  }

  return (
    <div className="cyber-card rounded-2xl p-3 relative overflow-hidden">
      <div className="absolute inset-0 cyber-grid opacity-20 rounded-2xl" />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 icon-3d-sparkles" strokeWidth={2.5} />
            <span className="text-[11px] font-black neon-text-cyan tracking-widest uppercase">Lucky Spin Gratis</span>
          </div>
          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-yellow-400 text-black">1× SEHARI</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-24 h-24 flex-shrink-0">
            <motion.div
              animate={{ rotate: rotation }}
              transition={{ duration: 3.5, ease: [0.17, 0.67, 0.23, 0.99] }}
              className="absolute inset-0 rounded-full border-4 border-yellow-400 overflow-hidden shadow-[0_0_15px_hsl(var(--neon-yellow)/0.6)]"
              style={{
                background: `conic-gradient(${REWARDS.map((r, i) => {
                  const colors = ["#06b6d4", "#10b981", "#64748b", "#f59e0b", "#ec4899", "#a855f7"];
                  const seg = 360 / REWARDS.length;
                  return `${colors[i]} ${i * seg}deg ${(i + 1) * seg}deg`;
                }).join(", ")})`,
              }}
            />
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[10px] border-l-transparent border-r-transparent border-t-yellow-400 z-10" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-6 h-6 rounded-full bg-black/70 border-2 border-white/40" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            {locked ? (
              <div className="text-[11px] font-bold text-white/70 flex items-start gap-1">
                <Lock className="w-3 h-3 mt-0.5 icon-3d-lock" strokeWidth={3} />
                <span>Buka pada streak 7 hari (sekarang {currentStreak}/7)</span>
              </div>
            ) : used ? (
              <div className="text-[11px] font-bold text-emerald-300">✓ Sudah dipakai hari ini. Reset 00:00 WIB.</div>
            ) : (
              <div className="text-[11px] font-bold text-white/80 mb-2">Putar roda untuk hadiah coin gratis!</div>
            )}
            <Button
              size="sm" onClick={spin} disabled={locked || used || spinning}
              className="w-full h-8 text-xs bg-gradient-to-r from-yellow-400 to-pink-500 text-black font-black"
            >
              {spinning ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />Memutar...</> : "PUTAR!"}
            </Button>
            {resultIdx !== null && used && !spinning && (
              <div className="text-[10px] font-black text-yellow-300 mt-1 text-center">🎁 {REWARDS[resultIdx].label}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
