import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Admin dianggap online bila dashboard admin aktif dalam 3 menit terakhir (dicek tiap 60 detik). */
export function useAdminOnline() {
  return useAdminPresence().online;
}

/** Status online + waktu terakhir dilihat admin dari heartbeat server (bukan jam perangkat). */
export function useAdminPresence() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [on, ls] = await Promise.all([
        (supabase as any).rpc("support_admin_online"),
        (supabase as any).rpc("support_admin_last_seen"),
      ]);
      if (!alive) return;
      setOnline(!!on.data);
      setLastSeen((ls.data as string) || null);
    };
    void load();
    const t = setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return { online, lastSeen };
}

/** "2 menit lalu", "hari ini 10:24", "kemarin 21:05", atau tanggal. */
export function formatLastSeen(iso: string | null, now = new Date()): string {
  if (!iso) return "belum pernah aktif";
  const d = new Date(iso);
  const diff = Math.max(0, now.getTime() - d.getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const hm = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((day(now) - day(d)) / 86_400_000);
  if (days === 0) return `hari ini ${hm}`;
  if (days === 1) return `kemarin ${hm}`;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) + ` ${hm}`;
}
