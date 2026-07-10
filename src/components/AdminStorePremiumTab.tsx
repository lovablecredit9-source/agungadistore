import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Save, Trash2, Crown, Users, UserPlus, Loader2 } from "lucide-react";

export default function AdminStorePremiumTab() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, { username: string; phone: string }>>({});

  // Manual grant
  const [grantUsername, setGrantUsername] = useState("");
  const [grantDays, setGrantDays] = useState(30);
  const [granting, setGranting] = useState(false);

  const load = async () => {
    const { data: p } = await supabase.from("store_premium_plans").select("*").order("sort_order");
    setPlans(p ?? []);
    const { data: s } = await supabase
      .from("store_premium_subscriptions")
      .select("*")
      .eq("is_active", true)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(200);
    setSubs(s ?? []);

    // Peta user_balance_id -> username/phone
    const ids = [...new Set((s ?? []).map((x: any) => x.user_balance_id).filter(Boolean))];
    if (ids.length) {
      const { data: ub } = await supabase.from("user_balances").select("id, username, phone").in("id", ids as string[]);
      const map: Record<string, { username: string; phone: string }> = {};
      (ub ?? []).forEach((u: any) => { map[u.id] = { username: u.username || "Pengguna", phone: u.phone || "" }; });
      setNameMap(map);
    } else {
      setNameMap({});
    }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.name || !editing?.duration_days || !editing?.price) {
      return toast({ title: "Lengkapi nama, durasi & harga", variant: "destructive" });
    }
    const payload = { ...editing };
    delete payload.created_at; delete payload.updated_at;
    const { error } = editing.id
      ? await supabase.from("store_premium_plans").update(payload).eq("id", editing.id)
      : await supabase.from("store_premium_plans").insert(payload);
    if (error) return toast({ title: "Gagal", description: error.message, variant: "destructive" });
    toast({ title: "✅ Tersimpan" });
    setEditing(null); load();
  };

  const del = async (id: string) => {
    if (!confirm("Hapus paket?")) return;
    await supabase.from("store_premium_plans").delete().eq("id", id);
    load();
  };

  // Beri membership premium manual berdasarkan username
  const grantPremium = async () => {
    const uname = grantUsername.trim();
    const days = Math.max(1, Number(grantDays) || 0);
    if (!uname) return toast({ title: "Masukkan username", variant: "destructive" });
    setGranting(true);
    try {
      const { data: users, error: uErr } = await supabase
        .from("user_balances")
        .select("id, visitor_id, username, phone")
        .ilike("username", uname)
        .limit(2);
      if (uErr) throw uErr;
      if (!users || users.length === 0) {
        toast({ title: "User tidak ditemukan", description: `Username "${uname}" tidak ada.`, variant: "destructive" });
        return;
      }
      if (users.length > 1) {
        toast({ title: "Username ganda", description: "Ada lebih dari satu akun dengan username ini.", variant: "destructive" });
        return;
      }
      const u = users[0];
      const now = new Date();
      const { data: existing } = await supabase
        .from("store_premium_subscriptions")
        .select("expires_at")
        .eq("is_active", true)
        .gt("expires_at", now.toISOString())
        .or(`visitor_id.eq.${u.visitor_id},user_balance_id.eq.${u.id}`)
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const startsAt = existing?.expires_at ? new Date(existing.expires_at) : now;
      const expires = new Date(startsAt.getTime() + days * 86400000);
      const wasExtended = startsAt.getTime() > now.getTime();
      const { error: insErr } = await supabase.from("store_premium_subscriptions").insert({
        visitor_id: u.visitor_id,
        user_balance_id: u.id,
        plan_id: null,
        plan_name: `Premium Admin (${days} hari)`,
        duration_days: days,
        price_paid: 0,
        starts_at: startsAt.toISOString(),
        expires_at: expires.toISOString(),
        is_active: true,
      });
      if (insErr) throw insErr;
      // Notifikasi ke user
      await (supabase.rpc as any)("create_notification", {
        p_visitor_id: u.visitor_id,
        p_title: wasExtended ? "👑 Membership Premium Diperpanjang" : "👑 Membership Premium Aktif",
        p_message: `Admin menambahkan ${days} hari Premium. Aktif sampai ${expires.toLocaleDateString("id-ID")}. Klaim voucher Rp 2.000 setiap hari!`,
        p_type: "success",
        p_related_id: null,
      });
      toast({ title: wasExtended ? "✅ Premium diperpanjang" : "✅ Premium diberikan", description: `${u.username} +${days} hari, sampai ${expires.toLocaleDateString("id-ID")}.` });
      setGrantUsername(""); setGrantDays(30);
      load();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message || String(e), variant: "destructive" });
    } finally {
      setGranting(false);
    }
  };

  const revokeSub = async (s: any) => {
    const label = nameMap[s.user_balance_id]?.username || s.visitor_id?.slice(0, 12);
    if (!confirm(`Hapus / nonaktifkan membership ${label}?`)) return;
    const { error } = await supabase.from("store_premium_subscriptions").delete().eq("id", s.id);
    if (error) return toast({ title: "Gagal", description: error.message, variant: "destructive" });
    toast({ title: "🗑️ Membership dihapus" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 p-3">
        <p className="text-sm font-black flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> Premium Toko</p>
        <p className="text-[11px] text-muted-foreground">Atur paket membership premium toko (1/2/6 bulan). Member dapat klaim voucher Rp 2.000 setiap hari.</p>
      </div>

      {/* Beri membership manual */}
      <Card className="border-amber-500/30">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-black flex items-center gap-1.5"><UserPlus className="w-4 h-4 text-amber-500" /> Aktifkan Membership Manual</p>
          <p className="text-[11px] text-muted-foreground">Masukkan username & jumlah hari. User langsung bisa klaim voucher Rp 2.000/hari.</p>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label className="text-[11px]">Username</Label>
              <Input value={grantUsername} onChange={(e) => setGrantUsername(e.target.value)} placeholder="username user" />
            </div>
            <div>
              <Label className="text-[11px]">Hari Aktif</Label>
              <Input type="number" min={1} value={grantDays} onChange={(e) => setGrantDays(+e.target.value)} />
            </div>
          </div>
          <Button onClick={grantPremium} disabled={granting} className="w-full">
            {granting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Crown className="w-4 h-4 mr-1" />}
            Aktifkan Premium
          </Button>
        </CardContent>
      </Card>

      <Button onClick={() => setEditing({ name: "", duration_days: 30, price: 20000, description: "", sort_order: plans.length, is_active: true })}>
        <Plus className="w-4 h-4 mr-1" /> Tambah Paket
      </Button>

      {editing && (
        <Card><CardContent className="p-4 space-y-3">
          <div><Label>Nama Paket</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Premium 1 Bulan" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label>Durasi (hari)</Label><Input type="number" value={editing.duration_days} onChange={(e) => setEditing({ ...editing, duration_days: +e.target.value })} /></div>
            <div><Label>Harga (Rp)</Label><Input type="number" value={editing.price} onChange={(e) => setEditing({ ...editing, price: +e.target.value })} /></div>
          </div>
          <div><Label>Deskripsi</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
          <div className="flex items-center gap-2">
            <Switch checked={editing.is_active} onCheckedChange={(c) => setEditing({ ...editing, is_active: c })} />
            <Label>Aktif</Label>
          </div>
          <div className="flex gap-2">
            <Button onClick={save}><Save className="w-4 h-4 mr-1" /> Simpan</Button>
            <Button variant="outline" onClick={() => setEditing(null)}>Batal</Button>
          </div>
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {plans.map((p) => (
          <Card key={p.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm flex items-center gap-1"><Crown className="w-3.5 h-3.5 text-amber-500" />{p.name} {!p.is_active && <span className="text-[9px] text-red-500">(Nonaktif)</span>}</p>
                <p className="text-[11px] text-muted-foreground">{p.duration_days} hari · Rp {p.price.toLocaleString("id-ID")}</p>
                {p.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{p.description}</p>}
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => setEditing(p)}>Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => del(p.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {plans.length === 0 && <p className="text-center text-xs text-muted-foreground py-4">Belum ada paket</p>}
      </div>

      <div className="pt-3 border-t">
        <p className="text-sm font-black flex items-center gap-1 mb-2"><Users className="w-4 h-4" /> Member Aktif ({subs.length})</p>
        <div className="space-y-1.5">
          {subs.map((s) => {
            const info = nameMap[s.user_balance_id];
            return (
              <div key={s.id} className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-muted/30 gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{info?.username || s.plan_name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {info?.phone ? info.phone + " · " : ""}{s.plan_name} · sampai {new Date(s.expires_at).toLocaleDateString("id-ID")}
                  </p>
                </div>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 font-black shrink-0">PREMIUM</span>
                <Button size="sm" variant="destructive" className="h-7 w-7 p-0 shrink-0" onClick={() => revokeSub(s)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            );
          })}
          {subs.length === 0 && <p className="text-center text-[11px] text-muted-foreground py-2">Belum ada member aktif</p>}
        </div>
      </div>
    </div>
  );
}
