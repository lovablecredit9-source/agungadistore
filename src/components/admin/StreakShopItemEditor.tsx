import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, X } from "lucide-react";

const RARITIES = ["common", "rare", "epic", "legendary", "mythic"];
const CATEGORIES = ["boost", "reward", "profile", "avatar", "badge", "effect", "voucher", "protection", "utility", "exclusive"];
const REWARD_TYPES = ["streak_freeze", "streak_boost", "double_reward", "lucky_boost", "mystery_box", "cosmetic_aura", "cosmetic_flame", "cosmetic_badge", "cosmetic_name", "cosmetic_claim", "cosmetic_frame", "discount_voucher", "game_credit", "music_storage", "extra_life", "auto_hint", "time_freeze", "double_xp"];

const toLocal = (iso?: string | null) => iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

/** Full editor for Streak Shop items (rarity, requirement, Plus-only, flash sale, stock). Used inside AdminStreakShopTab. */
export default function StreakShopItemEditor() {
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);

  const load = async () => {
    const { data } = await supabase.from("streak_shop_items").select("*").order("sort_order");
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!edit?.name?.trim()) return toast({ title: "Nama wajib diisi", variant: "destructive" });
    if (edit.sale_price_coins && edit.sale_price_coins >= edit.cost_coins) return toast({ title: "Harga sale harus lebih kecil dari harga normal", variant: "destructive" });
    const payload: any = { ...edit };
    delete payload.created_at; delete payload.updated_at;
    payload.sale_price_coins = payload.sale_price_coins ? Number(payload.sale_price_coins) : null;
    payload.sale_ends_at = payload.sale_ends_at ? new Date(payload.sale_ends_at).toISOString() : null;
    payload.duration_hours = payload.duration_hours ? Number(payload.duration_hours) : null;
    const { error } = edit.id
      ? await supabase.from("streak_shop_items").update(payload).eq("id", edit.id)
      : await supabase.from("streak_shop_items").insert(payload);
    if (error) return toast({ title: "Gagal", description: error.message, variant: "destructive" });
    toast({ title: "✅ Item tersimpan" }); setEdit(null); load();
  };

  const num = (k: string, label: string) => (
    <div><Label className="text-xs">{label}</Label><Input type="number" value={edit[k] ?? ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value === "" ? null : +e.target.value })} /></div>
  );
  const sel = (k: string, label: string, opts: string[]) => (
    <div><Label className="text-xs">{label}</Label>
      <select className="w-full h-10 rounded-md border bg-background px-2 text-sm" value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })}>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select></div>
  );

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={() => setEdit({ name: "", description: "", icon: "🎁", cost_coins: 100, cost_gems: 10, reward_type: "mystery_box", reward_value: 1, stock: -1, is_active: true, sort_order: 200, rarity: "common", category: "reward", required_streak: 0, plus_only: false, is_featured: false })}>
        <Plus className="h-4 w-4 mr-1" /> Tambah Item
      </Button>

      {edit && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="col-span-2"><Label className="text-xs">Nama</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div><Label className="text-xs">Icon</Label><Input value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} /></div>
            <div className="col-span-full"><Label className="text-xs">Deskripsi</Label><Input value={edit.description ?? ""} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
            {sel("rarity", "Rarity", RARITIES)}
            {sel("category", "Kategori", CATEGORIES)}
            {sel("reward_type", "Tipe Reward", REWARD_TYPES)}
            {num("reward_value", "Nilai Reward")}
            {num("cost_coins", "Harga Coin")}
            {num("cost_gems", "Harga Gem")}
            {num("stock", "Stok (-1 = tak terbatas)")}
            {num("required_streak", "Syarat Streak (hari)")}
            {num("duration_hours", "Durasi (jam, boost)")}
            {num("sale_price_coins", "Harga Flash Sale")}
            <div><Label className="text-xs">Sale berakhir</Label><Input type="datetime-local" value={toLocal(edit.sale_ends_at)} onChange={(e) => setEdit({ ...edit, sale_ends_at: e.target.value || null })} /></div>
            {num("sort_order", "Urutan")}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            {[["is_active", "Aktif"], ["plus_only", "Khusus Plus"], ["is_featured", "Featured"]].map(([k, l]) => (
              <label key={k} className="flex items-center gap-2"><input type="checkbox" checked={!!edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.checked })} /> {l}</label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={save}><Save className="h-4 w-4 mr-1" /> Simpan</Button>
            <Button variant="outline" onClick={() => setEdit(null)}><X className="h-4 w-4 mr-1" /> Batal</Button>
          </div>
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {items.map((it) => {
          const onSale = it.sale_price_coins && it.sale_ends_at && new Date(it.sale_ends_at) > new Date();
          return (
            <Card key={it.id}><CardContent className="p-3 flex items-center gap-3">
              <span className="text-2xl">{it.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{it.name} {!it.is_active && <span className="text-xs text-muted-foreground">(nonaktif)</span>}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {String(it.rarity).toUpperCase()} · {it.category} · {onSale ? `${it.sale_price_coins} (sale) / ` : ""}{it.cost_coins} coin · {it.cost_gems} gem
                  {it.required_streak > 0 && ` · 🔥${it.required_streak}h`}{it.plus_only && " · 👑Plus"}{it.stock >= 0 && ` · stok ${it.stock}`}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setEdit({ ...it })}>Edit</Button>
            </CardContent></Card>
          );
        })}
      </div>
    </div>
  );
}
