import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Clock, Tag, ShoppingBag, Crown, Lock, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

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

export default function StreakShopFlashDeals({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [now, setNow] = useState(Date.now());
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

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
    </motion.div>
  );
}
