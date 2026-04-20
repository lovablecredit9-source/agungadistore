import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Gift, Gavel, Crown, Users, Coins, Gem, Wallet, Trophy, Sparkles, Copy, Check, Clock, TrendingUp, Star,
} from "lucide-react";

interface Props { visitorId: string; onUpdate?: () => void; }

const RARITY_COLORS: Record<string, string> = {
  common: "from-slate-500/30 to-slate-600/30 border-slate-400/40",
  rare: "from-sky-500/30 to-blue-600/30 border-sky-400/50",
  epic: "from-fuchsia-500/30 to-purple-600/30 border-fuchsia-400/50",
  legendary: "from-amber-400/40 to-red-500/40 border-amber-300/70",
};

function timeLeft(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Berakhir";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}j ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function StreakShopExtras({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("mystery");
  const [now, setNow] = useState(Date.now());
  const [reveal, setReveal] = useState<any>(null);
  const [refCode, setRefCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await supabase.functions.invoke("streak-shop-extras", { body: { action: "list", visitorId } });
      setData(res);
    } finally { setLoading(false); }
  }
  useEffect(() => { if (visitorId) load(); }, [visitorId]);

  async function call(action: string, payload: any, key: string) {
    setBusy(key);
    try {
      const { data: res } = await supabase.functions.invoke("streak-shop-extras", { body: { action, visitorId, ...payload } });
      if (res?.error) toast({ title: "Gagal", description: res.error, variant: "destructive" });
      else if (res?.success) {
        if (action === "open_box" && res.reward) setReveal(res.reward);
        else toast({ title: "🎉 Berhasil!", description: res.message || "" });
        await load();
        onUpdate?.();
      }
    } finally { setBusy(null); }
  }

  if (loading || !data) {
    return <div className="rounded-2xl bg-gradient-to-br from-violet-500/10 to-pink-500/10 border border-violet-400/30 p-6 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-violet-300" /></div>;
  }

  const userGems = data.user_gems || 0;
  const userCoins = data.user_coins || 0;
  const myRef = data.my_referral || {};
  const currentTier = (data.loyalty_tiers || []).find((t: any) => t.tier_key === data.loyalty_progress?.current_tier_key);
  const nextTier = (data.loyalty_tiers || []).find((t: any) => (t.tier_order || 0) > (currentTier?.tier_order || 0));
  const tierPct = nextTier ? Math.min(100, ((data.loyalty_progress?.lifetime_spent_coins || 0) / nextTier.required_lifetime_spent) * 100) : 100;
  const featureCards = [
    {
      value: "mystery",
      label: "Mystery Box",
      shortLabel: "Box",
      description: `${(data.mystery_boxes || []).length} box aktif`,
      icon: Gift,
      activeClass: "border-violet-300/70 bg-violet-500/25",
      iconClass: "text-violet-200",
    },
    {
      value: "auction",
      label: "Auction House",
      shortLabel: "Lelang",
      description: `${(data.auctions || []).length} lelang aktif`,
      icon: Gavel,
      activeClass: "border-rose-300/70 bg-rose-500/25",
      iconClass: "text-rose-200",
    },
    {
      value: "loyalty",
      label: "Loyalty Tier",
      shortLabel: "Loyal",
      description: currentTier ? currentTier.tier_name : "Tier belum terbaca",
      icon: Crown,
      activeClass: "border-amber-300/70 bg-amber-500/25",
      iconClass: "text-amber-200",
    },
    {
      value: "referral",
      label: "Referral Vault",
      shortLabel: "Ajak",
      description: `${myRef.total_referred || 0} teman diajak`,
      icon: Users,
      activeClass: "border-emerald-300/70 bg-emerald-500/25",
      iconClass: "text-emerald-200",
    },
  ];

  function copyCode() {
    navigator.clipboard.writeText(myRef.referral_code || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-2xl bg-gradient-to-br from-violet-500/15 via-fuchsia-500/15 to-pink-500/15 border-2 border-fuchsia-400/40 p-3 sm:p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-fuchsia-300 animate-pulse" />
          <h3 className="font-bold text-base sm:text-lg bg-gradient-to-r from-violet-200 via-fuchsia-100 to-pink-200 bg-clip-text text-transparent">
            Streak Shop Plus
          </h3>
          <Badge className="bg-fuchsia-500/40 text-fuchsia-100 border-fuchsia-400/60 text-[9px] px-1.5 py-0 h-4">NEW</Badge>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="flex items-center gap-0.5 text-amber-300"><Coins className="h-3 w-3" />{userCoins}</span>
          <span className="flex items-center gap-0.5 text-cyan-300"><Gem className="h-3 w-3" />{userGems}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        {featureCards.map((feature) => {
          const Icon = feature.icon;
          const isActive = activeTab === feature.value;
          return (
            <button
              key={feature.value}
              type="button"
              onClick={() => setActiveTab(feature.value)}
              className={`rounded-xl border p-2 text-left transition-all ${isActive ? feature.activeClass : "border-white/10 bg-black/20"}`}
            >
              <div className="flex items-start gap-2">
                <div className={`rounded-lg bg-black/30 p-1.5 ${feature.iconClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-white truncate">{feature.label}</p>
                  <p className="text-[9px] text-white/65 truncate">{feature.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-black/30 border border-fuchsia-400/30 h-auto p-1 mb-2">
          {featureCards.map((feature) => {
            const Icon = feature.icon;
            return (
              <TabsTrigger key={feature.value} value={feature.value} className="text-[10px] sm:text-xs px-1 py-1.5">
                <Icon className="h-3 w-3 mr-0.5" />{feature.shortLabel}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* MYSTERY BOX */}
        <TabsContent value="mystery" className="mt-2 space-y-2">
          {(data.mystery_boxes || []).map((box: any) => {
            const used = data.mystery_usage_today[box.id] || 0;
            const left = box.daily_limit - used;
            const isFree = box.cost_coins === 0 && box.cost_gems === 0 && box.cost_balance === 0;
            return (
              <motion.div key={box.id} whileHover={{ scale: 1.01 }}
                className={`rounded-xl bg-gradient-to-br ${RARITY_COLORS[box.rarity]} border-2 p-2.5`}>
                <div className="flex items-start gap-2">
                  <motion.div animate={{ rotate: [0, -5, 5, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="text-3xl">{box.icon}</motion.div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-bold text-xs text-white truncate">{box.name}</p>
                      <Badge className="text-[8px] h-3 px-1 bg-black/40 text-white border-0">{box.rarity.toUpperCase()}</Badge>
                    </div>
                    <p className="text-[10px] text-white/70 truncate">{box.description}</p>
                    <p className="text-[9px] text-white/60">Sisa hari ini: {left}/{box.daily_limit}</p>
                  </div>
                </div>
                <div className="flex gap-1 mt-2">
                  {isFree ? (
                    <Button size="sm" disabled={left <= 0 || busy === `b-${box.id}`}
                      onClick={() => call("open_box", { boxId: box.id, paymentMethod: "free" }, `b-${box.id}`)}
                      className="flex-1 h-7 text-[10px] bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
                      {busy === `b-${box.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Sparkles className="h-3 w-3 mr-0.5" />GRATIS</>}
                    </Button>
                  ) : (
                    <>
                      {box.cost_coins > 0 && (
                        <Button size="sm" disabled={left <= 0 || busy === `b-${box.id}-c` || userCoins < box.cost_coins}
                          onClick={() => call("open_box", { boxId: box.id, paymentMethod: "coin" }, `b-${box.id}-c`)}
                          className="flex-1 h-7 text-[10px] bg-amber-500 hover:bg-amber-600 text-white px-1 disabled:opacity-50">
                          {busy === `b-${box.id}-c` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Coins className="h-3 w-3 mr-0.5" />{box.cost_coins}</>}
                        </Button>
                      )}
                      {box.cost_gems > 0 && (
                        <Button size="sm" disabled={left <= 0 || busy === `b-${box.id}-g` || userGems < box.cost_gems}
                          onClick={() => call("open_box", { boxId: box.id, paymentMethod: "gem" }, `b-${box.id}-g`)}
                          className="flex-1 h-7 text-[10px] bg-cyan-500 hover:bg-cyan-600 text-white px-1 disabled:opacity-50">
                          {busy === `b-${box.id}-g` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Gem className="h-3 w-3 mr-0.5" />{box.cost_gems}</>}
                        </Button>
                      )}
                      {box.cost_balance > 0 && (
                        <Button size="sm" disabled={left <= 0 || busy === `b-${box.id}-b`}
                          onClick={() => call("open_box", { boxId: box.id, paymentMethod: "balance" }, `b-${box.id}-b`)}
                          className="flex-1 h-7 text-[10px] bg-violet-500 hover:bg-violet-600 text-white px-1">
                          {busy === `b-${box.id}-b` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Wallet className="h-3 w-3 mr-0.5" />Rp{box.cost_balance}</>}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </TabsContent>

        {/* AUCTION */}
        <TabsContent value="auction" className="mt-2 space-y-2">
          {(data.auctions || []).length === 0 && <p className="text-xs text-center text-muted-foreground py-4">Belum ada lelang aktif</p>}
          {(data.auctions || []).map((a: any) => {
            const ended = new Date(a.ends_at).getTime() <= now;
            const isWinner = a.current_winner_visitor_id === visitorId;
            const minBid = Math.max(a.starting_bid, a.current_bid + a.min_increment);
            const currIcon = a.bid_currency === "gem" ? <Gem className="inline h-3 w-3" /> : a.bid_currency === "balance" ? <Wallet className="inline h-3 w-3" /> : <Coins className="inline h-3 w-3" />;
            return (
              <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl bg-gradient-to-br ${RARITY_COLORS[a.rarity] || RARITY_COLORS.epic} border-2 p-2.5`}>
                <div className="flex items-start gap-2 mb-1.5">
                  <div className="text-2xl">{a.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-bold text-xs text-white truncate">{a.name}</p>
                      <Badge className="text-[8px] h-3 px-1 bg-amber-500/40 text-amber-100 border-0">{a.reward_label}</Badge>
                    </div>
                    <p className="text-[10px] text-white/70 truncate">{a.description}</p>
                    <div className="flex items-center gap-2 text-[9px] text-white/80 mt-0.5">
                      <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{timeLeft(a.ends_at)}</span>
                      <span className="flex items-center gap-0.5"><TrendingUp className="h-2.5 w-2.5" />{a.total_bids} bid</span>
                    </div>
                  </div>
                </div>
                <div className="bg-black/30 rounded-lg p-1.5 mb-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-white/70">Tertinggi:</span>
                    <span className="font-bold text-amber-300">{a.current_bid || a.starting_bid} {currIcon} {isWinner && <Badge className="ml-1 bg-emerald-500/60 text-[8px] h-3 px-1 border-0">KAMU</Badge>}</span>
                  </div>
                  {a.current_winner_name && <p className="text-[9px] text-white/60 truncate">oleh {a.current_winner_name}</p>}
                </div>
                {ended ? (
                  isWinner ? (
                    <Button size="sm" disabled={busy === `a-${a.id}`} onClick={() => call("claim_auction", { auctionId: a.id }, `a-${a.id}`)}
                      className="w-full h-7 text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                      {busy === `a-${a.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Trophy className="h-3 w-3 mr-0.5" />KLAIM HADIAH</>}
                    </Button>
                  ) : (
                    <p className="text-[10px] text-center text-white/60 py-1">Lelang berakhir</p>
                  )
                ) : (
                  <Button size="sm" disabled={isWinner || busy === `a-${a.id}`}
                    onClick={() => call("place_bid", { auctionId: a.id, bidAmount: minBid }, `a-${a.id}`)}
                    className="w-full h-7 text-[10px] bg-rose-500 hover:bg-rose-600 text-white disabled:opacity-50">
                    {busy === `a-${a.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> :
                      isWinner ? "Kamu pemimpin" : <><Gavel className="h-3 w-3 mr-0.5" />Bid {minBid} {currIcon}</>}
                  </Button>
                )}
              </motion.div>
            );
          })}
        </TabsContent>

        {/* LOYALTY */}
        <TabsContent value="loyalty" className="mt-2 space-y-2">
          {currentTier && (
            <div className="rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-2 border-amber-400/50 p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="text-3xl">{currentTier.icon}</div>
                <div className="flex-1">
                  <p className="text-[10px] text-amber-200/80">Tier kamu</p>
                  <p className="font-bold text-base text-amber-100">{currentTier.tier_name}</p>
                  <p className="text-[10px] text-amber-200/80">Diskon {currentTier.discount_pct}% • {data.loyalty_progress?.lifetime_spent_coins || 0} coins terpakai</p>
                </div>
                <Button size="sm" disabled={busy === "loyalty" || data.loyalty_progress?.last_monthly_claim_month === new Date().toISOString().slice(0, 7)}
                  onClick={() => call("claim_loyalty", {}, "loyalty")}
                  className="h-8 text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                  {busy === "loyalty" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Klaim Bulanan"}
                </Button>
              </div>
              {nextTier && (
                <>
                  <div className="flex justify-between text-[10px] text-amber-200/80 mb-1">
                    <span>Menuju {nextTier.tier_name} {nextTier.icon}</span>
                    <span>{data.loyalty_progress?.lifetime_spent_coins || 0}/{nextTier.required_lifetime_spent}</span>
                  </div>
                  <Progress value={tierPct} className="h-2" />
                </>
              )}
            </div>
          )}
          <div className="grid grid-cols-5 gap-1">
            {(data.loyalty_tiers || []).map((t: any) => {
              const active = t.tier_key === currentTier?.tier_key;
              const unlocked = (data.loyalty_progress?.lifetime_spent_coins || 0) >= t.required_lifetime_spent;
              return (
                <div key={t.id} className={`rounded-lg p-1.5 text-center border ${active ? "bg-amber-500/30 border-amber-400" : unlocked ? "bg-emerald-500/10 border-emerald-400/30" : "bg-black/20 border-white/10 opacity-50"}`}>
                  <div className="text-lg">{t.icon}</div>
                  <p className="text-[8px] font-bold text-white truncate">{t.tier_name}</p>
                  <p className="text-[7px] text-white/60">-{t.discount_pct}%</p>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* REFERRAL */}
        <TabsContent value="referral" className="mt-2 space-y-2">
          <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-2 border-emerald-400/50 p-3">
            <p className="text-[10px] text-emerald-200/80 mb-1">Kode referral kamu:</p>
            <div className="flex items-center gap-1.5 mb-2">
              <code className="flex-1 bg-black/40 rounded px-2 py-1.5 text-sm font-bold text-emerald-100 tracking-wider text-center">{myRef.referral_code || "—"}</code>
              <Button size="sm" variant="outline" onClick={copyCode} className="h-8 px-2 border-emerald-400/50 text-emerald-100">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1.5 text-center">
              <div className="bg-black/30 rounded p-1.5">
                <p className="text-[9px] text-emerald-200/70">Diundang</p>
                <p className="font-bold text-sm text-emerald-100">{myRef.total_referred || 0}</p>
              </div>
              <div className="bg-black/30 rounded p-1.5">
                <p className="text-[9px] text-emerald-200/70">Coins</p>
                <p className="font-bold text-sm text-amber-300">{myRef.total_coins_earned || 0}</p>
              </div>
              <div className="bg-black/30 rounded p-1.5">
                <p className="text-[9px] text-emerald-200/70">Gems</p>
                <p className="font-bold text-sm text-cyan-300">{myRef.total_gems_earned || 0}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-black/20 border border-white/10 p-2">
            <p className="text-[10px] text-white/70 mb-1">Punya kode referral? Pakai sekali untuk dapat bonus 200 coins + 5 gems</p>
            <div className="flex gap-1">
              <Input value={refCode} onChange={(e) => setRefCode(e.target.value.toUpperCase())} placeholder="REF123ABC"
                className="h-8 text-xs bg-black/40 border-white/20 text-white" maxLength={20} />
              <Button size="sm" disabled={!refCode || busy === "ref"} onClick={() => call("use_referral", { code: refCode }, "ref")}
                className="h-8 text-[11px] bg-emerald-500 hover:bg-emerald-600 text-white px-3">
                {busy === "ref" ? <Loader2 className="h-3 w-3 animate-spin" /> : "Pakai"}
              </Button>
            </div>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 border border-violet-400/40 p-2">
            <div className="flex items-center gap-1 mb-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-300" />
              <p className="text-[11px] font-bold text-violet-100">Top Referrer</p>
            </div>
            {(data.referral_leaderboard || []).slice(0, 5).map((r: any, i: number) => (
              <div key={i} className="flex items-center gap-1.5 py-0.5 text-[10px]">
                <span className="w-4 text-center font-bold text-amber-300">#{i + 1}</span>
                <span className="flex-1 truncate text-white/90">{r.display_name}</span>
                <span className="text-emerald-300">{r.total_referred} ajakan</span>
              </div>
            ))}
            {(data.referral_leaderboard || []).length === 0 && <p className="text-[10px] text-center text-white/50 py-2">Belum ada</p>}
          </div>
        </TabsContent>
      </Tabs>

      {/* REVEAL OVERLAY */}
      <AnimatePresence>
        {reveal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setReveal(null)}>
            <motion.div initial={{ scale: 0.5, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0.5 }}
              className={`rounded-3xl bg-gradient-to-br ${RARITY_COLORS[reveal.rarity] || RARITY_COLORS.rare} border-4 p-6 max-w-xs text-center`}>
              <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 360] }} transition={{ duration: 1.5 }} className="text-6xl mb-3">🎁</motion.div>
              <p className="text-xs text-white/80 mb-1">Selamat! Kamu dapat:</p>
              <p className="font-bold text-lg text-white mb-2">{reveal.label}</p>
              <Badge className="bg-black/40 text-white border-0">{(reveal.rarity || "common").toUpperCase()}</Badge>
              <Button onClick={() => setReveal(null)} className="w-full mt-4 bg-white text-black hover:bg-white/90">Mantap!</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
