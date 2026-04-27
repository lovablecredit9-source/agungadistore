import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Zap, ShieldCheck, Truck, Eye, TrendingUp, Sparkles, BadgeCheck } from "lucide-react";

interface Props {
  totalProducts: number;
  inStockProducts: number;
  newProducts?: number;
  topCategory?: string | null;
}

export default function ProductShowcaseBar({ totalProducts, inStockProducts, newProducts = 0, topCategory }: Props) {
  const [viewers, setViewers] = useState(() => 64 + Math.floor(Math.random() * 90));
  const [tickerIdx, setTickerIdx] = useState(0);

  // Live viewers wobble
  useEffect(() => {
    const t = setInterval(() => {
      setViewers((v) => Math.max(42, Math.min(280, v + (Math.random() > 0.5 ? 1 : -1) * Math.floor(Math.random() * 5))));
    }, 1400);
    return () => clearInterval(t);
  }, []);

  const tickers = useMemo(() => [
    { icon: Zap, text: "Auto-deliver instan 24/7", tone: "text-amber-300" },
    { icon: ShieldCheck, text: "Garansi penuh & aman", tone: "text-emerald-300" },
    { icon: Truck, text: "Proses kilat secepat kilat", tone: "text-sky-300" },
    { icon: BadgeCheck, text: "Produk terverifikasi resmi", tone: "text-pink-300" },
    { icon: Sparkles, text: "Pilihan terbaik komunitas", tone: "text-violet-300" },
  ], []);

  useEffect(() => {
    const t = setInterval(() => setTickerIdx((i) => (i + 1) % tickers.length), 2400);
    return () => clearInterval(t);
  }, [tickers.length]);

  const stockPct = totalProducts > 0 ? Math.round((inStockProducts / totalProducts) * 100) : 0;
  const TickerIcon = tickers[tickerIdx].icon;

  return (
    <div className="relative">
      {/* Soft ambient glow halo */}
      <div className="pointer-events-none absolute -inset-2 opacity-60">
        <div className="absolute top-0 left-1/4 w-40 h-40 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-40 h-40 rounded-full bg-purple-500/20 blur-3xl" />
      </div>

      {/* Frosted iOS card */}
      <div
        className="relative rounded-3xl overflow-hidden border border-white/15 bg-background/50 backdrop-blur-2xl"
        style={{
          boxShadow:
            "0 1px 0 0 rgba(255,255,255,0.08) inset, 0 20px 50px -20px rgba(0,0,0,0.55), 0 8px 24px -12px rgba(59,130,246,0.25)",
        }}
      >
        {/* Top hairline highlight */}
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

        <div className="relative p-3.5">
          {/* Header row */}
          <div className="flex items-center gap-3">
            <motion.div
              className="relative shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, hsl(217 91% 60%), hsl(243 75% 59%), hsl(271 91% 65%))",
                boxShadow:
                  "0 8px 20px -6px rgba(99,102,241,0.55), 0 0 0 1px rgba(255,255,255,0.18) inset",
              }}
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Package className="w-5 h-5 text-white drop-shadow" strokeWidth={2.4} />
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-background animate-pulse" />
            </motion.div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-[15px] font-bold text-foreground tracking-tight truncate">
                  Katalog Produk
                </h3>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-400/25">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" /> LIVE
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted-foreground">
                <Eye className="w-3 h-3" />
                <motion.span key={viewers} initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} className="tabular-nums font-semibold text-foreground/80">
                  {viewers}
                </motion.span>
                <span>menonton sekarang</span>
              </div>
            </div>

            {/* Stock ring badge */}
            <div className="relative shrink-0 w-12 h-12">
              <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--muted-foreground) / 0.15)" strokeWidth="2.5" />
                <motion.circle
                  cx="18" cy="18" r="15.5"
                  fill="none"
                  stroke="url(#ringGrad)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={`${(stockPct / 100) * 97.4} 97.4`}
                  initial={{ strokeDasharray: "0 97.4" }}
                  animate={{ strokeDasharray: `${(stockPct / 100) * 97.4} 97.4` }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                />
                <defs>
                  <linearGradient id="ringGrad" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stopColor="hsl(160 84% 50%)" />
                    <stop offset="100%" stopColor="hsl(189 94% 55%)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[11px] font-bold text-foreground tabular-nums leading-none">{stockPct}<span className="text-[8px]">%</span></span>
                <span className="text-[7px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">ready</span>
              </div>
            </div>
          </div>

          {/* Stat trio */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            {[
              { icon: Package, label: "Total", value: totalProducts, tint: "blue" },
              { icon: Sparkles, label: "Baru", value: newProducts, tint: "pink" },
              { icon: TrendingUp, label: "Trending", value: topCategory || "Semua", tint: "amber", isText: true },
            ].map((stat, i) => {
              const Icon = stat.icon;
              const tintMap: Record<string, string> = {
                blue: "from-blue-500/15 to-cyan-500/5 text-blue-300 border-blue-400/20",
                pink: "from-pink-500/15 to-rose-500/5 text-pink-300 border-pink-400/20",
                amber: "from-amber-500/15 to-orange-500/5 text-amber-300 border-amber-400/20",
              };
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`relative rounded-2xl p-2.5 bg-gradient-to-br ${tintMap[stat.tint]} border backdrop-blur-xl overflow-hidden`}
                  style={{ boxShadow: "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 4px 12px -4px rgba(0,0,0,0.3)" }}
                >
                  <div className="flex items-center gap-1 mb-1">
                    <Icon className="w-3 h-3" strokeWidth={2.5} />
                    <p className="text-[9px] font-bold uppercase tracking-wider opacity-90">{stat.label}</p>
                  </div>
                  {stat.isText ? (
                    <p className="text-[12px] font-bold text-foreground leading-tight truncate">{stat.value}</p>
                  ) : (
                    <p className="text-lg font-bold text-foreground tabular-nums leading-none">{stat.value}</p>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Ticker pill */}
          <div className="relative mt-3 rounded-2xl bg-white/[0.04] border border-white/10 px-3 py-2 overflow-hidden backdrop-blur-xl">
            <div className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-blue-400 via-purple-400 to-pink-400 rounded-r-full" />
            <div className="relative h-4 overflow-hidden flex items-center pl-1">
              <AnimatePresence mode="wait">
                <motion.div
                  key={tickerIdx}
                  initial={{ y: 14, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -14, opacity: 0 }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                  className="flex items-center gap-1.5"
                >
                  <TickerIcon className={`w-3 h-3 ${tickers[tickerIdx].tone}`} strokeWidth={2.5} />
                  <span className="text-[11px] font-semibold text-foreground/90 whitespace-nowrap">
                    {tickers[tickerIdx].text}
                  </span>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
