import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

interface Spinner { name: string; total: number; jackpots: number }
interface Jackpotter { name: string; count: number; latestLabel: string }

interface Props {
  loading: boolean;
  loaded: boolean;
  topSpinners: Spinner[];
  topJackpots: Jackpotter[];
  onLoad: () => void;
}

const MEDAL = ["🥇", "🥈", "🥉"];

/** Loads lazily the first time it scrolls into view. */
export default function RoyaleLeaderboard({ loading, loaded, topSpinners, topJackpots, onLoad }: Props) {
  const [tab, setTab] = useState<"spin" | "jackpot">("spin");
  const ref = useRef<HTMLDivElement>(null);
  const requested = useRef(false);
  useEffect(() => {
    if (loaded || !ref.current) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting) && !requested.current) {
        requested.current = true;
        onLoad();
        io.disconnect();
      }
    }, { rootMargin: "200px" });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [loaded, onLoad]);

  const rows = tab === "spin"
    ? topSpinners.map((u) => ({ name: u.name, value: u.total.toLocaleString("id-ID"), unit: "SPIN", sub: `${u.jackpots} hadiah langka` }))
    : topJackpots.map((u) => ({ name: u.name, value: String(u.count), unit: "JACKPOT", sub: u.latestLabel }));

  return (
    <div ref={ref} className="space-y-3">
      <div className="flex items-center gap-2">
        <div role="tablist" className="royale-tabs grid flex-1 grid-cols-2 gap-1 rounded-xl p-1">
          {([["spin", "TOP SPINS"], ["jackpot", "TOP JACKPOTS"]] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} data-active={tab === k} onClick={() => setTab(k)} className="royale-tab h-9 rounded-lg text-[10px] font-black tracking-wider">
              {l}
            </button>
          ))}
        </div>
        <button type="button" aria-label="Muat ulang peringkat" disabled={loading} onClick={onLoad} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 text-white/70 hover:bg-white/5 disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </button>
      </div>

      {loading && !loaded ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-amber-300" /></div>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-[11px] text-white/45">{loaded ? "Belum ada data peringkat." : "Scroll untuk memuat peringkat…"}</p>
      ) : (
        <div className="space-y-1.5">
          {rows.slice(0, 10).map((r, i) => (
            <div key={`${tab}-${i}`} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${i < 3 ? "border border-amber-300/25 bg-amber-400/[0.07]" : "border border-white/[0.06] bg-white/[0.03]"}`}>
              <div className="w-7 text-center text-base font-black text-white/80">{MEDAL[i] || `#${i + 1}`}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-black text-white">{r.name}</div>
                <div className="truncate text-[9px] text-white/45">{r.sub}</div>
              </div>
              <div className="text-right">
                <div className="text-[14px] font-black leading-none tabular-nums text-amber-100">{r.value}</div>
                <div className="text-[8px] font-bold tracking-widest text-white/40">{r.unit}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-center text-[9px] text-white/35">Nama disamarkan demi privasi · dari 5.000 spin komunitas terbaru</p>
    </div>
  );
}
