import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet } from "lucide-react";

function formatPrice(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
}

// Event name for cross-component refresh trigger
const GAME_BALANCE_REFRESH_EVENT = "game-balance-refresh";

export function triggerGameBalanceRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(GAME_BALANCE_REFRESH_EVENT));
  }
}

export function useGameBalance(visitorId: string | null) {
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchBalance = useCallback(async () => {
    if (!visitorId) { setAmount(0); return; }
    setLoading(true);
    const { data } = await supabase
      .from("game_balance" as any)
      .select("amount")
      .eq("visitor_id", visitorId)
      .maybeSingle();
    setAmount(((data as any)?.amount as number) || 0);
    setLoading(false);
  }, [visitorId]);

  useEffect(() => { fetchBalance(); }, [fetchBalance]);

  // Listen to manual triggers (after slot/lucky-draw wins, purchases, etc.)
  useEffect(() => {
    const handler = () => fetchBalance();
    window.addEventListener(GAME_BALANCE_REFRESH_EVENT, handler);
    return () => window.removeEventListener(GAME_BALANCE_REFRESH_EVENT, handler);
  }, [fetchBalance]);

  // Realtime subscription so Saldo IN auto-updates when DB changes
  useEffect(() => {
    if (!visitorId) return;
    const channel = supabase
      .channel(`game_balance_${visitorId}_${Math.random().toString(36).slice(2, 10)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_balance", filter: `visitor_id=eq.${visitorId}` },
        () => fetchBalance(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [visitorId, fetchBalance]);

  return { amount, loading, fetchBalance };
}

export function GameBalanceBadge({ amount }: { amount: number }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-foreground">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
        <Wallet className="w-3.5 h-3.5" strokeWidth={1.8} />
      </div>
      <span className="text-[10px] font-semibold uppercase text-muted-foreground">Saldo IN</span>
      <span className="text-xs font-semibold tabular-nums">{formatPrice(amount)}</span>
    </div>
  );
}
