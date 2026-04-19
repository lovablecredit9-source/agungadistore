import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Clock, Tag, ShoppingBag, Crown, Lock, Loader2, Check, Info, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { syncPowerUpsFromServer } from "@/components/games/gameStore";

interface Deal {
  id: string;
  name: string;
  description: string;
  icon: string;
  original_cost: number;
  discount_pct: number;
  reward_type: string;
  reward_value: number;
  badge: string;
  gradient: string;
  requires_premium: boolean;
  daily_limit: number;
  claimed_today: boolean;
  can_purchase: boolean;
  locked_reason: string | null;
}

interface Props {
  visitorId: string;
  onUpdate?: () => void;
}

function fmt(ms: number) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

const REWARD_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  streak_coins: { label: "Streak Coins", icon: "🪙", desc: "Dipakai di Streak Shop & Spin Wheel" },
  coins: { label: "Streak Coins", icon: "🪙", desc: "Dipakai di Streak Shop & Spin Wheel" },
  game_credits: { label: "Kredit Game", icon: "🎮", desc: "Saldo main game (slot, mine, dll)" },
  credits: { label: "Kredit Game", icon: "🎮", desc: "Saldo main game (slot, mine, dll)" },
  xp: { label: "XP Season Pass", icon: "⚡", desc: "Naikin tier Season Pass" },
  season_xp: { label: "XP Season Pass", icon: "⚡", desc: "Naikin tier Season Pass" },
  streak_xp: { label: "XP Streak Pass", icon: "✨", desc: "Naikin tier Streak Pass" },
  lives: { label: "Nyawa Game", icon: "❤️", desc: "Buat lanjut main kalau kalah" },
  hearts: { label: "Nyawa Game", icon: "❤️", desc: "Buat lanjut main kalau kalah" },
  freeze: { label: "Streak Freeze", icon: "❄️", desc: "Lindungi streak kalau lupa klaim" },
  streak_freeze: { label: "Streak Freeze", icon: "❄️", desc: "Lindungi streak kalau lupa klaim" },
  gems: { label: "Gems Premium", icon: "💎", desc: "Mata uang premium top up" },
  power_up: { label: "Power Up", icon: "💥", desc: "Bantuan ekstra di game" },
  hint: { label: "Hint Game", icon: "💡", desc: "Petunjuk soal di kuis & teka-teki" },
  shuffle: { label: "Shuffle", icon: "🔀", desc: "Acak ulang papan/soal" },
  skip: { label: "Skip", icon: "⏭️", desc: "Lewati 1 soal tanpa kalah" },
  ticket: { label: "Tiket Lucky Draw", icon: "🎟️", desc: "Buat spin Lucky Draw" },
  lucky_ticket: { label: "Tiket Lucky Draw", icon: "🎟️", desc: "Buat spin Lucky Draw" },
  multiplier: { label: "Multiplier Bonus", icon: "✖️", desc: "Lipat gandakan reward streak" },
};

function getRewardInfo(type: string) {
  return REWARD_LABELS[type] || {
    label: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    icon: "🎁",
    desc: "Hadiah spesial dari flash deal",
  };
}

