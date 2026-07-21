import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Ticket, Gift, History } from "lucide-react";
import { getVisitorId } from "@/lib/visitor-id";

const REWARD_LABELS: Record<string, string> = {
  gems: "💎 Gem",
  streak_coins: "🪙 Koin Streak",
  credits: "🎮 Kredit",
  hints: "💡 Hint",
  streak_freeze: "🧊 Streak Freeze",
  time_freeze: "⏱️ Time Freeze",
  extra_life: "❤️ Extra Life",
  saldo: "💰 Saldo IN",
};

interface ClaimHistory {
  id: string;
  voucher_code: string;
  reward_type: string;
  reward_amount: number;
  claimed_at: string;
  voucher_name?: string | null;
}

export default function StreakVoucherClaim() {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [history, setHistory] = useState<ClaimHistory[]>([]);
  const visitorId = getVisitorId();

  const load = async () => {
    const { data: claims } = await supabase
      .from("streak_voucher_claims")
      .select("id, voucher_code, reward_type, reward_amount, claimed_at, streak_vouchers(name)")
      .eq("visitor_id", visitorId)
      .order("claimed_at", { ascending: false })
      .limit(50);
    setHistory((claims || []).map((c: any) => ({
      id: c.id,
      voucher_code: c.voucher_code,
      reward_type: c.reward_type,
      reward_amount: c.reward_amount,
      claimed_at: c.claimed_at,
      voucher_name: c.streak_vouchers?.name,
    })));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("streak-voucher-claims-self")
      .on("postgres_changes", { event: "*", schema: "public", table: "streak_voucher_claims", filter: `visitor_id=eq.${visitorId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [visitorId]);

  const claim = async (voucherCode: string) => {
    if (!voucherCode.trim()) {
      toast({ title: "Masukkan kode voucher", variant: "destructive" });
      return;
    }
    const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
    const restoreScroll = () => {
      if (typeof window === "undefined") return;
      requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: "auto" }));
      setTimeout(() => window.scrollTo({ top: scrollY, behavior: "auto" }), 60);
      setTimeout(() => window.scrollTo({ top: scrollY, behavior: "auto" }), 200);
    };
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("claim-streak-voucher", {
        body: { visitorId, code: voucherCode.trim() },
      });
      const errMsg: string = (data as any)?.error || error?.message || "";
      if (errMsg) {
        const lower = errMsg.toLowerCase();
        if (lower.includes("sudah pernah klaim") || lower.includes("1 akun = 1 kali")) {
          toast({ title: "ℹ️ Sudah diklaim", description: "Akun ini sudah pernah klaim voucher tersebut. 1 akun hanya bisa klaim 1 kali." });
          await load();
          restoreScroll();
          return;
        }
        if (lower.includes("kuota")) {
          toast({ title: "😔 Kuota habis", description: "Voucher ini sudah mencapai batas klaim maksimal." });
          await load();
          restoreScroll();
          return;
        }
        if (lower.includes("kedaluwarsa") || lower.includes("belum mulai")) {
          toast({ title: "⏰ Voucher tidak berlaku", description: errMsg });
          return;
        }
        if (lower.includes("tidak ditemukan")) {
          toast({ title: "❌ Kode salah", description: "Kode voucher tidak ditemukan. Periksa kembali." });
          return;
        }
        toast({ title: "Gagal klaim", description: errMsg, variant: "destructive" });
        return;
      }
      toast({ title: "🎉 Voucher diklaim!", description: (data as any).reward_label });
      setCode("");
      await load();
      restoreScroll();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-accent/5">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" />
            <h3 className="font-bold">Tukar Kode Streak Voucher</h3>
          </div>
          <p className="text-xs text-muted-foreground">Masukkan kode dari admin untuk dapat Gem, Koin Streak, Kredit, Hint, Streak Freeze, atau Time Freeze gratis.</p>
          <div className="flex gap-2">
            <Input
              placeholder="STR-XXXXXXXX"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono"
            />
            <Button onClick={() => claim(code)} disabled={submitting}>
              <Gift className="w-4 h-4 mr-1" />Klaim
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <div className="flex items-center gap-2 px-1">
          <History className="w-4 h-4 text-accent" />
          <h4 className="text-sm font-bold">Riwayat Voucher</h4>
        </div>
        {history.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-center text-xs text-muted-foreground">
              Belum ada voucher yang diklaim.
            </CardContent>
          </Card>
        ) : (
          history.map(h => (
            <Card key={h.id}>
              <CardContent className="p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{h.voucher_name || h.voucher_code}</div>
                    <div className="text-[10px] font-mono text-muted-foreground">{h.voucher_code}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-xs bg-primary/10 text-primary whitespace-nowrap">
                    {REWARD_LABELS[h.reward_type] || h.reward_type} ×{h.reward_amount}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Diklaim: {new Date(h.claimed_at).toLocaleString("id-ID")}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
