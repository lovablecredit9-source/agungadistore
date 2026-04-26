import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Sparkles } from "lucide-react";
import CountUp from "@/components/CountUp";

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
  const isHot = amount > 0;
  return (
    <div
      className="relative inline-flex items-center gap-2 rounded-full p-[1.5px] aurora-shift overflow-hidden"
      style={{
        background: isHot
          ? "linear-gradient(135deg, hsl(45 95% 55%/0.95), hsl(330 90% 60%/0.95), hsl(280 90% 65%/0.95), hsl(45 95% 55%/0.95))"
          : "linear-gradient(135deg, hsl(150 60% 45%/0.6), hsl(190 80% 50%/0.6), hsl(150 60% 45%/0.6))",
        backgroundSize: "300% 300%",
      }}
    >
      <div className="relative flex items-center gap-2 rounded-full bg-card/95 backdrop-blur-md pl-1 pr-3 py-1">
        <div className="relative">
          {isHot && (
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-500 blur-md opacity-70 animate-pulse" />
          )}
          <div className={`relative flex h-6 w-6 items-center justify-center rounded-full shadow-lg ${isHot ? "bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-500" : "bg-gradient-to-br from-emerald-500 to-cyan-500"}`}>
            <Wallet className="w-3.5 h-3.5 text-white" strokeWidth={2.4} />
          </div>
        </div>
        <span className={`text-[10px] font-extrabold uppercase tracking-wider bg-clip-text text-transparent ${isHot ? "bg-gradient-to-r from-yellow-500 via-pink-500 to-purple-500" : "bg-gradient-to-r from-emerald-500 to-cyan-500"}`}>
          Saldo IN
        </span>
        <span className={`text-xs font-extrabold tabular-nums bg-clip-text text-transparent ${isHot ? "bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-500" : "bg-gradient-to-r from-emerald-600 to-cyan-600"}`}>
          <CountUp value={amount} format={(n) => formatPrice(n)} />
        </span>
        {isHot && <Sparkles className="w-3 h-3 text-yellow-500 animate-pulse" />}
      </div>
    </div>
  );
}
