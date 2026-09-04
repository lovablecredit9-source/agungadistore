import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Store, Loader2, RefreshCw, Eye, CheckCircle2, Ban, Link2, ChevronLeft, ChevronRight } from "lucide-react";

const STATUS = [
  { value: "pending", label: "⏳ Menunggu" },
  { value: "seen", label: "👁️ Dilihat" },
  { value: "approved", label: "✅ Disetujui" },
  { value: "rejected", label: "❌ Ditolak" },
];

const STATUS_CLS: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  seen: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  rejected: "bg-rose-500/15 text-rose-400 border-rose-500/30",
};

export default function AdminSellerTab() {
  const { toast } = useToast();
  const [apps, setApps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [photoIdx, setPhotoIdx] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  // Pengaturan jadwal pendaftaran seller
  const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    const wib = new Date(d.getTime() + 7 * 3600000);
    return wib.toISOString().slice(0, 16);
  };
  const [openLocal, setOpenLocal] = useState<string>(toLocalInput("2026-09-14T17:00:00Z"));
  const [regMode, setRegMode] = useState<"auto" | "open" | "closed">("auto");
  const [savingCfg, setSavingCfg] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("setting_key,setting_value")
        .in("setting_key", ["seller_open_date", "seller_registration_mode"]);
      for (const r of data || []) {
        if (r.setting_key === "seller_open_date" && r.setting_value) {
          const d = new Date(r.setting_value);
          if (!isNaN(d.getTime())) setOpenLocal(toLocalInput(d.toISOString()));
        }
        if (r.setting_key === "seller_registration_mode" && ["auto", "open", "closed"].includes(r.setting_value || "")) {
          setRegMode(r.setting_value as any);
        }
      }
    })();
  }, []);

  async function saveSellerSettings() {
    setSavingCfg(true);
    try {
      // input datetime-local dianggap WIB -> konversi ke UTC
      const iso = new Date(new Date(`${openLocal}:00Z`).getTime() - 7 * 3600000).toISOString();
      const rows = [
        { setting_key: "seller_open_date", setting_value: iso },
        { setting_key: "seller_registration_mode", setting_value: regMode },
      ];
      for (const r of rows) {
        const { data: existing } = await supabase
          .from("admin_settings").select("id").eq("setting_key", r.setting_key).maybeSingle();
        if (existing) {
          const { error } = await supabase.from("admin_settings")
            .update({ setting_value: r.setting_value, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("admin_settings").insert(r);
          if (error) throw error;
        }
      }
      toast({ title: "✅ Jadwal pendaftaran disimpan" });
    } catch (e: any) {
      toast({ title: "Gagal menyimpan", description: e.message, variant: "destructive" });
    } finally {
      setSavingCfg(false);
    }
  }


  async function load() {
    setLoading(true);
    try {
      let q = supabase.from("seller_applications").select("*").order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      setApps(data || []);
      // Tandai otomatis "dilihat admin" untuk yang masih pending
      const unseen = (data || []).filter((a) => a.status === "pending" && !a.seen_by_admin_at);
      if (unseen.length > 0) {
        await supabase
          .from("seller_applications")
          .update({ seen_by_admin_at: new Date().toISOString(), status: "seen" })
          .in("id", unseen.map((a) => a.id));
      }
    } catch (e: any) {
      toast({ title: "Gagal memuat", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [filter]);

  async function setStatus(id: string, status: string) {
    const { error } = await supabase
      .from("seller_applications")
      .update({ status, admin_note: notes[id] || null, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast({ title: "Gagal update", description: error.message, variant: "destructive" });
    else { toast({ title: "✅ Status diperbarui" }); await load(); }
  }

  const pendingCount = apps.filter((a) => a.status === "pending" || a.status === "seen").length;

  return (
    <Card className="bg-card/50 backdrop-blur border-border">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-teal-400" />
            <h2 className="text-lg font-bold">🏪 Pendaftaran Seller</h2>
            <Badge variant="secondary">{apps.length} pendaftar</Badge>
            {pendingCount > 0 && <Badge className="bg-yellow-500 text-yellow-950">{pendingCount} baru</Badge>}
          </div>
          <div className="flex gap-2">
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                {STATUS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-3.5 h-3.5" /></Button>
          </div>
        </div>

        {/* Kontrol jadwal pendaftaran */}
        <div className="rounded-xl border border-teal-400/25 bg-teal-500/[0.06] p-3 space-y-2">
          <p className="text-xs font-bold text-teal-300">🗓️ Jadwal & Status Pendaftaran</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground">Tanggal buka (WIB)</span>
              <input
                type="datetime-local"
                value={openLocal}
                onChange={(e) => setOpenLocal(e.target.value)}
                className="block h-8 rounded-md border bg-background px-2 text-xs"
              />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground">Mode</span>
              <Select value={regMode} onValueChange={(v) => setRegMode(v as any)}>
                <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">🤖 Otomatis (ikut tanggal)</SelectItem>
                  <SelectItem value="open">✅ Paksa BUKA</SelectItem>
                  <SelectItem value="closed">⛔ Paksa TUTUP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={saveSellerSettings} disabled={savingCfg} className="h-8">
              {savingCfg ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Simpan"}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">Perubahan langsung tampil di halaman pendaftaran user.</p>
        </div>


        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : apps.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Belum ada pendaftaran seller.</p>
        ) : (
          <div className="space-y-3">
            {apps.map((a) => {
              const idx = photoIdx[a.id] || 0;
              const photos: string[] = a.product_photos || [];
              return (
                <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">🏪 {a.store_name} <span className="text-[10px] text-muted-foreground font-normal">#{a.app_number}</span></p>
                      <p className="text-[10px] text-muted-foreground">
                        Daftar: {new Date(a.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                        {a.seen_by_admin_at && <> · Dilihat: {new Date(a.seen_by_admin_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}</>}
                      </p>
                      <p className="text-[10px] text-muted-foreground font-mono">visitor: {a.visitor_id.slice(0, 12)}…</p>
                    </div>
                    <Badge variant="outline" className={`text-[9px] shrink-0 ${STATUS_CLS[a.status] || ""}`}>
                      {STATUS.find((s) => s.value === a.status)?.label || a.status}
                    </Badge>
                  </div>

                  {/* Foto produk dengan navigasi geser */}
                  {photos.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={idx <= 0}
                        onClick={() => setPhotoIdx((p) => ({ ...p, [a.id]: idx - 1 }))}
                        className="p-1 rounded bg-white/10 disabled:opacity-30"
                      ><ChevronLeft className="w-4 h-4" /></button>
                      <div className="flex-1 flex justify-center">
                        <img src={photos[idx]} alt={`Produk ${idx + 1}`} className="h-36 rounded-xl object-cover border border-white/10" />
                      </div>
                      <button
                        type="button"
                        disabled={idx >= photos.length - 1}
                        onClick={() => setPhotoIdx((p) => ({ ...p, [a.id]: idx + 1 }))}
                        className="p-1 rounded bg-white/10 disabled:opacity-30"
                      ><ChevronRight className="w-4 h-4" /></button>
                    </div>
                  )}
                  {photos.length > 1 && <p className="text-center text-[9px] text-muted-foreground">Foto {idx + 1}/{photos.length} · geser untuk melihat</p>}

                  <div className="text-xs space-y-1">
                    <p><span className="font-bold text-muted-foreground">Deskripsi:</span> {a.description}</p>
                    <p><span className="font-bold text-muted-foreground">Alasan:</span> {a.reason}</p>
                    <p className="flex items-center gap-1 flex-wrap">
                      <span className="font-bold text-muted-foreground">Fee:</span>
                      <Badge variant="outline" className={a.fee_accepted ? "text-emerald-400 border-emerald-500/30" : "text-rose-400 border-rose-500/30"}>
                        {a.fee_accepted ? `Setuju ${a.fee_percent}%` : "Tidak setuju"}
                      </Badge>
                      {a.shop_url && (
                        <a href={a.shop_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sky-400 hover:underline">
                          <Link2 className="w-3 h-3" /> Link toko
                        </a>
                      )}
                    </p>
                  </div>

                  <Textarea
                    rows={1}
                    placeholder="Catatan admin untuk pendaftar (opsional)…"
                    value={notes[a.id] ?? a.admin_note ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))}
                    className="text-xs"
                  />

                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => setStatus(a.id, "approved")}>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Setujui
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setStatus(a.id, "seen")}>
                      <Eye className="w-3.5 h-3.5 mr-1" /> Tandai Dilihat
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => setStatus(a.id, "rejected")}>
                      <Ban className="w-3.5 h-3.5 mr-1" /> Tolak
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
