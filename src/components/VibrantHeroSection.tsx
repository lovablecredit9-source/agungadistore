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

interface PersonaTab {
  id: "for-you" | "trending" | "history";
  label: string;
  icon: React.ReactNode;
  items: { emoji: string; title: string; sub: string; tag: string; tagTone: string }[];
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
  const [persona, setPersona] = useState<PersonaTab["id"]>("for-you");
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

  const personaTabs: PersonaTab[] = useMemo(() => [
    {
      id: "for-you",
      label: "Untuk Kamu",
      icon: <Sparkles className="w-3.5 h-3.5" />,
      items: [
        { emoji: "🎧", title: "Earbuds Pro", sub: "Best match · 96%", tag: "Pilihan", tagTone: "bg-purple-500/15 text-purple-600 dark:text-purple-300" },
        { emoji: "👟", title: "Sneakers Original", sub: "Sesuai gaya kamu", tag: "Match", tagTone: "bg-pink-500/15 text-pink-600 dark:text-pink-300" },
        { emoji: "🎮", title: "Gaming Bundle", sub: "Diskon khusus", tag: "−25%", tagTone: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
      ],
    },
    {
      id: "trending",
      label: "Trending",
      icon: <Flame className="w-3.5 h-3.5" />,
      items: [
        { emoji: "🔥", title: "Hoodie Oversize", sub: "1.2k dilihat hari ini", tag: "#1", tagTone: "bg-red-500/15 text-red-600 dark:text-red-300" },
        { emoji: "📱", title: "Powerbank 20K", sub: "856 dilihat", tag: "#2", tagTone: "bg-orange-500/15 text-orange-600 dark:text-orange-300" },
        { emoji: "⌚", title: "Smartwatch X", sub: "612 dilihat", tag: "#3", tagTone: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
      ],
    },
    {
      id: "history",
      label: "Riwayat",
      icon: <Clock className="w-3.5 h-3.5" />,
      items: [
        { emoji: "🕒", title: "Lihat lagi koleksi", sub: "Berdasarkan kunjungan", tag: "Resume", tagTone: "bg-blue-500/15 text-blue-600 dark:text-blue-300" },
        { emoji: "💾", title: "Wishlist tersimpan", sub: "Cek harga terbaru", tag: "Saved", tagTone: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300" },
        { emoji: "🛒", title: "Keranjang aktif", sub: "Selesaikan checkout", tag: "Pending", tagTone: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300" },
      ],
    },
  ], []);

  const activePersona = personaTabs.find((p) => p.id === persona)!;
  const previewAction = actions.find((a) => a.id === previewId);

  const handlePersonaClick = (id: PersonaTab["id"]) => {
    setPersona(id);
    if (id === "trending") onFlashSale();
    else if (id === "history") onCatalog();
    else onShop();
  };

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

      {/* Personalized rail — Untuk Kamu / Trending / Riwayat */}
      <div className="relative z-10 mt-5 px-1">
        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-4 shadow-lg animate-fade-in">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-primary" />
              <h3 className="font-extrabold text-sm">Jelajah Pintar</h3>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-full p-0.5">
              {personaTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setPersona(tab.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all ${
                    persona === tab.id
                      ? "bg-primary text-primary-foreground shadow-md scale-105"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.icon}
                  <span className="hidden xs:inline">{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div key={persona} className="space-y-2 animate-fade-in">
            {activePersona.items.map((item, i) => (
              <button
                key={`${persona}-${i}`}
                onClick={() => handlePersonaClick(persona)}
                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/70 active:scale-[0.98] transition-all group text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                  {item.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{item.title}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{item.sub}</div>
                </div>
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${item.tagTone}`}>
                  {item.tag}
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>

          {/* Mini perks ribbon */}
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-2 text-[10px] font-bold text-muted-foreground">
            <div className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-500" /> 4.9★</div>
            <div className="flex items-center gap-1"><Gift className="w-3 h-3 text-purple-500" /> Free Voucher</div>
            <div className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-500" /> +18% wk</div>
          </div>
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
