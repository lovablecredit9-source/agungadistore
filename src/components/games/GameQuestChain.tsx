import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, ListChecks, Trophy, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props { visitorId: string | null }

const CHAIN = [
  { id: "q1", title: "Main 1 game apapun", target: 1, reward: 10 },
  { id: "q2", title: "Menang 1 game AI", target: 1, reward: 20 },
  { id: "q3", title: "Main 3 game berbeda", target: 3, reward: 30 },
  { id: "q4", title: "Kumpulkan 50 poin total", target: 50, reward: 50 },
  { id: "q5", title: "Klaim 4 misi sebelumnya", target: 4, reward: 200 },
];

function todayKey() {
  return new Date(Date.now() + 7 * 3600_000).toISOString().split("T")[0];
}

export default function GameQuestChain({ visitorId }: Props) {
  const { toast } = useToast();
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [claimed, setClaimed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!visitorId) return;
    const key = `game_chain_${visitorId}_${todayKey()}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const p = JSON.parse(raw);
        setProgress(p.progress || {});
        setClaimed(p.claimed || {});
      } else {
        setProgress({}); setClaimed({});
      }
    } catch { /* noop */ }
  }, [visitorId]);

  // Auto-fill from existing game stats (best-effort)
  useEffect(() => {
    if (!visitorId) return;
    (async () => {
      try {
        const { data } = await supabase.from("game_stats").select("game_type, wins, points, total_questions").eq("visitor_id", visitorId);
        if (!data) return;
        const totalGames = data.reduce((s, r: any) => s + (r.total_questions || 0), 0);
        const totalWins = data.reduce((s, r: any) => s + (r.wins || 0), 0);
        const totalPoints = data.reduce((s, r: any) => s + (r.points || 0), 0);
        const distinct = data.filter((r: any) => (r.total_questions || 0) > 0).length;
        const claimedCount = Object.values(claimed).filter(Boolean).length;
        setProgress(p => ({
          ...p,
          q1: Math.max(p.q1 || 0, Math.min(1, totalGames)),
          q2: Math.max(p.q2 || 0, Math.min(1, totalWins)),
          q3: Math.max(p.q3 || 0, Math.min(3, distinct)),
          q4: Math.max(p.q4 || 0, Math.min(50, totalPoints)),
          q5: Math.max(p.q5 || 0, claimedCount),
        }));
      } catch { /* noop */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorId, claimed]);

  function persist(p: Record<string, number>, c: Record<string, boolean>) {
    if (!visitorId) return;
    const key = `game_chain_${visitorId}_${todayKey()}`;
    try { localStorage.setItem(key, JSON.stringify({ progress: p, claimed: c })); } catch { /* noop */ }
  }

  async function claim(idx: number) {
    const q = CHAIN[idx];
    const cur = progress[q.id] || 0;
    if (cur < q.target || claimed[q.id]) return;
    if (idx > 0 && !claimed[CHAIN[idx - 1].id]) {
      toast({ title: "Terkunci", description: "Selesaikan misi sebelumnya dulu.", variant: "destructive" });
      return;
    }
    if (visitorId) {
      try {
        const { data: streak } = await supabase.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
        if (streak) {
          await supabase.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) + q.reward }).eq("id", streak.id);
        }
      } catch { /* noop */ }
    }
    const next = { ...claimed, [q.id]: true };
    setClaimed(next);
    persist(progress, next);
    toast({ title: idx === CHAIN.length - 1 ? "🎉 JACKPOT!" : "✓ Misi Selesai", description: `+${q.reward} Streak Coins` });
  }

  return (
    <div className="cyber-card rounded-2xl p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <ListChecks className="w-4 h-4 icon-3d-target" strokeWidth={2.5} />
        <span className="text-[11px] font-black neon-text-cyan tracking-widest uppercase">Quest Chain Harian</span>
        <span className="ml-auto text-[9px] font-bold text-white/60">RESET 00:00 WIB</span>
      </div>
      <div className="space-y-1.5">
        {CHAIN.map((q, i) => {
          const cur = Math.min(q.target, progress[q.id] || 0);
          const pct = (cur / q.target) * 100;
          const done = claimed[q.id];
          const ready = cur >= q.target && !done;
          const locked = i > 0 && !claimed[CHAIN[i - 1].id];
          const isJackpot = i === CHAIN.length - 1;
          return (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              className={`relative rounded-lg p-2 border ${done ? "bg-emerald-500/10 border-emerald-500/40" : isJackpot ? "bg-gradient-to-r from-yellow-500/10 to-pink-500/10 border-yellow-500/40" : "bg-black/30 border-white/10"}`}
            >
              {locked && <Lock className="w-3 h-3 absolute top-1.5 right-1.5 text-white/40" />}
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-extrabold text-white truncate flex items-center gap-1">
                  {isJackpot && <Trophy className="w-3 h-3 text-yellow-400" />} {q.title}
                </span>
                <span className="text-[10px] font-black neon-text-yellow whitespace-nowrap ml-2">+{q.reward}</span>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-1">
                <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} className={`h-full ${isJackpot ? "bg-gradient-to-r from-yellow-400 to-pink-500" : "bg-cyan-400"}`} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] text-white/60 tabular-nums">{cur}/{q.target}</span>
                {done ? <Check className="w-3 h-3 text-emerald-300" strokeWidth={3} /> : ready ? (
                  <Button size="sm" onClick={() => claim(i)} className="h-5 text-[9px] px-2 bg-gradient-to-r from-yellow-400 to-pink-500 text-black font-black">KLAIM</Button>
                ) : null}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
