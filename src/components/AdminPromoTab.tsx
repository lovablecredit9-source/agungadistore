import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Tag, Clock, Save, Loader2, Zap, Coins, Flame, HardDrive, Sparkles, ShoppingBag, Megaphone, Plus, Trash2, Edit2, Check, X, Package } from "lucide-react";

interface PromoSetting {
  key: string;
  label: string;
  icon: React.ReactNode;
  suffix: string;
  type: "number" | "datetime-local" | "text";
}

interface PackageItem {
  id: string;
  label?: string;
  name?: string;
  credits?: number;
  price: number;
  is_unlimited?: boolean;
  unlimited_days?: number;
  days?: number;
  storage_mb?: number;
  is_active: boolean;
  sort_order: number;
}

const EXTRA_SETTINGS: PromoSetting[] = [
  { key: "promo_product_discount", label: "Diskon Produk (%)", icon: <ShoppingBag className="w-4 h-4" />, suffix: "%", type: "number" },
  { key: "promo_sponsor_discount", label: "Diskon Sponsor (%)", icon: <Megaphone className="w-4 h-4" />, suffix: "%", type: "number" },
  { key: "promo_storage_discount", label: "Diskon Storage (%)", icon: <HardDrive className="w-4 h-4" />, suffix: "%", type: "number" },
  { key: "promo_credit_discount", label: "Diskon Kredit Game (%)", icon: <Coins className="w-4 h-4" />, suffix: "%", type: "number" },
  { key: "promo_streak_discount", label: "Diskon Streak (%)", icon: <Flame className="w-4 h-4" />, suffix: "%", type: "number" },
];

const FLASH_SETTINGS = [
  { key: "flash_sale_end", label: "Flash Sale Berakhir", icon: <Clock className="w-4 h-4" />, suffix: "", type: "datetime-local" as const },
  { key: "flash_sale_label", label: "Label Flash Sale", icon: <Tag className="w-4 h-4" />, suffix: "", type: "text" as const },
];

const ALL_SETTINGS = [...EXTRA_SETTINGS, ...FLASH_SETTINGS];

