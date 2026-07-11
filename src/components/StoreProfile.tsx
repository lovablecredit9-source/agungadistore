import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Star, Sparkles, Users, Calendar, Package, BadgeCheck, UserPlus, Crown, X, Store as StoreIcon, MessageCircle, ListFilter, Share2, Circle, ArrowUpDown, Heart, Flame, Clock, Gift, Copy, Zap } from "lucide-react";
import { WA_NUMBER } from "@/lib/social-links";
import storeQris from "@/assets/store-qris.jpg";
import { useResponseRate, getResponseTextColor, getResponseColor } from "@/hooks/useResponseRate";
import StorePremiumTab from "@/components/StorePremiumTab";
import { useStorePremium } from "@/hooks/useStorePremium";
import ProductRecommendations from "@/components/ProductRecommendations";

interface Product {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
  sold_count?: number;
  category?: string | null;
  [key: string]: any;
}

interface StoreProfileProps {
  products: Product[];
  userBalance: { id: string; visitor_id: string; username: string } | null;
  activeVisitorId?: string | null;
  onLoginRequired: () => void;
  onProductClick?: (id: string) => void;
}

const STORE_JOIN_DATE = "2026-04-06"; // Tanggal bergabung toko (6 April 2026)
const STORE_RATING = 5.0;

