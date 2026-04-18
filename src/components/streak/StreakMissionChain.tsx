import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Flame, Trophy, Target, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  visitorId: string;
  currentStreak: number;
  totalClaims: number;
  onUpdate?: () => void;
}

interface ChainStep {
  id: string;
  title: string;
  desc: string;
  target: number;
  current: number;
  reward: number;
  Icon: any;
  color: string;
}

export default function StreakMissionChain({ visitorId, currentStreak, totalClaims, onUpdate }: Props) {
  const { toast } = useToast();
  const key = `streak_chain_v1_${visitorId}`;
  const [claimed, setClaimed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setClaimed(JSON.parse(raw));
    } catch { /* noop */ }
  }, [key]);

  const steps: ChainStep[] = [
    { id: "s1", title: "Pemula", desc: "Capai streak 3 hari", target: 3, current: currentStreak, reward: 50, Icon: Target, color: "from-cyan-500 to-blue-600" },
    { id: "s2", title: "Konsisten", desc: "Total 10 claim", target: 10, current: totalClaims, reward: 150, Icon: Flame, color: "from-orange-500 to-red-600" },
    { id: "s3", title: "Master Streak", desc: "Capai streak 14 hari", target: 14, current: currentStreak, reward: 500, Icon: Trophy, color: "from-yellow-400 via-pink-500 to-purple-600" },
  ];

  async function claim(s: ChainStep, idx: number) {
    if (s.current < s.target || claimed[s.id]) return;
    if (idx > 0 && !claimed[steps[idx - 1].id]) {
      toast({ title: "Terkunci", description: "Selesaikan tahap sebelumnya dulu.", variant: "destructive" });
      return;
    }
    setBusy(s.id);
    try {
      const { data: streak } = await supabase.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
      if (streak) {
        await supabase.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) + s.reward }).eq("id", streak.id);
      }
      const next = { ...claimed, [s.id]: true };
      setClaimed(next);
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* noop */ }
      toast({ title: `🏆 ${s.title} Selesai!`, description: `+${s.reward} Streak Coins` });
      onUpdate?.();
    } finally { setBusy(null); }
  }

  return (
    <div className="cyber-card-cyan rounded-2xl p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Trophy className="w-4 h-4 icon-3d-trophy" strokeWidth={2.5} />
        <span className="text-[11px] font-black neon-text-cyan tracking-widest uppercase">Mission Chain</span>
        <span className="ml-auto text-[9px] font-bold text-white/60">3 TAHAP</span>
      </div>
      <div className="space-y-2">
        {steps.map((s, idx) => {
          const pct = Math.min(100, (s.current / s.target) * 100);
          const done = claimed[s.id];
          const ready = s.current >= s.target && !done;
          const locked = idx > 0 && !claimed[steps[idx - 1].id];
          return (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
              className={`relative rounded-xl p-2.5 border ${done ? "bg-emerald-500/10 border-emerald-500/40" : "bg-black/30 border-white/10"}`}
            >
              {locked && (
                <div className="absolute inset-0 rounded-xl bg-black/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                  <Lock className="w-4 h-4 text-white/70" /> <span className="ml-1 text-[10px] font-black text-white/70">TERKUNCI</span>
                </div>
              )}
              <div className="flex items-center gap-2 mb-1.5">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center shrink-0 shadow-lg`}>
                  <s.Icon className="w-4 h-4 text-white" strokeWidth={2.5} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-extrabold text-white">{s.title}</div>
                  <div className="text-[10px] text-white/60">{s.desc}</div>
                </div>
                <div className="text-[10px] font-black neon-text-yellow whitespace-nowrap">+{s.reward}</div>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-1.5">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={`h-full bg-gradient-to-r ${s.color}`} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-white/70 tabular-nums">{Math.min(s.current, s.target)}/{s.target}</span>
                {done ? (
                  <span className="text-[10px] font-black text-emerald-300 flex items-center gap-1"><Check className="w-3 h-3" strokeWidth={3} /> SELESAI</span>
                ) : ready ? (
                  <Button size="sm" disabled={busy === s.id} onClick={() => claim(s, idx)} className="h-6 text-[10px] bg-gradient-to-r from-yellow-400 to-pink-500 text-black font-black">
                    KLAIM
                  </Button>
                ) : null}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
