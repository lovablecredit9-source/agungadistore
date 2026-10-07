import { useCallback, useEffect, useState } from "react";
import { Inbox, MessageSquareWarning, Flame, Activity, Timer, Star, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Stats { new_today: number; unanswered: number; high_priority: number; active: number; avg_response_min: number | null; avg_rating: number | null }

/** Ringkasan Live Support + heartbeat agar pengguna melihat "Admin Online" selama dashboard terbuka. */
export default function AdminLiveSupportPanel({ filter, onFilter }: { filter: string; onFilter: (f: string) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);

  const load = useCallback(async () => {
    const { data } = await (supabase as any).rpc("ticket_support_stats");
    if (data) setStats(data as Stats);
  }, []);

  useEffect(() => {
    // Heartbeat admin kini global di AdminShell (useAdminHeartbeat) agar status benar di semua halaman admin.
    void load();
    const t2 = setInterval(() => { if (!document.hidden) void load(); }, 30_000);
    const ch = supabase.channel("admin-live-support")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "ticket_messages" }, () => load())
      .subscribe();
    return () => { clearInterval(t2); supabase.removeChannel(ch); };
  }, [load]);

  const cards = [
    { key: "new", icon: Inbox, label: "Tiket baru (24j)", value: stats?.new_today },
    { key: "unanswered", icon: MessageSquareWarning, label: "Belum dibalas", value: stats?.unanswered },
    { key: "high", icon: Flame, label: "Prioritas tinggi", value: stats?.high_priority },
    { key: "active", icon: Activity, label: "Chat aktif", value: stats?.active },
    { key: "", icon: Timer, label: "Rata-rata respon", value: stats?.avg_response_min != null ? `${stats.avg_response_min} mnt` : "–" },
    { key: "", icon: Star, label: "Rata-rata rating", value: stats?.avg_rating != null ? `${stats.avg_rating} ⭐` : "–" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold">Live Support</h3>
        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
          <Radio className="h-3 w-3" /> Kamu terlihat Online
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {cards.map((c, i) => (
          <button key={i} disabled={!c.key} onClick={() => c.key && onFilter(filter === c.key ? "all" : c.key)}
            className={`rounded-xl border p-2 text-left transition ${filter === c.key && c.key ? "border-primary bg-primary/10" : "border-border bg-card"} disabled:cursor-default`}>
            <c.icon className="h-4 w-4 text-primary" />
            <p className="mt-1 text-base font-extrabold leading-none">{c.value ?? "…"}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">{c.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
