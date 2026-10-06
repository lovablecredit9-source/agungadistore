import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { BarChart3, CalendarClock, Check, Copy, Eye, Heart, Package, ShoppingCart, X, Gem, Search } from "lucide-react";

const rp = (n: number) => "Rp " + Number(n || 0).toLocaleString("id-ID");
type Status = "semua" | "pending" | "approved" | "rejected";
type Stats = { views: number; wishlist: number; cart_added: number; purchases: number; revenue: number };
const toLocal = (d?: string | null) => d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

export function stockLevel(p: any): "habis" | "menipis" | "aman" {
  if (Number(p.stock) <= 0) return "habis";
  return Number(p.stock) <= Number(p.min_stock || 0) ? "menipis" : "aman";
}

export function AdminOrderStats() {
  const [s, setS] = useState<any>(null);
  useEffect(() => { (supabase as any).rpc("admin_order_stats").then(({ data, error }: any) => setS(error ? false : data)); }, []);
  if (s === false) return null;
  const cells: [string, string][] = s ? [["Total order", String(s.total)], ["Selesai", String(s.completed)], ["Pending", String(s.pending)], ["Dibatalkan", String(s.cancelled)], ["Pendapatan", rp(s.revenue)], ["Rata-rata order", rp(s.aov)]] : [];
  return <div className="space-y-2 rounded-xl border bg-background/40 p-3">
    <p className="flex items-center gap-1 text-sm font-bold"><BarChart3 className="h-4 w-4 text-primary" />Analitik Pesanan Toko</p>
    {!s ? <div className="grid grid-cols-3 gap-1.5">{[1,2,3,4,5,6].map((n) => <div key={n} className="h-12 animate-pulse rounded-lg bg-muted" />)}</div> : <>
      <div className="grid grid-cols-3 gap-1.5">{cells.map(([l, v]) => <div key={l} className="rounded-lg bg-muted/40 p-2"><p className="text-[10px] text-muted-foreground">{l}</p><p className="truncate text-sm font-black">{v}</p></div>)}</div>
      {(s.top || []).length > 0 && <div className="text-[11px]"><p className="mb-1 font-bold">Produk terlaris</p>{s.top.map((t: any, i: number) => <p key={i} className="flex justify-between"><span className="truncate">{i + 1}. {t.title}</span><span className="shrink-0 text-muted-foreground">{t.qty} terjual · {rp(t.revenue)}</span></p>)}</div>}
      {!s.total && <p className="text-center text-[11px] text-muted-foreground">Belum ada pesanan.</p>}
    </>}
  </div>;
}

