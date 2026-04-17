import { motion } from "framer-motion";
import { Shield, Snowflake, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  freezeCount: number;
  onBuy: () => void;
  buying: boolean;
  isStreakAtRisk: boolean;
}

export default function StreakFreezeCard({ freezeCount, onBuy, buying, isStreakAtRisk }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.22 }}
      className="glass-card-strong rounded-2xl border p-4 space-y-3 relative overflow-hidden"
    >
      {/* Cool ice background effect */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: `${15 + i * 15}%`,
              top: `${10 + (i % 3) * 30}%`,
            }}
            animate={{
              y: [0, 8, 0],
              opacity: [0.3, 0.6, 0.3],
              rotate: [0, 360],
            }}
            transition={{
              duration: 4 + i,
              repeat: Infinity,
              delay: i * 0.5,
            }}
          >
            <Snowflake className="w-4 h-4 text-cyan-400" />
          </motion.div>
        ))}
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-500" /> Streak Freeze
          </h4>
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/40"
          >
            <Snowflake className="w-3 h-3 text-white" />
            <span className="text-xs font-extrabold text-white">{freezeCount}</span>
          </motion.div>
        </div>

        <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
          Pelindung anti-putus streak. Otomatis terpakai jika kamu lupa klaim sehari! 🛡️
        </p>

        {isStreakAtRisk && freezeCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-cyan-500/15 border border-cyan-500/30 rounded-lg p-2 mb-3 text-[10px] text-cyan-700 dark:text-cyan-300 font-bold flex items-center gap-1.5"
          >
            <Shield className="w-3 h-3 shrink-0" />
            <span>Streak kamu terlindungi! Pelindung akan terpakai otomatis.</span>
          </motion.div>
        )}

        <Button
          onClick={onBuy}
          disabled={buying}
          variant="outline"
          className="w-full h-10 gap-2 border-cyan-500/40 hover:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold"
        >
          {buying ? (
            <span className="flex items-center gap-1.5"><Snowflake className="w-4 h-4 animate-spin" /> Memproses...</span>
          ) : (
            <>
              <Plus className="w-4 h-4" /> Beli Pelindung (Rp 5.000)
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
