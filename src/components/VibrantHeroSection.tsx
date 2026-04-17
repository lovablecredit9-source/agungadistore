import { Sparkles, Zap, Package, Crown, ShoppingBag, ArrowRight, ShieldCheck } from "lucide-react";

interface QuickAction {
  id: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  cta: string;
  onClick: () => void;
  dark?: boolean;
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
  const actions: QuickAction[] = [
    {
      id: "flash",
      label: "Flash Sale",
      desc: "Diskon hingga 70%.",
      icon: <Zap className="w-5 h-5" />,
      iconBg: "bg-red-500/15",
      iconColor: "text-red-500",
      cta: "Cek Sekarang",
      onClick: onFlashSale,
    },
    {
      id: "wholesale",
      label: "Grosir",
      desc: "Harga partai besar.",
      icon: <Package className="w-5 h-5" />,
      iconBg: "bg-blue-500/15",
      iconColor: "text-blue-500",
      cta: "Daftar Mitra",
      onClick: onWholesale,
    },
    {
      id: "new",
      label: "Baru Datang",
      desc: "Rilis minggu ini.",
      icon: <Sparkles className="w-5 h-5" />,
      iconBg: "bg-emerald-500/15",
      iconColor: "text-emerald-500",
      cta: "Lihat Koleksi",
      onClick: onNewArrivals,
    },
    {
      id: "premium",
      label: "Premium",
      desc: "Brand original bergaransi.",
      icon: <Crown className="w-5 h-5" />,
      iconBg: "bg-white/10",
      iconColor: "text-yellow-300",
      cta: "Jelajahi",
      onClick: onPremium,
      dark: true,
    },
  ];

  return (
    <section className="relative">
      {/* Hero gradient panel */}
      <div className="relative overflow-hidden rounded-3xl px-5 pt-7 pb-24 sm:px-8 sm:pt-10 sm:pb-28 shadow-2xl"
           style={{
             background: "linear-gradient(135deg, #6200EA 0%, #9D00FF 50%, #FF007F 100%)",
           }}>
        {/* Decorative orbs */}
        <div className="absolute -top-32 -left-32 w-[400px] h-[400px] bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-40 -right-32 w-[400px] h-[400px] bg-[#D4FF00]/25 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          {/* Trust badge */}
          <div className="inline-flex items-center gap-2 bg-black/25 border border-white/15 backdrop-blur-md px-3 py-1.5 rounded-full mb-5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D4FF00] opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D4FF00] shadow-[0_0_8px_rgba(212,255,0,0.9)]" />
            </span>
            <ShieldCheck className="w-3 h-3 text-white" />
            <span className="text-white font-extrabold text-[10px] tracking-[0.15em] uppercase">100% Trusted Store</span>
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

      {/* Quick Action Grid - overlapping */}
      <div className="relative z-20 -mt-16 px-1">
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              className={`relative overflow-hidden p-4 rounded-2xl text-left ring-1 transition-all hover:-translate-y-1 active:scale-[0.97] duration-300 group ${
                action.dark
                  ? "bg-[#0A0A0C] text-white ring-white/10 shadow-[0_15px_40px_-10px_rgba(10,10,12,0.5)]"
                  : "bg-card text-card-foreground ring-border shadow-lg hover:shadow-xl"
              }`}
            >
              {action.dark && (
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-[#6200EA] rounded-full blur-2xl opacity-60 group-hover:opacity-90 transition-opacity" />
              )}
              <div className="relative z-10">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${action.iconBg} ${action.iconColor} group-hover:scale-110 transition-transform`}>
                  {action.icon}
                </div>
                <h3 className="font-extrabold text-sm mb-0.5">{action.label}</h3>
                <p className={`text-[11px] font-medium mb-3 ${action.dark ? "text-zinc-400" : "text-muted-foreground"}`}>
                  {action.desc}
                </p>
                <div className={`flex items-center gap-1 text-[11px] font-bold group-hover:gap-2 transition-all ${
                  action.dark ? "text-[#D4FF00]" : "text-primary"
                }`}>
                  {action.cta}
                  <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
