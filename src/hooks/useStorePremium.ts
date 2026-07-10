import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PremiumInfo {
  isPremium: boolean;
  planName: string | null;
  expiresAt: string | null;
  daysLeft: number;
}

export function useStorePremium(visitorId: string | null | undefined) {
  const [info, setInfo] = useState<PremiumInfo>({ isPremium: false, planName: null, expiresAt: null, daysLeft: 0 });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!visitorId) {
      setInfo({ isPremium: false, planName: null, expiresAt: null, daysLeft: 0 });
      return;
    }
    setLoading(true);
    try {
      const { data } = await (supabase.rpc as any)("get_store_premium_info", { p_visitor_id: visitorId });
      const row = Array.isArray(data) ? data[0] : data;
      if (row) {
        setInfo({
          isPremium: !!row.is_premium,
          planName: row.plan_name ?? null,
          expiresAt: row.expires_at ?? null,
          daysLeft: row.days_left ?? 0,
        });
      } else {
        setInfo({ isPremium: false, planName: null, expiresAt: null, daysLeft: 0 });
      }
    } finally {
      setLoading(false);
    }
  }, [visitorId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refresh juga saat ada sinyal dari notifikasi/admin, saat tab kembali aktif,
  // atau saat akun saldo berubah. Ini membuat premium dari admin langsung terbaca
  // tanpa menunggu user reload halaman.
  useEffect(() => {
    if (!visitorId) return;
    const onRefresh = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("refresh-store-premium", onRefresh);
    window.addEventListener("balance-auth-changed", onRefresh);
    window.addEventListener("focus", onRefresh);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener("refresh-store-premium", onRefresh);
      window.removeEventListener("balance-auth-changed", onRefresh);
      window.removeEventListener("focus", onRefresh);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [visitorId, refresh]);

  // Realtime: refresh ketika subscription berubah
  useEffect(() => {
    if (!visitorId) return;
    const ch = supabase
      .channel(`premium-${visitorId}-${Math.random().toString(36).slice(2, 10)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "store_premium_subscriptions" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [visitorId, refresh]);

  return { ...info, loading, refresh };
}

// Cek premium berdasarkan visitor_id (untuk admin/list)
export async function checkVisitorPremium(visitorId: string): Promise<boolean> {
  if (!visitorId) return false;
  const { data } = await (supabase.rpc as any)("is_store_premium", { p_visitor_id: visitorId });
  return !!data;
}
