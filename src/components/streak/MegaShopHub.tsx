import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Crown, Sparkles, Repeat, Users, Gem, Coins, Lock, Check, Trophy, Flame, PartyPopper, Star, Zap,
} from "lucide-react";
import StreakLuckyWheelShop from "./StreakLuckyWheelShop";
import StreakShopExtras from "./StreakShopExtras";
import MembershipShop from "./MembershipShop";
import PowerPackShop from "./PowerPackShop";
import EngagementHub from "@/components/EngagementHub";
import MysteryDiscountShop from "./MysteryDiscountShop";

interface Props {
  visitorId: string;
  onUpdate?: () => void;
}

const RARITY_BG: Record<string, string> = {
  common: "from-slate-500/30 to-slate-600/30 border-slate-400/50",
  rare: "from-sky-500/30 to-blue-600/30 border-sky-400/50",
  epic: "from-fuchsia-500/30 to-purple-600/30 border-fuchsia-400/50",
  legendary: "from-amber-400/40 to-red-500/40 border-amber-300/70",
};

export default function MegaShopHub({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await supabase.functions.invoke("streak-mega-shop", { body: { action: "list", visitorId } });
      setData(res || null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (visitorId) load(); }, [visitorId]);

  async function call(action: string, payload: any, busyKey: string) {
    setBusy(busyKey);
    try {
      const { data: res } = await supabase.functions.invoke("streak-mega-shop", { body: { action, visitorId, ...payload } });
      if (res?.error) toast({ title: "Gagal", description: res.error, variant: "destructive" });
      else if (res?.success) {
        toast({ title: "🎉 Berhasil!", description: res.message || res.rewardLabel || "" });
        await load();
        onUpdate?.();
      }
    } finally {
      setBusy(null);
    }
  }

  const userGems = data?.user_gems || 0;

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-300" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <PartyPopper className="h-5 w-5 text-amber-300 animate-bounce" />
          <h3 className="font-bold text-base sm:text-lg text-foreground">
            Mega Carnival Shop
          </h3>
          <Badge className="bg-red-500/40 text-red-100 border-red-400/60 text-[9px] px-1.5 py-0 h-4">FESTIVE</Badge>
        </div>
      </div>

      {/* 3 Fitur Live: Flash Sale + Daily Spin + Mystery Box */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2 px-1">
          <Zap className="h-4 w-4 text-pink-300" />
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Live · Flash Sale · Spin · Mystery Box
          </h4>
          <Badge className="bg-red-500/40 text-red-100 border-red-400/60 text-[9px] px-1.5 py-0 h-4">HOT</Badge>
        </div>
        <EngagementHub />
      </div>

      <StreakShopExtras visitorId={visitorId} onUpdate={() => { load(); onUpdate?.(); }} />

      <div className="h-3" />

      {/* MEMBERSHIP - Coin, Gem, & Power Pack */}
      <Tabs defaultValue="power" className="w-full">
        <TabsList className="grid grid-cols-3 bg-black/30 border border-purple-400/30 h-auto p-1 mb-2">
          <TabsTrigger value="coin" className="text-[10px] data-[state=active]:bg-yellow-500/40 px-1 py-1.5 font-black uppercase tracking-wide">
            🪙 Coin
          </TabsTrigger>
          <TabsTrigger value="gem" className="text-[10px] data-[state=active]:bg-cyan-500/40 px-1 py-1.5 font-black uppercase tracking-wide">
            💎 Gem
          </TabsTrigger>
          <TabsTrigger value="power" className="text-[10px] data-[state=active]:bg-pink-500/40 px-1 py-1.5 font-black uppercase tracking-wide">
            ⚡ Power
            <Badge className="ml-1 bg-pink-500 text-white border-0 text-[8px] h-3 px-1">NEW</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="coin">
          <MembershipShop visitorId={visitorId} category="coin" onUpdate={() => { load(); onUpdate?.(); }} />
        </TabsContent>
        <TabsContent value="gem">
          <MembershipShop visitorId={visitorId} category="gem" onUpdate={() => { load(); onUpdate?.(); }} />
        </TabsContent>
        <TabsContent value="power">
          <PowerPackShop visitorId={visitorId} onUpdate={() => { load(); onUpdate?.(); }} />
        </TabsContent>
      </Tabs>

      <div className="h-3" />

      {/* Mystery Shop mingguan hanya untuk roll hadiah normal. */}
      <div className="mb-3 space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Sparkles className="h-4 w-4 text-fuchsia-300" />
          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">Mystery Shop Mingguan</h4>
          <Badge className="bg-fuchsia-500/40 text-fuchsia-100 border-fuchsia-400/60 text-[9px] px-1.5 py-0 h-4">NEW</Badge>
        </div>
        <MysteryDiscountShop visitorId={visitorId} onUpdate={() => { load(); onUpdate?.(); }} />
      </div>

      <div className="h-3" />


      <Tabs defaultValue="wheel" className="w-full">
        <TabsList className="grid grid-cols-5 bg-black/30 border border-amber-400/30 h-auto p-1 mb-2">
          <TabsTrigger value="wheel" className="text-[10px] sm:text-xs data-[state=active]:bg-pink-500/40 px-1 py-1.5">
            <Zap className="h-3 w-3 mr-0.5" /> Wheel
          </TabsTrigger>
          <TabsTrigger value="bp" className="text-[10px] sm:text-xs data-[state=active]:bg-amber-500/40 px-1 py-1.5">
            <Crown className="h-3 w-3 mr-0.5" /> Pass
          </TabsTrigger>
          <TabsTrigger value="trade" className="text-[10px] sm:text-xs data-[state=active]:bg-amber-500/40 px-1 py-1.5">
            <Repeat className="h-3 w-3 mr-0.5" /> Trade
          </TabsTrigger>
          <TabsTrigger value="skin" className="text-[10px] sm:text-xs data-[state=active]:bg-amber-500/40 px-1 py-1.5">
            <Sparkles className="h-3 w-3 mr-0.5" /> Skin
          </TabsTrigger>
          <TabsTrigger value="group" className="text-[10px] sm:text-xs data-[state=active]:bg-amber-500/40 px-1 py-1.5">
            <Users className="h-3 w-3 mr-0.5" /> Group
          </TabsTrigger>
        </TabsList>

        {/* LUCKY WHEEL */}
        <TabsContent value="wheel" className="mt-2">
          <StreakLuckyWheelShop visitorId={visitorId} onUpdate={() => { load(); onUpdate?.(); }} />
        </TabsContent>

        {/* BATTLE PASS */}
        <TabsContent value="bp" className="mt-2 space-y-2">
          {data.battle_pass ? (
            <BattlePassPanel bp={data.battle_pass} busy={busy} call={call} userGems={userGems} />
          ) : (
            <p className="text-xs text-center text-muted-foreground py-4">Belum ada season aktif</p>
          )}
        </TabsContent>

        {/* TRADE-IN */}
        <TabsContent value="trade" className="mt-2 space-y-2">
          {data.tradein.recipes.length === 0 && <p className="text-xs text-center text-muted-foreground py-4">Belum ada resep</p>}
          {data.tradein.recipes.map((r: any) => {
            const used = data.tradein.usage_today[r.id] || 0;
            const left = r.daily_limit - used;
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-gradient-to-r from-emerald-500/15 to-teal-500/15 border border-emerald-400/40 p-2.5"
              >
                <div className="flex items-center gap-2">
                  <div className="text-2xl">{r.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-emerald-100 truncate">{r.name}</p>
                    <p className="text-[10px] text-emerald-200/80 truncate">{r.description}</p>
                    <p className="text-[9px] text-emerald-300/70">Sisa hari ini: {left}/{r.daily_limit}</p>
                  </div>
                  <Button
                    size="sm"
                    disabled={left <= 0 || busy === `t-${r.id}`}
                    onClick={() => call("tradein", { recipeId: r.id }, `t-${r.id}`)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white h-8 px-2 text-[11px]"
                  >
                    {busy === `t-${r.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : "Tukar"}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </TabsContent>

        {/* LIMITED SKINS */}
        <TabsContent value="skin" className="mt-2 grid grid-cols-2 gap-2">
          {data.skins.length === 0 && <p className="col-span-2 text-xs text-center text-muted-foreground py-4">Belum ada skin terbatas</p>}
          {data.skins.map((s: any) => {
            const stockLeft = s.total_stock - s.sold_count;
            const pct = (s.sold_count / s.total_stock) * 100;
            const gemPrice = s.cost_gems || 0;
            return (
              <motion.div
                key={s.id}
                whileHover={{ scale: 1.02 }}
                className={`rounded-xl bg-gradient-to-br ${RARITY_BG[s.rarity] || RARITY_BG.rare} border-2 p-2`}
              >
                <div className="text-center">
                  <div className="text-3xl mb-1">{s.emoji_fallback}</div>
                  <p className="font-bold text-[11px] text-white truncate">{s.name}</p>
                  <Badge className="text-[8px] h-3 px-1 bg-black/40 text-white border-0 my-1">{s.rarity.toUpperCase()}</Badge>
                  <Progress value={pct} className="h-1 my-1" />
                  <p className="text-[9px] text-white/80">Tersisa {stockLeft}/{s.total_stock}</p>
                </div>
                <div className="flex gap-1 mt-1.5">
                  <Button
                    size="sm"
                    disabled={s.owned || stockLeft <= 0 || busy === `s-${s.id}-coin`}
                    onClick={() => call("buy_skin", { skinId: s.id, paymentMethod: "coin" }, `s-${s.id}-coin`)}
                    className="flex-1 h-7 text-[10px] bg-gradient-to-r from-amber-500 to-red-500 text-white px-1"
                  >
                    {s.owned ? <><Check className="h-3 w-3 mr-0.5" />Punya</> :
                     busy === `s-${s.id}-coin` ? <Loader2 className="h-3 w-3 animate-spin" /> :
                     <><Coins className="h-3 w-3 mr-0.5" />{s.cost_coins}</>}
                  </Button>
                  {!s.owned && gemPrice > 0 && (
                    <Button
                      size="sm"
                      disabled={stockLeft <= 0 || busy === `s-${s.id}-gem` || userGems < gemPrice}
                      onClick={() => call("buy_skin", { skinId: s.id, paymentMethod: "gem" }, `s-${s.id}-gem`)}
                      className="flex-1 h-7 text-[10px] bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-1 disabled:opacity-50"
                    >
                      {busy === `s-${s.id}-gem` ? <Loader2 className="h-3 w-3 animate-spin" /> :
                       <><Gem className="h-3 w-3 mr-0.5" />{gemPrice}</>}
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </TabsContent>

        {/* GROUP BUY */}
        <TabsContent value="group" className="mt-2 space-y-2">
          {data.group_buy.length === 0 && <p className="text-xs text-center text-muted-foreground py-4">Belum ada group buy</p>}
          {data.group_buy.map((g: any) => {
            const tierLabel =
              g.current_discount_pct >= g.tier3_discount_pct ? "TIER 3" :
              g.current_discount_pct >= g.tier2_discount_pct ? "TIER 2" :
              g.current_discount_pct >= g.tier1_discount_pct ? "TIER 1" : "Belum diskon";
            const nextThreshold =
              g.buyers_today < g.tier1_buyers ? g.tier1_buyers :
              g.buyers_today < g.tier2_buyers ? g.tier2_buyers :
              g.buyers_today < g.tier3_buyers ? g.tier3_buyers : g.tier3_buyers;
            const buyerPct = Math.min(100, (g.buyers_today / Math.max(1, nextThreshold)) * 100);
            return (
              <motion.div
                key={g.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-xl bg-gradient-to-r from-pink-500/20 to-rose-600/20 border border-pink-400/50 p-2.5"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="text-2xl">{g.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-pink-100 truncate">{g.name}</p>
                    <p className="text-[10px] text-pink-200/80 truncate">{g.reward_label}</p>
                  </div>
                  <Badge className="bg-rose-500/40 text-rose-100 text-[9px] h-4 border-rose-400/50">
                    {g.current_discount_pct > 0 ? `-${g.current_discount_pct}%` : tierLabel}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-pink-200/90 mb-1">
                  <Users className="h-3 w-3" /> {g.buyers_today} pembeli hari ini
                </div>
                <Progress value={buyerPct} className="h-1.5 mb-1.5" />
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] text-pink-100">
                    {g.current_discount_pct > 0 && <span className="line-through text-pink-300/60 mr-1">{g.base_cost_coins}</span>}
                    <span className="font-bold text-amber-300">{g.current_cost} <Coins className="inline h-3 w-3" /></span>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      disabled={g.already_bought_today || busy === `g-${g.id}-coin`}
                      onClick={() => call("group_buy", { itemId: g.id, paymentMethod: "coin" }, `g-${g.id}-coin`)}
                      className="h-7 px-2 text-[10px] bg-pink-500 hover:bg-pink-600 text-white"
                    >
                      {g.already_bought_today ? "Sudah" :
                       busy === `g-${g.id}-coin` ? <Loader2 className="h-3 w-3 animate-spin" /> :
                       <><Coins className="h-3 w-3 mr-0.5" />{g.current_cost}</>}
                    </Button>
                    {!g.already_bought_today && g.current_gem_cost > 0 && (
                      <Button
                        size="sm"
                        disabled={busy === `g-${g.id}-gem` || userGems < g.current_gem_cost}
                        onClick={() => call("group_buy", { itemId: g.id, paymentMethod: "gem" }, `g-${g.id}-gem`)}
                        className="h-7 px-2 text-[10px] bg-cyan-500 hover:bg-cyan-600 text-white disabled:opacity-50"
                      >
                        {busy === `g-${g.id}-gem` ? <Loader2 className="h-3 w-3 animate-spin" /> :
                         <><Gem className="h-3 w-3 mr-0.5" />{g.current_gem_cost}</>}
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BattlePassPanel({ bp, busy, call, userGems }: { bp: any; busy: string | null; call: (a: string, p: any, k: string) => void; userGems: number }) {
  const { season, tiers, progress } = bp;
  const spent = progress.total_spent_coins;
  const maxRequired = tiers.length ? tiers[tiers.length - 1].required_spent_coins : 1;
  const pct = Math.min(100, (spent / maxRequired) * 100);
  const gemPrice = season.premium_cost_gems || 0;

  return (
    <div className="space-y-2">
      <div className="rounded-xl bg-black/30 border border-amber-400/40 p-2.5">
        <div className="flex items-center justify-between mb-1 gap-2">
          <div className="min-w-0">
            <p className="font-bold text-sm text-amber-100 truncate">{season.name}</p>
            <p className="text-[10px] text-amber-200/70">Belanja coins: {spent} / {maxRequired}</p>
          </div>
          {!progress.is_premium ? (
            <div className="flex gap-1 shrink-0">
              <Button
                size="sm"
                disabled={busy === "premium-coin"}
                onClick={() => call("bp_buy_premium", { seasonId: season.id, paymentMethod: "coin" }, "premium-coin")}
                className="h-7 text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2"
              >
                {busy === "premium-coin" ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Crown className="h-3 w-3 mr-0.5" /><Coins className="h-3 w-3 mr-0.5" />{season.premium_cost_coins}</>}
              </Button>
              {gemPrice > 0 && (
                <Button
                  size="sm"
                  disabled={busy === "premium-gem" || userGems < gemPrice}
                  onClick={() => call("bp_buy_premium", { seasonId: season.id, paymentMethod: "gem" }, "premium-gem")}
                  className="h-7 text-[10px] bg-gradient-to-r from-cyan-500 to-blue-500 text-white px-2 disabled:opacity-50"
                >
                  {busy === "premium-gem" ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Gem className="h-3 w-3 mr-0.5" />{gemPrice}</>}
                </Button>
              )}
            </div>
          ) : (
            <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-[10px]">
              <Crown className="h-3 w-3 mr-0.5" />PREMIUM
            </Badge>
          )}
        </div>
        <Progress value={pct} className="h-2" />
      </div>

      <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
        {tiers.map((t: any) => {
          const unlocked = spent >= t.required_spent_coins;
          const claimedFree = progress.claimed_free_tiers?.includes(t.tier_number);
          const claimedPrem = progress.claimed_premium_tiers?.includes(t.tier_number);
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`rounded-lg border p-1.5 ${unlocked ? "bg-amber-500/10 border-amber-400/40" : "bg-black/20 border-white/10"}`}
            >
              <div className="flex items-center gap-2">
                <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-[11px] ${unlocked ? "bg-amber-500 text-black" : "bg-white/10 text-white/50"}`}>
                  {t.tier_number}
                </div>
                <div className="flex-1 grid grid-cols-2 gap-1">
                  {/* FREE */}
                  <div className={`rounded p-1 border ${claimedFree ? "bg-emerald-500/20 border-emerald-400/50" : "bg-white/5 border-white/10"}`}>
                    <div className="flex items-center gap-1">
                      <span className="text-base">{t.free_reward_icon}</span>
                      <p className="text-[9px] text-white/90 truncate flex-1">{t.free_reward_label}</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={!unlocked || claimedFree || busy === `bp-f-${t.id}`}
                      onClick={() => call("bp_claim_tier", { seasonId: season.id, tierNumber: t.tier_number, track: "free" }, `bp-f-${t.id}`)}
                      className="w-full h-5 text-[9px] mt-0.5 bg-emerald-500 hover:bg-emerald-600 text-white"
                    >
                      {claimedFree ? <Check className="h-2.5 w-2.5" /> :
                       !unlocked ? <Lock className="h-2.5 w-2.5" /> :
                       busy === `bp-f-${t.id}` ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "Klaim"}
                    </Button>
                  </div>
                  {/* PREMIUM */}
                  <div className={`rounded p-1 border ${claimedPrem ? "bg-amber-500/20 border-amber-400/50" : "bg-white/5 border-amber-400/20"}`}>
                    <div className="flex items-center gap-1">
                      <span className="text-base">{t.premium_reward_icon}</span>
                      <p className="text-[9px] text-amber-100 truncate flex-1">{t.premium_reward_label}</p>
                    </div>
                    <Button
                      size="sm"
                      disabled={!unlocked || claimedPrem || !progress.is_premium || busy === `bp-p-${t.id}`}
                      onClick={() => call("bp_claim_tier", { seasonId: season.id, tierNumber: t.tier_number, track: "premium" }, `bp-p-${t.id}`)}
                      className="w-full h-5 text-[9px] mt-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white"
                    >
                      {claimedPrem ? <Check className="h-2.5 w-2.5" /> :
                       !progress.is_premium ? <Crown className="h-2.5 w-2.5" /> :
                       !unlocked ? <Lock className="h-2.5 w-2.5" /> :
                       busy === `bp-p-${t.id}` ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : "Klaim"}
                    </Button>
                  </div>
                </div>
                <span className="text-[9px] text-white/60 shrink-0">{t.required_spent_coins}c</span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
