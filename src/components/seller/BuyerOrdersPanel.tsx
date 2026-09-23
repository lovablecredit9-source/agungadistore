import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageCircle, Flag, PackageCheck } from "lucide-react";
import SellerOrderChat from "./SellerOrderChat";
import { ORDER_STATUS, rp } from "./orderStatus";

/** Riwayat pesanan pembeli: status, chat penjual, konfirmasi selesai, lapor kendala */
export default function BuyerOrdersPanel({ visitorId }: { visitorId: string }) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatOn, setChatOn] = useState<string | null>(null);
  const [reportOn, setReportOn] = useState<string | null>(null);
  const [detail, setDetail] = useState("");

  async function load() {
    const { data } = await supabase
      .from("seller_orders" as any).select("*")
      .eq("buyer_visitor_id", visitorId).order("created_at", { ascending: false }).limit(50);
    setOrders((data as any[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [visitorId]);

  async function finish(o: any) {
    await supabase.from("seller_orders" as any)
      .update({ status: "selesai", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
      .eq("id", o.id);
    toast({ title: "✅ Pesanan selesai", description: "Terima kasih sudah berbelanja!" });
    load();
  }

  async function report(o: any) {
    await supabase.from("seller_reports" as any).insert({
      order_id: o.id, product_id: o.product_id, store_id: o.store_id,
      visitor_id: visitorId, reason: "Kendala pesanan", detail: detail.trim() || null,
    } as any);
    toast({ title: "🚩 Laporan terkirim ke admin" });
    setReportOn(null); setDetail("");
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
                    <button className="shrink-0 rounded-full bg-primary/20 text-primary px-2 py-0.5 text-[10px] font-bold flex items-center gap-1"
                      onClick={() => setChatOn(chatOn === o.id ? null : o.id)}>
                      <MessageCircle className="w-3 h-3" /> Chat
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    #{o.order_number} · {new Date(o.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                  <p className="text-xs font-black text-emerald-300">{rp(o.total)}</p>
                </div>
                <Badge variant="outline" className={`text-[9px] ${st.cls}`}>{st.label}</Badge>
              </div>
              {o.tracking_number && (
                <p className="text-[10px] text-cyan-300">🚚 {o.courier || "Kurir"} · Resi: {o.tracking_number}</p>
              )}
              {o.shipping_note && <p className="text-[10px] text-muted-foreground">📝 {o.shipping_note}</p>}
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-[10px]"
                  onClick={() => setChatOn(chatOn === o.id ? null : o.id)}>
                  <MessageCircle className="w-3 h-3 mr-1" /> Chat Penjual
                </Button>
                {o.status === "dikirim" && (
                  <Button size="sm" className="h-7 text-[10px]" onClick={() => finish(o)}>
                    <PackageCheck className="w-3 h-3 mr-1" /> Pesanan Diterima
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-7 text-[10px] text-rose-300"
                  onClick={() => setReportOn(reportOn === o.id ? null : o.id)}>
                  <Flag className="w-3 h-3 mr-1" /> Lapor Kendala
                </Button>
              </div>
              {chatOn === o.id && <SellerOrderChat orderId={o.id} visitorId={visitorId} role="buyer" partnerVisitorId={o.seller_visitor_id} />}
              {reportOn === o.id && (
                <div className="space-y-1.5">
                  <Textarea rows={2} className="text-xs" placeholder="Ceritakan kendala pesanan ini"
                    value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={500} />
                  <Button size="sm" variant="destructive" className="h-7 text-[10px]" onClick={() => report(o)}>
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
