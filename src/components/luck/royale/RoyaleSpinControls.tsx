import { useState } from "react";
import { Gem, Loader2, Ticket } from "lucide-react";
import { formatCompactNumber } from "@/lib/utils";

export interface SpinOption {
  count: number;
  label: string;
  badge?: string;
  /** Gems actually charged (after server-provided discount/voucher/tickets). */
  gemCost: number;
  /** Tickets/tokens that will be consumed. */
  ticketUsed: number;
  /** Original list price, shown struck-through when a discount applies. */
  original?: number;
  note?: string;
  highlight?: boolean;
}

interface Props {
  single: SpinOption;
  bundles: SpinOption[];
  spinning: boolean;
  onSpin: (count: number) => void;
}

function CostLine({ o, compact }: { o: SpinOption; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      {o.ticketUsed > 0 && <><Ticket className="h-3.5 w-3.5" />{o.ticketUsed}</>}
      {o.ticketUsed > 0 && o.gemCost > 0 && <span className="opacity-60">+</span>}
      {(o.gemCost > 0 || o.ticketUsed === 0) && (
        <>
          {o.original != null && o.original > o.gemCost && o.ticketUsed === 0 && (
            <span className="line-through opacity-50">{compact ? formatCompactNumber(o.original) : o.original.toLocaleString("id-ID")}</span>
          )}
          <span>{compact ? formatCompactNumber(o.gemCost) : o.gemCost.toLocaleString("id-ID")}</span>
          <Gem className="h-3.5 w-3.5" fill="currentColor" />
        </>
      )}
    </span>
  );
}

/** The selected option is the single source of truth for the CTA and the count sent to the server. */
export default function RoyaleSpinControls({ single, bundles, spinning, onSpin }: Props) {
  const [selectedCount, setSelectedCount] = useState(1);
  const options = [single, ...bundles];
  const selected = options.find((o) => o.count === selectedCount) || single;

  return (
    <div className="space-y-3">
      <div className="royale-scroll-x -mx-3 flex snap-x gap-2 overflow-x-auto px-3 pb-1 pt-2.5" role="radiogroup" aria-label="Pilih jumlah spin">
        {options.map((b) => {
          const active = b.count === selected.count;
          return (
            <button
              key={b.count}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={spinning}
              onClick={() => setSelectedCount(b.count)}
              className={`relative min-w-[104px] snap-start rounded-xl border px-3 py-2.5 text-left transition active:scale-95 disabled:opacity-50 ${
                active
                  ? "border-amber-300 bg-amber-400/[0.16] shadow-[0_0_18px_rgba(251,191,36,0.35)] ring-1 ring-amber-300/60"
                  : b.highlight ? "border-amber-300/30 bg-amber-400/[0.06]" : "border-white/[0.08] bg-white/[0.04] hover:border-white/20"
              }`}
            >
              {b.badge && (
                <span className={`absolute -top-2 right-2 rounded-full px-1.5 py-0.5 text-[8px] font-black tracking-wider ${active || b.highlight ? "bg-amber-300 text-amber-950" : "bg-white/15 text-white"}`}>
                  {b.badge}
                </span>
              )}
              <div className="text-[13px] font-black tracking-wider text-white">{b.count === 1 ? "1 SPIN" : b.label}</div>
              <div className="mt-0.5 text-[12px] font-bold text-amber-200"><CostLine o={b} compact /></div>
              {b.note && <div className="mt-0.5 text-[9px] font-semibold text-emerald-300/90">{b.note}</div>}
            </button>
          );
        })}
      </div>

      <p className="text-center text-[11px] font-bold tracking-[0.18em] text-white/60">
        {selected.count.toLocaleString("id-ID")} hadiah akan dibuka • <span className="text-amber-200"><CostLine o={selected} /></span>
      </p>
      <button
        type="button"
        disabled={spinning}
        aria-busy={spinning}
        onClick={() => onSpin(selected.count)}
        className={`royale-spin-btn relative flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[17px] font-black tracking-[0.25em] ${spinning ? "royale-shimmer" : ""}`}
      >
        {spinning ? <><Loader2 className="h-5 w-5 animate-spin" /> SPINNING…</> : <>🎰 SPIN {selected.count.toLocaleString("id-ID")}×</>}
        {selected.note && !spinning && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/25 px-2 py-0.5 text-[9px] tracking-wider text-amber-50">{selected.note}</span>
        )}
      </button>
    </div>
  );
}
