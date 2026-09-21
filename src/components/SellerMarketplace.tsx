import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BadgeCheck, ShoppingBag, Search, MessageCircle, Loader2, Store } from "lucide-react";
import SellerStoreProfileDialog from "@/components/seller/SellerStoreProfileDialog";
import { getVisitorId } from "@/lib/visitor-id";

const rp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");
const ADMIN_WA = "6285769302532";

export default function SellerMarketplace({ visitorId }: { visitorId?: string | null } = {}) {
  const vid = visitorId || getVisitorId();
  const [profileStore, setProfileStore] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [stores, setStores] = useState<Record<string, any>>({});
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: pr }, { data: st }] = await Promise.all([
        supabase.from("seller_products" as any).select("*")
          .eq("status", "approved").eq("is_active", true)
          .order("sold_count", { ascending: false }).limit(60),
        supabase.from("seller_stores" as any).select("*").eq("is_active", true),
      ]);
      setItems((pr as any[]) || []);
      const map: Record<string, any> = {};
      for (const s of ((st as any[]) || [])) map[s.id] = s;
      setStores(map);
      setLoading(false);
    })();
  }, []);

  const filtered = items.filter((p) =>
    !q.trim() || `${p.title} ${p.category || ""}`.toLowerCase().includes(q.toLowerCase())
  );

  function buy(p: any) {
    const st = stores[p.store_id];
    const text = encodeURIComponent(
      `Halo Admin Agung Adi Store 👋\nSaya mau beli produk penjual (Rekber):\n\n🛍️ ${p.title}\n💰 ${rp(p.price)}\n🏪 Toko: ${st?.store_name || "-"}${st?.is_verified ? " ✅" : ""}\n🆔 #${p.product_number}\n\nMohon dibantu proses Rekber-nya, terima kasih.`
    );
    window.open(`https://wa.me/${ADMIN_WA}?text=${text}`, "_blank");
  }

  return (
    <Card className="bg-card/50 border-border">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-teal-400" />
          <h3 className="text-sm font-black">🛍️ Etalase Produk Penjual</h3>
          <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-8 h-9 text-sm" placeholder="Cari produk penjual..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {loading ? (
          <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-6">Belum ada produk penjual yang tayang.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((p) => {
              const st = stores[p.store_id];
              return (
                <div key={p.id} className="rounded-xl border border-border bg-background/40 overflow-hidden">
                  {p.image_url ? (
                    <img src={p.image_url} alt={p.title} loading="lazy" className="w-full h-24 object-cover" />
                  ) : <div className="w-full h-24 bg-muted" />}
                  <div className="p-2 space-y-1">
                    <p className="text-xs font-bold line-clamp-2">{p.title}</p>
                    <p className="text-xs font-black text-emerald-300">{rp(p.price)}</p>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="truncate">{st?.store_name || "Toko"}</span>
                      {st?.is_verified && <BadgeCheck className="w-3 h-3 text-sky-400 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground">stok {p.stock} · terjual {p.sold_count || 0}</p>
                    {p.has_warranty && (
                      <Badge variant="outline" className="text-[9px] text-sky-300 border-sky-400/30">
                        🛡️ Garansi {p.warranty_duration_value} {p.warranty_duration_unit === "year" ? "Tahun" : "Bulan"}
                      </Badge>
                    )}

                    <Button size="sm" className="w-full h-7 text-[10px]" onClick={() => setProfileStore(p.store_id)}>
                      <ShoppingBag className="w-3 h-3 mr-1" /> Pesan Sekarang
                    </Button>
                    <Button size="sm" variant="outline" className="w-full h-7 text-[10px]"
                      onClick={() => setProfileStore(p.store_id)}>
                      <Store className="w-3 h-3 mr-1" /> Kunjungi Toko
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <SellerStoreProfileDialog storeId={profileStore} visitorId={vid}
          open={!!profileStore} onOpenChange={(v) => !v && setProfileStore(null)} />
        <p className="text-[10px] text-muted-foreground">
          ⚠️ Pesanan diproses di dalam aplikasi: konfirmasi dengan PIN 6 digit, lalu chat penjual di tab Pesanan. Transaksi di luar aplikasi tidak dijamin.
        </p>
      </CardContent>
    </Card>
  );
}
