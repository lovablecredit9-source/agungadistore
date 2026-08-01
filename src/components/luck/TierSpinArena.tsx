import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Lock, Sparkles, Crown, Zap, Gem } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PoolItem {
  kind: string; value: number; label: string; emoji: string; rarity: string; color: string;
}
interface TierInfo {
  key: string; name: string; cost: number; limit: number; desc: string; used: number; pool: PoolItem[];
}
interface Props {
  visitorId: string;
  gems: number;
  setGems: (n: number) => void;
}

const TIER_STYLE: Record<string, { grad: string; ring: string; glow: string; icon: JSX.Element; tag: string }> = {
  S: {
    grad: "from-emerald-400 via-teal-500 to-cyan-600",
    ring: "border-emerald-400/60",
    glow: "shadow-emerald-500/40",
    icon: <Gem className="w-4 h-4" strokeWidth={3} />,
    tag: "PALING MURAH · 10 GEM",
  },
  A: {

    grad: "from-cyan-500 via-sky-500 to-blue-600",
    ring: "border-cyan-400/60",
    glow: "shadow-cyan-500/40",
    icon: <Zap className="w-4 h-4" strokeWidth={3} />,
    tag: "HADIAH KECIL · SERING",
  },
  B: {
    grad: "from-fuchsia-500 via-purple-600 to-indigo-600",
    ring: "border-fuchsia-400/60",
    glow: "shadow-fuchsia-500/40",
    icon: <Sparkles className="w-4 h-4" strokeWidth={3} />,
    tag: "HADIAH MENENGAH",
  },
  C: {
    grad: "from-amber-400 via-orange-500 to-rose-600",
    ring: "border-amber-400/70",
    glow: "shadow-amber-500/50",
    icon: <Crown className="w-4 h-4" strokeWidth={3} />,
    tag: "HADIAH BESAR · MYTHIC",
  },
};

const RARITY_COLOR: Record<string, string> = {
  common: "text-slate-300",
  rare: "text-cyan-300",
  epic: "text-fuchsia-300",
  legendary: "text-amber-300",
  mythic: "text-rose-300",
};

