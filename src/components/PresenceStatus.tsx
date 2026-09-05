import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function relative(ts: string | null): string {
  if (!ts) return "Terakhir dilihat: belum diketahui";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return "🟢 Online sekarang";
  if (m < 60) return `Terakhir dilihat ${m} menit lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Terakhir dilihat ${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `Terakhir dilihat ${d} hari lalu`;
  return `Terakhir dilihat ${new Date(ts).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}`;
}

/** Menampilkan status "terakhir dilihat" admin (target="admin") atau pengunjung (target=visitorId). */
export default function PresenceStatus({
  target,
  className = "text-[10px] text-muted-foreground",
  prefix = "",
}: { target: "admin" | { visitorId: string }; className?: string; prefix?: string }) {
  const [ts, setTs] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    async function fetchTs() {
      if (target === "admin") {
        const { data } = await supabase
          .from("admin_settings")
          .select("setting_value")
          .eq("setting_key", "admin_last_active")
          .maybeSingle();
        if (alive) setTs((data as any)?.setting_value || null);
      } else {
        const { data } = await supabase
          .from("user_balances")
          .select("last_seen_at")
          .eq("visitor_id", target.visitorId)
          .order("last_seen_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (alive) setTs((data as any)?.last_seen_at || null);
      }
    }
    fetchTs();
    const id = setInterval(() => { fetchTs(); setTick((t) => t + 1); }, 30000);
    return () => { alive = false; clearInterval(id); };
  }, [typeof target === "string" ? target : target.visitorId]);

  return <p className={className} key={tick}>{prefix}{relative(ts)}</p>;
}