export default function AdminPromoTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [creditPkgs, setCreditPkgs] = useState<PackageItem[]>([]);
  const [streakPkgs, setStreakPkgs] = useState<PackageItem[]>([]);
  const [storagePkgs, setStoragePkgs] = useState<PackageItem[]>([]);
  const [bundlePkgs, setBundlePkgs] = useState<any[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [addType, setAddType] = useState<string | null>(null);
  const [newForm, setNewForm] = useState<any>({});

  const { toast } = useToast();

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [s, c, st, stor, bun] = await Promise.all([
      supabase.from("admin_settings").select("*"),
      supabase.from("credit_packages" as any).select("*").order("sort_order", { ascending: true }),
      supabase.from("streak_packages" as any).select("*").order("sort_order", { ascending: true }),
      supabase.from("storage_packages" as any).select("*").order("sort_order", { ascending: true }),
      supabase.from("bundle_packages" as any).select("*").order("sort_order", { ascending: true }),
    ]);
    if (s.data) {
      const map: Record<string, string> = {};
      (s.data as any[]).forEach(r => { map[r.setting_key] = r.setting_value; });
      setValues(map);
    }
    if (c.data) setCreditPkgs(c.data as any[]);
    if (st.data) setStreakPkgs(st.data as any[]);
    if (stor.data) setStoragePkgs(stor.data as any[]);
    if (bun.data) setBundlePkgs(bun.data as any[]);
    setLoading(false);
  }

  async function saveSetting(key: string, value: string) {
    const { data: existing } = await supabase.from("admin_settings").select("id").eq("setting_key", key).maybeSingle();
    if (existing) {
      await supabase.from("admin_settings").update({ setting_value: value }).eq("setting_key", key);
    } else {
      await supabase.from("admin_settings").insert({ setting_key: key, setting_value: value } as any);
    }
  }

  async function handleSaveSettings() {
    setSaving(true);
    try {
      for (const setting of ALL_SETTINGS) {
        const val = values[setting.key];
        if (val !== undefined && val !== "") await saveSetting(setting.key, val);
      }
      toast({ title: "✅ Pengaturan disimpan!" });
    } catch {
      toast({ title: "Gagal menyimpan", variant: "destructive" });
    }
    setSaving(false);
  }

  async function handleClearFlashSale() {
    await supabase.from("admin_settings").update({ setting_value: "" }).eq("setting_key", "flash_sale_end");
    setValues(v => ({ ...v, flash_sale_end: "" }));
    toast({ title: "Flash sale dinonaktifkan" });
  }

  // Generic CRUD helpers
  async function handleDelete(table: string, id: string) {
    if (!confirm("Hapus paket ini?")) return;
    await supabase.from(table as any).delete().eq("id", id);
    toast({ title: "Paket dihapus" });
    fetchAll();
  }

  async function handleToggle(table: string, item: PackageItem) {
    await supabase.from(table as any).update({ is_active: !item.is_active } as any).eq("id", item.id);
    fetchAll();
  }

  function startEdit(item: PackageItem) {
    setEditingId(item.id);
    setEditForm({ ...item });
  }

  async function handleSaveEdit(table: string) {
    const { id, created_at, updated_at, ...rest } = editForm;
    await supabase.from(table as any).update(rest as any).eq("id", id);
    setEditingId(null);
    toast({ title: "✅ Paket diperbarui!" });
    fetchAll();
  }

  async function handleAdd(table: string, data: any) {
    const { error } = await supabase.from(table as any).insert(data as any);
    if (error) {
      toast({ title: "Gagal menambah", variant: "destructive" });
    } else {
      toast({ title: "✅ Paket ditambahkan!" });
      setAddType(null);
      setNewForm({});
      fetchAll();
    }
  }

  const isFlashSaleActive = values.flash_sale_end && new Date(values.flash_sale_end) > new Date();

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  // Reusable package list renderer
  function renderPackageList(
    items: PackageItem[],
    table: string,
    type: "credit" | "streak" | "storage",
    renderLabel: (item: PackageItem) => string,
    renderSub: (item: PackageItem) => string,
  ) {
    return (
      <div className="space-y-2">
        {items.map(item => (
          <div key={item.id} className={`border rounded-lg p-3 ${!item.is_active ? 'opacity-50' : ''}`}>
            {editingId === item.id ? (
              <div className="space-y-2">
                <Input
                  placeholder="Label/Nama"
                  value={editForm.label || editForm.name || ""}
                  onChange={e => setEditForm((f: any) => type === "credit" ? { ...f, label: e.target.value } : { ...f, name: e.target.value })}
                  className="text-xs h-8"
                />
                <div className="grid grid-cols-2 gap-2">
                  {type === "credit" && !editForm.is_unlimited && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Jumlah Kredit</label>
                      <Input type="number" value={editForm.credits || 0} onChange={e => setEditForm((f: any) => ({ ...f, credits: parseInt(e.target.value) || 0 }))} className="text-xs h-8" />
                    </div>
                  )}
                  {type === "streak" && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Durasi (hari)</label>
                      <Input type="number" value={editForm.days || 0} onChange={e => setEditForm((f: any) => ({ ...f, days: parseInt(e.target.value) || 0 }))} className="text-xs h-8" />
                    </div>
                  )}
                  {type === "storage" && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Storage (MB)</label>
                      <Input type="number" value={editForm.storage_mb || 0} onChange={e => setEditForm((f: any) => ({ ...f, storage_mb: parseInt(e.target.value) || 0 }))} className="text-xs h-8" />
                    </div>
                  )}
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Harga (Rp)</label>
                    <Input type="number" value={editForm.price || 0} onChange={e => setEditForm((f: any) => ({ ...f, price: parseInt(e.target.value) || 0 }))} className="text-xs h-8" />
                  </div>
                </div>
                {type === "credit" && (
                  <div className="flex items-center gap-2">
                    <Switch checked={editForm.is_unlimited || false} onCheckedChange={v => setEditForm((f: any) => ({ ...f, is_unlimited: v }))} />
                    <span className="text-xs">Unlimited</span>
                    {editForm.is_unlimited && (
                      <Input type="number" placeholder="Hari" value={editForm.unlimited_days || 0} onChange={e => setEditForm((f: any) => ({ ...f, unlimited_days: parseInt(e.target.value) || 0 }))} className="text-xs h-8 w-20" />
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleSaveEdit(table)} className="text-xs gap-1"><Check className="w-3 h-3" /> Simpan</Button>
                  <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="text-xs gap-1"><X className="w-3 h-3" /> Batal</Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{renderLabel(item)}</p>
                  <p className="text-xs text-muted-foreground">{renderSub(item)}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Switch checked={item.is_active} onCheckedChange={() => handleToggle(table, item)} />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(item)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(table, item.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  function renderAddForm(type: "credit" | "streak" | "storage", table: string, maxOrder: number) {
    if (addType !== type) {
      return (
        <Button variant="outline" className="w-full gap-2 text-xs" onClick={() => { setAddType(type); setNewForm({}); }}>
          <Plus className="w-4 h-4" /> Tambah Paket Baru
        </Button>
      );
    }
    return (
      <div className="border border-dashed border-primary/50 rounded-lg p-3 space-y-2">
        <Input
          placeholder={type === "credit" ? "Label (misal: 1 Kredit)" : "Nama paket"}
          value={newForm.label || newForm.name || ""}
          onChange={e => setNewForm((f: any) => type === "credit" ? { ...f, label: e.target.value } : { ...f, name: e.target.value })}
          className="text-xs h-8"
        />
        <div className="grid grid-cols-2 gap-2">
          {type === "credit" && !newForm.is_unlimited && (
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Jumlah Kredit</label>
              <Input type="number" value={newForm.credits || ""} onChange={e => setNewForm((f: any) => ({ ...f, credits: parseInt(e.target.value) || 0 }))} className="text-xs h-8" />
            </div>
          )}
          {type === "streak" && (
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Durasi (hari)</label>
              <Input type="number" value={newForm.days || ""} onChange={e => setNewForm((f: any) => ({ ...f, days: parseInt(e.target.value) || 0 }))} className="text-xs h-8" />
            </div>
          )}
          {type === "storage" && (
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Storage (MB)</label>
              <Input type="number" value={newForm.storage_mb || ""} onChange={e => setNewForm((f: any) => ({ ...f, storage_mb: parseInt(e.target.value) || 0 }))} className="text-xs h-8" />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground">Harga (Rp)</label>
            <Input type="number" value={newForm.price || ""} onChange={e => setNewForm((f: any) => ({ ...f, price: parseInt(e.target.value) || 0 }))} className="text-xs h-8" />
          </div>
        </div>
        {type === "credit" && (
          <div className="flex items-center gap-2">
            <Switch checked={newForm.is_unlimited || false} onCheckedChange={v => setNewForm((f: any) => ({ ...f, is_unlimited: v }))} />
            <span className="text-xs">Unlimited</span>
            {newForm.is_unlimited && (
              <Input type="number" placeholder="Durasi (hari)" value={newForm.unlimited_days || ""} onChange={e => setNewForm((f: any) => ({ ...f, unlimited_days: parseInt(e.target.value) || 0 }))} className="text-xs h-8 w-24" />
            )}
          </div>
        )}
        <div className="flex gap-2">
          <Button size="sm" onClick={() => {
            const base: any = { price: newForm.price || 0, sort_order: maxOrder + 1 };
            if (type === "credit") {
              base.label = newForm.label || "";
              base.credits = newForm.credits || 0;
              base.is_unlimited = newForm.is_unlimited || false;
              base.unlimited_days = newForm.is_unlimited ? (newForm.unlimited_days || 0) : 0;
            } else if (type === "streak") {
              base.name = newForm.name || "";
              base.days = newForm.days || 0;
            } else {
              base.name = newForm.name || "";
              base.storage_mb = newForm.storage_mb || 0;
            }
            handleAdd(table, base);
          }} className="text-xs gap-1"><Check className="w-3 h-3" /> Tambah</Button>
          <Button size="sm" variant="outline" onClick={() => setAddType(null)} className="text-xs gap-1"><X className="w-3 h-3" /> Batal</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Credit Packages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="w-5 h-5 text-blue-500" /> Paket Kredit Game
          </CardTitle>
          <p className="text-xs text-muted-foreground">Tambah, edit, atau hapus paket kredit jawaban game.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {renderPackageList(
            creditPkgs, "credit_packages", "credit",
            item => item.label || "",
            item => item.is_unlimited ? `Unlimited ${item.unlimited_days} hari - Rp${item.price.toLocaleString("id-ID")}` : `${item.credits} kredit - Rp${item.price.toLocaleString("id-ID")}`,
          )}
          {renderAddForm("credit", "credit_packages", creditPkgs.length > 0 ? Math.max(...creditPkgs.map(p => p.sort_order)) : 0)}
        </CardContent>
      </Card>

      {/* Streak Packages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" /> Paket Auto-Klaim Streak
          </CardTitle>
          <p className="text-xs text-muted-foreground">Tambah, edit, atau hapus paket langganan streak.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {renderPackageList(
            streakPkgs, "streak_packages", "streak",
            item => item.name || "",
            item => `${item.days} hari - Rp${item.price.toLocaleString("id-ID")}`,
          )}
          {renderAddForm("streak", "streak_packages", streakPkgs.length > 0 ? Math.max(...streakPkgs.map(p => p.sort_order)) : 0)}
        </CardContent>
      </Card>

      {/* Storage Packages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-green-500" /> Paket Penyimpanan Musik
          </CardTitle>
          <p className="text-xs text-muted-foreground">Tambah, edit, atau hapus paket upgrade storage.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {renderPackageList(
            storagePkgs, "storage_packages", "storage",
            item => item.name || "",
            item => `${(item.storage_mb || 0) >= 1024 ? `${((item.storage_mb || 0) / 1024).toFixed(0)}GB` : `${item.storage_mb}MB`} - Rp${item.price.toLocaleString("id-ID")}`,
          )}
          {renderAddForm("storage", "storage_packages", storagePkgs.length > 0 ? Math.max(...storagePkgs.map(p => p.sort_order)) : 0)}
        </CardContent>
      </Card>

      {/* Bundle Packages */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-500" /> Paket Bundel
          </CardTitle>
          <p className="text-xs text-muted-foreground">Paket kombo kredit + streak + storage.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            {bundlePkgs.map(item => (
              <div key={item.id} className={`border rounded-lg p-3 ${!item.is_active ? 'opacity-50' : ''}`}>
                {editingId === item.id ? (
                  <div className="space-y-2">
                    <Input placeholder="Nama paket" value={editForm.name || ""} onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))} className="text-xs h-8" />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">Kredit</label>
                        <Input type="number" value={editForm.credits || 0} onChange={e => setEditForm((f: any) => ({ ...f, credits: parseInt(e.target.value) || 0 }))} className="text-xs h-8" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">Streak (hari)</label>
                        <Input type="number" value={editForm.streak_days || 0} onChange={e => setEditForm((f: any) => ({ ...f, streak_days: parseInt(e.target.value) || 0 }))} className="text-xs h-8" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">Storage (MB)</label>
                        <Input type="number" value={editForm.storage_mb || 0} onChange={e => setEditForm((f: any) => ({ ...f, storage_mb: parseInt(e.target.value) || 0 }))} className="text-xs h-8" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">Harga (Rp)</label>
                        <Input type="number" value={editForm.price || 0} onChange={e => setEditForm((f: any) => ({ ...f, price: parseInt(e.target.value) || 0 }))} className="text-xs h-8" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveEdit("bundle_packages")} className="text-xs gap-1"><Check className="w-3 h-3" /> Simpan</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)} className="text-xs gap-1"><X className="w-3 h-3" /> Batal</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.credits > 0 ? `${item.credits} kredit` : ''}{item.streak_days > 0 ? ` + ${item.streak_days} hari streak` : ''}{item.storage_mb > 0 ? ` + ${(item.storage_mb / 1024).toFixed(0)}GB` : ''} - Rp{item.price.toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch checked={item.is_active} onCheckedChange={() => handleToggle("bundle_packages", item)} />
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(item)}><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete("bundle_packages", item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {addType !== "bundle" ? (
            <Button variant="outline" className="w-full gap-2 text-xs" onClick={() => { setAddType("bundle"); setNewForm({}); }}>
              <Plus className="w-4 h-4" /> Tambah Paket Bundel
            </Button>
          ) : (
            <div className="border border-dashed border-primary/50 rounded-lg p-3 space-y-2">
              <Input placeholder="Nama paket" value={newForm.name || ""} onChange={e => setNewForm((f: any) => ({ ...f, name: e.target.value }))} className="text-xs h-8" />
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Kredit</label>
                  <Input type="number" value={newForm.credits || ""} onChange={e => setNewForm((f: any) => ({ ...f, credits: parseInt(e.target.value) || 0 }))} className="text-xs h-8" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Streak (hari)</label>
                  <Input type="number" value={newForm.streak_days || ""} onChange={e => setNewForm((f: any) => ({ ...f, streak_days: parseInt(e.target.value) || 0 }))} className="text-xs h-8" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Storage (MB)</label>
                  <Input type="number" value={newForm.storage_mb || ""} onChange={e => setNewForm((f: any) => ({ ...f, storage_mb: parseInt(e.target.value) || 0 }))} className="text-xs h-8" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Harga (Rp)</label>
                  <Input type="number" value={newForm.price || ""} onChange={e => setNewForm((f: any) => ({ ...f, price: parseInt(e.target.value) || 0 }))} className="text-xs h-8" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleAdd("bundle_packages", { name: newForm.name || "", credits: newForm.credits || 0, streak_days: newForm.streak_days || 0, storage_mb: newForm.storage_mb || 0, price: newForm.price || 0, sort_order: bundlePkgs.length > 0 ? Math.max(...bundlePkgs.map((p: any) => p.sort_order)) + 1 : 1 })} className="text-xs gap-1"><Check className="w-3 h-3" /> Tambah</Button>
                <Button size="sm" variant="outline" onClick={() => setAddType(null)} className="text-xs gap-1"><X className="w-3 h-3" /> Batal</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flash Sale & Diskon */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" /> Flash Sale & Diskon
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFlashSaleActive && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-yellow-500 animate-pulse" />
                <div>
                  <p className="text-xs font-bold text-yellow-600">Flash Sale Aktif!</p>
                  <p className="text-[10px] text-muted-foreground">Berakhir: {new Date(values.flash_sale_end).toLocaleString("id-ID")}</p>
                  {values.flash_sale_label && <p className="text-[10px] font-bold text-yellow-700">{values.flash_sale_label}</p>}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={handleClearFlashSale} className="text-xs">Nonaktifkan</Button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Berakhir</label>
              <Input type="datetime-local" value={values.flash_sale_end || ""} onChange={e => setValues(v => ({ ...v, flash_sale_end: e.target.value }))} className="text-xs h-8" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground flex items-center gap-1"><Tag className="w-3 h-3" /> Label</label>
              <Input type="text" placeholder="SALE 50%" value={values.flash_sale_label || ""} onChange={e => setValues(v => ({ ...v, flash_sale_label: e.target.value }))} className="text-xs h-8" />
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-sm flex items-center gap-1"><Sparkles className="w-4 h-4" /> Diskon Marketplace & Storage</h4>
            <div className="grid grid-cols-2 gap-2">
              {EXTRA_SETTINGS.map(setting => (
                <div key={setting.key} className="space-y-1">
                  <label className="text-[10px] text-muted-foreground flex items-center gap-1">{setting.icon} {setting.label}</label>
                  <Input type="number" placeholder="0" value={values[setting.key] || ""} onChange={e => setValues(v => ({ ...v, [setting.key]: e.target.value }))} className="text-xs h-8" />
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleSaveSettings} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Flash Sale & Diskon
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
