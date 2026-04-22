import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Coins, Gem, Zap, Diamond, Rocket, Gift, Shield } from "lucide-react";
import MembershipShop from "./MembershipShop";
import PowerPackShop from "./PowerPackShop";
import MembershipExtrasShop from "./MembershipExtrasShop";

interface Props {
  visitorId: string;
}

const SLIDES = [
  { key: "coin", label: "Coin", icon: Coins, grad: "from-yellow-400 via-amber-400 to-orange-500", glow: "shadow-amber-500/50" },
  { key: "gem", label: "Gem", icon: Gem, grad: "from-cyan-400 via-sky-400 to-blue-500", glow: "shadow-cyan-500/50" },
  { key: "power", label: "Power", icon: Zap, grad: "from-pink-400 via-fuchsia-500 to-purple-600", glow: "shadow-fuchsia-500/50", badge: "NEW" },
  { key: "diamond", label: "Diamond", icon: Diamond, grad: "from-cyan-300 via-sky-400 to-indigo-500", glow: "shadow-sky-500/50", badge: "VIP" },
  { key: "boost", label: "Boost", icon: Rocket, grad: "from-orange-400 via-pink-500 to-purple-600", glow: "shadow-pink-500/50", badge: "HOT" },
  { key: "luckybox", label: "Lucky", icon: Gift, grad: "from-emerald-400 via-teal-400 to-cyan-500", glow: "shadow-emerald-500/50" },
  { key: "saver", label: "Saver", icon: Shield, grad: "from-rose-400 via-red-500 to-orange-500", glow: "shadow-rose-500/50" },
];

export default function MembershipCarousel({ visitorId }: Props) {
  const [active, setActive] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const current = SLIDES[active];
  const next = () => setActive((p) => (p + 1) % SLIDES.length);
  const prev = () => setActive((p) => (p - 1 + SLIDES.length) % SLIDES.length);

  return (
    <div className="space-y-3">
      {/* CAROUSEL NAVIGATION */}
      <div className="relative">
        {/* Active card showcase */}
        <motion.div
          key={current.key}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", damping: 18 }}
          className="relative overflow-hidden rounded-2xl p-[2px]"
          style={{
            background: "linear-gradient(135deg, rgba(255,255,255,0.15), rgba(255,255,255,0.02))",
          }}
        >
          <div className={`relative rounded-[14px] bg-gradient-to-br ${current.grad} p-4 shadow-2xl ${current.glow}`}>
            {/* Animated glow blobs */}
            <motion.div
              animate={{ x: [0, 20, 0], y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity }}
              className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-white/30 blur-2xl"
            />
            <motion.div
              animate={{ x: [0, -15, 0], y: [0, 10, 0] }}
              transition={{ duration: 6, repeat: Infinity }}
              className="absolute -bottom-6 -left-6 w-20 h-20 rounded-full bg-white/20 blur-2xl"
            />

            <div className="relative flex items-center justify-between gap-3">
              <button
                onClick={prev}
                className="w-9 h-9 rounded-full bg-black/30 backdrop-blur flex items-center justify-center text-white hover:bg-black/50 active:scale-95 transition shrink-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex-1 text-center">
                <motion.div
                  animate={{ rotate: [0, 8, -8, 0], scale: [1, 1.1, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="inline-flex w-14 h-14 rounded-2xl bg-white/25 backdrop-blur items-center justify-center mb-1.5 shadow-lg"
                >
                  <current.icon className="w-7 h-7 text-white drop-shadow-lg" />
                </motion.div>
                <h3 className="text-xl font-black text-white drop-shadow uppercase tracking-wider flex items-center justify-center gap-1.5">
                  {current.label}
                  {current.badge && (
                    <span className="text-[9px] bg-white/30 backdrop-blur text-white px-1.5 py-0.5 rounded font-black animate-pulse">
                      {current.badge}
                    </span>
                  )}
                </h3>
                <p className="text-[10px] text-white/80 mt-0.5 uppercase tracking-widest">
                  {active + 1} / {SLIDES.length} · Membership
                </p>
              </div>

              <button
                onClick={next}
                className="w-9 h-9 rounded-full bg-black/30 backdrop-blur flex items-center justify-center text-white hover:bg-black/50 active:scale-95 transition shrink-0"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Dots indicator */}
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {SLIDES.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setActive(i)}
              className={`transition-all duration-300 rounded-full ${
                i === active
                  ? `h-1.5 w-6 bg-gradient-to-r ${s.grad}`
                  : "h-1.5 w-1.5 bg-white/30 hover:bg-white/50"
              }`}
            />
          ))}
        </div>

        {/* Mini chip rail */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide mt-2 pb-1 -mx-1 px-1">
          {SLIDES.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setActive(i)}
              className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${
                i === active
                  ? `bg-gradient-to-r ${s.grad} text-white border-white/40 shadow-lg ${s.glow}`
                  : "bg-black/30 text-white/70 border-white/10 hover:border-white/30"
              }`}
            >
              <s.icon className="w-3 h-3" />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* CONTENT — swipe on mobile */}
      <div
        onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchStart === null) return;
          const diff = touchStart - e.changedTouches[0].clientX;
          if (Math.abs(diff) > 60) {
            diff > 0 ? next() : prev();
          }
          setTouchStart(null);
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={current.key}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
          >
            {current.key === "coin" && <MembershipShop key={`mship-coin-${visitorId}`} visitorId={visitorId} category="coin" />}
            {current.key === "gem" && <MembershipShop key={`mship-gem-${visitorId}`} visitorId={visitorId} category="gem" />}
            {current.key === "power" && <PowerPackShop key={`pp-${visitorId}`} visitorId={visitorId} />}
            {current.key === "diamond" && <MembershipExtrasShop key={`de-${visitorId}`} visitorId={visitorId} kind="diamond" />}
            {current.key === "boost" && <MembershipExtrasShop key={`bo-${visitorId}`} visitorId={visitorId} kind="boost" />}
            {current.key === "luckybox" && <MembershipExtrasShop key={`lb-${visitorId}`} visitorId={visitorId} kind="luckybox" />}
            {current.key === "saver" && <MembershipExtrasShop key={`sv-${visitorId}`} visitorId={visitorId} kind="saver" />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
