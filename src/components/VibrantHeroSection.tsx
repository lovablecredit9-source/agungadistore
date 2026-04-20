import { useState, useEffect, useMemo } from "react";
import {
  Sparkles, Zap, Package, Crown, ShoppingBag, ArrowRight, ShieldCheck,
  Flame, TrendingUp, Clock, Heart, Star, Eye, Tag, Gift, Compass, X,
} from "lucide-react";

interface QuickAction {
  id: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  cta: string;
  badge?: { text: string; tone: "hot" | "new" | "sale" | "vip" };
  stockHint?: string;
  onClick: () => void;
  dark?: boolean;
  preview: {
    title: string;
    points: string[];
    accent: string;
  };
}


interface Props {
  productCount: number;
  sponsorCount: number;
  onShop: () => void;
  onCatalog: () => void;
  onFlashSale: () => void;
  onWholesale: () => void;
  onNewArrivals: () => void;
  onPremium: () => void;
}

const badgeStyles: Record<string, string> = {
  hot: "bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.7)]",
  new: "bg-emerald-500 text-white shadow-[0_0_12px_rgba(16,185,129,0.7)]",
  sale: "bg-[#D4FF00] text-black shadow-[0_0_12px_rgba(212,255,0,0.7)]",
  vip: "bg-gradient-to-r from-yellow-400 to-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.7)]",
};

