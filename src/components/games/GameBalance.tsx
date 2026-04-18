import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet } from "lucide-react";

function formatPrice(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(n);
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

  return { amount, loading, fetchBalance };
}

export function GameBalanceBadge({ amount }: { amount: number }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1.5 text-white shadow-md">
      <Wallet className="w-3.5 h-3.5" />
      <span className="text-[10px] font-bold uppercase opacity-90">Saldo IN</span>
      <span className="text-xs font-extrabold">{formatPrice(amount)}</span>
    </div>
  );
}
