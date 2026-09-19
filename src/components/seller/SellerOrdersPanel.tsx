import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, MessageCircle, Truck } from "lucide-react";
import SellerOrderChat from "./SellerOrderChat";
import { ORDER_STATUS, rp } from "./orderStatus";
import { settleOrder } from "./settleOrder";

/** Kelola pesanan masuk untuk penjual: status + data pengiriman + chat pembeli */
export default function SellerOrdersPanel({ storeId, visitorId }: { storeId: string; visitorId: string }) {
  const { toast } = useToast();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatOn, setChatOn] = useState<string | null>(null);
  const [ship, setShip] = useState<Record<string, { courier: string; resi: string }>>({});

  async function load() {
    const { data } = await supabase.from("seller_orders" as any).select("*")
      .eq("store_id", storeId).order("created_at", { ascending: false }).limit(60);
    setOrders((data as any[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [storeId]);

  async function setStatus(o: any, status: string) {
    if (status === "selesai") {
      await settleOrder(o);
      toast({ title: "✅ Pesanan selesai", description: "Pendapatan masuk ke saldo toko." });
    } else {
      await supabase.from("seller_orders" as any)
        .update({ status, updated_at: new Date().toISOString() } as any).eq("id", o.id);
      toast({ title: "Status pesanan diperbarui" });
    }
    load();
  }

  async function saveShipping(o: any) {
    const s = ship[o.id] || { courier: "", resi: "" };
    if (!s.courier.trim() && !s.resi.trim()) return toast({ title: "Isi kurir / nomor resi", variant: "destructive" });
    await supabase.from("seller_orders" as any).update({
      courier: s.courier.trim() || null,
      tracking_number: s.resi.trim() || null,
      status: "dikirim",
      shipped_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as any).eq("id", o.id);
    toast({ title: "🚚 Data pengiriman disimpan" });
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
                  <p className="text-xs font-bold truncate">{o.product_title} ×{o.qty}</p>
                  <p className="text-[10px] text-muted-foreground">#{o.order_number} · {new Date(o.created_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</p>
                  <p className="text-xs font-black text-emerald-300">{rp(o.total)}</p>
                </div>
                <Badge variant="outline" className={`text-[9px] ${st.cls}`}>{st.label}</Badge>
              </div>
              <div className="rounded-lg bg-muted/40 p-2 text-[10px] space-y-0.5">
                <p>👤 {o.buyer_name} · {o.buyer_phone}</p>
                <p>📍 {o.buyer_address}</p>
                {o.buyer_note && <p>📝 {o.buyer_note}</p>}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <Input className="h-8 text-xs" placeholder="Kurir (JNE, J&T...)" value={s.courier}
                  onChange={(e) => setShip((p) => ({ ...p, [o.id]: { ...s, courier: e.target.value } }))} />
                <Input className="h-8 text-xs" placeholder="Nomor resi" value={s.resi}
                  onChange={(e) => setShip((p) => ({ ...p, [o.id]: { ...s, resi: e.target.value } }))} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setStatus(o, "proses")}>Proses</Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => saveShipping(o)}>
                  <Truck className="w-3 h-3 mr-1" /> Kirim
                </Button>
                <Button size="sm" className="h-7 text-[10px]" onClick={() => setStatus(o, "selesai")}>Selesai</Button>
                <Button size="sm" variant="destructive" className="h-7 text-[10px]" onClick={() => setStatus(o, "batal")}>Batal</Button>
                <Button size="sm" variant="outline" className="h-7 text-[10px]"
                  onClick={() => setChatOn(chatOn === o.id ? null : o.id)}>
                  <MessageCircle className="w-3 h-3 mr-1" /> Chat
                </Button>
              </div>
              {chatOn === o.id && <SellerOrderChat orderId={o.id} visitorId={visitorId} role="seller" />}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
