import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Flame, Zap, Crown, Sparkles, Timer, TrendingUp, Gift, Star } from "lucide-react";

interface Props {
  visitorId?: string | null;
  totalProducts: number;
  inStockProducts: number;
}

interface StreakRow {
  current_streak: number;
  longest_streak: number;
  total_claims: number;
}

/** Returns dynamic discount % based on streak tier */
function getStreakDiscount(streak: number) {
  if (streak >= 100) return { pct: 15, tier: "DIAMOND", emoji: "💠", color: "from-cyan-300 via-sky-400 to-blue-500", glow: "rgba(56,189,248,0.7)" };
  if (streak >= 30) return { pct: 10, tier: "GOLD", emoji: "👑", color: "from-yellow-300 via-amber-400 to-orange-500", glow: "rgba(251,191,36,0.7)" };
  if (streak >= 14) return { pct: 7, tier: "SILVER", emoji: "💎", color: "from-slate-300 via-slate-400 to-zinc-500", glow: "rgba(148,163,184,0.7)" };
  if (streak >= 7) return { pct: 5, tier: "BRONZE", emoji: "🔥", color: "from-orange-400 via-red-500 to-rose-600", glow: "rgba(251,113,133,0.7)" };
  if (streak >= 3) return { pct: 3, tier: "ROOKIE", emoji: "⚡", color: "from-lime-300 via-emerald-400 to-teal-500", glow: "rgba(52,211,153,0.6)" };
  return { pct: 0, tier: "STARTER", emoji: "🌱", color: "from-slate-400 to-slate-600", glow: "rgba(100,116,139,0.4)" };
}

function fmtTime(ms: number) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, "0");
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const sec = String(s % 60).padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