export default function TierSpinArena({ visitorId, gems, setGems }: Props) {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState<string | null>(null);
  const [reel, setReel] = useState<Record<string, PoolItem | null>>({});
  const [won, setWon] = useState<{ tier: string; prize: PoolItem } | null>(null);
  const [openPool, setOpenPool] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("luck-royale-nyawa", {
        body: { visitorId, action: "tier_status" },
      });
      if (error) throw error;
      if (data?.tiers) setTiers(data.tiers);
      if (typeof data?.gems === "number") setGems(data.gems);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [visitorId, setGems]);

  useEffect(() => { load(); }, [load]);

  async function spin(tier: TierInfo) {
    if (spinning) return;
    if (tier.used >= tier.limit) {
      toast({ title: "Limit habis", description: `Tier ${tier.key} reset 00:00 WIB`, variant: "destructive" });
      return;
    }
    if (gems < tier.cost) {
      toast({ title: "Gem kurang", description: `Butuh ${tier.cost} gem`, variant: "destructive" });
      return;
    }
    setSpinning(tier.key);
    setWon(null);

    // reel animation
    const interval = setInterval(() => {
      setReel((r) => ({ ...r, [tier.key]: tier.pool[Math.floor(Math.random() * tier.pool.length)] }));
    }, 70);

    try {
      const { data, error } = await supabase.functions.invoke("luck-royale-nyawa", {
        body: { visitorId, action: "tier_spin", tier: tier.key },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await new Promise((r) => setTimeout(r, 900));
      clearInterval(interval);
      setReel((r) => ({ ...r, [tier.key]: data.prize }));
      setWon({ tier: tier.key, prize: data.prize });
      if (typeof data.gems === "number") setGems(data.gems);
      setTiers((prev) => prev.map((t) => (t.key === tier.key ? { ...t, used: data.used } : t)));
      toast({ title: `🎯 Tier ${tier.key}`, description: data.prize.label });
    } catch (e) {
      clearInterval(interval);
      setReel((r) => ({ ...r, [tier.key]: null }));
      toast({ title: "Gagal", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setSpinning(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-fuchsia-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border-2 border-fuchsia-400/40 bg-gradient-to-r from-fuchsia-700/25 via-purple-700/20 to-amber-600/20 p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-black text-white tracking-widest">🎯 SPIN TERBATAS</div>
            <div className="text-[10px] text-white/70 font-bold">Tier A · B · C — kuota harian, reset 00:00 WIB</div>
          </div>
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/50 border border-cyan-400/50">
            <Gem className="w-3.5 h-3.5 text-cyan-300" />
            <span className="text-[11px] font-black text-cyan-200">{gems.toLocaleString("id-ID")}</span>
          </div>
        </div>
      </div>

      {tiers.map((t) => {
        const st = TIER_STYLE[t.key] || TIER_STYLE.A;
        const left = Math.max(0, t.limit - t.used);
        const habis = left <= 0;
        const isSpin = spinning === t.key;
        const shown = reel[t.key];
        return (
          <div key={t.key} className={`relative overflow-hidden rounded-2xl border-2 ${st.ring} bg-black/50 p-3 shadow-lg ${st.glow}`}>
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${st.grad}`} />
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br ${st.grad} text-white`}>
                    {st.icon}
                  </span>
                  <span className="text-[12px] font-black text-white tracking-wider truncate">{t.name}</span>
                </div>
                <div className="text-[9px] font-black text-white/60 mt-1 tracking-widest">{st.tag}</div>
                <div className="text-[10px] text-white/70 font-semibold mt-0.5">{t.desc}</div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className={`text-[10px] font-black px-2 py-0.5 rounded-full ${habis ? "bg-red-500/30 text-red-200" : "bg-emerald-500/25 text-emerald-200"}`}>
                  {left}/{t.limit} sisa
                </div>
                <div className="text-[11px] font-black text-cyan-200 mt-1">💎 {t.cost}</div>
              </div>
            </div>

            <div className={`relative h-16 rounded-xl border ${st.ring} bg-black/60 flex items-center justify-center overflow-hidden mb-2`}>
              <AnimatePresence mode="wait">
                {shown ? (
                  <motion.div
                    key={`${shown.label}-${isSpin ? "s" : "f"}`}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    transition={{ duration: 0.08 }}
                    className="text-center px-2"
                  >
                    <div className="text-xl leading-none">{shown.emoji}</div>
                    <div className={`text-[11px] font-black mt-1 ${RARITY_COLOR[shown.rarity] || "text-white"}`}>{shown.label}</div>
                  </motion.div>
                ) : (
                  <div className="text-[10px] font-black text-white/40 tracking-widest">TEKAN SPIN</div>
                )}
              </AnimatePresence>
              {won?.tier === t.key && !isSpin && (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`absolute top-1 right-1 text-[8px] font-black px-1.5 py-0.5 rounded bg-gradient-to-r ${st.grad} text-white`}
                >
                  MENANG!
                </motion.div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => spin(t)}
                disabled={habis || isSpin || gems < t.cost}
                className={`flex-1 h-9 text-[12px] font-black bg-gradient-to-r ${st.grad} text-white`}
              >
                {isSpin ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />MEMUTAR...</>
                ) : habis ? (
                  <><Lock className="w-3.5 h-3.5 mr-1" />LIMIT HABIS</>
                ) : (
                  <>SPIN · 💎 {t.cost}</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => setOpenPool(openPool === t.key ? null : t.key)}
                className="h-9 px-3 text-[11px] font-black border-white/20 bg-black/40 text-white"
              >
                {openPool === t.key ? "Tutup" : "Hadiah"}
              </Button>
            </div>

            {openPool === t.key && (
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {t.pool.map((p, i) => (
                  <div key={i} className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5">
                    <div className={`text-[10px] font-black ${RARITY_COLOR[p.rarity] || "text-white"}`}>{p.emoji} {p.label}</div>
                    <div className="text-[8px] font-black text-white/40 uppercase tracking-widest">{p.rarity}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
