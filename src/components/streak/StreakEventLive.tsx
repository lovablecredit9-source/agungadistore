import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Zap, Trophy, Sparkles, Clock, Users, TrendingUp, Star, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  visitorId: string;
  currentStreak: number;
  totalClaims: number;
}

interface LiveData {
  weekStart: string;
  weeklyParticipants: number;
  totalRegistered: number;
  questEngaged: number;
  totalClaimsWeek: number;
  jackpotPool: number;
  leaderboard: Array<{ visitor_id: string; current_streak: number; total_claims: number; streak_coins: number }>;
}

function getWeekEndFromStart(weekStartIso: string): Date {
  const start = new Date(weekStartIso);
  return new Date(start.getTime() + 7 * 24 * 3600 * 1000);
}

function fmt(ms: number) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${d}h ${h.toString().padStart(2, "0")}j ${m.toString().padStart(2, "0")}m ${sec.toString().padStart(2, "0")}d`;
}

export default function StreakEventLive({ visitorId, currentStreak, totalClaims }: Props) {
  const [now, setNow] = useState(Date.now());
  const [live, setLive] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);

  // Tick clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load REAL data from backend, refresh every 30s
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("streak-event-live", { body: {} });
        if (error) throw error;
        if (mounted) setLive(data as LiveData);
      } catch (e) {
        console.error("[event-live]", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(t); };
  }, [visitorId]);

  const weekEnd = useMemo(() => live ? getWeekEndFromStart(live.weekStart) : new Date(Date.now() + 7 * 86400_000), [live]);
  const weekStart = useMemo(() => live ? new Date(live.weekStart).getTime() : Date.now(), [live]);
  const remaining = weekEnd.getTime() - now;
  const totalWeek = 7 * 86400 * 1000;
  const elapsed = Math.max(0, now - weekStart);
  const progressPct = Math.min(100, Math.max(0, (elapsed / totalWeek) * 100));

  // Power surge window (every 6 hours, 30 min)
  const minuteOfDay = (Math.floor(now / 60000) % (6 * 60));
  const isSurge = minuteOfDay < 30;
  const surgeRemaining = isSurge ? (30 - minuteOfDay) * 60000 : (6 * 60 - minuteOfDay) * 60000;

  if (loading) {
    return (
      <div className="rounded-2xl border-2 border-pink-500/50 p-6 bg-gradient-to-br from-pink-950 via-purple-950 to-indigo-950 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-pink-300" />
        <span className="text-xs text-pink-200 font-bold">Memuat data live event...</span>
      </div>
    );
  }

  const realParticipants = live?.weeklyParticipants ?? 0;
  const totalRegistered = live?.totalRegistered ?? 0;
  const jackpotPool = live?.jackpotPool ?? 5000;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border-2 border-pink-500/50 p-4 bg-gradient-to-br from-pink-950 via-purple-950 to-indigo-950 shadow-[0_0_30px_rgba(236,72,153,0.35)]"
    >
      <motion.div
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-pink-500/30 blur-3xl"
        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <motion.div
        className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-cyan-500/30 blur-3xl"
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }}>
              <Flame className="w-6 h-6 text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]" strokeWidth={2.5} />
            </motion.div>
            <div>
              <div className="text-[10px] font-black tracking-widest text-pink-300 uppercase">LIVE EVENT · DATA ASLI</div>
              <div className="text-base font-black text-white">Mega Streak Festival</div>
            </div>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/30 border border-red-400/50">
            <motion.div className="w-1.5 h-1.5 rounded-full bg-red-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
            <span className="text-[9px] font-black text-red-200">LIVE</span>
          </div>
        </div>

        {/* Jackpot from REAL activity */}
        <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/40">
          <div className="flex items-center gap-1.5 mb-1">
            <Trophy className="w-3.5 h-3.5 text-yellow-300" strokeWidth={2.5} />
            <span className="text-[10px] font-black text-yellow-200 tracking-wider uppercase">Jackpot Pool · Real-time</span>
          </div>
          <motion.div
            key={jackpotPool}
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            className="text-2xl font-black text-yellow-100 tabular-nums drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]"
          >
            {jackpotPool.toLocaleString("id-ID")} <span className="text-sm">koin</span>
          </motion.div>
          <div className="mt-2 h-1.5 rounded-full bg-black/40 overflow-hidden">
            <motion.div className="h-full bg-gradient-to-r from-yellow-400 to-orange-500" animate={{ width: `${progressPct}%` }} />
          </div>
          <div className="text-[9px] text-yellow-200/70 mt-1">Pool naik tiap pemain klaim · dibagi rata Top 10</div>
        </div>

        {/* Surge */}
        <div className={`mb-3 p-2.5 rounded-xl border ${isSurge ? "bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border-cyan-400/50" : "bg-black/30 border-purple-500/30"}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <motion.div animate={isSurge ? { scale: [1, 1.3, 1] } : {}} transition={{ duration: 0.8, repeat: Infinity }}>
                <Zap className={`w-4 h-4 ${isSurge ? "text-cyan-200" : "text-white/50"}`} strokeWidth={2.5} />
              </motion.div>
              <span className={`text-xs font-black ${isSurge ? "text-cyan-100" : "text-white/70"}`}>
                {isSurge ? "🔥 POWER SURGE x2 AKTIF" : "Power Surge berikut"}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] font-black text-white/80 tabular-nums">
              <Clock className="w-3 h-3" />
              {fmt(surgeRemaining)}
            </div>
          </div>
        </div>

        {/* REAL Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-black/40 border border-purple-500/30 text-center">
            <Users className="w-3.5 h-3.5 mx-auto mb-0.5 text-purple-300" strokeWidth={2.5} />
            <div className="text-sm font-black text-white tabular-nums">{realParticipants.toLocaleString("id-ID")}</div>
            <div className="text-[8px] text-white/60 uppercase tracking-wider">Pemain Aktif</div>
          </div>
          <div className="p-2 rounded-lg bg-black/40 border border-pink-500/30 text-center">
            <Star className="w-3.5 h-3.5 mx-auto mb-0.5 text-pink-300" strokeWidth={2.5} />
            <div className="text-sm font-black text-white tabular-nums">{currentStreak}</div>
            <div className="text-[8px] text-white/60 uppercase tracking-wider">Streak Kamu</div>
          </div>
          <div className="p-2 rounded-lg bg-black/40 border border-cyan-500/30 text-center">
            <TrendingUp className="w-3.5 h-3.5 mx-auto mb-0.5 text-cyan-300" strokeWidth={2.5} />
            <div className="text-sm font-black text-white tabular-nums">{totalRegistered.toLocaleString("id-ID")}</div>
            <div className="text-[8px] text-white/60 uppercase tracking-wider">Total Member</div>
          </div>
        </div>

        {/* Countdown */}
        <div className="mt-3 flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-purple-900/60 to-pink-900/60 border border-purple-400/30">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-pink-300" strokeWidth={2.5} />
            <span className="text-[10px] font-black text-white/90 uppercase tracking-wider">Event berakhir</span>
          </div>
          <span className="text-[11px] font-black text-pink-200 tabular-nums">{fmt(remaining)}</span>
        </div>
      </div>
    </motion.div>
  );
}
