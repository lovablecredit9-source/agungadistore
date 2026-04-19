import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Coins, Flame, Gift, Trophy, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface FeedItem {
  id: string;
  icon: any;
  color: string;
  text: string;
}

function maskId(id: string) {
  if (!id) return "?????";
  return id.slice(0, 4) + "···" + id.slice(-2);
}

// Templates pulled from real streak events but anonymized
const TEMPLATES = [
  { icon: Flame, color: "text-orange-300", fmt: (n: string, v: number) => `${n} capai 🔥 ${v} hari beruntun!` },
  { icon: Coins, color: "text-yellow-300", fmt: (n: string, v: number) => `${n} klaim +${v} koin streak` },
  { icon: Gift, color: "text-pink-300", fmt: (n: string) => `${n} buka Mystery Box & dapat reward 💎` },
  { icon: Trophy, color: "text-amber-300", fmt: (n: string, v: number) => `${n} naik ke posisi #${v} leaderboard!` },
  { icon: Zap, color: "text-cyan-300", fmt: (n: string) => `${n} aktifkan Power Surge x2 ⚡` },
];

export default function LiveActivityTicker() {
  const [items, setItems] = useState<FeedItem[]>([]);

  useEffect(() => {
    let mounted = true;
    let pool: any[] = [];

    const refreshPool = async () => {
      try {
        const { data } = await supabase
          .from("daily_streaks")
          .select("visitor_id, current_streak, total_claims")
          .order("updated_at", { ascending: false })
          .limit(40);
        pool = data ?? [];
      } catch { /* noop */ }
    };

    const tick = () => {
      if (!mounted || pool.length === 0) return;
      const row: any = pool[Math.floor(Math.random() * pool.length)];
      const tpl = TEMPLATES[Math.floor(Math.random() * TEMPLATES.length)];
      const name = maskId(row.visitor_id);
      const v = row.current_streak || row.total_claims || Math.floor(Math.random() * 10) + 1;
      const item: FeedItem = {
        id: `${Date.now()}-${Math.random()}`,
        icon: tpl.icon,
        color: tpl.color,
        text: tpl.fmt(name, v),
      };
      setItems(prev => [item, ...prev].slice(0, 5));
    };

    refreshPool().then(tick);
    const t1 = setInterval(refreshPool, 60_000);
    const t2 = setInterval(tick, 2800);
    return () => { mounted = false; clearInterval(t1); clearInterval(t2); };
  }, []);

  return (
    <div className="cyber-card rounded-2xl p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
          <Activity className="w-4 h-4 text-emerald-300" strokeWidth={2.5} />
        </motion.div>
        <span className="text-[11px] font-black neon-text-cyan tracking-widest uppercase">Live Activity Feed</span>
        <span className="ml-auto text-[9px] font-bold text-emerald-300/80 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
        </span>
      </div>
      <div className="space-y-1 min-h-[120px]">
        <AnimatePresence initial={false}>
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <motion.div
                key={it.id}
                layout
                initial={{ opacity: 0, x: -16, scale: 0.95 }}
                animate={{ opacity: 1 - i * 0.15, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-black/40 border border-white/5"
              >
                <Icon className={`w-3.5 h-3.5 ${it.color} shrink-0`} strokeWidth={2.5} />
                <span className="text-[10px] font-bold text-white/85 truncate">{it.text}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
