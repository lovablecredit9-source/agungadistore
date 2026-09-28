import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Copy, Eye, ImagePlus, Pencil, Search, ShoppingCart, Star, TrendingUp } from "lucide-react";
import { rp } from "./orderStatus";

export function productStatus(p: any): { key: string; label: string; cls: string } {
  if (p.archived_at) return { key: "arsip", label: "Arsip", cls: "text-muted-foreground" };
  if (p.status === "draft") return { key: "draft", label: "Draft", cls: "text-muted-foreground" };
  if (p.status === "pending") return { key: "review", label: "Menunggu Review", cls: "text-yellow-300 border-yellow-500/30" };
  if (p.status === "rejected") return { key: "ditolak", label: "Ditolak", cls: "text-rose-300 border-rose-500/30" };
  if ((p.stock ?? 0) <= 0) return { key: "habis", label: "Stok Habis", cls: "text-rose-300 border-rose-500/30" };
  if (!p.is_active) return { key: "nonaktif", label: "Nonaktif", cls: "text-muted-foreground" };
  return { key: "aktif", label: "Aktif", cls: "text-emerald-300 border-emerald-500/30" };
}

export function stockLabel(p: any) {
  if ((p.stock ?? 0) <= 0) return <span className="text-rose-400 font-bold">Stok habis</span>;
  if (p.stock <= (p.min_stock ?? 5)) return <span className="text-amber-400 font-bold">⚠ Stok hampir habis</span>;
  return <span className="text-emerald-400">Aman</span>;
}

const FILTERS = [["semua", "Semua"], ["aktif", "Aktif"], ["review", "Review"], ["nonaktif", "Nonaktif"], ["habis", "Habis"], ["ditolak", "Ditolak"], ["draft", "Draft"], ["arsip", "Arsip"]] as const;

type Props = { visitorId: string; products: any[]; mode: "produk" | "stok"; onChanged: () => void; onEdit: (p: any) => void };

