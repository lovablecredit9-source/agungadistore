import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageCircle, Send } from "lucide-react";
import SellerOrderChat from "./SellerOrderChat";
import { ORDER_STATUS, rp } from "./orderStatus";
import { settleOrder } from "./settleOrder";

/** Kelola pesanan masuk untuk penjual: status + data pengiriman + chat pembeli */
export default function SellerOrdersPanel({ storeId, visitorId }: { storeId: string; visitorId: string }) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [delivery, setDelivery] = useState<Record<string, string>>({});

  async function load() {
    const { data } = await supabase.from("seller_orders" as any).select("*")
      .eq("store_id", storeId).order("created_at", { ascending: false }).limit(60);
    setOrders((data as any[]) || []);
    setLoading(false);
  }
  useEffect(() => {
    load();
    (supabase as any).rpc("touch_user_presence", { p_visitor_id: visitorId }).then(() => {});
  }, [storeId]);

  async function sendOrder(o: any) {
    const text = (delivery[o.id] || "").trim();
    if (!text) return toast({ title: "Isi data produk yang akan dikirim", variant: "destructive" });
    const { data, error } = await supabase.functions.invoke("seller-escrow", {
      body: { action: "ship", visitorId, orderId: o.id, deliveryData: text }
    });
    if (error || data?.error) return toast({ title: "Gagal mengirim pesanan", description: error?.message || data?.error, variant: "destructive" });
    toast({ title: "📦 Pesanan dikirim", description: "Dana tetap ditahan sampai pembeli konfirmasi atau auto-konfirmasi 5 jam." });
    setDelivery((p) => ({ ...p, [o.id]: "" }));
    load();
  }

  if (loading) return <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>;

  return (
    <Card className="bg-card/50 border-border">
      <CardContent className="p-3 space-y-2">
        <h3 className="text-sm font-black">📬 Pesanan Masuk</h3>
        {orders.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-6">Belum ada pesanan masuk.</p>
        ) : orders.map((o) => {
          const st = ORDER_STATUS[o.status] || ORDER_STATUS.pending;
          const s = ship[o.id] || { courier: o.courier || "", resi: o.tracking_number || "" };
          return (
            <div key={o.id} className="rounded-xl border border-border bg-background/40 p-2.5 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold truncate">{o.product_title} ×{o.qty}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">#{o.order_number} · {new Date(o.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</p>
                  <p className="text-xs font-black text-emerald-300">{rp(o.total)}</p>
                </div>
                <Badge variant="outline" className={`text-[9px] ${st.cls}`}>{st.label}</Badge>
              </div>
              <div className="rounded-lg bg-muted/40 p-2 text-[10px] space-y-0.5">
                <p>👤 {o.buyer_name}</p>
                {o.buyer_note && <p>📝 {o.buyer_note}</p>}
              </div>
              <Textarea className="min-h-20 text-xs" placeholder="Data pesanan digital: kode voucher, akun, ID, dll." value={delivery[o.id] || ""} onChange={(e) => setDelivery((p) => ({ ...p, [o.id]: e.target.value }))} />
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setStatus(o, "proses")}>Proses</Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => saveShipping(o)}>
                  <Truck className="w-3 h-3 mr-1" /> Kirim
                </Button>
                <Button size="sm" className="h-7 text-[10px]" onClick={() => setStatus(o, "selesai")}>Selesai</Button>
                <Button size="sm" variant="destructive" className="h-7 text-[10px]" onClick={() => setStatus(o, "batal")}>Batal</Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
