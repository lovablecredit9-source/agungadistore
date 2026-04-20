import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star, Trophy, Flame, Zap, Gem } from "lucide-react";
import {
  loadGameData, getCurrentLevelThreshold, getNextLevelThreshold,
  getPointBoosterUntil, isPointBoosterActive, type GameLevel,
} from "./gameStore";
import BuyBoosterDialog from "./BuyBoosterDialog";

interface Props { visitorId: string | null }

function fmtRemaining(ms: number) {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}j ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export default function GameLevelHero({ visitorId }: Props) {
  const [data, setData] = useState<GameLevel>(loadGameData);
  const [boosterUntil, setBoosterUntil] = useState<number>(getPointBoosterUntil());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const i = setInterval(() => {
      setData(loadGameData());
      setBoosterUntil(getPointBoosterUntil());
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(i);
  }, []);

  const curThreshold = getCurrentLevelThreshold(data.level);
  const nextThreshold = getNextLevelThreshold(data.level);
  const range = Math.max(1, nextThreshold - curThreshold);
  const progressed = Math.max(0, data.totalPoints - curThreshold);
  const pct = Math.min(100, (progressed / range) * 100);
  const winRate = data.gamesPlayed > 0 ? Math.round((data.gamesWon / data.gamesPlayed) * 100) : 0;

  const boosterActive = boosterUntil > now;
  const remaining = boosterActive ? boosterUntil - now : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 p-4 shadow-lg"
    >
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-yellow-300 blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-cyan-300 blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">Profil Pemain</p>
            <h3 className="font-black text-2xl text-white leading-none mt-0.5 flex items-center gap-2">
              <Star className="w-6 h-6 text-yellow-300 fill-yellow-300" />
              Level {data.level}
            </h3>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/70">Total Poin</p>
            <p className="font-black text-xl text-white tabular-nums">{data.totalPoints.toLocaleString("id-ID")}</p>
          </div>
        </div>

        <div className="space-y-1 mb-3">
          <div className="flex items-center justify-between text-[10px] font-bold text-white/80">
            <span>{progressed} / {range} XP</span>
            <span>Lv.{data.level + 1} {Math.max(0, nextThreshold - data.totalPoints)} pts lagi</span>
          </div>
          <div className="h-2 bg-black/30 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6 }}
              className="h-full bg-gradient-to-r from-yellow-300 via-orange-400 to-pink-400"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-white/10 backdrop-blur rounded-lg px-2 py-1.5 text-center">
            <Trophy className="w-3.5 h-3.5 text-yellow-300 mx-auto" />
            <p className="text-[9px] text-white/70 font-bold uppercase mt-0.5">Menang</p>
            <p className="text-sm font-black text-white tabular-nums">{data.gamesWon}</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg px-2 py-1.5 text-center">
            <Flame className="w-3.5 h-3.5 text-orange-300 mx-auto" />
            <p className="text-[9px] text-white/70 font-bold uppercase mt-0.5">Win Rate</p>
            <p className="text-sm font-black text-white tabular-nums">{winRate}%</p>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-lg px-2 py-1.5 text-center">
            <Gem className="w-3.5 h-3.5 text-cyan-300 mx-auto" />
            <p className="text-[9px] text-white/70 font-bold uppercase mt-0.5">Main</p>
            <p className="text-sm font-black text-white tabular-nums">{data.gamesPlayed}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {boosterActive ? (
            <div className="flex-1 flex items-center gap-1.5 bg-yellow-400/90 text-yellow-950 rounded-lg px-2.5 py-1.5">
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span className="text-[11px] font-black">x2 POIN AKTIF</span>
              <span className="ml-auto text-[10px] font-bold tabular-nums">{fmtRemaining(remaining)}</span>
            </div>
          ) : (
            <p className="flex-1 text-[10px] text-white/80 font-bold">
              💡 Aktifkan booster x2 poin untuk semua game
            </p>
          )}
          <BuyBoosterDialog visitorId={visitorId} />
        </div>
      </div>
    </motion.div>
  );
}
