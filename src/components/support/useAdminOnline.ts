import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Admin dianggap online bila dashboard admin aktif dalam 3 menit terakhir (dicek tiap 60 detik). */
export function useAdminOnline() {
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await (supabase as any).rpc("support_admin_online");
      if (alive) setOnline(!!data);
    };
    void load();
    const t = setInterval(() => { if (!document.hidden) void load(); }, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return online;
}
