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

export default function RoyaleSpinControls({ single, bundles, spinning, onSpin }: Props) {
  return (
    <div className="space-y-3">
      <p className="text-center text-[12px] font-bold tracking-[0.2em] text-white/70">
        1 SPIN • <span className="text-amber-200"><CostLine o={single} /></span>
      </p>
      <button
        type="button"
        disabled={spinning}
        aria-busy={spinning}
        onClick={() => onSpin(1)}
        className={`royale-spin-btn relative flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[17px] font-black tracking-[0.3em] ${spinning ? "royale-shimmer" : ""}`}
      >
        {spinning ? <><Loader2 className="h-5 w-5 animate-spin" /> SPINNING…</> : "SPIN"}
        {single.note && !spinning && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/25 px-2 py-0.5 text-[9px] tracking-wider text-amber-50">{single.note}</span>
        )}
      </button>

      {bundles.length > 0 && (
        <div>
          <p className="mb-1.5 px-0.5 text-[10px] font-black tracking-[0.22em] text-white/45">BUNDLE SPIN</p>
          <div className="royale-scroll-x -mx-3 flex snap-x gap-2 overflow-x-auto px-3 pb-1 pt-2.5">
            {bundles.map((b) => (
              <button
                key={b.count}
                type="button"
                disabled={spinning}
                onClick={() => onSpin(b.count)}
                className={`relative min-w-[118px] snap-start rounded-xl border px-3 py-2.5 text-left transition active:scale-95 disabled:opacity-50 ${
                  b.highlight ? "border-amber-300/45 bg-amber-400/[0.09]" : "border-white/[0.08] bg-white/[0.04] hover:border-white/20"
                }`}
              >
                {b.badge && (
                  <span className={`absolute -top-2 right-2 rounded-full px-1.5 py-0.5 text-[8px] font-black tracking-wider ${b.highlight ? "bg-amber-300 text-amber-950" : "bg-white/15 text-white"}`}>
                    {b.badge}
                  </span>
                )}
                <div className="text-[13px] font-black tracking-wider text-white">{b.label}</div>
                <div className="mt-0.5 text-[12px] font-bold text-amber-200"><CostLine o={b} compact /></div>
                {b.note && <div className="mt-0.5 text-[9px] font-semibold text-emerald-300/90">{b.note}</div>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