export default function VibrantHeroSection({
  productCount,
  sponsorCount,
  onShop,
  onCatalog,
  onFlashSale,
  onWholesale,
  onNewArrivals,
  onPremium,
}: Props) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  
  const [liveViewers, setLiveViewers] = useState(127);

  // Live viewers ticker — fake but feels alive
  useEffect(() => {
    const t = setInterval(() => {
      setLiveViewers((v) => Math.max(80, Math.min(420, v + Math.floor(Math.random() * 9) - 4)));
    }, 2200);
    return () => clearInterval(t);
  }, []);

  const actions: QuickAction[] = useMemo(() => [
    {
      id: "flash",
      label: "Flash Sale",
      desc: "Diskon hingga 70%.",
      icon: <Zap className="w-5 h-5" />,
      iconBg: "bg-red-500/15",
      iconColor: "text-red-500",
      cta: "Cek Sekarang",
      badge: { text: "HOT", tone: "hot" },
      stockHint: "Stok terbatas",
      onClick: onFlashSale,
      preview: {
        title: "Flash Sale Berjalan",
        points: ["Diskon hingga 70%", "Refresh tiap jam", "Stok cepat habis"],
        accent: "text-red-500",
      },
    },
    {
      id: "wholesale",
      label: "Grosir",
      desc: "Harga partai besar.",
      icon: <Package className="w-5 h-5" />,
      iconBg: "bg-blue-500/15",
      iconColor: "text-blue-500",
      cta: "Daftar Mitra",
      stockHint: "Min. 12 pcs",
      onClick: onWholesale,
      preview: {
        title: "Harga Grosir",
        points: ["Diskon bertingkat", "Reseller welcome", "Support COD partai"],
        accent: "text-blue-500",
      },
    },
    {
      id: "new",
      label: "Baru Datang",
      desc: "Rilis minggu ini.",
      icon: <Sparkles className="w-5 h-5" />,
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-500",
      cta: "Lihat Koleksi",
      badge: { text: "NEW", tone: "new" },
      stockHint: "Update tiap Senin",
      onClick: onNewArrivals,
      preview: {
        title: "Koleksi Baru",
        points: ["Rilis perdana", "Stok awal terbatas", "Trending viral"],
        accent: "text-emerald-500",
      },
    },
    {
      id: "premium",
      label: "Premium",
      desc: "Brand original bergaransi.",
      icon: <Crown className="w-5 h-5" />,
      iconBg: "bg-white/10",
      iconColor: "text-yellow-300",
      cta: "Jelajahi",
      badge: { text: "VIP", tone: "vip" },
      stockHint: "Garansi resmi",
      onClick: onPremium,
      dark: true,
      preview: {
        title: "Koleksi Premium",
        points: ["100% Original", "Garansi toko", "Fast response 24/7"],
        accent: "text-yellow-300",
      },
    },
  ], [onFlashSale, onWholesale, onNewArrivals, onPremium]);

  const previewAction = actions.find((a) => a.id === previewId);

  return (
    <section className="relative">
      {/* Hero gradient panel */}
      <div
        className="relative overflow-hidden rounded-3xl px-5 pt-7 pb-24 sm:px-8 sm:pt-10 sm:pb-28 shadow-2xl"
        style={{ background: "linear-gradient(135deg, #6200EA 0%, #9D00FF 50%, #FF007F 100%)" }}
      >
        {/* Decorative orbs */}
        <div className="absolute -top-32 -left-32 w-[400px] h-[400px] bg-white/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
        <div className="absolute -bottom-40 -right-32 w-[400px] h-[400px] bg-[#D4FF00]/25 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: "1s" }} />
        {/* Floating sparkles */}
        <div className="absolute top-12 right-8 text-[#D4FF00]/60 pointer-events-none animate-bounce" style={{ animationDuration: "3s" }}>
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="absolute bottom-32 left-10 text-white/40 pointer-events-none animate-bounce" style={{ animationDuration: "4s", animationDelay: "0.5s" }}>
          <Star className="w-3 h-3" />
        </div>

        <div className="relative z-10">
          {/* Trust + Live viewers */}
          <div className="flex items-center gap-2 flex-wrap mb-5">
            <div className="inline-flex items-center gap-2 bg-black/25 border border-white/15 backdrop-blur-md px-3 py-1.5 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4FF00] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4FF00] shadow-[0_0_8px_rgba(212,255,0,0.9)]" />
              </span>
              <ShieldCheck className="w-3 h-3 text-white" />
              <span className="text-white font-extrabold text-[10px] tracking-[0.15em] uppercase">100% Trusted</span>
            </div>
            <div className="inline-flex items-center gap-1.5 bg-white/10 border border-white/20 backdrop-blur-md px-2.5 py-1.5 rounded-full">
              <Eye className="w-3 h-3 text-white" />
              <span className="text-white font-bold text-[10px] tabular-nums">{liveViewers}</span>
              <span className="text-white/70 text-[9px] uppercase tracking-widest font-bold">live</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="font-black text-white leading-[0.95] tracking-tight text-4xl sm:text-5xl mb-3">
            Grosir Cepat.
            <br />
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: "linear-gradient(90deg, #D4FF00, #ffffff)" }}>
              Harga Pikat.
            </span>
          </h1>

          <p className="text-white/85 text-sm sm:text-base font-medium max-w-md mb-6 leading-relaxed">
            Akses instan ke ribuan produk unggulan dengan harga distributor langsung di Agung Adi Store.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onShop}
              className="group bg-[#D4FF00] text-[#0A0A0C] px-5 py-3 rounded-full font-extrabold text-sm shadow-[0_8px_30px_rgba(212,255,0,0.35)] hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-1.5"
            >
              <ShoppingBag className="w-4 h-4" />
              Mulai Belanja
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={onCatalog}
              className="px-5 py-3 rounded-full font-bold text-sm text-white bg-white/10 border border-white/20 backdrop-blur-md hover:bg-white/20 transition-colors"
            >
              Lihat Katalog
            </button>
          </div>

          {/* Inline mini stats */}
          <div className="mt-6 flex items-center gap-4 text-white/90">
            <div>
              <div className="text-xl font-black tabular-nums">{productCount}+</div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-white/60">Produk</div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
              <div className="text-xl font-black tabular-nums">{sponsorCount}+</div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-white/60">Sponsor</div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div>
              <div className="text-xl font-black tabular-nums">24/7</div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-white/60">Support</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Grid - overlapping with badges, animations & long-press preview */}
      <div className="relative z-20 -mt-16 px-1">
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action, idx) => (
            <div key={action.id} className="relative group">
              <button
                onClick={action.onClick}
                onContextMenu={(e) => { e.preventDefault(); setPreviewId(action.id); }}
                className={`relative overflow-hidden p-4 rounded-2xl text-left ring-1 transition-all hover:-translate-y-1 active:scale-[0.97] duration-300 w-full animate-fade-in ${
                  action.dark
                    ? "bg-[#0A0A0C] text-white ring-white/10 shadow-[0_15px_40px_-10px_rgba(10,10,12,0.5)]"
                    : "bg-card text-card-foreground ring-border shadow-lg hover:shadow-2xl"
                }`}
                style={{ animationDelay: `${idx * 80}ms` }}
              >
                {/* Animated shine on hover */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />

                {action.dark && (
                  <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#6200EA] rounded-full blur-2xl opacity-60 group-hover:opacity-90 transition-opacity" />
                )}

                {/* Live badge */}
                {action.badge && (
                  <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-wider z-20 animate-pulse ${badgeStyles[action.badge.tone]}`}>
                    {action.badge.text}
                  </div>
                )}

                <div className="relative z-10">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${action.iconBg} ${action.iconColor} group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300`}>
                    {action.icon}
                  </div>
                  <h3 className="font-extrabold text-sm mb-0.5 flex items-center gap-1">
                    {action.label}
                  </h3>
                  <p className={`text-[11px] font-medium mb-2 ${action.dark ? "text-zinc-400" : "text-muted-foreground"}`}>
                    {action.desc}
                  </p>
                  {action.stockHint && (
                    <div className={`flex items-center gap-1 mb-2 text-[9px] font-bold uppercase tracking-wider ${action.dark ? "text-zinc-500" : "text-muted-foreground/80"}`}>
                      <Tag className="w-2.5 h-2.5" />
                      {action.stockHint}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <div className={`flex items-center gap-1 text-[11px] font-bold group-hover:gap-2 transition-all ${
                      action.dark ? "text-[#D4FF00]" : "text-primary"
                    }`}>
                      {action.cta}
                      <ArrowRight className="w-3 h-3" />
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setPreviewId(action.id); }}
                      className={`p-1 rounded-full transition-colors ${action.dark ? "hover:bg-white/10 text-white/60" : "hover:bg-muted text-muted-foreground"}`}
                      aria-label="Quick preview"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Preview Popover */}
      {previewAction && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4"
          onClick={() => setPreviewId(null)}
        >
          <div
            className="relative w-full max-w-sm bg-card rounded-3xl border border-border shadow-2xl p-5 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewId(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-muted transition-colors"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>

            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${previewAction.iconBg} ${previewAction.iconColor}`}>
              {previewAction.icon}
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-black text-lg">{previewAction.preview.title}</h4>
              {previewAction.badge && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black tracking-wider ${badgeStyles[previewAction.badge.tone]}`}>
                  {previewAction.badge.text}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-4">{previewAction.desc}</p>

            <ul className="space-y-2 mb-5">
              {previewAction.preview.points.map((p, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <div className={`w-1.5 h-1.5 rounded-full ${previewAction.preview.accent.replace("text-", "bg-")}`} />
                  <span className="font-medium">{p}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => { previewAction.onClick(); setPreviewId(null); }}
              className="w-full py-3 rounded-full font-extrabold text-sm bg-primary text-primary-foreground hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              {previewAction.cta}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
