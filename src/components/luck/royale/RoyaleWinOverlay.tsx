import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cleanLabel, getKindIcon, rarityStyle, RARITY_RANK } from "./theme";
import { formatKindTotal, RARITY_ORDER, summarizeSpin } from "./spinSummary";

const GRID_STEP = 100;

export interface WinResult { kind: string; label: string; emoji: string; rarity: string; value: number }

interface Props {
  results: WinResult[];
  revealCount: number;
  revealDone: boolean;
  onSkip: () => void;
  onClose: () => void;
}

const TITLE: Record<string, string> = {
  common: "✨ CONGRATULATIONS ✨",
  rare: "✨ CONGRATULATIONS ✨",
  epic: "💜 EPIC DROP",
  legendary: "🔥 LEGENDARY",
  mythic: "👑 MYTHIC JACKPOT",
};

function Confetti({ count }: { count: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => {
        const x = ((i * 37) % 100) - 50;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/3 text-base"
            initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
            animate={{ opacity: [0, 1, 0], x: x * 4, y: [-10, -120 - (i % 5) * 30, 80], rotate: i * 47, scale: [0.4, 1, 0.8] }}
            transition={{ duration: 1.6, delay: (i % 6) * 0.05, ease: "easeOut" }}
          >
            {["✨", "⭐", "💎", "🎉"][i % 4]}
          </motion.span>
        );
      })}
    </div>
  );
}

/** Shows exactly what the server returned — never decides a result. */
export default function RoyaleWinOverlay({ results, revealCount, revealDone, onSkip, onClose }: Props) {
  const total = results.length;
  const shown = Math.min(revealCount, total);
  const visible = results.slice(0, shown);
  const best = [...results].sort((a, b) => (RARITY_RANK[b.rarity] || 0) - (RARITY_RANK[a.rarity] || 0))[0];
  const bestStyle = rarityStyle(best?.rarity);
  const big = best && (best.rarity === "legendary" || best.rarity === "mythic");
  const counts = useMemo(() => summarizeSpin(visible).rarity, [visible]);
  const summary = useMemo(() => summarizeSpin(results), [results]);
  const [gridLimit, setGridLimit] = useState(GRID_STEP);
  const gridItems = visible.slice(0, gridLimit);
  const single = total === 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Hasil spin"
    >
      {revealDone && big && <Confetti count={best.rarity === "mythic" ? 28 : 16} />}
      <motion.div
        initial={{ scale: 0.85, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        className={`royale-glass relative flex max-h-[calc(100dvh-2rem)] w-full max-w-sm flex-col overflow-hidden rounded-3xl p-5 ${single ? "" : "sm:max-w-lg lg:max-w-3xl"} ${revealDone && best?.rarity === "mythic" ? "royale-mythic-glow" : ""}`}
      >
        <div aria-hidden className={`pointer-events-none absolute -top-20 left-1/2 h-40 w-56 -translate-x-1/2 rounded-full bg-gradient-to-br ${bestStyle.gradient} opacity-30 blur-3xl`} />
        <button type="button" onClick={onClose} disabled={!revealDone} aria-label="Tutup" className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-30">
          <X className="h-5 w-5" />
        </button>

        <div className="relative text-center">
          <p className="text-[11px] font-black tracking-[0.25em] text-white/70">
            {revealDone ? TITLE[best?.rarity || "common"] : "MEMBUKA HADIAH…"}
          </p>
          {!single && (
            <p className="mt-1 text-[11px] text-white/50"><span className="font-black text-amber-200">{shown}</span> / {total} hadiah</p>
          )}
          {!revealDone && !single && (
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-gradient-to-r from-amber-300 to-orange-500 transition-all duration-100" style={{ width: `${(shown / total) * 100}%` }} />
            </div>
          )}
        </div>

        {single && best ? (
          <motion.div
            key={revealDone ? "done" : "wait"}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
            className="relative my-5 text-center"
          >
            <span className={`inline-block rounded-full bg-gradient-to-r ${bestStyle.gradient} px-3 py-1 text-[10px] font-black tracking-[0.3em] text-white shadow-lg ${bestStyle.glow}`}>
              {bestStyle.label}
            </span>
            <div className={`mx-auto mt-4 grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br ${bestStyle.gradient} p-5 text-white shadow-2xl ${bestStyle.glow}`}>
              {getKindIcon(best.kind)}
            </div>
            <p className="mt-4 text-xl font-black leading-tight text-white">{best.emoji} {cleanLabel(best.label) || best.label}</p>
          </motion.div>
        ) : (
          <div className="relative mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
            <div className="flex flex-wrap justify-center gap-1">
              {RARITY_ORDER.map((r) => counts[r] ? (
                <span key={r} className={`rounded-full border ${rarityStyle(r).border} ${rarityStyle(r).soft} px-2 py-0.5 text-[10px] font-black ${rarityStyle(r).text}`}>
                  {rarityStyle(r).label} ×{counts[r]}
                </span>
              ) : null)}
            </div>
            {revealDone && summary.kinds.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-center text-[10px] font-black tracking-[0.25em] text-white/60">TOTAL HADIAH</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4">
                  {summary.kinds.map((k) => (
                    <div key={k.kind} className="rounded-xl border border-white/10 bg-white/[0.05] p-2">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-white/70"><span className="text-sm">{k.emoji}</span><span className="truncate">{k.title}</span></div>
                      <div className="mt-0.5 text-[15px] font-black tabular-nums text-amber-200">{formatKindTotal(k)}</div>
                      <div className="text-[9px] font-semibold text-white/50">{k.hits.toLocaleString("id-ID")} hadiah</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className={`mt-3 grid gap-1.5 ${total > 50 ? "grid-cols-4 lg:grid-cols-8" : total > 12 ? "grid-cols-3 lg:grid-cols-6" : "grid-cols-2 lg:grid-cols-4"}`}>
              {gridItems.map((r, i) => {
                const s = rarityStyle(r.rarity);
                return (
                  <div key={i} className={`flex flex-col items-center rounded-xl border ${s.border} ${s.soft} p-2 text-center`}>
                    <div className={`${total > 50 ? "h-5 w-5" : "h-7 w-7"} ${s.text}`}>{getKindIcon(r.kind)}</div>
                    <div className={`mt-1 font-bold leading-tight text-white ${total > 50 ? "text-[8px]" : "text-[10px]"}`}>{cleanLabel(r.label) || r.label}</div>
                    <div className={`text-[7px] font-black tracking-wider ${s.text}`}>{s.label}</div>
                  </div>
                );
              })}
            </div>
            {visible.length > gridItems.length && (
              <button type="button" onClick={() => setGridLimit((n) => n + GRID_STEP)} className="mt-2 w-full rounded-xl border border-white/15 py-2 text-[11px] font-black text-white/80 hover:bg-white/5">
                Tampilkan {Math.min(GRID_STEP, visible.length - gridItems.length)} lagi ({gridItems.length}/{visible.length})
              </button>
            )}
          </div>
        )}

        <div className="relative mt-4 flex gap-2">
          {!revealDone && (
            <button type="button" onClick={onSkip} className="h-12 flex-1 rounded-2xl border border-white/15 text-[12px] font-black tracking-wider text-white/80 hover:bg-white/5">
              SKIP
            </button>
          )}
          <button type="button" onClick={onClose} disabled={!revealDone} className="royale-spin-btn h-12 flex-1 rounded-2xl text-[13px] font-black tracking-[0.2em]">
            CONTINUE
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
