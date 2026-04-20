import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Gem, Coins, Wallet, Gift, Trophy, Zap, Lock, Crown, History } from "lucide-react";

interface Segment {
  id: string;
  label: string;
  icon: string;
  reward_type: string;
  reward_value: number;
  weight: number;
  color_class: string;
  is_jackpot: boolean;
  sort_order: number;
  tier: string;
}

interface Tier {
  id: string;
  tier_key: string;
  tier_name: string;
  description: string;
  icon: string;
  cost_coins: number;
  cost_gems: number;
  cost_balance: number;
  free_daily: boolean;
  pity_threshold: number;
  color_class: string;
}

interface Props {
  visitorId: string;
  onUpdate?: () => void;
}

export default function StreakLuckyWheelShop({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [winning, setWinning] = useState<any>(null);
  const [showResult, setShowResult] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [pin, setPin] = useState("");
  const [pendingMethod, setPendingMethod] = useState<string | null>(null);
  const [activeTier, setActiveTier] = useState<string>("normal");
  const wheelRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await supabase.functions.invoke("streak-lucky-wheel", { body: { action: "list", visitorId } });
      setData(res || null);
      if (res?.tiers?.length && !res.tiers.find((t: Tier) => t.tier_key === activeTier)) {
        setActiveTier(res.tiers[0].tier_key);
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (visitorId) load(); /* eslint-disable-next-line */ }, [visitorId]);

  async function spin(paymentMethod: string, pinValue?: string) {
    if (spinning) return;
    setSpinning(true);
    setShowResult(false);
    try {
      const { data: res } = await supabase.functions.invoke("streak-lucky-wheel", {
        body: { action: "spin", visitorId, tierKey: activeTier, paymentMethod, pin: pinValue },
      });
      if (res?.needPin) {
        setSpinning(false);
        setPendingMethod(paymentMethod);
        setShowPin(true);
        return;
      }
      if (res?.error) {
        toast({ title: "Gagal", description: res.error, variant: "destructive" });
        setSpinning(false);
        return;
      }
      if (res?.success) {
        const segments = (data?.segmentsByTier?.[activeTier] || []) as Segment[];
        const winIdx = segments.findIndex((s) => s.id === res.winning.id);
        const segDeg = 360 / segments.length;
        const targetDeg = 360 * 8 + (360 - (winIdx * segDeg + segDeg / 2));
        setRotation(prev => prev + targetDeg);
        setTimeout(() => {
          setWinning(res.winning);
          setShowResult(true);
          setSpinning(false);
          load();
          onUpdate?.();
        }, 4200);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "", variant: "destructive" });
      setSpinning(false);
    }
  }

  function handlePinSubmit() {
    if (pin.length < 4) {
      toast({ title: "PIN tidak valid", description: "Minimal 4 digit", variant: "destructive" });
      return;
    }
    setShowPin(false);
    spin(pendingMethod || "balance", pin);
    setPin("");
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-pink-500/10 via-purple-500/10 to-cyan-500/10 border border-pink-400/30 p-8 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-pink-300" />
      </div>
    );
  }
  if (!data || !data.tiers?.length) return null;

  const tiers: Tier[] = data.tiers || [];
  const currentTier = tiers.find(t => t.tier_key === activeTier) || tiers[0];
  const segments: Segment[] = data.segmentsByTier?.[activeTier] || [];
  const segDeg = segments.length ? 360 / segments.length : 0;
  const pityProgress = currentTier ? ((data.pity.spins_since_jackpot || 0) / currentTier.pity_threshold) * 100 : 0;
  const pityRemaining = currentTier ? Math.max(0, currentTier.pity_threshold - (data.pity.spins_since_jackpot || 0)) : 0;
  const freeAvailable = data.freeAvailable?.[activeTier];

  const colorMap: Record<string, string> = {
    "from-cyan-400": "#22d3ee", "to-blue-500": "#3b82f6",
    "from-pink-400": "#f472b6", "to-rose-500": "#f43f5e",
    "from-purple-500": "#a855f7", "to-fuchsia-500": "#d946ef",
    "from-emerald-400": "#34d399", "to-teal-500": "#14b8a6",
    "from-sky-400": "#38bdf8", "to-indigo-500": "#6366f1",
    "from-violet-500": "#8b5cf6", "to-purple-600": "#9333ea",
    "from-yellow-400": "#facc15", "to-orange-500": "#f97316",
    "from-yellow-300": "#fde047", "to-pink-500": "#ec4899", "to-orange-500 ": "#f97316",
    "from-amber-400": "#fbbf24",
  };

  return (
    <>
      <div className="rounded-2xl bg-gradient-to-br from-pink-500/15 via-fuchsia-500/15 to-cyan-500/15 border-2 border-pink-400/40 p-3 sm:p-4 shadow-2xl shadow-pink-500/20 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-pink-300 animate-pulse" />
            <h3 className="font-black text-base sm:text-lg bg-gradient-to-r from-pink-200 via-fuchsia-100 to-cyan-200 bg-clip-text text-transparent tracking-wide">
              LUCKY WHEEL SHOP
            </h3>
            <Badge className="bg-pink-500/40 text-pink-100 border-pink-400/60 text-[9px] px-1.5 py-0 h-4 animate-pulse">3 TIER</Badge>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-pink-200 font-bold">
            <Trophy className="h-3 w-3" /> {data.pity.total_jackpots}
          </div>
        </div>

        {/* Tier Selector */}
        <div className="grid grid-cols-3 gap-1.5">
          {tiers.map(t => {
            const isActive = activeTier === t.tier_key;
            return (
              <button
                key={t.tier_key}
                onClick={() => setActiveTier(t.tier_key)}
                disabled={spinning}
                className={`relative rounded-lg p-2 text-center transition-all ${
                  isActive
                    ? `bg-gradient-to-br ${t.color_class} text-white shadow-lg scale-105 ring-2 ring-white/40`
                    : "bg-black/30 border border-white/10 text-white/60 hover:text-white/90"
                }`}
              >
                <div className="text-lg leading-none mb-0.5">{t.icon}</div>
                <div className="text-[10px] font-black uppercase tracking-wide">{t.tier_name}</div>
                {t.free_daily && data.freeAvailable?.[t.tier_key] && (
                  <Badge className="absolute -top-1 -right-1 bg-emerald-500 text-white text-[8px] px-1 h-3.5 border-none">FREE</Badge>
                )}
              </button>
            );
          })}
        </div>

        {/* Tier Description */}
        {currentTier && (
          <div className={`rounded-lg bg-gradient-to-r ${currentTier.color_class} p-2 text-white text-center`}>
            <p className="text-[11px] font-bold leading-tight">{currentTier.description}</p>
          </div>
        )}

        {/* Live Jackpot Ticker */}
        {data.recentJackpots && data.recentJackpots.length > 0 && (
          <div className="overflow-hidden rounded-lg bg-black/40 border border-yellow-400/30 py-1">
            <motion.div
              animate={{ x: ["100%", "-100%"] }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              className="flex gap-6 whitespace-nowrap text-[10px] text-yellow-200 font-bold"
            >
              {[...data.recentJackpots, ...data.recentJackpots].map((j: any, i: number) => (
                <span key={i} className="flex items-center gap-1">
                  <Crown className="h-3 w-3 text-yellow-300" />
                  {j.display_name || "Player"} memenangkan {j.reward_label}!
                </span>
              ))}
            </motion.div>
          </div>
        )}

        {/* Wheel */}
        <div className="relative aspect-square max-w-[280px] mx-auto">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 z-20">
            <div className="w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[20px] border-t-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
          </div>

          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 rounded-full opacity-60 pointer-events-none"
            style={{ background: "conic-gradient(from 0deg, #ec4899, #a855f7, #06b6d4, #ec4899)" }}
          />
          <div className="absolute inset-1 rounded-full bg-black" />

          <motion.div
            ref={wheelRef}
            animate={{ rotate: rotation }}
            transition={{ duration: 4, ease: [0.17, 0.67, 0.16, 0.99] }}
            className="absolute inset-2 rounded-full overflow-hidden"
          >
            <svg viewBox="0 0 200 200" className="w-full h-full">
              {segments.map((seg, i) => {
                const startAngle = (i * segDeg - 90) * (Math.PI / 180);
                const endAngle = ((i + 1) * segDeg - 90) * (Math.PI / 180);
                const x1 = 100 + 100 * Math.cos(startAngle);
                const y1 = 100 + 100 * Math.sin(startAngle);
                const x2 = 100 + 100 * Math.cos(endAngle);
                const y2 = 100 + 100 * Math.sin(endAngle);
                const largeArc = segDeg > 180 ? 1 : 0;
                const colors = (seg.color_class || "").split(" ").filter(c => c.startsWith("from-") || c.startsWith("to-"));
                const c1 = colorMap[colors[0]] || "#ec4899";
                const c2 = colorMap[colors[colors.length - 1]] || "#06b6d4";
                const labelAngle = (i * segDeg + segDeg / 2 - 90) * (Math.PI / 180);
                const lx = 100 + 60 * Math.cos(labelAngle);
                const ly = 100 + 60 * Math.sin(labelAngle);
                return (
                  <g key={seg.id}>
                    <defs>
                      <linearGradient id={`grad-${seg.id}`} x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor={c1} />
                        <stop offset="100%" stopColor={c2} />
                      </linearGradient>
                    </defs>
                    <path
                      d={`M 100 100 L ${x1} ${y1} A 100 100 0 ${largeArc} 1 ${x2} ${y2} Z`}
                      fill={`url(#grad-${seg.id})`}
                      stroke="rgba(0,0,0,0.6)"
                      strokeWidth="1.5"
                    />
                    {seg.is_jackpot && (
                      <path
                        d={`M 100 100 L ${x1} ${y1} A 100 100 0 ${largeArc} 1 ${x2} ${y2} Z`}
                        fill="none"
                        stroke="#fde047"
                        strokeWidth="2"
                        opacity="0.9"
                      />
                    )}
                    <text
                      x={lx} y={ly}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="14"
                      transform={`rotate(${i * segDeg + segDeg / 2}, ${lx}, ${ly})`}
                    >
                      {seg.icon}
                    </text>
                  </g>
                );
              })}
              <circle cx="100" cy="100" r="14" fill="#0f172a" stroke="#ec4899" strokeWidth="2" />
              <circle cx="100" cy="100" r="6" fill="#ec4899" />
            </svg>
          </motion.div>

          {pityRemaining <= 10 && pityRemaining > 0 && (
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="absolute -inset-1 rounded-full border-2 border-yellow-400/60 pointer-events-none"
            />
          )}
        </div>

        {/* Pity Progress */}
        <div className="rounded-lg bg-black/30 border border-yellow-400/30 p-2 space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-yellow-200 font-bold flex items-center gap-1">
              <Zap className="h-3 w-3" /> JACKPOT GUARANTEED
            </span>
            <span className="text-yellow-100 tabular-nums font-bold">{data.pity.spins_since_jackpot}/{currentTier?.pity_threshold || 50}</span>
          </div>
          <Progress value={pityProgress} className="h-1.5" />
          <p className="text-[9px] text-yellow-200/70">
            {pityRemaining === 0 ? "🔥 SPIN BERIKUTNYA = JACKPOT!" : `${pityRemaining} spin lagi sampai jackpot pasti`}
          </p>
        </div>

        {/* Spin buttons */}
        <div className="grid grid-cols-2 gap-2">
          {currentTier?.free_daily && (
            <Button
              disabled={spinning || !freeAvailable}
              onClick={() => spin("free")}
              className="h-12 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-black shadow-lg shadow-emerald-500/30 disabled:opacity-50"
            >
              {spinning ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <div className="flex flex-col items-center leading-tight">
                  <span className="flex items-center gap-1 text-xs"><Gift className="h-3 w-3" />FREE</span>
                  <span className="text-[9px] opacity-90">{freeAvailable ? "Hari ini" : "Besok lagi"}</span>
                </div>
              )}
            </Button>
          )}
          {currentTier && currentTier.cost_coins > 0 && (
            <Button
              disabled={spinning}
              onClick={() => spin("coins")}
              className="h-12 bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black shadow-lg shadow-cyan-500/30"
            >
              <div className="flex flex-col items-center leading-tight">
                <span className="flex items-center gap-1 text-xs"><Coins className="h-3 w-3" />{currentTier.cost_coins}</span>
                <span className="text-[9px] opacity-90">Streak Coin</span>
              </div>
            </Button>
          )}
          {currentTier && currentTier.cost_gems > 0 && (
            <Button
              disabled={spinning}
              onClick={() => spin("gems")}
              className="h-12 bg-gradient-to-br from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 text-white font-black shadow-lg shadow-fuchsia-500/30"
            >
              <div className="flex flex-col items-center leading-tight">
                <span className="flex items-center gap-1 text-xs"><Gem className="h-3 w-3" />{currentTier.cost_gems}</span>
                <span className="text-[9px] opacity-90">Gems</span>
              </div>
            </Button>
          )}
          {currentTier && currentTier.cost_balance > 0 && (
            <Button
              disabled={spinning}
              onClick={() => spin("balance")}
              className="h-12 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-black shadow-lg shadow-amber-500/30"
            >
              <div className="flex flex-col items-center leading-tight">
                <span className="flex items-center gap-1 text-xs"><Wallet className="h-3 w-3" />Rp{currentTier.cost_balance.toLocaleString("id-ID")}</span>
                <span className="text-[9px] opacity-90 flex items-center gap-0.5"><Lock className="h-2 w-2" />Saldo</span>
              </div>
            </Button>
          )}
        </div>

        {/* My recent spins */}
        {data.mySpins && data.mySpins.length > 0 && (
          <div className="rounded-lg bg-black/30 border border-pink-400/20 p-2">
            <div className="flex items-center gap-1 mb-1.5">
              <History className="h-3 w-3 text-pink-300" />
              <span className="text-[10px] font-bold text-pink-200 uppercase tracking-wider">Riwayat Spin</span>
            </div>
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {data.mySpins.slice(0, 5).map((s: any, i: number) => (
                <div key={i} className={`flex items-center justify-between text-[10px] px-1.5 py-1 rounded ${s.is_jackpot ? "bg-yellow-500/20 text-yellow-100" : "bg-white/5 text-white/80"}`}>
                  <span className="truncate flex items-center gap-1">
                    {s.is_jackpot && <Crown className="h-2.5 w-2.5 text-yellow-300" />}
                    {s.reward_label}
                  </span>
                  <span className="text-[9px] opacity-60">{new Date(s.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Result Dialog */}
      <Dialog open={showResult} onOpenChange={setShowResult}>
        <DialogContent className="max-w-xs bg-gradient-to-br from-pink-950 via-purple-950 to-cyan-950 border-2 border-pink-400/50">
          <DialogHeader>
            <DialogTitle className="sr-only">Hasil Spin</DialogTitle>
            <DialogDescription className="sr-only">Hadiah yang kamu menangkan dari Lucky Wheel</DialogDescription>
          </DialogHeader>
          <AnimatePresence>
            {winning && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center space-y-3 py-4"
              >
                {winning.is_jackpot && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], rotate: [0, -5, 5, 0] }}
                    transition={{ duration: 0.6, repeat: 2 }}
                    className="text-3xl font-black bg-gradient-to-r from-yellow-300 via-amber-400 to-pink-400 bg-clip-text text-transparent"
                  >
                    🎰 JACKPOT! 🎰
                  </motion.div>
                )}
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 0.5 }}
                  className="text-7xl"
                >
                  {winning.icon}
                </motion.div>
                <h3 className="text-xl font-black text-white">{winning.label}</h3>
                <p className="text-xs text-pink-200">Hadiah berhasil ditambahkan ke akunmu!</p>
                <Button onClick={() => setShowResult(false)} className="w-full bg-gradient-to-r from-pink-500 to-cyan-500 text-white font-bold">
                  Mantap!
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>

      {/* PIN Dialog */}
      <Dialog open={showPin} onOpenChange={(o) => { if (!o) { setShowPin(false); setPin(""); } }}>
        <DialogContent className="max-w-xs bg-slate-950 border border-amber-400/40">
          <DialogHeader>
            <DialogTitle className="text-amber-200 flex items-center gap-2"><Lock className="h-4 w-4" />Masukkan PIN Saldo</DialogTitle>
            <DialogDescription className="text-xs text-amber-200/70">PIN diperlukan untuk transaksi pakai saldo</DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="••••••"
            className="text-center text-2xl tracking-[0.5em] bg-slate-900 border-amber-400/30 text-amber-100"
          />
          <Button onClick={handlePinSubmit} className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold">
            Konfirmasi
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
