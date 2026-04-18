import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Zap, Coins, Loader2, Clock, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Booster {
  id: string;
  name: string;
  desc: string;
  cost: number;
  durationHours: number;
}

interface ActiveBooster {
  id: string;
  booster_type: string;
  expires_at: string;
  metadata: any;
}

interface Props {
  visitorId: string;
  coins: number;
  onUpdate?: () => void;
}

const BOOSTER_COLORS: Record<string, string> = {
  double_coins: "from-yellow-400 to-orange-500",
  auto_claim_7d: "from-emerald-400 to-teal-500",
  lucky_day: "from-pink-400 to-purple-500",
  double_streak: "from-cyan-400 to-blue-500",
};

const BOOSTER_ICONS: Record<string, string> = {
  double_coins: "💰",
  auto_claim_7d: "🤖",
  lucky_day: "🍀",
  double_streak: "⚡",
};

export default function StreakBoosters({ visitorId, coins, onUpdate }: Props) {
  const { toast } = useToast();
  const [boosters, setBoosters] = useState<Booster[]>([]);
  const [active, setActive] = useState<ActiveBooster[]>([]);
  const [activating, setActivating] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.functions.invoke("activate-booster", { body: { visitorId, action: "list" } });
    if (data) {
      setBoosters(data.boosters || []);
      setActive(data.active || []);
    }
  }

  useEffect(() => { if (visitorId) load(); /* eslint-disable-next-line */ }, [visitorId]);

  async function activate(b: Booster) {
    if (coins < b.cost) {
      toast({ title: "Koin kurang", description: `Butuh ${b.cost} koin`, variant: "destructive" });
      return;
    }
    setActivating(b.id);
    const { data, error } = await supabase.functions.invoke("activate-booster", { body: { visitorId, boosterId: b.id } });
    if (error || data?.error) {
      toast({ title: "Gagal", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: `⚡ ${b.name} aktif!`, description: b.desc });
      load();
      onUpdate?.();
    }
    setActivating(null);
  }

  function timeLeft(iso: string): string {
    const ms = new Date(iso).getTime() - Date.now();
    if (ms <= 0) return "expired";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    if (h > 24) return `${Math.floor(h / 24)}h ${h % 24}j`;
    return `${h}j ${m}m`;
  }

  const isActive = (id: string) => active.some(a => a.booster_type === id);

  if (boosters.length === 0) return null;

  return (
    <div className="cyber-card-pink rounded-2xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 icon-3d-zap" strokeWidth={2.5} />
          <span className="text-xs font-black neon-text-pink tracking-widest uppercase">Power-Up Streak</span>
        </div>
        {active.length > 0 && (
          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> {active.length} aktif
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {boosters.map(b => {
          const activeNow = isActive(b.id);
          const activeData = active.find(a => a.booster_type === b.id);
          const canBuy = coins >= b.cost;
          return (
            <motion.button
              key={b.id}
              whileTap={{ scale: 0.97 }}
              disabled={activeNow || !canBuy || activating === b.id}
              onClick={() => activate(b)}
              className={`relative p-2.5 rounded-xl border text-left transition ${
                activeNow
                  ? "bg-emerald-950/60 border-emerald-400/60"
                  : canBuy
                  ? `bg-gradient-to-br ${BOOSTER_COLORS[b.id]} border-white/30 shadow-lg`
                  : "bg-black/40 border-white/10 opacity-50"
              }`}
            >
              <div className="text-2xl mb-0.5">{BOOSTER_ICONS[b.id]}</div>
              <div className="font-extrabold text-white text-[11px] leading-tight">{b.name}</div>
              <div className="text-[9px] text-white/80 mb-1.5 line-clamp-2">{b.desc}</div>
              {activeNow && activeData ? (
                <div className="flex items-center gap-1 text-[10px] font-black text-emerald-300">
                  <Clock className="w-2.5 h-2.5" /> {timeLeft(activeData.expires_at)}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-white tabular-nums flex items-center gap-1">
                    <Coins className="w-3 h-3" /> {b.cost}
                  </span>
                  {activating === b.id && <Loader2 className="w-3 h-3 animate-spin text-white" />}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
