import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
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
  Link2, FileText, BadgePercent, CheckCircle2, Eye, Hourglass, Ban, ImagePlus,
} from "lucide-react";
import { getVisitorId } from "@/lib/visitor-id";
import SellerDashboard from "@/components/SellerDashboard";
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

async function compressImage(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const max = 720;
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

export default function SellerRegistrationTab({ visitorId }: { visitorId?: string | null }) {
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
  const [saving, setSaving] = useState(false);
  const [myApps, setMyApps] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  // Navigasi sub-tab area penjual: etalase produk vs pengaturan/kelola toko
  const [sellerSub, setSellerSub] = useState<"produk" | "chat" | "pesanan" | "pengaturan">("produk");

  async function loadMine() {
    const { data } = await supabase
      .from("seller_applications")
      .select("*")
      .eq("visitor_id", vid)
      .order("created_at", { ascending: false });
    setMyApps(data || []);
  }
  useEffect(() => { loadMine(); }, [vid]);

  // Pendaftaran maksimal 1x: sembunyikan formulir kalau sudah ada pengajuan (kecuali ditolak)
  const alreadyApplied = useMemo(
    () => myApps.some((a) => a.status !== "rejected"),
    [myApps]
  );

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
      const { error } = await supabase.from("seller_applications").insert({
        visitor_id: vid,
        store_name: storeName.trim(),
        description: desc.trim(),
        reason: reason.trim(),
        shop_url: shopUrl.trim() || null,
        fee_accepted: feeOk,
        fee_percent: 5,
        product_photos: photos,
      });
      if (error) throw error;
      toast({ title: "✅ Pendaftaran terkirim!", description: "Admin akan meninjau pendaftaran tokomu." });
      setStoreName(""); setDesc(""); setReason(""); setShopUrl(""); setFeeOk(false); setPhotos([]);
      await loadMine();
    } catch (e: any) {
      toast({ title: "Gagal mengirim", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-teal-400/30 bg-gradient-to-br from-slate-900/80 via-teal-950/40 to-slate-900/80 backdrop-blur-xl p-5 text-center">
        <div className="absolute -top-16 -right-10 w-44 h-44 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-10 w-44 h-44 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-400/10 border border-teal-400/30 text-teal-300 text-[10px] font-extrabold tracking-[0.25em] uppercase">
            <Store className="w-3.5 h-3.5" /> Seller Program
          </div>
          <h2 className="mt-3 text-2xl font-black bg-gradient-to-r from-teal-300 via-cyan-300 to-blue-300 bg-clip-text text-transparent">
            Pendaftaran Jualan
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Buka toko sendiri di Agung Adi Store · Fee jualan hanya <span className="font-bold text-teal-300">5%</span> per transaksi
          </p>
        </div>
      </div>

      {/* Tab Produk: etalase produk semua penjual */}
      {sellerSub === "produk" && <SellerCommerceHub visitorId={vid} />}

      {sellerSub === "chat" && <SellerCommerceHub visitorId={vid} />}

      {/* Tab Pesanan: riwayat pesanan pembeli */}
      {sellerSub === "pesanan" && <SellerCommerceHub visitorId={vid} />}

      {/* Tab Pengaturan: dashboard toko + formulir pendaftaran */}
      {sellerSub === "pengaturan" && (
        <>
          {/* Dashboard toko (muncul kalau pendaftaran sudah disetujui) */}
          <SellerDashboard visitorId={vid} />
        </>
      )}

      {sellerSub === "pengaturan" && (alreadyApplied ? (
        /* Sudah pernah daftar → formulir disembunyikan (maksimal 1x pendaftaran) */
        <Card className="border-teal-400/30 bg-gradient-to-br from-teal-950/30 to-slate-900/60">
          <CardContent className="p-6 text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-400/15 border border-teal-400/40 text-teal-300 text-xs font-extrabold">
              <Store className="w-4 h-4" /> Kamu sudah terdaftar sebagai penjual
            </div>
            <p className="text-xs text-muted-foreground">
              Pendaftaran toko hanya bisa dilakukan <span className="font-bold text-teal-300">satu kali</span>. Formulir tidak ditampilkan lagi. Kelola tokomu lewat dashboard di atas.
            </p>
          </CardContent>
        </Card>
      ) : !cd.open ? (
        /* Status pendaftaran: ditutup admin atau menunggu jadwal */
        <Card className="border-yellow-400/30 bg-gradient-to-br from-yellow-950/30 to-slate-900/60">
          <CardContent className="p-6 text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-400/15 border border-yellow-400/40 text-yellow-300 text-xs font-extrabold">
              <Clock className="w-4 h-4 animate-pulse" />
              {mode === "closed" ? "Pendaftaran sedang DITUTUP admin" : `Pendaftaran dibuka ${openLabel}`}
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === "closed"
                ? "Admin menutup pendaftaran seller untuk sementara. Pantau terus halaman ini, statusnya akan berubah otomatis saat dibuka kembali."
                : "Siapkan nama toko, deskripsi, foto produk & link tokomu dari sekarang. Countdown menuju pembukaan:"}
            </p>
            {mode !== "closed" && (
              <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto">
                {[
                  { v: cd.days, l: "Hari" },
                  { v: cd.hours, l: "Jam" },
                  { v: cd.mins, l: "Menit" },
                  { v: cd.secs, l: "Detik" },
                ].map((x) => (
                  <div key={x.l} className="rounded-xl bg-slate-900/70 border border-yellow-400/20 py-3">
                    <div className="text-xl font-black text-yellow-300 tabular-nums">{String(x.v).padStart(2, "0")}</div>
                    <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{x.l}</div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground italic">
              Formulir pendaftaran akan otomatis terbuka di halaman ini saat waktunya tiba.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Formulir pendaftaran */
        <Card className="bg-card/60 backdrop-blur border-teal-400/20">
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Store className="w-3.5 h-3.5 text-teal-400" /> Nama Toko *</Label>
              <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Contoh: Toko Berkah Jaya" maxLength={60} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-cyan-400" /> Deskripsi Toko *</Label>
              <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Jual apa saja? Jelaskan produk & keunggulan tokomu (min. 10 karakter)" maxLength={1000} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Alasan ingin bergabung *</Label>
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Kenapa kamu ingin jualan di Agung Adi Store? (min. 10 karakter)" maxLength={1000} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5 text-blue-400" /> Link Toko (opsional)</Label>
              <Input value={shopUrl} onChange={(e) => setShopUrl(e.target.value)} placeholder="https://... (link toko/sosmed kamu)" />
            </div>

            {/* Upload foto produk */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1.5"><Upload className="w-3.5 h-3.5 text-purple-400" /> Foto Produk Jualan * (maks {MAX_PHOTOS}, bisa digeser urutannya)</Label>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((ph, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden border border-white/10 aspect-square">
                    <img src={ph} alt={`Foto produk ${i + 1}`} className="w-full h-full object-cover" />
                    <span className="absolute top-1 left-1 text-[9px] font-bold bg-black/60 rounded px-1.5 py-0.5">{i + 1}</span>
                    <div className="absolute inset-x-0 bottom-0 flex justify-center gap-1 p-1 bg-black/50 opacity-0 group-hover:opacity-100 transition">
                      <button type="button" onClick={() => movePhoto(i, -1)} className="p-1 rounded bg-white/20" aria-label="Geser kiri"><ChevronLeft className="w-3 h-3" /></button>
                      <button type="button" onClick={() => setPhotos((p) => p.filter((_, x) => x !== i))} className="p-1 rounded bg-rose-500/70" aria-label="Hapus foto"><X className="w-3 h-3" /></button>
                      <button type="button" onClick={() => movePhoto(i, 1)} className="p-1 rounded bg-white/20" aria-label="Geser kanan"><ChevronRight className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="aspect-square rounded-xl border-2 border-dashed border-teal-400/40 flex flex-col items-center justify-center gap-1 text-teal-300 hover:bg-teal-400/10 transition"
                  >
                    <ImagePlus className="w-6 h-6" />
                    <span className="text-[9px] font-bold">Tambah Foto</span>
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onPickFiles(e.target.files)} />
            </div>

            {/* Persetujuan fee */}
            <label className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 cursor-pointer">
              <Checkbox checked={feeOk} onCheckedChange={(v) => setFeeOk(!!v)} className="mt-0.5" />
              <span className="text-xs leading-relaxed">
                <span className="font-bold flex items-center gap-1 text-amber-300"><BadgePercent className="w-3.5 h-3.5" /> Fee Jualan 5%</span>
                Saya siap menerima fee jualan sebesar <b>5%</b> dari setiap transaksi yang berhasil melalui Agung Adi Store.
              </span>
            </label>

            <Button
              onClick={submit}
              disabled={!canSubmit || saving}
              className="w-full bg-gradient-to-r from-teal-500 via-cyan-500 to-blue-500 text-white font-black shadow-lg shadow-cyan-500/30"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Store className="w-4 h-4 mr-2" />}
              Kirim Pendaftaran
            </Button>
            <p className="text-[10px] text-center text-muted-foreground">
              Pendaftaran akan ditinjau admin. Status bisa kamu pantau di bawah.
            </p>
          </CardContent>
        </Card>
      ))}

      {/* Riwayat pendaftaran saya (tab Pengaturan) */}
      {sellerSub === "pengaturan" && myApps.length > 0 && (
        <Card className="bg-card/60 backdrop-blur border-border">
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-extrabold flex items-center gap-2">📋 Pendaftaran Saya</h3>
            {myApps.map((a) => {
              const meta = STATUS_META[a.status] || STATUS_META.pending;
              return (
                <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">🏪 {a.store_name} <span className="text-[10px] text-muted-foreground">#{a.app_number}</span></p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(a.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    </div>
                    <Badge variant="outline" className={`text-[9px] ${meta.cls}`}>{meta.label}</Badge>
                  </div>
                  {a.product_photos?.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto">
                      {a.product_photos.map((ph: string, i: number) => (
                        <img key={i} src={ph} alt={`Foto ${i + 1}`} className="w-14 h-14 rounded-lg object-cover border border-white/10" loading="lazy" />
                      ))}
                    </div>
                  )}
                  {a.admin_note && (
                    <p className="text-[11px] bg-sky-500/10 border border-sky-500/20 rounded-lg p-2">💬 Admin: {a.admin_note}</p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
