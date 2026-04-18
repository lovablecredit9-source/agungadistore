import { useEffect, useState, useCallback } from "react";
import { Heart, Lightbulb, Clock, Zap, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import {
  loadPowerUps, consumePowerUp, isDoubleXPActive,
  type PowerUpsState,
} from "./gameStore";

interface Props {
  /** Dipanggil saat user pakai Nyawa Ekstra. Game harus mengurangi wrongCount -1. */
  onUseExtraLife?: () => void;
  /** Dipanggil saat user pakai Hint. Game harus reveal hint berikutnya. */
  onUseHint?: () => void;
  /** Dipanggil saat user pakai Time Freeze. Game harus tambah waktu (default 30 detik). */
  onUseTimeFreeze?: (seconds: number) => void;
  /** Tampilkan panel ringkas (di header) atau penuh. */
  compact?: boolean;
  /** Jika false, sembunyikan tombol (mis. saat soal sedang loading). */
  enabled?: boolean;
}

/**
 * Bar power-up yang muncul DI DALAM game.
 * Membaca jumlah power-up dari localStorage (yang ditambahkan saat redeem di Streak Shop)
 * lalu mengonsumsinya saat tombol diklik dan memanggil callback supaya game memberi efek
 * (kurangi wrongCount, tambah hint, tambah waktu, dst).
 */
export default function PowerUpsBar({ onUseExtraLife, onUseHint, onUseTimeFreeze, compact, enabled = true }: Props) {
  const { toast } = useToast();
  const [pu, setPu] = useState<PowerUpsState>(() => loadPowerUps());
  const [doubleXp, setDoubleXp] = useState(isDoubleXPActive());

  const refresh = useCallback(() => {
    setPu(loadPowerUps());
    setDoubleXp(isDoubleXPActive());
  }, []);

  // Re-load saat tab kembali aktif & saat localStorage berubah dari tab lain (mis. setelah redeem di Streak Shop)
  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith("streak_powerups_")) refresh();
    };
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    const t = setInterval(refresh, 5000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      clearInterval(t);
    };
  }, [refresh]);

  function tryUse(kind: "extra_life" | "auto_hint" | "time_freeze", cb?: (() => void) | ((s: number) => void)) {
    if (!enabled) return;
    if ((pu[kind] || 0) <= 0) {
      toast({
        title: "Power-up habis",
        description: "Beli di Streak Shop → tab Power-Up",
        variant: "destructive",
      });
      return;
    }
    const ok = consumePowerUp(kind);
    if (!ok) { refresh(); return; }
    refresh();
    if (kind === "time_freeze") (cb as (s: number) => void)?.(30);
    else (cb as () => void)?.();
    toast({
      title:
        kind === "extra_life" ? "❤️ +1 Nyawa dipakai!"
        : kind === "auto_hint" ? "💡 Hint dibuka!"
        : "⏱️ +30 detik!",
    });
  }

  const items = ([
    { id: "extra_life" as const, label: "Nyawa", Icon: Heart, cb: onUseExtraLife, show: !!onUseExtraLife, color: "from-red-500 to-pink-600" },
    { id: "auto_hint" as const, label: "Hint", Icon: Lightbulb, cb: onUseHint, show: !!onUseHint, color: "from-yellow-400 to-orange-500" },
    { id: "time_freeze" as const, label: "Freeze", Icon: Clock, cb: onUseTimeFreeze, show: !!onUseTimeFreeze, color: "from-cyan-400 to-blue-600" },
  ]).filter(x => x.show);

  if (items.length === 0 && !doubleXp) return null;

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "" : "rounded-xl bg-muted/40 p-2 border border-border/50"}`}>
      {doubleXp && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white text-[10px] font-black shadow-md"
        >
          <Zap className="w-3 h-3 fill-current" /> 2X XP
        </motion.div>
      )}
      <AnimatePresence>
        {items.map(it => {
          const count = pu[it.id] || 0;
          const empty = count <= 0;
          return (
            <motion.button
              key={it.id}
              type="button"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => tryUse(it.id, it.cb)}
              disabled={!enabled}
              className={`relative flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold text-white shadow-sm transition-all ${
                empty
                  ? "bg-muted-foreground/40 hover:bg-muted-foreground/50"
                  : `bg-gradient-to-r ${it.color} hover:shadow-md hover:scale-105 ring-1 ring-white/20`
              } ${!enabled ? "opacity-50 cursor-not-allowed" : ""}`}
              title={empty ? `${it.label} habis — beli di Streak Shop` : `Pakai ${it.label}`}
            >
              <it.Icon className={`w-3.5 h-3.5 ${empty ? "" : "fill-white/30"}`} strokeWidth={2.5} />
              <span>{it.label}</span>
              <span className={`min-w-[18px] text-center rounded-full px-1 text-[10px] font-black ${empty ? "bg-background/30" : "bg-white/30"}`}>
                {count}
              </span>
            </motion.button>
          );
        })}
      </AnimatePresence>
      {items.some(it => (pu[it.id] || 0) <= 0) && (
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
          <ShoppingBag className="w-3 h-3" /> Beli di Streak Shop
        </span>
      )}
    </div>
  );
}
