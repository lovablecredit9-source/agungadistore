import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Zap, Trophy, Sparkles, Clock, Users, TrendingUp, Star, Loader2, Crown, Medal, Award, Target, Gift, Rocket, Coins, Gem } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  visitorId: string;
  currentStreak: number;
  totalClaims: number;
  streakCoins?: number;
}

interface LiveData {
  weekStart: string;
  weeklyParticipants: number;
  totalRegistered: number;
  questEngaged: number;
  totalClaimsWeek: number;
  jackpotPool: number;
  leaderboard: Array<{ visitor_id: string; current_streak: number; total_claims: number; streak_coins: number; display_name?: string; avatar_url?: string | null }>;
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

function maskId(id: string) {
  if (!id) return "?????";
  if (id.length <= 6) return id;
  return id.slice(0, 4) + "···" + id.slice(-2);
}

// Tier milestones — naik ke tier kasih bonus visual
const TIERS = [
  { name: "Bronze", min: 0, color: "from-amber-700 to-amber-900", text: "text-amber-300", reward: "5% bonus" },
  { name: "Silver", min: 100, color: "from-slate-400 to-slate-600", text: "text-slate-200", reward: "10% bonus" },
  { name: "Gold", min: 500, color: "from-yellow-400 to-orange-500", text: "text-yellow-200", reward: "20% bonus" },
  { name: "Platinum", min: 2000, color: "from-cyan-300 to-blue-500", text: "text-cyan-100", reward: "35% bonus" },
  { name: "Diamond", min: 5000, color: "from-pink-400 via-fuchsia-500 to-purple-600", text: "text-pink-100", reward: "50% bonus" },
];

export default function StreakEventLive({ visitorId, currentStreak, totalClaims, streakCoins = 0 }: Props) {
  const [now, setNow] = useState(Date.now());
  const [live, setLive] = useState<LiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [combo, setCombo] = useState(0);
  const [flashWinner, setFlashWinner] = useState<string | null>(null);
  const [gems, setGems] = useState(0);

  useEffect(() => {
    if (!visitorId) return;
    let mounted = true;
    const loadGems = async () => {
      const { data } = await supabase
        .from("game_profiles")
        .select("gems")
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (mounted && data) setGems(data.gems ?? 0);
    };
    loadGems();
    const t = setInterval(loadGems, 30_000);
    return () => { mounted = false; clearInterval(t); };
  }, [visitorId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Combo flame: pulse based on current streak
  useEffect(() => {
    setCombo(currentStreak);
  }, [currentStreak]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("streak-event-live", { body: {} });
        if (error) throw error;
        if (mounted) {
          const newData = data as LiveData;
          // Detect new top winner for ticker
          if (live && newData.leaderboard?.[0]?.visitor_id !== live.leaderboard?.[0]?.visitor_id) {
            const top = newData.leaderboard[0];
            setFlashWinner(top.display_name || maskId(top.visitor_id));
            setTimeout(() => setFlashWinner(null), 5000);
          }
          setLive(newData);
        }
      } catch (e) {
        console.error("[event-live]", e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => { mounted = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorId]);

  const weekEnd = useMemo(() => live ? getWeekEndFromStart(live.weekStart) : new Date(Date.now() + 7 * 86400_000), [live]);
  const weekStart = useMemo(() => live ? new Date(live.weekStart).getTime() : Date.now(), [live]);
  const remaining = weekEnd.getTime() - now;
  const totalWeek = 7 * 86400 * 1000;
  const elapsed = Math.max(0, now - weekStart);
  const progressPct = Math.min(100, Math.max(0, (elapsed / totalWeek) * 100));

  const minuteOfDay = (Math.floor(now / 60000) % (6 * 60));
  const isSurge = minuteOfDay < 30;
  const surgeRemaining = isSurge ? (30 - minuteOfDay) * 60000 : (6 * 60 - minuteOfDay) * 60000;

  // Find user's rank
  const myRank = useMemo(() => {
    if (!live?.leaderboard) return null;
    const idx = live.leaderboard.findIndex(l => l.visitor_id === visitorId);
    return idx >= 0 ? idx + 1 : null;
  }, [live, visitorId]);

  // Current tier
  const currentTier = useMemo(() => {
    let t = TIERS[0];
    for (const tier of TIERS) {
      if (currentStreak >= tier.min) t = tier;
    }
    return t;
  }, [currentStreak]);
  const nextTier = useMemo(() => TIERS.find(t => t.min > currentStreak) || null, [currentStreak]);
  const tierProgress = nextTier ? Math.min(100, ((currentStreak - currentTier.min) / (nextTier.min - currentTier.min)) * 100) : 100;

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
  const leaderboard = live?.leaderboard ?? [];
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3, 10);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border-2 border-pink-500/50 p-4 bg-gradient-to-br from-pink-950 via-purple-950 to-indigo-950 shadow-[0_0_30px_rgba(236,72,153,0.35)] space-y-3"
    >
      <motion.div
        className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-pink-500/30 blur-3xl pointer-events-none"
        animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <motion.div
        className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-cyan-500/30 blur-3xl pointer-events-none"
        animate={{ scale: [1.2, 1, 1.2], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      <div className="relative space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
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

        {/* Winner ticker */}
        <AnimatePresence>
          {flashWinner && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-2 p-2 rounded-lg bg-yellow-500/20 border border-yellow-400/50"
            >
              <Crown className="w-3.5 h-3.5 text-yellow-300" strokeWidth={3} />
              <span className="text-[10px] font-black text-yellow-100">🎉 RAJA BARU: {flashWinner} ambil alih posisi #1!</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TIER BADGE — your rank */}
        <motion.div
          className={`p-3 rounded-xl bg-gradient-to-r ${currentTier.color} relative overflow-hidden`}
          animate={{ boxShadow: ["0 0 0px rgba(255,255,255,0)", "0 0 20px rgba(255,255,255,0.3)", "0 0 0px rgba(255,255,255,0)"] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <div className="flex items-center justify-between mb-2 relative">
            <div className="flex items-center gap-2">
              <Crown className={`w-5 h-5 ${currentTier.text} drop-shadow`} strokeWidth={2.5} />
              <div>
                <div className="text-[9px] font-black text-white/80 uppercase tracking-widest">Tier Kamu</div>
                <div className={`text-base font-black ${currentTier.text}`}>{currentTier.name}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-black text-white/80 uppercase">Bonus</div>
              <div className="text-xs font-black text-white">{currentTier.reward}</div>
            </div>
          </div>
          {nextTier && (
            <>
              <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
                <motion.div className="h-full bg-white/80" animate={{ width: `${tierProgress}%` }} />
              </div>
              <div className="text-[9px] text-white/80 mt-1 font-bold">
                {nextTier.min - currentStreak} streak lagi → <span className="font-black">{nextTier.name}</span>
              </div>
            </>
          )}
          {!nextTier && (
            <div className="text-[10px] text-white font-black mt-1">⭐ TIER MAKSIMAL DICAPAI ⭐</div>
          )}
        </motion.div>

        {/* Jackpot */}
        <div className="p-3 rounded-xl bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/40">
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

        {/* MY WALLET — Streak Coin & Gem (Diamond) */}
        <div className="grid grid-cols-2 gap-2">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="p-3 rounded-xl bg-gradient-to-br from-amber-500/25 to-yellow-600/25 border border-yellow-400/50 relative overflow-hidden"
          >
            <motion.div
              className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-yellow-400/20 blur-2xl"
              animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 3, repeat: Infinity }}
            />
            <div className="flex items-center gap-1.5 mb-1 relative">
              <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}>
                <Coins className="w-4 h-4 text-yellow-300 drop-shadow-[0_0_6px_rgba(250,204,21,0.6)]" strokeWidth={2.5} />
              </motion.div>
              <span className="text-[9px] font-black text-yellow-100 uppercase tracking-widest">Streak Coin</span>
            </div>
            <div className="text-xl font-black text-yellow-50 tabular-nums relative drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]">
              {streakCoins.toLocaleString("id-ID")}
            </div>
            <div className="text-[9px] text-yellow-200/80 mt-0.5 font-bold relative">Buat klaim hadiah harian</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="p-3 rounded-xl bg-gradient-to-br from-cyan-500/25 to-blue-600/25 border border-cyan-400/50 relative overflow-hidden"
          >
            <motion.div
              className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-cyan-400/25 blur-2xl"
              animate={{ scale: [1.1, 1, 1.1], opacity: [0.5, 0.8, 0.5] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            />
            <div className="flex items-center gap-1.5 mb-1 relative">
              <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 15, -15, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                <Gem className="w-4 h-4 text-cyan-200 drop-shadow-[0_0_6px_rgba(34,211,238,0.7)]" strokeWidth={2.5} />
              </motion.div>
              <span className="text-[9px] font-black text-cyan-100 uppercase tracking-widest">Streak Gem 💎</span>
            </div>
            <div className="text-xl font-black text-cyan-50 tabular-nums relative drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
              {gems.toLocaleString("id-ID")}
            </div>
            <div className="text-[9px] text-cyan-200/80 mt-0.5 font-bold relative">Diamond premium · upgrade tier</div>
          </motion.div>
        </div>

        {/* TOP 3 PODIUM */}
        {top3.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Medal className="w-3.5 h-3.5 text-yellow-300" strokeWidth={2.5} />
              <span className="text-[10px] font-black text-white tracking-widest uppercase">🏆 Podium Juara</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 items-end">
              {/* 2nd */}
              {top3[1] && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
                  className="p-2 rounded-lg bg-gradient-to-b from-slate-300/30 to-slate-500/30 border border-slate-300/50 text-center h-20 flex flex-col justify-end"
                >
                  <Medal className="w-4 h-4 mx-auto text-slate-200 mb-0.5" strokeWidth={2.5} />
                  <div className="text-[9px] font-black text-slate-100 truncate">{top3[1].display_name || maskId(top3[1].visitor_id)}</div>
                  <div className="text-[10px] font-black text-white tabular-nums">🔥 {top3[1].current_streak}</div>
                </motion.div>
              )}
              {/* 1st */}
              {top3[0] && (
                <motion.div
                  initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  className="p-2 rounded-lg bg-gradient-to-b from-yellow-400/40 to-orange-500/40 border border-yellow-300/60 text-center h-24 flex flex-col justify-end relative overflow-hidden"
                >
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-t from-transparent to-yellow-300/30"
                    animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 2, repeat: Infinity }}
                  />
                  <Crown className="w-5 h-5 mx-auto text-yellow-200 mb-0.5 drop-shadow relative" strokeWidth={2.5} />
                  <div className="text-[10px] font-black text-yellow-50 truncate relative">{top3[0].display_name || maskId(top3[0].visitor_id)}</div>
                  <div className="text-xs font-black text-white tabular-nums relative">🔥 {top3[0].current_streak}</div>
                </motion.div>
              )}
              {/* 3rd */}
              {top3[2] && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                  className="p-2 rounded-lg bg-gradient-to-b from-amber-600/30 to-amber-800/30 border border-amber-500/50 text-center h-16 flex flex-col justify-end"
                >
                  <Award className="w-4 h-4 mx-auto text-amber-300 mb-0.5" strokeWidth={2.5} />
                  <div className="text-[9px] font-black text-amber-100 truncate">{top3[2].display_name || maskId(top3[2].visitor_id)}</div>
                  <div className="text-[10px] font-black text-white tabular-nums">🔥 {top3[2].current_streak}</div>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* Live leaderboard rest */}
        {rest.length > 0 && (
          <div className="p-2 rounded-xl bg-black/40 border border-purple-500/30 space-y-1">
            {rest.map((r, i) => {
              const rank = i + 4;
              const isMe = r.visitor_id === visitorId;
              return (
                <motion.div
                  key={r.visitor_id}
                  initial={{ x: -8, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: i * 0.04 }}
                  className={`flex items-center justify-between px-2 py-1 rounded-md ${isMe ? "bg-pink-500/30 border border-pink-400/50" : "hover:bg-white/5"}`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`text-[9px] font-black tabular-nums w-5 ${isMe ? "text-pink-200" : "text-white/50"}`}>#{rank}</span>
                    <span className={`text-[10px] font-bold truncate ${isMe ? "text-pink-100" : "text-white/80"}`}>
                      {isMe ? "👉 Kamu" : (r.display_name || maskId(r.visitor_id))}
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-orange-300 tabular-nums shrink-0">🔥 {r.current_streak}</span>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* My rank badge */}
        {myRank && (
          <div className="p-2 rounded-lg bg-gradient-to-r from-pink-500/20 to-purple-500/20 border border-pink-400/40 flex items-center gap-2">
            <Target className="w-4 h-4 text-pink-300" strokeWidth={2.5} />
            <span className="text-[10px] font-black text-pink-100">Posisi kamu: <span className="text-yellow-300">#{myRank}</span> dari {leaderboard.length} top players</span>
          </div>
        )}

        {/* Surge */}
        <div className={`p-2.5 rounded-xl border ${isSurge ? "bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border-cyan-400/50" : "bg-black/30 border-purple-500/30"}`}>
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

        {/* Combo flame meter */}
        <div className="p-2.5 rounded-xl bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-400/40">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1, repeat: Infinity }}>
                <Rocket className="w-4 h-4 text-orange-300" strokeWidth={2.5} />
              </motion.div>
              <span className="text-[10px] font-black text-orange-100 uppercase tracking-wider">Combo Streak</span>
            </div>
            <span className="text-sm font-black text-yellow-300 tabular-nums">x{Math.min(10, Math.floor(combo / 7) + 1)}</span>
          </div>
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }).map((_, i) => {
              const lit = i < Math.min(10, Math.floor(combo / 7) + 1);
              return (
                <motion.div
                  key={i}
                  className={`flex-1 h-1.5 rounded-full ${lit ? "bg-gradient-to-r from-yellow-400 to-red-500" : "bg-white/10"}`}
                  animate={lit ? { opacity: [0.6, 1, 0.6] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
                />
              );
            })}
          </div>
          <div className="text-[9px] text-orange-200/80 mt-1 font-bold">Tiap 7 streak naik 1 multiplier · max x10</div>
        </div>

        {/* Stats grid */}
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

        {/* Daily reward hint */}
        <div className="p-2 rounded-lg bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border border-emerald-400/30 flex items-center gap-2">
          <Gift className="w-4 h-4 text-emerald-300 shrink-0" strokeWidth={2.5} />
          <div className="flex-1">
            <div className="text-[10px] font-black text-emerald-100">Klaim harian = naik tier + tambah pool jackpot!</div>
            <div className="text-[9px] text-emerald-200/70">Top 10 dapat bagian pool akhir minggu</div>
          </div>
        </div>

        {/* Countdown */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-purple-900/60 to-pink-900/60 border border-purple-400/30">
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
