import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Flag, PackageCheck, XCircle } from "lucide-react";
import { useMarketSignal } from "@/hooks/useMarketSignal";
import { orderCode } from "./orderCode";
import { ORDER_STATUS, rp } from "./orderStatus";

/** Riwayat pesanan pembeli: status, konfirmasi, batal 1 jam, lapor kendala 1x */
export default function BuyerOrdersPanel({ visitorId }: { visitorId: string }) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportOn, setReportOn] = useState<string | null>(null);
  const [detail, setDetail] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [skew, setSkew] = useState(0);

  async function load() {
    const { data, error } = await supabase.functions.invoke("seller-shop", { body: { action: "buyer_data", visitorId } });
    if (error || data?.error) {
      toast({ title: "Pesanan gagal dimuat", description: data?.error || error?.message, variant: "destructive" });
    }
    if (data?.serverNow) setSkew(new Date(data.serverNow).getTime() - Date.now());
    setOrders(data?.orders || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [visitorId]);
  useMarketSignal([visitorId], load);

  const now = () => Date.now() + skew;
  const canCancel = (o: any) => ["dibayar", "proses", "pending"].includes(o.status) && o.escrow_status === "held" && !o.dispute
    && now() - new Date(o.paid_at || o.created_at).getTime() < 3600_000;
  const canReport = (o: any) => !o.dispute_used && !o.dispute && o.escrow_status === "held" && !["selesai", "dibatalkan", "refund"].includes(o.status);

  async function call(body: any, ok: string) {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("seller-shop", { body: { visitorId, ...body } });
    setBusy(false);
    if (error || data?.error) { toast({ title: "Gagal", description: data?.error || error?.message, variant: "destructive" }); return false; }
    toast({ title: ok }); load(); return true;
  }

  const finish = (o: any) => call({ action: "confirm", orderId: o.id }, "✅ Pesanan selesai");
  const cancel = (o: any) => { if (confirm("Batalkan pesanan? Dana kembali ke saldo.")) call({ action: "buyer_cancel", orderId: o.id }, "Pesanan dibatalkan, dana dikembalikan"); };
  async function report(o: any) {
    if (await call({ action: "dispute", orderId: o.id, reason: detail.trim(), evidence }, "🚩 Laporan terkirim, dana ditahan")) {
      setReportOn(null); setDetail(""); setEvidence("");
    }
  }
  function pickFile(f?: File) {
    if (!f) return;
    if (f.size > 1_000_000) return toast({ title: "Foto maksimal 1MB", variant: "destructive" });
    const r = new FileReader(); r.onload = () => setEvidence(String(r.result)); r.readAsDataURL(f);
  }

  if (loading) return <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;

  return (
    <Card className="bg-card/50 border-border">
      <CardContent className="p-3 space-y-2">
        <h3 className="text-sm font-black">🧾 Pesanan Saya</h3>
        {orders.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-6">Belum ada pesanan.</p>
        ) : orders.map((o) => {
          const st = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
          return (
            <div key={o.id} className="rounded-xl border border-border bg-background/40 p-2.5 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold truncate">{o.product_title} ×{o.qty}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {orderCode(o)} · {new Date(o.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                  <p className="text-xs font-black text-emerald-300">{rp(o.grand_total ?? o.total)}</p>
                </div>
                <Badge variant="outline" className={`text-[9px] ${st.cls}`}>{st.label}</Badge>
              </div>
              {o.tracking_number && (
                <p className="text-[10px] text-cyan-300">🚚 {o.courier || "Kurir"} · Resi: {o.tracking_number}</p>
              )}
              {o.shipping_note && <p className="text-[10px] text-muted-foreground">📝 {o.shipping_note}</p>}
              {o.dispute && <p className="text-[10px] text-amber-300">⚠️ Kasus kendala: {o.dispute.status} · dana ditahan</p>}
              <div className="flex flex-wrap gap-1.5">
                {o.status === "dikirim" && !o.dispute && (
                  <Button size="sm" className="h-7 text-[10px]" disabled={busy} onClick={() => finish(o)}>
                    <PackageCheck className="w-3 h-3 mr-1" /> Pesanan Diterima
                  </Button>
                )}
                {canCancel(o) && (
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" disabled={busy} onClick={() => cancel(o)}>
                    <XCircle className="w-3 h-3 mr-1" /> Batalkan
                  </Button>
                )}
                {canReport(o) && (
                  <Button size="sm" variant="outline" className="h-7 text-[10px] text-rose-300"
                    onClick={() => setReportOn(reportOn === o.id ? null : o.id)}>
                    <Flag className="w-3 h-3 mr-1" /> Lapor Kendala
                  </Button>
                )}
              </div>
              {reportOn === o.id && canReport(o) && (
                <div className="space-y-1.5">
                  <Textarea rows={2} className="text-xs" placeholder="Ceritakan kendala pesanan ini"
                    value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={500} />
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="text-[10px]" onChange={(e) => pickFile(e.target.files?.[0])} />
                  {evidence && <img src={evidence} alt="Bukti" className="h-16 rounded" />}
                  <p className="text-[10px] text-muted-foreground">Laporan hanya bisa dibuat 1 kali per pesanan.</p>
                  <Button size="sm" variant="destructive" className="h-7 text-[10px]" disabled={busy || detail.trim().length < 5} onClick={() => report(o)}>
                    Kirim Laporan
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
