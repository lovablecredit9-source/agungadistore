import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Megaphone, Clock, User, Phone, ChevronLeft, ChevronRight, X, Search, Filter, ArrowUpDown, Heart, Share2, ExternalLink, Eye, AlertTriangle, Shield, CalendarDays, ImagePlus } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import ProductNavToolbar, { type ProductNavToolbarValue, type SortKey, type ViewMode } from "@/components/ProductNavToolbar";

interface SponsorImage {
  id: string;
  sponsor_id: string;
  image_url: string;
  image_order: number;
}

interface Sponsor {
  id: string;
  title: string;
  description: string | null;
  price: number;
  image_url: string | null;
  seller_name: string;
  seller_contact: string;
  duration_type: string;
  duration_value: number;
  starts_at: string;
  expires_at: string | null;
  is_active: boolean;
  custom_note: string | null;
  created_at: string;
  sponsor_number: number;
  wa_number: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  twitter: string;
  threads: string;
  category: string;
  stock: number;
  has_warranty: boolean;
  warranty_duration_value: number;
  warranty_duration_type: string;
  view_count: number;
}

type SortOrder = SortKey;

function timeRemaining(expiresAt: string | null): string {
  if (!expiresAt) return "Tanpa batas";
  const now = new Date().getTime();
  const exp = new Date(expiresAt).getTime();
  const diff = exp - now;
  if (diff <= 0) return "Kedaluwarsa";
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diff % (1000 * 60)) / 1000);
  if (days > 0) return `${days}h ${hours}j ${mins}m`;
  if (hours > 0) return `${hours}j ${mins}m ${secs}d`;
  if (mins > 0) return `${mins}m ${secs}d`;
  return `${secs}d`;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price);
}

const socialIcons: Record<string, { label: string; url: (v: string) => string; color: string }> = {
  wa_number: { label: "WhatsApp", url: v => `https://wa.me/${v.replace(/[^0-9+]/g, "")}`, color: "bg-green-600 hover:bg-green-700" },
  instagram: { label: "Instagram", url: v => `https://instagram.com/${v.replace("@", "")}`, color: "bg-pink-600 hover:bg-pink-700" },
  facebook: { label: "Facebook", url: v => v.startsWith("http") ? v : `https://facebook.com/${v}`, color: "bg-blue-600 hover:bg-blue-700" },
  tiktok: { label: "TikTok", url: v => `https://tiktok.com/@${v.replace("@", "")}`, color: "bg-gray-800 hover:bg-gray-900" },
  twitter: { label: "X", url: v => `https://x.com/${v.replace("@", "")}`, color: "bg-gray-700 hover:bg-gray-800" },
  threads: { label: "Threads", url: v => `https://threads.net/@${v.replace("@", "")}`, color: "bg-gray-600 hover:bg-gray-700" },
};

interface SponsorBannerProps {
  likedSponsorIds?: Set<string>;
  onToggleLikeSponsor?: (sponsorId: string, e?: React.MouseEvent) => void;
  sponsorLikeCounts?: Record<string, number>;
}

