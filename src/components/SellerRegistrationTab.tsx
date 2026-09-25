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
  const [isSeller, setIsSeller] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function loadMine() {
    const { data } = await supabase
      .from("seller_applications")
      .select("*")
      .eq("visitor_id", vid)
      .order("created_at", { ascending: false });
    setMyApps(data || []);
  }
  useEffect(() => {
    loadMine();
    (async () => {
      const { data, error } = await supabase.from("seller_stores").select("id").eq("visitor_id", vid).limit(1);
      setIsSeller(!error && (data || []).length > 0);
    })();
  }, [vid]);

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

  // Halaman Seller selalu memakai marketplace hub. Form pendaftaran bukan bagian dari dashboard seller.
  return <SellerCommerceHub visitorId={vid} />;
