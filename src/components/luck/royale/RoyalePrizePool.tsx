import { useState } from "react";
import { cleanLabel, getKindIcon, rarityStyle, RARITY_RANK } from "./theme";

export interface PoolPrize { kind: string; value: number; label: string; emoji: string; rarity: string; weight?: number }

interface Props {
  prizes: PoolPrize[];
  chanceOf: (p: PoolPrize) => number;
  rarityRates?: Record<string, number> | null;
}

const ORDER = ["common", "rare", "epic", "legendary", "mythic"] as const;

export default function RoyalePrizePool({ prizes, chanceOf, rarityRates }: Props) {
  const [showAll, setShowAll] = useState(false);
  const sorted = [...prizes].sort((a, b) => (RARITY_RANK[a.rarity] || 0) - (RARITY_RANK[b.rarity] || 0) || chanceOf(b) - chanceOf(a));
  const list = showAll ? sorted : sorted.slice(0, 8);
  return (
    <div className="space-y-3">
      {rarityRates && (
        <div className="grid grid-cols-5 gap-1">
          {ORDER.map((r) => {
            const s = rarityStyle(r);
            return (
              <div key={r} className={`rounded-lg border ${s.border} ${s.soft} px-1 py-1.5 text-center ${r === "mythic" ? "royale-mythic-glow" : ""}`}>
                <div className={`truncate text-[8px] font-black tracking-wider ${s.text}`}>{s.label}</div>
                <div className="text-[11px] font-black tabular-nums text-white">{Number(((rarityRates[r] || 0) * 100).toFixed(1))}%</div>
              </div>
            );
          })}
        </div>
      )}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        {list.map((p, i) => {
          const s = rarityStyle(p.rarity);
          const chance = chanceOf(p);
          return (
            <div key={`${p.kind}-${p.value}-${i}`} className={`flex min-w-0 items-center gap-2 rounded-xl border ${s.border} ${s.soft} p-2`}>
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br ${s.gradient} p-1.5 text-white`}>
                {getKindIcon(p.kind)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-bold text-white">{cleanLabel(p.label) || p.label}</div>
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-[8px] font-black tracking-wider ${s.text}`}>{s.label}</span>
                  <span className="text-[9px] tabular-nums text-white/50">{chance < 0.1 ? "<0.1" : chance.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {sorted.length > 8 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="h-10 w-full rounded-xl border border-white/10 text-[11px] font-black tracking-wider text-white/70 hover:bg-white/5">
          {showAll ? "Tampilkan lebih sedikit" : `Lihat semua hadiah (${sorted.length})`}
        </button>
      )}
      <p className="text-center text-[10px] text-white/40">Peluang dihitung dari konfigurasi server · makin kecil %, makin langka</p>
    </div>
  );
}