export default function ProductHypeStreakBar({ visitorId, totalProducts, inStockProducts }: Props) {
  const [streak, setStreak] = useState<StreakRow | null>(null);
  const [now, setNow] = useState(Date.now());
  const [viewers, setViewers] = useState(() => 47 + Math.floor(Math.random() * 80));
  const [hypeIdx, setHypeIdx] = useState(0);

  // Tick every second for countdown + viewer wobble
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      setViewers((v) => Math.max(38, Math.min(220, v + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 4))));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Rotating hype messages
  const hypeMessages = useMemo(() => [
    { icon: "⚡", text: "Klaim instant 24/7" },
    { icon: "🛡️", text: "Garansi penuh aman" },
    { icon: "💸", text: "Harga termurah!" },
    { icon: "🚀", text: "Auto-deliver cepat" },
    { icon: "🎁", text: "Bonus tiap pembelian" },
    { icon: "🔥", text: "Trending sekarang" },
  ], []);

  useEffect(() => {
    const t = setInterval(() => setHypeIdx((i) => (i + 1) % hypeMessages.length), 2200);
    return () => clearInterval(t);
  }, [hypeMessages.length]);

  // Fetch streak
  useEffect(() => {
    if (!visitorId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("daily_streaks")
        .select("current_streak,longest_streak,total_claims")
        .eq("visitor_id", visitorId)
        .maybeSingle();
      if (!cancelled && data) setStreak(data as StreakRow);
    })();
    return () => { cancelled = true; };
  }, [visitorId]);

  const cur = streak?.current_streak ?? 0;
  const discount = getStreakDiscount(cur);
  const nextTierAt = cur < 3 ? 3 : cur < 7 ? 7 : cur < 14 ? 14 : cur < 30 ? 30 : cur < 100 ? 100 : 365;
  const progressPct = Math.min(100, (cur / nextTierAt) * 100);

  // Flash sale countdown — ends at next 6-hour mark
  const flashEnd = useMemo(() => {
    const d = new Date();
    const hr = d.getHours();
    const nextSlot = Math.ceil((hr + 0.001) / 6) * 6;
    d.setHours(nextSlot, 0, 0, 0);
    return d.getTime();
  }, []);
  const remaining = flashEnd - now;

  return (
    <div
      className="relative rounded-3xl p-[2px] overflow-hidden"
      style={{
        background: "linear-gradient(120deg, hsl(330 95% 60%), hsl(280 90% 65%), hsl(190 95% 55%), hsl(45 95% 55%), hsl(330 95% 60%))",
        backgroundSize: "300% 300%",
        animation: "aurora-shift 8s ease infinite",
        boxShadow: `0 10px 40px -10px ${discount.glow}`,
      }}
    >
      <div className="relative rounded-[22px] bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-slate-950/95 backdrop-blur-xl p-3 overflow-hidden">
        {/* Animated mesh background */}
        <div className="pointer-events-none absolute inset-0 opacity-50">
          <motion.div
            className="absolute -top-16 -left-16 w-48 h-48 rounded-full blur-3xl"
            style={{ background: discount.glow }}
            animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-16 -right-16 w-48 h-48 rounded-full bg-fuchsia-500/40 blur-3xl"
            animate={{ x: [0, -25, 0], y: [0, -15, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Floating sparkles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-white"
              style={{
                top: `${10 + (i * 11) % 80}%`,
                left: `${(i * 13) % 95}%`,
                boxShadow: "0 0 6px rgba(255,255,255,0.9)",
              }}
              animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.4, 0.8] }}
              transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.3 }}
            />
          ))}
        </div>

        {/* Header row: Tier badge + Live viewers */}
        <div className="relative flex items-center gap-2 mb-3">
          <motion.div
            className={`relative shrink-0 px-2.5 py-1.5 rounded-xl bg-gradient-to-br ${discount.color} flex items-center gap-1.5 border border-white/30`}
            style={{ boxShadow: `0 0 20px ${discount.glow}` }}
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <span className="text-base leading-none">{discount.emoji}</span>
            <span className="text-[10px] font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] tracking-wider">{discount.tier}</span>
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm font-black bg-gradient-to-r from-white via-pink-200 to-cyan-200 bg-clip-text text-transparent">
                Streak Bonus Aktif
              </h3>
              <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-500/90 text-white border border-white/30">
                <span className="w-1 h-1 rounded-full bg-white animate-pulse" /> LIVE
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px]">
              <span className="text-emerald-300 font-bold flex items-center gap-0.5">
                <TrendingUp className="w-2.5 h-2.5" />
                <motion.span key={viewers} initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} className="tabular-nums">
                  {viewers}
                </motion.span>
                <span className="text-white/60">menonton</span>
              </span>
              <span className="text-white/50">•</span>
              <span className="text-cyan-300 font-bold tabular-nums">{inStockProducts}/{totalProducts} ready</span>
            </div>
          </div>

          {/* Discount badge */}
          <motion.div
            className="relative shrink-0"
            animate={{ rotate: [-2, 2, -2] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-yellow-400 to-pink-500 blur-md opacity-70" />
            <div className="relative rounded-2xl bg-gradient-to-br from-yellow-300 via-orange-400 to-rose-500 px-2.5 py-1.5 border-2 border-white/40">
              <p className="text-[8px] font-black text-white/90 leading-none uppercase tracking-wider">Diskon</p>
              <p className="text-lg font-black text-white leading-none tabular-nums drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {discount.pct}%
              </p>
            </div>
          </motion.div>
        </div>

        {/* Streak progress bar */}
        <div className="relative space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold">
            <span className="text-white/80 flex items-center gap-1">
              <Flame className="w-3 h-3 text-orange-400" />
              <span className="tabular-nums text-white">{cur}</span> hari streak
            </span>
            <span className="text-white/60">
              Next tier di <span className="text-yellow-300 font-black tabular-nums">{nextTierAt}d</span>
            </span>
          </div>
          <div className="relative h-2 rounded-full bg-white/10 overflow-hidden border border-white/10">
            <motion.div
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${discount.color} rounded-full`}
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              style={{ boxShadow: `0 0 12px ${discount.glow}` }}
            />
            <motion.div
              className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/60 to-transparent"
              animate={{ x: ["-100%", "400%"] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
            />
          </div>
        </div>

        {/* Bottom row: Flash sale + rotating hype */}
        <div className="relative grid grid-cols-2 gap-2 mt-3">
          {/* Flash sale countdown */}
          <div className="relative rounded-xl p-2 bg-gradient-to-br from-rose-500/30 to-orange-500/20 border border-rose-300/40 overflow-hidden">
            <div className="absolute -top-4 -right-4 w-12 h-12 rounded-full bg-rose-500/40 blur-xl" />
            <div className="relative flex items-center gap-1.5">
              <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>
                <Timer className="w-3.5 h-3.5 text-rose-300" />
              </motion.div>
              <p className="text-[8px] font-black text-rose-200 uppercase tracking-wider">Flash Sale</p>
            </div>
            <p className="relative text-sm font-black text-white tabular-nums mt-0.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
              {fmtTime(remaining)}
            </p>
          </div>

          {/* Rotating hype carousel */}
          <div className="relative rounded-xl p-2 bg-gradient-to-br from-cyan-500/25 to-purple-500/20 border border-cyan-300/40 overflow-hidden">
            <div className="absolute -bottom-4 -left-4 w-12 h-12 rounded-full bg-cyan-500/40 blur-xl" />
            <div className="relative flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <p className="text-[8px] font-black text-cyan-200 uppercase tracking-wider">Bonus Hari Ini</p>
            </div>
            <div className="relative h-4 mt-0.5 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={hypeIdx}
                  initial={{ y: 12, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -12, opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="text-[11px] font-black text-white whitespace-nowrap"
                >
                  <span className="mr-1">{hypeMessages[hypeIdx].icon}</span>
                  {hypeMessages[hypeIdx].text}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Streak stats inline (only if user has streak) */}
        {streak && cur > 0 && (
          <div className="relative mt-2.5 flex items-center justify-around gap-2 rounded-xl bg-white/5 border border-white/10 p-1.5">
            <div className="flex items-center gap-1 text-[10px]">
              <Flame className="w-3 h-3 text-orange-400" />
              <span className="text-white/60">Saat ini</span>
              <span className="font-black text-orange-300 tabular-nums">{cur}d</span>
            </div>
            <div className="w-px h-3 bg-white/15" />
            <div className="flex items-center gap-1 text-[10px]">
              <Crown className="w-3 h-3 text-yellow-400" />
              <span className="text-white/60">Terbaik</span>
              <span className="font-black text-yellow-300 tabular-nums">{streak.longest_streak}d</span>
            </div>
            <div className="w-px h-3 bg-white/15" />
            <div className="flex items-center gap-1 text-[10px]">
              <Star className="w-3 h-3 text-purple-300" />
              <span className="text-white/60">Total</span>
              <span className="font-black text-purple-200 tabular-nums">{streak.total_claims}</span>
            </div>
          </div>
        )}

        {/* CTA when no streak */}
        {(!streak || cur === 0) && (
          <motion.div
            className="relative mt-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-pink-500/20 border border-amber-300/40 p-2 flex items-center gap-2"
            animate={{ boxShadow: ["0 0 0px rgba(251,191,36,0.3)", "0 0 16px rgba(251,191,36,0.5)", "0 0 0px rgba(251,191,36,0.3)"] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Gift className="w-4 h-4 text-amber-300 shrink-0" />
            <p className="text-[10px] font-bold text-white/90 leading-tight">
              <span className="text-amber-200 font-black">Mulai streak harian</span> di tab <span className="text-pink-200 font-black">Streak</span> untuk unlock diskon eksklusif!
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
