import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { BadgeCheck, Store, Loader2, CalendarDays, ShoppingCart, Flag, DoorOpen, DoorClosed } from "lucide-react";
import { rp } from "./orderStatus";

/** Profil toko penjual: banner, info, produk, pesan produk, lapor kendala */
export default function SellerStoreProfileDialog({
  storeId,
  visitorId,
  open,
  onOpenChange,
}: {
  storeId: string | null;
  visitorId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderFor, setOrderFor] = useState<any>(null);
  const [reportFor, setReportFor] = useState<any>(null);

  // form pesanan
  const [qty, setQty] = useState("1");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [pin, setPin] = useState("");
  const [saving, setSaving] = useState(false);

  // form laporan
  const [reason, setReason] = useState("Produk tidak sesuai");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    if (!open || !storeId) return;
    setLoading(true);
    (async () => {
      const [{ data: st }, { data: pr }] = await Promise.all([
        supabase.from("seller_stores" as any).select("*").eq("id", storeId).maybeSingle(),
        supabase.from("seller_products" as any).select("*").eq("store_id", storeId)
          .eq("status", "approved").eq("is_active", true).order("created_at", { ascending: false }),
      ]);
      setStore(st || null);
      setProducts((pr as any[]) || []);
      setLoading(false);
    })();
  }, [open, storeId]);

  async function submitOrder() {
    if (!store || !orderFor) return;
    const q = Math.max(1, Math.round(Number(qty) || 1));
    if (!name.trim() || !phone.trim() || !address.trim())
      return toast({ title: "Nama, nomor HP, & alamat wajib diisi", variant: "destructive" });
    if (pin.length !== 6)
      return toast({ title: "Masukkan PIN 6 digit", variant: "destructive" });
    setSaving(true);
    try {
      const { data: pv, error: pe } = await supabase.functions.invoke("manage-pin", {
        body: { action: "verify", visitorId, pin },
      });
      if (pe || pv?.error || !pv?.valid) {
        setSaving(false);
        return toast({ title: pv?.error || "PIN salah", variant: "destructive" });
      }
      const { error } = await supabase.from("seller_orders" as any).insert({
        store_id: store.id,
        product_id: orderFor.id,
        seller_visitor_id: store.visitor_id,
        buyer_visitor_id: visitorId,
        product_title: orderFor.title,
        qty: q,
        price: orderFor.price,
        total: orderFor.price * q,
        buyer_name: name.trim(),
        buyer_phone: phone.trim(),
        buyer_address: address.trim(),
        buyer_note: note.trim() || null,
        status: "pending",
      } as any);
      if (error) throw error;
      toast({ title: "✅ Pesanan dikirim", description: "Cek tab Pesanan Saya untuk memantau status & chat penjual." });
      setOrderFor(null); setQty("1"); setNote("");
    } catch (e: any) {
      toast({ title: "Gagal memesan", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function submitReport() {
    if (!reportFor) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("seller_reports" as any).insert({
        product_id: reportFor.id, store_id: store?.id, visitor_id: visitorId,
        reason, detail: detail.trim() || null,
      } as any);
      if (error) throw error;
      toast({ title: "🚩 Laporan terkirim", description: "Admin akan meninjau laporanmu." });
      setReportFor(null); setDetail("");
    } catch (e: any) {
      toast({ title: "Gagal melapor", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[88vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-sm">🏪 Profil Toko</DialogTitle></DialogHeader>
        {loading ? (
          <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : !store ? (
          <p className="text-xs text-muted-foreground text-center py-6">Toko tidak ditemukan.</p>
        ) : (
          <div className="space-y-3">
            <div className="rounded-2xl overflow-hidden border border-border">
              {store.banner_url ? (
                <img src={store.banner_url} alt="Banner toko" className="w-full h-24 object-cover" />
              ) : <div className="w-full h-24 bg-gradient-to-r from-teal-600/40 to-cyan-600/40" />}
              <div className="p-3 space-y-1 bg-background/50">
                <div className="flex items-center gap-2">
                  {store.avatar_url ? (
                    <img src={store.avatar_url} alt="Logo toko" className="w-10 h-10 rounded-xl object-cover" />
                  ) : <div className="w-10 h-10 rounded-xl bg-teal-500/15 grid place-items-center"><Store className="w-5 h-5 text-teal-300" /></div>}
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-sm truncate flex items-center gap-1">
                      {store.store_name}
                      {store.is_verified && <BadgeCheck className="w-4 h-4 text-sky-400 shrink-0" />}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Toko #{store.store_number}</p>
                  </div>
                  <Badge variant="outline" className={`text-[9px] ${store.is_open
                    ? "text-emerald-300 border-emerald-500/40 bg-emerald-500/10"
                    : "text-rose-300 border-rose-500/40 bg-rose-500/10"}`}>
                    {store.is_open ? <><DoorOpen className="w-3 h-3 mr-0.5" /> Buka</> : <><DoorClosed className="w-3 h-3 mr-0.5" /> Tutup</>}
                  </Badge>
                </div>
                {store.description && <p className="text-[11px] text-muted-foreground">{store.description}</p>}
                {store.open_hours && <p className="text-[10px] text-muted-foreground">🕒 Jam buka: {store.open_hours}</p>}
                {!store.is_open && store.closed_note && <p className="text-[10px] text-rose-300">📌 {store.closed_note}</p>}
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" /> Terdaftar {new Date(store.created_at).toLocaleDateString("id-ID", { dateStyle: "long" } as any)}
                </p>
                <p className="text-[10px] text-muted-foreground">⭐ {store.rating || 0} · 📦 {store.total_sales || 0} penjualan</p>
              </div>
            </div>

            {products.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-5">Toko ini belum punya produk tayang.</p>
            ) : (
              <div className="space-y-2">
                {products.map((p) => (
                  <div key={p.id} className="rounded-xl border border-border bg-background/40 p-2 flex gap-2">
                    {p.image_url
                      ? <img src={p.image_url} alt={p.title} loading="lazy" className="w-16 h-16 rounded-lg object-cover" />
                      : <div className="w-16 h-16 rounded-lg bg-muted" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{p.title}</p>
                      <p className="text-xs font-black text-emerald-300">{rp(p.price)}</p>
                      <p className="text-[10px] text-muted-foreground">stok {p.stock} · terjual {p.sold_count || 0}</p>
                      <div className="flex gap-1 mt-1">
                        <Button size="sm" className="h-7 text-[10px]" disabled={!store.is_open || p.stock <= 0}
                          onClick={() => { setOrderFor(p); setReportFor(null); }}>
                          <ShoppingCart className="w-3 h-3 mr-1" />
                          {store.is_open ? (p.stock > 0 ? "Pesan" : "Stok habis") : "Toko tutup"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px]"
                          onClick={() => { setReportFor(p); setOrderFor(null); }}>
                          <Flag className="w-3 h-3 mr-1" /> Lapor
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {orderFor && (
              <div className="rounded-xl border border-teal-400/40 bg-teal-500/10 p-3 space-y-2">
                <p className="text-xs font-black">🛒 Pesan: {orderFor.title}</p>
                <Input className="h-8 text-xs" placeholder="Jumlah" inputMode="numeric" value={qty}
                  onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} />
                <Input className="h-8 text-xs" placeholder="Nama penerima" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
                <Input className="h-8 text-xs" placeholder="Nomor HP/WA" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
                <Textarea rows={2} className="text-xs" placeholder="Alamat lengkap pengiriman" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} />
                <Textarea rows={2} className="text-xs" placeholder="Catatan untuk penjual (opsional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
                <p className="text-xs font-black text-emerald-300">
                  Total: {rp((orderFor.price || 0) * Math.max(1, Number(qty) || 1))}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 h-8 text-xs" onClick={submitOrder} disabled={saving}>
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Kirim Pesanan"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setOrderFor(null)}>Batal</Button>
                </div>
              </div>
            )}

            {reportFor && (
              <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-3 space-y-2">
                <p className="text-xs font-black">🚩 Laporkan: {reportFor.title}</p>
                <select value={reason} onChange={(e) => setReason(e.target.value)}
                  className="h-8 w-full rounded-md border bg-background px-2 text-xs">
                  {["Produk tidak sesuai", "Penjual tidak merespon", "Barang tidak dikirim", "Dugaan penipuan", "Harga/konten menyesatkan", "Lainnya"]
                    .map((r) => <option key={r}>{r}</option>)}
                </select>
                <Textarea rows={3} className="text-xs" placeholder="Ceritakan kendalanya" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={500} />
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" className="flex-1 h-8 text-xs" onClick={submitReport} disabled={saving}>
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Kirim Laporan"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setReportFor(null)}>Batal</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
