import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Sparkles } from "lucide-react";
import { fetchPremiumBenefits } from "@/hooks/useStorePremium";
import { DEFAULT_PREMIUM_CONFIG, type PremiumBenefitConfig } from "./premiumBenefits";

type BoolKey = { [K in keyof PremiumBenefitConfig]: PremiumBenefitConfig[K] extends boolean ? K : never }[keyof PremiumBenefitConfig];
type NumKey = Exclude<keyof PremiumBenefitConfig, BoolKey>;

const ROWS: { toggle: BoolKey; label: string; hint: string; nums: { key: NumKey; label: string; suffix: string }[] }[] = [
  { toggle: "voucher_enabled", label: "🎁 Voucher harian", hint: "1x per hari, reset 00:00 WIB", nums: [{ key: "voucher_amount", label: "Nominal", suffix: "Rp" }] },
  { toggle: "chat_priority", label: "💬 Chat / tiket prioritas", hint: "Tiket member diberi label & prioritas tinggi", nums: [] },
  { toggle: "member_discount_enabled", label: "💰 Member price produk toko", hint: "Tidak digabung dengan Flash Sale", nums: [{ key: "member_discount_pct", label: "Diskon", suffix: "%" }] },
  { toggle: "flash_early_enabled", label: "⚡ Flash Sale early access", hint: "Untuk Flash Sale bermode 'Premium early access'", nums: [{ key: "flash_early_minutes", label: "Lebih awal", suffix: "menit" }] },
  { toggle: "game_credit_discount_enabled", label: "🛒 Diskon Kredit Game", hint: "Berlaku di pembelian paket Kredit Game", nums: [{ key: "game_credit_discount_pct", label: "Diskon", suffix: "%" }] },
  { toggle: "weekly_game_enabled", label: "🎮 Bonus Kredit Game mingguan", hint: "1x per minggu (Senin)", nums: [{ key: "weekly_game_credits", label: "Kredit", suffix: "kredit" }] },
  { toggle: "monthly_reward_enabled", label: "🎁 Hadiah bulanan", hint: "1x per bulan kalender", nums: [{ key: "monthly_reward_credits", label: "Kredit", suffix: "kredit" }, { key: "monthly_reward_gems", label: "Gems", suffix: "gem" }] },
  { toggle: "priority_notif_enabled", label: "🔔 Notifikasi prioritas", hint: "Kirim notif saat Flash Sale khusus/early Premium dibuat", nums: [] },
];

/** Pengaturan benefit Premium Toko — disimpan lewat RPC admin-only, dibaca ulang server saat transaksi. */
export default function AdminPremiumBenefitsPanel() {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<PremiumBenefitConfig>(DEFAULT_PREMIUM_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchPremiumBenefits(true).then((c) => { setCfg(c); setLoading(false); }); }, []);

  const save = async () => {
    setSaving(true);
    const { data, error } = await (supabase.rpc as any)("admin_set_store_premium_benefits", { p_config: cfg });
    setSaving(false);
    if (error) return toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
    setCfg({ ...DEFAULT_PREMIUM_CONFIG, ...(data as any) });
    await fetchPremiumBenefits(true);
    window.dispatchEvent(new Event("premium-benefits-updated"));
    toast({ title: "✅ Benefit Premium disimpan" });
  };

  return (
    <Card className="border-purple-500/30">
      <CardContent className="space-y-3 p-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-black"><Sparkles className="h-4 w-4 text-purple-500" /> Pengaturan Benefit Premium</p>
          <p className="text-[11px] text-muted-foreground">Benefit yang OFF tampil "Segera tersedia" di user dan tidak diterapkan di server.</p>
        </div>
        {loading ? (
          <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          <div className="space-y-2">
            {ROWS.map((r) => (
              <div key={r.toggle} className="rounded-xl border bg-card p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold">{r.label}</p>
                    <p className="text-[10px] text-muted-foreground">{r.hint}</p>
                  </div>
                  <Switch checked={cfg[r.toggle]} onCheckedChange={(v) => setCfg({ ...cfg, [r.toggle]: v })} aria-label={r.label} />
                </div>
                {r.nums.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.nums.map((n) => (
                      <label key={n.key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        {n.label}
                        <Input type="number" min={0} value={cfg[n.key]} disabled={!cfg[r.toggle]}
                          onChange={(e) => setCfg({ ...cfg, [n.key]: Math.max(0, Number(e.target.value) || 0) })}
                          className="h-8 w-24 text-xs" />
                        {n.suffix}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <Button onClick={save} disabled={saving} className="w-full font-bold">
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />} Simpan Benefit
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
