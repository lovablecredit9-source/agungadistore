import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMarketSignal } from "@/hooks/useMarketSignal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Store, Clock, Upload, X, ChevronLeft, ChevronRight, Loader2,
  Link2, FileText, BadgePercent, CheckCircle2, Eye, Hourglass, Ban, ImagePlus, RotateCcw, Trash2, AlertTriangle,
} from "lucide-react";
import { getVisitorId } from "@/lib/visitor-id";
import SellerCommerceHub from "@/components/SellerCommerceHub";

// Default: pendaftaran dibuka 15 September 2026 00:00 WIB (UTC+7).
// Admin bisa mengubah tanggal / memaksa buka-tutup lewat admin_settings.
export const DEFAULT_SELLER_OPEN_ISO = "2026-09-14T17:00:00Z";
const MAX_PHOTOS = 6;

function useCountdown(target: Date) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target.getTime() - now);
  return {
    open: diff === 0,
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
  };
}

async function compressImage(file: File, max = 720): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

const STATUS_META: Record<string, { label: string; icon: any; cls: string }> = {
  pending: { label: "⏳ Menunggu ditinjau admin", icon: Hourglass, cls: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  seen: { label: "👁️ Sudah dilihat admin", icon: Eye, cls: "bg-sky-500/15 text-sky-400 border-sky-500/30" },
  approved: { label: "✅ Disetujui", icon: CheckCircle2, cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  rejected: { label: "❌ Ditolak", icon: Ban, cls: "bg-rose-500/15 text-rose-400 border-rose-500/30" },
};

export default function SellerRegistrationTab({ visitorId, formOnly, onRegistered }: { visitorId?: string | null; formOnly?: boolean; onRegistered?: () => void }) {
  const { toast } = useToast();
  const vid = visitorId || getVisitorId();
  // Konfigurasi admin: tanggal buka + mode (auto / open / closed)
  const [openIso, setOpenIso] = useState<string>(DEFAULT_SELLER_OPEN_ISO);
  const [mode, setMode] = useState<"auto" | "open" | "closed">("auto");
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("admin_settings")
        .select("setting_key,setting_value")
        .in("setting_key", ["seller_open_date", "seller_registration_mode"]);
      for (const r of data || []) {
        if (r.setting_key === "seller_open_date" && r.setting_value) {
          const d = new Date(r.setting_value);
          if (!isNaN(d.getTime())) setOpenIso(d.toISOString());
        }
        if (r.setting_key === "seller_registration_mode" && ["auto", "open", "closed"].includes(r.setting_value || "")) {
          setMode(r.setting_value as any);
        }
      }
    })();
  }, []);

  const openDate = useMemo(() => new Date(openIso), [openIso]);
  const rawCd = useCountdown(openDate);
  const cd = { ...rawCd, open: mode === "open" ? true : mode === "closed" ? false : rawCd.open };
  const openLabel = openDate.toLocaleString("id-ID", {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta",
  }) + " WIB";

  const [storeName, setStoreName] = useState("");
  const [desc, setDesc] = useState("");
  const [reason, setReason] = useState("");
  const [shopUrl, setShopUrl] = useState("");
  const [feeOk, setFeeOk] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [bannerSize, setBannerSize] = useState<{ w: number; h: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [myApps, setMyApps] = useState<any[]>([]);
  const [resubmitId, setResubmitId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const bannerRef = useRef<HTMLInputElement>(null);

  async function loadMine() {
    const { data } = await supabase
      .from("seller_applications")
      .select("*")
      .eq("visitor_id", vid)
      .order("created_at", { ascending: false });
    setMyApps(data || []);
  }
  useEffect(() => { loadMine(); }, [vid]);
  useMarketSignal([vid], () => { loadMine(); });

  // Pendaftaran maksimal 1x: sembunyikan formulir kalau sudah ada pengajuan aktif (kecuali ditolak)
  const alreadyApplied = useMemo(
    () => myApps.some((a) => a.status !== "rejected"),
    [myApps]
  );
  const rejectedApp = useMemo(() => myApps.find((a) => a.status === "rejected") || null, [myApps]);

  // Isi formulir dari pengajuan yang ditolak untuk diajukan ulang (baris yang sama diperbarui)
  function startResubmit() {
    if (!rejectedApp) return;
    setResubmitId(rejectedApp.id);
    setStoreName(rejectedApp.store_name || "");
    setDesc(rejectedApp.description || "");
    setReason(rejectedApp.reason || "");
    setShopUrl(rejectedApp.shop_url || "");
    setPhotos(Array.isArray(rejectedApp.product_photos) ? rejectedApp.product_photos : []);
    setAvatar(rejectedApp.avatar_url || null);
    setBanner(rejectedApp.banner_url || null);
    setFeeOk(true);
  }

  async function onPickFiles(files: FileList | null) {
    if (!files) return;
    const remaining = MAX_PHOTOS - photos.length;
    const slice = Array.from(files).slice(0, remaining);
    for (const f of slice) {
      try {
        const dataUrl = await compressImage(f);
        setPhotos((p) => [...p, dataUrl]);
      } catch {
        toast({ title: "Gagal memproses foto", variant: "destructive" });
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onPickOne(file: File | undefined, setter: (v: string) => void, max: number) {
    if (!file) return;
    try { setter(await compressImage(file, max)); }
    catch { toast({ title: "Gagal memproses gambar", variant: "destructive" }); }
  }

  function movePhoto(i: number, dir: -1 | 1) {
    setPhotos((p) => {
      const next = [...p];
      const j = i + dir;
      if (j < 0 || j >= next.length) return p;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  const canSubmit = useMemo(
    () => storeName.trim().length >= 3 && desc.trim().length >= 10 && reason.trim().length >= 10 && feeOk && photos.length >= 1,
    [storeName, desc, reason, feeOk, photos]
  );

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const payload: any = {
        store_name: storeName.trim(),
        description: desc.trim(),
        reason: reason.trim(),
        shop_url: shopUrl.trim() || null,
        fee_accepted: feeOk,
        fee_percent: 5,
        product_photos: photos,
        avatar_url: avatar,
        banner_url: banner,
      };
      if (resubmitId) {
        // Ajukan ulang: perbarui baris yang sama, kembali ke antrean review admin
        const { error } = await supabase.from("seller_applications").update({
          ...payload, status: "pending", admin_note: null, submitted_at: new Date().toISOString(),
        }).eq("id", resubmitId).eq("status", "rejected");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("seller_applications").insert({
          ...payload, visitor_id: vid, submitted_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
      toast({ title: "✅ Pendaftaran terkirim!", description: "Admin akan meninjau pendaftaran tokomu." });
      setStoreName(""); setDesc(""); setReason(""); setShopUrl(""); setFeeOk(false); setPhotos([]);
      setAvatar(null); setBanner(null); setResubmitId(null);
      await loadMine();
    } catch (e: any) {
      toast({ title: "Gagal mengirim", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (!formOnly) return <SellerCommerceHub visitorId={vid} />;

  // Formulir tampil langsung untuk pendaftar baru; yang ditolak mengisi lewat "Perbaiki & Ajukan Ulang"
  const showForm = cd.open && (resubmitId !== null || (!alreadyApplied && !rejectedApp));

  return (
    <div className="space-y-3">
      {myApps.length > 0 && (
        <Card><CardContent className="p-3 space-y-2">
          <p className="text-xs font-bold">📋 Status pendaftaranmu</p>
          {myApps.map((a) => (
            <div key={a.id} className="rounded-lg border p-2 text-xs space-y-1">
              <div className="flex justify-between gap-2"><b className="truncate">🏪 {a.store_name}</b>
                <Badge variant="outline" className={"text-[9px] " + (STATUS_META[a.status]?.cls || "")}>{STATUS_META[a.status]?.label || a.status}</Badge></div>
              {a.admin_note && <p className="text-muted-foreground">Catatan admin: {a.admin_note}</p>}
              {a.submitted_at && <p className="text-[10px] text-muted-foreground">Diajukan {new Date(a.submitted_at).toLocaleString("id-ID")}</p>}
              {a.status === "rejected" && !alreadyApplied && !resubmitId && (
                <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={startResubmit}>
                  <RotateCcw className="w-3 h-3 mr-1" /> Perbaiki & Ajukan Ulang
                </Button>
              )}
            </div>
          ))}
        </CardContent></Card>
      )}

      {!cd.open ? (
        <Card><CardContent className="p-4 text-center space-y-2">
          <Clock className="w-6 h-6 mx-auto text-primary" />
          <p className="font-bold text-sm">Pendaftaran seller dibuka {openLabel}</p>
          {mode !== "closed" && <p className="text-xs text-muted-foreground">{cd.days} hari {cd.hours} jam {cd.mins} menit {cd.secs} detik lagi</p>}
        </CardContent></Card>
      ) : !showForm ? null : (
        <Card className="overflow-hidden"><CardContent className="p-0">
          <div className="border-b bg-primary/5 p-4">
            <h3 className="font-black text-base flex items-center gap-2"><Store className="w-5 h-5 text-primary" /> {resubmitId ? "Ajukan Ulang Pendaftaran" : "Daftar Jadi Seller"}</h3>
            <p className="mt-1 text-xs text-muted-foreground">Lengkapi data toko. Admin meninjau pendaftaran sebelum toko aktif.</p>
          </div>
          <div className="space-y-5 p-4">
          {/* Pratinjau toko langsung */}
          <section className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Pratinjau Toko</p>
            <div className="rounded-xl overflow-hidden border border-border bg-card">
              {banner ? <img src={banner} alt="Banner toko" className="w-full aspect-[4/1] object-cover object-center" />
                : <div className="w-full aspect-[4/1] bg-muted grid place-items-center text-[10px] text-muted-foreground">Banner toko (1600 × 400 px)</div>}
              <div className="px-3 pb-3 flex items-end gap-3 -mt-6">
                {avatar ? <img src={avatar} alt="Logo toko" className="w-14 h-14 shrink-0 rounded-xl object-cover border-2 border-background bg-background" />
                  : <div className="w-14 h-14 shrink-0 rounded-xl bg-muted grid place-items-center border-2 border-background"><Store className="w-6 h-6 text-muted-foreground" /></div>}
                <div className="min-w-0 pb-0.5">
                  <p className="text-sm font-black truncate">{storeName.trim() || "Nama Tokomu"}</p>
                </div>
              </div>
              <p className="px-3 pb-3 text-[11px] text-muted-foreground line-clamp-2 break-words">{desc.trim() || "Deskripsi toko akan tampil di sini."}</p>
            </div>
          </section>

          {/* Branding */}
          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Branding Toko</p>
            <div className="flex items-center gap-3 rounded-xl border p-3">
              {avatar ? <img src={avatar} alt="Logo toko" className="w-16 h-16 shrink-0 rounded-xl object-cover border" />
                : <div className="w-16 h-16 shrink-0 rounded-xl border border-dashed grid place-items-center"><ImagePlus className="w-5 h-5 text-muted-foreground" /></div>}
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-xs font-bold">Foto / Logo Toko</p>
                <p className="text-[10px] text-muted-foreground">Persegi, disarankan 400 × 400 px.</p>
                <div className="flex flex-wrap gap-1.5">
                  <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => avatarRef.current?.click()}><Upload className="w-3 h-3 mr-1" />{avatar ? "Ganti Foto" : "Upload Foto"}</Button>
                  {avatar && <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={() => setAvatar(null)}><Trash2 className="w-3 h-3 mr-1" />Hapus Foto</Button>}
                </div>
              </div>
            </div>
            <div className="space-y-2 rounded-xl border p-3">
              <p className="text-xs font-bold">Banner Toko</p>
              {banner ? <img src={banner} alt="Pratinjau banner" className="w-full aspect-[4/1] rounded-lg object-cover object-center border" />
                : <button type="button" onClick={() => bannerRef.current?.click()} className="w-full aspect-[4/1] rounded-lg border border-dashed grid place-items-center text-[10px] text-muted-foreground"><span className="flex items-center gap-1"><ImagePlus className="w-4 h-4" />Upload banner</span></button>}
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => bannerRef.current?.click()}><Upload className="w-3 h-3 mr-1" />{banner ? "Ganti Banner" : "Upload Banner"}</Button>
                {banner && <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={() => { setBanner(null); setBannerSize(null); }}><Trash2 className="w-3 h-3 mr-1" />Hapus Banner</Button>}
              </div>
              <div className="rounded-lg bg-muted/50 p-2 text-[10px] text-muted-foreground">
                <p className="font-bold text-foreground">Ukuran banner: 1600 × 400 px</p>
                <p>Gunakan gambar dengan ukuran 1600 × 400 px agar tampilan banner optimal.</p>
              </div>
              {bannerSize && Math.abs(bannerSize.w / bannerSize.h - 4) > 0.15 && (
                <div className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-[10px]">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-destructive" />
                  <p>Gambarmu {bannerSize.w} × {bannerSize.h} px. Banner tetap dipakai, tetapi bagian atas/bawah atau kiri/kanan bisa terpotong seperti pratinjau di atas (dipotong dari tengah, tidak melar).</p>
                </div>
              )}
            </div>
            <input ref={avatarRef} type="file" accept="image/*" hidden onChange={(e) => { onPickOne(e.target.files?.[0], setAvatar, 400); e.target.value = ""; }} />
            <input ref={bannerRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) { createImageBitmap(f).then((b) => setBannerSize({ w: b.width, h: b.height })).catch(() => setBannerSize(null)); } onPickOne(f, setBanner, 1600); e.target.value = ""; }} />
          </section>

          {/* Identitas */}
          <section className="space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Identitas Toko</p>
            <div className="space-y-1"><Label className="text-xs">Nama toko</Label><Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Min. 3 huruf" maxLength={60} /><p className="text-right text-[10px] text-muted-foreground">{storeName.length}/60</p></div>
            <div className="space-y-1"><Label className="text-xs flex items-center gap-1"><FileText className="w-3 h-3" /> Deskripsi produk</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Min. 10 huruf" maxLength={400} /><p className="text-right text-[10px] text-muted-foreground">{desc.length}/400</p></div>
            <div className="space-y-1"><Label className="text-xs">Alasan ingin berjualan</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Min. 10 huruf" maxLength={400} /></div>
            <div className="space-y-1"><Label className="text-xs flex items-center gap-1"><Link2 className="w-3 h-3" /> Link toko (opsional)</Label><Input value={shopUrl} onChange={(e) => setShopUrl(e.target.value)} placeholder="https://..." /></div>
          </section>

          {/* Foto produk */}
          <section className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Foto Produk ({photos.length}/{MAX_PHOTOS})</p>
            <div className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (
                <div key={i} className="relative">
                  <img src={p} alt="" className="h-20 w-full object-cover rounded-lg border" />
                  <button type="button" aria-label="Hapus foto" onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))} className="absolute top-1 right-1 rounded-full bg-background/80 p-0.5"><X className="w-3 h-3" /></button>
                  <div className="absolute bottom-1 inset-x-1 flex justify-between">
                    <button type="button" onClick={() => movePhoto(i, -1)} className="rounded bg-background/80"><ChevronLeft className="w-3 h-3" /></button>
                    <button type="button" onClick={() => movePhoto(i, 1)} className="rounded bg-background/80"><ChevronRight className="w-3 h-3" /></button>
                  </div>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button type="button" onClick={() => fileRef.current?.click()} className="h-20 rounded-lg border border-dashed flex flex-col items-center justify-center gap-1 text-[10px] text-muted-foreground"><Upload className="w-5 h-5" />Tambah</button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onPickFiles(e.target.files)} />
          </section>

          <section className="space-y-3 rounded-xl border p-3">
            <label className="flex items-start gap-2 text-xs"><Checkbox checked={feeOk} onCheckedChange={(v) => setFeeOk(!!v)} /><span className="flex items-center gap-1"><BadgePercent className="w-3 h-3 shrink-0" /> Saya setuju Admin Fee seller 5% per transaksi serta syarat & ketentuan marketplace</span></label>
            <Button className="w-full" disabled={!canSubmit || saving} onClick={async () => { await submit(); onRegistered?.(); }}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : resubmitId ? "Kirim Ulang Pendaftaran" : "Kirim Pendaftaran"}
            </Button>
            {!canSubmit && <p className="text-center text-[10px] text-muted-foreground">Isi nama toko, deskripsi, alasan, minimal 1 foto produk, dan setujui biaya.</p>}
          </section>
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}
