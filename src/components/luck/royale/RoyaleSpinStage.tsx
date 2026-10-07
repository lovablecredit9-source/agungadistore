import { Sparkles } from "lucide-react";
import { rarityStyle } from "./theme";

interface StagePrize { emoji: string; rarity: string; label: string }

interface Props {
  prizes: StagePrize[];
  featured: StagePrize[];
  spinning: boolean;
}

/** Visual only — the result always comes from the server response. */
export default function RoyaleSpinStage({ prizes, featured, spinning }: Props) {
  const strip = prizes.length ? [...prizes, ...prizes].slice(0, 24) : [];
  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-sm overflow-hidden rounded-2xl border border-white/[0.07] bg-black/40">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,hsl(270_85%_60%/0.28),transparent_62%)]" />
      <div aria-hidden className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle,white_0.6px,transparent_1px)] [background-size:18px_18px]" />

      {spinning ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="relative w-full overflow-hidden py-2">
            <div className="royale-reel-track flex w-max gap-2 px-2">
              {[...strip, ...strip].map((p, i) => {
                const s = rarityStyle(p.rarity);
                return (
                  <div key={i} className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${s.gradient} ring-1 ${s.ring} text-2xl`}>
                    {p.emoji}
                  </div>
                );
              })}
            </div>
            <div aria-hidden className="absolute inset-y-0 left-1/2 w-[62px] -translate-x-1/2 rounded-xl border-2 border-amber-300/80 shadow-[0_0_24px_hsl(42_96%_62%/0.6)]" />
            <div aria-hidden className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-black/80 to-transparent" />
            <div aria-hidden className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-black/80 to-transparent" />
          </div>
          <p className="text-[11px] font-black tracking-[0.35em] text-amber-200/90">ROLLING…</p>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
          <div className="relative">
            <div aria-hidden className="royale-orb-ring absolute -inset-5 rounded-full border border-dashed border-amber-300/25" />
            <div aria-hidden className="absolute inset-0 scale-150 rounded-full bg-amber-400/25 blur-2xl" />
            <div className="relative grid h-24 w-24 place-items-center rounded-full bg-gradient-to-b from-amber-200 via-amber-500 to-orange-700 text-4xl shadow-[0_10px_40px_-8px_hsl(30_95%_55%/0.8)] ring-4 ring-amber-200/30">
              👑
            </div>
            <Sparkles className="absolute -right-2 -top-1 h-5 w-5 text-amber-100/90" />
          </div>
          <p className="mt-5 text-[12px] font-black tracking-[0.35em] text-amber-100">✨ YOUR LUCK ✨</p>
          <div className="mt-3 flex items-center gap-1.5">
            {featured.slice(0, 5).map((p, i) => {
              const s = rarityStyle(p.rarity);
              return (
                <div key={i} title={p.label} className={`grid h-8 w-8 place-items-center rounded-lg border ${s.border} ${s.soft} text-base`}>
                  {p.emoji}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
