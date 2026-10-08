import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import AdminPremiumBenefitsPanel from "@/components/premium/AdminPremiumBenefitsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { grantWindow, memberState, summarizeHistory, filterHistory, type MemberState } from "@/components/premium/premiumAdminLogic";
import { Plus, Save, Trash2, Crown, Users, UserPlus, Loader2, Lock, Unlock, Clock, History, RotateCcw, Package, Sparkles, Search, Pencil, Wallet, ExternalLink } from "lucide-react";

export default function AdminStorePremiumTab() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [subs, setSubs] = useState<any[]>([]);
  const [nameMap, setNameMap] = useState<Record<string, { username: string; phone: string }>>({});
  const [allHistory, setAllHistory] = useState<any[]>([]);
  const [section, setSection] = useState("paket");
  const [memberQuery, setMemberQuery] = useState("");
  const [historyKind, setHistoryKind] = useState<"all" | "paid" | "manual">("all");

  // Manual grant
  const [grantUsername, setGrantUsername] = useState("");
  const [grantDays, setGrantDays] = useState(30);
  const [granting, setGranting] = useState(false);
  const [questUsername, setQuestUsername] = useState("");
  const [questD, setQuestD] = useState(1);
  const [questH, setQuestH] = useState(0);
  const [questM, setQuestM] = useState(0);
  const [questS, setQuestS] = useState(0);
  const [grantingQuest, setGrantingQuest] = useState(false);
  const [premiumQuestSubs, setPremiumQuestSubs] = useState<any[]>([]);

  // Kelola member terpilih
  const [manage, setManage] = useState<any | null>(null);
  const [addD, setAddD] = useState(0);
  const [addH, setAddH] = useState(0);
  const [addM, setAddM] = useState(0);
  const [addS, setAddS] = useState(0);
  const [lockReason, setLockReason] = useState("");
  const [lockD, setLockD] = useState(0);
  const [lockH, setLockH] = useState(1);
  const [lockM, setLockM] = useState(0);
  const [busy, setBusy] = useState(false);

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

    // Seluruh riwayat pembelian/perpanjang membership (untuk laporan admin)
    const { data: hist } = await supabase
      .from("store_premium_subscriptions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);
    setAllHistory(hist ?? []);

    const { data: pqSubs } = await supabase
      .from("premium_quest_subscriptions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setPremiumQuestSubs(pqSubs ?? []);

    // Peta user_balance_id -> username/phone (gabungan aktif + riwayat)
    const ids = [...new Set([...(s ?? []), ...(hist ?? []), ...(pqSubs ?? [])].map((x: any) => x.user_balance_id).filter(Boolean))];
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

  const grantPremiumQuest = async () => {
    const seconds = questD * 86400 + questH * 3600 + questM * 60 + questS;
    if (!questUsername.trim()) return toast({ title: "Masukkan username", variant: "destructive" });
    if (seconds <= 0) return toast({ title: "Isi durasi Premium Quest", variant: "destructive" });
    setGrantingQuest(true);
    try {
      const { data, error } = await supabase.functions.invoke("premium-quest", {
        body: { action: "adminGrant", username: questUsername.trim(), seconds },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || "Gagal aktifkan Premium Quest");
      toast({ title: "✅ Premium Quest aktif", description: `${(data as any).username || questUsername} sampai ${fmt((data as any).expires_at)}.` });
      setQuestUsername(""); setQuestD(1); setQuestH(0); setQuestM(0); setQuestS(0);
      load();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message || String(e), variant: "destructive" });
    } finally {
      setGrantingQuest(false);
    }
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

      const win = grantWindow(existing?.expires_at, days, now.getTime());
      const startsAt = new Date(win.startsAt);
      const expires = new Date(win.expiresAt);
      const wasExtended = win.extended;
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

  const notify = async (visitorId: string, title: string, message: string) => {
    try {
      await (supabase.rpc as any)("create_notification", {
        p_visitor_id: visitorId, p_title: title, p_message: message, p_type: "info", p_related_id: null,
      });
    } catch {}
  };

  // Tambah waktu presisi (hari/jam/menit/detik) ke membership terpilih
  const addTime = async () => {
    if (!manage) return;
    const secs = addD * 86400 + addH * 3600 + addM * 60 + addS;
    if (secs === 0) return toast({ title: "Isi durasi yang mau ditambah", variant: "destructive" });
    setBusy(true);
    try {
      const base = new Date(manage.expires_at).getTime() > Date.now() ? new Date(manage.expires_at) : new Date();
      const newExp = new Date(base.getTime() + secs * 1000);
      const { error } = await supabase.from("store_premium_subscriptions")
        .update({ expires_at: newExp.toISOString(), is_active: true }).eq("id", manage.id);
      if (error) throw error;
      await notify(manage.visitor_id, "👑 Membership Diperpanjang", `Admin menambah waktu premium. Aktif sampai ${newExp.toLocaleString("id-ID")} WIB.`);
      toast({ title: "✅ Waktu ditambahkan", description: `Sampai ${newExp.toLocaleString("id-ID")}` });
      setAddD(0); setAddH(0); setAddM(0); setAddS(0);
      setManage({ ...manage, expires_at: newExp.toISOString() });
      load();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message || String(e), variant: "destructive" });
    } finally { setBusy(false); }
  };

  // Kurangi/reset masa aktif -> set expired sekarang
  const resetTime = async () => {
    if (!manage) return;
    if (!confirm("Reset membership ini? Masa aktif langsung berakhir.")) return;
    setBusy(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase.from("store_premium_subscriptions")
        .update({ expires_at: nowIso, is_active: false }).eq("id", manage.id);
      if (error) throw error;
      await notify(manage.visitor_id, "Membership Direset", "Masa membership premium kamu telah direset admin.");
      toast({ title: "♻️ Membership direset" });
      setManage(null); load();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message || String(e), variant: "destructive" });
    } finally { setBusy(false); }
  };

  // Kunci akibat pelanggaran (durasi presisi)
  const lockSub = async () => {
    if (!manage) return;
    const secs = lockD * 86400 + lockH * 3600 + lockM * 60;
    if (secs === 0) return toast({ title: "Isi durasi kunci", variant: "destructive" });
    setBusy(true);
    try {
      const until = new Date(Date.now() + secs * 1000);
      const { error } = await supabase.from("store_premium_subscriptions")
        .update({ locked_until: until.toISOString(), lock_reason: lockReason.trim() || "Pelanggaran" }).eq("id", manage.id);
      if (error) throw error;
      await notify(manage.visitor_id, "🔒 Membership Dikunci", `Membership premium kamu dikunci sampai ${until.toLocaleString("id-ID")} WIB. Alasan: ${lockReason.trim() || "Pelanggaran"}.`);
      toast({ title: "🔒 Membership dikunci", description: `Sampai ${until.toLocaleString("id-ID")}` });
      setManage({ ...manage, locked_until: until.toISOString(), lock_reason: lockReason.trim() || "Pelanggaran" });
      setLockReason("");
      load();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message || String(e), variant: "destructive" });
    } finally { setBusy(false); }
  };

  const unlockSub = async () => {
    if (!manage) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("store_premium_subscriptions")
        .update({ locked_until: null, lock_reason: null }).eq("id", manage.id);
      if (error) throw error;
      await notify(manage.visitor_id, "🔓 Membership Dibuka", "Kunci membership premium kamu telah dibuka admin.");
      toast({ title: "🔓 Kunci dibuka" });
      setManage({ ...manage, locked_until: null, lock_reason: null });
      load();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message || String(e), variant: "destructive" });
    } finally { setBusy(false); }
  };

  const fmt = (iso: string | null) => iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "-";
  const rp = (n: number) => "Rp " + Math.max(0, Number(n) || 0).toLocaleString("id-ID");
  const summary = summarizeHistory(allHistory);
  const now = Date.now();
  const STATE_UI: Record<MemberState, { label: string; cls: string }> = {
    active: { label: "AKTIF", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
    ending: { label: "≤ 3 HARI", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
    locked: { label: "🔒 KUNCI", cls: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30" },
    expired: { label: "BERAKHIR", cls: "bg-muted text-muted-foreground border-border" },
  };
  const mq = memberQuery.trim().toLowerCase();
  const shownSubs = subs.filter((s) => {
    if (!mq) return true;
    const info = nameMap[s.user_balance_id];
    return [info?.username, info?.phone, s.plan_name].some((v) => String(v || "").toLowerCase().includes(mq));
  });
  const endingCount = subs.filter((s) => memberState(s, now) === "ending").length;
  const lockedCount = subs.filter((s) => memberState(s, now) === "locked").length;
  const shownHistory = filterHistory(allHistory, historyKind);

  const SECTIONS = [
    { id: "paket", label: "Paket", Icon: Package, count: plans.length },
    { id: "manfaat", label: "Manfaat", Icon: Sparkles },
    { id: "manual", label: "Pemberian Manual", Icon: UserPlus },
    { id: "anggota", label: "Anggota Aktif", Icon: Users, count: subs.length },
    { id: "riwayat", label: "Riwayat", Icon: History, count: allHistory.length },
  ];

  const durationGrid = (vals: [string, number, (n: number) => void][]) => (
    <div className={`grid gap-1.5 ${vals.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
      {vals.map(([label, v, set]) => (
        <div key={label}><Label className="text-[10px] text-muted-foreground">{label}</Label><Input type="number" min={0} value={v} onChange={(e) => set(Math.max(0, +e.target.value || 0))} className="h-9 text-center" /></div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/15 via-yellow-500/5 to-orange-500/10 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-primary-foreground shadow-lg"><Crown className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-base font-black tracking-tight">Premium Store</p>
              <p className="text-[11px] text-muted-foreground">Paket, manfaat, pemberian manual, anggota & riwayat dalam satu tempat.</p>
            </div>
          </div>
          <Button size="sm" variant="outline" className="h-8 text-[11px]" onClick={() => window.open("/quest-mission", "_blank")}>
            <ExternalLink className="mr-1 h-3.5 w-3.5" /> Premium Quest User
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Anggota aktif", value: subs.length.toLocaleString("id-ID"), sub: `${endingCount} segera berakhir · ${lockedCount} dikunci`, Icon: Users },
            { label: "Pemasukan", value: rp(summary.revenue), sub: `${summary.paid} pembelian berbayar`, Icon: Wallet },
            { label: "Pemberian admin", value: summary.manual.toLocaleString("id-ID"), sub: "tanpa biaya", Icon: UserPlus },
            { label: "Paket aktif", value: `${plans.filter((p) => p.is_active).length}/${plans.length}`, sub: "dari daftar paket", Icon: Package },
          ].map(({ label, value, sub, Icon }) => (
            <div key={label} className="min-w-0 rounded-xl border bg-card/80 p-2.5">
              <p className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground"><Icon className="h-3 w-3" />{label}</p>
              <p className="truncate text-base font-black">{value}</p>
              <p className="truncate text-[9px] text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>
      </div>

      <Tabs value={section} onValueChange={setSection}>
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/60 p-1">
          {SECTIONS.map(({ id, label, Icon, count }) => (
            <TabsTrigger key={id} value={id} className="h-9 shrink-0 gap-1.5 rounded-lg px-3 text-[11px] font-black data-[state=active]:bg-card data-[state=active]:shadow">
              <Icon className="h-3.5 w-3.5" />{label}
              {count != null && <span className="rounded-full bg-muted px-1.5 text-[9px] leading-4">{count}</span>}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* PAKET */}
        <TabsContent value="paket" className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">Harga yang dibayar user selalu diambil server dari daftar ini.</p>
            <Button size="sm" onClick={() => setEditing({ name: "", duration_days: 30, price: 20000, description: "", sort_order: plans.length, is_active: true })}>
              <Plus className="mr-1 h-4 w-4" /> Tambah Paket
            </Button>
          </div>

          {editing && (
            <Card className="border-amber-500/40"><CardContent className="space-y-3 p-4">
              <p className="text-sm font-black">{editing.id ? "Edit Paket" : "Paket Baru"}</p>
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
                <Button onClick={save}><Save className="mr-1 h-4 w-4" /> Simpan</Button>
                <Button variant="outline" onClick={() => setEditing(null)}>Batal</Button>
              </div>
            </CardContent></Card>
          )}

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {plans.map((p) => {
              const perDay = p.duration_days > 0 ? Math.round(p.price / p.duration_days) : 0;
              return (
                <div key={p.id} className={`relative flex min-w-0 flex-col rounded-2xl border p-3 ${p.is_active ? "border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-transparent" : "bg-muted/30 opacity-70"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="flex min-w-0 items-center gap-1 text-sm font-black"><Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" /><span className="truncate">{p.name}</span></p>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black ${p.is_active ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "border-border bg-muted text-muted-foreground"}`}>{p.is_active ? "AKTIF" : "NONAKTIF"}</span>
                  </div>
                  <p className="mt-2 text-xl font-black">{rp(p.price)}</p>
                  <p className="text-[10px] text-muted-foreground">{p.duration_days} hari · ≈ {rp(perDay)}/hari</p>
                  {p.description && <p className="mt-1 line-clamp-2 text-[10px] text-muted-foreground">{p.description}</p>}
                  <div className="mt-3 flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-8 flex-1" onClick={() => setEditing(p)}><Pencil className="mr-1 h-3 w-3" /> Edit</Button>
                    <Button size="sm" variant="destructive" className="h-8" onClick={() => del(p.id)} aria-label={`Hapus ${p.name}`}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
          {plans.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Belum ada paket</p>}
        </TabsContent>

        {/* MANFAAT */}
        <TabsContent value="manfaat" className="mt-3">
          <AdminPremiumBenefitsPanel />
        </TabsContent>

        {/* PEMBERIAN MANUAL */}
        <TabsContent value="manual" className="mt-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="border-amber-500/30">
              <CardContent className="space-y-3 p-4">
                <p className="flex items-center gap-1.5 text-sm font-black"><UserPlus className="h-4 w-4 text-amber-500" /> Membership Premium Toko</p>
                <p className="text-[11px] text-muted-foreground">Jika user masih aktif, hari baru disambung setelah masa aktif berakhir. Tercatat di Riwayat sebagai pemberian admin (Rp 0).</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2"><Label className="text-[11px]">Username</Label><Input value={grantUsername} onChange={(e) => setGrantUsername(e.target.value)} placeholder="username user" /></div>
                  <div><Label className="text-[11px]">Hari Aktif</Label><Input type="number" min={1} value={grantDays} onChange={(e) => setGrantDays(+e.target.value)} /></div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[7, 30, 60, 180].map((d) => (
                    <button key={d} type="button" onClick={() => setGrantDays(d)} className={`rounded-full border px-2.5 py-1 text-[10px] font-black transition ${grantDays === d ? "border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-400" : "border-border text-muted-foreground"}`}>{d} hari</button>
                  ))}
                </div>
                <Button onClick={grantPremium} disabled={granting} className="w-full">
                  {granting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Crown className="mr-1 h-4 w-4" />} Aktifkan Premium
                </Button>
              </CardContent>
            </Card>

            <Card className="border-fuchsia-500/30">
              <CardContent className="space-y-3 p-4">
                <p className="flex items-center gap-1.5 text-sm font-black"><Crown className="h-4 w-4 text-fuchsia-500" /> Premium Quest</p>
                <p className="text-[11px] text-muted-foreground">Durasi presisi. User langsung bisa menjalankan Premium Quest harian/mingguan/bulanan & PRO LEGEND.</p>
                <div><Label className="text-[11px]">Username</Label><Input value={questUsername} onChange={(e) => setQuestUsername(e.target.value)} placeholder="username user" /></div>
                {durationGrid([["Hari", questD, setQuestD], ["Jam", questH, setQuestH], ["Menit", questM, setQuestM], ["Detik", questS, setQuestS]])}
                <Button onClick={grantPremiumQuest} disabled={grantingQuest} className="w-full">
                  {grantingQuest ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Crown className="mr-1 h-4 w-4" />} Aktifkan Premium Quest
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ANGGOTA AKTIF */}
        <TabsContent value="anggota" className="mt-3 space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="Cari username, nomor HP, atau paket" className="pl-9" />
          </div>
          <p className="text-[10px] text-muted-foreground">{shownSubs.length} dari {subs.length} anggota aktif</p>
          <div className="grid gap-2 md:grid-cols-2">
            {shownSubs.map((s) => {
              const info = nameMap[s.user_balance_id];
              const st = memberState(s, now);
              const ui = STATE_UI[st];
              const left = Math.max(0, new Date(s.expires_at).getTime() - now);
              const leftDays = Math.floor(left / 86400000);
              const leftHours = Math.floor((left % 86400000) / 3600000);
              return (
                <div key={s.id} className="flex min-w-0 items-center gap-2.5 rounded-xl border bg-card p-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-sm font-black text-primary-foreground">
                    {(info?.username || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <p className="truncate text-xs font-black">{info?.username || "Pengguna"}</p>
                      <span className={`shrink-0 rounded-full border px-1.5 text-[8px] font-black leading-4 ${ui.cls}`}>{ui.label}</span>
                    </div>
                    <p className="truncate text-[10px] text-muted-foreground">{s.plan_name}{info?.phone ? ` · ${info.phone}` : ""}</p>
                    <p className="text-[10px] text-muted-foreground">Sisa {leftDays} hari {leftHours} jam · s/d {fmt(s.expires_at)}</p>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 shrink-0 px-2.5" onClick={() => { setManage(s); setAddD(0); setAddH(0); setAddM(0); setAddS(0); setLockReason(""); setLockD(0); setLockH(1); setLockM(0); }}>
                    Kelola
                  </Button>
                </div>
              );
            })}
          </div>
          {shownSubs.length === 0 && <p className="py-6 text-center text-[11px] text-muted-foreground">{subs.length === 0 ? "Belum ada anggota aktif" : "Tidak ada anggota yang cocok"}</p>}
        </TabsContent>

        {/* RIWAYAT */}
        <TabsContent value="riwayat" className="mt-3 space-y-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black">Riwayat Premium Toko</p>
              <div className="flex gap-1 rounded-lg bg-muted/60 p-0.5">
                {([["all", `Semua ${summary.total}`], ["paid", `Berbayar ${summary.paid}`], ["manual", `Admin ${summary.manual}`]] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setHistoryKind(k)} className={`rounded-md px-2.5 py-1 text-[10px] font-black ${historyKind === k ? "bg-card shadow" : "text-muted-foreground"}`}>{l}</button>
                ))}
              </div>
            </div>
            <div className="overflow-hidden rounded-xl border">
              {shownHistory.map((h, i) => {
                const info = nameMap[h.user_balance_id];
                return (
                  <div key={h.id} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-2 p-2.5 text-[10px] ${i % 2 ? "bg-muted/20" : "bg-card"}`}>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold">{info?.username || "Pengguna"}</p>
                      <p className="truncate text-muted-foreground">{h.plan_name} · {h.duration_days} hari · {fmt(h.created_at)}</p>
                      <p className="truncate text-muted-foreground">{fmt(h.starts_at)} → {fmt(h.expires_at)}</p>
                    </div>
                    <span className={`self-start rounded-full px-2 py-0.5 text-[10px] font-black ${h.price_paid > 0 ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                      {h.price_paid > 0 ? rp(h.price_paid) : "Admin/Gratis"}
                    </span>
                  </div>
                );
              })}
              {shownHistory.length === 0 && <p className="py-6 text-center text-[11px] text-muted-foreground">Belum ada riwayat</p>}
            </div>
          </div>

          <div className="space-y-2">
            <p className="flex items-center gap-1 text-sm font-black"><Crown className="h-4 w-4 text-fuchsia-500" /> Riwayat Premium Quest ({premiumQuestSubs.length})</p>
            <div className="overflow-hidden rounded-xl border">
              {premiumQuestSubs.map((s, i) => {
                const info = nameMap[s.user_balance_id];
                const active = s.is_active && (s.is_permanent || !s.expires_at || new Date(s.expires_at).getTime() > now);
                return (
                  <div key={s.id} className={`p-2.5 text-[10px] ${i % 2 ? "bg-muted/20" : "bg-card"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-bold">{info?.username || "Pengguna"}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[8px] font-black ${active ? "bg-fuchsia-500/20 text-fuchsia-600" : "bg-muted text-muted-foreground"}`}>{active ? "AKTIF" : "SELESAI"}</span>
                    </div>
                    <p className="text-muted-foreground">{s.plan_name} · {s.price_paid_balance > 0 ? rp(s.price_paid_balance) : s.source === "trial" ? "Trial" : "Admin/Gratis"}</p>
                    <p className="text-muted-foreground">{fmt(s.starts_at)} → {s.is_permanent ? "Permanen" : fmt(s.expires_at)}</p>
                  </div>
                );
              })}
              {premiumQuestSubs.length === 0 && <p className="py-6 text-center text-[11px] text-muted-foreground">Belum ada Premium Quest</p>}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal kelola anggota */}
      {manage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm" onMouseDown={() => !busy && setManage(null)}>
          <div className="max-h-[85vh] w-full max-w-sm space-y-3 overflow-y-auto rounded-2xl border bg-card p-4 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <div>
              <p className="flex items-center gap-1.5 text-base font-black"><Crown className="h-4 w-4 text-amber-500" /> {nameMap[manage.user_balance_id]?.username || manage.plan_name}</p>
              <p className="text-[11px] text-muted-foreground">{manage.plan_name} · aktif sampai {fmt(manage.expires_at)}</p>
              {manage.locked_until && new Date(manage.locked_until).getTime() > Date.now() && (
                <p className="mt-1 text-[11px] font-bold text-red-500">🔒 Terkunci sampai {fmt(manage.locked_until)} — {manage.lock_reason}</p>
              )}
            </div>

            <div className="space-y-2 rounded-xl border p-2.5">
              <p className="flex items-center gap-1 text-xs font-black"><Clock className="h-3.5 w-3.5" /> Tambah Waktu</p>
              {durationGrid([["Hari", addD, setAddD], ["Jam", addH, setAddH], ["Menit", addM, setAddM], ["Detik", addS, setAddS]])}
              <Button size="sm" className="w-full" disabled={busy} onClick={addTime}><Plus className="mr-1 h-3.5 w-3.5" /> Tambah Waktu</Button>
            </div>

            <div className="space-y-2 rounded-xl border border-red-500/30 p-2.5">
              <p className="flex items-center gap-1 text-xs font-black text-red-600"><Lock className="h-3.5 w-3.5" /> Kunci (Pelanggaran)</p>
              <Input value={lockReason} onChange={(e) => setLockReason(e.target.value)} placeholder="Alasan pelanggaran" className="h-8 text-xs" />
              {durationGrid([["Hari", lockD, setLockD], ["Jam", lockH, setLockH], ["Menit", lockM, setLockM]])}
              <div className="grid grid-cols-2 gap-1.5">
                <Button size="sm" variant="destructive" disabled={busy} onClick={lockSub}><Lock className="mr-1 h-3.5 w-3.5" /> Kunci</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={unlockSub}><Unlock className="mr-1 h-3.5 w-3.5" /> Buka Kunci</Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <Button size="sm" variant="outline" disabled={busy} onClick={resetTime}><RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset</Button>
              <Button size="sm" variant="destructive" disabled={busy} onClick={() => { revokeSub(manage); setManage(null); }}><Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus</Button>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setManage(null)}>Tutup</Button>
          </div>
        </div>
      )}
    </div>
  );
}
