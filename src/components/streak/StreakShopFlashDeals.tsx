import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Clock, Tag, Zap, Sparkles, ShoppingBag, Crown, Gift } from "lucide-react";

interface Deal {
  id: string;
  name: string;
  description: string;
  originalPrice: number; // coins
  discountPct: number;
  icon: any;
  iconColor: string;
  gradient: string;
  badge?: string;
}

const DEALS: Deal[] = [
  {
    id: "flash-freeze",
    name: "Streak Freeze x3",
    description: "Lindungi streak 3 hari",
    originalPrice: 600,
    discountPct: 50,
    icon: Sparkles,
    iconColor: "text-cyan-300",
    gradient: "from-cyan-500/30 to-blue-500/30",
    badge: "🔥 HOT",
  },
  {
    id: "flash-xp",
    name: "Double XP 24 Jam",
    description: "Gandakan poin streak",
    originalPrice: 1200,
    discountPct: 60,
    icon: Zap,
    iconColor: "text-yellow-300",
    gradient: "from-yellow-500/30 to-orange-500/30",
    badge: "⚡ BEST",
  },
  {
    id: "flash-mystery",
    name: "Mystery Bundle",
    description: "5 reward acak rare+",
    originalPrice: 1500,
    discountPct: 70,
    icon: Gift,
    iconColor: "text-pink-300",
    gradient: "from-pink-500/30 to-purple-500/30",
    badge: "👑 PREMIUM",
  },
  {
    id: "flash-vip",
    name: "VIP Pass Mingguan",
    description: "Akses semua fitur premium",
    originalPrice: 3000,
    discountPct: 40,
    icon: Crown,
    iconColor: "text-yellow-300",
    gradient: "from-yellow-500/30 to-amber-600/30",
    badge: "💎 VIP",
  },
];

function fmt(ms: number) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export default function StreakShopFlashDeals() {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Flash deals reset every 8 hours
  const cycleEnd = useMemo(() => {
    const cycle = 8 * 3600 * 1000;
    return Math.ceil(Date.now() / cycle) * cycle;
  }, []);

  const remaining = cycleEnd - now;
  const isUrgent = remaining < 30 * 60 * 1000; // last 30 min

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border-2 border-orange-500/50 p-4 bg-gradient-to-br from-red-950 via-orange-950 to-yellow-950 shadow-[0_0_30px_rgba(249,115,22,0.35)]"
    >
      <motion.div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-orange-500/30 blur-3xl"
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 3.5, repeat: Infinity }}
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Flame className="w-6 h-6 text-orange-400 drop-shadow-[0_0_10px_rgba(249,115,22,0.9)]" strokeWidth={2.5} />
            </motion.div>
            <div>
              <div className="text-[10px] font-black tracking-widest text-orange-300 uppercase">⚡ FLASH DEALS</div>
              <div className="text-base font-black text-white">Diskon Kilat 8 Jam</div>
            </div>
          </div>

          <motion.div
            animate={isUrgent ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.8, repeat: Infinity }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border ${
              isUrgent ? "bg-red-500/40 border-red-400 text-red-100" : "bg-black/40 border-orange-400/40 text-orange-200"
            }`}
          >
            <Clock className="w-3 h-3" strokeWidth={2.5} />
            <span className="text-[10px] font-black tabular-nums">{fmt(remaining)}</span>
          </motion.div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <AnimatePresence>
            {DEALS.map((deal, i) => {
              const finalPrice = Math.floor(deal.originalPrice * (1 - deal.discountPct / 100));
              return (
                <motion.div
                  key={deal.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.08 }}
                  className={`relative overflow-hidden rounded-xl p-2.5 bg-gradient-to-br ${deal.gradient} border border-white/20`}
                >
                  {deal.badge && (
                    <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur">
                      <span className="text-[8px] font-black text-white">{deal.badge}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 mb-2">
                    <deal.icon className={`w-5 h-5 ${deal.iconColor} flex-shrink-0`} strokeWidth={2.5} />
                    <div className="min-w-0">
                      <div className="text-[11px] font-black text-white truncate">{deal.name}</div>
                      <div className="text-[9px] text-white/70 truncate">{deal.description}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[9px] text-white/50 line-through tabular-nums">{deal.originalPrice}</div>
                      <div className="text-sm font-black text-yellow-200 tabular-nums">{finalPrice}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[9px] font-black flex items-center gap-0.5">
                        <Tag className="w-2.5 h-2.5" strokeWidth={3} />
                        -{deal.discountPct}%
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5 p-2 rounded-lg bg-black/30 border border-orange-400/20">
          <ShoppingBag className="w-3.5 h-3.5 text-orange-300" strokeWidth={2.5} />
          <span className="text-[10px] text-orange-200/90 font-bold">Beli via item Streak Shop di bawah</span>
        </div>
      </div>
    </motion.div>
  );
}
