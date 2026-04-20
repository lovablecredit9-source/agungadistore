import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";

export interface BanInfo {
  id: string;
  reason: string;
  is_permanent: boolean;
  banned_until: string | null;
  banned_by: string;
  created_at: string;
}

export function useAccountBan() {
  const [banned, setBanned] = useState(false);
  const [info, setInfo] = useState<BanInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const channelNameRef = useRef(`account_bans_changes_${crypto.randomUUID()}`);

  const refresh = useCallback(async () => {
    const visitor_id = getVisitorId();
    const { data } = await supabase.rpc("get_account_ban_info", { p_visitor_id: visitor_id });
    const row = Array.isArray(data) && data.length > 0 ? (data[0] as BanInfo) : null;
    setInfo(row);
    setBanned(!!row);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();

    const channel = supabase
      .channel(channelNameRef.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "account_bans" }, () => {
        refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { banned, info, loading, refresh };
}

export function formatBanRemaining(info: BanInfo | null): string {
  if (!info) return "";
  if (info.is_permanent) return "Permanen";
  if (!info.banned_until) return "";
  const ms = new Date(info.banned_until).getTime() - Date.now();
  if (ms <= 0) return "Berakhir";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days > 0) return `${days} hari ${hours} jam lagi`;
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hours} jam ${mins} menit lagi`;
}
