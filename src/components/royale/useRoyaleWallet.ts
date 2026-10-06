import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RoyaleWallet { gems: number; coins: number; normalTickets: number; premiumTickets: number; streak: number; level: number; xp: number }

export function getRoyaleVisitorId(): string | null {
  try {
    return localStorage.getItem("balance_logged_in") === "true" ? localStorage.getItem("balance_visitor_id") : null;
  } catch { return null; }
}

/** Saldo Royale dibaca dari database (Gem, Koin Streak, Tiket Spin, Streak, Level). */
export function useRoyaleWallet(visitorId: string | null) {
  const [wallet, setWallet] = useState<RoyaleWallet | null>(null);
  const load = useCallback(async () => {
    if (!visitorId) { setWallet(null); return; }
    const db = supabase as any;
    const [gems, streak, tickets, prog] = await Promise.all([
      db.rpc("get_account_gems", { p_visitor_id: visitorId }),
      db.from("daily_streaks").select("streak_coins, current_streak").eq("visitor_id", visitorId).maybeSingle(),
      db.from("luck_spin_tickets").select("ticket_type, balance").eq("visitor_id", visitorId),
      db.from("profile_progression").select("level, xp").eq("visitor_id", visitorId).maybeSingle(),
    ]);
    const t = (tickets.data || []) as { ticket_type: string; balance: number }[];
    setWallet({
      gems: Number(gems.data) || 0,
      coins: streak.data?.streak_coins || 0,
      streak: streak.data?.current_streak || 0,
      normalTickets: t.filter((x) => x.ticket_type === "normal").reduce((a, b) => a + (b.balance || 0), 0),
      premiumTickets: t.filter((x) => x.ticket_type === "premium").reduce((a, b) => a + (b.balance || 0), 0),
      level: prog.data?.level || 1,
      xp: prog.data?.xp || 0,
    });
  }, [visitorId]);
  useEffect(() => { void load(); }, [load]);
  return { wallet, reload: load };
}
