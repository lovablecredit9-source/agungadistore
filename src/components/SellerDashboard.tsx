import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Store, BadgeCheck, PackagePlus, Wallet, Loader2, Trash2, ImagePlus, X,
  TrendingUp, Eye, ShoppingBag, ArrowDownToLine, RefreshCw,
  Settings2, ClipboardList, Coins, Save, DoorOpen, DoorClosed, Pencil,
} from "lucide-react";
import SellerOrdersPanel from "@/components/seller/SellerOrdersPanel";

const rp = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");
const MAX_IMG = 5;
export const warrantyText = (p: any) =>
  p?.has_warranty ? `${p.warranty_duration_value || 0} ${p.warranty_duration_unit === "year" ? "Tahun" : "Bulan"}` : "";


async function compress(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const max = 720;
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s);
  c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.72);
}

const PSTATUS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};
const PLABEL: Record<string, string> = {
  pending: "⏳ Menunggu review admin",
  approved: "✅ Tayang",
  rejected: "❌ Ditolak",
};

export default function SellerDashboard({ visitorId }: { visitorId: string }) {
  const { toast } = useToast();
  const [store, setStore] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [wds, setWds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"produk" | "tambah" | "saldo" | "pesanan" | "profil" | "pendapatan">("produk");
  const [earnings, setEarnings] = useState<any[]>([]);

  // form profil toko
  const [sName, setSName] = useState("");
  const [sDesc, setSDesc] = useState("");
  const [sWa, setSWa] = useState("");
  const [sHours, setSHours] = useState("");
  const [sOpen, setSOpen] = useState(true);
  const [sClosedNote, setSClosedNote] = useState("");
  const [sAvatar, setSAvatar] = useState<string | null>(null);
  const [sBanner, setSBanner] = useState<string | null>(null);
  const [sSaving, setSSaving] = useState(false);
  const avaRef = useRef<HTMLInputElement>(null);
  const banRef = useRef<HTMLInputElement>(null);

  // edit produk
  const [editId, setEditId] = useState<string | null>(null);
  const [eTitle, setETitle] = useState("");
  const [ePrice, setEPrice] = useState("");
  const [eStock, setEStock] = useState("");
  const [eDesc, setEDesc] = useState("");

  // form produk
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [category, setCategory] = useState("");
  const [wa, setWa] = useState("");
  const [imgs, setImgs] = useState<string[]>([]);
  const [hasWarranty, setHasWarranty] = useState(false);
  const [wValue, setWValue] = useState("1");
  const [wUnit, setWUnit] = useState<"month" | "year">("month");
  const [variants, setVariants] = useState<{ name: string; price: string; stock: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);


  // form withdraw
  const [wdAmount, setWdAmount] = useState("");
  const [wdMethod, setWdMethod] = useState("Dana");
  const [wdName, setWdName] = useState("");
  const [wdNumber, setWdNumber] = useState("");
  const [wdSaving, setWdSaving] = useState(false);

  async function load() {
    setLoading(true);
    const { data: st } = await supabase
      .from("seller_stores" as any).select("*").eq("visitor_id", visitorId).maybeSingle();
    setStore(st || null);
    if (st) {
      const a = st as any;
      setSName(a.store_name || ""); setSDesc(a.description || "");
      setSWa(a.wa_number || ""); setSHours(a.open_hours || "");
      setSOpen(a.is_open !== false); setSClosedNote(a.closed_note || "");
      setSAvatar(a.avatar_url || null); setSBanner(a.banner_url || null);
      const { data: er } = await supabase.from("seller_earnings" as any)
        .select("*").eq("store_id", a.id).order("created_at", { ascending: false }).limit(50);
      setEarnings((er as any[]) || []);
      const [{ data: pr }, { data: wd }] = await Promise.all([
        supabase.from("seller_products" as any).select("*").eq("store_id", (st as any).id).order("created_at", { ascending: false }),
        supabase.from("seller_withdrawals" as any).select("*").eq("store_id", (st as any).id).order("created_at", { ascending: false }).limit(20),
      ]);
      setProducts((pr as any[]) || []);
      setWds((wd as any[]) || []);
      setWa((st as any).wa_number || "");
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, [visitorId]);

  async function pickImgs(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files).slice(0, MAX_IMG - imgs.length)) {
      try { const d = await compress(f); setImgs((p) => [...p, d]); }
      catch { toast({ title: "Gagal memproses foto", variant: "destructive" }); }
    }
  }

  async function addProduct() {
    if (!store) return;
    if (title.trim().length < 3) return toast({ title: "Nama produk minimal 3 karakter", variant: "destructive" });
    if (!Number(price)) return toast({ title: "Harga wajib diisi", variant: "destructive" });
    setSaving(true);
    try {
      const { data: created, error } = await supabase.from("seller_products" as any).insert({
        store_id: store.id,
        visitor_id: visitorId,
        title: title.trim(),
        description: desc.trim(),
        price: Math.round(Number(price)),
        stock: Math.max(0, Math.round(Number(stock) || 0)),
        category: category.trim() || null,
        image_url: imgs[0] || null,
        images: imgs,
        wa_number: null,
        has_warranty: hasWarranty,
        warranty_duration_value: hasWarranty ? Math.max(0, Math.round(Number(wValue) || 0)) : 0,
        warranty_duration_unit: wUnit,
        status: "pending",
      } as any).select("id").maybeSingle();
      if (error) throw error;
      const vs = variants.filter((v) => v.name.trim());
      if (created && vs.length > 0) {
        await supabase.from("seller_product_variants" as any).insert(
          vs.map((v) => ({
            product_id: (created as any).id,
            name: v.name.trim(),
            price: Math.round(Number(v.price) || Number(price) || 0),
            stock: Math.max(0, Math.round(Number(v.stock) || 0)),
          })) as any
        );
      }
      toast({ title: "✅ Produk dikirim", description: "Menunggu review admin sebelum tayang." });
      setTitle(""); setDesc(""); setPrice(""); setStock("1"); setCategory(""); setImgs([]);
      setHasWarranty(false); setWValue("1"); setWUnit("month"); setVariants([]);
      setView("produk");
      await load();

    } catch (e: any) {
      toast({ title: "Gagal menambah produk", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  async function saveStore() {
    if (!store) return;
    if (sName.trim().length < 3) return toast({ title: "Nama toko minimal 3 karakter", variant: "destructive" });
    setSSaving(true);
    try {
      const { error } = await supabase.from("seller_stores" as any).update({
        store_name: sName.trim(),
        description: sDesc.trim() || null,
        wa_number: sWa.trim() || null,
        open_hours: sHours.trim() || null,
        is_open: sOpen,
        closed_note: sClosedNote.trim() || null,
        avatar_url: sAvatar,
        banner_url: sBanner,
        updated_at: new Date().toISOString(),
      } as any).eq("id", store.id);
      if (error) throw error;
      toast({ title: "✅ Profil toko disimpan" });
      await load();
    } catch (e: any) {
      toast({ title: "Gagal menyimpan", description: e.message, variant: "destructive" });
    } finally { setSSaving(false); }
  }

  function startEdit(p: any) {
    setEditId(p.id); setETitle(p.title || ""); setEPrice(String(p.price || ""));
    setEStock(String(p.stock ?? "0")); setEDesc(p.description || "");
  }

  async function saveEdit() {
    if (!editId) return;
    const { error } = await supabase.from("seller_products" as any).update({
      title: eTitle.trim(),
      description: eDesc.trim(),
      price: Math.round(Number(ePrice) || 0),
      stock: Math.max(0, Math.round(Number(eStock) || 0)),
      updated_at: new Date().toISOString(),
    } as any).eq("id", editId);
    if (error) return toast({ title: "Gagal menyimpan produk", description: error.message, variant: "destructive" });
    toast({ title: "✅ Produk diperbarui" });
    setEditId(null); load();
  }

  async function delProduct(id: string) {
    const { error } = await supabase.from("seller_products" as any).delete().eq("id", id);
    if (error) toast({ title: "Gagal hapus", description: error.message, variant: "destructive" });
    else { toast({ title: "Produk dihapus" }); load(); }
  }

  async function toggleActive(p: any) {
    await supabase.from("seller_products" as any).update({ is_active: !p.is_active, updated_at: new Date().toISOString() } as any).eq("id", p.id);
    load();
  }

  async function requestWd() {
    if (!store) return;
    const amt = Math.round(Number(wdAmount) || 0);
    if (amt < 10000) return toast({ title: "Minimal penarikan Rp 10.000", variant: "destructive" });
    if (amt > (store.balance || 0)) return toast({ title: "Saldo tidak cukup", variant: "destructive" });
    if (!wdName.trim() || !wdNumber.trim()) return toast({ title: "Nama & nomor tujuan wajib diisi", variant: "destructive" });
    setWdSaving(true);
    try {
      const { error } = await supabase.from("seller_withdrawals" as any).insert({
        store_id: store.id, visitor_id: visitorId, amount: amt,
        method: wdMethod, account_name: wdName.trim(), account_number: wdNumber.trim(),
      } as any);
      if (error) throw error;
      toast({ title: "✅ Permintaan penarikan dikirim", description: "Admin akan memproses maksimal 1x24 jam." });
      setWdAmount(""); setWdName(""); setWdNumber("");
      await load();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally { setWdSaving(false); }
  }

  if (loading) return <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>;
  if (!store) return null;

  const pending = wds.filter((w) => w.status === "pending").reduce((a, b) => a + (b.amount || 0), 0);

  return (
    <div className="space-y-3">
      {/* Kartu toko */}
      <Card className="border-teal-400/30 bg-gradient-to-br from-slate-900/80 via-teal-950/40 to-slate-900/80">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-500/15 border border-teal-400/30 grid place-items-center">
              <Store className="w-6 h-6 text-teal-300" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="font-black truncate">{store.store_name}</p>
                {store.is_verified ? (
                  <BadgeCheck className="w-4 h-4 text-sky-400 shrink-0" />
                ) : (
                  <Badge variant="outline" className="text-[9px] h-4 px-1">belum terverifikasi</Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Toko #{store.store_number} · fee {store.fee_percent}%</p>
            </div>
            <Button size="sm" variant="outline" onClick={load} className="h-8"><RefreshCw className="w-3.5 h-3.5" /></Button>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-400/25 p-2">
              <p className="text-[10px] text-emerald-300">Saldo</p>
              <p className="text-sm font-black text-emerald-200">{rp(store.balance)}</p>
            </div>
            <div className="rounded-xl bg-cyan-500/10 border border-cyan-400/25 p-2">
              <p className="text-[10px] text-cyan-300">Total Jualan</p>
              <p className="text-sm font-black text-cyan-200">{store.total_sales || 0}</p>
            </div>
            <div className="rounded-xl bg-fuchsia-500/10 border border-fuchsia-400/25 p-2">
              <p className="text-[10px] text-fuchsia-300">Produk</p>
              <p className="text-sm font-black text-fuchsia-200">{products.length}</p>
            </div>
          </div>
          {!store.is_verified && (
            <p className="text-[10px] text-muted-foreground">
              💡 Centang biru diberikan admin untuk toko aktif & tanpa laporan penipuan.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Nav */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { k: "produk", l: "Produk Saya", i: ShoppingBag },
          { k: "tambah", l: "Tambah Produk", i: PackagePlus },
          { k: "pesanan", l: "Pesanan Masuk", i: ClipboardList },
          { k: "profil", l: "Profil Toko", i: Settings2 },
          { k: "pendapatan", l: "Pendapatan", i: Coins },
          { k: "saldo", l: "Tarik Saldo", i: Wallet },
        ] as const).map((t) => (
          <button
            key={t.k}
            onClick={() => setView(t.k)}
            className={`rounded-xl border p-2 text-[11px] font-bold flex flex-col items-center gap-1 transition ${
              view === t.k ? "border-teal-400/60 bg-teal-500/15 text-teal-200" : "border-border bg-card/50 text-muted-foreground"
            }`}
          >
            <t.i className="w-4 h-4" /> {t.l}
          </button>
        ))}
      </div>

      {view === "produk" && (
        <Card className="bg-card/50 border-border">
          <CardContent className="p-3 space-y-2">
            {products.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">Belum ada produk. Tambah produk pertamamu!</p>
            ) : products.map((p) => (
              <div key={p.id} className="flex gap-3 rounded-xl border border-border bg-background/40 p-2">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.title} loading="lazy" className="w-16 h-16 rounded-lg object-cover" />
                ) : <div className="w-16 h-16 rounded-lg bg-muted grid place-items-center"><ImagePlus className="w-5 h-5 opacity-40" /></div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{p.title}</p>
                  <p className="text-xs text-emerald-300 font-bold">{rp(p.price)} · stok {p.stock}</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <Badge variant="outline" className={`text-[9px] ${PSTATUS[p.status] || ""}`}>{PLABEL[p.status] || p.status}</Badge>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Eye className="w-3 h-3" />{p.views || 0}</span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />{p.sold_count || 0}</span>
                    {p.has_warranty && <Badge variant="outline" className="text-[9px] text-sky-300 border-sky-400/30">🛡️ Garansi {warrantyText(p)}</Badge>}

                  </div>
                  {p.admin_note && <p className="text-[10px] text-rose-300 mt-1">Catatan admin: {p.admin_note}</p>}
                </div>
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => startEdit(p)}>
                    <Pencil className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => toggleActive(p)}>
                    {p.is_active ? "Sembunyikan" : "Tampilkan"}
                  </Button>
                  <Button size="sm" variant="destructive" className="h-7" onClick={() => delProduct(p.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {view === "tambah" && (
        <Card className="bg-card/50 border-border">
          <CardContent className="p-3 space-y-2">
            <Input placeholder="Nama produk" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
            <Textarea placeholder="Deskripsi produk" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={800} rows={3} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Harga (Rp)" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
              <Input placeholder="Stok" inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))} />
            </div>
            <Input placeholder="Kategori" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={30} />
            <div className="flex flex-wrap gap-2">
              {imgs.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt={`foto ${i + 1}`} className="w-16 h-16 rounded-lg object-cover" />
                  <button onClick={() => setImgs((p) => p.filter((_, x) => x !== i))}
                    className="absolute -top-1 -right-1 bg-rose-500 rounded-full p-0.5"><X className="w-3 h-3 text-white" /></button>
                </div>
              ))}
              {imgs.length < MAX_IMG && (
                <button onClick={() => fileRef.current?.click()}
                  className="w-16 h-16 rounded-lg border border-dashed border-teal-400/40 grid place-items-center text-teal-300">
                  <ImagePlus className="w-5 h-5" />
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => pickImgs(e.target.files)} />
            </div>

            {/* Garansi */}
            <div className="rounded-xl border border-border bg-background/40 p-2.5 space-y-2">
              <label className="flex items-center gap-2 text-xs font-bold">
                <input type="checkbox" checked={hasWarranty} onChange={(e) => setHasWarranty(e.target.checked)} />
                🛡️ Produk bergaransi
              </label>
              {hasWarranty && (
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Lama garansi" inputMode="numeric" value={wValue}
                    onChange={(e) => setWValue(e.target.value.replace(/\D/g, ""))} />
                  <select value={wUnit} onChange={(e) => setWUnit(e.target.value as "month" | "year")}
                    className="h-10 rounded-md border bg-background px-2 text-sm">
                    <option value="month">Bulan</option>
                    <option value="year">Tahun</option>
                  </select>
                </div>
              )}
            </div>

            {/* Variasi produk */}
            <div className="rounded-xl border border-border bg-background/40 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold">🎨 Variasi produk (opsional)</p>
                <Button size="sm" variant="outline" className="h-7 text-[10px]"
                  onClick={() => setVariants((v) => [...v, { name: "", price: price, stock: "1" }])}>
                  + Tambah variasi
                </Button>
              </div>
              {variants.map((v, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    <Input className="h-8 text-xs" placeholder="Nama (mis. Merah)" value={v.name}
                      onChange={(e) => setVariants((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} />
                    <Input className="h-8 text-xs" placeholder="Harga" inputMode="numeric" value={v.price}
                      onChange={(e) => setVariants((p) => p.map((x, j) => j === i ? { ...x, price: e.target.value.replace(/\D/g, "") } : x))} />
                    <Input className="h-8 text-xs" placeholder="Stok" inputMode="numeric" value={v.stock}
                      onChange={(e) => setVariants((p) => p.map((x, j) => j === i ? { ...x, stock: e.target.value.replace(/\D/g, "") } : x))} />
                  </div>
                  <Button size="sm" variant="destructive" className="h-8"
                    onClick={() => setVariants((p) => p.filter((_, j) => j !== i))}><X className="w-3 h-3" /></Button>
                </div>
              ))}
              {variants.length === 0 && <p className="text-[10px] text-muted-foreground">Contoh: ukuran, warna, atau paket berbeda harga.</p>}
            </div>

            <Button className="w-full" onClick={addProduct} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><PackagePlus className="w-4 h-4 mr-1" /> Kirim Produk untuk Review</>}
            </Button>
            <p className="text-[10px] text-muted-foreground">Produk tayang setelah disetujui admin. Dilarang menjual barang ilegal/akun curian — melanggar = toko dibanned.</p>
          </CardContent>
        </Card>
      )}

      {view === "produk" && editId && (
        <Card className="bg-card/50 border-teal-400/40">
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-black">✏️ Edit Produk</p>
            <Input placeholder="Nama produk" value={eTitle} onChange={(e) => setETitle(e.target.value)} maxLength={80} />
            <Textarea rows={3} placeholder="Deskripsi" value={eDesc} onChange={(e) => setEDesc(e.target.value)} maxLength={800} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Harga" inputMode="numeric" value={ePrice} onChange={(e) => setEPrice(e.target.value.replace(/\D/g, ""))} />
              <Input placeholder="Stok" inputMode="numeric" value={eStock} onChange={(e) => setEStock(e.target.value.replace(/\D/g, ""))} />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={saveEdit}><Save className="w-4 h-4 mr-1" /> Simpan</Button>
              <Button variant="outline" onClick={() => setEditId(null)}>Batal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {view === "pesanan" && <SellerOrdersPanel key={store.id} storeId={store.id} visitorId={visitorId} />}

      {view === "profil" && (
        <Card className="bg-card/50 border-border">
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-black">🏪 Edit Profil Toko</p>
            <div className="rounded-xl overflow-hidden border border-border">
              {sBanner ? <img src={sBanner} alt="Banner toko" className="w-full h-24 object-cover" />
                : <div className="w-full h-24 bg-gradient-to-r from-teal-600/40 to-cyan-600/40" />}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8 text-[10px]" onClick={() => banRef.current?.click()}>
                <ImagePlus className="w-3.5 h-3.5 mr-1" /> Ganti Banner
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-[10px]" onClick={() => avaRef.current?.click()}>
                <ImagePlus className="w-3.5 h-3.5 mr-1" /> Ganti Logo
              </Button>
              {sAvatar && <img src={sAvatar} alt="Logo toko" className="w-8 h-8 rounded-lg object-cover" />}
              <input ref={banRef} type="file" accept="image/*" hidden
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) setSBanner(await compress(f)); }} />
              <input ref={avaRef} type="file" accept="image/*" hidden
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) setSAvatar(await compress(f)); }} />
            </div>
            <Input placeholder="Nama toko" value={sName} onChange={(e) => setSName(e.target.value)} maxLength={50} />
            <Textarea rows={3} placeholder="Deskripsi toko" value={sDesc} onChange={(e) => setSDesc(e.target.value)} maxLength={400} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="No WA toko" value={sWa} onChange={(e) => setSWa(e.target.value)} maxLength={20} />
              <Input placeholder="Jam buka (mis. 08.00-21.00)" value={sHours} onChange={(e) => setSHours(e.target.value)} maxLength={40} />
            </div>
            <div className="rounded-xl border border-border bg-background/40 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold flex items-center gap-1">
                  {sOpen ? <DoorOpen className="w-4 h-4 text-emerald-400" /> : <DoorClosed className="w-4 h-4 text-rose-400" />}
                  Status toko
                </p>
                <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setSOpen((v) => !v)}>
                  {sOpen ? "Buka ✅" : "Tutup ❌"}
                </Button>
              </div>
              {!sOpen && (
                <Input placeholder="Catatan tutup (mis. libur sampai Senin)" value={sClosedNote}
                  onChange={(e) => setSClosedNote(e.target.value)} maxLength={120} />
              )}
            </div>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              📅 Terdaftar {new Date(store.created_at).toLocaleDateString("id-ID", { dateStyle: "long" } as any)}
            </p>
            <Button className="w-full" onClick={saveStore} disabled={sSaving}>
              {sSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-1" /> Simpan Profil Toko</>}
            </Button>
          </CardContent>
        </Card>
      )}

      {view === "pendapatan" && (
        <Card className="bg-card/50 border-border">
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-black">💰 Riwayat Pendapatan</p>
            {earnings.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-6">Belum ada pendapatan masuk.</p>
            ) : earnings.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-border bg-background/40 p-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{e.note || "Pesanan"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(e.created_at).toLocaleString("id-ID")} · fee {rp(e.fee)}
                  </p>
                </div>
                <p className="text-sm font-black text-emerald-300 shrink-0">+{rp(e.net)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {view === "saldo" && (
        <Card className="bg-card/50 border-border">
          <CardContent className="p-3 space-y-2">
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3">
              <p className="text-[11px] text-emerald-300">Saldo tersedia</p>
              <p className="text-xl font-black text-emerald-200">{rp(store.balance)}</p>
              {pending > 0 && <p className="text-[10px] text-yellow-300 mt-1">Sedang diproses: {rp(pending)}</p>}
            </div>
            <Input placeholder="Nominal penarikan (min Rp 10.000)" inputMode="numeric" value={wdAmount}
              onChange={(e) => setWdAmount(e.target.value.replace(/\D/g, ""))} />
            <div className="grid grid-cols-2 gap-2">
              <select value={wdMethod} onChange={(e) => setWdMethod(e.target.value)}
                className="h-10 rounded-md border bg-background px-2 text-sm">
                {["Dana", "GoPay", "OVO", "ShopeePay", "Bank BCA", "Bank BRI", "Bank BNI", "Bank Mandiri"].map((m) => <option key={m}>{m}</option>)}
              </select>
              <Input placeholder="Nomor tujuan" value={wdNumber} onChange={(e) => setWdNumber(e.target.value)} maxLength={30} />
            </div>
            <Input placeholder="Nama pemilik rekening" value={wdName} onChange={(e) => setWdName(e.target.value)} maxLength={60} />
            <Button className="w-full" onClick={requestWd} disabled={wdSaving}>
              {wdSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowDownToLine className="w-4 h-4 mr-1" /> Ajukan Penarikan</>}
            </Button>
            <div className="space-y-1.5 pt-1">
              {wds.map((w) => (
                <div key={w.id} className="flex items-center justify-between rounded-lg border border-border bg-background/40 p-2">
                  <div>
                    <p className="text-xs font-bold">{rp(w.amount)} · {w.method}</p>
                    <p className="text-[10px] text-muted-foreground">#{w.wd_number} · {new Date(w.created_at).toLocaleString("id-ID")}</p>
                    {w.admin_note && <p className="text-[10px] text-rose-300">{w.admin_note}</p>}
                  </div>
                  <Badge variant="outline" className={`text-[9px] ${
                    w.status === "paid" ? "text-emerald-400 border-emerald-500/30"
                      : w.status === "rejected" ? "text-rose-400 border-rose-500/30"
                        : "text-yellow-400 border-yellow-500/30"}`}>
                    {w.status === "paid" ? "✅ Dibayar" : w.status === "rejected" ? "❌ Ditolak" : "⏳ Diproses"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
