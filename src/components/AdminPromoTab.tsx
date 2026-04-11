import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Tag, Clock, Save, Loader2, Zap, Coins, Flame, HardDrive, Sparkles, ShoppingBag, Megaphone, Plus, Trash2, Edit2, Check, X } from "lucide-react";

interface PromoSetting {
  key: string;
  label: string;
  icon: React.ReactNode;
  suffix: string;
  type: "number" | "datetime-local" | "text";
}

interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  label: string;
  is_unlimited: boolean;
  unlimited_days: number;
  is_active: boolean;
  sort_order: number;
}

const STREAK_SETTINGS: PromoSetting[] = [
  { key: "streak_price_10", label: "10 Hari", icon: <Flame className="w-4 h-4" />, suffix: "Rp", type: "number" },
  { key: "streak_price_20", label: "20 Hari", icon: <Flame className="w-4 h-4" />, suffix: "Rp", type: "number" },
  { key: "streak_price_30", label: "30 Hari", icon: <Flame className="w-4 h-4" />, suffix: "Rp", type: "number" },
  { key: "streak_price_60", label: "2 Bulan", icon: <Flame className="w-4 h-4" />, suffix: "Rp", type: "number" },
  { key: "streak_price_90", label: "3 Bulan", icon: <Flame className="w-4 h-4" />, suffix: "Rp", type: "number" },
  { key: "streak_price_180", label: "6 Bulan", icon: <Flame className="w-4 h-4" />, suffix: "Rp", type: "number" },
  { key: "streak_price_365", label: "1 Tahun", icon: <Flame className="w-4 h-4" />, suffix: "Rp", type: "number" },
];

const EXTRA_SETTINGS: PromoSetting[] = [
  { key: "promo_product_discount", label: "Diskon Produk (%)", icon: <ShoppingBag className="w-4 h-4" />, suffix: "%", type: "number" },
  { key: "promo_sponsor_discount", label: "Diskon Sponsor (%)", icon: <Megaphone className="w-4 h-4" />, suffix: "%", type: "number" },
  { key: "promo_storage_discount", label: "Diskon Storage (%)", icon: <HardDrive className="w-4 h-4" />, suffix: "%", type: "number" },
];

const ALL_SETTINGS = [...STREAK_SETTINGS, ...EXTRA_SETTINGS,
  { key: "flash_sale_end", label: "Flash Sale Berakhir", icon: <Clock className="w-4 h-4" />, suffix: "", type: "datetime-local" as const },
  { key: "flash_sale_label", label: "Label Flash Sale", icon: <Tag className="w-4 h-4" />, suffix: "", type: "text" as const },
];