export default function SponsorBanner({ likedSponsorIds = new Set(), onToggleLikeSponsor, sponsorLikeCounts = {} }: SponsorBannerProps) {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [sponsorImages, setSponsorImages] = useState<Record<string, SponsorImage[]>>({});
  const [wholesalePrices, setWholesalePrices] = useState<any[]>([]);
  const [current, setCurrent] = useState(0);
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const categories = useMemo(() => {
    const cats = new Set(sponsors.map(s => s.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [sponsors]);
  useEffect(() => {
    fetchSponsors();
    const interval = setInterval(fetchSponsors, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (sponsors.length <= 1) return;
    const timer = setInterval(() => setCurrent(c => (c + 1) % sponsors.length), 5000);
    return () => clearInterval(timer);
  }, [sponsors.length]);

  async function fetchSponsors() {
    const [sRes, imgRes, wRes] = await Promise.all([
      supabase.from("sponsors").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("sponsor_images").select("*").order("image_order", { ascending: true }),
      supabase.from("wholesale_prices").select("*").eq("entity_type", "sponsor").order("min_quantity"),
    ]);
    if (sRes.data) {
      const now = new Date();
      const active = (sRes.data as unknown as Sponsor[]).filter(s => {
        if (!s.expires_at) return true;
        return new Date(s.expires_at) > now;
      });
      setSponsors(active);
      setCurrent(0);
    }
    if (imgRes.data) {
      const map: Record<string, SponsorImage[]> = {};
      (imgRes.data as unknown as SponsorImage[]).forEach(img => {
        if (!map[img.sponsor_id]) map[img.sponsor_id] = [];
        map[img.sponsor_id].push(img);
      });
      setSponsorImages(map);
    }
    if (wRes.data) setWholesalePrices(wRes.data);
  }

  function shareSponsor(s: Sponsor) {
    const url = window.location.origin + `/?sponsor=${s.sponsor_number}`;
    const text = `🔥 ${s.title}\n💰 ${s.price > 0 ? formatPrice(s.price) : "Gratis"}\n🏪 ${s.seller_name}\n\nLihat di:`;
    if (navigator.share) {
      navigator.share({ title: s.title, text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text} ${url}`);
    }
  }

  if (sponsors.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
        <Megaphone className="w-7 h-7 text-muted-foreground/50" />
      </div>
      <p className="text-sm font-medium">Belum ada sponsor aktif</p>
    </div>
  );

  const q = search.toLowerCase().trim();
  const minP = parseInt(minPrice) || 0;
  const maxP = parseInt(maxPrice) || 0;
  const filtered = sponsors
    .filter(s => {
      if (filterCategory !== "all" && s.category !== filterCategory) return false;
      if (minP > 0 && s.price < minP) return false;
      if (maxP > 0 && s.price > maxP) return false;
      if (q) {
        return s.title.toLowerCase().includes(q) ||
          s.seller_name.toLowerCase().includes(q) ||
          String(s.sponsor_number).includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      if (sortOrder === "cheapest") return a.price - b.price;
      if (sortOrder === "expensive") return b.price - a.price;
      if (sortOrder === "popular") return (b.view_count || 0) - (a.view_count || 0);
      if (sortOrder === "name_asc") return a.title.localeCompare(b.title);
      if (sortOrder === "name_desc") return b.title.localeCompare(a.title);
      if (sortOrder === "oldest") return da - db;
      return db - da;
    });

  const sponsorCategoryCounts: Record<string, number> = { all: sponsors.length };
  sponsors.forEach(s => {
    const k = s.category || "Lainnya";
    sponsorCategoryCounts[k] = (sponsorCategoryCounts[k] || 0) + 1;
  });
  const popularSponsorTerms = [...sponsors]
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 6)
    .map(s => s.title.split(" ").slice(0, 2).join(" "));

  const sponsor = filtered.length > 0 ? filtered[current % filtered.length] : null;

  const currentImages = sponsor ? (sponsorImages[sponsor.id] || []) : [];
  const displayImage = currentImages.length > 0 ? currentImages[0]?.image_url : sponsor?.image_url;

  const socialLinks = sponsor ? Object.entries(socialIcons).filter(([key]) => {
    const val = (sponsor as any)[key];
    return val && val.trim();
  }) : [];

  return (
    <>
      <div className="relative">
        {/* Hero Header - Aurora Premium */}
        <div
          className="relative rounded-3xl p-[2px] overflow-hidden mb-3 shadow-[0_8px_40px_-10px_rgba(217,70,239,0.5)]"
          style={{ background: "linear-gradient(135deg, hsl(330 90% 60%), hsl(280 90% 65%), hsl(45 95% 55%), hsl(15 90% 55%), hsl(330 90% 60%))", backgroundSize: "400% 400%", animation: "aurora-shift 8s ease infinite" }}
        >
          <div className="relative rounded-[22px] bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-slate-950/95 backdrop-blur-xl p-4 overflow-hidden">
            <div className="pointer-events-none absolute inset-0 opacity-60">
              <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-fuchsia-500/30 blur-3xl animate-pulse" />
              <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full bg-amber-500/30 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
            </div>
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="absolute w-1 h-1 rounded-full bg-white/60" style={{ top: `${20 + (i * 17) % 60}%`, left: `${(i * 21) % 90}%`, animation: `float-up ${3 + (i % 3)}s ease-in-out ${i * 0.5}s infinite`, boxShadow: "0 0 6px rgba(255,255,255,0.8)" }} />
              ))}
            </div>
            <div className="pointer-events-none absolute inset-0" style={{ background: "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.1) 50%, transparent 70%)", animation: "shine-sweep 6s ease-in-out infinite" }} />

            <div className="relative z-10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="relative shrink-0">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-fuchsia-400 via-pink-500 to-amber-500 blur-lg opacity-80 animate-pulse" />
                  <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-fuchsia-400 via-pink-500 to-amber-500 opacity-50 animate-spin" style={{ animationDuration: "8s" }} />
                  <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500 via-pink-500 to-amber-500 flex items-center justify-center shadow-[0_0_30px_rgba(217,70,239,0.7),inset_0_2px_8px_rgba(255,255,255,0.3)] border border-white/30">
                    <Megaphone className="w-7 h-7 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" strokeWidth={2.2} />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-black tracking-tight bg-gradient-to-r from-fuchsia-200 via-pink-200 to-amber-200 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(217,70,239,0.4)]">Sponsor</h2>
                    <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.7)] border border-white/30">
                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> LIVE
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white shadow-[0_0_15px_rgba(251,146,60,0.6)] border border-white/30 animate-pulse">
                      🔥 IKLAN
                    </span>
                  </div>
                  <p className="text-fuchsia-100/80 text-[11px] mt-1 font-semibold flex items-center gap-1">
                    <Megaphone className="w-3 h-3 text-amber-300" /> {filtered.length} iklan aktif premium
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setShowSearch(v => !v)} className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500/30 to-purple-500/30 hover:from-cyan-500/50 hover:to-purple-500/50 flex items-center justify-center transition-all backdrop-blur-sm border border-cyan-300/40 shadow-[0_0_10px_rgba(34,211,238,0.3)] hover:scale-110">
                  <Search className="w-4 h-4 text-cyan-200" />
                </button>
                {filtered.length > 1 && (
                  <span className="text-[10px] font-black text-amber-200 bg-gradient-to-br from-amber-500/30 to-orange-500/20 px-2.5 py-1.5 rounded-full backdrop-blur-sm border border-amber-300/40 shadow-[0_0_10px_rgba(251,191,36,0.3)] tabular-nums">
                    {(current % filtered.length) + 1}/{filtered.length}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Advanced Sponsor Navigation Toolbar */}
        <div className="mb-3">
          <ProductNavToolbar
            value={{
              search,
              category: filterCategory === "all" ? "Semua" : filterCategory,
              sort: sortOrder,
              view: "list" as ViewMode,
              minPrice,
              maxPrice,
              inStockOnly: false,
              warrantyOnly: false,
            }}
            onChange={(next) => {
              if (next.search !== undefined) { setSearch(next.search); setCurrent(0); }
              if (next.category !== undefined) { setFilterCategory(next.category === "Semua" ? "all" : next.category); setCurrent(0); }
              if (next.sort !== undefined) setSortOrder(next.sort as SortOrder);
              if (next.minPrice !== undefined) { setMinPrice(next.minPrice); setCurrent(0); }
              if (next.maxPrice !== undefined) { setMaxPrice(next.maxPrice); setCurrent(0); }
            }}
            categories={["Semua", ...categories]}
            categoryCounts={{ Semua: sponsors.length, ...sponsorCategoryCounts }}
            storageKey="sponsor_search_history_v1"
            popularSuggestions={popularSponsorTerms}
            showStockFilter={false}
            showWarrantyFilter={false}
            totalCount={sponsors.length}
            resultCount={filtered.length}
            compact
          />
        </div>
        {!sponsor && q && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Search className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">Tidak ditemukan sponsor "{search}"</p>
          </div>
        )}
        {sponsor && (
        <div
          className="relative rounded-2xl p-[2px] overflow-hidden cursor-pointer group transition-all duration-500 hover:-translate-y-1.5 hover:scale-[1.01]"
          style={{ background: sponsor.stock > 0
            ? "linear-gradient(135deg, hsl(330 90% 60%/0.8), hsl(280 90% 65%/0.7), hsl(45 95% 55%/0.7), hsl(15 90% 55%/0.8), hsl(330 90% 60%/0.8))"
            : "linear-gradient(135deg, hsl(0 0% 50%/0.4), hsl(0 70% 50%/0.5), hsl(0 0% 50%/0.4))",
            backgroundSize: "300% 300%",
            animation: "aurora-shift 7s ease infinite",
            boxShadow: sponsor.stock > 0 ? "0 8px 32px -8px rgba(217,70,239,0.45), 0 4px 16px -4px rgba(251,146,60,0.3)" : "0 4px 16px -4px rgba(0,0,0,0.3)" }}
          onClick={() => { setSelectedSponsor(sponsor); setImgIdx(0); }}
        >
          <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-slate-900/95 via-slate-950/95 to-slate-900/95 backdrop-blur-xl rounded-[14px] card-shine relative">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="absolute -inset-0.5 bg-gradient-to-br from-fuchsia-500/0 via-amber-500/0 to-pink-500/0 group-hover:from-fuchsia-500/30 group-hover:via-amber-500/20 group-hover:to-pink-500/30 rounded-[14px] blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none -z-10" />

            {/* Corner ribbon - sponsor */}
            <div className="absolute top-0 left-0 z-20 overflow-hidden w-20 h-20 pointer-events-none">
              <div className="absolute top-3 -left-7 -rotate-45 bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-500 text-white text-[8px] font-black px-7 py-0.5 shadow-[0_2px_8px_rgba(217,70,239,0.7)] tracking-wider border-y border-white/30">
                ★ PROMOSI
              </div>
            </div>

          {displayImage && (
            <div className="relative">
              <img src={displayImage} alt={sponsor.title} className="w-full h-40 object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent pointer-events-none" />
              {/* Scan line effect */}
              <div className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-fuchsia-300 to-transparent shadow-[0_0_8px_rgba(217,70,239,0.8)]" style={{ top: "50%", animation: "float-up 2s ease-in-out infinite" }} />
              </div>

              <div className="absolute top-2 left-2 z-10" style={{ marginLeft: "60px" }}>
                <span className="text-[10px] font-mono font-black bg-slate-950/70 text-cyan-200 px-2 py-1 rounded-full backdrop-blur-md border border-cyan-400/40 shadow-[0_0_10px_rgba(34,211,238,0.4)]">#{sponsor.sponsor_number}</span>
              </div>
              <div className="absolute top-2 right-2 z-10">
                <span className="inline-flex items-center text-[10px] font-black bg-gradient-to-r from-rose-500 to-red-500 text-white px-2 py-1 rounded-full shadow-[0_0_15px_rgba(244,63,94,0.6)] backdrop-blur-sm border border-white/30 animate-pulse">
                  <Clock className="w-3 h-3 mr-1" />{timeRemaining(sponsor.expires_at)}
                </span>
              </div>
              {sponsor.price > 0 && (
                <div className="absolute bottom-2 left-2 z-10">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 blur-md opacity-70 animate-pulse" />
                    <span className="relative inline-block text-xs font-black bg-gradient-to-r from-amber-300 via-white to-pink-200 text-slate-900 px-3 py-1.5 rounded-full shadow-[0_0_20px_rgba(251,146,60,0.8),inset_0_1px_2px_rgba(255,255,255,0.5)] backdrop-blur-sm border-2 border-white/50">
                      {formatPrice(sponsor.price)}
                    </span>
                  </div>
                </div>
              )}
              {currentImages.length > 1 && (
                <div className="absolute bottom-2 right-2 z-10">
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-black bg-slate-950/70 text-purple-200 px-2 py-1 rounded-full backdrop-blur-md border border-purple-400/40 shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                    <ImagePlus className="w-2.5 h-2.5" /> {currentImages.length}
                  </span>
                </div>
              )}
            </div>
          )}
          <CardContent className="p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-black text-sm leading-tight flex-1 text-white group-hover:bg-gradient-to-r group-hover:from-fuchsia-300 group-hover:to-amber-300 group-hover:bg-clip-text group-hover:text-transparent transition-all">{sponsor.title}</h4>
              {onToggleLikeSponsor && (
                <button onClick={(e) => { e.stopPropagation(); onToggleLikeSponsor(sponsor.id, e); }} className={`shrink-0 flex items-center gap-1 rounded-full p-1.5 transition-all hover:scale-110 ${likedSponsorIds.has(sponsor.id) ? "bg-pink-500/20 shadow-[0_0_10px_rgba(236,72,153,0.5)]" : "hover:bg-pink-500/10"}`}>
                  <Heart className={`w-5 h-5 transition-all ${likedSponsorIds.has(sponsor.id) ? "fill-pink-400 text-pink-400 drop-shadow-[0_0_4px_rgb(236,72,153)]" : "text-slate-400"}`} />
                  {(sponsorLikeCounts[sponsor.id] || 0) > 0 && <span className="text-[10px] font-black text-pink-300">{sponsorLikeCounts[sponsor.id]}</span>}
                </button>
              )}
            </div>
            {/* Star rating */}
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <span key={i} className="text-[10px] text-amber-400 drop-shadow-[0_0_3px_rgba(251,191,36,0.6)]">★</span>
                ))}
              </div>
              <span className="text-[9px] font-bold text-amber-300/80">5.0</span>
              <span className="text-[9px] text-slate-500">• Verified</span>
            </div>
            {sponsor.description && (
              <p className="text-xs text-slate-300/90 line-clamp-2 leading-relaxed">{sponsor.description}</p>
            )}
            <div className="flex items-center gap-2 text-[10px] flex-wrap">
              <span className="flex items-center gap-1 text-cyan-200 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-400/30"><User className="w-2.5 h-2.5" />{sponsor.seller_name}</span>
              <span className="flex items-center gap-1 text-purple-200 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-400/30"><Eye className="w-2.5 h-2.5" />{sponsor.view_count || 0}</span>
              <span className="flex items-center gap-1 text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded-full border border-slate-700/50"><CalendarDays className="w-2.5 h-2.5" />{new Date(sponsor.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
            </div>
            <div className="flex items-center gap-2 pt-0.5 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black flex items-center gap-1 backdrop-blur-sm border ${sponsor.stock > 0 ? 'bg-gradient-to-r from-emerald-500/30 to-green-500/20 text-emerald-200 border-emerald-400/40 shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'bg-gradient-to-r from-rose-500/30 to-red-500/20 text-rose-200 border-rose-400/40'}`}>
                {sponsor.stock > 0 ? <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Stok {sponsor.stock}</> : '✗ Habis'}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-black backdrop-blur-sm border ${sponsor.has_warranty ? 'bg-gradient-to-r from-amber-500/30 to-yellow-500/20 text-amber-200 border-amber-400/40 shadow-[0_0_8px_rgba(251,191,36,0.3)]' : 'bg-slate-800/50 text-slate-400 border-slate-700/50'}`}>
                {sponsor.has_warranty
                  ? `🛡️ ${sponsor.warranty_duration_value} ${sponsor.warranty_duration_type === "hours" ? "Jam" : sponsor.warranty_duration_type === "days" ? "Hari" : "Bulan"}`
                  : "Tanpa Garansi"}
              </span>
            </div>
            {/* Share + Social buttons preview */}
            <div className="flex items-center gap-1.5 pt-1">
              <button
                onClick={(e) => { e.stopPropagation(); shareSponsor(sponsor); }}
                className="flex items-center gap-1 text-[10px] font-black text-cyan-100 bg-gradient-to-r from-cyan-500/30 to-blue-500/30 hover:from-cyan-500/50 hover:to-blue-500/50 px-2.5 py-1 rounded-full transition-all border border-cyan-400/40 shadow-[0_0_8px_rgba(34,211,238,0.3)] hover:scale-105"
              >
                <Share2 className="w-3 h-3" /> Bagikan
              </button>
              {socialLinks.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {socialLinks.slice(0, 2).map(([key, config]) => (
                    <span key={key} className="text-[9px] font-bold text-purple-200 bg-purple-500/20 border border-purple-400/30 px-2 py-0.5 rounded-full">{config.label}</span>
                  ))}
                  {socialLinks.length > 2 && <span className="text-[9px] font-bold text-fuchsia-200 bg-fuchsia-500/20 border border-fuchsia-400/30 px-2 py-0.5 rounded-full">+{socialLinks.length - 2}</span>}
                </div>
              )}
            </div>
          </CardContent>
          </Card>
        </div>
        )}
        {filtered.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-3">
            {filtered.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`h-1.5 rounded-full transition-all ${i === current % filtered.length ? "w-6 bg-gradient-to-r from-fuchsia-400 via-pink-400 to-amber-400 shadow-[0_0_8px_rgba(217,70,239,0.6)]" : "w-1.5 bg-slate-600/60 hover:bg-slate-400/60"}`} />
            ))}
          </div>
        )}
      </div>

      {/* Sponsor Detail Modal */}
      {selectedSponsor && (
        <SponsorDetailModal
          sponsor={selectedSponsor}
          images={sponsorImages[selectedSponsor.id] || []}
          onClose={() => setSelectedSponsor(null)}
          isLiked={likedSponsorIds.has(selectedSponsor.id)}
          onToggleLike={onToggleLikeSponsor}
          wholesaleTiers={wholesalePrices.filter((w: any) => w.entity_id === selectedSponsor.id).sort((a: any, b: any) => a.min_quantity - b.min_quantity)}
        />
      )}
    </>
  );
}

function SponsorDetailModal({ sponsor, images, onClose, isLiked, onToggleLike, wholesaleTiers = [] }: { sponsor: Sponsor; images: SponsorImage[]; onClose: () => void; isLiked?: boolean; onToggleLike?: (sponsorId: string, e?: React.MouseEvent) => void; wholesaleTiers?: any[] }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [showTerms, setShowTerms] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const allImages = images.length > 0 ? images.map(i => i.image_url) : (sponsor.image_url ? [sponsor.image_url] : []);

  // Increment view count
  useEffect(() => {
    supabase.from("sponsors").update({ view_count: (sponsor.view_count || 0) + 1 } as any).eq("id", sponsor.id).then(() => {});
  }, [sponsor.id]);

  function handleShare() {
    const url = window.location.origin + `/?sponsor=${sponsor.sponsor_number}`;
    const text = `🔥 ${sponsor.title}\n💰 ${sponsor.price > 0 ? formatPrice(sponsor.price) : "Gratis"}\n🏪 ${sponsor.seller_name}\n\nLihat di:`;
    if (navigator.share) {
      navigator.share({ title: sponsor.title, text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text} ${url}`);
    }
  }

  const socialLinks = Object.entries(socialIcons).filter(([key]) => {
    const val = (sponsor as any)[key];
    return val && val.trim();
  });

  // Rekber warning shown first before full detail
  if (!acceptedTerms) {
    return (
      <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-card w-full max-w-sm rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
            </div>
            <h3 className="text-center font-extrabold text-lg">⚠️ Peringatan Sebelum Membeli</h3>
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-2">
              <ul className="text-[11px] text-muted-foreground space-y-1.5 list-disc list-inside leading-relaxed">
                <li>Sebelum chat/beli, <span className="font-bold text-foreground">pikirkan lebih baik apakah penjual aman</span>.</li>
                <li>Silahkan <span className="font-bold text-foreground">gunakan rekber (rekening bersama) via Admin</span> agar terhindar dari penipu.</li>
                <li>Hubungi Admin WA <a href="https://wa.me/6285769302532" target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline">085769302532</a> atau buat <span className="font-bold text-primary">Tiket</span> jika ada masalah.</li>
                <li>Jika ada masalah produk, <span className="font-bold text-destructive">jangan salahkan admin</span>. Ajak penjual rekber & cek produk kembali.</li>
                <li>Akun yang sudah diambil penjual <span className="font-bold text-destructive">tidak bisa diklaim ulang</span>. Jika mau resmi, beli dari admin langsung.</li>
                <li><span className="font-bold text-foreground">Pembeli dan penjual harus amanah</span>.</li>
                <li>Apabila tidak menggunakan rekber admin, <span className="font-bold text-destructive">admin tidak bertanggung jawab</span>.</li>
              </ul>
            </div>
            <a href={`https://wa.me/6285769302532?text=${encodeURIComponent(`Halo admin, saya mau rekber untuk produk sponsor:\n\n🔗 Link: ${window.location.origin}/?sponsor=${sponsor.sponsor_number}\n📦 Judul: ${sponsor.title}\n💰 Harga: ${formatPrice(sponsor.price)}\n📝 Deskripsi: ${sponsor.description || '-'}\n🏪 Penjual: ${sponsor.seller_name}\n📊 Stok: ${sponsor.stock} | Garansi: ${sponsor.has_warranty ? `${sponsor.warranty_duration_value} ${sponsor.warranty_duration_type === "hours" ? "Jam" : sponsor.warranty_duration_type === "days" ? "Hari" : "Bulan"}` : 'Tidak ada'}\n\nMohon bantu proses rekber. Terima kasih!`)}`} target="_blank" rel="noopener noreferrer" className="block">
              <Button size="sm" className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white font-bold gap-2 text-xs">
                <Shield className="w-3.5 h-3.5" /> Mohon Rekber Admin (WA)
              </Button>
            </a>
            <Button onClick={() => setAcceptedTerms(true)} className="w-full font-bold gap-2">
              <Eye className="w-4 h-4" /> Saya Mengerti, Lihat Produk Sponsor
            </Button>
            <Button variant="outline" onClick={onClose} className="w-full text-sm">
              Batal
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card w-full max-w-sm rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Image gallery */}
        {allImages.length > 0 && (
          <div className="relative">
            <img src={allImages[imgIdx]} alt={sponsor.title} className="w-full h-48 object-cover" />
            {allImages.length > 1 && (
              <>
                <button onClick={() => setImgIdx(i => (i - 1 + allImages.length) % allImages.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setImgIdx(i => (i + 1) % allImages.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 bg-black/50 text-white rounded-full flex items-center justify-center">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {allImages.map((_, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === imgIdx ? "bg-white" : "bg-white/40"}`} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-mono text-muted-foreground">#{sponsor.sponsor_number}</p>
              <h3 className="font-extrabold text-lg">{sponsor.title}</h3>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <button onClick={handleShare} className="w-8 h-8 rounded-full bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-colors">
                <Share2 className="w-4 h-4 text-primary" />
              </button>
              {onToggleLike && (
                <button onClick={() => onToggleLike(sponsor.id)}>
                  <Heart className={`w-6 h-6 ${isLiked ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
                </button>
              )}
              <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          {sponsor.price > 0 && (
            <p className="text-xl font-extrabold text-primary">{formatPrice(sponsor.price)}</p>
          )}
          {wholesaleTiers.length > 0 && (
            <div className="bg-accent/10 border border-accent/20 rounded-lg p-3 space-y-1.5">
              <p className="text-xs font-bold text-accent-foreground flex items-center gap-1">💰 Harga Grosir</p>
              <div className="space-y-1">
                {wholesaleTiers.map((tier: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Beli ≥ {tier.min_quantity} pcs</span>
                    <span className="font-bold text-primary">{formatPrice(tier.price_per_item)}/pcs</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">Harga normal: {formatPrice(sponsor.price)}/pcs</p>
            </div>
          )}
          {sponsor.description && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{sponsor.description}</p>
          )}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <span className="font-medium">Penjual:</span>
              <span>{sponsor.seller_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-primary" />
              <span className="font-medium">Kontak:</span>
              <a href={`https://wa.me/${sponsor.seller_contact.replace(/[^0-9+]/g, "")}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {sponsor.seller_contact}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="font-medium">Sisa waktu:</span>
              <span>{timeRemaining(sponsor.expires_at)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" />
              <span className="font-medium">Stok:</span>
              <span className={sponsor.stock > 0 ? "text-foreground" : "text-destructive font-bold"}>{sponsor.stock > 0 ? sponsor.stock : "Habis"}</span>
            </div>
            <div className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" />
              <span className="font-medium">Garansi:</span>
              <span className={sponsor.has_warranty ? "text-foreground font-bold" : "text-muted-foreground"}>
                {sponsor.has_warranty
                  ? `${sponsor.warranty_duration_value} ${sponsor.warranty_duration_type === "hours" ? "Jam" : sponsor.warranty_duration_type === "days" ? "Hari" : "Bulan"}`
                  : "Tidak ada"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              <span className="font-medium">Tanggal Rilis:</span>
              <span>{new Date(sponsor.created_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>
          </div>

          {/* Social Media Buttons */}
          {socialLinks.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Sosial Media</p>
              <div className="grid grid-cols-2 gap-2">
                {socialLinks.map(([key, config]) => (
                  <a
                    key={key}
                    href={config.url((sponsor as any)[key])}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${config.color} text-white text-xs font-bold rounded-lg py-2 px-3 text-center transition-colors`}
                  >
                    {config.label}
                  </a>
                ))}
              </div>
            </div>
          )}

          {sponsor.custom_note && (
            <div className="bg-primary/5 border border-primary/10 rounded-lg p-3 text-xs text-muted-foreground">
              {sponsor.custom_note}
            </div>
          )}

          {/* View count */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Eye className="w-4 h-4" />
            <span>{sponsor.view_count || 0}x dilihat</span>
          </div>

          {/* Syarat & Ketentuan Toggle Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTerms(v => !v)}
            className="w-full gap-2 text-xs font-bold border-destructive/30 text-destructive hover:bg-destructive/5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {showTerms ? "Tutup Syarat & Ketentuan" : "Lihat Syarat & Ketentuan"}
          </Button>

          {showTerms && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
              <ul className="text-[11px] text-muted-foreground space-y-1.5 list-disc list-inside leading-relaxed">
                <li>Sebelum chat/beli, <span className="font-bold text-foreground">pikirkan lebih baik apakah penjual aman</span>.</li>
                <li>Silahkan <span className="font-bold text-foreground">gunakan rekber (rekening bersama) via Admin</span> agar terhindar dari penipu.</li>
                <li>Hubungi Admin WA <a href="https://wa.me/6285769302532" target="_blank" rel="noopener noreferrer" className="text-primary font-bold hover:underline">085769302532</a> atau buat <span className="font-bold text-primary">Tiket</span> jika ada masalah.</li>
                <li>Jika ada masalah produk, <span className="font-bold text-destructive">jangan salahkan admin</span>. Ajak penjual rekber & cek produk kembali.</li>
                <li>Akun yang sudah diambil penjual <span className="font-bold text-destructive">tidak bisa diklaim ulang</span>.</li>
                <li><span className="font-bold text-foreground">Pembeli dan penjual harus amanah</span>.</li>
                <li>Apabila tidak menggunakan rekber admin, <span className="font-bold text-destructive">admin tidak bertanggung jawab</span>.</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-destructive/10">
                <p className="font-bold text-foreground text-[11px] mb-1.5">📋 Ketentuan Lengkap Sponsor:</p>
                <ol className="text-[11px] text-muted-foreground space-y-1 list-decimal list-inside leading-relaxed">
                  <li>Produk sponsor <span className="font-bold text-foreground">bukan milik/tanggung jawab admin platform</span>. Admin hanya menyediakan tempat iklan.</li>
                  <li>Penjual <span className="font-bold text-foreground">wajib memberikan produk sesuai deskripsi</span> yang tertulis.</li>
                  <li>Pembeli <span className="font-bold text-foreground">wajib cek deskripsi, garansi, dan stok</span> sebelum membeli.</li>
                  <li>Garansi hanya berlaku <span className="font-bold text-foreground">jika tertulis di detail produk</span>.</li>
                  <li>Penipuan akan <span className="font-bold text-destructive">dilaporkan dan akun penjual diblokir</span>.</li>
                  <li>Transaksi tanpa rekber = <span className="font-bold text-destructive">risiko ditanggung pembeli sepenuhnya</span>.</li>
                  <li>Dilarang menjual produk <span className="font-bold text-destructive">ilegal, SARA, atau melanggar hukum</span>.</li>
                  <li>Admin berhak <span className="font-bold text-foreground">menghapus sponsor yang melanggar ketentuan</span> tanpa pemberitahuan.</li>
                  <li>Harga dan stok <span className="font-bold text-foreground">bisa berubah sewaktu-waktu</span> oleh penjual.</li>
                  <li>Komplain hanya dilayani <span className="font-bold text-foreground">maksimal 1x24 jam</span> setelah transaksi.</li>
                  <li>Bukti transaksi (screenshot) <span className="font-bold text-foreground">wajib disimpan</span> sebagai perlindungan.</li>
                </ol>
              </div>
              <a href={`https://wa.me/6285769302532?text=${encodeURIComponent(`Halo admin, saya mau rekber untuk produk sponsor:\n\n🔗 Link: ${window.location.origin}/?sponsor=${sponsor.sponsor_number}\n📦 Judul: ${sponsor.title}\n💰 Harga: ${formatPrice(sponsor.price)}\n📝 Deskripsi: ${sponsor.description || '-'}\n🏪 Penjual: ${sponsor.seller_name}\n📊 Stok: ${sponsor.stock} | Garansi: ${sponsor.has_warranty ? `${sponsor.warranty_duration_value} ${sponsor.warranty_duration_type === "hours" ? "Jam" : sponsor.warranty_duration_type === "days" ? "Hari" : "Bulan"}` : 'Tidak ada'}\n\nMohon bantu proses rekber. Terima kasih!`)}`} target="_blank" rel="noopener noreferrer" className="block">
                <Button size="sm" className="w-full mt-2 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold gap-2 text-xs">
                  <Shield className="w-3.5 h-3.5" /> Mohon Rekber Admin (WA)
                </Button>
              </a>
            </div>
          )}

          {/* Share button */}
          <button
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 text-sm font-bold text-primary hover:from-primary/20 hover:to-accent/20 transition-all"
          >
            <Share2 className="w-4 h-4" /> Bagikan Sponsor Ini
          </button>
        </div>
      </div>
    </div>
  );
}
