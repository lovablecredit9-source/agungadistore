import { useEffect, useState, useCallback } from "react";
import { Heart, Lightbulb, Clock, Zap, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import {
  loadPowerUps, consumePowerUp, isDoubleXPActive, syncPowerUpsFromServer,
  type PowerUpsState,
} from "./gameStore";

interface Props {
  /** Dipanggil saat user pakai Nyawa Ekstra. (Sekarang HANYA dipakai lewat ReviveButton saat game over) */
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
 * Bar power-up yang muncul DI DALAM game (saat masih main).
 * Sekarang HANYA menampilkan Hint & Time Freeze. Nyawa Ekstra dipindah ke
 * ReviveButton yang muncul saat Game Over (lihat <ReviveButton/>).
 *
 * Filosofi: nyawa ekstra adalah "kesempatan kedua" — hanya boleh dipakai
 * setelah benar-benar kalah, bukan dipakai sembarangan saat masih hidup.
 */
export default function PowerUpsBar({ onUseHint, onUseTimeFreeze, compact, enabled = true }: Props) {
  const { toast } = useToast();
  const [pu, setPu] = useState<PowerUpsState>(() => loadPowerUps());
  const [doubleXp, setDoubleXp] = useState(isDoubleXPActive());

  const refresh = useCallback(() => {
    setPu(loadPowerUps());
    setDoubleXp(isDoubleXPActive());
  }, []);

  const syncRefresh = useCallback(async () => {
    const fresh = await syncPowerUpsFromServer();
    setPu(fresh);
    setDoubleXp(isDoubleXPActive());
  }, []);

  useEffect(() => {
    refresh();
    syncRefresh(); // sinkron dari server saat mount
    const onFocus = () => syncRefresh();
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith("streak_powerups_")) refresh();
    };
    const onPuUpdated = () => syncRefresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("storage", onStorage);
    window.addEventListener("power-ups-updated", onPuUpdated);
    const t = setInterval(refresh, 5000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("power-ups-updated", onPuUpdated);
      clearInterval(t);
    };
  }, [refresh, syncRefresh]);

  function tryUse(kind: "auto_hint" | "time_freeze", cb?: (() => void) | ((s: number) => void)) {
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
      title: kind === "auto_hint" ? "💡 Hint dibuka!" : "⏱️ +30 detik!",
    });
  }

  const items = ([
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
              title={empty ? `${it.label} habis - beli di Streak Shop` : `Pakai ${it.label}`}
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

/**
 * Tombol "Hidup Lagi" yang muncul HANYA di layar Game Over.
 * Mengkonsumsi 1 Nyawa Ekstra dan memanggil onRevive() supaya game
 * mereset wrongCount & melanjutkan soal yang sama.
 */
export function ReviveButton({ onRevive }: { onRevive: () => void }) {
  const { toast } = useToast();
  const [pu, setPu] = useState<PowerUpsState>(() => loadPowerUps());

  useEffect(() => {
    setPu(loadPowerUps());
    syncPowerUpsFromServer().then(setPu);
  }, []);

  const count = pu.extra_life || 0;
  if (count <= 0) {
    return (
      <div className="flex flex-col items-center gap-1 mt-2">
        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
          <ShoppingBag className="w-3 h-3" /> Punya Nyawa Ekstra? Tukar di Streak Shop untuk hidup lagi
        </span>
      </div>
    );
  }

  const handleClick = () => {
    const ok = consumePowerUp("extra_life");
    if (!ok) {
      setPu(loadPowerUps());
      return;
    }
    setPu(loadPowerUps());
    toast({ title: "❤️ Hidup Lagi!", description: "Lanjutkan soal yang sama." });
    onRevive();
  };

  return (
    <motion.button
      type="button"
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileTap={{ scale: 0.94 }}
      onClick={handleClick}
      className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-extrabold text-white shadow-md bg-gradient-to-r from-red-500 to-pink-600 hover:shadow-lg hover:scale-105 ring-1 ring-white/20 transition-all"
      title="Pakai Nyawa Ekstra untuk hidup lagi"
    >
      <Heart className="w-4 h-4 fill-white/40" strokeWidth={2.5} />
      Hidup Lagi
      <span className="min-w-[20px] text-center rounded-full px-1.5 py-0.5 text-[10px] font-black bg-white/30">
        {count}
      </span>
    </motion.button>
  );
}
