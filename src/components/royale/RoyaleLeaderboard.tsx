import { useEffect, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Row { rank: number; name: string; avatar_url: string | null; total_spin: number; total_win: number; jackpot: number; legendary: number; points: number; streak: number; is_me?: boolean }
const METRICS = [["points", "Royale Points"], ["win", "Total Win"], ["jackpot", "Jackpot"], ["spin", "Total Spin"], ["legendary", "Legendary"], ["streak", "Streak"]] as const;
const MEDAL = ["🥇", "🥈", "🥉"];

export default function RoyaleLeaderboard({ visitorId }: { visitorId: string | null }) {
  const [metric, setMetric] = useState<string>("points");
  const [data, setData] = useState<{ top: Row[]; me: Omit<Row, "name" | "avatar_url"> | null } | null>(null);
  useEffect(() => {
    let alive = true;
    setData(null);
    (supabase as any).rpc("royale_leaderboard", { p_metric: metric, p_limit: 20, p_visitor_id: visitorId }).then(({ data }: any) => alive && setData(data || { top: [], me: null }));
    return () => { alive = false; };
  }, [metric, visitorId]);
  const val = (r: { [k: string]: any }) => ({ points: r.points, win: r.total_win, jackpot: r.jackpot, spin: r.total_spin, legendary: r.legendary, streak: r.streak } as Record<string, number>)[metric];

  return (
    <div className="space-y-3">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {METRICS.map(([k, l]) => (
          <button key={k} onClick={() => setMetric(k)} className={`shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold ${metric === k ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      {!data && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>}
      {data && data.top.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Belum ada pemain.</p>}
      {data && data.top.length > 0 && (
        <>
          <div className="grid grid-cols-3 items-end gap-2">
            {[1, 0, 2].map((i) => {
              const r = data.top[i];
              if (!r) return <div key={i} />;
              return (
                <div key={i} className={`rounded-2xl border border-border bg-card/80 p-2 text-center ${i === 0 ? "pb-4 pt-3 ring-1 ring-primary/40" : ""}`}>
                  <div className="text-2xl">{MEDAL[i]}</div>
                  <p className="truncate text-xs font-bold text-foreground">{r.name}</p>
                  <p className="text-sm font-extrabold text-primary">{val(r).toLocaleString("id-ID")}</p>
                </div>
              );
            })}
          </div>
          <ol className="divide-y divide-border rounded-2xl border border-border bg-card/80">
            {data.top.slice(3).map((r) => (
              <li key={r.rank} className={`flex items-center gap-3 px-3 py-2 text-sm ${r.is_me ? "bg-primary/10" : ""}`}>
                <span className="w-6 text-center text-xs font-bold text-muted-foreground">{r.rank}</span>
                <span className="flex-1 truncate font-medium text-foreground">{r.name}{r.is_me ? " (kamu)" : ""}</span>
                <span className="font-bold text-primary">{val(r).toLocaleString("id-ID")}</span>
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
            <Trophy className="h-4 w-4 text-primary" />
            {data.me ? <span className="flex-1">Peringkat kamu: <strong>#{data.me.rank}</strong></span> : <span className="flex-1 text-muted-foreground">{visitorId ? "Kamu belum punya riwayat spin." : "Login saldo untuk melihat peringkat kamu."}</span>}
            {data.me && <strong className="text-primary">{val(data.me).toLocaleString("id-ID")}</strong>}
          </div>
        </>
      )}
    </div>
  );
}
