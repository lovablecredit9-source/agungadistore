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
    { icon: Zap, text: "Auto-deliver instan 24/7", color: "text-yellow-300" },
    { icon: ShieldCheck, text: "Garansi penuh & aman", color: "text-emerald-300" },
    { icon: Truck, text: "Proses kilat secepat kilat", color: "text-cyan-300" },
    { icon: BadgeCheck, text: "Produk terverifikasi resmi", color: "text-pink-300" },
    { icon: Sparkles, text: "Pilihan terbaik komunitas", color: "text-purple-300" },
  ], []);

  useEffect(() => {
    const t = setInterval(() => setTickerIdx((i) => (i + 1) % tickers.length), 2400);
    return () => clearInterval(t);
  }, [tickers.length]);

  const stockPct = totalProducts > 0 ? Math.round((inStockProducts / totalProducts) * 100) : 0;
  const TickerIcon = tickers[tickerIdx].icon;

  return (
    <div
      className="relative rounded-3xl p-[2px] overflow-hidden"
      style={{
        background:
          "linear-gradient(120deg, hsl(190 95% 55%), hsl(220 90% 60%), hsl(280 90% 65%), hsl(330 90% 60%), hsl(190 95% 55%))",
        backgroundSize: "300% 300%",
        animation: "aurora-shift 9s ease infinite",
        boxShadow: "0 12px 40px -12px rgba(34,211,238,0.55)",
      }}
    >
      <div className="relative rounded-[22px] bg-gradient-to-br from-slate-950/95 via-slate-900/95 to-slate-950/95 backdrop-blur-xl p-3 overflow-hidden">
        {/* Animated mesh background */}
        <div className="pointer-events-none absolute inset-0 opacity-60">
          <motion.div
            className="absolute -top-20 -left-20 w-56 h-56 rounded-full bg-cyan-500/40 blur-3xl"
            animate={{ x: [0, 35, 0], y: [0, 25, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-20 -right-20 w-56 h-56 rounded-full bg-fuchsia-500/40 blur-3xl"
            animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        {/* Floating sparkles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {[...Array(10)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-white"
              style={{
                top: `${8 + (i * 9) % 84}%`,
                left: `${(i * 11) % 96}%`,
                boxShadow: "0 0 6px rgba(255,255,255,0.9), 0 0 12px rgba(34,211,238,0.6)",
              }}
              animate={{ opacity: [0.15, 1, 0.15], scale: [0.7, 1.5, 0.7] }}
              transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.25 }}
            />
          ))}
        </div>

        {/* Header row */}
        <div className="relative flex items-center gap-2 mb-3">
          <motion.div
            className="relative shrink-0 w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 flex items-center justify-center border border-white/30"
            style={{ boxShadow: "0 0 22px rgba(34,211,238,0.7)" }}
            animate={{ rotate: [0, 6, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <Package className="w-5 h-5 text-white drop-shadow" />
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950 animate-pulse" />
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="text-sm font-black bg-gradient-to-r from-cyan-200 via-white to-pink-200 bg-clip-text text-transparent">
                Katalog Produk Live
              </h3>
              <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-500/90 text-white border border-white/30">
                <span className="w-1 h-1 rounded-full bg-white animate-pulse" /> LIVE
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px]">
              <span className="text-emerald-300 font-bold flex items-center gap-0.5">
                <Eye className="w-2.5 h-2.5" />
                <motion.span key={viewers} initial={{ opacity: 0, y: -3 }} animate={{ opacity: 1, y: 0 }} className="tabular-nums">
                  {viewers}
                </motion.span>
                <span className="text-white/60">menonton</span>
              </span>
              <span className="text-white/40">•</span>
              <span className="text-cyan-300 font-bold tabular-nums">{inStockProducts}/{totalProducts} ready</span>
            </div>
          </div>

          {/* Stock badge */}
          <motion.div
            className="relative shrink-0"
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-500 blur-md opacity-70" />
            <div className="relative rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 px-2.5 py-1.5 border-2 border-white/40">
              <p className="text-[8px] font-black text-white/90 leading-none uppercase tracking-wider">Tersedia</p>
              <p className="text-lg font-black text-white leading-none tabular-nums drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                {stockPct}%
              </p>
            </div>
          </motion.div>
        </div>

        {/* Quick stat pills */}
        <div className="relative grid grid-cols-3 gap-2">
          <motion.div
            whileHover={{ y: -2 }}
            className="relative rounded-xl p-2 bg-gradient-to-br from-cyan-500/25 to-blue-500/15 border border-cyan-300/40 overflow-hidden"
          >
            <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-cyan-500/40 blur-xl" />
            <div className="relative flex items-center gap-1">
              <Package className="w-3 h-3 text-cyan-300" />
              <p className="text-[8px] font-black text-cyan-200 uppercase tracking-wider">Total</p>
            </div>
            <p className="relative text-base font-black text-white tabular-nums leading-tight mt-0.5">
              {totalProducts}
            </p>
          </motion.div>

          <motion.div
            whileHover={{ y: -2 }}
            className="relative rounded-xl p-2 bg-gradient-to-br from-pink-500/25 to-rose-500/15 border border-pink-300/40 overflow-hidden"
          >
            <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full bg-pink-500/40 blur-xl" />
            <div className="relative flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-pink-300" />
              <p className="text-[8px] font-black text-pink-200 uppercase tracking-wider">Baru</p>
            </div>
            <p className="relative text-base font-black text-white tabular-nums leading-tight mt-0.5">
              {newProducts}
            </p>
          </motion.div>

          <motion.div
            whileHover={{ y: -2 }}
            className="relative rounded-xl p-2 bg-gradient-to-br from-amber-500/25 to-orange-500/15 border border-amber-300/40 overflow-hidden"
          >
            <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-amber-500/40 blur-xl" />
            <div className="relative flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-amber-300" />
              <p className="text-[8px] font-black text-amber-200 uppercase tracking-wider">Trending</p>
            </div>
            <p className="relative text-[11px] font-black text-white leading-tight mt-0.5 truncate">
              {topCategory || "Semua"}
            </p>
          </motion.div>
        </div>

        {/* Rotating ticker */}
        <div className="relative mt-2.5 rounded-xl bg-white/5 border border-white/10 px-2.5 py-1.5 overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-cyan-400 via-pink-400 to-purple-500" />
          <div className="relative h-4 overflow-hidden flex items-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={tickerIdx}
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -14, opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="flex items-center gap-1.5"
              >
                <TickerIcon className={`w-3 h-3 ${tickers[tickerIdx].color}`} />
                <span className="text-[11px] font-black text-white whitespace-nowrap">
                  {tickers[tickerIdx].text}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
