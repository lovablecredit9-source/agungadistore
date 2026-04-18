import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Zap, Trophy, Sparkles, Clock, Users, TrendingUp, Star } from "lucide-react";

interface Props {
  visitorId: string;
  currentStreak: number;
  totalClaims: number;
}

function getWeekEnd(): Date {
  const now = new Date();
  const wibOffset = 7 * 60;
  const local = new Date(now.getTime() + (wibOffset + now.getTimezoneOffset()) * 60000);
  const day = local.getDay(); // 0 Sun
  const daysUntilSun = (7 - day) % 7 || 7;
  const end = new Date(local);
  end.setDate(local.getDate() + daysUntilSun);
  end.setHours(0, 0, 0, 0);
  return new Date(end.getTime() - (wibOffset + now.getTimezoneOffset()) * 60000);
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
  const weekEnd = useMemo(() => getWeekEnd(), []);
  const [participants, setParticipants] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Pseudo-random but stable participant counter (per visitor + hour)
  useEffect(() => {
    const base = 1247;
    const hour = Math.floor(Date.now() / 3_600_000);
    const seed = (visitorId.charCodeAt(0) || 7) + hour;
    const variance = (seed * 31) % 437;
    setParticipants(base + variance + Math.floor(currentStreak * 3.7));
  }, [visitorId, currentStreak, now]);

  const remaining = weekEnd.getTime() - now;
  const totalWeek = 7 * 86400 * 1000;
  const elapsed = totalWeek - remaining;
  const progressPct = Math.min(100, Math.max(0, (elapsed / totalWeek) * 100));

  // Jackpot grows as the week progresses + bonus from user activity
  const jackpotBase = 5000;
  const jackpotPool = Math.floor(jackpotBase + progressPct * 50 + totalClaims * 12 + currentStreak * 25);

  // Live multiplier window (every 6 hours we get a 30 min surge)
  const minuteOfDay = (Math.floor(now / 60000) % (6 * 60));
  const isSurge = minuteOfDay < 30;
  const surgeRemaining = isSurge ? (30 - minuteOfDay) * 60000 : (6 * 60 - minuteOfDay) * 60000;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border-2 border-pink-500/50 p-4 bg-gradient-to-br from-pink-950 via-purple-950 to-indigo-950 shadow-[0_0_30px_rgba(236,72,153,0.35)]"
    >
      {/* animated bg glow */}
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
              <div className="text-[10px] font-black tracking-widest text-pink-300 uppercase">LIVE EVENT</div>
              <div className="text-base font-black text-white">Mega Streak Festival</div>
            </div>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/30 border border-red-400/50">
            <motion.div className="w-1.5 h-1.5 rounded-full bg-red-400" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
            <span className="text-[9px] font-black text-red-200">LIVE</span>
          </div>
        </div>

        {/* Jackpot */}
        <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-400/40">
          <div className="flex items-center gap-1.5 mb-1">
            <Trophy className="w-3.5 h-3.5 text-yellow-300" strokeWidth={2.5} />
            <span className="text-[10px] font-black text-yellow-200 tracking-wider uppercase">Jackpot Pool</span>
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
            <motion.div
              className="h-full bg-gradient-to-r from-yellow-400 to-orange-500"
              animate={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="text-[9px] text-yellow-200/70 mt-1">Pool naik tiap quest selesai · dibagi rata Top 100</div>
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

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2 rounded-lg bg-black/40 border border-purple-500/30 text-center">
            <Users className="w-3.5 h-3.5 mx-auto mb-0.5 text-purple-300" strokeWidth={2.5} />
            <div className="text-sm font-black text-white tabular-nums">{participants.toLocaleString("id-ID")}</div>
            <div className="text-[8px] text-white/60 uppercase tracking-wider">Pemain</div>
          </div>
          <div className="p-2 rounded-lg bg-black/40 border border-pink-500/30 text-center">
            <Star className="w-3.5 h-3.5 mx-auto mb-0.5 text-pink-300" strokeWidth={2.5} />
            <div className="text-sm font-black text-white tabular-nums">{currentStreak}</div>
            <div className="text-[8px] text-white/60 uppercase tracking-wider">Streak</div>
          </div>
          <div className="p-2 rounded-lg bg-black/40 border border-cyan-500/30 text-center">
            <TrendingUp className="w-3.5 h-3.5 mx-auto mb-0.5 text-cyan-300" strokeWidth={2.5} />
            <div className="text-sm font-black text-white tabular-nums">+{Math.floor(progressPct)}%</div>
            <div className="text-[8px] text-white/60 uppercase tracking-wider">Bonus</div>
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
