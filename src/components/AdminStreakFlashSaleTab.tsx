import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, RotateCcw, Loader2, Zap, Edit2, X } from "lucide-react";

const ITEM_TYPES = [
  { value: "coins", label: "🪙 Streak Coins", payloadHint: '{"coins": 5000}' },
  { value: "freeze", label: "❄️ Streak Freeze", payloadHint: '{"freeze": 5}' },
  { value: "booster", label: "⚡ Booster", payloadHint: '{"double_xp_hours":24,"auto_hint":10,"extra_life":5,"time_freeze":3}' },
  { value: "scratch_card", label: "🎟️ Scratch Card", payloadHint: '{"card_tier":"gold","count":10}' },
  { value: "mystery_box", label: "💎 Mystery Box", payloadHint: '{"box_tier":"diamond","min":2000,"max":10000}' },
  { value: "cosmetic", label: "👑 Cosmetic", payloadHint: '{"cosmetic_type":"avatar","cosmetic_id":"phoenix_flame","name":"Phoenix Flame"}' },
];

const RARITIES = ["common", "rare", "epic", "legendary", "mythic"];
const GRADIENTS = [
  "from-amber-400 to-orange-600",
  "from-cyan-400 to-blue-600",
  "from-fuchsia-500 to-purple-700",
  "from-yellow-400 to-amber-600",
  "from-red-500 via-orange-500 to-yellow-400",
  "from-green-400 to-emerald-600",
  "from-pink-500 to-rose-600",
  "from-indigo-500 to-violet-700",
];

function emptyDeal() {
  return {
    id: null as string | null,
    name: "",
    description: "",
    item_type: "coins",
    reward_payload: '{"coins": 1000}',
    price_coins: 0,
    price_gems: 0,
    price_balance: 0,
    original_price: 0,
    discount_pct: 0,
    total_stock: 100,
    per_user_daily_limit: 1,
    starts_at: new Date().toISOString().slice(0, 16),
    ends_at: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
    is_active: true,
    is_featured: false,
    rarity: "common",
    icon: "⚡",
    gradient: "from-orange-500 to-red-500",
    sort_order: 0,
  };
}

