import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  show: boolean;
  message?: string;
  onComplete?: () => void;
}

const COLORS = ["#fbbf24", "#ec4899", "#a855f7", "#06b6d4", "#10b981", "#f97316", "#ef4444"];

export default function CelebrationOverlay({ show, message = "🎉 LUAR BIASA!", onComplete }: Props) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; color: string; delay: number; rotate: number }>>([]);

  useEffect(() => {
    if (show) {
      const arr = Array.from({ length: 80 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 0.5,
        rotate: Math.random() * 720,
      }));
      setParticles(arr);
      const timer = setTimeout(() => onComplete?.(), 3500);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] pointer-events-none flex items-center justify-center overflow-hidden"
        >
          {/* Confetti */}
          {particles.map(p => (
            <motion.div
              key={p.id}
              initial={{ y: -100, x: `${p.x}vw`, rotate: 0, opacity: 1 }}
              animate={{ y: "110vh", rotate: p.rotate, opacity: [1, 1, 0] }}
              transition={{ duration: 2.5 + Math.random(), delay: p.delay, ease: "easeIn" }}
              className="absolute w-3 h-4 rounded-sm"
              style={{ background: p.color, boxShadow: `0 0 12px ${p.color}` }}
            />
          ))}

          {/* Fireworks */}
          {[...Array(5)].map((_, i) => (
            <motion.div
              key={`fw-${i}`}
              className="absolute w-2 h-2 rounded-full"
              style={{
                left: `${20 + i * 15}%`,
                top: `${30 + (i % 2) * 20}%`,
                background: COLORS[i % COLORS.length],
                boxShadow: `0 0 60px 30px ${COLORS[i % COLORS.length]}`,
              }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.5, 0], opacity: [0, 1, 0] }}
              transition={{ duration: 1.2, delay: i * 0.3, repeat: 1 }}
            />
          ))}

          {/* Message */}
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: [0, 1.3, 1], rotate: [-10, 5, 0] }}
            transition={{ type: "spring", damping: 12, delay: 0.2 }}
            className="relative z-10 text-center pointer-events-auto"
          >
            <div className="text-5xl md:text-7xl font-black bg-gradient-to-r from-yellow-300 via-pink-400 to-purple-500 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(236,72,153,0.8)]">
              {message}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
