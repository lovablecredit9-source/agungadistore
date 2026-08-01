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
  ticketType?: "normal" | "premium"; ticketCost?: number;
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
  D: {
    grad: "from-rose-500 via-red-600 to-yellow-500",
    ring: "border-rose-400/70",
    glow: "shadow-rose-500/50",
    icon: <Crown className="w-4 h-4" strokeWidth={3} />,
    tag: "SULTAN · MEGA JACKPOT",
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
  const [tickets, setTickets] = useState<{ normal: number; premium: number }>({ normal: 0, premium: 0 });
  const [payMode, setPayMode] = useState<Record<string, "gems" | "ticket">>({});
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState<string | null>(null);
  const [reel, setReel] = useState<Record<string, PoolItem | null>>({});
  const [won, setWon] = useState<{ tier: string; prize: PoolItem } | null>(null);
  const [openPool, setOpenPool] = useState<string | null>(null);
  const [multi, setMulti] = useState<Record<string, PoolItem[] | null>>({});


  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("luck-royale-nyawa", {
        body: { visitorId, action: "tier_status" },
      });
      if (error) throw error;
      if (data?.tiers) setTiers(data.tiers);
      if (data?.tickets) setTickets({ normal: data.tickets.normal || 0, premium: data.tickets.premium || 0 });
      if (typeof data?.gems === "number") setGems(data.gems);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [visitorId, setGems]);

  useEffect(() => { load(); }, [load]);

  async function spin(tier: TierInfo, count = 1) {
    if (spinning) return;
    const mode = payMode[tier.key] || "gems";
    const tType = tier.ticketType || "normal";
    const tCost = (tier.ticketCost || 1) * count;
    if (mode === "ticket") {
      if ((tickets[tType] || 0) < tCost) {
        toast({ title: "Tiket kurang", description: `Butuh ${tCost} tiket ${tType}`, variant: "destructive" });
        return;
      }
    } else if (gems < tier.cost * count) {
      toast({ title: "Gem kurang", description: `Butuh ${tier.cost * count} gem untuk x${count}`, variant: "destructive" });
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
        body: { visitorId, action: "tier_spin", tier: tier.key, count, payWith: mode },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await new Promise((r) => setTimeout(r, 900));
      clearInterval(interval);
      const list: PoolItem[] = data.prizes || [data.prize];
      setReel((r) => ({ ...r, [tier.key]: list[0] }));
      setWon({ tier: tier.key, prize: list[0] });
      setMulti((m) => ({ ...m, [tier.key]: list.length > 1 ? list : null }));
      if (typeof data.gems === "number") setGems(data.gems);
      if (data.tickets) setTickets({ normal: data.tickets.normal || 0, premium: data.tickets.premium || 0 });
      setTiers((prev) => prev.map((t) => (t.key === tier.key ? { ...t, used: data.used } : t)));
      toast({ title: `🎯 Tier ${tier.key} x${count}`, description: list.map((p) => p.label).join(", ") });
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
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[13px] font-black text-white tracking-widest">🎯 TIER SPIN</div>
            <div className="text-[10px] text-white/70 font-bold">Bayar pakai 💎 Gem atau 🎫 Tiket — tanpa limit, x1 / x2 / x5</div>
          </div>
          <div className="flex flex-col gap-1 flex-shrink-0">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 border border-cyan-400/50">
              <Gem className="w-3 h-3 text-cyan-300" />
              <span className="text-[10px] font-black text-cyan-200">{gems.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-black/50 border border-cyan-400/40 text-cyan-200">🎫 {tickets.normal}</span>
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-black/50 border border-fuchsia-400/40 text-fuchsia-200">🎟️ {tickets.premium}</span>
            </div>
          </div>
        </div>
      </div>

      {tiers.map((t) => {
        const st = TIER_STYLE[t.key] || TIER_STYLE.A;
        const habis = t.limit > 0 && t.used >= t.limit;
        const isSpin = spinning === t.key;
        const shown = reel[t.key];
        const tType = t.ticketType || "normal";
        const tCost = t.ticketCost || 1;
        const mode = payMode[t.key] || "gems";
        const tEmoji = tType === "premium" ? "🎟️" : "🎫";
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
                <div className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/25 text-emerald-200">
                  ♾️ TANPA LIMIT
                </div>
                <div className="text-[11px] font-black text-cyan-200 mt-1">💎 {t.cost}</div>
                <div className="text-[10px] font-black text-fuchsia-200">{tEmoji} {tCost} tiket</div>
              </div>

            </div>

            <div className="grid grid-cols-2 gap-1.5 mb-2">
              <button
                onClick={() => setPayMode((m) => ({ ...m, [t.key]: "gems" }))}
                className={`h-7 rounded-lg text-[10px] font-black border transition-colors ${mode === "gems" ? "bg-cyan-500/25 border-cyan-400/70 text-cyan-100" : "bg-black/40 border-white/15 text-white/50"}`}
              >
                💎 Bayar Gem
              </button>
              <button
                onClick={() => setPayMode((m) => ({ ...m, [t.key]: "ticket" }))}
                className={`h-7 rounded-lg text-[10px] font-black border transition-colors ${mode === "ticket" ? "bg-fuchsia-500/25 border-fuchsia-400/70 text-fuchsia-100" : "bg-black/40 border-white/15 text-white/50"}`}
              >
                {tEmoji} Pakai Tiket ({tickets[tType]})
              </button>
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

            {multi[t.key] && multi[t.key]!.length > 1 && (
              <div className="mb-2 grid grid-cols-2 gap-1.5">
                {multi[t.key]!.map((p, i) => (
                  <div key={i} className="rounded-lg border border-white/10 bg-black/50 px-2 py-1">
                    <div className={`text-[10px] font-black ${RARITY_COLOR[p.rarity] || "text-white"}`}>{p.emoji} {p.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {[1, 2, 5].map((c) => {
                const cukup = mode === "ticket" ? (tickets[tType] || 0) >= tCost * c : gems >= t.cost * c;
                return (
                  <Button
                    key={c}
                    onClick={() => spin(t, c)}
                    disabled={habis || isSpin || !cukup}
                    className={`h-9 text-[11px] font-black bg-gradient-to-r ${st.grad} text-white`}
                  >
                    {isSpin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : habis ? <Lock className="w-3.5 h-3.5" /> : (
                      <>x{c} · {mode === "ticket" ? `${tEmoji}${tCost * c}` : `💎${t.cost * c}`}</>
                    )}
                  </Button>
                );
              })}
            </div>


            <Button
              variant="outline"
              onClick={() => setOpenPool(openPool === t.key ? null : t.key)}
              className="w-full h-8 text-[11px] font-black border-white/20 bg-black/40 text-white"
            >
              {openPool === t.key ? "Tutup Daftar Hadiah" : `Lihat ${t.pool.length} Hadiah`}
            </Button>


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
