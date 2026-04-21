import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Coins, Heart, Star, Gem, Loader2 } from "lucide-react";

interface Props {
  visitorId: string;
  onUpdate?: () => void;
}

const WISHES = [
  { id: "lucky", icon: "🍀", label: "Keberuntungan", color: "from-emerald-500 to-teal-500", rewards: ["+5 koin", "+15 koin", "+25 koin", "+40 koin", "🎁 Mystery"] },
  { id: "fortune", icon: "💰", label: "Kekayaan", color: "from-amber-500 to-yellow-500", rewards: ["+10 koin", "+20 koin", "+35 koin", "+60 koin", "💎 Gem"] },
  { id: "love", icon: "💖", label: "Cinta", color: "from-pink-500 to-rose-500", rewards: ["+8 koin", "+18 koin", "+30 koin", "+50 koin", "🌟 Star"] },
  { id: "power", icon: "⚡", label: "Kekuatan", color: "from-purple-500 to-fuchsia-500", rewards: ["+12 koin", "+22 koin", "+38 koin", "+55 koin", "🔥 Boost"] },
];

const REWARD_VALUES = [5, 15, 25, 40, 100];

function getTodayKey() {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

export default function StreakWishingWell({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const today = getTodayKey();
  const wishKey = `wish-well-${visitorId}-${today}`;
  const totalKey = `wish-well-total-${visitorId}`;

  const [usedToday, setUsedToday] = useState<string[]>([]);
  const [totalCoins, setTotalCoins] = useState(0);
  const [throwing, setThrowing] = useState(false);
  const [result, setResult] = useState<{ wish: typeof WISHES[number]; tier: number; reward: string } | null>(null);
  const [ripples, setRipples] = useState<{ id: number }[]>([]);

  useEffect(() => {
    try {
      setUsedToday(JSON.parse(localStorage.getItem(wishKey) || "[]"));
      setTotalCoins(Number(localStorage.getItem(totalKey) || "0"));
    } catch {}
  }, [wishKey, totalKey]);

  function throwCoin(wish: typeof WISHES[number]) {
    if (usedToday.includes(wish.id) || throwing) return;
    setThrowing(true);
    const rid = Date.now();
    setRipples((r) => [...r, { id: rid }]);
    setTimeout(() => setRipples((r) => r.filter((x) => x.id !== rid)), 1500);

    setTimeout(() => {
      // Weighted random: 40% tier1, 30% tier2, 18% tier3, 9% tier4, 3% tier5
      const r = Math.random() * 100;
      let tier = 0;
      if (r < 40) tier = 0;
      else if (r < 70) tier = 1;
      else if (r < 88) tier = 2;
      else if (r < 97) tier = 3;
      else tier = 4;

      const reward = wish.rewards[tier];
      const value = REWARD_VALUES[tier];
      const newUsed = [...usedToday, wish.id];
      const newTotal = totalCoins + value;
      setUsedToday(newUsed);
      setTotalCoins(newTotal);
      localStorage.setItem(wishKey, JSON.stringify(newUsed));
      localStorage.setItem(totalKey, String(newTotal));
      // Track to bonus log
      try {
        const bonusKey = `dcr-bonus-${visitorId}`;
        const cur = Number(localStorage.getItem(bonusKey) || "0");
        localStorage.setItem(bonusKey, String(cur + value));
      } catch {}

      setResult({ wish, tier, reward });
      setThrowing(false);
      onUpdate?.();
    }, 1300);
  }

  const remaining = WISHES.length - usedToday.length;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-cyan-500/15 via-blue-500/15 to-indigo-500/15 border-2 border-cyan-400/40 p-3 sm:p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-cyan-300 animate-pulse" />
          <h3 className="font-bold text-base sm:text-lg bg-gradient-to-r from-cyan-200 via-blue-200 to-indigo-200 bg-clip-text text-transparent">
            Sumur Permohonan
          </h3>
          <Badge className="bg-cyan-500/40 text-cyan-100 border-cyan-400/60 text-[9px] h-4">{remaining} koin tersisa</Badge>
        </div>
        <div className="flex items-center gap-1 text-xs text-amber-300 font-bold">
          <Coins className="h-3.5 w-3.5" /> {totalCoins}
        </div>
      </div>

      {/* Animated well */}
      <div className="relative mx-auto w-32 h-32 mb-3">
        <div className="absolute inset-0 rounded-full bg-gradient-to-b from-blue-900/60 via-blue-600/40 to-cyan-400/30 border-4 border-stone-600/60 shadow-inner overflow-hidden">
          <motion.div
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-x-0 top-1/3 h-2/3 bg-gradient-to-b from-cyan-400/40 to-blue-600/60"
          />
          <AnimatePresence>
            {ripples.map((r) => (
              <motion.div
                key={r.id}
                initial={{ scale: 0.2, opacity: 0.8 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 1.4 }}
                className="absolute inset-0 m-auto w-12 h-12 rounded-full border-2 border-white/80"
              />
            ))}
          </AnimatePresence>
        </div>
        <Sparkles className="absolute -top-2 -right-2 h-5 w-5 text-yellow-300 animate-pulse" />
        <Sparkles className="absolute -bottom-1 -left-1 h-4 w-4 text-cyan-200 animate-pulse" />
      </div>

      <p className="text-center text-[11px] text-cyan-100/90 mb-2">
        Lempar koin keberuntungan ke 4 sumur berbeda. Tiap sumur sekali per hari.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {WISHES.map((w) => {
          const used = usedToday.includes(w.id);
          return (
            <motion.button
              key={w.id}
              whileTap={{ scale: 0.96 }}
              disabled={used || throwing}
              onClick={() => throwCoin(w)}
              className={`rounded-xl p-2.5 text-center bg-gradient-to-br ${w.color} bg-opacity-20 border-2 ${used ? "border-white/10 opacity-50" : "border-white/30 hover:border-white/50"} relative overflow-hidden`}
            >
              <div className="text-2xl mb-1">{w.icon}</div>
              <p className="font-bold text-[11px] text-white">{w.label}</p>
              <p className="text-[9px] text-white/70">{used ? "✓ Sudah dilempar" : "Tap untuk lempar"}</p>
              {throwing && !used && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Result modal */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setResult(null)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.6, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.6 }}
              onClick={(e) => e.stopPropagation()}
              className={`relative max-w-xs w-full rounded-3xl bg-gradient-to-br ${result.wish.color} bg-opacity-30 border-2 border-white/40 p-6 text-center shadow-2xl`}
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-6xl mb-3"
              >
                {result.wish.icon}
              </motion.div>
              <Badge className="bg-white/30 text-white border-white/40 mb-2 text-[10px]">
                {result.tier === 4 ? "🌟 LEGENDARY" : result.tier === 3 ? "💎 EPIC" : result.tier === 2 ? "💙 RARE" : "✨ COMMON"}
              </Badge>
              <p className="font-black text-xl text-white mb-1">{result.reward}</p>
              <p className="text-xs text-white/90 mb-4">Permohonan {result.wish.label.toLowerCase()} dikabulkan!</p>
              <Button onClick={() => setResult(null)} className="w-full bg-white/20 hover:bg-white/30 text-white border border-white/30 font-bold">
                <Heart className="h-4 w-4 mr-1" /> Terima Berkah
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
