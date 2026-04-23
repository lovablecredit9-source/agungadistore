import { useEffect, useState } from "react";
import { Star, Trophy, Flame, Zap, Gem } from "lucide-react";
import {
  loadGameData, getCurrentLevelThreshold, getNextLevelThreshold,
  getPointBoosterUntil, type GameLevel,
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
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Profil Pemain</p>
          <h3 className="font-bold text-2xl text-foreground leading-none mt-1 flex items-center gap-2 tracking-tight">
            <Star className="w-5 h-5 text-foreground" strokeWidth={1.7} />
            Level {data.level}
          </h3>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Total Poin</p>
          <p className="font-bold text-xl text-foreground tabular-nums mt-1">{data.totalPoints.toLocaleString("id-ID")}</p>
        </div>
      </div>

      <div className="space-y-1 mb-3">
        <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground tabular-nums">
          <span>{progressed} / {range} XP</span>
          <span>Lv.{data.level + 1} · {Math.max(0, nextThreshold - data.totalPoints)} pts lagi</span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-foreground transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-muted/60 rounded-lg px-2 py-2 text-center border border-border">
          <Trophy className="w-3.5 h-3.5 text-foreground mx-auto" strokeWidth={1.7} />
          <p className="text-[9px] text-muted-foreground font-medium uppercase mt-1">Menang</p>
          <p className="text-sm font-bold text-foreground tabular-nums">{data.gamesWon}</p>
        </div>
        <div className="bg-muted/60 rounded-lg px-2 py-2 text-center border border-border">
          <Flame className="w-3.5 h-3.5 text-foreground mx-auto" strokeWidth={1.7} />
          <p className="text-[9px] text-muted-foreground font-medium uppercase mt-1">Win Rate</p>
          <p className="text-sm font-bold text-foreground tabular-nums">{winRate}%</p>
        </div>
        <div className="bg-muted/60 rounded-lg px-2 py-2 text-center border border-border">
          <Gem className="w-3.5 h-3.5 text-foreground mx-auto" strokeWidth={1.7} />
          <p className="text-[9px] text-muted-foreground font-medium uppercase mt-1">Main</p>
          <p className="text-sm font-bold text-foreground tabular-nums">{data.gamesPlayed}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {boosterActive ? (
          <div className="flex-1 flex items-center gap-1.5 bg-muted text-foreground rounded-lg px-2.5 py-1.5 border border-border">
            <Zap className="w-3.5 h-3.5" strokeWidth={1.8} />
            <span className="text-[11px] font-semibold">x2 POIN AKTIF</span>
            <span className="ml-auto text-[10px] font-medium tabular-nums text-muted-foreground">{fmtRemaining(remaining)}</span>
          </div>
        ) : (
          <p className="flex-1 text-[10px] text-muted-foreground font-medium">
            Aktifkan booster x2 poin untuk semua game
          </p>
        )}
        <BuyBoosterDialog visitorId={visitorId} />
      </div>
    </div>
  );
}
