import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Loader2, Check } from "lucide-react";

export default function PqVoucherRedeemCard() {
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{ days: number; expiresAt: string } | null>(null);

  const redeem = async () => {
    if (!code.trim()) return toast({ title: "Masukkan kode voucher" });
    setLoading(true);
    try {
      const visitorId = localStorage.getItem("balance_visitor_id") || getVisitorId();
      const { data, error } = await supabase.functions.invoke("premium-quest-voucher", {
        body: { action: "redeem", code: code.trim(), visitorId },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      const d = data as any;
      setSuccess({ days: d.duration_days, expiresAt: d.expires_at });
      toast({ title: "🎉 Penukaran Berhasil", description: `Premium Quest aktif ${d.duration_days} hari` });
      setCode("");
    } catch (e) {
      toast({ title: "Gagal", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/5 to-purple-500/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Ticket className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-bold text-sm">🎟️ Tukar Kode Voucher</h3>
            <p className="text-[10px] text-muted-foreground">Aktifkan Premium Quest pakai kode</p>
          </div>
        </div>

        {success && (
          <div className="bg-green-500/10 border border-green-500/40 rounded p-2 flex items-center gap-2 text-xs">
            <Check className="w-4 h-4 text-green-500" />
            <span>Aktif {success.days} hari, hingga {new Date(success.expiresAt).toLocaleString("id-ID")}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Input placeholder="PQ-XXXXXXXX" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className="font-mono" />
          <Button onClick={redeem} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Tukar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
