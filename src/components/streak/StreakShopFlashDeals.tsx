import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Clock, Tag, ShoppingBag, Crown, Lock, Loader2, Check, Info, X, Sparkles, Zap as ZapIcon, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { syncPowerUpsFromServer } from "@/components/games/gameStore";

type FilterKey = "all" | "free" | "premium" | "cheap" | "best";

interface Deal {
  id: string;
  name: string;
  description: string;
  icon: string;
  original_cost: number;
  discount_pct: number;
  cost_gems: number;
  reward_type: string;
  reward_value: number;
  badge: string;
  gradient: string;
  requires_premium: boolean;
  daily_limit: number;
  claimed_today: boolean;
  owned?: boolean;

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

interface RewardInfo {
  label: string;
  icon: string;
  desc: string;
  items?: { icon: string; text: string }[];
}

function getRewardInfo(type: string, value: number): RewardInfo {
  switch (type) {
    case "streak_freeze":
      return {
        label: "Streak Freeze",
        icon: "❄️",
        desc: "Lindungi streak harian kalau lupa klaim - streak gak putus!",
        items: [{ icon: "❄️", text: `${value}× Streak Freeze (otomatis aktif kalau skip 1 hari)` }],
      };
    case "double_xp":
      return {
        label: "Double XP",
        icon: "⚡",
        desc: `XP streak & game digandakan 2× selama ${value} jam ke depan.`,
        items: [
          { icon: "⚡", text: `Boost XP 2× selama ${value} jam` },
          { icon: "🏆", text: "Naikin tier Streak Pass / Season Pass lebih cepat" },
        ],
      };
    case "mystery_bundle":
      return {
        label: "Mystery Bundle",
        icon: "🎁",
        desc: "Paket campuran power-up untuk main game lebih lama.",
        items: [
          { icon: "💡", text: "+5 Hint Otomatis (jawaban kuis muncul sebagian)" },
          { icon: "❤️", text: "+3 Nyawa Ekstra (lanjut main kalau kalah)" },
        ],
      };
    case "vip_pack":
      return {
        label: "VIP Power Pack",
        icon: "👑",
        desc: "Paket lengkap premium - semua power-up sekaligus.",
        items: [
          { icon: "💡", text: "+10 Hint Otomatis" },
          { icon: "❤️", text: "+5 Nyawa Ekstra" },
          { icon: "⏸️", text: "+5 Time Freeze (hentikan timer)" },
          { icon: "❄️", text: "+2 Streak Freeze" },
          { icon: "⚡", text: "Double XP 12 jam" },
        ],
      };
    case "server_luck":
      return { label: "Jam Hoki", icon: "🍀", desc: `Booster keberuntungan server aktif selama ${value} jam.` };
    case "ticket_normal":
      return { label: "Tiket Spin Normal", icon: "🎟️", desc: `${value} tiket untuk Lucky Royale Normal.` };
    case "ticket_premium":
      return { label: "Tiket Spin Premium", icon: "🎫", desc: `${value} tiket untuk Lucky Royale Premium.` };
    case "lucky_draw_ticket":
      return { label: "Tiket Lucky Draw", icon: "🎰", desc: `${value} tiket untuk permainan Lucky Draw.` };
    case "fire_pass_card":
      return { label: "Kartu Fire Pass", icon: "🔥", desc: "Membuka jalur hadiah Premium Fire Pass season aktif." };
    case "anon_voucher":
      return { label: "Voucher Anon Chat", icon: "🥷", desc: `Kode aktivasi Premium Anon Chat selama ${value} hari.` };
    case "luck_discount_voucher":
      return { label: "Voucher Lucky Royale", icon: "🏷️", desc: `Diskon ${value}% untuk Lucky Royale, aktif selama 6 jam.` };
    default:
      return {
        label: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        icon: "🎁",
        desc: "Hadiah spesial dari flash deal",
      };
  }
}

export default function StreakShopFlashDeals({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [now, setNow] = useState(Date.now());
  const [deals, setDeals] = useState<Deal[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [userGems, setUserGems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [infoDeal, setInfoDeal] = useState<Deal | null>(null);
  const [payMethod, setPayMethod] = useState<Record<string, "coin" | "gem">>({});
  const [filter, setFilter] = useState<FilterKey>("all");
  const [resetting, setResetting] = useState(false);
  const [usedToday, setUsedToday] = useState(0);

  const refreshGemBalance = async () => {
    if (!visitorId) return 0;
    try {
      const { data, error } = await supabase.rpc("get_account_gems", { p_visitor_id: visitorId });
      if (error) throw error;
      const latestGems = Number(data) || 0;
      setUserGems(latestGems);
      return latestGems;
    } catch {
      return userGems;
    }
  };

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
      const [{ data, error }, { data: flashStatus }] = await Promise.all([
        supabase.functions.invoke("flash-deal-purchase", { body: { action: "list", visitorId } }),
        supabase.functions.invoke("mystery-shop", { body: { action: "flash_status", visitorId } }),
      ]);
      if (error) throw error;
      setDeals((data as any).deals || []);
      setIsPremium(!!(data as any).is_premium);
      setUserGems((data as any).user_gems ?? 0);
      setUsedToday(Number((flashStatus as any)?.usedToday || 0));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const resetFlashDeals = async () => {
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("mystery-shop", {
        body: { action: "reset_flash_daily", visitorId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "♻️ Flash Deal dibuka lagi", description: "Semua slot hari ini aktif kembali. Reset dapat diulang tanpa batas." });
      await load();
      onUpdate?.();
    } catch (e) {
      toast({ title: "Reset gagal", description: e instanceof Error ? e.message : "Terjadi kesalahan", variant: "destructive" });
    } finally {
      setResetting(false);
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
    const method = payMethod[deal.id] || "coin";

    // Pre-check gem balance biar gak error dari server
    if (method === "gem") {
      const gemCost = deal.cost_gems || 0;
      if (gemCost <= 0) {
        toast({ title: "Belum tersedia", description: "Deal ini belum bisa dibayar pakai Gem", variant: "destructive" });
        return;
      }
      const latestGems = await refreshGemBalance();
      if (latestGems < gemCost) {
        toast({
          title: `💎 Gem kurang (${latestGems}/${gemCost})`,
          description: "Bayar pakai Coin aja, atau beli Gem dulu di Shop.",
          variant: "destructive",
        });
        return;
      }
    }

    setBuying(deal.id);
    try {
      const { data, error } = await supabase.functions.invoke("flash-deal-purchase", {
        body: { action: "purchase", visitorId, dealId: deal.id, paymentMethod: method },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: `⚡ ${deal.name} Berhasil!`, description: (data as any).rewardSummary });
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

        {/* Gem balance info */}
        <div className="mb-2 flex items-center justify-between p-2 rounded-lg bg-gradient-to-r from-cyan-500/15 to-blue-500/15 border border-cyan-400/30">
          <div className="text-[10px] font-bold text-cyan-100">💎 Bisa bayar pakai Gem (lebih murah!)</div>
          <div className="text-[11px] font-black text-cyan-200 tabular-nums">{userGems} 💎</div>
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

        {/* Filter bar */}
        {(() => {
          const counts = {
            all: deals.length,
            free: deals.filter(d => !d.requires_premium).length,
            premium: deals.filter(d => d.requires_premium).length,
            cheap: deals.filter(d => Math.floor(d.original_cost * (1 - d.discount_pct / 100)) <= 500).length,
            best: deals.filter(d => d.discount_pct >= 55).length,
          };
          const tabs: { key: FilterKey; label: string; icon: any }[] = [
            { key: "all", label: `Semua (${counts.all})`, icon: Sparkles },
            { key: "best", label: `Terhemat (${counts.best})`, icon: TrendingUp },
            { key: "cheap", label: `Murah (${counts.cheap})`, icon: ZapIcon },
            { key: "free", label: `Reguler (${counts.free})`, icon: Tag },
            { key: "premium", label: `Premium (${counts.premium})`, icon: Crown },
          ];
          return (
            <div className="mb-3 -mx-1 px-1 flex gap-1.5 overflow-x-auto scrollbar-hide">
              {tabs.map(t => {
                const active = filter === t.key;
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => setFilter(t.key)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[10px] font-black whitespace-nowrap transition-all border ${
                      active
                        ? "bg-gradient-to-r from-orange-500 to-red-500 text-white border-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.6)]"
                        : "bg-black/40 text-orange-200/80 border-orange-400/20 hover:bg-black/60"
                    }`}
                  >
                    <Icon className="w-3 h-3" strokeWidth={2.8} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          );
        })()}

        <div className="grid grid-cols-2 gap-2">
          <AnimatePresence mode="popLayout">
            {deals
              .filter(d => {
                if (filter === "all") return true;
                if (filter === "free") return !d.requires_premium;
                if (filter === "premium") return d.requires_premium;
                if (filter === "cheap") return Math.floor(d.original_cost * (1 - d.discount_pct / 100)) <= 500;
                if (filter === "best") return d.discount_pct >= 55;
                return true;
              })
              .map((deal, i) => {
              const finalPrice = Math.floor(deal.original_cost * (1 - deal.discount_pct / 100));
              const locked = !deal.can_purchase;
              return (
                <motion.div
                  key={deal.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ delay: i * 0.04 }}
                  className={`relative overflow-hidden rounded-xl p-2.5 bg-gradient-to-br ${deal.gradient} border ${
                    deal.claimed_today
                      ? "border-green-400/60 ring-1 ring-green-400/40"
                      : deal.requires_premium
                      ? "border-yellow-300/60 ring-1 ring-yellow-300/40 shadow-[0_0_14px_rgba(250,204,21,0.25)]"
                      : "border-white/20"
                  }`}
                >
                  {/* shimmer */}
                  {!deal.claimed_today && (
                    <motion.div
                      aria-hidden
                      initial={{ x: "-120%" }}
                      animate={{ x: "120%" }}
                      transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 3 + (i % 3), ease: "easeInOut" }}
                      className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 pointer-events-none"
                    />
                  )}
                  {deal.badge && (
                    <div className="absolute top-1 right-1 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur z-10">
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
                      {(payMethod[deal.id] || "coin") === "gem" && deal.cost_gems > 0 ? (
                        <div className="text-sm font-black text-cyan-200 tabular-nums">{deal.cost_gems} 💎</div>
                      ) : (
                        <div className="text-sm font-black text-yellow-200 tabular-nums">{finalPrice} 🪙</div>
                      )}
                    </div>
                    <div className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[9px] font-black flex items-center gap-0.5">
                      <Tag className="w-2.5 h-2.5" strokeWidth={3} />
                      -{deal.discount_pct}%
                    </div>
                  </div>

                  {/* Toggle Coin / Gem */}
                  {deal.cost_gems > 0 && !deal.claimed_today && (
                    <div className="flex gap-1 mb-1.5 p-0.5 rounded-lg bg-black/40 border border-white/10">
                      <button
                        onClick={() => setPayMethod((p) => ({ ...p, [deal.id]: "coin" }))}
                        className={`flex-1 py-1 rounded text-[9px] font-black tabular-nums transition ${
                          (payMethod[deal.id] || "coin") === "coin"
                            ? "bg-yellow-500 text-black"
                            : "text-yellow-200/70 hover:text-yellow-200"
                        }`}
                      >
                        🪙 {finalPrice}
                      </button>
                      <button
                        onClick={() => setPayMethod((p) => ({ ...p, [deal.id]: "gem" }))}
                        className={`flex-1 py-1 rounded text-[9px] font-black tabular-nums transition ${
                          (payMethod[deal.id] || "coin") === "gem"
                            ? "bg-cyan-400 text-black"
                            : "text-cyan-200/70 hover:text-cyan-200"
                        }`}
                      >
                        💎 {deal.cost_gems}
                      </button>
                    </div>
                  )}

                  <Button
                    onClick={() => handleBuy(deal)}
                    disabled={buying === deal.id || deal.claimed_today || deal.owned}
                    className={`w-full h-7 text-[10px] font-black uppercase tracking-wider ${
                      deal.claimed_today || deal.owned
                        ? "bg-green-600/40 text-green-200 cursor-not-allowed"
                        : locked
                        ? "bg-black/40 text-white/60 hover:bg-black/50"
                        : (payMethod[deal.id] || "coin") === "gem"
                        ? "bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white"
                        : "bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                    }`}
                  >
                    {buying === deal.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : deal.owned ? (
                      <span className="flex items-center gap-1"><Check className="w-3 h-3" strokeWidth={3} />Sudah dibeli</span>
                    ) : deal.claimed_today ? (
                      <span className="flex items-center gap-1"><Check className="w-3 h-3" strokeWidth={3} />Sudah hari ini</span>
                    ) : deal.locked_reason === "premium_required" ? (
                      <span className="flex items-center gap-1"><Lock className="w-3 h-3" />Premium Only</span>
                    ) : (payMethod[deal.id] || "coin") === "gem" ? (
                      `Beli ${deal.cost_gems} 💎`
                    ) : (
                      `Beli ${finalPrice} 🪙`
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
        <div className="mt-2 rounded-xl border border-amber-400/40 bg-amber-500/10 p-2.5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] font-black text-amber-100">RESET DISKON KILAT</div>
              <div className="text-[9px] text-amber-100/70">{usedToday} pembelian hari ini · tanpa batas reset</div>
            </div>
            <span className="text-[10px] font-black text-cyan-200">500 💎</span>
          </div>
          <Button className="h-8 w-full text-[10px] font-black" disabled={resetting || usedToday < 1} onClick={resetFlashDeals}>
            {resetting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Buka Semua Deal Lagi"}
          </Button>
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
                <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-500/30 to-cyan-500/30 border border-emerald-400/40">
                  <div className="text-[10px] font-black uppercase tracking-wider text-emerald-100 mb-2">🎁 Yang Kamu Dapat</div>
                  {(() => {
                    const info = getRewardInfo(infoDeal.reward_type, infoDeal.reward_value);
                    return (
                      <>
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-11 h-11 rounded-xl bg-black/40 flex items-center justify-center text-2xl flex-shrink-0">
                            {info.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-black text-yellow-200">{info.label}</div>
                            <div className="text-[10px] text-white/80 leading-tight">{info.desc}</div>
                          </div>
                        </div>
                        {info.items && info.items.length > 0 && (
                          <div className="space-y-1 pt-2 border-t border-white/10">
                            <div className="text-[9px] font-black uppercase tracking-wider text-white/60 mb-1">Isi Lengkap:</div>
                            {info.items.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-[11px] text-white">
                                <span className="text-base flex-shrink-0">{item.icon}</span>
                                <span className="font-semibold">{item.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
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
                {infoDeal.cost_gems > 0 && (
                  <div className="flex justify-between items-center p-2.5 rounded-xl bg-gradient-to-r from-cyan-500/30 to-blue-500/30 border border-cyan-400/40">
                    <span className="text-[11px] font-black text-white">Bayar pakai Gem 💎</span>
                    <span className="text-base font-black text-cyan-200 tabular-nums">{infoDeal.cost_gems} 💎</span>
                  </div>
                )}
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
