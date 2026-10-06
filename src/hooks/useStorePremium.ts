import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PremiumInfo {
  isPremium: boolean;
  planName: string | null;
  expiresAt: string | null;
  daysLeft: number;
  isLocked: boolean;
  lockReason: string | null;
  lockedUntil: string | null;
}

const EMPTY: PremiumInfo = { isPremium: false, planName: null, expiresAt: null, daysLeft: 0, isLocked: false, lockReason: null, lockedUntil: null };

export function useStorePremium(visitorId: string | null | undefined) {
  const [info, setInfo] = useState<PremiumInfo>(EMPTY);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!visitorId) {
      setInfo(EMPTY);
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
          isLocked: !!row.is_locked,
          lockReason: row.lock_reason ?? null,
          lockedUntil: row.locked_until ?? null,
        });
      } else {
        setInfo(EMPTY);
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

// Konfigurasi benefit Premium dari admin (sumber: server, divalidasi ulang saat transaksi)
import { DEFAULT_PREMIUM_CONFIG, type PremiumBenefitConfig } from "@/components/premium/premiumBenefits";

let benefitCache: { at: number; cfg: PremiumBenefitConfig } | null = null;

export async function fetchPremiumBenefits(force = false): Promise<PremiumBenefitConfig> {
  if (!force && benefitCache && Date.now() - benefitCache.at < 60_000) return benefitCache.cfg;
  const { data, error } = await (supabase.rpc as any)("get_store_premium_benefits");
  if (error || !data) return benefitCache?.cfg ?? DEFAULT_PREMIUM_CONFIG;
  const cfg = { ...DEFAULT_PREMIUM_CONFIG, ...(data as Partial<PremiumBenefitConfig>) };
  benefitCache = { at: Date.now(), cfg };
  return cfg;
}

export function usePremiumBenefits() {
  const [cfg, setCfg] = useState<PremiumBenefitConfig>(benefitCache?.cfg ?? DEFAULT_PREMIUM_CONFIG);
  const reload = useCallback(async (force = false) => setCfg(await fetchPremiumBenefits(force)), []);
  useEffect(() => {
    reload();
    const on = () => reload(true);
    window.addEventListener("premium-benefits-updated", on);
    return () => window.removeEventListener("premium-benefits-updated", on);
  }, [reload]);
  return { cfg, reload };
}
