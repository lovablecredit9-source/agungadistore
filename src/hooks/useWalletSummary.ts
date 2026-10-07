import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface WalletSummary {
  gems: number;
  streakCoins: number;
  credits: number;
  unlimitedUntil: string | null;
  normalTickets: number;
  premiumTickets: number;
}

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

/** Events already dispatched elsewhere in the app after currency changes. */
const REFRESH_EVENTS = ["game-credits-refresh", "balance-updated", "power-ups-updated", "premium-benefits-updated"];

/**
 * Non-rupiah currencies of the active account, read with the same owner-scoped
 * queries/RPC the rest of the app uses (no new tables, no cross-user reads).
 */
export function useWalletSummary(visitorId: string | null | undefined) {
  const [data, setData] = useState<WalletSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!visitorId) { setData(null); return; }
    const my = ++seq.current;
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- get_account_gems/luck_spin_tickets are missing from generated types
    const db = supabase as any;
    const [gems, streak, credits, tickets] = await Promise.all([
      db.rpc("get_account_gems", { p_visitor_id: visitorId }),
      db.from("daily_streaks").select("streak_coins").eq("visitor_id", visitorId).maybeSingle(),
      db.from("user_game_credits").select("credits, unlimited_until").eq("visitor_id", visitorId).maybeSingle(),
      db.from("luck_spin_tickets").select("ticket_type, balance").eq("visitor_id", visitorId),
    ]);
    if (my !== seq.current) return;
    const t = (tickets.data || []) as { ticket_type: string; balance: number }[];
    const sum = (type: string) => t.filter((x) => x.ticket_type === type).reduce((a, b) => a + num(b.balance), 0);
    setData({
      gems: num(gems.data),
      streakCoins: num(streak.data?.streak_coins),
      credits: num(credits.data?.credits),
      unlimitedUntil: credits.data?.unlimited_until ?? null,
      normalTickets: sum("normal"),
      premiumTickets: sum("premium"),
    });
    setLoading(false);
  }, [visitorId]);

  useEffect(() => {
    void load();
    if (!visitorId) return;
    const onEvt = () => void load();
    const onVis = () => { if (document.visibilityState === "visible") void load(); };
    REFRESH_EVENTS.forEach((e) => window.addEventListener(e, onEvt));
    document.addEventListener("visibilitychange", onVis);
    // Realtime only where the app already subscribes (game credits); scoped to this account.
    const ch = supabase
      .channel(`wallet_summary_${visitorId}_${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_game_credits", filter: `visitor_id=eq.${visitorId}` }, onEvt)
      .subscribe();
    const poll = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 30000);
    return () => {
      REFRESH_EVENTS.forEach((e) => window.removeEventListener(e, onEvt));
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(poll);
      void supabase.removeChannel(ch);
    };
  }, [load, visitorId]);

  return { data, loading, reload: load };
}
