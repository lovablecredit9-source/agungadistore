import { useEffect, useState } from "react";
import { Star, Trophy, Flame, Zap, Gem } from "lucide-react";
import {
  loadGameData, getCurrentLevelThreshold, getNextLevelThreshold,
  getPointBoosterUntil, getActiveBoosterSummary, reconcileGameLevelFromServer, type GameLevel,
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
  const [boosterSummary, setBoosterSummary] = useState(getActiveBoosterSummary());
  const boosterTotal = boosterSummary.total;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const i = setInterval(() => {
      setData(loadGameData());
      setBoosterUntil(getPointBoosterUntil());
      setBoosterSummary(getActiveBoosterSummary());
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(i);
  }, []);

  // Rekonsiliasi poin/level dgn server saat mount & saat akun berubah (perbaiki level turun).
  useEffect(() => {
    setData(loadGameData());
    reconcileGameLevelFromServer().then(setData).catch(() => {});
    const onUpdate = () => setData(loadGameData());
    window.addEventListener("game-level-updated", onUpdate);
    return () => window.removeEventListener("game-level-updated", onUpdate);
  }, [visitorId]);

  const curThreshold = getCurrentLevelThreshold(data.level);
  const nextThreshold = getNextLevelThreshold(data.level);
  const range = Math.max(1, nextThreshold - curThreshold);
  const progressed = Math.max(0, data.totalPoints - curThreshold);
  const pct = Math.min(100, (progressed / range) * 100);
  const winRate = data.gamesPlayed > 0 ? Math.round((data.gamesWon / data.gamesPlayed) * 100) : 0;

  const boosterActive = boosterUntil > now;
  const remaining = boosterActive ? boosterUntil - now : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl p-[2px] game-hero-pulse">
      <div className="absolute inset-0 game-border-rainbow opacity-90" />
      <div className="relative overflow-hidden rounded-[14px] update-aurora-bg p-4 text-white shadow-xl shadow-primary/25">
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/25 blur-2xl" />
        <div className="absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-yellow-200/30 blur-2xl" />
      <div className="relative flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-white/85 drop-shadow">Profil Pemain</p>
          <h3 className="font-black text-2xl leading-none mt-1 flex items-center gap-2 tracking-tight drop-shadow-lg">
            <Star className="w-5 h-5 text-yellow-200 fill-yellow-200 quick-action-bounce" strokeWidth={1.7} />
            Level {data.level}
          </h3>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-wider text-white/85 drop-shadow">Total Poin</p>
          <p className="font-black text-xl tabular-nums mt-1 drop-shadow-lg">{data.totalPoints.toLocaleString("id-ID")}</p>
        </div>
      </div>

      <div className="relative space-y-1 mb-3">
        <div className="flex items-center justify-between text-[10px] font-black text-white/85 tabular-nums drop-shadow">
          <span>{progressed} / {range} XP</span>
          <span>Lv.{data.level + 1} · {Math.max(0, nextThreshold - data.totalPoints)} pts lagi</span>
        </div>
        <div className="h-2 bg-white/25 rounded-full overflow-hidden shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-yellow-200 via-white to-cyan-200 transition-all duration-500 rounded-full shadow-lg shadow-white/40"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="relative grid grid-cols-3 gap-2 mb-3">
        <div className="bg-white/20 rounded-xl px-2 py-2 text-center border border-white/30 backdrop-blur shadow-lg">
          <Trophy className="w-3.5 h-3.5 text-yellow-200 mx-auto" strokeWidth={1.7} />
          <p className="text-[9px] text-white/80 font-black uppercase mt-1">Menang</p>
          <p className="text-sm font-black tabular-nums drop-shadow">{data.gamesWon}</p>
        </div>
        <div className="bg-white/20 rounded-xl px-2 py-2 text-center border border-white/30 backdrop-blur shadow-lg">
          <Flame className="w-3.5 h-3.5 text-orange-200 mx-auto" strokeWidth={1.7} />
          <p className="text-[9px] text-white/80 font-black uppercase mt-1">Win Rate</p>
          <p className="text-sm font-black tabular-nums drop-shadow">{winRate}%</p>
        </div>
        <div className="bg-white/20 rounded-xl px-2 py-2 text-center border border-white/30 backdrop-blur shadow-lg">
          <Gem className="w-3.5 h-3.5 text-cyan-100 mx-auto" strokeWidth={1.7} />
          <p className="text-[9px] text-white/80 font-black uppercase mt-1">Main</p>
          <p className="text-sm font-black tabular-nums drop-shadow">{data.gamesPlayed}</p>
        </div>
      </div>

      <div className="relative flex items-center gap-2">
        {boosterActive ? (
          <div className="flex-1 flex flex-col gap-1 bg-white/25 text-white rounded-xl px-2.5 py-1.5 border border-white/35 backdrop-blur">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Zap className="w-3.5 h-3.5" strokeWidth={1.8} />
              <span className="text-[11px] font-semibold">x{boosterTotal} POIN AKTIF</span>
              <span className="rounded-md bg-white/20 px-1.5 py-0.5 text-[9px] font-black tabular-nums">
                total {fmtRemaining(boosterSummary.totalRemainingMs)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {boosterSummary.slots.map((s) => (
                <span
                  key={s.key}
                  className="flex items-center gap-1 rounded-md bg-white/25 px-1.5 py-0.5 text-[9px] font-black tabular-nums"
                >
                  x{s.multiplier}
                  <span className="text-white/85">{fmtRemaining(Math.max(0, s.until - now))}</span>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="flex-1 text-[10px] text-white/85 font-black drop-shadow">
            Aktifkan booster x2/x3 poin untuk semua game
          </p>
        )}
        <BuyBoosterDialog visitorId={visitorId} />
      </div>
      </div>
    </div>
  );
}
