import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Zap, Package, Trash2, Plus } from "lucide-react";

const rp = (n: any) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const iso = (s: string) => (s ? new Date(s).toISOString() : "");

export function useCountdown(end?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!end) return "";
  const ms = new Date(end).getTime() - now;
  if (ms <= 0) return "Berakhir";
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${h}j ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}d`;
}
function Countdown({ start, end }: { start: string; end: string }) {
  const toStart = useCountdown(start); const toEnd = useCountdown(end);
  return <span>{toStart !== "Berakhir" ? `Mulai ${toStart}` : toEnd === "Berakhir" ? "Berakhir" : `Sisa ${toEnd}`}</span>;
}

function Field({ l, children }: any) { return <label className="block space-y-1"><span className="text-[10px] font-bold text-muted-foreground">{l}</span>{children}</label>; }

export default function SellerPromo({ visitorId, storeId, mode }: { visitorId: string; storeId: string; mode: "promo" | "flash" }) {
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [vouchers, setVouchers] = useState<any[] | null>(null);
  const [flash, setFlash] = useState<any[] | null>(null);
  const [bundles, setBundles] = useState<any[] | null>(null);
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [sub, setSub] = useState<"voucher" | "bundle">("voucher");

  const load = async () => {
    const [{ data: ps }, v, { data: fs }, { data: bs }] = await Promise.all([
      supabase.from("seller_products" as any).select("id,title,price,stock").eq("store_id", storeId).is("archived_at", null).order("title"),
      supabase.rpc("seller_voucher_list" as any, { p_visitor_id: visitorId }),
      supabase.from("seller_flash_sales" as any).select("*").eq("store_id", storeId).eq("is_active", true).order("starts_at", { ascending: false }),
      supabase.from("seller_bundles" as any).select("*, seller_bundle_items(product_id)").eq("store_id", storeId).eq("is_active", true).order("created_at", { ascending: false }),
    ]);
    setProducts((ps as any[]) || []);
    if (v.error) toast({ title: "Gagal memuat voucher", description: v.error.message, variant: "destructive" });
    setVouchers((v.data as any[]) || []); setFlash((fs as any[]) || []); setBundles((bs as any[]) || []);
  };
  useEffect(() => { load(); }, [storeId]);

  const pname = (id: string) => products.find((p) => p.id === id)?.title || "Produk";
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const toggleId = (id: string) => set("product_ids", (form.product_ids || []).includes(id) ? form.product_ids.filter((x: string) => x !== id) : [...(form.product_ids || []), id]);

  const save = async () => {
    setBusy(true);
    let res: any;
    if (form.kind === "voucher") res = await supabase.rpc("seller_voucher_save" as any, { p_visitor_id: visitorId, p: { ...form, starts_at: iso(form.starts_at), ends_at: iso(form.ends_at) } });
    else if (form.kind === "flash") res = await supabase.rpc("seller_flash_save" as any, { p_visitor_id: visitorId, p: { ...form, starts_at: iso(form.starts_at), ends_at: iso(form.ends_at) } });
    else res = await supabase.rpc("seller_bundle_save" as any, { p_visitor_id: visitorId, p: form });
    setBusy(false);
    if (res.error) return toast({ title: "Gagal menyimpan", description: res.error.message, variant: "destructive" });
    toast({ title: "✅ Tersimpan" }); setForm(null); load();
  };
  const del = async (kind: string, id: string) => {
    if (!confirm("Hentikan/hapus promo ini?")) return;
    const { error } = await supabase.rpc("seller_promo_delete" as any, { p_visitor_id: visitorId, p_kind: kind, p_id: id });
    if (error) toast({ title: "Gagal", description: error.message, variant: "destructive" }); else load();
  };
  const toggleVoucher = async (v: any) => {
    const { error } = await supabase.rpc("seller_voucher_save" as any, { p_visitor_id: visitorId, p: { ...v, is_active: !v.is_active } });
    if (error) toast({ title: "Gagal", description: error.message, variant: "destructive" }); else load();
  };

  const now = new Date(); const later = new Date(Date.now() + 7 * 864e5);
  const newVoucher = () => setForm({ kind: "voucher", code: "", name: "", discount_type: "percent", discount_value: "", min_purchase: 0, max_discount: "", usage_limit: "", per_buyer_limit: 1, product_ids: [], starts_at: local(now), ends_at: local(later), is_active: true });
  const newFlash = () => setForm({ kind: "flash", product_id: products[0]?.id || "", flash_price: "", flash_stock: "", starts_at: local(now), ends_at: local(new Date(Date.now() + 3 * 3600e3)) });
  const newBundle = () => setForm({ kind: "bundle", name: "", description: "", price: "", product_ids: [] });

  const productPicker = () => <div className="max-h-40 overflow-auto rounded-lg border p-1.5 space-y-1">
    {products.map((p) => <label key={p.id} className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={(form.product_ids || []).includes(p.id)} onChange={() => toggleId(p.id)} /><span className="truncate flex-1">{p.title}</span><span className="text-muted-foreground">{rp(p.price)}</span></label>)}
    {!products.length && <p className="text-[10px] text-muted-foreground">Belum ada produk.</p>}
  </div>;

  if (form) return <Card><CardContent className="p-3 space-y-2">
    <p className="text-sm font-black">{form.kind === "voucher" ? (form.id ? "Edit Voucher" : "Buat Voucher") : form.kind === "flash" ? "Buat Flash Sale" : "Buat Paket Hemat"}</p>
    {form.kind === "voucher" && <>
      <div className="grid grid-cols-2 gap-2">
        <Field l="Kode voucher"><Input value={form.code} maxLength={20} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="HEMAT10" /></Field>
        <Field l="Nama promo"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Diskon akhir pekan" /></Field>
        <Field l="Jenis diskon"><select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={form.discount_type} onChange={(e) => set("discount_type", e.target.value)}><option value="percent">Persen (%)</option><option value="amount">Nominal (Rp)</option></select></Field>
        <Field l={form.discount_type === "percent" ? "Diskon (%)" : "Diskon (Rp)"}><Input type="number" inputMode="numeric" value={form.discount_value} onChange={(e) => set("discount_value", e.target.value)} /></Field>
        <Field l="Minimum belanja (Rp)"><Input type="number" inputMode="numeric" value={form.min_purchase} onChange={(e) => set("min_purchase", e.target.value)} /></Field>
        <Field l="Maks. diskon (Rp, opsional)"><Input type="number" inputMode="numeric" value={form.max_discount ?? ""} onChange={(e) => set("max_discount", e.target.value)} /></Field>
        <Field l="Kuota total (opsional)"><Input type="number" inputMode="numeric" value={form.usage_limit ?? ""} onChange={(e) => set("usage_limit", e.target.value)} /></Field>
        <Field l="Batas per pembeli"><Input type="number" inputMode="numeric" value={form.per_buyer_limit} onChange={(e) => set("per_buyer_limit", e.target.value)} /></Field>
        <Field l="Mulai"><Input type="datetime-local" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} /></Field>
        <Field l="Berakhir"><Input type="datetime-local" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} /></Field>
      </div>
      <Field l="Berlaku untuk produk (kosong = semua produk)">{productPicker()}</Field>
    </>}
    {form.kind === "flash" && <div className="grid grid-cols-2 gap-2">
      <div className="col-span-2"><Field l="Produk"><select className="h-10 w-full rounded-md border bg-background px-2 text-sm" value={form.product_id} onChange={(e) => set("product_id", e.target.value)}>{products.map((p) => <option key={p.id} value={p.id}>{p.title} · {rp(p.price)} · stok {p.stock}</option>)}</select></Field></div>
      <Field l="Harga flash (Rp)"><Input type="number" inputMode="numeric" value={form.flash_price} onChange={(e) => set("flash_price", e.target.value)} /></Field>
      <Field l="Stok flash"><Input type="number" inputMode="numeric" value={form.flash_stock} onChange={(e) => set("flash_stock", e.target.value)} /></Field>
      <Field l="Mulai"><Input type="datetime-local" value={form.starts_at} onChange={(e) => set("starts_at", e.target.value)} /></Field>
      <Field l="Selesai"><Input type="datetime-local" value={form.ends_at} onChange={(e) => set("ends_at", e.target.value)} /></Field>
    </div>}
    {form.kind === "bundle" && <>
      <Field l="Nama paket"><Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Paket Hemat Gamer" /></Field>
      <Field l="Deskripsi"><Input value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
      <Field l="Pilih produk (min. 2)">{productPicker()}</Field>
      <p className="text-[10px] text-muted-foreground">Total harga normal: {rp(products.filter((p) => (form.product_ids || []).includes(p.id)).reduce((n, p) => n + Number(p.price), 0))}</p>
      <Field l="Harga paket (Rp)"><Input type="number" inputMode="numeric" value={form.price} onChange={(e) => set("price", e.target.value)} /></Field>
    </>}
    <div className="flex gap-2 pt-1"><Button variant="outline" className="flex-1" onClick={() => setForm(null)}>Batal</Button><Button className="flex-1" disabled={busy} onClick={save}>{busy ? "Menyimpan…" : "Simpan"}</Button></div>
  </CardContent></Card>;

  if (mode === "flash") return <div className="space-y-2">
    <Button className="w-full" onClick={newFlash} disabled={!products.length}><Zap className="w-4 h-4 mr-1" />Buat Flash Sale</Button>
    {flash === null ? <Skeleton className="h-20" /> : !flash.length ? <p className="text-center py-8 text-xs text-muted-foreground">Belum ada flash sale.</p> :
      flash.map((f) => { const ended = new Date(f.ends_at) <= new Date(); return <Card key={f.id}><CardContent className="p-3 space-y-1">
        <div className="flex justify-between gap-2"><p className="text-xs font-bold truncate">⚡ {pname(f.product_id)}</p><Badge variant={ended ? "secondary" : "default"} className="text-[9px]"><Countdown start={f.starts_at} end={f.ends_at} /></Badge></div>
        <p className="text-xs"><span className="line-through text-muted-foreground mr-1">{rp(products.find((p) => p.id === f.product_id)?.price)}</span><b className="text-primary">{rp(f.flash_price)}</b></p>
        <div className="h-1.5 rounded bg-muted overflow-hidden"><div className="h-full bg-primary" style={{ width: `${Math.min(100, (f.sold / f.flash_stock) * 100)}%` }} /></div>
        <div className="flex justify-between items-center"><p className="text-[10px] text-muted-foreground">Terjual {f.sold}/{f.flash_stock}</p><Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => del("flash", f.id)}><Trash2 className="w-3 h-3 mr-1" />Hentikan</Button></div>
      </CardContent></Card>; })}
  </div>;

  return <div className="space-y-2">
    <div className="grid grid-cols-2 gap-1.5">{([["voucher", "Voucher", Ticket], ["bundle", "Paket Hemat", Package]] as const).map(([k, l, I]) =>
      <button key={k} onClick={() => setSub(k)} className={"rounded-xl border p-2 text-[11px] font-bold flex items-center justify-center gap-1 " + (sub === k ? "border-primary bg-primary/10 text-primary" : "border-border")}><I className="w-4 h-4" />{l}</button>)}</div>
    {sub === "voucher" ? <>
      <Button className="w-full" onClick={newVoucher}><Plus className="w-4 h-4 mr-1" />Buat Voucher</Button>
      {vouchers === null ? <Skeleton className="h-20" /> : !vouchers.length ? <p className="text-center py-8 text-xs text-muted-foreground">Belum ada voucher.</p> :
        vouchers.map((v) => { const ended = new Date(v.ends_at) <= new Date(); return <Card key={v.id}><CardContent className="p-3 space-y-1">
          <div className="flex justify-between gap-2"><p className="text-xs font-black">🎟️ {v.code}</p><Badge variant={v.is_active && !ended ? "default" : "secondary"} className="text-[9px]">{ended ? "Berakhir" : v.is_active ? "Aktif" : "Nonaktif"}</Badge></div>
          <p className="text-[11px]">{v.name} · {v.discount_type === "percent" ? `${v.discount_value}%` : rp(v.discount_value)}{v.max_discount ? ` (maks ${rp(v.max_discount)})` : ""}</p>
          <p className="text-[10px] text-muted-foreground">Min. {rp(v.min_purchase)} · Terpakai {v.used_count}{v.usage_limit ? `/${v.usage_limit}` : ""} · {v.product_ids?.length ? `${v.product_ids.length} produk` : "Semua produk"}</p>
          <p className="text-[10px] text-muted-foreground">{new Date(v.starts_at).toLocaleString("id-ID")} – {new Date(v.ends_at).toLocaleString("id-ID")}</p>
          <div className="flex gap-1 pt-1">
            <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1" onClick={() => toggleVoucher(v)}>{v.is_active ? "Nonaktifkan" : "Aktifkan"}</Button>
            <Button size="sm" variant="outline" className="h-7 text-[10px] flex-1" onClick={() => setForm({ ...v, kind: "voucher", product_ids: v.product_ids || [], starts_at: local(new Date(v.starts_at)), ends_at: local(new Date(v.ends_at)) })}>Edit</Button>
            <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => del("voucher", v.id)}><Trash2 className="w-3 h-3" /></Button>
          </div>
        </CardContent></Card>; })}
    </> : <>
      <Button className="w-full" onClick={newBundle} disabled={products.length < 2}><Plus className="w-4 h-4 mr-1" />Buat Paket Hemat</Button>
      {bundles === null ? <Skeleton className="h-20" /> : !bundles.length ? <p className="text-center py-8 text-xs text-muted-foreground">Belum ada paket hemat.</p> :
        bundles.map((b) => { const ids = (b.seller_bundle_items || []).map((i: any) => i.product_id); const normal = products.filter((p) => ids.includes(p.id)).reduce((n, p) => n + Number(p.price), 0);
          return <Card key={b.id}><CardContent className="p-3 space-y-1">
            <div className="flex justify-between gap-2"><p className="text-xs font-black">📦 {b.name}</p><Button size="sm" variant="ghost" className="h-6 text-destructive" onClick={() => del("bundle", b.id)}><Trash2 className="w-3 h-3" /></Button></div>
            <p className="text-[10px] text-muted-foreground">{ids.map(pname).join(" + ")}</p>
            <p className="text-xs"><span className="line-through text-muted-foreground mr-1">{rp(normal)}</span><b className="text-primary">{rp(b.price)}</b></p>
          </CardContent></Card>; })}
    </>}
  </div>;
}
