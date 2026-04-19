import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Heart, Crown, Sparkles, Box as BoxIcon, ShoppingBag, Calendar,
  Trophy, Clock, Coins, Flame, Star, Lock, TrendingUp, Gem,
} from "lucide-react";
import ShopExtras from "./ShopExtras";

interface Props {
  visitorId: string;
  onUpdate?: () => void;
}

interface OverviewData {
  tier: { tier: string; discount: number; icon: string; nextTier?: string; nextRequired?: number };
  lifetime_spent: number;
  bundles: any[];
  mystery_boxes: any[];
  daily_items: any[];
  seconds_to_reset: number;
  activity_feed: any[];
  top_spenders: any[];
}

const RARITY_STYLES: Record<string, string> = {
  common: "from-slate-400/20 to-slate-500/20 border-slate-400/40 text-slate-200",
  rare: "from-sky-400/30 to-blue-500/30 border-sky-400/50 text-sky-100",
  epic: "from-fuchsia-500/30 to-purple-600/30 border-fuchsia-400/50 text-fuchsia-100",
  legendary: "from-amber-400/40 to-orange-500/40 border-amber-300/60 text-amber-100",
};

const TIER_STYLES: Record<string, string> = {
  Newbie: "from-emerald-500/20 to-teal-500/20 border-emerald-400/40",
  Bronze: "from-amber-700/30 to-orange-700/30 border-amber-600/50",
  Silver: "from-slate-300/30 to-slate-400/30 border-slate-300/50",
  Gold: "from-yellow-400/30 to-amber-500/30 border-yellow-400/60",
  Diamond: "from-cyan-300/40 to-violet-500/40 border-cyan-300/70",
};

