import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ShieldCheck, Star, Sparkles, Users, Calendar, Package, BadgeCheck, UserPlus, Crown, X, Store as StoreIcon, MessageCircle, ListFilter, Share2, Circle, ArrowUpDown, Heart, Flame, Clock } from "lucide-react";
import { WA_NUMBER } from "@/lib/social-links";
import storeQris from "@/assets/store-qris.jpg";

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

// ============== MODAL GLOBAL — selalu mounted di Index level (di luar tab) ==============
export const StoreProfileModal = ({
  products,
  userBalance,
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
  const { toast } = useToast();

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

  useEffect(() => {
    fetchFollowers();
    fetchAdminStatus();
    fetchLikeCounts();
    const ch = supabase
      .channel("store-profile-modal-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "store_followers" }, () => fetchFollowers())
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_settings", filter: "setting_key=eq.admin_last_active" }, () => fetchAdminStatus())
      .on("postgres_changes", { event: "*", schema: "public", table: "liked_products" }, () => fetchLikeCounts())
      .subscribe();
    const openHandler = () => setOpen(true);
    window.addEventListener("open-store-profile", openHandler);
    // Refresh status admin & relative time tiap 30 detik
    const tick = setInterval(() => {
      setNowTick(t => t + 1);
      if (open) fetchAdminStatus();
    }, 30000);
    return () => {
      supabase.removeChannel(ch);
      window.removeEventListener("open-store-profile", openHandler);
      clearInterval(tick);
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
        await supabase.from("store_followers" as any).insert({
          user_balance_id: userBalance.id,
          visitor_id: userBalance.visitor_id,
          username: userBalance.username,
        });

        // 🎁 Voucher diskon Rp 1.000 — hanya 1x per akun seumur hidup
        try {
          const { data: voucherData } = await supabase.rpc("generate_follow_voucher" as any, {
            p_visitor_id: userBalance.visitor_id,
          });
          const v: any = Array.isArray(voucherData) ? voucherData[0] : voucherData;
          if (v?.already_claimed) {
            toast({
              title: "🎉 Berhasil mengikuti!",
              description: "Voucher follow hanya bisa diklaim sekali per akun. Terima kasih sudah kembali!",
            });
          } else if (v?.code) {
            try { await navigator.clipboard.writeText(v.code); } catch {}
            toast({
              title: "🎁 Voucher Diskon Rp 1.000!",
              description: `Kode: ${v.code} sudah disalin & dikirim ke notifikasi. Berlaku 30 hari, sekali pakai.`,
              duration: 10000,
            });
          } else {
            toast({ title: "🎉 Berhasil mengikuti!", description: "Terima kasih sudah mengikuti Agung Adi Store." });
          }
        } catch {
          toast({ title: "🎉 Berhasil mengikuti!", description: "Terima kasih sudah mengikuti Agung Adi Store." });
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
      <DialogContent className="z-[90] max-w-md p-0 overflow-hidden bg-transparent border-0 shadow-none [&>button]:hidden">
        <div className="relative rounded-3xl overflow-hidden bg-background max-h-[90vh] overflow-y-auto">
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

            {/* Stat grid — Rating & Produk (Pengikut dihilangkan, hanya angka total) */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <div className="rounded-2xl p-3 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 text-center">
                <div className="flex items-center justify-center gap-0.5 mb-0.5">
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                </div>
                <p className="text-base font-black text-amber-600 dark:text-amber-400 leading-none">{STORE_RATING.toFixed(1)}</p>
                <p className="text-[9px] text-muted-foreground font-bold mt-0.5">Rating</p>
              </div>
              <div className="rounded-2xl p-3 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 text-center">
                <Package className="w-4 h-4 mx-auto text-cyan-500 mb-0.5" />
                <p className="text-base font-black text-cyan-600 dark:text-cyan-400 leading-none">{products.length}</p>
                <p className="text-[9px] text-muted-foreground font-bold mt-0.5">Produk</p>
              </div>
            </div>

            {/* Bergabung */}
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/50">
              <Calendar className="w-4 h-4 text-violet-500" />
              <p className="text-[11px] text-muted-foreground">Bergabung sejak <strong className="text-foreground">{formatJoinDate(STORE_JOIN_DATE)}</strong></p>
            </div>


            {/* Produk toko */}
            <div className="mt-4 mb-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black flex items-center gap-1.5">
                  <StoreIcon className="w-4 h-4 text-violet-500" />
                  Semua Produk ({filteredProducts.length})
                </h3>
              </div>

              {/* Filter & Urutkan — pakai tombol + popup in-app (bukan native select) */}
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
                return (
                  <div className="grid grid-cols-2 gap-1.5 mb-2">
                    {categories.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setShowCatPicker(true)}
                        className="h-9 w-full inline-flex items-center justify-center gap-1.5 rounded-full border border-violet-500/30 bg-card px-3 text-[11px] font-bold text-foreground active:scale-[0.97] transition truncate"
                      >
                        <ListFilter className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                        <span className="truncate">{selectedCat} ({catCount(selectedCat)})</span>
                      </button>
                    ) : <div />}

                    <button
                      type="button"
                      onClick={() => setShowSortPicker(true)}
                      className="h-9 w-full inline-flex items-center justify-center gap-1.5 rounded-full border border-pink-500/30 bg-card px-3 text-[11px] font-bold text-foreground active:scale-[0.97] transition truncate"
                    >
                      <ArrowUpDown className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                      <span className="truncate">{sortLabels[sortMode]}</span>
                    </button>

                    {/* Popup pilih kategori (in-app) */}
                    {showCatPicker && (
                      <div
                        className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
                        onClick={() => setShowCatPicker(false)}
                      >
                        <div
                          className="bg-card w-full max-w-sm rounded-3xl p-4 max-h-[70vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-black flex items-center gap-1.5">
                              <ListFilter className="w-4 h-4 text-violet-500" /> Pilih Kategori
                            </p>
                            <button onClick={() => setShowCatPicker(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center active:scale-90">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {categories.map((cat) => (
                              <button
                                key={cat}
                                onClick={() => { setSelectedCat(cat); setShowCatPicker(false); }}
                                className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition active:scale-[0.98] ${
                                  selectedCat === cat
                                    ? "bg-gradient-to-r from-violet-500 to-pink-500 text-white shadow-md"
                                    : "bg-muted/50 text-foreground hover:bg-muted"
                                }`}
                              >
                                <span className="truncate">{cat}</span>
                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                  selectedCat === cat ? "bg-white/20" : "bg-card"
                                }`}>{catCount(cat)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Popup pilih urutan (in-app) */}
                    {showSortPicker && (
                      <div
                        className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-3"
                        onClick={() => setShowSortPicker(false)}
                      >
                        <div
                          className="bg-card w-full max-w-sm rounded-3xl p-4 animate-in slide-in-from-bottom duration-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-black flex items-center gap-1.5">
                              <ArrowUpDown className="w-4 h-4 text-pink-500" /> Urutkan Produk
                            </p>
                            <button onClick={() => setShowSortPicker(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center active:scale-90">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {(Object.keys(sortLabels) as SortMode[]).map((mode) => (
                              <button
                                key={mode}
                                onClick={() => { setSortMode(mode); setShowSortPicker(false); }}
                                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition active:scale-[0.98] ${
                                  sortMode === mode
                                    ? "bg-gradient-to-r from-pink-500 to-violet-500 text-white shadow-md"
                                    : "bg-muted/50 text-foreground hover:bg-muted"
                                }`}
                              >
                                {sortLabels[mode]}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
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
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center ring-2 ring-card">
            <BadgeCheck className="w-4 h-4 text-white" strokeWidth={3} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-sm font-black truncate bg-gradient-to-r from-amber-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">Agung Adi Store</h3>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-green-500 text-white text-[9px] font-black">
              <ShieldCheck className="w-2.5 h-2.5" strokeWidth={3} />AMANAH
            </span>
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
