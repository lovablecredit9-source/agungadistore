import { Gem, Plus, AlertCircle } from "lucide-react";
import { fmtNum } from "./theme";

interface Props {
  gems: number;
  spinCost: number;
  hasFreeSpin: boolean;
  onBuy: () => void;
}

export default function RoyaleWallet({ gems, spinCost, hasFreeSpin, onBuy }: Props) {
  const short = !hasFreeSpin && gems < spinCost;
  return (
    <section className="royale-glass relative overflow-hidden rounded-2xl p-4">
      <div aria-hidden className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-cyan-400/10 blur-2xl" />
      <div className="relative flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-black tracking-[0.22em] text-white/50">
            <Gem className="h-3.5 w-3.5 text-cyan-300" fill="currentColor" /> YOUR BALANCE
          </p>
          <p className="mt-1 truncate text-[30px] font-black leading-none tabular-nums text-white">{fmtNum(gems)}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-cyan-200/70">Gems</p>
        </div>
        <button
          type="button"
          onClick={onBuy}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-3.5 text-[11px] font-black tracking-wider text-cyan-100 transition hover:bg-cyan-400/20 active:scale-95"
        >
          <Plus className="h-4 w-4" /> Buy Gems
        </button>
      </div>
      {short && (
        <div className="relative mt-3 flex items-center gap-2 rounded-xl border border-amber-300/25 bg-amber-400/[0.08] px-3 py-2 text-[11px] text-amber-100/90">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-300" />
          <span>Gem belum cukup untuk 1 spin ({fmtNum(spinCost)} 💎). Beli Gem atau pakai tiket/free spin.</span>
        </div>
      )}
    </section>
  );
}
