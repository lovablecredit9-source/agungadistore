import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Zap, Sparkles, Crown, CalendarCheck, Trophy, Lock, Coins, Clock,
  Gift, Flame, Star,
} from "lucide-react";

interface Props {
  visitorId: string;
  onUpdate?: () => void;
}

const RARITY_GLOW: Record<string, string> = {
  common: "shadow-slate-500/30",
  rare: "shadow-sky-500/40",
  epic: "shadow-fuchsia-500/50",
  legendary: "shadow-amber-400/60",
};

const RARITY_BG: Record<string, string> = {
  common: "from-slate-700/50 to-slate-800/50 border-slate-500/40",
  rare: "from-sky-700/40 to-blue-800/40 border-sky-400/50",
  epic: "from-fuchsia-700/40 to-purple-800/40 border-fuchsia-400/50",
  legendary: "from-amber-600/40 to-orange-700/40 border-amber-300/60",
};

function fmtTimer(s: number) {
  if (s <= 0) return "00:00:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function fmtVipExpiry(iso: string | null) {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Habis";
  const days = Math.floor(ms / (24 * 3600 * 1000));
  const hours = Math.floor((ms % (24 * 3600 * 1000)) / (3600 * 1000));
  return days > 0 ? `${days}h ${hours}j` : `${hours} jam`;
}