function fmtCountdown(s: number) {
  if (s <= 0) return "00:00:00";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function StreakEventShop({ visitorId, onUpdate }: Props) {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openResult, setOpenResult] = useState<any>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [userGems, setUserGems] = useState(0);
  const [userCoins, setUserCoins] = useState(0);
  const { toast } = useToast();

  const loadCurrencies = async () => {
    try {
      const { data: g } = await supabase.rpc("get_account_gems", { p_visitor_id: visitorId });
      setUserGems(Number(g) || 0);
    } catch {
      const { data: gp } = await supabase.from("game_profiles").select("gems").eq("visitor_id", visitorId).maybeSingle();
      setUserGems((gp as any)?.gems || 0);
    }
    const { data: streak } = await supabase.from("daily_streaks").select("streak_coins").eq("visitor_id", visitorId).maybeSingle();
    setUserCoins((streak as any)?.streak_coins || 0);
  };

  const load = async () => {
    setLoading(true);
    const { data: res, error } = await supabase.functions.invoke("streak-event-shop", {
      body: { action: "overview", visitorId },
    });
    if (error || res?.error) {
      toast({ title: "Gagal memuat", description: res?.error || error?.message, variant: "destructive" });
    } else {
      setData(res);
      setSecondsLeft(res.seconds_to_reset || 0);
    }
    await loadCurrencies();
    setLoading(false);
  };

  useEffect(() => { load(); }, [visitorId]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [secondsLeft]);

  // Realtime activity feed
  useEffect(() => {
    const channel = supabase
      .channel("event_shop_feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "event_shop_activity_feed" }, () => {
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const callAction = async (action: string, payload: any, busyKey: string) => {
    setBusyId(busyKey);
    const { data: res, error } = await supabase.functions.invoke("streak-event-shop", {
      body: { action, visitorId, ...payload },
    });
    setBusyId(null);
    if (error || res?.error) {
      toast({ title: "Gagal", description: res?.error || error?.message, variant: "destructive" });
      return null;
    }
    return res;
  };

  const buyBundle = async (b: any, paymentMethod: "coin" | "gem" = "coin") => {
    const res = await callAction("buy_bundle", { bundleId: b.id, paymentMethod }, `bundle:${b.id}:${paymentMethod}`);
    if (res?.success) {
      const unit = paymentMethod === "gem" ? "💎" : "🪙";
      toast({ title: `🎁 ${b.name}`, description: `Berhasil dibeli! -${res.cost} ${unit}` });
      load();
      onUpdate?.();
    }
  };

  const openBox = async (b: any, paymentMethod: "coin" | "gem" = "coin") => {
    const res = await callAction("open_box", { boxId: b.id, paymentMethod }, `box:${b.id}:${paymentMethod}`);
    if (res?.success) {
      setOpenResult({ box: b, reward: res.reward, cost: res.cost });
      load();
      onUpdate?.();
    }
  };

  const buyDaily = async (item: any, paymentMethod: "coin" | "gem" = "coin") => {
    const res = await callAction("buy_daily", { itemId: item.item_id, paymentMethod }, `daily:${item.item_id}:${paymentMethod}`);
    if (res?.success) {
      const unit = paymentMethod === "gem" ? "💎" : "🪙";
      toast({ title: `✨ ${item.name}`, description: `${res.reward_label} • -${res.cost} ${unit}` });
      load();
      onUpdate?.();
    }
  };

  const toggleWishlist = async (kind: string, id: string) => {
    const res = await callAction("toggle_wishlist", { itemKind: kind, itemId: id }, `wish:${id}`);
    if (res?.success) {
      load();
    }
  };

  const tierProgress = useMemo(() => {
    if (!data) return 0;
    const t = data.tier;
    if (!t.nextRequired) return 100;
    const prevThreshold = t.tier === "Newbie" ? 0 : t.tier === "Bronze" ? 1000 : t.tier === "Silver" ? 5000 : t.tier === "Gold" ? 20000 : 50000;
    const span = t.nextRequired - prevThreshold;
    const progress = ((data.lifetime_spent - prevThreshold) / span) * 100;
    return Math.min(100, Math.max(0, progress));
  }, [data]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-950/40 via-purple-950/40 to-slate-950/60 p-8 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-fuchsia-300" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-3">
      {/* HEADER + TIER CARD */}
      <div className={`rounded-3xl border bg-gradient-to-br ${TIER_STYLES[data.tier.tier] || TIER_STYLES.Newbie} p-4 backdrop-blur-xl`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-white/70 uppercase tracking-wider mb-1">
              <Sparkles className="h-3.5 w-3.5" /> Event Shop
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-3xl">{data.tier.icon}</span>
              <div>
                <div className="text-lg font-black text-white leading-tight">{data.tier.tier} Member</div>
                <div className="text-xs text-white/70">Diskon otomatis {data.tier.discount}%</div>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-white/60 uppercase">Total Spending</div>
            <div className="text-base font-bold text-white flex items-center gap-1 justify-end">
              <Coins className="h-3.5 w-3.5 text-yellow-300" />
              {data.lifetime_spent.toLocaleString()}
            </div>
          </div>
        </div>
        {data.tier.nextTier && (
          <div className="mt-3">
            <div className="flex justify-between text-[10px] text-white/70 mb-1">
              <span>Menuju {data.tier.nextTier}</span>
              <span>{data.lifetime_spent.toLocaleString()} / {data.tier.nextRequired?.toLocaleString()}</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/40 overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-300 to-pink-400"
                initial={{ width: 0 }}
                animate={{ width: `${tierProgress}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* TABS */}
      <Tabs defaultValue="bundles" className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-slate-900/60 border border-white/10 h-auto p-1">
          <TabsTrigger value="bundles" className="text-[10px] py-1.5 data-[state=active]:bg-fuchsia-600/40">
            <ShoppingBag className="h-3 w-3 mr-0.5" />Paket
          </TabsTrigger>
          <TabsTrigger value="mystery" className="text-[10px] py-1.5 data-[state=active]:bg-purple-600/40">
            <BoxIcon className="h-3 w-3 mr-0.5" />Box
          </TabsTrigger>
          <TabsTrigger value="daily" className="text-[10px] py-1.5 data-[state=active]:bg-pink-600/40">
            <Calendar className="h-3 w-3 mr-0.5" />Harian
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="text-[10px] py-1.5 data-[state=active]:bg-amber-600/40">
            <Trophy className="h-3 w-3 mr-0.5" />Top
          </TabsTrigger>
          <TabsTrigger value="feed" className="text-[10px] py-1.5 data-[state=active]:bg-cyan-600/40">
            <TrendingUp className="h-3 w-3 mr-0.5" />Live
          </TabsTrigger>
        </TabsList>

        {/* BUNDLES */}
        <TabsContent value="bundles" className="mt-3 space-y-2">
          {data.bundles.length === 0 && (
            <div className="text-center text-xs text-white/60 py-6">Belum ada bundle aktif</div>
          )}
          {data.bundles.map((b) => {
            const savedPct = Math.round((1 - b.price_coins / b.original_price) * 100);
            return (
              <motion.div
                key={b.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-950/50 to-purple-950/50 p-3 backdrop-blur-xl"
              >
                <div className="flex items-start gap-3">
                  <div className="text-3xl shrink-0">{b.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h4 className="font-bold text-white text-sm truncate">{b.name}</h4>
                      <Badge className="bg-rose-500/30 text-rose-100 border-rose-400/50 text-[9px] px-1 py-0 h-4">-{savedPct}%</Badge>
                    </div>
                    <p className="text-[11px] text-white/70 line-clamp-1 mb-1">{b.description}</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(b.contents as any[]).slice(0, 4).map((c: any, i: number) => (
                        <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/10">
                          {c.label}
                        </span>
                      ))}
                      {b.contents.length > 4 && (
                        <span className="text-[10px] text-white/60">+{b.contents.length - 4}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleWishlist("bundle", b.id)}
                    className="shrink-0"
                    aria-label="wishlist"
                  >
                    <Heart className={`h-4 w-4 ${b.is_wishlisted ? "fill-pink-400 text-pink-400" : "text-white/40"}`} />
                  </button>
                </div>
                <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-white/60">Limit {b.weekly_used}/{b.weekly_limit} per minggu</div>
                    {b.tier_discount_pct > 0 && (
                      <Badge className="bg-cyan-500/20 text-cyan-100 border-cyan-400/40 text-[9px] px-1 py-0 h-4">
                        {data.tier.icon} -{b.tier_discount_pct}%
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-stretch gap-1.5">
                    <Button
                      size="sm"
                      disabled={!b.can_buy || busyId?.startsWith(`bundle:${b.id}`) || userCoins < b.final_price}
                      onClick={() => buyBundle(b, "coin")}
                      className="flex-1 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/50 text-yellow-100 text-[11px] font-bold h-9 px-2 disabled:opacity-50"
                    >
                      {busyId === `bundle:${b.id}:coin` ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <span className="flex items-center gap-1 tabular-nums">
                          <Coins className="h-3.5 w-3.5" />
                          <span className="text-[9px] line-through opacity-60 mr-0.5">{b.original_price}</span>
                          {b.final_price}
                        </span>
                      )}
                    </Button>
                    {b.final_gem_price > 0 && (
                      <Button
                        size="sm"
                        disabled={!b.can_buy || busyId?.startsWith(`bundle:${b.id}`) || userGems < b.final_gem_price}
                        onClick={() => buyBundle(b, "gem")}
                        className="flex-1 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-100 text-[11px] font-bold h-9 px-2 disabled:opacity-50"
                      >
                        {busyId === `bundle:${b.id}:gem` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <span className="flex items-center gap-1 tabular-nums">
                            <Gem className="h-3.5 w-3.5" />
                            {b.final_gem_price}
                          </span>
                        )}
                      </Button>
                    )}
                  </div>
                  {!b.can_buy && (
                    <div className="text-[10px] text-rose-300 flex items-center gap-1"><Lock className="h-3 w-3" />Limit minggu ini sudah tercapai</div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </TabsContent>

        {/* MYSTERY BOX */}
        <TabsContent value="mystery" className="mt-3 space-y-2">
          {data.mystery_boxes.length === 0 && (
            <div className="text-center text-xs text-white/60 py-6">Belum ada mystery box</div>
          )}
          {data.mystery_boxes.map((b) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/50 to-violet-950/50 p-3 backdrop-blur-xl relative overflow-hidden"
            >
              <div className="absolute -top-4 -right-4 text-7xl opacity-10 select-none">{b.icon}</div>
              <div className="flex items-start gap-3 relative">
                <div className="text-3xl shrink-0">{b.icon}</div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-white text-sm">{b.name}</h4>
                  <p className="text-[11px] text-white/70 line-clamp-2">{b.description}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(b.rarity_pool as any[]).map((p: any, i: number) => (
                      <Badge key={i} className={`text-[9px] px-1 py-0 h-4 bg-gradient-to-r ${RARITY_STYLES[p.rarity] || ""} border`}>
                        {p.rarity} {Math.round((p.weight / b.rarity_pool.reduce((s: number, x: any) => s + x.weight, 0)) * 100)}%
                      </Badge>
                    ))}
                  </div>
                </div>
                <button onClick={() => toggleWishlist("box", b.id)} className="shrink-0">
                  <Heart className={`h-4 w-4 ${b.is_wishlisted ? "fill-pink-400 text-pink-400" : "text-white/40"}`} />
                </button>
              </div>
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/10 relative gap-2">
                <div className="flex items-center gap-1.5">
                  {b.tier_discount_pct > 0 && (
                    <Badge className="bg-cyan-500/20 text-cyan-100 border-cyan-400/40 text-[9px] px-1 py-0 h-4">
                      -{b.tier_discount_pct}%
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    disabled={busyId === `box:${b.id}:coin` || userCoins < b.final_price}
                    onClick={() => openBox(b, "coin")}
                    className="bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/50 text-yellow-100 text-[11px] font-bold h-8 px-2 disabled:opacity-50"
                  >
                    {busyId === `box:${b.id}:coin` ? <Loader2 className="h-3 w-3 animate-spin" /> :
                      <span className="flex items-center gap-1 tabular-nums"><Coins className="h-3.5 w-3.5" />{b.final_price}</span>}
                  </Button>
                  {b.final_gem_price > 0 && (
                    <Button
                      size="sm"
                      disabled={busyId === `box:${b.id}:gem` || userGems < b.final_gem_price}
                      onClick={() => openBox(b, "gem")}
                      className="bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-100 text-[11px] font-bold h-8 px-2 disabled:opacity-50"
                    >
                      {busyId === `box:${b.id}:gem` ? <Loader2 className="h-3 w-3 animate-spin" /> :
                        <span className="flex items-center gap-1 tabular-nums"><Gem className="h-3.5 w-3.5" />{b.final_gem_price}</span>}
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </TabsContent>

        {/* DAILY ROTATION */}
        <TabsContent value="daily" className="mt-3 space-y-2">
          <div className="rounded-2xl border border-pink-500/30 bg-gradient-to-r from-pink-950/40 to-rose-950/40 p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-pink-100">
              <Clock className="h-3.5 w-3.5" />
              <span>Rotasi berikutnya</span>
            </div>
            <span className="font-mono text-sm font-bold text-pink-200">{fmtCountdown(secondsLeft)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {data.daily_items.map((d) => (
              <motion.div
                key={d.slot_id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-2xl border border-pink-500/30 bg-gradient-to-br from-pink-950/40 to-rose-950/40 p-2.5 backdrop-blur-xl"
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="text-2xl">{d.icon}</div>
                  <button onClick={() => toggleWishlist("daily", d.item_id)}>
                    <Heart className={`h-3.5 w-3.5 ${d.is_wishlisted ? "fill-pink-400 text-pink-400" : "text-white/40"}`} />
                  </button>
                </div>
                <h5 className="text-xs font-bold text-white truncate">{d.name}</h5>
                <p className="text-[10px] text-white/70 mb-1.5 line-clamp-1">{d.reward_label}</p>
                {d.slot_discount_pct > 0 && (
                  <Badge className="bg-rose-500/30 text-rose-100 border-rose-400/50 text-[9px] px-1 py-0 h-4 mb-1">
                    -{d.slot_discount_pct}% slot
                  </Badge>
                )}
                <div className="flex flex-col gap-1 mt-1.5">
                  <Button
                    size="sm"
                    disabled={d.claimed || busyId === `daily:${d.item_id}:coin` || userCoins < d.final_price}
                    onClick={() => buyDaily(d, "coin")}
                    className="flex-1 h-7 text-[10px] bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/50 text-yellow-100 font-bold disabled:opacity-50 px-1"
                  >
                    {busyId === `daily:${d.item_id}:coin` ? <Loader2 className="h-3 w-3 animate-spin" /> :
                      d.claimed ? "✓" :
                      <span className="flex items-center gap-0.5"><Coins className="h-3 w-3" />{d.final_price}</span>}
                  </Button>
                  {!d.claimed && d.final_gem_price > 0 && (
                    <Button
                      size="sm"
                      disabled={busyId === `daily:${d.item_id}:gem` || userGems < d.final_gem_price}
                      onClick={() => buyDaily(d, "gem")}
                      className="flex-1 h-7 text-[10px] bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/50 text-cyan-100 font-bold disabled:opacity-50 px-1"
                    >
                      {busyId === `daily:${d.item_id}:gem` ? <Loader2 className="h-3 w-3 animate-spin" /> :
                        <span className="flex items-center gap-0.5"><Gem className="h-3 w-3" />{d.final_gem_price}</span>}
                    </Button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* TOP SPENDERS LEADERBOARD */}
        <TabsContent value="leaderboard" className="mt-3 space-y-1.5">
          <div className="text-[11px] text-white/60 px-1 mb-1">Top spender minggu ini · Top 10 dapat bonus coins</div>
          {data.top_spenders.length === 0 && (
            <div className="text-center text-xs text-white/60 py-6">Belum ada pembelian minggu ini</div>
          )}
          {data.top_spenders.map((s) => (
            <motion.div
              key={s.visitor_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`rounded-xl border p-2.5 flex items-center gap-3 ${
                s.is_me ? "border-amber-400/60 bg-amber-500/10" : "border-white/10 bg-slate-900/40"
              }`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                s.rank === 1 ? "bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-950" :
                s.rank === 2 ? "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900" :
                s.rank === 3 ? "bg-gradient-to-br from-orange-400 to-amber-700 text-amber-950" :
                "bg-white/10 text-white/70"
              }`}>
                {s.rank <= 3 ? ["🥇", "🥈", "🥉"][s.rank - 1] : s.rank}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-white truncate">
                  {s.display_name}{s.is_me && <span className="text-amber-300 ml-1">(Kamu)</span>}
                </div>
                <div className="text-[10px] text-white/60">{s.purchase_count} pembelian</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-yellow-300 flex items-center gap-0.5 justify-end">
                  <Coins className="h-3 w-3" />{s.total_spent.toLocaleString()}
                </div>
              </div>
            </motion.div>
          ))}
        </TabsContent>

        {/* LIVE ACTIVITY FEED */}
        <TabsContent value="feed" className="mt-3 space-y-1.5">
          <div className="text-[11px] text-white/60 px-1 mb-1 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live · Update otomatis
          </div>
          <AnimatePresence>
            {data.activity_feed.length === 0 && (
              <div className="text-center text-xs text-white/60 py-6">Belum ada aktivitas</div>
            )}
            {data.activity_feed.map((a) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`rounded-xl border p-2 flex items-center gap-2 bg-gradient-to-r ${RARITY_STYLES[a.rarity] || RARITY_STYLES.common}`}
              >
                <span className="text-lg shrink-0">{a.item_icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] truncate">
                    <span className="font-bold">{a.display_name}</span>{" "}
                    <span className="opacity-80">
                      {a.action_type === "bundle" ? "membeli paket" : a.action_type === "mystery" ? "membuka box" : "membeli item"}
                    </span>{" "}
                    <span className="font-semibold">{a.item_name}</span>
                  </div>
                  <div className="text-[9px] opacity-60">{new Date(a.created_at).toLocaleTimeString("id-ID")}</div>
                </div>
                {a.rarity === "legendary" && <Star className="h-3.5 w-3.5 text-amber-300 fill-amber-300 shrink-0" />}
              </motion.div>
            ))}
          </AnimatePresence>
        </TabsContent>
      </Tabs>

      {/* SHOP EXTRAS — Flash Deals, Gacha, VIP, Login Calendar, Achievement Elite */}
      <div className="pt-2 mt-2 border-t border-white/10">
        <div className="flex items-center gap-2 mb-2 px-1">
          <Sparkles className="h-4 w-4 text-amber-300" />
          <h3 className="text-sm font-bold text-white">Fitur Premium Shop</h3>
          <Badge className="bg-amber-500/30 text-amber-100 border-amber-400/50 text-[9px] px-1.5 py-0 h-4">NEW</Badge>
        </div>
        <ShopExtras visitorId={visitorId} onUpdate={onUpdate} />
      </div>

      {/* MYSTERY BOX RESULT DIALOG */}
      <Dialog open={!!openResult} onOpenChange={() => setOpenResult(null)}>
        <DialogContent className="max-w-sm bg-gradient-to-br from-purple-950 via-violet-950 to-slate-950 border-purple-500/40">
          <DialogHeader>
            <DialogTitle className="text-center text-white">{openResult?.box?.name}</DialogTitle>
          </DialogHeader>
          {openResult && (
            <motion.div
              initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200 }}
              className={`rounded-2xl p-6 text-center bg-gradient-to-br ${RARITY_STYLES[openResult.reward.rarity] || RARITY_STYLES.common} border-2`}
            >
              <div className="text-6xl mb-3">{openResult.reward.icon}</div>
              <Badge className="mb-2 uppercase tracking-wider text-[10px]">{openResult.reward.rarity}</Badge>
              <div className="text-xl font-bold text-white mb-1">{openResult.reward.reward_label}</div>
              <div className="text-xs text-white/70">-{openResult.cost} coins dibayar</div>
              {openResult.reward.rarity === "legendary" && (
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                  className="text-amber-200 text-sm font-bold mt-2 flex items-center justify-center gap-1"
                >
                  <Sparkles className="h-4 w-4" /> JACKPOT! <Sparkles className="h-4 w-4" />
                </motion.div>
              )}
            </motion.div>
          )}
          <Button onClick={() => setOpenResult(null)} className="w-full bg-purple-600 hover:bg-purple-700">Mantap!</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