export default function AdminStreakFlashSaleTab() {
  const { toast } = useToast();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await supabase.functions.invoke("streak-flash-sale", { body: { action: "admin_list" } });
      setDeals(res?.deals || []);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function openEdit(deal?: any) {
    if (deal) {
      setEditing({
        ...deal,
        reward_payload: JSON.stringify(deal.reward_payload || {}, null, 2),
        starts_at: deal.starts_at ? new Date(deal.starts_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
        ends_at: deal.ends_at ? new Date(deal.ends_at).toISOString().slice(0, 16) : "",
      });
    } else {
      setEditing(emptyDeal());
    }
  }

  async function save() {
    if (!editing?.name) { toast({ title: "Nama wajib", variant: "destructive" }); return; }
    let payload: any;
    try { payload = JSON.parse(editing.reward_payload || "{}"); }
    catch { toast({ title: "Reward payload bukan JSON valid", variant: "destructive" }); return; }

    setSaving(true);
    try {
      const { data: res } = await supabase.functions.invoke("streak-flash-sale", {
        body: {
          action: "admin_upsert",
          deal: {
            ...editing,
            reward_payload: payload,
            starts_at: new Date(editing.starts_at).toISOString(),
            ends_at: editing.ends_at ? new Date(editing.ends_at).toISOString() : null,
          },
        },
      });
      if (res?.error) toast({ title: "Gagal simpan", description: res.error, variant: "destructive" });
      else {
        toast({ title: "✅ Tersimpan", description: editing.id ? "Flash sale diupdate" : "Flash sale baru dibuat" });
        setEditing(null);
        await load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    if (!confirm("Hapus flash sale ini permanen?")) return;
    await supabase.functions.invoke("streak-flash-sale", { body: { action: "admin_delete", id } });
    toast({ title: "Dihapus" });
    await load();
  }

  async function resetStock(id: string) {
    await supabase.functions.invoke("streak-flash-sale", { body: { action: "admin_reset_stock", id } });
    toast({ title: "Stok direset" });
    await load();
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            <h2 className="text-lg font-bold">⚡ Streak Flash Sale</h2>
            <Badge variant="secondary">{deals.length} deal</Badge>
          </div>
          <Button onClick={() => openEdit()} size="sm" className="bg-orange-500 hover:bg-orange-600">
            <Plus className="h-4 w-4 mr-1" />Tambah Deal
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
        ) : (
          <div className="space-y-2">
            {deals.length === 0 && <p className="text-center text-sm text-muted-foreground py-6">Belum ada deal. Klik "Tambah Deal" untuk mulai.</p>}
            {deals.map((d) => (
              <div key={d.id} className="flex items-center gap-2 p-2.5 rounded-lg border bg-background/50">
                <div className="text-2xl">{d.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-sm truncate">{d.name}</span>
                    {d.is_featured && <Badge className="bg-yellow-500 text-yellow-950 text-[9px] px-1 h-4">FEATURED</Badge>}
                    {!d.is_active && <Badge variant="destructive" className="text-[9px] px-1 h-4">OFF</Badge>}
                    <Badge variant="outline" className="text-[9px] px-1 h-4">{d.rarity}</Badge>
                  </div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>{d.item_type}</span>
                    {d.price_coins > 0 && <span>🪙{d.price_coins}</span>}
                    {d.price_gems > 0 && <span>💎{d.price_gems}</span>}
                    {d.price_balance > 0 && <span>💰{d.price_balance.toLocaleString("id-ID")}</span>}
                    {d.total_stock != null && <span>Stok {d.remaining_stock}/{d.total_stock}</span>}
                    {d.discount_pct > 0 && <span className="text-red-500">-{d.discount_pct}%</span>}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {d.total_stock != null && (
                    <Button size="sm" variant="outline" onClick={() => resetStock(d.id)} title="Reset stok">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => openEdit(d)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => del(d.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {editing && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <Card className="w-full max-w-2xl my-4">
              <CardContent className="p-4 space-y-3 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between sticky top-0 bg-card pb-2 border-b">
                  <h3 className="font-bold">{editing.id ? "Edit Flash Sale" : "Flash Sale Baru"}</h3>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Nama</Label>
                    <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Icon (emoji)</Label>
                    <Input value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Deskripsi</Label>
                  <Textarea rows={2} value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Tipe Item</Label>
                    <Select value={editing.item_type} onValueChange={(v) => {
                      const t = ITEM_TYPES.find(x => x.value === v);
                      setEditing({ ...editing, item_type: v, reward_payload: t?.payloadHint || "{}" });
                    }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ITEM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Rarity</Label>
                    <Select value={editing.rarity} onValueChange={(v) => setEditing({ ...editing, rarity: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{RARITIES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Reward Payload (JSON)</Label>
                  <Textarea rows={3} className="font-mono text-xs" value={editing.reward_payload} onChange={(e) => setEditing({ ...editing, reward_payload: e.target.value })} />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Harga Coin 🪙</Label>
                    <Input type="number" value={editing.price_coins} onChange={(e) => setEditing({ ...editing, price_coins: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Harga Gem 💎</Label>
                    <Input type="number" value={editing.price_gems} onChange={(e) => setEditing({ ...editing, price_gems: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Harga Saldo Rp</Label>
                    <Input type="number" value={editing.price_balance} onChange={(e) => setEditing({ ...editing, price_balance: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Harga Asli</Label>
                    <Input type="number" value={editing.original_price} onChange={(e) => setEditing({ ...editing, original_price: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Diskon %</Label>
                    <Input type="number" value={editing.discount_pct} onChange={(e) => setEditing({ ...editing, discount_pct: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Sort Order</Label>
                    <Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Total Stok (kosong = unlimited)</Label>
                    <Input type="number" value={editing.total_stock ?? ""} onChange={(e) => setEditing({ ...editing, total_stock: e.target.value === "" ? null : e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Limit per User/Hari</Label>
                    <Input type="number" value={editing.per_user_daily_limit} onChange={(e) => setEditing({ ...editing, per_user_daily_limit: e.target.value })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Mulai</Label>
                    <Input type="datetime-local" value={editing.starts_at} onChange={(e) => setEditing({ ...editing, starts_at: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Berakhir</Label>
                    <Input type="datetime-local" value={editing.ends_at} onChange={(e) => setEditing({ ...editing, ends_at: e.target.value })} />
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Gradient</Label>
                  <div className="grid grid-cols-4 gap-1.5 mt-1">
                    {GRADIENTS.map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setEditing({ ...editing, gradient: g })}
                        className={`h-8 rounded-md bg-gradient-to-r ${g} ${editing.gradient === g ? "ring-2 ring-foreground" : ""}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                    Aktif
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={editing.is_featured} onCheckedChange={(v) => setEditing({ ...editing, is_featured: v })} />
                    Featured ⭐
                  </label>
                </div>

                <div className="flex gap-2 pt-2 sticky bottom-0 bg-card border-t pt-3">
                  <Button onClick={save} disabled={saving} className="flex-1 bg-orange-500 hover:bg-orange-600">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                    Simpan
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(null)}>Batal</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