const formatJoinDate = (iso: string) => {
  // Parse YYYY-MM-DD secara eksplisit untuk hindari timezone shift
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${parseInt(d)} ${months[parseInt(mo) - 1]} ${y}`;
};

const formatPrice = (n: number) => "Rp " + n.toLocaleString("id-ID");

// Format relative time bahasa Indonesia
const formatRelativeTime = (iso: string | null): string => {
  if (!iso) return "lama tidak aktif";
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "baru saja";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} hari lalu`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} bulan lalu`;
  return `${Math.floor(mo / 12)} tahun lalu`;
};

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 menit

type SortMode = "default" | "cheapest" | "expensive" | "bestseller" | "popular" | "newest";

type FollowVoucher = {
  code: string;
  discount_amount: number;
  expires_at: string | null;
  already_claimed?: boolean;
};

// ============== MODAL GLOBAL — selalu mounted di Index level (di luar tab) ==============
export const StoreProfileModal = ({
  products,
  userBalance,
  activeVisitorId,
  onLoginRequired,
  onProductClick,
}: StoreProfileProps) => {
  const [open, setOpen] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [recentFollowers, setRecentFollowers] = useState<string[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>("Semua");
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [adminLastActive, setAdminLastActive] = useState<string | null>(null);
  const [, setNowTick] = useState(0);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [followVoucher, setFollowVoucher] = useState<FollowVoucher | null>(null);
  const [flashSales, setFlashSales] = useState<any[]>([]);
  const { toast } = useToast();
  const responseRate = useResponseRate();
  const myPremium = useStorePremium(activeVisitorId ?? userBalance?.visitor_id ?? null);

  const isAdminOnline = adminLastActive
    ? Date.now() - new Date(adminLastActive).getTime() < ONLINE_THRESHOLD_MS
    : false;

  const categories = ["Semua", ...Array.from(new Set(products.map(p => p.category || "Lainnya")))];
  const baseFiltered = selectedCat === "Semua"
    ? products
    : products.filter(p => (p.category || "Lainnya") === selectedCat);

  const filteredProducts = [...baseFiltered].sort((a, b) => {
    switch (sortMode) {
      case "cheapest": return (a.price || 0) - (b.price || 0);
      case "expensive": return (b.price || 0) - (a.price || 0);
      case "bestseller": return (b.sold_count || 0) - (a.sold_count || 0);
      case "popular": return (likeCounts[b.id] || 0) - (likeCounts[a.id] || 0);
      case "newest": return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      default: return 0;
    }
  });

  const fetchFollowers = async () => {
    const { data, count } = await supabase
      .from("store_followers" as any)
      .select("username", { count: "exact" })
      .order("created_at", { ascending: false })
      .limit(8);
    setFollowersCount(count || 0);
    setRecentFollowers((data as any[] || []).map(r => r.username || "Anonim"));

    if (userBalance?.id) {
      const { data: own } = await supabase
        .from("store_followers" as any)
        .select("id")
        .eq("user_balance_id", userBalance.id)
        .maybeSingle();
      setIsFollowing(!!own);
    } else {
      setIsFollowing(false);
    }
  };

  const fetchAdminStatus = async () => {
    const { data } = await supabase
      .from("admin_settings")
      .select("setting_value, updated_at")
      .eq("setting_key", "admin_last_active")
      .maybeSingle();
    setAdminLastActive((data as any)?.setting_value || (data as any)?.updated_at || null);
  };

  const fetchLikeCounts = async () => {
    if (!products.length) return;
    const ids = products.map(p => p.id);
    const { data } = await supabase
      .from("liked_products" as any)
      .select("product_id")
      .in("product_id", ids);
    const counts: Record<string, number> = {};
    (data as any[] || []).forEach(r => { counts[r.product_id] = (counts[r.product_id] || 0) + 1; });
    setLikeCounts(counts);
  };

  const fetchFlashSales = async () => {
    const { data } = await supabase
      .from("store_flash_sales")
      .select("*")
      .eq("is_active", true)
      .order("ends_at", { ascending: true });
    setFlashSales((data as any[]) || []);
  };

  useEffect(() => {
    fetchFollowers();
    fetchAdminStatus();
    fetchLikeCounts();
    fetchFlashSales();
    const ch = supabase
      .channel("store-profile-modal-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "store_followers" }, () => fetchFollowers())
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_settings", filter: "setting_key=eq.admin_last_active" }, () => fetchAdminStatus())
      .on("postgres_changes", { event: "*", schema: "public", table: "liked_products" }, () => fetchLikeCounts())
      .on("postgres_changes", { event: "*", schema: "public", table: "store_flash_sales" }, () => fetchFlashSales())
      .subscribe();
    const openHandler = () => setOpen(true);
    window.addEventListener("open-store-profile", openHandler);
    // Refresh status admin, relative time, dan tick countdown tiap 1 detik (untuk flash sale timer)
    const tick = setInterval(() => {
      setNowTick(t => t + 1);
    }, 1000);
    const adminTick = setInterval(() => {
      if (open) fetchAdminStatus();
    }, 30000);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("open-store-profile", openHandler);
      clearInterval(tick);
      clearInterval(adminTick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userBalance?.id, open, products.length]);

  const handleShare = async () => {
    const url = window.location.origin;
    const text = `🏪 Agung Adi Store — Murah & Terpercaya\nBelanja voucher & produk digital di sini: ${url}`;
    // Selalu copy clipboard dulu (paling reliable, terutama di iframe/PWA)
    let copied = false;
    try {
      await navigator.clipboard.writeText(`${text}`);
      copied = true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        copied = true;
      } catch {}
    }
    // Coba Web Share API (silent fail kalau diblokir)
    try {
      if (navigator.share) {
        await navigator.share({ title: "Agung Adi Store", text, url });
        return;
      }
    } catch {
      // diabaikan — clipboard sudah handle fallback
    }
    if (copied) {
      toast({ title: "✅ Link disalin!", description: "Tautan toko berhasil disalin ke clipboard." });
    } else {
      toast({ title: "Gagal berbagi", description: "Coba salin manual: " + url, variant: "destructive" });
    }
  };

  const handleChat = () => {
    setOpen(false);
    // Buka chat toko in-app (product chat dengan produk pertama sebagai konteks)
    window.dispatchEvent(new Event("open-store-chat"));
  };

  const copyFollowVoucher = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    toast({ title: "Kode voucher disalin", description: code });
  };

  const claimFollowVoucher = async (showClaimedNotice = false) => {
    if (!userBalance) return null;
    const { data, error } = await supabase.rpc("generate_follow_voucher" as any, {
      p_visitor_id: userBalance.visitor_id,
    });
    if (error) throw error;
    const v: any = Array.isArray(data) ? data[0] : data;
    if (v?.code) {
      const voucher = {
        code: v.code,
        discount_amount: Number(v.discount_amount || 1000),
        expires_at: v.expires_at || null,
        already_claimed: !!v.already_claimed,
      };
      setFollowVoucher(voucher);
      await copyFollowVoucher(voucher.code);
      toast({
        title: v.already_claimed && showClaimedNotice ? "🎁 Voucher follow kamu" : "🎁 Voucher Diskon Rp 1.000!",
        description: `Kode: ${voucher.code} — sudah disalin. Pakai saat checkout produk.`,
        duration: 10000,
      });
      window.dispatchEvent(new Event("refresh-notifications"));
      return voucher;
    }
    if (v?.already_claimed) {
      toast({ title: "Voucher follow sudah pernah dipakai", description: "Hadiah ini hanya berlaku 1 kali untuk 1 akun." });
      setFollowVoucher(null);
      return null;
    }
    return null;
  };

  const handleToggleFollow = async () => {
    if (!userBalance) {
      toast({ title: "Login diperlukan", description: "Silakan login akun saldo dulu untuk mengikuti toko.", variant: "destructive" });
      setOpen(false);
      onLoginRequired();
      return;
    }
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await supabase.from("store_followers" as any).delete().eq("user_balance_id", userBalance.id);
        toast({ title: "Berhenti mengikuti", description: "Kamu sudah tidak mengikuti toko." });
      } else {
        const { error: followError } = await supabase.from("store_followers" as any).insert({
          user_balance_id: userBalance.id,
          visitor_id: userBalance.visitor_id,
          username: userBalance.username,
        });
        if (followError && followError.code !== "23505") throw followError;

        // 🎁 Voucher diskon Rp 1.000 — hanya 1x per akun seumur hidup
        try {
          const voucher = await claimFollowVoucher(true);
          if (!voucher) {
            toast({ title: "🎉 Berhasil mengikuti!", description: "Terima kasih sudah mengikuti Agung Adi Store." });
          }
        } catch (voucherError: any) {
          toast({ title: "Voucher gagal dibuat", description: voucherError?.message || "Coba tekan tombol cek voucher.", variant: "destructive" });
        }
      }
      await fetchFollowers();
    } catch (e: any) {
      toast({ title: "Gagal", description: e.message, variant: "destructive" });
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="z-[90] !max-w-none !w-screen !h-[100dvh] p-0 overflow-hidden bg-transparent border-0 shadow-none !rounded-none !left-0 !top-0 !translate-x-0 !translate-y-0 [&>button]:hidden">
        <DialogTitle className="sr-only">Profil Agung Adi Store</DialogTitle>
        <DialogDescription className="sr-only">Profil toko, tombol ikuti, voucher follow, chat, share, dan daftar produk.</DialogDescription>
        <div className="relative h-[100dvh] w-full overflow-hidden bg-background overflow-y-auto">
          {/* Banner */}
          <div className="relative h-32 overflow-hidden" style={{ background: "linear-gradient(135deg,#f59e0b,#ec4899 40%,#8b5cf6 70%,#06b6d4)" }}>
            <div className="absolute inset-0 opacity-40" style={{ background: "radial-gradient(circle at 30% 20%,rgba(255,255,255,.5),transparent 60%)" }} />
            <div className="absolute top-0 left-0 right-0 h-full opacity-20" style={{ backgroundImage: "repeating-linear-gradient(45deg,transparent,transparent 20px,rgba(255,255,255,.1) 20px,rgba(255,255,255,.1) 21px)" }} />
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white active:scale-90 transition"
            >
              <X className="w-5 h-5" strokeWidth={2.5} />
            </button>
            <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/40 backdrop-blur-sm text-white text-[10px] font-black">
              <Crown className="w-3 h-3 fill-amber-300 text-amber-300" />OFFICIAL STORE
            </div>
          </div>

          {/* Avatar overlap */}
          <div className="px-5 -mt-12 relative">
            <div className="flex items-end gap-3">
              <div className="w-24 h-24 rounded-3xl p-[3px] shadow-2xl" style={{ background: "linear-gradient(135deg,#f59e0b,#ec4899,#8b5cf6)" }}>
                <div className="w-full h-full rounded-[20px] bg-card overflow-hidden">
                  <img src={storeQris} alt="Agung Adi Store" className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="flex-1 mb-1 space-y-1.5">
                <Button
                  onClick={handleToggleFollow}
                  disabled={followLoading}
                  className={`w-full h-9 rounded-2xl font-black text-xs shadow-lg active:scale-95 transition ${
                    isFollowing
                      ? "bg-muted text-foreground hover:bg-muted/80"
                      : "bg-gradient-to-r from-pink-500 via-violet-500 to-cyan-500 text-white hover:opacity-90"
                  }`}
                >
                  {followLoading ? "..." : isFollowing ? (
                    <><BadgeCheck className="w-4 h-4 mr-1" />Mengikuti</>
                  ) : (
                    <><UserPlus className="w-4 h-4 mr-1" strokeWidth={3} />Ikuti + 🎁</>
                  )}
                </Button>
                {!isFollowing && (
                  <p className="text-[9px] font-bold text-pink-500 dark:text-pink-400 text-center leading-tight">
                    🎁 Dapat voucher Rp 1.000 (30 hari)
                  </p>
                )}
                {followVoucher?.code && (
                  <div className="rounded-2xl border border-pink-500/30 bg-pink-500/10 p-2 text-center">
                    <p className="text-[9px] font-black text-pink-600 dark:text-pink-400 flex items-center justify-center gap-1">
                      <Gift className="w-3 h-3" /> Voucher kamu
                    </p>
                    <button
                      type="button"
                      onClick={() => copyFollowVoucher(followVoucher.code)}
                      className="mt-1 inline-flex max-w-full items-center justify-center gap-1 rounded-xl bg-card px-2 py-1 text-[11px] font-black text-foreground border border-border active:scale-95"
                    >
                      <Copy className="w-3 h-3 text-pink-500" />
                      <span className="truncate">{followVoucher.code}</span>
                    </button>
                  </div>
                )}
                {isFollowing && !followVoucher?.code && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => claimFollowVoucher(true)}
                    className="w-full h-8 rounded-2xl text-[10px] font-black border-pink-500/30 text-pink-600 dark:text-pink-400"
                  >
                    <Gift className="w-3.5 h-3.5 mr-1" /> Cek Voucher Follow
                  </Button>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  <Button
                    onClick={handleChat}
                    className="h-9 rounded-2xl font-black text-xs shadow-lg active:scale-95 transition bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:opacity-90 px-2"
                  >
                    <MessageCircle className="w-4 h-4 mr-1" strokeWidth={2.5} />Chat
                  </Button>
                  <Button
                    onClick={handleShare}
                    className="h-9 rounded-2xl font-black text-xs shadow-lg active:scale-95 transition bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90 px-2"
                  >
                    <Share2 className="w-4 h-4 mr-1" strokeWidth={2.5} />Share
                  </Button>
                </div>
              </div>
            </div>

            {/* Nama + badges */}
            <div className="mt-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-lg font-black bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">Agung Adi Store</h2>
                <BadgeCheck className="w-5 h-5 text-blue-500 fill-blue-500/20" strokeWidth={2.5} />
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-600 dark:text-pink-400 text-[10px] font-black">
                  <Users className="w-3 h-3" strokeWidth={3} />
                  {followersCount.toLocaleString("id-ID")}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black border border-emerald-500/30">
                  <ShieldCheck className="w-3 h-3" strokeWidth={3} />AMANAH
                </span>
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-black border border-blue-500/30">
                  <BadgeCheck className="w-3 h-3" strokeWidth={3} />TERPERCAYA
                </span>
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black border border-amber-500/30">
                  <Sparkles className="w-3 h-3" strokeWidth={3} />MURAH
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Toko resmi <strong>Agung Adi Store</strong> — menjual voucher, akun, dan produk digital terpercaya dengan harga termurah dan respon WhatsApp 24/7.
              </p>

              {/* Status Online Admin */}
              <div className={`mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-black ${
                isAdminOnline
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted/60 border-border text-muted-foreground"
              }`}>
                <span className="relative flex w-2 h-2">
                  {isAdminOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
                  <Circle className={`w-2 h-2 ${isAdminOnline ? "fill-emerald-500 text-emerald-500" : "fill-muted-foreground/60 text-muted-foreground/60"}`} />
                </span>
                {isAdminOnline ? (
                  <>Admin Online sekarang</>
                ) : (
                  <><Clock className="w-2.5 h-2.5" />Terakhir aktif {formatRelativeTime(adminLastActive)}</>
                )}
              </div>
            </div>

            {/* Stat grid — Rating, Respon Admin, Produk */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="rounded-2xl p-3 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 text-center">
                <Star className="w-4 h-4 mx-auto fill-amber-400 text-amber-400 mb-0.5" />
                <p className="text-base font-black text-amber-600 dark:text-amber-400 leading-none">{STORE_RATING.toFixed(1)}</p>
                <p className="text-[9px] text-muted-foreground font-bold mt-0.5">Rating</p>
              </div>
              <div className={`rounded-2xl p-3 bg-gradient-to-br ${getResponseColor(responseRate.rate)} bg-opacity-10 border text-center relative overflow-hidden`} style={{ borderColor: 'hsl(var(--border))' }}>
                <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${getResponseColor(responseRate.rate)}`} />
                <MessageCircle className={`w-4 h-4 mx-auto mb-0.5 relative ${getResponseTextColor(responseRate.rate)}`} />
                <p className={`text-base font-black leading-none relative ${getResponseTextColor(responseRate.rate)}`}>
                  {responseRate.loading ? '…' : `${responseRate.rate}%`}
                </p>
                <p className="text-[9px] text-muted-foreground font-bold mt-0.5 relative">Respon</p>
              </div>
              <div className="rounded-2xl p-3 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 text-center">
                <Package className="w-4 h-4 mx-auto text-cyan-500 mb-0.5" />
                <p className="text-base font-black text-cyan-600 dark:text-cyan-400 leading-none">{products.length}</p>
                <p className="text-[9px] text-muted-foreground font-bold mt-0.5">Produk</p>
              </div>
            </div>

            {/* Detail respon */}
            {!responseRate.loading && responseRate.total > 0 && (
              <div className="mt-2 px-3 py-1.5 rounded-lg bg-muted/30 text-[10px] text-muted-foreground text-center">
                <MessageCircle className="w-3 h-3 inline mr-1" />
                Admin membalas <strong className="text-foreground">{responseRate.replied}</strong> dari <strong className="text-foreground">{responseRate.total}</strong> chat masuk
              </div>
            )}

            {/* Bergabung */}
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/50">
              <Calendar className="w-4 h-4 text-violet-500" />
              <p className="text-[11px] text-muted-foreground">Bergabung sejak <strong className="text-foreground">{formatJoinDate(STORE_JOIN_DATE)}</strong></p>
            </div>


            {/* Produk toko — Tabs: Produk & Kategori */}
            <div className="mt-4 mb-5">
              {(() => {
                const sortLabels: Record<SortMode, string> = {
                  default: "Urutkan",
                  cheapest: "💰 Termurah",
                  expensive: "💎 Termahal",
                  bestseller: "🔥 Terlaris",
                  popular: "❤️ Populer",
                  newest: "✨ Terbaru",
                };
                const catCount = (cat: string) =>
                  cat === "Semua" ? products.length : products.filter(p => (p.category || "Lainnya") === cat).length;

                const catGradients = [
                  "from-violet-500/15 to-pink-500/15 border-violet-500/30",
                  "from-amber-500/15 to-orange-500/15 border-amber-500/30",
                  "from-emerald-500/15 to-teal-500/15 border-emerald-500/30",
                  "from-cyan-500/15 to-blue-500/15 border-cyan-500/30",
                  "from-pink-500/15 to-rose-500/15 border-pink-500/30",
                  "from-indigo-500/15 to-violet-500/15 border-indigo-500/30",
                ];
                const catIconColors = [
                  "text-violet-500",
                  "text-amber-500",
                  "text-emerald-500",
                  "text-cyan-500",
                  "text-pink-500",
                  "text-indigo-500",
                ];

                return (
                  <Tabs defaultValue="produk" className="w-full">
                    {(() => {
                      const now = Date.now();
                      const liveCount = flashSales.filter((s) =>
                        new Date(s.starts_at).getTime() <= now &&
                        new Date(s.ends_at).getTime() > now &&
                        (s.quota === 0 || s.sold < s.quota)
                      ).length;
                      return (
                        <TabsList className="w-full h-10 grid grid-cols-4 rounded-2xl bg-muted/60 p-1 gap-0.5">
                          <TabsTrigger
                            value="produk"
                            className="rounded-xl text-[10px] font-black gap-0.5 px-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-md"
                          >
                            <Package className="w-3 h-3 shrink-0" />
                            <span className="truncate">Produk</span>
                          </TabsTrigger>
                          <TabsTrigger
                            value="kategori"
                            className="rounded-xl text-[10px] font-black gap-0.5 px-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-pink-500 data-[state=active]:text-white data-[state=active]:shadow-md"
                          >
                            <ListFilter className="w-3 h-3 shrink-0" />
                            <span className="truncate">Kategori</span>
                          </TabsTrigger>
                          <TabsTrigger
                            value="flashsale"
                            className="relative rounded-xl text-[10px] font-black gap-0.5 px-1 data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white data-[state=active]:shadow-md"
                          >
                            <Zap className="w-3 h-3 shrink-0" />
                            <span className="truncate">Flash</span>
                            {liveCount > 0 && (
                              <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            )}
                          </TabsTrigger>
                          <TabsTrigger
                            value="premium"
                            className={`relative rounded-xl text-[10px] font-black gap-0.5 px-1 ${
                              myPremium.isPremium
                                ? "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-amber-950 shadow-[0_0_12px_rgba(251,191,36,0.6)] ring-1 ring-amber-300 animate-pulse data-[state=active]:from-amber-500 data-[state=active]:to-yellow-500 data-[state=active]:text-white"
                                : "data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500 data-[state=active]:to-yellow-500 data-[state=active]:text-white data-[state=active]:shadow-md"
                            }`}
                          >
                            <Crown className={`w-3 h-3 shrink-0 ${myPremium.isPremium ? "fill-amber-600" : ""}`} />
                            <span className="truncate">Membership</span>
                            {myPremium.isPremium && (
                              <span className="absolute -top-1 -right-1 rounded-full bg-green-500 px-1 text-[7px] leading-3 text-white shadow-sm">ON</span>
                            )}
                          </TabsTrigger>
                        </TabsList>
                      );
                    })()}

                    {/* TAB PRODUK */}
                    <TabsContent value="produk" className="mt-3">
                      <ProductRecommendations
                        activeVisitorId={activeVisitorId}
                        products={products}
                        onSelect={(id) => { setOpen(false); onProductClick?.(id); }}
                      />
                      <div className="flex items-center justify-between mb-2 gap-2">

                        <h3 className="text-xs font-black flex items-center gap-1.5 min-w-0">
                          <StoreIcon className="w-4 h-4 text-violet-500 shrink-0" />
                          <span className="truncate">
                            {selectedCat === "Semua" ? "Semua Produk" : selectedCat} ({filteredProducts.length})
                          </span>
                        </h3>
                        {selectedCat !== "Semua" && (
                          <button
                            type="button"
                            onClick={() => setSelectedCat("Semua")}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/30 text-violet-600 dark:text-violet-400 text-[10px] font-black active:scale-95 transition shrink-0"
                          >
                            <X className="w-3 h-3" /> Reset
                          </button>
                        )}
                      </div>

                      {/* Sub-tabs urutan: Populer, Terbaru, Terlaris, Harga */}
                      {(() => {
                        const subTabs: { key: SortMode; label: string; color: string }[] = [
                          { key: "popular",    label: "Populer",  color: "from-pink-500 to-rose-500" },
                          { key: "newest",     label: "Terbaru",  color: "from-cyan-500 to-blue-500" },
                          { key: "bestseller", label: "Terlaris", color: "from-orange-500 to-amber-500" },
                          { key: "cheapest",   label: "Termurah", color: "from-emerald-500 to-teal-500" },
                          { key: "expensive",  label: "Termahal", color: "from-violet-500 to-indigo-500" },
                        ];
                        return (
                          <div className="-mx-1 px-1 mb-3 overflow-x-auto scrollbar-none">
                            <div className="inline-flex items-center gap-1.5 min-w-full">
                              {subTabs.map((t) => {
                                const active = sortMode === t.key;
                                return (
                                  <button
                                    key={t.key}
                                    type="button"
                                    onClick={() => setSortMode(t.key)}
                                    className={`shrink-0 h-8 inline-flex items-center gap-1 px-3 rounded-full text-[11px] font-black transition active:scale-95 border ${
                                      active
                                        ? `bg-gradient-to-r ${t.color} text-white border-transparent shadow-md`
                                        : "bg-card text-foreground border-border/60 hover:border-violet-500/40"
                                    }`}
                                  >
                                    <span>{t.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {filteredProducts.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">Belum ada produk</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {filteredProducts.slice(0, 12).map((p) => (
                            <button
                              key={p.id}
                              onClick={() => { setOpen(false); onProductClick?.(p.id); }}
                              className="group text-left rounded-2xl bg-card border border-border/50 overflow-hidden active:scale-95 transition hover:border-violet-500/50 hover:shadow-lg"
                            >
                              <div className="aspect-square bg-muted relative overflow-hidden">
                                {p.image_url ? (
                                  <img src={p.image_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Package className="w-8 h-8" /></div>
                                )}
                                {(p.sold_count ?? 0) > 0 && (
                                  <span className="absolute top-1 left-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500/90 text-white text-[8px] font-black backdrop-blur-sm">
                                    <Flame className="w-2 h-2" />{p.sold_count}
                                  </span>
                                )}
                                {(likeCounts[p.id] || 0) > 0 && (
                                  <span className="absolute top-1 right-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-pink-500/90 text-white text-[8px] font-black backdrop-blur-sm">
                                    <Heart className="w-2 h-2 fill-white" />{likeCounts[p.id]}
                                  </span>
                                )}
                              </div>
                              <div className="p-1.5">
                                <p className="text-[10px] font-bold line-clamp-1">{p.title}</p>
                                <p className="text-[10px] font-black text-violet-500 mt-0.5">{formatPrice(p.price)}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    {/* TAB KATEGORI */}
                    <TabsContent value="kategori" className="mt-3">
                      <h3 className="text-xs font-black flex items-center gap-1.5 mb-2">
                        <ListFilter className="w-4 h-4 text-amber-500" />
                        Daftar Kategori
                      </h3>
                      {categories.length <= 1 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">Belum ada kategori</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {categories.map((cat, idx) => {
                            const grad = catGradients[idx % catGradients.length];
                            const iconColor = catIconColors[idx % catIconColors.length];
                            const count = catCount(cat);
                            const isActive = selectedCat === cat;
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => {
                                  setSelectedCat(cat);
                                  const trigger = document.querySelector<HTMLButtonElement>('[role="tab"][data-state][value="produk"], [role="tab"][value="produk"]');
                                  // Fallback: cari tombol tab dengan teks "Produk"
                                  const triggers = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
                                  const target = trigger || triggers.find(t => t.textContent?.trim().startsWith("Produk"));
                                  target?.click();
                                }}
                                className={`relative rounded-2xl p-3 border bg-gradient-to-br ${grad} text-left active:scale-95 transition hover:shadow-lg ${
                                  isActive ? "ring-2 ring-violet-500 ring-offset-2 ring-offset-background" : ""
                                }`}
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <Package className={`w-4 h-4 ${iconColor}`} strokeWidth={2.5} />
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-card/80 text-foreground border border-border/50">
                                    {count}
                                  </span>
                                </div>
                                <p className="text-xs font-black line-clamp-2 leading-tight text-foreground">
                                  {cat}
                                </p>
                                <p className={`text-[9px] font-bold mt-0.5 ${iconColor}`}>
                                  {count} produk
                                </p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>

                    {/* TAB FLASH SALE */}
                    <TabsContent value="flashsale" className="mt-3">
                      <h3 className="text-xs font-black flex items-center gap-1.5 mb-2">
                        <Zap className="w-4 h-4 text-orange-500" fill="currentColor" />
                        Flash Sale Berlangsung
                      </h3>
                      {(() => {
                        const now = Date.now();
                        const productMap = new Map(products.map((p) => [p.id, p]));
                        const live = flashSales
                          .map((s) => ({ ...s, product: productMap.get(s.product_id) }))
                          .filter((s) =>
                            s.product &&
                            new Date(s.starts_at).getTime() <= now &&
                            new Date(s.ends_at).getTime() > now &&
                            (s.quota === 0 || s.sold < s.quota)
                          );
                        const upcoming = flashSales
                          .map((s) => ({ ...s, product: productMap.get(s.product_id) }))
                          .filter((s) => s.product && new Date(s.starts_at).getTime() > now);

                        if (live.length === 0 && upcoming.length === 0) {
                          return (
                            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/30 py-8 text-center">
                              <Zap className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                              <p className="text-xs text-muted-foreground">Belum ada flash sale aktif</p>
                              <p className="text-[10px] text-muted-foreground/70 mt-0.5">Cek lagi nanti ya 🔥</p>
                            </div>
                          );
                        }

                        const renderCard = (s: any, isLive: boolean) => {
                          const target = new Date(isLive ? s.ends_at : s.starts_at).getTime();
                          const diff = Math.max(0, target - now);
                          const hours = Math.floor(diff / 3600000);
                          const minutes = Math.floor((diff % 3600000) / 60000);
                          const seconds = Math.floor((diff % 60000) / 1000);
                          const days = Math.floor(hours / 24);
                          const orig = s.product.price as number;
                          const flashPrice =
                            s.mode === "discount_percent"
                              ? Math.max(0, Math.round(orig * (1 - (s.discount_percent || 0) / 100)))
                              : (s.flash_price ?? 0);
                          const pct = s.quota > 0 ? Math.min(100, (s.sold / s.quota) * 100) : 0;
                          const discountLabel =
                            s.mode === "discount_percent"
                              ? `-${s.discount_percent}%`
                              : `Hemat ${Math.round(((orig - flashPrice) / Math.max(1, orig)) * 100)}%`;

                          return (
                            <button
                              key={s.id}
                              onClick={() => { setOpen(false); onProductClick?.(s.product_id); }}
                              className="group text-left rounded-2xl bg-card border border-orange-500/30 overflow-hidden active:scale-95 transition hover:shadow-lg hover:border-orange-500/60 relative"
                            >
                              {isLive && (
                                <div className="absolute top-1.5 left-1.5 z-10 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[8px] font-black backdrop-blur-sm shadow">
                                  <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                                  LIVE
                                </div>
                              )}
                              <span className="absolute top-1.5 right-1.5 z-10 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 text-white text-[9px] font-black shadow">
                                {discountLabel}
                              </span>
                              <div className="aspect-square bg-muted relative overflow-hidden">
                                {s.product.image_url ? (
                                  <img src={s.product.image_url} alt={s.product.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-muted-foreground"><Package className="w-8 h-8" /></div>
                                )}
                              </div>
                              <div className="p-1.5 space-y-1">
                                <p className="text-[10px] font-bold line-clamp-1">{s.product.title}</p>
                                <div className="flex items-baseline gap-1">
                                  <p className="text-[11px] font-black text-red-500">{formatPrice(flashPrice)}</p>
                                  <p className="text-[9px] line-through text-muted-foreground">{formatPrice(orig)}</p>
                                </div>
                                {s.quota > 0 && (
                                  <div>
                                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                                      <div className="h-full bg-gradient-to-r from-orange-500 to-red-500" style={{ width: `${pct}%` }} />
                                    </div>
                                    <p className="text-[8px] font-bold text-orange-500 mt-0.5">
                                      Sisa {Math.max(0, s.quota - s.sold)}/{s.quota}
                                    </p>
                                  </div>
                                )}
                                <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/30">
                                  <Clock className="w-2.5 h-2.5 text-orange-500" />
                                  <span className="text-[9px] font-black text-orange-500 tabular-nums">
                                    {isLive ? (
                                      days > 0
                                        ? `${days}h ${hours % 24}j`
                                        : `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
                                    ) : (
                                      `Mulai dlm ${days > 0 ? `${days}h` : `${hours}j ${minutes}m`}`
                                    )}
                                  </span>
                                </div>
                              </div>
                            </button>
                          );
                        };

                        return (
                          <div className="space-y-3">
                            {live.length > 0 && (
                              <div className="grid grid-cols-2 gap-2">
                                {live.map((s) => renderCard(s, true))}
                              </div>
                            )}
                            {upcoming.length > 0 && (
                              <div>
                                <h4 className="text-[10px] font-black text-muted-foreground mb-1.5 uppercase tracking-wider">Akan Datang</h4>
                                <div className="grid grid-cols-2 gap-2">
                                  {upcoming.map((s) => renderCard(s, false))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </TabsContent>

                    {/* TAB PREMIUM */}
                    <TabsContent value="premium" className="mt-3">
                      <StorePremiumTab
                        visitorId={activeVisitorId ?? userBalance?.visitor_id ?? null}
                        onLoginRequired={onLoginRequired}
                      />
                    </TabsContent>
                  </Tabs>
                );
              })()}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============== HEADER CARD di Beranda — hanya tampilan, klik dispatch event global ==============
export const StoreProfile = ({ products, userBalance }: StoreProfileProps) => {
  const [followersCount, setFollowersCount] = useState(0);
  const responseRate = useResponseRate();

  useEffect(() => {
    const load = async () => {
      const { count } = await supabase.from("store_followers" as any).select("id", { count: "exact", head: true });
      setFollowersCount(count || 0);
    };
    load();
    const ch = supabase
      .channel("store-header-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "store_followers" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const openProfile = () => window.dispatchEvent(new Event("open-store-profile"));

  return (
    <div
      onClick={openProfile}
      className="relative overflow-hidden rounded-3xl p-[2px] cursor-pointer active:scale-[0.98] transition-transform"
      style={{ background: "linear-gradient(135deg,#f59e0b,#ec4899,#8b5cf6,#06b6d4)" }}
    >
      <div className="absolute inset-0 opacity-30 animate-pulse" style={{ background: "radial-gradient(circle at 20% 30%,rgba(236,72,153,.4),transparent 60%),radial-gradient(circle at 80% 70%,rgba(6,182,212,.4),transparent 60%)" }} />
      <div className="relative bg-card/95 backdrop-blur-2xl rounded-[22px] p-4 flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="w-16 h-16 rounded-2xl p-[2px]" style={{ background: "linear-gradient(135deg,#f59e0b,#ec4899)" }}>
            <div className="w-full h-full rounded-[14px] bg-card flex items-center justify-center overflow-hidden">
              <img src={storeQris} alt="Agung Adi Store" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-sm font-black truncate bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">Agung Adi Store</h3>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 text-white text-[9px] font-black">
              <ShieldCheck className="w-2.5 h-2.5" strokeWidth={3} />AMANAH
            </span>
            {!responseRate.loading && (
              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r ${getResponseColor(responseRate.rate)} text-white text-[9px] font-black`}>
                <MessageCircle className="w-2.5 h-2.5" strokeWidth={3} />{responseRate.rate}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-500">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{STORE_RATING.toFixed(1)}
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-pink-500">
              <Users className="w-3 h-3" />{followersCount.toLocaleString("id-ID")} pengikut
            </span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] font-bold text-cyan-500">{products.length} produk</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">Murah · Terpercaya · Respon Cepat 24/7</p>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); openProfile(); }}
          className="shrink-0 px-3 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 text-white text-[11px] font-black shadow-lg active:scale-95 transition"
        >
          Kunjungi
        </button>
      </div>
    </div>
  );
};

// Mini card untuk dipakai di dalam Product Detail (membuka modal StoreProfile global)
interface StoreMiniCardProps {
  productCount?: number;
  onVisit?: () => void;
}

export const StoreMiniCard = ({ productCount = 0, onVisit }: StoreMiniCardProps) => {
  const [followers, setFollowers] = useState(0);
  const responseRate = useResponseRate();
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const { count } = await supabase.from("store_followers" as any).select("id", { count: "exact", head: true });
      if (mounted) setFollowers(count || 0);
    };
    load();
    const ch = supabase
      .channel("store-mini-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "store_followers" }, () => load())
      .subscribe();
    return () => { mounted = false; supabase.removeChannel(ch); };
  }, []);

  const visitStore = () => {
    if (onVisit) {
      onVisit();
      return;
    }
    window.dispatchEvent(new Event("open-store-profile"));
  };

  return (
    <div
      onClick={visitStore}
      className="relative overflow-hidden rounded-2xl p-[1.5px] cursor-pointer active:scale-[0.98] transition-transform animate-fade-in"
      style={{ background: "linear-gradient(135deg,#f59e0b,#ec4899,#8b5cf6,#06b6d4)" }}
    >
      <div className="relative bg-card rounded-[14px] p-3 flex items-center gap-3">
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-xl p-[2px]" style={{ background: "linear-gradient(135deg,#f59e0b,#ec4899)" }}>
            <div className="w-full h-full rounded-[10px] bg-card overflow-hidden">
              <img src={storeQris} alt="Agung Adi Store" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center ring-2 ring-card">
            <BadgeCheck className="w-3 h-3 text-white" strokeWidth={3} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <p className="text-xs font-black bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 bg-clip-text text-transparent truncate">Agung Adi Store</p>
            <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 text-white text-[8px] font-black">
              <ShieldCheck className="w-2 h-2" strokeWidth={3} />AMANAH
            </span>
            {!responseRate.loading && (
              <span className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-gradient-to-r ${getResponseColor(responseRate.rate)} text-white text-[8px] font-black`}>
                <MessageCircle className="w-2 h-2" strokeWidth={3} />{responseRate.rate}%
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-500">
              <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />5.0
            </span>
            <span className="text-[9px] text-muted-foreground">·</span>
            <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-pink-500">
              <Users className="w-2.5 h-2.5" />{followers.toLocaleString("id-ID")}
            </span>
            <span className="text-[9px] text-muted-foreground">·</span>
            <span className="text-[9px] font-bold text-cyan-500">{productCount} produk</span>
          </div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); visitStore(); }}
          className="shrink-0 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-pink-500 text-white text-[10px] font-black shadow-md active:scale-95 transition"
        >
          Kunjungi
        </button>
      </div>
    </div>
  );
};
