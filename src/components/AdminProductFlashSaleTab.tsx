import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Loader2, Zap, Edit2, X, Clock, Package } from "lucide-react";

type Mode = "discount_percent" | "fixed_price";

interface Product {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
}

interface FlashSale {
  id: string;
  product_id: string;
  mode: Mode;
  discount_percent: number | null;
  flash_price: number | null;
  quota: number;
  sold: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  product?: Product | null;
}

const formatPrice = (n: number) => "Rp " + (n || 0).toLocaleString("id-ID");

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

function fromLocalInput(local: string) {
  return new Date(local).toISOString();
}

function emptyForm(): Omit<FlashSale, "id" | "sold" | "product"> {
  const now = new Date();
  const end = new Date(Date.now() + 24 * 3600 * 1000);
  return {
    product_id: "",
    mode: "discount_percent",
    discount_percent: 30,
    flash_price: null,
    quota: 50,
    starts_at: toLocalInput(now.toISOString()),
    ends_at: toLocalInput(end.toISOString()),
    is_active: true,
  };
}

export default function AdminProductFlashSaleTab() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<FlashSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm());

  // Durasi cepat (jam/hari/menit) — admin bisa pilih, ends_at otomatis dihitung dari starts_at
  const [quickDuration, setQuickDuration] = useState<{ value: number; unit: "minute" | "hour" | "day" } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [prodRes, saleRes] = await Promise.all([
        supabase.from("products").select("id, title, price, image_url, short_id").order("title"),
        supabase.from("store_flash_sales").select("*").order("created_at", { ascending: false }),
      ]);
      const prods = (prodRes.data || []) as Product[];
      setProducts(prods);
      const list = (saleRes.data || []) as FlashSale[];
      const map = new Map(prods.map((p) => [p.id, p]));
      setSales(list.map((s) => ({ ...s, product: map.get(s.product_id) || null })));
    } catch (e: any) {
      toast({ title: "Gagal memuat", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setQuickDuration({ value: 24, unit: "hour" });
    setShowForm(true);
  }

  function openEdit(s: FlashSale) {
    setEditingId(s.id);
    setForm({
      product_id: s.product_id,
      mode: s.mode,
      discount_percent: s.discount_percent ?? 0,
      flash_price: s.flash_price ?? 0,
      quota: s.quota,
      starts_at: toLocalInput(s.starts_at),
      ends_at: toLocalInput(s.ends_at),
      is_active: s.is_active,
    });
    setQuickDuration(null);
    setShowForm(true);
  }

  function applyQuick(value: number, unit: "minute" | "hour" | "day") {
    setQuickDuration({ value, unit });
    const start = new Date(form.starts_at);
    const ms = value * (unit === "minute" ? 60000 : unit === "hour" ? 3600000 : 86400000);
    const end = new Date(start.getTime() + ms);
    setForm((f) => ({ ...f, ends_at: toLocalInput(end.toISOString()) }));
  }

  async function save() {
    if (!form.product_id) {
      toast({ title: "Pilih produk dulu", variant: "destructive" });
      return;
    }
    if (form.mode === "discount_percent" && (!form.discount_percent || form.discount_percent < 1 || form.discount_percent > 99)) {
      toast({ title: "Diskon harus 1–99%", variant: "destructive" });
      return;
    }
    if (form.mode === "fixed_price" && (form.flash_price == null || form.flash_price < 0)) {
      toast({ title: "Harga flash sale tidak valid", variant: "destructive" });
      return;
    }
    if (new Date(form.ends_at) <= new Date(form.starts_at)) {
      toast({ title: "Waktu berakhir harus setelah waktu mulai", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        product_id: form.product_id,
        mode: form.mode,
        discount_percent: form.mode === "discount_percent" ? form.discount_percent : null,
        flash_price: form.mode === "fixed_price" ? form.flash_price : null,
        quota: Math.max(0, Math.floor(form.quota || 0)),
        starts_at: fromLocalInput(form.starts_at),
        ends_at: fromLocalInput(form.ends_at),
        is_active: form.is_active,
      };
      if (editingId) {
        const { error } = await supabase.from("store_flash_sales").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Flash sale diperbarui ✨" });
      } else {
        const { error } = await supabase.from("store_flash_sales").insert(payload);
        if (error) throw error;
        toast({ title: "Flash sale dibuat ⚡" });
      }
      setShowForm(false);
      await load();
    } catch (e: any) {
      toast({ title: "Gagal menyimpan", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Hapus flash sale ini?")) return;
    try {
      const { error } = await supabase.from("store_flash_sales").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Flash sale dihapus" });
      await load();
    } catch (e: any) {
      toast({ title: "Gagal hapus", description: e.message, variant: "destructive" });
    }
  }

  async function toggleActive(s: FlashSale) {
    try {
      const { error } = await supabase.from("store_flash_sales").update({ is_active: !s.is_active }).eq("id", s.id);
      if (error) throw error;
      await load();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    }
  }

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === form.product_id) || null,
    [products, form.product_id]
  );

  const previewPrice = useMemo(() => {
    if (!selectedProduct) return null;
    if (form.mode === "discount_percent" && form.discount_percent) {
      return Math.max(0, Math.round(selectedProduct.price * (1 - form.discount_percent / 100)));
    }
    if (form.mode === "fixed_price") return form.flash_price ?? 0;
    return null;
  }, [selectedProduct, form]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-md">
            <Zap className="w-5 h-5 text-white" fill="white" />
          </div>
          <div>
            <h2 className="text-sm font-black">Flash Sale Produk</h2>
            <p className="text-[10px] text-muted-foreground">Atur diskon kilat untuk produk toko</p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate} className="h-8 bg-gradient-to-r from-orange-500 to-red-500 text-white">
          <Plus className="w-3.5 h-3.5 mr-1" /> Baru
        </Button>
      </div>

      {/* List */}
      {sales.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-xs text-muted-foreground">
            Belum ada flash sale. Klik <span className="font-bold">Baru</span> untuk membuat.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sales.map((s) => {
            const now = Date.now();
            const start = new Date(s.starts_at).getTime();
            const end = new Date(s.ends_at).getTime();
            const live = s.is_active && now >= start && now < end && s.sold < s.quota;
            const upcoming = s.is_active && now < start;
            const expired = now >= end || (s.sold >= s.quota && s.quota > 0);
            const status = expired ? "Berakhir" : live ? "Live" : upcoming ? "Terjadwal" : "Nonaktif";
            const statusColor = expired
              ? "bg-muted text-muted-foreground"
              : live
              ? "bg-emerald-500 text-white"
              : upcoming
              ? "bg-amber-500 text-white"
              : "bg-muted text-muted-foreground";

            const orig = s.product?.price ?? 0;
            const flash = s.mode === "discount_percent"
              ? Math.max(0, Math.round(orig * (1 - (s.discount_percent ?? 0) / 100)))
              : s.flash_price ?? 0;

            return (
              <Card key={s.id} className="overflow-hidden">
                <CardContent className="p-3">
                  <div className="flex gap-3">
                    <div className="w-14 h-14 rounded-xl bg-muted overflow-hidden shrink-0">
                      {s.product?.image_url ? (
                        <img src={s.product.image_url} alt={s.product.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <Package className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-black truncate">{s.product?.title || "Produk dihapus"}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] line-through text-muted-foreground">{formatPrice(orig)}</span>
                            <span className="text-[11px] font-black text-red-500">{formatPrice(flash)}</span>
                            {s.mode === "discount_percent" && (
                              <Badge className="h-4 text-[9px] bg-red-500 hover:bg-red-500">-{s.discount_percent}%</Badge>
                            )}
                          </div>
                        </div>
                        <Badge className={`text-[9px] h-4 ${statusColor} hover:${statusColor}`}>{status}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(s.starts_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</span>
                        <span>→</span>
                        <span>{new Date(s.ends_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</span>
                      </div>
                      <div className="mt-1.5">
                        <div className="flex items-center justify-between text-[10px] mb-0.5">
                          <span className="font-bold">Kuota</span>
                          <span className="font-black text-orange-500">{s.sold}/{s.quota}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-orange-500 to-red-500"
                            style={{ width: `${s.quota ? Math.min(100, (s.sold / s.quota) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => openEdit(s)}>
                          <Edit2 className="w-3 h-3 mr-1" /> Edit
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => toggleActive(s)}>
                          {s.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px] text-red-500 ml-auto" onClick={() => remove(s.id)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <Card className="border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-red-500/5">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-orange-500" />
                {editingId ? "Edit Flash Sale" : "Flash Sale Baru"}
              </h3>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setShowForm(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold">Produk</Label>
              <Select value={form.product_id} onValueChange={(v) => setForm((f) => ({ ...f, product_id: v }))}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      {p.title} — {formatPrice(p.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold">Mode Harga</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {(["discount_percent", "fixed_price"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, mode: m }))}
                    className={`h-9 rounded-lg text-[11px] font-black border transition active:scale-95 ${
                      form.mode === m
                        ? "bg-gradient-to-r from-orange-500 to-red-500 text-white border-transparent"
                        : "bg-card text-foreground border-border"
                    }`}
                  >
                    {m === "discount_percent" ? "Diskon %" : "Harga Manual"}
                  </button>
                ))}
              </div>
            </div>

            {form.mode === "discount_percent" ? (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold">Diskon (%)</Label>
                <Input
                  type="number" min={1} max={99}
                  value={form.discount_percent ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, discount_percent: parseInt(e.target.value) || 0 }))}
                  className="h-9 text-xs"
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold">Harga Flash Sale (Rp)</Label>
                <Input
                  type="number" min={0}
                  value={form.flash_price ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, flash_price: parseInt(e.target.value) || 0 }))}
                  className="h-9 text-xs"
                />
              </div>
            )}

            {previewPrice != null && selectedProduct && (
              <div className="rounded-lg bg-card border border-border p-2 flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">Preview harga</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] line-through text-muted-foreground">{formatPrice(selectedProduct.price)}</span>
                  <span className="text-xs font-black text-red-500">{formatPrice(previewPrice)}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold">Kuota Khusus Flash Sale</Label>
              <Input
                type="number" min={0}
                value={form.quota}
                onChange={(e) => setForm((f) => ({ ...f, quota: parseInt(e.target.value) || 0 }))}
                className="h-9 text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Setelah kuota habis, harga kembali normal.</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold">Mulai</Label>
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold">Berakhir</Label>
                <Input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => { setForm((f) => ({ ...f, ends_at: e.target.value })); setQuickDuration(null); }}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-bold">Durasi Cepat</Label>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { v: 15, u: "minute" as const, lbl: "15 Menit" },
                  { v: 30, u: "minute" as const, lbl: "30 Menit" },
                  { v: 1, u: "hour" as const, lbl: "1 Jam" },
                  { v: 3, u: "hour" as const, lbl: "3 Jam" },
                  { v: 6, u: "hour" as const, lbl: "6 Jam" },
                  { v: 12, u: "hour" as const, lbl: "12 Jam" },
                  { v: 1, u: "day" as const, lbl: "1 Hari" },
                  { v: 3, u: "day" as const, lbl: "3 Hari" },
                  { v: 7, u: "day" as const, lbl: "7 Hari" },
                ]).map((d) => {
                  const active = quickDuration?.value === d.v && quickDuration?.unit === d.u;
                  return (
                    <button
                      key={d.lbl}
                      type="button"
                      onClick={() => applyQuick(d.v, d.u)}
                      className={`h-7 px-2.5 rounded-full text-[10px] font-black border transition active:scale-95 ${
                        active
                          ? "bg-gradient-to-r from-orange-500 to-red-500 text-white border-transparent"
                          : "bg-card text-foreground border-border"
                      }`}
                    >
                      {d.lbl}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg bg-card border border-border px-3 py-2">
              <Label className="text-[11px] font-bold m-0">Aktif</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 h-9" onClick={() => setShowForm(false)}>
                Batal
              </Button>
              <Button
                className="flex-1 h-9 bg-gradient-to-r from-orange-500 to-red-500 text-white"
                onClick={save}
                disabled={saving}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : (<><Save className="w-3.5 h-3.5 mr-1" /> Simpan</>)}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
