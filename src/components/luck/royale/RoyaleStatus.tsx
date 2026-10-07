import { Flame, Zap, Gem } from "lucide-react";
import { formatCompactNumber } from "@/lib/utils";

const pad = (n: number) => String(n).padStart(2, "0");
const hms = (ms: number) => {
  const t = Math.max(0, ms);
  const d = Math.floor(t / 86400000);
  const h = Math.floor((t % 86400000) / 3600000);
  const m = Math.floor((t % 3600000) / 60000);
  const s = Math.floor((t % 60000) / 1000);
  return `${d > 0 ? `${d}h ` : ""}${pad(h)}:${pad(m)}:${pad(s)}`;
};

/** Server multiplier is capped at 1.2 — bar shows progress toward that cap. */
export function RoyaleStreak({ streak, multiplier }: { streak: number; multiplier: number }) {
  const bonusPct = Math.max(0, Math.round((multiplier - 1) * 100));
  const progress = Math.min(100, (Math.max(0, multiplier - 1) / 0.2) * 100);
  return (
    <div className="royale-glass rounded-2xl p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-black tracking-[0.2em] text-orange-200/80">
        <Flame className="h-3.5 w-3.5 text-orange-400" fill="currentColor" /> LUCKY STREAK
      </p>
      <p className="mt-1 text-xl font-black leading-none tabular-nums text-white">{streak} <span className="text-[11px] font-bold text-white/50">spins</span></p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-1 text-[10px] text-white/55">Multiplier <span className="font-black text-amber-200">x{multiplier.toFixed(2)}</span>{bonusPct > 0 ? ` · +${bonusPct}%` : ""}</p>
    </div>
  );
}

export interface LuckyHourState {
  active: boolean;
  hour: number;
  nextActiveAt: string;
  boostedUntil?: string | null;
  source?: "free" | "purchased" | null;
}

export function RoyaleLuckyHour({ luckyHour, now }: { luckyHour: LuckyHourState | null; now: number }) {
  if (!luckyHour) {
    return (
      <div className="royale-glass rounded-2xl p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-black tracking-[0.2em] text-emerald-200/80"><Zap className="h-3.5 w-3.5" /> LUCKY HOUR</p>
        <p className="mt-2 text-[11px] text-white/50">Memuat jadwal…</p>
      </div>
    );
  }
  const purchased = luckyHour.source === "purchased";
  // Free lucky hour lasts until the top of the next hour (WIB offset is a whole hour).
  const endsMs = purchased && luckyHour.boostedUntil ? new Date(luckyHour.boostedUntil).getTime() - now : 3600000 - (now % 3600000);
  if (luckyHour.active) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-emerald-300/30 bg-gradient-to-br from-emerald-500/15 to-teal-500/5 p-3">
        <div aria-hidden className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-emerald-400/20 blur-2xl" />
        <p className="relative flex items-center gap-1.5 text-[10px] font-black tracking-[0.2em] text-emerald-200">
          <Zap className="h-3.5 w-3.5" fill="currentColor" /> LUCKY HOUR
          <span className="ml-auto rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[8px] text-emerald-100">ACTIVE</span>
        </p>
        <p className="relative mt-1 text-xl font-black leading-none tabular-nums text-white">{hms(endsMs)}</p>
        <p className="relative mt-1.5 text-[10px] text-emerald-100/70">Your luck is boosted{purchased ? " · dibeli" : ""}</p>
      </div>
    );
  }
  const startsMs = new Date(luckyHour.nextActiveAt).getTime() - now;
  return (
    <div className="royale-glass rounded-2xl p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-black tracking-[0.2em] text-emerald-200/80"><Zap className="h-3.5 w-3.5" /> NEXT LUCKY HOUR</p>
      <p className="mt-1 text-xl font-black leading-none tabular-nums text-white">{pad(luckyHour.hour)}:00 <span className="text-[10px] font-bold text-white/50">WIB</span></p>
      <p className="mt-1.5 text-[10px] text-white/55">Mulai dalam <span className="font-black tabular-nums text-emerald-200">{hms(startsMs)}</span></p>
    </div>
  );
}

export function RoyaleJackpot({ pool }: { pool: number }) {
  return (
    <div className="royale-jackpot-glow relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/[0.14] via-black/30 to-fuchsia-500/[0.12] p-3.5">
      <div aria-hidden className="pointer-events-none absolute -left-8 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-amber-400/25 blur-2xl" />
      <div className="relative flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-amber-200 to-amber-600 shadow-lg shadow-amber-500/30">
          <Gem className="h-6 w-6 text-amber-950" fill="currentColor" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black tracking-[0.25em] text-amber-200/90">MEGA JACKPOT</p>
          <p className="truncate text-2xl font-black leading-tight tabular-nums text-white">{formatCompactNumber(pool)} <span className="text-[12px] text-amber-200">GEM POOL</span></p>
          <p className="text-[10px] text-white/55">Berpeluang pecah saat hasil Mythic · pemenang dapat 70% pool</p>
        </div>
      </div>
    </div>
  );
}
