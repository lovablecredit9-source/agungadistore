import { useState } from "react";
import { getKindIcon, rarityStyle } from "./theme";

export interface RoyaleHistoryItem { id: string; reward_label: string; rarity: string; reward_kind: string; created_at: string }

export default function RoyaleHistory({ history }: { history: RoyaleHistoryItem[] }) {
  const [all, setAll] = useState(false);
  if (history.length === 0) {
    return <p className="py-4 text-center text-[11px] text-white/45">Belum ada spin. Hasil spin terbaru akan muncul di sini.</p>;
  }
  const list = all ? history : history.slice(0, 5);
  return (
    <div className="space-y-1.5">
      {list.map((h) => {
        const s = rarityStyle(h.rarity);
        return (
          <div key={h.id} className={`flex items-center gap-2.5 rounded-xl border ${s.border} ${s.soft} px-2.5 py-2`}>
            <div className={`h-5 w-5 shrink-0 ${s.text}`}>{getKindIcon(h.reward_kind)}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-bold text-white">{h.reward_label}</div>
              <div className="text-[9px] text-white/40">
                {new Date(h.created_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} WIB
              </div>
            </div>
            <span className={`shrink-0 text-[9px] font-black tracking-wider ${s.text}`}>{s.label}</span>
          </div>
        );
      })}
      {history.length > 5 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="h-10 w-full rounded-xl border border-white/10 text-[11px] font-black tracking-wider text-white/70 hover:bg-white/5">
          {all ? "Sembunyikan" : `View All (${history.length})`}
        </button>
      )}
    </div>
  );
}