export default function AdminSellerProducts({ prods, storeName, variants, onReload }: { prods: any[]; storeName: (id: string) => string; variants: Record<string, any[]>; onReload: () => Promise<void> | void }) {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>("semua");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [bulk, setBulk] = useState({ category: "", status: "", featured: "", stock: "", price: "", active: "" });
  const [confirm, setConfirm] = useState(false);
  const [review, setReview] = useState<any>(null);
  const [sched, setSched] = useState<any>(null);
  const [schedForm, setSchedForm] = useState({ publish_at: "", unpublish_at: "", featured_until: "", min_stock: "" });

  useEffect(() => { (supabase as any).rpc("admin_product_analytics").then(({ data }: any) => { const m: Record<string, Stats> = {}; (data || []).forEach((r: any) => { m[r.product_id] = r; }); setStats(m); }); }, [prods]);

  const list = useMemo(() => prods.filter((p) => (status === "semua" || p.status === status) && `${p.title} ${p.category || ""}`.toLowerCase().includes(q.toLowerCase())), [prods, status, q]);
  const count = (s: Status) => s === "semua" ? prods.length : prods.filter((p) => p.status === s).length;

  const patch = useMemo(() => {
    const x: any = {};
    if (bulk.category.trim()) x.category = bulk.category.trim();
    if (bulk.status) x.status = bulk.status;
    if (bulk.featured) x.is_featured = bulk.featured === "on";
    if (bulk.stock !== "") x.stock = Math.max(0, parseInt(bulk.stock, 10) || 0);
    if (bulk.price !== "") x.price = Math.max(0, parseInt(bulk.price, 10) || 0);
    if (bulk.active) x.is_active = bulk.active === "on";
    return x;
  }, [bulk]);

  async function applyBulk() {
    setConfirm(false);
    const { error } = await (supabase as any).from("seller_products").update({ ...patch, updated_at: new Date().toISOString() }).in("id", sel);
    if (error) return toast({ title: "Perubahan massal gagal", description: error.message, variant: "destructive" });
    toast({ title: `✅ ${sel.length} produk diperbarui` }); setSel([]); setBulk({ category: "", status: "", featured: "", stock: "", price: "", active: "" }); await onReload();
  }

  async function duplicate(p: any) {
    const { error } = await (supabase as any).from("seller_products").insert({
      store_id: p.store_id, visitor_id: p.visitor_id, title: `${p.title} (Salinan)`.slice(0, 120), description: p.description, price: p.price, promo_price: p.promo_price,
      stock: p.stock, category: p.category, image_url: p.image_url, images: p.images, has_warranty: p.has_warranty, warranty_duration_value: p.warranty_duration_value,
      warranty_duration_unit: p.warranty_duration_unit, order_form: p.order_form, min_stock: p.min_stock, status: "approved", is_active: false,
    });
    if (error) return toast({ title: "Duplikat gagal", description: error.message, variant: "destructive" });
    toast({ title: "Produk diduplikat", description: "Salinan dibuat nonaktif — aktifkan setelah dicek." }); await onReload();
  }

  async function decide(p: any, s: "approved" | "rejected") {
    if (s === "rejected" && !(notes[p.id] || "").trim()) return toast({ title: "Isi alasan penolakan", variant: "destructive" });
    const { error } = await (supabase as any).from("seller_products").update({ status: s, admin_note: notes[p.id] || null, updated_at: new Date().toISOString() }).eq("id", p.id);
    if (error) return toast({ title: "Gagal", description: error.message, variant: "destructive" });
    toast({ title: s === "approved" ? "✅ Produk disetujui" : "Produk ditolak" }); setReview(null); await onReload();
  }

  async function saveSchedule() {
    const iso = (v: string) => v ? new Date(v).toISOString() : null;
    const { error } = await (supabase as any).from("seller_products").update({ publish_at: iso(schedForm.publish_at), unpublish_at: iso(schedForm.unpublish_at), featured_until: iso(schedForm.featured_until), ...(schedForm.featured_until ? { is_featured: true } : {}), min_stock: Math.max(0, parseInt(schedForm.min_stock || "0", 10) || 0), ...(schedForm.publish_at ? { is_active: false } : {}) }).eq("id", sched.id);
    if (error) return toast({ title: "Jadwal gagal disimpan", description: error.message, variant: "destructive" });
    toast({ title: "Jadwal disimpan", description: "Server menjalankan jadwal otomatis (maks. 5 menit)." }); setSched(null); await onReload();
  }

  const lowCount = prods.filter((p) => stockLevel(p) !== "aman" && p.status === "approved").length;

  return <div className="space-y-2">
    {lowCount > 0 && <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-[11px] font-bold text-destructive">⚠️ {lowCount} produk stok menipis/habis</p>}
    <div className="flex gap-1 overflow-x-auto">{(["semua", "pending", "approved", "rejected"] as Status[]).map((s) => <Button key={s} size="sm" variant={status === s ? "default" : "outline"} className="h-7 shrink-0 text-[10px] capitalize" onClick={() => setStatus(s)}>{({ semua: "Semua", pending: "Pending", approved: "Disetujui", rejected: "Ditolak" })[s]} ({count(s)})</Button>)}</div>
    <div className="relative"><Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari produk" className="h-8 pl-7 text-xs" /></div>
    <div className="flex items-center gap-2 text-[11px]"><Checkbox checked={!!list.length && list.every((p) => sel.includes(p.id))} onCheckedChange={(v) => setSel(v ? list.map((p) => p.id) : [])} /><span>Pilih semua ({sel.length} dipilih)</span></div>

    {sel.length > 0 && <div className="space-y-1.5 rounded-xl border border-primary/40 bg-primary/5 p-2 animate-fade-in">
      <p className="text-[11px] font-bold">Ubah massal {sel.length} produk (kosongkan yang tidak diubah)</p>
      <div className="grid grid-cols-2 gap-1.5">
        <Input className="h-8 text-xs" placeholder="Kategori baru" value={bulk.category} onChange={(e) => setBulk({ ...bulk, category: e.target.value })} />
        <select className="h-8 rounded-md border bg-background px-2 text-xs" value={bulk.status} onChange={(e) => setBulk({ ...bulk, status: e.target.value })}><option value="">Status —</option><option value="pending">Pending</option><option value="approved">Disetujui</option><option value="rejected">Ditolak</option></select>
        <select className="h-8 rounded-md border bg-background px-2 text-xs" value={bulk.featured} onChange={(e) => setBulk({ ...bulk, featured: e.target.value })}><option value="">Featured —</option><option value="on">Featured ON</option><option value="off">Featured OFF</option></select>
        <select className="h-8 rounded-md border bg-background px-2 text-xs" value={bulk.active} onChange={(e) => setBulk({ ...bulk, active: e.target.value })}><option value="">Aktif —</option><option value="on">Aktifkan</option><option value="off">Nonaktifkan</option></select>
        <Input className="h-8 text-xs" inputMode="numeric" placeholder="Stok baru" value={bulk.stock} onChange={(e) => setBulk({ ...bulk, stock: e.target.value.replace(/\D/g, "") })} />
        <Input className="h-8 text-xs" inputMode="numeric" placeholder="Harga baru (Rp)" value={bulk.price} onChange={(e) => setBulk({ ...bulk, price: e.target.value.replace(/\D/g, "") })} />
      </div>
      <Button size="sm" className="h-8 w-full text-xs" disabled={!Object.keys(patch).length} onClick={() => setConfirm(true)}>Terapkan perubahan</Button>
    </div>}

    {!list.length && <p className="py-6 text-center text-xs text-muted-foreground">Tidak ada produk di filter ini.</p>}
    {list.map((p) => { const st = stats[p.id]; const lvl = stockLevel(p); const conv = st?.views ? Math.round((st.purchases / st.views) * 1000) / 10 : 0; return <div key={p.id} className="flex gap-2 rounded-xl border border-border bg-background/40 p-2 transition hover:border-primary/40">
      <Checkbox className="mt-1" checked={sel.includes(p.id)} onCheckedChange={(v) => setSel((o) => v ? [...o, p.id] : o.filter((x) => x !== p.id))} />
      {p.image_url && <img src={p.image_url} alt={p.title} loading="lazy" className="h-14 w-14 rounded-lg object-cover" />}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-xs font-bold">{p.title}</p>
        <p className="text-[11px] text-primary">{rp(p.price)} · stok {p.stock} · {storeName(p.store_id)}</p>
        <div className="flex flex-wrap gap-1">
          <Badge variant={p.status === "rejected" ? "destructive" : "outline"} className="text-[9px]">{p.status}</Badge>
          {!p.is_active && <Badge variant="outline" className="text-[9px]">nonaktif</Badge>}
          {p.is_featured && <Badge className="text-[9px]"><Gem className="mr-0.5 h-2.5 w-2.5" />Featured</Badge>}
          {lvl === "menipis" && <Badge variant="outline" className="text-[9px]">🟡 Low Stock</Badge>}
          {lvl === "habis" && <Badge variant="destructive" className="text-[9px]">🔴 Out of Stock</Badge>}
          {p.publish_at && <Badge variant="outline" className="text-[9px]">⏰ Tayang {new Date(p.publish_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</Badge>}
          {p.unpublish_at && <Badge variant="outline" className="text-[9px]">⏰ Berhenti {new Date(p.unpublish_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</Badge>}
          {(variants[p.id] || []).map((v) => <Badge key={v.id} variant="outline" className="text-[9px]">{v.name} · {rp(v.price)}</Badge>)}
        </div>
        {st && <div className="grid grid-cols-6 gap-0.5 text-center text-[9px] text-muted-foreground">
          <span><Eye className="mx-auto h-3 w-3" />{st.views}</span><span><Heart className="mx-auto h-3 w-3" />{st.wishlist}</span><span><ShoppingCart className="mx-auto h-3 w-3" />{st.cart_added}</span><span><Package className="mx-auto h-3 w-3" />{st.purchases}</span><span className="col-span-1 truncate font-bold text-foreground">{rp(st.revenue)}</span><span>{conv}%</span>
        </div>}
        <div className="flex flex-wrap gap-1">
          {p.status === "pending" && <Button size="sm" className="h-7 text-[10px]" onClick={() => setReview(p)}>Review Product</Button>}
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => duplicate(p)}><Copy className="mr-1 h-3 w-3" />Duplikat</Button>
          <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => { setSched(p); setSchedForm({ publish_at: toLocal(p.publish_at), unpublish_at: toLocal(p.unpublish_at), featured_until: toLocal(p.featured_until), min_stock: String(p.min_stock ?? 0) }); }}><CalendarClock className="mr-1 h-3 w-3" />Jadwal & Stok Min.</Button>
          {p.status !== "pending" && <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setReview(p)}>Ubah status</Button>}
        </div>
      </div>
    </div>; })}

    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Ubah {sel.length} produk?</AlertDialogTitle><AlertDialogDescription>
      {Object.entries(patch).map(([k, v]) => <span key={k} className="block">{({ category: "Kategori", status: "Status", is_featured: "Featured", stock: "Stok", price: "Harga", is_active: "Aktif" } as any)[k]}: <b>{typeof v === "boolean" ? (v ? "ON" : "OFF") : String(v)}</b></span>)}
    </AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={applyBulk}>Ya, terapkan</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

    <Dialog open={!!review} onOpenChange={(v) => !v && setReview(null)}>{review && <DialogContent className="max-h-[90dvh] w-[calc(100%-1rem)] max-w-md overflow-y-auto"><DialogHeader><DialogTitle>Review Produk</DialogTitle></DialogHeader>
      {review.image_url && <img src={review.image_url} alt={review.title} className="max-h-56 w-full rounded-lg object-cover" />}
      <p className="font-bold">{review.title}</p><p className="text-sm text-primary">{rp(review.price)} · stok {review.stock} · {review.category || "-"}</p>
      <p className="whitespace-pre-wrap text-xs text-muted-foreground">{review.description || "Tanpa deskripsi."}</p>
      <p className="text-[11px]">Toko: {storeName(review.store_id)}</p>
      <Input value={notes[review.id] || ""} onChange={(e) => setNotes((n) => ({ ...n, [review.id]: e.target.value }))} placeholder="Catatan / alasan penolakan" />
      <div className="grid grid-cols-2 gap-2"><Button onClick={() => decide(review, "approved")}><Check className="mr-1 h-4 w-4" />Approve</Button><Button variant="destructive" onClick={() => decide(review, "rejected")}><X className="mr-1 h-4 w-4" />Reject</Button></div>
    </DialogContent>}</Dialog>

    <Dialog open={!!sched} onOpenChange={(v) => !v && setSched(null)}>{sched && <DialogContent className="w-[calc(100%-1rem)] max-w-sm"><DialogHeader><DialogTitle>Jadwal & Stok Minimum</DialogTitle></DialogHeader>
      <p className="truncate text-xs font-bold">{sched.title}</p>
      {([["publish_at", "Publish pada"], ["unpublish_at", "Unpublish pada"], ["featured_until", "Featured sampai"]] as const).map(([k, l]) => <label key={k} className="block text-xs">{l}<Input type="datetime-local" className="mt-1" value={(schedForm as any)[k]} onChange={(e) => setSchedForm({ ...schedForm, [k]: e.target.value })} /></label>)}
      <label className="block text-xs">Stok minimum (peringatan)<Input inputMode="numeric" className="mt-1" value={schedForm.min_stock} onChange={(e) => setSchedForm({ ...schedForm, min_stock: e.target.value.replace(/\D/g, "") })} /></label>
      <p className="text-[10px] text-muted-foreground">Kosongkan tanggal untuk membatalkan jadwal. Flash sale tetap diatur di menu Flash Sale penjual (sudah punya waktu mulai/selesai).</p>
      <Button onClick={saveSchedule}>Simpan</Button>
    </DialogContent>}</Dialog>
  </div>;
}
