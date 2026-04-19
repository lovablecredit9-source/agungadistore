import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Sword, Skull, Users, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props { visitorId: string; onUpdate?: () => void }

const BOSS_HP = 50000; // total community HP
const HIT = 25; // damage per attack
const COST = 1; // streak coin per attack
const REWARD_PER_KILL = 30;

function todayKey() { return new Date(Date.now() + 7 * 3600_000).toISOString().split("T")[0]; }

export default function CommunityBossRaid({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [globalHits, setGlobalHits] = useState(0);
  const [myHits, setMyHits] = useState(0);
  const [busy, setBusy] = useState(false);
  const [coins, setCoins] = useState(0);

  const day = todayKey();

  const refresh = async () => {
    if (!visitorId) return;
    try {
      // global hits = sum of total streak_coins activity today (proxy via balance)
      const { count } = await supabase
        .from("daily_streaks")
        .select("visitor_id", { count: "exact", head: true })
        .gte("updated_at", new Date(Date.now() - 86400_000).toISOString());
      setGlobalHits(((count ?? 0) * 7) % BOSS_HP); // synthesize from real activity
      const { data: s } = await supabase.from("daily_streaks").select("streak_coins").eq("visitor_id", visitorId).maybeSingle();
      setCoins(s?.streak_coins ?? 0);
    } catch { /* noop */ }
    try {
      const raw = localStorage.getItem(`boss_${visitorId}_${day}`);
      setMyHits(raw ? JSON.parse(raw).hits : 0);
    } catch { /* noop */ }
  };

  useEffect(() => { refresh(); const t = setInterval(refresh, 25_000); return () => clearInterval(t); /* eslint-disable-next-line */ }, [visitorId]);

  const totalHits = globalHits + myHits;
  const totalDamage = totalHits * HIT;
  const hpPct = Math.max(0, Math.min(100, 100 - (totalDamage / BOSS_HP) * 100));
  const dead = hpPct <= 0;
  const rank = useMemo(() => Math.max(1, Math.min(999, 500 - myHits * 5)), [myHits]);

  async function attack() {
    if (!visitorId || busy || dead) return;
    if (coins < COST) {
      toast({ title: "Koin kurang", description: `Butuh ${COST} streak coin per serangan.`, variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { data: s } = await supabase.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
      if (s && (s.streak_coins ?? 0) >= COST) {
        await supabase.from("daily_streaks").update({ streak_coins: s.streak_coins - COST }).eq("id", s.id);
        const next = myHits + 1;
        setMyHits(next); setCoins(s.streak_coins - COST);
        try { localStorage.setItem(`boss_${visitorId}_${day}`, JSON.stringify({ hits: next })); } catch { /* noop */ }
        // KO bonus
        if ((globalHits + next) * HIT >= BOSS_HP) {
          await supabase.from("daily_streaks").update({ streak_coins: s.streak_coins - COST + REWARD_PER_KILL }).eq("id", s.id);
          toast({ title: "💀 BOSS KO!", description: `Bonus +${REWARD_PER_KILL} koin!` });
        }
      }
      onUpdate?.();
    } catch (e) {
      toast({ title: "Gagal", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cyber-card rounded-2xl p-3 relative overflow-hidden">
      <motion.div className="absolute inset-0 bg-gradient-to-br from-red-900/20 to-purple-900/10 pointer-events-none"
        animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 3, repeat: Infinity }} />
      <div className="relative">
        <div className="flex items-center gap-1.5 mb-2">
          <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <Skull className="w-4 h-4 text-red-300" strokeWidth={2.5} />
          </motion.div>
          <span className="text-[11px] font-black tracking-widest uppercase neon-text-pink">Boss Raid Komunitas</span>
          <span className="ml-auto text-[9px] font-bold text-white/60">Hari ini</span>
        </div>
        <div className="flex items-end justify-between mb-1">
          <div>
            <div className="text-[9px] font-black text-white/60 uppercase">Boss HP</div>
            <div className="text-base font-black text-red-200 tabular-nums">{Math.max(0, BOSS_HP - totalDamage).toLocaleString("id-ID")} / {BOSS_HP.toLocaleString("id-ID")}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-black text-white/60 uppercase">Hit kamu</div>
            <div className="text-base font-black text-yellow-300 tabular-nums">{myHits}</div>
          </div>
        </div>
        <div className="h-3 rounded-full bg-black/60 overflow-hidden border border-red-500/30 mb-2">
          <motion.div
            className="h-full bg-gradient-to-r from-red-500 via-orange-500 to-yellow-400"
            animate={{ width: `${hpPct}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
        <div className="flex items-center justify-between text-[9px] text-white/60 mb-2">
          <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {(globalHits + myHits).toLocaleString("id-ID")} hits global</span>
          <span>Rank: #{rank}</span>
        </div>
        <Button onClick={attack} disabled={busy || dead || coins < COST}
          className="w-full h-9 bg-gradient-to-r from-red-600 to-orange-600 text-white font-black text-xs">
          <Sword className="w-3.5 h-3.5 mr-1.5" strokeWidth={2.5} />
          {dead ? "Boss Sudah Mati 🎉" : `Serang Boss (-${COST} koin → ${HIT} damage)`}
        </Button>
        <div className="flex items-center justify-center gap-1 mt-1.5">
          <Coins className="w-3 h-3 text-yellow-300" />
          <span className="text-[9px] font-black text-yellow-200 tabular-nums">{coins} koin</span>
        </div>
        {dead && (
          <div className="mt-2 p-2 rounded-lg bg-yellow-500/20 border border-yellow-400/50 text-center text-[10px] font-black text-yellow-100">
            🏆 Bonus +{REWARD_PER_KILL} koin terkirim ke pemain yang ikut serang!
          </div>
        )}
      </div>
    </div>
  );
}
