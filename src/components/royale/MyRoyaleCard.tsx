import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { rarityStyle } from "./rarity";

export interface RoyaleSummary {
  stats: { total_spin: number; total_win: number; jackpot: number; legendary: number; epic: number; points: number };
  favorite: string | null;
  streak: number;
  history: { source: string; label: string | null; value: number; rarity: string; jackpot: boolean; created_at: string }[];
}

/** Badge dihitung dari riwayat spin di server. */
export function royaleBadges(s: RoyaleSummary["stats"]) {
  return [
    { key: "beginner", label: "Lucky Beginner", emoji: "🍀", got: s.total_spin >= 1, need: "1 spin" },
    { key: "master", label: "Spin Master", emoji: "🌀", got: s.total_spin >= 500, need: "500 spin" },
    { key: "jackpot", label: "Jackpot Hunter", emoji: "🎰", got: s.jackpot >= 1, need: "1 jackpot" },
    { key: "legend", label: "Legendary Hunter", emoji: "🐉", got: s.legendary >= 10, need: "10 legendary" },
    { key: "champ", label: "Royale Champion", emoji: "👑", got: s.points >= 10000, need: "10.000 poin" },
  ];
}

const SOURCE: Record<string, string> = { royale: "Lucky Royale", diamond: "Diamond Royale", lucky_draw: "Lucky Draw", lucky_wheel: "Lucky Wheel" };

export function useRoyaleSummary(visitorId: string | null, limit = 30) {
  const [data, setData] = useState<RoyaleSummary | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!visitorId) { setData(null); return; }
    let alive = true;
    setLoading(true);
    (supabase as any).rpc("royale_my_summary", { p_visitor_id: visitorId, p_limit: limit }).then(({ data }: any) => {
      if (alive) { setData(data?.stats ? data : null); setLoading(false); }
    });
    return () => { alive = false; };
  }, [visitorId, limit]);
  return { data, loading };
}

export default function MyRoyaleCard({ visitorId, level, xp }: { visitorId: string | null; level?: number; xp?: number }) {
  const { data, loading } = useRoyaleSummary(visitorId, 1);
  if (!visitorId) return null;
  if (loading || !data) return <div className="flex justify-center rounded-2xl border border-border bg-card/80 p-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  const s = data.stats;
  const items = [
    ["Level", level ?? "–"], ["XP", (xp ?? 0).toLocaleString("id-ID")], ["Total Spin", s.total_spin.toLocaleString("id-ID")],
    ["Total Win", s.total_win.toLocaleString("id-ID")], ["Jackpot", s.jackpot.toLocaleString("id-ID")], ["Legendary", s.legendary.toLocaleString("id-ID")],
    ["Royale Points", s.points.toLocaleString("id-ID")], ["Streak", `${data.streak} hari`],
  ];
  return (
    <section aria-label="My Royale" className="rounded-2xl border border-border bg-card/80 p-3 backdrop-blur-md">
      <h3 className="mb-2 text-sm font-extrabold text-foreground">👑 My Royale</h3>
      <div className="grid grid-cols-4 gap-2">
        {items.map(([l, v]) => (
          <div key={l as string} className="rounded-xl bg-muted/60 p-2 text-center">
            <p className="text-sm font-extrabold text-foreground">{v as any}</p>
            <p className="text-[9.5px] text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
      {data.favorite && <p className="mt-2 text-[11px] text-muted-foreground">Hadiah favorit: <strong className="text-foreground">{data.favorite}</strong></p>}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {royaleBadges(s).map((b) => (
          <span key={b.key} title={b.got ? "Didapat" : `Butuh ${b.need}`}
            className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${b.got ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground opacity-60"}`}>
            {b.emoji} {b.label}
          </span>
        ))}
      </div>
    </section>
  );
}

export function RoyaleHistoryList({ visitorId }: { visitorId: string | null }) {
  const { data, loading } = useRoyaleSummary(visitorId, 50);
  if (!visitorId) return <p className="py-8 text-center text-sm text-muted-foreground">Login saldo untuk melihat riwayat.</p>;
  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  if (!data || data.history.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Belum ada riwayat spin.</p>;
  return (
    <ul className="divide-y divide-border rounded-2xl border border-border bg-card/80">
      {data.history.map((h, i) => {
        const r = rarityStyle(h.jackpot ? "jackpot" : h.rarity);
        return (
          <li key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className={`rounded-md px-1.5 py-0.5 text-[9.5px] font-black uppercase ${r.badge}`}>{r.label}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-foreground">{h.label || "Hadiah"}</span>
              <span className="block text-[10px] text-muted-foreground">{SOURCE[h.source] || h.source} · {new Date(h.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
