import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Lock, Sparkles, Crown, Zap, Gem, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import SpinWarnDialog, { type SpinWarnPayload } from "./SpinWarnDialog";
import WinRevealOverlay, { type RevealPrize } from "./WinRevealOverlay";


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
  const [warn, setWarn] = useState<(SpinWarnPayload & { tier: TierInfo; count: number }) | null>(null);
  const [reveal, setReveal] = useState<RevealPrize[] | null>(null);
  const [feed, setFeed] = useState<{ tier: string; item: PoolItem; at: number }[]>([]);
  const [hotStreak, setHotStreak] = useState(0);

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

  function askSpin(tier: TierInfo, count = 1) {
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
    const st = TIER_STYLE[tier.key] || TIER_STYLE.A;
    const cost = mode === "ticket" ? tCost : tier.cost * count;
    setWarn({
      tier,
      count,
      tierName: tier.name,
      grad: st.grad,
      mode,
      cost,
      emoji: mode === "ticket" ? (tType === "premium" ? "🎟️" : "🎫") : "💎",
      balanceAfter: (mode === "ticket" ? tickets[tType] || 0 : gems) - cost,
      risky: mode === "gems" && cost >= 1000,
    });
  }

  async function spin(tier: TierInfo, count = 1) {
    if (spinning) return;
    const mode = payMode[tier.key] || "gems";
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
      setReveal(list.map((p) => ({ label: p.label, emoji: p.emoji, rarity: p.rarity })));
      setFeed((f) => [...list.map((p) => ({ tier: tier.key, item: p, at: Date.now() })), ...f].slice(0, 8));
      const lucky = list.some((p) => ["epic", "legendary", "mythic"].includes(p.rarity));
      setHotStreak((s) => (lucky ? Math.min(s + 1, 10) : 0));
      if (typeof data.gems === "number") setGems(data.gems);
      if (data.tickets) setTickets({ normal: data.tickets.normal || 0, premium: data.tickets.premium || 0 });
      setTiers((prev) => prev.map((t) => (t.key === tier.key ? { ...t, used: data.used } : t)));
      if (data.bonusTickets > 0) {
        toast({
          title: "🎁 Bonus Beruntun!",
          description: `+${data.bonusTickets} tiket ${data.bonusTicketType === "premium" ? "premium 🎟️" : "normal 🎫"} gratis!`,
        });
      }
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
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b0616] p-4">
        <motion.div
          className="absolute -top-16 -left-10 w-48 h-48 rounded-full blur-3xl bg-fuchsia-600/40"
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-20 -right-10 w-52 h-52 rounded-full blur-3xl bg-amber-500/30"
          animate={{ x: [0, -25, 0], y: [0, -15, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        />
        <div
          className="absolute inset-0 opacity-[0.16]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            maskImage: "radial-gradient(120% 80% at 50% 0%, black, transparent 70%)",
          }}
        />
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(105deg, transparent 42%, rgba(255,255,255,.14) 50%, transparent 58%)",
            backgroundSize: "220% 100%",
          }}
          animate={{ backgroundPosition: ["220% 0", "-220% 0"] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
        />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10">
              <motion.span
                animate={{ scale: [1, 1.35, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-emerald-400"
              />
              <span className="text-[8px] font-black tracking-[0.22em] text-fuchsia-200">LIVE · TANPA LIMIT</span>
            </div>
            <h2 className="mt-1.5 text-2xl font-black leading-none tracking-tight bg-gradient-to-r from-fuchsia-300 via-white to-amber-300 bg-clip-text text-transparent drop-shadow">
              TIER SPIN
            </h2>
            <p className="mt-1 text-[10px] font-bold text-white/55 leading-snug">
              Bayar 💎 Gem atau 🎫 Tiket · x1 / x2 / x5 / x10 · bonus tiket tiap 10 spin
            </p>
          </div>

          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <motion.div
              animate={{ boxShadow: ["0 0 0px rgba(34,211,238,.0)", "0 0 18px rgba(34,211,238,.45)", "0 0 0px rgba(34,211,238,.0)"] }}
              transition={{ duration: 2.4, repeat: Infinity }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-black/60 border border-cyan-400/50"
            >
              <Gem className="w-3.5 h-3.5 text-cyan-300" />
              <span className="text-[12px] font-black text-cyan-100 tabular-nums">{gems.toLocaleString("id-ID")}</span>
            </motion.div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-black/60 border border-cyan-400/30 text-cyan-200">🎫 {tickets.normal}</span>
              <span className="text-[9px] font-black px-2 py-0.5 rounded-lg bg-black/60 border border-fuchsia-400/30 text-fuchsia-200">🎟️ {tickets.premium}</span>
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
          <motion.div
            key={t.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden rounded-3xl border ${st.ring} bg-[#0a0712]/90 p-3 shadow-xl ${st.glow}`}
          >
            <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${st.grad}`} />
            <div className={`absolute -top-14 -right-10 w-32 h-32 rounded-full blur-3xl bg-gradient-to-br ${st.grad} opacity-25`} />

            <div className="relative flex items-start justify-between gap-2 mb-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <motion.span
                    animate={isSpin ? { rotate: 360 } : { rotate: 0 }}
                    transition={{ duration: 1, repeat: isSpin ? Infinity : 0, ease: "linear" }}
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br ${st.grad} text-white shadow-lg`}
                  >
                    {st.icon}
                  </motion.span>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-black text-white tracking-wide truncate leading-none">{t.name}</div>
                    <div className="text-[8px] font-black text-white/45 mt-1 tracking-[0.2em]">{st.tag}</div>
                  </div>
                </div>
                <div className="text-[10px] text-white/60 font-semibold mt-1.5 leading-snug">{t.desc}</div>
              </div>
              <div className="text-right flex-shrink-0 space-y-1">
                <div className="text-[8px] font-black px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 tracking-widest">
                  ♾️ NO LIMIT
                </div>
                <div className="text-[11px] font-black text-cyan-200 tabular-nums">💎 {t.cost}</div>
                <div className="text-[10px] font-black text-fuchsia-200">{tEmoji} {tCost}</div>
              </div>
            </div>

            <div className="relative grid grid-cols-2 gap-1.5 mb-2 p-1 rounded-xl bg-black/50 border border-white/10">
              <button
                onClick={() => setPayMode((m) => ({ ...m, [t.key]: "gems" }))}
                className={`h-7 rounded-lg text-[10px] font-black transition-all ${mode === "gems" ? "bg-gradient-to-r from-cyan-500/40 to-sky-500/30 text-cyan-50 shadow-inner" : "text-white/40 hover:text-white/70"}`}
              >
                💎 Gem
              </button>
              <button
                onClick={() => setPayMode((m) => ({ ...m, [t.key]: "ticket" }))}
                className={`h-7 rounded-lg text-[10px] font-black transition-all ${mode === "ticket" ? "bg-gradient-to-r from-fuchsia-500/40 to-purple-500/30 text-fuchsia-50 shadow-inner" : "text-white/40 hover:text-white/70"}`}
              >
                {tEmoji} Tiket ({tickets[tType]})
              </button>
            </div>

            <div className={`relative h-20 rounded-2xl border ${st.ring} bg-gradient-to-b from-black/80 to-black/40 flex items-center justify-center overflow-hidden mb-2`}>
              <div
                className="absolute inset-0 opacity-20"
                style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,.25) 0 1px, transparent 1px 14px)" }}
              />
              {isSpin && (
                <motion.div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(180deg, transparent, rgba(255,255,255,.18), transparent)" }}
                  animate={{ y: ["-100%", "100%"] }}
                  transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
                />
              )}
              <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black to-transparent" />
              <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-black to-transparent" />

              <AnimatePresence mode="wait">
                {shown ? (
                  <motion.div
                    key={`${shown.label}-${isSpin ? "s" : "f"}`}
                    initial={{ y: 24, opacity: 0, scale: 0.9 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: -24, opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.09 }}
                    className="relative text-center px-2"
                  >
                    <div className="text-2xl leading-none drop-shadow-[0_0_10px_rgba(255,255,255,.35)]">{shown.emoji}</div>
                    <div className={`text-[11px] font-black mt-1 ${RARITY_COLOR[shown.rarity] || "text-white"}`}>{shown.label}</div>
                  </motion.div>
                ) : (
                  <motion.div
                    animate={{ opacity: [0.35, 0.8, 0.35] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                    className="relative text-[10px] font-black text-white/60 tracking-[0.3em]"
                  >
                    TEKAN SPIN
                  </motion.div>
                )}
              </AnimatePresence>
              {won?.tier === t.key && !isSpin && (
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`absolute top-1.5 right-1.5 text-[8px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r ${st.grad} text-white shadow-lg`}
                >
                  ✦ MENANG!
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

            {/* Bonus beruntun: tiap 10 spin dapat tiket gratis */}
            <div className="mb-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1.5">
              <div className="flex items-center justify-between text-[9px] font-black text-amber-200">
                <span>🎁 Bonus Beruntun · {t.used % 10}/10 spin</span>
                <span>+{tType === "premium" ? "1 🎟️" : "2 🎫"} gratis</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-black/50 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all" style={{ width: `${((t.used % 10) / 10) * 100}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {[1, 2, 5, 10].map((c) => {
                const cukup = mode === "ticket" ? (tickets[tType] || 0) >= tCost * c : gems >= t.cost * c;
                return (
                  <Button
                    key={c}
                    onClick={() => askSpin(t, c)}
                    disabled={habis || isSpin || !cukup}
                    className={`h-10 rounded-xl text-[10px] font-black bg-gradient-to-br ${st.grad} text-white px-1 shadow-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:grayscale`}
                  >
                    {isSpin ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : habis ? <Lock className="w-3.5 h-3.5" /> : (
                      <span className="flex flex-col leading-tight">
                        <span className="text-[11px]">x{c}</span>
                        <span className="text-[8px] opacity-90">{mode === "ticket" ? `${tEmoji}${tCost * c}` : `💎${t.cost * c}`}</span>
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              onClick={() => setOpenPool(openPool === t.key ? null : t.key)}
              className="w-full h-8 rounded-xl text-[10px] font-black border-white/15 bg-white/5 text-white/80 hover:bg-white/10 tracking-wider"
            >
              {openPool === t.key ? "▲ TUTUP DAFTAR HADIAH" : `▼ LIHAT ${t.pool.length} HADIAH`}
            </Button>

            <AnimatePresence>
              {openPool === t.key && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {t.pool.map((p, i) => (
                      <div key={i} className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1.5">
                        <div className={`text-[10px] font-black ${RARITY_COLOR[p.rarity] || "text-white"}`}>{p.emoji} {p.label}</div>
                        <div className="text-[8px] font-black text-white/35 uppercase tracking-widest">{p.rarity}</div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

        );
      })}
    </div>
  );
}