export default function ShopExtras({ visitorId, onUpdate }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [gachaResult, setGachaResult] = useState<any>(null);
  const [tick, setTick] = useState(0);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const { data: res, error } = await supabase.functions.invoke("streak-event-shop", {
      body: { action: "extras_overview", visitorId },
    });
    if (error || res?.error) {
      toast({ title: "Gagal memuat", description: res?.error || error?.message, variant: "destructive" });
    } else {
      setData(res);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [visitorId]);

  // Tick every second for countdowns
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const callAction = async (action: string, payload: any, key: string) => {
    setBusyKey(key);
    const { data: res, error } = await supabase.functions.invoke("streak-event-shop", {
      body: { action, visitorId, ...payload },
    });
    setBusyKey(null);
    if (error || res?.error) {
      toast({ title: "Gagal", description: res?.error || error?.message, variant: "destructive" });
      return null;
    }
    return res;
  };

  const buyFlash = async (deal: any) => {
    const res = await callAction("buy_flash", { dealId: deal.id }, `flash:${deal.id}`);
    if (res?.success) {
      toast({ title: `⚡ ${deal.name}`, description: `${res.reward_label} • -${res.cost} coins` });
      load(); onUpdate?.();
    }
  };

  const spinGacha = async (isFree = false) => {
    const res = await callAction("gacha_spin", { isFree }, `gacha:${isFree ? "free" : "paid"}`);
    if (res?.success) {
      setGachaResult(res.reward);
      load(); onUpdate?.();
    }
  };

  const buyVip = async () => {
    const res = await callAction("buy_vip", {}, "vip");
    if (res?.success) {
      toast({ title: "👑 VIP Aktif!", description: `Diskon ekstra 20% selama 7 hari • -${res.cost} coins` });
      load(); onUpdate?.();
    }
  };

  const claimLogin = async (day: number) => {
    const res = await callAction("claim_login_day", { day }, `login:${day}`);
    if (res?.success) {
      toast({ title: `🎁 Hari ${day}`, description: res.reward_label });
      load(); onUpdate?.();
    }
  };

  const buyAchievement = async (item: any) => {
    const res = await callAction("buy_achievement", { itemId: item.id }, `ach:${item.id}`);
    if (res?.success) {
      toast({ title: `🏆 ${item.name}`, description: `${res.reward_label} • -${res.cost} coins` });
      load(); onUpdate?.();
    }
  };

  if (loading) {
    return (
      <div className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-950/30 to-rose-950/30 p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-amber-300" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-3">
      {/* VIP STATUS BAR */}
      {data.vip.active && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-amber-300/60 bg-gradient-to-r from-amber-500/30 via-yellow-400/30 to-amber-500/30 p-2.5 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-200" />
              <div>
                <div className="text-xs font-bold text-amber-100">VIP Aktif</div>
                <div className="text-[10px] text-amber-100/80">Sisa: {fmtVipExpiry(data.vip.expires_at)}</div>
              </div>
            </div>
            {data.vip.free_box_ready && (
              <Badge className="bg-green-500/40 text-green-100 border-green-400/60 text-[10px] animate-pulse">
                🎁 Free Spin Siap!
              </Badge>
            )}
          </div>
        </motion.div>
      )}

      <Tabs defaultValue="flash" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-slate-900/60 border border-white/10 h-auto p-1">
          <TabsTrigger value="flash" className="text-[10px] py-1.5 data-[state=active]:bg-rose-600/40">
            <Zap className="h-3 w-3 mr-0.5" />Flash
          </TabsTrigger>
          <TabsTrigger value="gacha" className="text-[10px] py-1.5 data-[state=active]:bg-fuchsia-600/40">
            <Sparkles className="h-3 w-3 mr-0.5" />Gacha
          </TabsTrigger>
          <TabsTrigger value="vip" className="text-[10px] py-1.5 data-[state=active]:bg-amber-600/40">
            <Crown className="h-3 w-3 mr-0.5" />VIP
          </TabsTrigger>
          <TabsTrigger value="login" className="text-[10px] py-1.5 data-[state=active]:bg-emerald-600/40">
            <CalendarCheck className="h-3 w-3 mr-0.5" />Login
          </TabsTrigger>
          <TabsTrigger value="achievement" className="text-[10px] py-1.5 data-[state=active]:bg-purple-600/40">
            <Trophy className="h-3 w-3 mr-0.5" />Elite
          </TabsTrigger>
        </TabsList>

        {/* FLASH DEALS */}
        <TabsContent value="flash" className="mt-3 space-y-2">
          {data.flash_deals.length === 0 && (
            <div className="text-center text-xs text-white/60 py-6">Tidak ada flash deal aktif sekarang</div>
          )}
          {data.flash_deals.map((d: any) => {
            const liveSecs = Math.max(0, d.seconds_left - Math.floor(tick));
            const stockPct = (d.remaining / d.total_stock) * 100;
            const savedPct = Math.round((1 - d.flash_price / d.original_price) * 100);
            return (
              <motion.div
                key={d.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-rose-500/40 bg-gradient-to-br from-rose-950/50 to-orange-950/50 p-3 backdrop-blur-xl relative overflow-hidden"
              >
                <motion.div
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-gradient-to-r from-rose-500/0 via-rose-500/10 to-rose-500/0 pointer-events-none"
                />
                <div className="relative">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl shrink-0">{d.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                        <h4 className="font-bold text-white text-sm truncate">{d.name}</h4>
                        <Badge className="bg-rose-500/40 text-rose-100 border-rose-300/60 text-[9px] px-1 py-0 h-4">
                          🔥 -{savedPct}%
                        </Badge>
                      </div>
                      <p className="text-[11px] text-rose-100/80 line-clamp-1">{d.reward_label}</p>
                    </div>
                  </div>
                  {/* Timer + Stock */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="rounded-lg bg-black/30 p-1.5 border border-rose-500/30">
                      <div className="flex items-center gap-1 text-[9px] text-rose-200/70 uppercase">
                        <Clock className="h-2.5 w-2.5" />Sisa Waktu
                      </div>
                      <div className="font-mono text-xs font-bold text-rose-200">{fmtTimer(liveSecs)}</div>
                    </div>
                    <div className="rounded-lg bg-black/30 p-1.5 border border-rose-500/30">
                      <div className="flex items-center gap-1 text-[9px] text-rose-200/70 uppercase">
                        <Flame className="h-2.5 w-2.5" />Stok
                      </div>
                      <div className="text-xs font-bold text-rose-200">{d.remaining}/{d.total_stock}</div>
                      <div className="h-1 mt-0.5 rounded-full bg-black/40 overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-rose-400 to-orange-400"
                          initial={{ width: 0 }}
                          animate={{ width: `${stockPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-rose-500/30">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-white/50 line-through">{d.original_price}</span>
                      <span className="text-base font-bold text-yellow-300 flex items-center gap-0.5">
                        <Coins className="h-3.5 w-3.5" />{d.final_price}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      disabled={!d.can_buy || busyKey === `flash:${d.id}` || liveSecs === 0}
                      onClick={() => buyFlash(d)}
                      className="bg-gradient-to-r from-rose-500 to-orange-500 text-white text-xs h-8"
                    >
                      {busyKey === `flash:${d.id}` ? <Loader2 className="h-3 w-3 animate-spin" />
                        : d.already_bought ? "Sudah Dibeli"
                        : liveSecs === 0 ? "Berakhir"
                        : d.remaining === 0 ? "Habis"
                        : "Sambar!"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </TabsContent>

        {/* GACHA */}
        <TabsContent value="gacha" className="mt-3 space-y-2">
          <motion.div
            className="rounded-3xl border-2 border-fuchsia-400/50 bg-gradient-to-br from-fuchsia-900/60 via-purple-900/60 to-violet-950/70 p-4 backdrop-blur-xl text-center relative overflow-hidden"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              className="absolute -top-10 -right-10 text-9xl opacity-10 select-none"
            >
              ✨
            </motion.div>
            <div className="text-5xl mb-2">🎰</div>
            <h3 className="text-lg font-black text-white">Lucky Spin Wheel</h3>
            <p className="text-xs text-fuchsia-200/80 mb-3">Putar untuk hadiah random Common-Legendary!</p>
            <div className="flex flex-wrap justify-center gap-1 mb-3">
              {data.gacha_items.map((it: any) => (
                <Badge key={it.id} className={`text-[9px] px-1.5 py-0 h-4 bg-gradient-to-r ${RARITY_BG[it.rarity]} border`}>
                  {it.icon} {it.rarity}
                </Badge>
              ))}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                disabled={busyKey === "gacha:paid"}
                onClick={() => spinGacha(false)}
                className="bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white"
              >
                {busyKey === "gacha:paid" ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <><Sparkles className="h-4 w-4 mr-1" />Putar • {data.gacha_spin_cost} <Coins className="h-3 w-3 ml-1" /></>
                )}
              </Button>
              {data.vip.active && data.vip.free_box_ready && (
                <Button
                  disabled={busyKey === "gacha:free"}
                  onClick={() => spinGacha(true)}
                  className="bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 font-bold"
                >
                  {busyKey === "gacha:free" ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <><Crown className="h-4 w-4 mr-1" />FREE VIP Spin (Daily)</>
                  )}
                </Button>
              )}
            </div>
            {data.gacha_history.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/10 text-left">
                <div className="text-[10px] text-fuchsia-200/70 uppercase mb-1">Riwayat Spin</div>
                <div className="flex flex-wrap gap-1">
                  {data.gacha_history.map((h: any) => (
                    <Badge key={h.id} className={`text-[9px] px-1.5 py-0 h-4 bg-gradient-to-r ${RARITY_BG[h.rarity]} border`}>
                      {h.reward_label}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </TabsContent>

        {/* VIP MEMBERSHIP */}
        <TabsContent value="vip" className="mt-3">
          <motion.div
            className="rounded-3xl border-2 border-amber-300/60 bg-gradient-to-br from-amber-600/30 via-yellow-500/20 to-orange-600/30 p-4 backdrop-blur-xl relative overflow-hidden"
          >
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-center text-6xl mb-2"
            >
              👑
            </motion.div>
            <h3 className="text-xl font-black text-amber-100 text-center">VIP Membership Pass</h3>
            <p className="text-xs text-amber-100/80 text-center mb-3">7 hari penuh keuntungan eksklusif</p>

            <div className="space-y-1.5 mb-3">
              {[
                { icon: "💸", text: "Diskon EKSTRA 20% di semua item" },
                { icon: "🎰", text: "1 FREE Gacha Spin setiap hari" },
                { icon: "⚡", text: "Akses prioritas ke Flash Deals" },
                { icon: "🏆", text: "Badge VIP eksklusif di leaderboard" },
                { icon: "🎁", text: "Bonus reward dari semua pembelian" },
              ].map((b, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-2 text-xs text-amber-50 bg-black/30 rounded-lg px-2.5 py-1.5"
                >
                  <span className="text-base">{b.icon}</span>
                  <span>{b.text}</span>
                </motion.div>
              ))}
            </div>

            {data.vip.active ? (
              <div className="text-center">
                <Badge className="bg-green-500/40 text-green-100 border-green-400/60 mb-2">
                  ✅ Aktif • Sisa {fmtVipExpiry(data.vip.expires_at)}
                </Badge>
                <Button
                  disabled={busyKey === "vip"}
                  onClick={buyVip}
                  variant="outline"
                  className="w-full border-amber-300/60 text-amber-100 hover:bg-amber-500/20"
                >
                  {busyKey === "vip" ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    <>Perpanjang +7 hari • {data.vip.price_coins} <Coins className="h-3 w-3 ml-1" /></>
                  )}
                </Button>
              </div>
            ) : (
              <Button
                disabled={busyKey === "vip"}
                onClick={buyVip}
                className="w-full bg-gradient-to-r from-amber-400 to-yellow-500 text-amber-950 font-black text-base h-11"
              >
                {busyKey === "vip" ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <><Crown className="h-5 w-5 mr-1" />Aktifkan VIP • {data.vip.price_coins} <Coins className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            )}
          </motion.div>
        </TabsContent>

        {/* LOGIN CALENDAR */}
        <TabsContent value="login" className="mt-3 space-y-2">
          <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 to-teal-950/40 p-2.5 text-center">
            <div className="text-xs text-emerald-200">Hari ke-{data.login_calendar.current_day}/30 dalam siklus ini</div>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {data.login_calendar.rewards.map((r: any) => (
              <motion.button
                key={r.day}
                whileTap={{ scale: 0.95 }}
                disabled={!r.claimable || busyKey === `login:${r.day}`}
                onClick={() => claimLogin(r.day)}
                className={`relative rounded-xl border p-1.5 text-center transition-all ${
                  r.claimed
                    ? "bg-emerald-900/30 border-emerald-500/30 opacity-60"
                    : r.claimable
                    ? r.is_milestone
                      ? "bg-gradient-to-br from-amber-500/40 to-orange-600/40 border-amber-300/70 shadow-lg shadow-amber-500/30 animate-pulse"
                      : "bg-gradient-to-br from-emerald-500/30 to-teal-600/30 border-emerald-400/60"
                    : r.is_milestone
                    ? "bg-amber-950/30 border-amber-500/20"
                    : "bg-slate-900/40 border-white/10"
                }`}
              >
                <div className="text-[9px] text-white/60">D{r.day}</div>
                <div className="text-base">{r.icon}</div>
                {r.claimed && (
                  <div className="absolute inset-0 flex items-center justify-center bg-emerald-900/50 rounded-xl">
                    <span className="text-emerald-300 text-lg">✓</span>
                  </div>
                )}
                {r.is_today && !r.claimed && (
                  <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-yellow-400 animate-ping" />
                )}
              </motion.button>
            ))}
          </div>
          <div className="text-[10px] text-white/60 text-center">
            🌟 Hari 7, 14, 21, 30 = milestone reward besar
          </div>
        </TabsContent>

        {/* ACHIEVEMENT */}
        <TabsContent value="achievement" className="mt-3 space-y-2">
          <div className="rounded-2xl border border-purple-500/40 bg-gradient-to-r from-purple-950/40 to-fuchsia-950/40 p-2.5 text-center">
            <div className="text-xs text-purple-200">
              💰 Total Spending: <span className="font-bold text-yellow-300">{data.lifetime_spent.toLocaleString()}</span> coins
            </div>
            <div className="text-[10px] text-purple-200/70">Belanja lebih banyak untuk unlock item Elite!</div>
          </div>
          {data.achievement_items.map((item: any) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border p-3 backdrop-blur-xl relative overflow-hidden ${
                item.unlocked
                  ? "border-purple-400/60 bg-gradient-to-br from-purple-900/50 to-fuchsia-900/50"
                  : "border-slate-600/40 bg-gradient-to-br from-slate-900/60 to-slate-950/60"
              }`}
            >
              {!item.unlocked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                  <div className="text-center">
                    <Lock className="h-6 w-6 mx-auto text-white/60 mb-1" />
                    <div className="text-xs text-white/80 font-bold">
                      Spending {item.unlock_threshold.toLocaleString()} coins
                    </div>
                    <div className="text-[10px] text-white/60">Progress: {item.progress_pct}%</div>
                    <div className="h-1.5 w-32 mx-auto mt-1 rounded-full bg-black/40 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-purple-400 to-fuchsia-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${item.progress_pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <div className="text-3xl shrink-0">{item.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h4 className="font-bold text-white text-sm">{item.name}</h4>
                    {item.unlocked && <Badge className="bg-purple-500/40 text-purple-100 border-purple-300/60 text-[9px] px-1 py-0 h-4">ELITE</Badge>}
                  </div>
                  <p className="text-[11px] text-white/70 line-clamp-1">{item.description}</p>
                  <p className="text-[10px] text-yellow-200/80 mt-0.5">🎁 {item.reward_label}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10">
                <span className="text-base font-bold text-yellow-300 flex items-center gap-0.5">
                  <Coins className="h-3.5 w-3.5" />{item.final_price}
                </span>
                <Button
                  size="sm"
                  disabled={!item.can_buy || busyKey === `ach:${item.id}`}
                  onClick={() => buyAchievement(item)}
                  className="bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white text-xs h-8"
                >
                  {busyKey === `ach:${item.id}` ? <Loader2 className="h-3 w-3 animate-spin" />
                    : item.already_bought ? "Dimiliki"
                    : "Klaim Elite"}
                </Button>
              </div>
            </motion.div>
          ))}
        </TabsContent>
      </Tabs>

      {/* GACHA RESULT DIALOG */}
      <Dialog open={!!gachaResult} onOpenChange={() => setGachaResult(null)}>
        <DialogContent className={`bg-gradient-to-br ${gachaResult ? RARITY_BG[gachaResult.rarity] : ""} border-2 max-w-sm`}>
          <DialogHeader>
            <DialogTitle className="text-center text-white">
              {gachaResult?.rarity === "legendary" ? "🌟 LEGENDARY!" : gachaResult?.rarity === "epic" ? "✨ EPIC!" : "🎁 Hadiah Gacha"}
            </DialogTitle>
          </DialogHeader>
          {gachaResult && (
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", duration: 0.6 }}
              className={`text-center p-6 ${RARITY_GLOW[gachaResult.rarity]} shadow-2xl`}
            >
              <div className="text-7xl mb-3">{gachaResult.icon}</div>
              <Badge className={`bg-gradient-to-r ${RARITY_BG[gachaResult.rarity]} border text-xs mb-2`}>
                {gachaResult.rarity?.toUpperCase()}
              </Badge>
              <h4 className="text-xl font-black text-white mb-1">{gachaResult.name}</h4>
              <p className="text-sm text-yellow-200">{gachaResult.reward_label}</p>
              <Button onClick={() => setGachaResult(null)} className="mt-4 bg-white/20 hover:bg-white/30 text-white">
                Ambil
              </Button>
            </motion.div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
