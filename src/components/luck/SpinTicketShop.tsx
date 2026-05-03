import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Loader2, Gem } from "lucide-react";

export interface TicketPack {
  code: string;
  type: "normal" | "premium";
  tickets: number;
  cost_gems: number;
  original_gems: number;
  badge?: string;
}

interface Props {
  visitorId: string | null;
  type: "normal" | "premium";
  ticketBalance: number;
  packs: TicketPack[];
  rate: number; // gem per 1 ticket
  gems: number;
  useTickets: boolean;
  onToggleUseTickets: (v: boolean) => void;
  onPurchased: (data: { tickets: { normal: number; premium: number }; gems: number; luckyTokens?: number }) => void;
}

export default function SpinTicketShop({
  visitorId, type, ticketBalance, packs, rate, gems, useTickets, onToggleUseTickets, onPurchased,
}: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const filtered = packs.filter((p) => p.type === type);
  const isPremium = type === "premium";

  const convertRate = isPremium ? 3 : 5; // tiket per 1 Lucky Token
  const convertable = Math.floor(ticketBalance / convertRate) * convertRate;
  const tokensFromConvert = Math.floor(ticketBalance / convertRate);

  const buy = async (code: string) => {
    if (!visitorId || busy) return;
    setBusy(code);
    try {
      const { data, error } = await supabase.functions.invoke("luck-royale-nyawa", {
        body: { visitorId, action: "buy_tickets", packCode: code },
      });
      if (error || (data as any)?.error) {
        toast({ title: "Gagal beli", description: (data as any)?.error || error?.message || "Coba lagi", variant: "destructive" });
        return;
      }
      const d = data as any;
      toast({ title: "🎟️ Tiket bertambah!", description: `+${d.purchased} tiket ${type === "premium" ? "Premium" : "Normal"}` });
      onPurchased({ tickets: d.tickets, gems: d.gems });
    } finally {
      setBusy(null);
    }
  };

  const convert = async () => {
    if (!visitorId || busy || convertable < convertRate) return;
    setBusy("convert");
    try {
      const { data, error } = await supabase.functions.invoke("luck-royale-nyawa", {
        body: { visitorId, action: "convert_tickets", ticketType: type, amount: convertable },
      });
      if (error || (data as any)?.error) {
        toast({ title: "Gagal tukar", description: (data as any)?.error || error?.message || "Coba lagi", variant: "destructive" });
        return;
      }
      const d = data as any;
      toast({ title: "✨ Berhasil ditukar!", description: `${d.converted} tiket → +${d.gained} Lucky Token` });
      onPurchased({ tickets: d.tickets, gems });
    } finally {
      setBusy(null);
    }
  };

  const accent = isPremium
    ? "from-fuchsia-700/30 via-purple-700/30 to-amber-600/30 border-fuchsia-400/50"
    : "from-cyan-700/30 via-blue-700/30 to-indigo-700/30 border-cyan-400/50";

  return (
    <div className={`rounded-xl bg-gradient-to-br ${accent} border-2 p-3 space-y-2`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Ticket className={`w-4 h-4 ${isPremium ? "text-fuchsia-200" : "text-cyan-200"}`} />
          <h3 className="text-[12px] font-black tracking-wide text-white">
            TIKET SPIN {isPremium ? "PREMIUM" : "NORMAL"}
          </h3>
          <Badge className={`text-[9px] h-4 px-1.5 ${isPremium ? "bg-fuchsia-500/40 text-fuchsia-100" : "bg-cyan-500/40 text-cyan-100"} border-0`}>
            1 Tiket = {rate} 💎
          </Badge>
        </div>
        <div className="text-[11px] font-black text-white flex items-center gap-1">
          <Ticket className="w-3 h-3" /> {ticketBalance}
        </div>
      </div>

      <label className="flex items-center gap-2 text-[10px] text-white/85 bg-black/30 rounded-lg px-2 py-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={useTickets}
          onChange={(e) => onToggleUseTickets(e.target.checked)}
          className="accent-fuchsia-500"
        />
        <span className="font-bold">
          Pakai tiket saat spin {isPremium ? "Premium" : "Normal"} (otomatis kombinasi tiket + gem)
        </span>
      </label>

      <button
        disabled={convertable < convertRate || busy === "convert"}
        onClick={convert}
        className="w-full rounded-lg bg-gradient-to-r from-amber-600/40 to-yellow-500/40 border border-amber-300/50 px-2 py-1.5 text-[10px] font-black text-amber-100 hover:from-amber-600/60 hover:to-yellow-500/60 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
        title={`Tukar ${convertRate} tiket ${type} = 1 Lucky Token`}
      >
        {busy === "convert" ? <Loader2 className="w-3 h-3 animate-spin" /> : (
          <>🎟️→🪙 Tukar Lucky Token ({convertRate} tiket = 1 LT){convertable >= convertRate && <span className="ml-1 bg-amber-900/60 px-1.5 py-0.5 rounded">{convertable}→+{tokensFromConvert}</span>}</>
        )}
      </button>

      <div className="grid grid-cols-3 gap-1.5">
        {filtered.map((p) => {
          const discount = p.original_gems - p.cost_gems;
          return (
            <button
              key={p.code}
              disabled={busy === p.code || gems < p.cost_gems}
              onClick={() => buy(p.code)}
              className="rounded-lg bg-black/40 border border-white/15 p-1.5 text-center hover:border-white/40 disabled:opacity-50 transition-all"
            >
              <div className="text-[10px] font-black text-white">+{p.tickets} 🎟️</div>
              {discount > 0 && (
                <div className="text-[8px] text-white/50 line-through">{p.original_gems} 💎</div>
              )}
              <div className="text-[10px] font-black text-amber-200 flex items-center justify-center gap-0.5">
                <Gem className="w-2.5 h-2.5" /> {p.cost_gems}
              </div>
              {p.badge && (
                <div className={`text-[7px] font-black mt-0.5 ${isPremium ? "text-fuchsia-300" : "text-cyan-300"}`}>
                  {p.badge}
                </div>
              )}
              {busy === p.code && <Loader2 className="w-3 h-3 mx-auto animate-spin text-white" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
