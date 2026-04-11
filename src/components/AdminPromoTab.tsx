import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Tag, Clock, Save, Loader2, Zap, Coins, Flame, HardDrive, Sparkles, ShoppingBag, Megaphone } from "lucide-react";

interface PromoSetting {
  key: string;
  label: string;
  icon: React.ReactNode;
  suffix: string;
  type: "number" | "datetime-local" | "text";
}

const CREDIT_SETTINGS: PromoSetting[] = [
  { key: "credit_price_2", label: "Harga 2 Kredit", icon: <Coins className="w-4 h-4" />, suffix: "Rp", type: "number" },
  { key: "credit_price_10", label: "Harga 10 Kredit", icon: <Coins className="w-4 h-4" />, suffix: "Rp", type: "number" },
  { key: "credit_price_30", label: "Harga 30 Kredit", icon: <Coins className="w-4 h-4" />, suffix: "Rp", type: "number" },
  { key: "credit_price_60", label: "Harga 60 Kredit", icon: <Coins className="w-4 h-4" />, suffix: "Rp", type: "number" },
  { key: "credit_price_100", label: "Harga 100 Kredit", icon: <Coins className="w-4 h-4" />, suffix: "Rp", type: "number" },
  { key: "credit_price_200", label: "Harga 200 Kredit", icon: <Coins className="w-4 h-4" />, suffix: "Rp", type: "number" },
  { key: "credit_price_500", label: "Harga 500 Kredit", icon: <Coins className="w-4 h-4" />, suffix: "Rp", type: "number" },
  { key: "credit_price_1000", label: "Harga 1000 Kredit", icon: <Coins className="w-4 h-4" />, suffix: "Rp", type: "number" },
  { key: "credit_price_unlimited_month", label: "Unlimited 1 Bulan", icon: <Zap className="w-4 h-4" />, suffix: "Rp", type: "number" },
  { key: "credit_price_unlimited_year", label: "Unlimited 1 Tahun", icon: <Zap className="w-4 h-4" />, suffix: "Rp", type: "number" },
];

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

const ALL_SETTINGS = [...CREDIT_SETTINGS, ...STREAK_SETTINGS, ...EXTRA_SETTINGS,
  { key: "flash_sale_end", label: "Flash Sale Berakhir", icon: <Clock className="w-4 h-4" />, suffix: "", type: "datetime-local" as const },
  { key: "flash_sale_label", label: "Label Flash Sale", icon: <Tag className="w-4 h-4" />, suffix: "", type: "text" as const },
];

export default function AdminPromoTab() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { fetchSettings(); }, []);

  async function fetchSettings() {
    setLoading(true);
    const { data } = await supabase.from("admin_settings").select("*");
    if (data) {
      const map: Record<string, string> = {};
      (data as any[]).forEach(s => { map[s.setting_key] = s.setting_value; });
      setValues(map);
    }
    setLoading(false);
  }

  async function saveSetting(key: string, value: string) {
    // Check if row exists in DB first
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

  const isFlashSaleActive = values.flash_sale_end && new Date(values.flash_sale_end) > new Date();

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  function renderSettingGrid(settings: PromoSetting[], cols = 2) {
    return (
      <div className={`grid grid-cols-${cols} gap-2`}>
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
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-500" /> Flash Sale & Promo
          </CardTitle>
          <p className="text-xs text-muted-foreground">Atur harga promo saat flash sale aktif. Kosongkan untuk pakai harga default.</p>
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

          {/* Timer Flash Sale */}
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
            <p className="text-[10px] text-muted-foreground">
              Jika diisi, semua harga promo berlaku sampai waktu ini. Kosongkan untuk nonaktifkan.
            </p>
          </div>

          {/* Harga Kredit Game */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm flex items-center gap-1"><Coins className="w-4 h-4" /> Harga Kredit Game</h4>
            {renderSettingGrid(CREDIT_SETTINGS)}
          </div>

          {/* Harga Streak Auto-Klaim */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm flex items-center gap-1"><Flame className="w-4 h-4" /> Harga Auto-Klaim Streak</h4>
            {renderSettingGrid(STREAK_SETTINGS)}
          </div>

          {/* Diskon Produk, Sponsor, Storage */}
          <div className="space-y-2">
            <h4 className="font-bold text-sm flex items-center gap-1"><Sparkles className="w-4 h-4" /> Diskon Marketplace & Storage</h4>
            <p className="text-[10px] text-muted-foreground">Persentase diskon untuk produk, sponsor, dan storage saat flash sale aktif.</p>
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