export default function SellerProductManager({ visitorId, products, mode, onChanged, onEdit }: Props) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [f, setF] = useState<string>("semua");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | { action: string; label: string }>(null);
  const [cat, setCat] = useState("");
  const [busy, setBusy] = useState(false);
  const [stockEdit, setStockEdit] = useState<Record<string, { stock: string; min: string }>>({});

  const list = useMemo(() => products.filter((p) => {
    const st = productStatus(p).key;
    if (f === "semua" ? st === "arsip" : st !== f) return false;
    return !q || p.title?.toLowerCase().includes(q.toLowerCase());
  }), [products, q, f]);

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function bulk(action: string, category?: string) {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("seller_product_bulk", { p_visitor_id: visitorId, p_ids: [...sel], p_action: action, p_category: category ?? null });
    setBusy(false); setConfirm(null);
    if (error) return toast({ title: "Gagal", description: error.message, variant: "destructive" });
    toast({ title: `✅ ${data ?? 0} produk diperbarui` });
    setSel(new Set()); onChanged();
  }

  async function duplicate(p: any) {
    const { error } = await (supabase as any).rpc("seller_product_duplicate", { p_visitor_id: visitorId, p_id: p.id });
    if (error) return toast({ title: "Gagal menyalin", description: error.message, variant: "destructive" });
    toast({ title: "📋 Produk disalin", description: "Salinan menunggu review admin." });
    onChanged();
  }

  async function saveStock(p: any) {
    const e = stockEdit[p.id]; if (!e) return;
    const stock = Math.max(0, parseInt(e.stock || "0")); const min = Math.max(0, parseInt(e.min || "0"));
    const { error } = await supabase.from("seller_products" as any).update({ stock, min_stock: min, updated_at: new Date().toISOString() } as any).eq("id", p.id).eq("store_id", p.store_id);
    if (error) return toast({ title: "Gagal simpan stok", description: error.message, variant: "destructive" });
    toast({ title: "Stok disimpan" });
    setStockEdit((s) => { const n = { ...s }; delete n[p.id]; return n; }); onChanged();
  }

  return (
    <Card className="bg-card/50 border-border"><CardContent className="p-3 space-y-2">
      <div className="relative"><Search className="w-4 h-4 absolute left-2.5 top-3 opacity-50" />
        <Input className="pl-8" placeholder="Cari produk..." value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map(([k, l]) => <button key={k} onClick={() => setF(k)} className={`shrink-0 px-2.5 h-7 rounded-full text-[10px] font-bold border ${f === k ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{l}</button>)}
      </div>

      {mode === "produk" && sel.size > 0 && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-2 space-y-1.5">
          <p className="text-[11px] font-bold">{sel.size} produk dipilih</p>
          <div className="flex flex-wrap gap-1">
            <Button size="sm" className="h-8 text-[10px]" disabled={busy} onClick={() => bulk("activate")}>Aktifkan</Button>
            <Button size="sm" variant="outline" className="h-8 text-[10px]" disabled={busy} onClick={() => bulk("deactivate")}>Nonaktifkan</Button>
            <Button size="sm" variant="outline" className="h-8 text-[10px]" disabled={busy} onClick={() => setConfirm({ action: "archive", label: "Arsipkan" })}>Arsipkan</Button>
            <Button size="sm" variant="destructive" className="h-8 text-[10px]" disabled={busy} onClick={() => setConfirm({ action: "delete", label: "Hapus" })}>Hapus</Button>
          </div>
          <div className="flex gap-1">
            <Input className="h-8 text-xs" placeholder="Kategori baru" value={cat} maxLength={60} onChange={(e) => setCat(e.target.value)} />
            <Button size="sm" variant="outline" className="h-8 text-[10px] shrink-0" disabled={busy || !cat.trim()} onClick={() => bulk("category", cat.trim())}>Ubah kategori</Button>
          </div>
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-6">{products.length ? "Tidak ada produk di filter ini." : "Belum ada produk. Tambah produk pertamamu!"}</p>
      ) : list.map((p) => {
        const st = productStatus(p);
        const e = stockEdit[p.id];
        return (
          <div key={p.id} className="flex gap-2 rounded-xl border border-border bg-background/40 p-2">
            {mode === "produk" && <Checkbox className="mt-1" checked={sel.has(p.id)} onCheckedChange={() => toggle(p.id)} aria-label="Pilih produk" />}
            {p.image_url ? <img src={p.image_url} alt={p.title} loading="lazy" className="w-14 h-14 rounded-lg object-cover shrink-0" />
              : <div className="w-14 h-14 rounded-lg bg-muted grid place-items-center shrink-0"><ImagePlus className="w-5 h-5 opacity-40" /></div>}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{p.title}</p>
              <p className="text-xs font-bold text-emerald-300">
                {p.promo_price && p.promo_price < p.price ? <><span className="line-through text-muted-foreground mr-1">{rp(p.price)}</span>{rp(p.promo_price)}</> : rp(p.price)}
              </p>
              {mode === "produk" ? (
                <>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[10px] text-muted-foreground">
                    <Badge variant="outline" className={`text-[9px] ${st.cls}`}>{st.label}</Badge>
                    {p.category && <span>{p.category}</span>}
                    <span>stok {p.stock}</span>
                    <span className="flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />{p.sold_count || 0}</span>
                    <span className="flex items-center gap-0.5"><Star className="w-3 h-3" />{Number(p.rating_avg || 0).toFixed(1)}</span>
                    <span className="flex items-center gap-0.5"><Eye className="w-3 h-3" />{p.views || 0}</span>
                    <span className="flex items-center gap-0.5"><ShoppingCart className="w-3 h-3" />{p.cart_count || 0}</span>
                  </div>
                  {p.admin_note && <p className="text-[10px] text-rose-300 mt-1">Catatan admin: {p.admin_note}</p>}
                  <div className="flex gap-1 mt-1.5">
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => onEdit(p)}><Pencil className="w-3 h-3 mr-1" />Edit</Button>
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => duplicate(p)}><Copy className="w-3 h-3 mr-1" />Duplikat</Button>
                  </div>
                </>
              ) : (
                <div className="mt-1 space-y-1 text-[10px]">
                  <p>Tersedia <b>{p.stock}</b> · Terjual <b>{p.sold_count || 0}</b> · Min <b>{p.min_stock ?? 5}</b> · {stockLabel(p)}</p>
                  {e ? (
                    <div className="flex gap-1 items-center">
                      <Input className="h-8 text-xs" inputMode="numeric" placeholder="Stok" value={e.stock} onChange={(ev) => setStockEdit((s) => ({ ...s, [p.id]: { ...e, stock: ev.target.value.replace(/\D/g, "") } }))} />
                      <Input className="h-8 text-xs" inputMode="numeric" placeholder="Batas min" value={e.min} onChange={(ev) => setStockEdit((s) => ({ ...s, [p.id]: { ...e, min: ev.target.value.replace(/\D/g, "") } }))} />
                      <Button size="sm" className="h-8 text-[10px]" onClick={() => saveStock(p)}>Simpan</Button>
                    </div>
                  ) : <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setStockEdit((s) => ({ ...s, [p.id]: { stock: String(p.stock ?? 0), min: String(p.min_stock ?? 5) } }))}>Atur stok</Button>}
                </div>
              )}
            </div>
          </div>
        );
      })}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="max-w-[92vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.label} {sel.size} produk?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.action === "delete" ? "Produk yang sudah pernah dipesan akan diarsipkan (bukan dihapus) agar histori pesanan tetap aman." : "Produk diarsipkan disembunyikan dari pembeli; histori pesanan tetap ada."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirm && bulk(confirm.action)}>{confirm?.label}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CardContent></Card>
  );
}
