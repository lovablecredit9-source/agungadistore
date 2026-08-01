import { AnimatePresence, motion } from "framer-motion";

export interface RevealPrize {
  label: string;
  emoji: string;
  rarity: string;
}

const RARITY_META: Record<string, { grad: string; text: string; title: string }> = {
  common: { grad: "from-slate-500 to-slate-700", text: "text-slate-100", title: "DAPAT!" },
  rare: { grad: "from-cyan-400 to-blue-600", text: "text-cyan-100", title: "RARE!" },
  epic: { grad: "from-fuchsia-500 to-purple-700", text: "text-fuchsia-100", title: "EPIC!" },
  legendary: { grad: "from-amber-300 via-orange-500 to-rose-500", text: "text-amber-100", title: "LEGENDARY!" },
  mythic: { grad: "from-rose-400 via-red-500 to-yellow-400", text: "text-rose-50", title: "MYTHIC JACKPOT!" },
};

interface Props {
  prizes: RevealPrize[] | null;
  onClose: () => void;
}

export default function WinRevealOverlay({ prizes, onClose }: Props) {
  const top = prizes?.[0];
  const meta = RARITY_META[top?.rarity || "common"] || RARITY_META.common;
  const big = top && (top.rarity === "legendary" || top.rarity === "mythic");

  return (
    <AnimatePresence>
      {prizes && top && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[130] flex items-center justify-center p-5 bg-black/85 backdrop-blur-md"
        >
          {big &&
            Array.from({ length: 18 }).map((_, i) => (
              <motion.span
                key={i}
                className="absolute text-lg pointer-events-none"
                initial={{ opacity: 0, y: 0, x: 0, scale: 0.5 }}
                animate={{
                  opacity: [0, 1, 0],
                  y: [0, -140 - Math.random() * 160],
                  x: [(Math.random() - 0.5) * 260, (Math.random() - 0.5) * 340],
                  rotate: Math.random() * 360,
                  scale: [0.5, 1.1, 0.7],
                }}
                transition={{ duration: 1.8 + Math.random(), repeat: Infinity, delay: Math.random() * 1.2 }}
              >
                {["✨", "🎉", "💎", "⭐", "🔥"][i % 5]}
              </motion.span>
            ))}

          <motion.div
            initial={{ scale: 0.7, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", stiffness: 280, damping: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xs text-center"
          >
            <motion.div
              className={`absolute inset-0 -z-10 rounded-[2rem] blur-3xl bg-gradient-to-br ${meta.grad} opacity-50`}
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 2.2, repeat: Infinity }}
            />
            <div className={`rounded-[2rem] border border-white/20 bg-[#0a0712]/95 p-5 shadow-2xl`}>
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 1.6, repeat: Infinity }}
                className={`inline-block px-3 py-1 rounded-full text-[9px] font-black tracking-[0.25em] bg-gradient-to-r ${meta.grad} text-white shadow-lg`}
              >
                {meta.title}
              </motion.div>

              <motion.div
                initial={{ rotate: -12, scale: 0.5 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 12 }}
                className="mt-4 text-6xl drop-shadow-[0_0_25px_rgba(255,255,255,.45)]"
              >
                {top.emoji}
              </motion.div>

              <div className={`mt-3 text-lg font-black leading-tight ${meta.text}`}>{top.label}</div>

              {prizes.length > 1 && (
                <div className="mt-3 grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
                  {prizes.slice(1).map((p, i) => (
                    <div key={i} className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5 text-left">
                      <div className="text-[10px] font-black text-white/85 truncate">{p.emoji} {p.label}</div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={onClose}
                className={`mt-4 w-full h-11 rounded-2xl text-[11px] font-black text-white bg-gradient-to-r ${meta.grad} shadow-lg active:scale-95 transition-all`}
              >
                MANTAP, LANJUT!
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