export default function AdminPromoTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [editingPkg, setEditingPkg] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<CreditPackage>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [newPkg, setNewPkg] = useState({ credits: 0, price: 0, label: "", is_unlimited: false, unlimited_days: 0 });
  const { toast } = useToast();

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [settingsRes, pkgRes] = await Promise.all([
      supabase.from("admin_settings").select("*"),
      supabase.from("credit_packages" as any).select("*").order("sort_order", { ascending: true }),
    ]);
    if (settingsRes.data) {
      const map: Record<string, string> = {};
      (settingsRes.data as any[]).forEach(s => { map[s.setting_key] = s.setting_value; });
      setValues(map);
    }
    if (pkgRes.data) setPackages(pkgRes.data as any[]);
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

  async function handleSaveAll() {
    setSaving(true);
    try {
      for (const setting of ALL_SETTINGS) {
        const val = values[setting.key];
        if (val !== undefined && val !== "") {
          await saveSetting(setting.key, val);
        }
      }
      toast({ title: "✅ Promo berhasil disimpan!" });
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

  // Credit package CRUD
  async function handleAddPackage() {
    if (!newPkg.label || newPkg.price <= 0) {
      toast({ title: "Label dan harga wajib diisi", variant: "destructive" });
      return;
    }
    const maxOrder = packages.length > 0 ? Math.max(...packages.map(p => p.sort_order)) : 0;
    const { error } = await supabase.from("credit_packages" as any).insert({
      credits: newPkg.credits,
      price: newPkg.price,
      label: newPkg.label,
      is_unlimited: newPkg.is_unlimited,
      unlimited_days: newPkg.is_unlimited ? newPkg.unlimited_days : 0,
      sort_order: maxOrder + 1,
    } as any);
    if (error) {
      toast({ title: "Gagal menambah paket", variant: "destructive" });
    } else {
      toast({ title: "✅ Paket kredit ditambahkan!" });
      setNewPkg({ credits: 0, price: 0, label: "", is_unlimited: false, unlimited_days: 0 });
      setShowAddForm(false);
      fetchAll();
    }
  }

  async function handleDeletePackage(id: string) {
    if (!confirm("Hapus paket kredit ini?")) return;
    await supabase.from("credit_packages" as any).delete().eq("id", id);
    toast({ title: "Paket dihapus" });
    fetchAll();
  }

  async function handleToggleActive(pkg: CreditPackage) {
    await supabase.from("credit_packages" as any).update({ is_active: !pkg.is_active } as any).eq("id", pkg.id);
    fetchAll();
  }

  function startEdit(pkg: CreditPackage) {
    setEditingPkg(pkg.id);
    setEditForm({ credits: pkg.credits, price: pkg.price, label: pkg.label, is_unlimited: pkg.is_unlimited, unlimited_days: pkg.unlimited_days });
  }

  async function handleSaveEdit(id: string) {
    await supabase.from("credit_packages" as any).update({
      credits: editForm.credits,
      price: editForm.price,
      label: editForm.label,
      is_unlimited: editForm.is_unlimited,
      unlimited_days: editForm.is_unlimited ? editForm.unlimited_days : 0,
    } as any).eq("id", id);
    setEditingPkg(null);
    toast({ title: "✅ Paket diperbarui!" });
    fetchAll();
  }

  const isFlashSaleActive = values.flash_sale_end && new Date(values.flash_sale_end) > new Date();

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  function renderSettingGrid(settings: PromoSetting[]) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {settings.map(setting => (
          <div key={setting.key} className="space-y-1">
            <label className="text-[10px] text-muted-foreground flex items-center gap-1">
              {setting.icon} {setting.label}
            </label>
            <Input
              type={setting.type === "datetime-local" ? "datetime-local" : setting.type === "text" ? "text" : "number"}
              placeholder="Default"
              value={values[setting.key] || ""}
              onChange={e => setValues(v => ({ ...v, [setting.key]: e.target.value }))}
              className="text-xs h-8"
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Credit Packages CRUD */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Coins className="w-5 h-5 text-blue-500" /> Paket Kredit Game
          </CardTitle>
          <p className="text-xs text-muted-foreground">Tambah, edit, atau hapus paket kredit. Perubahan langsung berlaku.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Existing packages */}
          {packages.map(pkg => (
            <div key={pkg.id} className={`border rounded-lg p-3 space-y-2 ${!pkg.is_active ? 'opacity-50' : ''}`}>
              {editingPkg === pkg.id ? (
                <div className="space-y-2">
                  <Input
                    placeholder="Label (misal: 1 Kredit)"
                    value={editForm.label || ""}
                    onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                    className="text-xs h-8"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {!editForm.is_unlimited && (
                      <div className="space-y-1">
                        <label className="text-[10px] text-muted-foreground">Jumlah Kredit</label>
                        <Input
                          type="number"
                          value={editForm.credits || 0}
                          onChange={e => setEditForm(f => ({ ...f, credits: parseInt(e.target.value) || 0 }))}
                          className="text-xs h-8"
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[10px] text-muted-foreground">Harga (Rp)</label>
                      <Input
                        type="number"
                        value={editForm.price || 0}
                        onChange={e => setEditForm(f => ({ ...f, price: parseInt(e.target.value) || 0 }))}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editForm.is_unlimited || false}
                      onCheckedChange={v => setEditForm(f => ({ ...f, is_unlimited: v }))}
                    />
                    <span className="text-xs">Unlimited</span>
                    {editForm.is_unlimited && (
                      <Input
                        type="number"
                        placeholder="Hari"
                        value={editForm.unlimited_days || 0}
                        onChange={e => setEditForm(f => ({ ...f, unlimited_days: parseInt(e.target.value) || 0 }))}
                        className="text-xs h-8 w-20"
                      />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSaveEdit(pkg.id)} className="text-xs gap-1">
                      <Check className="w-3 h-3" /> Simpan
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingPkg(null)} className="text-xs gap-1">
                      <X className="w-3 h-3" /> Batal
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{pkg.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {pkg.is_unlimited
                        ? `Unlimited ${pkg.unlimited_days} hari`
                        : `${pkg.credits} kredit`
                      } — Rp{pkg.price.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={pkg.is_active}
                      onCheckedChange={() => handleToggleActive(pkg)}
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(pkg)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeletePackage(pkg.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add new package form */}
          {showAddForm ? (
            <div className="border border-dashed border-primary/50 rounded-lg p-3 space-y-2">
              <Input
                placeholder="Label (misal: 1 Kredit)"
                value={newPkg.label}
                onChange={e => setNewPkg(p => ({ ...p, label: e.target.value }))}
                className="text-xs h-8"
              />
              <div className="grid grid-cols-2 gap-2">
                {!newPkg.is_unlimited && (
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">Jumlah Kredit</label>
                    <Input
                      type="number"
                      value={newPkg.credits || ""}
                      onChange={e => setNewPkg(p => ({ ...p, credits: parseInt(e.target.value) || 0 }))}
                      className="text-xs h-8"
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Harga (Rp)</label>
                  <Input
                    type="number"
                    value={newPkg.price || ""}
                    onChange={e => setNewPkg(p => ({ ...p, price: parseInt(e.target.value) || 0 }))}
                    className="text-xs h-8"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={newPkg.is_unlimited}
                  onCheckedChange={v => setNewPkg(p => ({ ...p, is_unlimited: v }))}
                />
                <span className="text-xs">Unlimited</span>
                {newPkg.is_unlimited && (
                  <Input
                    type="number"
                    placeholder="Durasi (hari)"
                    value={newPkg.unlimited_days || ""}
                    onChange={e => setNewPkg(p => ({ ...p, unlimited_days: parseInt(e.target.value) || 0 }))}
                    className="text-xs h-8 w-24"
                  />
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddPackage} className="text-xs gap-1">
                  <Check className="w-3 h-3" /> Tambah
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddForm(false)} className="text-xs gap-1">
                  <X className="w-3 h-3" /> Batal
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" className="w-full gap-2 text-xs" onClick={() => setShowAddForm(true)}>
              <Plus className="w-4 h-4" /> Tambah Paket Kredit Baru
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Flash Sale & Other Promo */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" /> Flash Sale & Promo
          </CardTitle>
          <p className="text-xs text-muted-foreground">Atur harga promo saat flash sale aktif.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFlashSaleActive && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-yellow-500 animate-pulse" />
                <div>
                  <p className="text-xs font-bold text-yellow-600">Flash Sale Aktif!</p>
                  <p className="text-[10px] text-muted-foreground">
                    Berakhir: {new Date(values.flash_sale_end).toLocaleString("id-ID")}
                  </p>
                  {values.flash_sale_label && (
                    <p className="text-[10px] font-bold text-yellow-700">{values.flash_sale_label}</p>
                  )}
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={handleClearFlashSale} className="text-xs">
                Nonaktifkan
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="font-bold text-sm flex items-center gap-1"><Clock className="w-4 h-4" /> Timer Flash Sale</h4>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Berakhir</label>
                <Input
                  type="datetime-local"
                  value={values.flash_sale_end || ""}
                  onChange={e => setValues(v => ({ ...v, flash_sale_end: e.target.value }))}
                  className="text-xs h-8"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Label (opsional)</label>
                <Input
                  type="text"
                  placeholder="contoh: SALE 50%"
                  value={values.flash_sale_label || ""}
                  onChange={e => setValues(v => ({ ...v, flash_sale_label: e.target.value }))}
                  className="text-xs h-8"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-sm flex items-center gap-1"><Flame className="w-4 h-4" /> Harga Auto-Klaim Streak</h4>
            {renderSettingGrid(STREAK_SETTINGS)}
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-sm flex items-center gap-1"><Sparkles className="w-4 h-4" /> Diskon Marketplace & Storage</h4>
            {renderSettingGrid(EXTRA_SETTINGS)}
          </div>

          <Button onClick={handleSaveAll} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Semua Promo
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