export default function StreakShopFlashDeals({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [now, setNow] = useState(Date.now());
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [infoDeal, setInfoDeal] = useState<Deal | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Reset 1x sehari di 00:00 WIB
  const dayEndWIB = useMemo(() => {
    const wib = new Date(Date.now() + 7 * 3600 * 1000);
    wib.setUTCHours(24, 0, 0, 0);
    return wib.getTime() - 7 * 3600 * 1000;
  }, [now > 0]);

  const remaining = dayEndWIB - now;
  const isUrgent = remaining < 60 * 60 * 1000;

  const load = async () => {
    if (!visitorId) return;
    try {
      const { data, error } = await supabase.functions.invoke("flash-deal-purchase", {
        body: { action: "list", visitorId },
      });
      if (error) throw error;
      setDeals((data as any).deals || []);
      setIsPremium(!!(data as any).is_premium);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [visitorId]);

  const handleBuy = async (deal: Deal) => {
    if (!deal.can_purchase) {
      if (deal.locked_reason === "premium_required") {
        toast({ title: "🔒 Premium dibutuhkan", description: "Aktifkan Streak Pass Premium atau Season Pass Premium dulu untuk beli flash deal ini!", variant: "destructive" });
      } else if (deal.locked_reason === "daily_limit") {
        toast({ title: "Batas Harian Tercapai", description: "Coba lagi besok ya, hanya bisa 1x per hari!", variant: "destructive" });
      }
      return;
    }
    setBuying(deal.id);
    try {
      const { data, error } = await supabase.functions.invoke("flash-deal-purchase", {
        body: { action: "purchase", visitorId, dealId: deal.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: `⚡ ${deal.name} Berhasil!`, description: (data as any).rewardSummary });
      // Refresh power-up cache di localStorage agar bertambah di game
      await syncPowerUpsFromServer();
      window.dispatchEvent(new CustomEvent("power-ups-updated"));
      load();
      onUpdate?.();
    } catch (e) {
      toast({ title: "Gagal beli", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally {
      setBuying(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border-2 border-orange-500/50 p-6 bg-gradient-to-br from-red-950 via-orange-950 to-yellow-950 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-orange-300" />
        <span className="text-xs text-orange-200 font-bold">Memuat flash deals...</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border-2 border-orange-500/50 p-4 bg-gradient-to-br from-red-950 via-orange-950 to-yellow-950 shadow-[0_0_30px_rgba(249,115,22,0.35)]"
    >
      <motion.div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-orange-500/30 blur-3xl"
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 3.5, repeat: Infinity }}
      />

      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <motion.div animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.15, 1] }} transition={{ duration: 2, repeat: Infinity }}>
              <Flame className="w-6 h-6 text-orange-400 drop-shadow-[0_0_10px_rgba(249,115,22,0.9)]" strokeWidth={2.5} />
            </motion.div>
            <div>
              <div className="text-[10px] font-black tracking-widest text-orange-300 uppercase">⚡ FLASH DEAL · 1X / HARI</div>
              <div className="text-base font-black text-white">Diskon Kilat Harian</div>
            </div>
          </div>

          <motion.div
            animate={isUrgent ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.8, repeat: Infinity }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full border ${
              isUrgent ? "bg-red-500/40 border-red-400 text-red-100" : "bg-black/40 border-orange-400/40 text-orange-200"
            }`}
          >
            <Clock className="w-3 h-3" strokeWidth={2.5} />
            <span className="text-[10px] font-black tabular-nums">{fmt(remaining)}</span>
          </motion.div>
        </div>

        {/* Premium badge */}
        {!isPremium && (
          <div className="mb-3 p-2.5 rounded-xl bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-400/40 flex items-center gap-2">
            <Crown className="w-4 h-4 text-yellow-300 flex-shrink-0" strokeWidth={2.5} />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black text-yellow-100">2 deal hemat tersedia untuk semua! 🎉</div>
              <div className="text-[9px] text-yellow-200/80">Aktifkan Premium (Streak Pass / Season Pass) untuk buka 4 deal eksklusif</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <AnimatePresence>
            {deals.map((deal, i) => {
              const finalPrice = Math.floor(deal.original_cost * (1 - deal.discount_pct / 100));
              const locked = !deal.can_purchase;
              return (
                <motion.div
                  key={deal.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.08 }}
                  className={`relative overflow-hidden rounded-xl p-2.5 bg-gradient-to-br ${deal.gradient} border ${
                    deal.claimed_today ? "border-green-400/60 ring-1 ring-green-400/40" : "border-white/20"
                  }`}
                >
                  {deal.badge && (
                    <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-black/50 backdrop-blur">
                      <span className="text-[8px] font-black text-white">{deal.badge}</span>
                    </div>
                  )}
                  <button
                    onClick={() => setInfoDeal(deal)}
                    className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur border border-white/30 flex items-center justify-center z-10"
                    aria-label={`Info ${deal.name}`}
                  >
                    <Info className="w-3 h-3 text-white" strokeWidth={2.5} />
                  </button>
                  <div className="flex items-start gap-2 mb-2">
                    <span className="text-xl flex-shrink-0">{deal.icon}</span>
                    <div className="min-w-0">
                      <div className="text-[11px] font-black text-white truncate">{deal.name}</div>
                      <div className="text-[9px] text-white/70 truncate">{deal.description}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-[9px] text-white/50 line-through tabular-nums">{deal.original_cost} 🪙</div>
                      <div className="text-sm font-black text-yellow-200 tabular-nums">{finalPrice} 🪙</div>
                    </div>
                    <div className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[9px] font-black flex items-center gap-0.5">
                      <Tag className="w-2.5 h-2.5" strokeWidth={3} />
                      -{deal.discount_pct}%
                    </div>
                  </div>

                  <Button
                    onClick={() => handleBuy(deal)}
                    disabled={buying === deal.id || deal.claimed_today}
                    className={`w-full h-7 text-[10px] font-black uppercase tracking-wider ${
                      deal.claimed_today
                        ? "bg-green-600/40 text-green-200 cursor-not-allowed"
                        : locked
                        ? "bg-black/40 text-white/60 hover:bg-black/50"
                        : "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                    }`}
                  >
                    {buying === deal.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : deal.claimed_today ? (
                      <span className="flex items-center gap-1"><Check className="w-3 h-3" strokeWidth={3} />Sudah hari ini</span>
                    ) : deal.locked_reason === "premium_required" ? (
                      <span className="flex items-center gap-1"><Lock className="w-3 h-3" />Premium Only</span>
                    ) : (
                      "Beli Sekarang"
                    )}
                  </Button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5 p-2 rounded-lg bg-black/30 border border-orange-400/20">
          <ShoppingBag className="w-3.5 h-3.5 text-orange-300" strokeWidth={2.5} />
          <span className="text-[10px] text-orange-200/90 font-bold">Reset 00:00 WIB · 1x per deal per hari</span>
        </div>
      </div>

      <AnimatePresence>
        {infoDeal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/85 backdrop-blur flex items-center justify-center p-4"
            onClick={() => setInfoDeal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`max-w-sm w-full rounded-3xl p-5 bg-gradient-to-br ${infoDeal.gradient} border-2 border-white/30 shadow-2xl`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center text-2xl">
                    {infoDeal.icon}
                  </div>
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-wider text-white/70">{infoDeal.badge || "FLASH DEAL"}</div>
                    <div className="text-base font-black text-white">{infoDeal.name}</div>
                  </div>
                </div>
                <button
                  onClick={() => setInfoDeal(null)}
                  className="w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center flex-shrink-0"
                >
                  <X className="w-4 h-4 text-white" strokeWidth={2.5} />
                </button>
              </div>

              <p className="text-xs text-white/90 mb-4 leading-relaxed">{infoDeal.description}</p>

              <div className="space-y-2 mb-4">
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-black/30 border border-white/10">
                  <span className="text-[11px] font-bold text-white/70">Yang Kamu Dapat</span>
                  <span className="text-sm font-black text-yellow-200">
                    {infoDeal.reward_value > 0 ? `+${infoDeal.reward_value}` : ""} {infoDeal.reward_type.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-black/30 border border-white/10">
                  <span className="text-[11px] font-bold text-white/70">Harga Normal</span>
                  <span className="text-sm font-black text-white/80 line-through tabular-nums">{infoDeal.original_cost} 🪙</span>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-gradient-to-r from-red-500/40 to-orange-500/40 border border-red-400/40">
                  <span className="text-[11px] font-black text-white">Harga Diskon</span>
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[9px] font-black">-{infoDeal.discount_pct}%</span>
                    <span className="text-base font-black text-yellow-200 tabular-nums">
                      {Math.floor(infoDeal.original_cost * (1 - infoDeal.discount_pct / 100))} 🪙
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-xl bg-black/30 border border-white/10">
                  <span className="text-[11px] font-bold text-white/70">Limit Harian</span>
                  <span className="text-sm font-black text-white">{infoDeal.daily_limit}x / hari</span>
                </div>
                {infoDeal.requires_premium && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-yellow-500/20 border border-yellow-400/40">
                    <Crown className="w-4 h-4 text-yellow-300" strokeWidth={2.5} />
                    <span className="text-[11px] font-bold text-yellow-100">Khusus Premium (Streak Pass / Season Pass)</span>
                  </div>
                )}
              </div>

              <Button
                onClick={() => setInfoDeal(null)}
                className="w-full bg-white text-black font-black"
              >
                MENGERTI
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
