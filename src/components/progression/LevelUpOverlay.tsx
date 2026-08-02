import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, PartyPopper, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { levelTitle, levelUpReward, type AchievementDef } from "@/lib/progression";

type Payload =
  | { kind: "level"; level: number }
  | { kind: "achievement"; def: AchievementDef };

/** Overlay animasi global untuk kenaikan level & achievement terbuka. */
export default function LevelUpOverlay() {
  const [queue, setQueue] = useState<Payload[]>([]);
  const current = queue[0] || null;

  useEffect(() => {
    const onLevel = (e: Event) => {
      const lv = (e as CustomEvent).detail?.level;
      if (typeof lv === "number") setQueue((q) => [...q, { kind: "level", level: lv }]);
    };
    const onAch = (e: Event) => {
      const defs = (e as CustomEvent).detail as AchievementDef[];
      if (Array.isArray(defs)) setQueue((q) => [...q, ...defs.map((def) => ({ kind: "achievement", def } as Payload))]);
    };
    window.addEventListener("level-up", onLevel);
    window.addEventListener("achievement-unlocked", onAch);
    return () => {
      window.removeEventListener("level-up", onLevel);
      window.removeEventListener("achievement-unlocked", onAch);
    };
  }, []);

  const close = () => setQueue((q) => q.slice(1));

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.kind === "level" ? `lv-${current.level}` : `ach-${current.def.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[120] flex items-center justify-center bg-background/80 backdrop-blur-md p-4"
          onClick={close}
        >
          {/* Partikel */}
          {Array.from({ length: 14 }).map((_, i) => (
            <motion.span
              key={i}
              className="absolute w-2 h-2 rounded-full bg-primary"
              initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
              animate={{
                opacity: [0, 1, 0],
                x: Math.cos((i / 14) * Math.PI * 2) * 160,
                y: Math.sin((i / 14) * Math.PI * 2) * 160,
                scale: [0, 1.2, 0],
              }}
              transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.06 }}
            />
          ))}

          <motion.div
            initial={{ scale: 0.4, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", damping: 13 }}
            className="relative w-full max-w-xs rounded-3xl border bg-card p-6 text-center shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={close}
              aria-label="Tutup"
              className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-primary via-fuchsia-500 to-amber-400 opacity-20"
              animate={{ opacity: [0.12, 0.3, 0.12] }}
              transition={{ duration: 2, repeat: Infinity }}
            />

            <div className="relative space-y-4">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 9 }}
                className="text-6xl leading-none"
              >
                {current.kind === "level" ? "⭐" : current.def.emoji}
              </motion.div>

              {current.kind === "level" ? (
                <div>
                  <p className="text-[10px] font-black tracking-[0.2em] text-primary">LEVEL UP</p>
                  <h3 className="mt-1 text-2xl font-extrabold">Level {current.level}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Gelar baru: <span className="font-bold text-foreground">{levelTitle(current.level).title}</span>
                  </p>
                  <p className="mt-2 inline-flex items-center gap-1 rounded-full border bg-muted/50 px-3 py-1 text-[11px] font-bold">
                    <Sparkles className="w-3 h-3 text-amber-500" /> {levelUpReward(current.level).label}
                  </p>
                  <p className="mt-2 text-[10px] text-muted-foreground">Ambil di Pusat Hadiah</p>
                </div>
              ) : (
                <div>
                  <p className="text-[10px] font-black tracking-[0.2em] text-primary">ACHIEVEMENT TERBUKA</p>
                  <h3 className="mt-1 text-xl font-extrabold">{current.def.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{current.def.description}</p>
                  <p className="mt-2 inline-flex items-center gap-1 rounded-full border bg-muted/50 px-3 py-1 text-[11px] font-bold">
                    <Sparkles className="w-3 h-3 text-amber-500" /> {current.def.rewardGems} Gem +{" "}
                    {current.def.rewardCoins.toLocaleString("id-ID")} Koin
                  </p>
                </div>
              )}

              <Button onClick={close} className="w-full font-bold">
                Mantap <PartyPopper className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
