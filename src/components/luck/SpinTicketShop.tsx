import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Loader2 } from "lucide-react";

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
  packs?: TicketPack[];
  rate?: number;
  gems?: number;
  useTickets: boolean;
  onToggleUseTickets: (v: boolean) => void;
  onPurchased: (data: { tickets: { normal: number; premium: number }; gems: number; luckyTokens?: number }) => void;
}

// Tiket = 1:1 spin (1 tiket = 1 spin). Tidak dijual — hanya didapat dari hadiah spin.
// Bisa ditukar jadi Lucky Token untuk Token Shop (5 Normal = 1 LT, 3 Premium = 1 LT).
export default function SpinTicketShop({
  visitorId, type, ticketBalance, useTickets, onToggleUseTickets, onPurchased,
}: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const isPremium = type === "premium";
  const convertRate = isPremium ? 3 : 5;
  const convertable = Math.floor(ticketBalance / convertRate) * convertRate;
  const tokensFromConvert = Math.floor(ticketBalance / convertRate);

  const convert = async () => {
    if (!visitorId || busy || convertable < convertRate) return;
    setBusy(true);
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
      onPurchased({ tickets: d.tickets, gems: 0, luckyTokens: d.luckyTokens });
    } finally {
      setBusy(false);
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
            🎫 TIKET SPIN {isPremium ? "PREMIUM" : "NORMAL"}
          </h3>
          <Badge className={`text-[9px] h-4 px-1.5 ${isPremium ? "bg-fuchsia-500/40 text-fuchsia-100" : "bg-cyan-500/40 text-cyan-100"} border-0`}>
            1 Tiket = 1 Spin
          </Badge>
        </div>
        <div className="text-[12px] font-black text-white flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-md">
          <Ticket className="w-3 h-3" /> {ticketBalance}
        </div>
      </div>

      <div className="text-[10px] text-white/70 leading-relaxed">
        Tiket hanya bisa didapat dari hadiah spin. Saat aktif, tiap spin akan otomatis pakai 1 tiket sebelum potong gem (5 spin & punya 5 tiket = 0 gem).
      </div>

      <label className="flex items-center gap-2 text-[10px] text-white/85 bg-black/30 rounded-lg px-2 py-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={useTickets}
          onChange={(e) => onToggleUseTickets(e.target.checked)}
          className="accent-fuchsia-500"
        />
        <span className="font-bold">
          Pakai tiket saat spin {isPremium ? "Premium" : "Normal"} (1 tiket = 1 spin)
        </span>
      </label>

      <button
        disabled={convertable < convertRate || busy}
        onClick={convert}
        className="w-full rounded-lg bg-gradient-to-r from-amber-600/40 to-yellow-500/40 border border-amber-300/50 px-2 py-1.5 text-[10px] font-black text-amber-100 hover:from-amber-600/60 hover:to-yellow-500/60 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
        title={`Tukar ${convertRate} tiket ${type} = 1 Lucky Token`}
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : (
          <>🎫 → 🪙 Tukar Lucky Token ({convertRate} tiket = 1 LT)
            {convertable >= convertRate && (
              <span className="ml-1 bg-amber-900/60 px-1.5 py-0.5 rounded">{convertable}→+{tokensFromConvert}</span>
            )}
          </>
        )}
      </button>
    </div>
  );
}
