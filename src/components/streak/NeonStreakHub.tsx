import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Gift, Loader2, Sparkles, ShoppingBag, Trophy, Coins, Target, Lock, Zap, Check, Rocket, Gamepad2, Flame, Crown, Star, Gem, Box, Calendar, Award, Medal, Wallet, Plus, History, Heart, Lightbulb, Clock, Shield } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { trackDailyMission } from "@/lib/daily-mission";
import { EmojiIcon } from "./emojiToIcon";
import { Input } from "@/components/ui/input";

// Strip leading emoji from a title and map to a 3D Lucide icon
const EMOJI_ICON_MAP: Array<{ regex: RegExp; Icon: any; cls: string }> = [
  { regex: /^🎮\s*/u, Icon: Gamepad2, cls: "icon-3d-zap" },
  { regex: /^🏆\s*/u, Icon: Trophy, cls: "icon-3d-trophy" },
  { regex: /^🔥\s*/u, Icon: Flame, cls: "icon-3d-flame" },
  { regex: /^⚡\s*/u, Icon: Zap, cls: "icon-3d-zap" },
  { regex: /^🎁\s*/u, Icon: Gift, cls: "icon-3d-gift" },
  { regex: /^💎\s*/u, Icon: Gem, cls: "icon-3d-trophy" },
  { regex: /^👑\s*/u, Icon: Crown, cls: "icon-3d-trophy" },
  { regex: /^⭐\s*/u, Icon: Star, cls: "icon-3d-sparkles" },
  { regex: /^🌟\s*/u, Icon: Sparkles, cls: "icon-3d-sparkles" },
  { regex: /^✨\s*/u, Icon: Sparkles, cls: "icon-3d-sparkles" },
  { regex: /^🎯\s*/u, Icon: Target, cls: "icon-3d-target" },
  { regex: /^📦\s*/u, Icon: Box, cls: "icon-3d-gift" },
  { regex: /^🚀\s*/u, Icon: Rocket, cls: "icon-3d-zap" },
  { regex: /^📅\s*/u, Icon: Calendar, cls: "icon-3d-target" },
  { regex: /^🏅\s*/u, Icon: Medal, cls: "icon-3d-trophy" },
  { regex: /^🥇\s*/u, Icon: Award, cls: "icon-3d-trophy" },
  { regex: /^💰\s*/u, Icon: Coins, cls: "icon-3d-coin" },
];

function parseTitleIcon(title: string): { Icon: any | null; cls: string; text: string } {
  for (const { regex, Icon, cls } of EMOJI_ICON_MAP) {
    if (regex.test(title)) return { Icon, cls, text: title.replace(regex, "") };
  }
  // Fallback: strip any leading emoji-like chars
  const stripped = title.replace(/^(\p{Extended_Pictographic}|\p{Emoji_Presentation})\uFE0F?\s*/u, "");
  return { Icon: null, cls: "", text: stripped };
}

interface Props {
  visitorId: string;
}

interface ShopItem {
  id: string;
  name: string;
  description: string;
  icon: string;
  cost_coins: number;
  reward_type: string;
  reward_value: number;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  target_value: number;
  reward_coins: number;
  starts_at: string;
  ends_at: string;
  current_value?: number;
  is_completed?: boolean;
  claimed_at?: string | null;
  is_locked?: boolean;
}

export default function NeonStreakHub({ visitorId }: Props) {
  const { toast } = useToast();
  const [coins, setCoins] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [boxOpened, setBoxOpened] = useState(false);
  const [opening, setOpening] = useState(false);
  const [reward, setReward] = useState<any>(null);
  const [showShop, setShowShop] = useState(false);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [dailyMissions, setDailyMissions] = useState<Challenge[]>([]);
  const [coinPackages, setCoinPackages] = useState<{ id: string; name: string; coins: number; price: number }[]>([]);
  const [topupPin, setTopupPin] = useState("");
  const [topupPkgId, setTopupPkgId] = useState<string | null>(null);
  const [toppingUp, setToppingUp] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [powerUps, setPowerUps] = useState<{ extra_life: number; double_xp_until: string | null; time_freeze: number; auto_hint: number }>({ extra_life: 0, double_xp_until: null, time_freeze: 0, auto_hint: 0 });
  const [redeemingPower, setRedeemingPower] = useState<string | null>(null);

  const POWER_UPS = [
    { id: "extra_life", name: "Nyawa Ekstra", desc: "+1 nyawa untuk semua game", icon: Heart, cost: 30, color: "from-red-500 to-pink-600" },
    { id: "auto_hint", name: "Petunjuk Auto", desc: "1x hint otomatis di game", icon: Lightbulb, cost: 25, color: "from-yellow-400 to-orange-500" },
    { id: "time_freeze", name: "Freeze Waktu", desc: "Pause timer 30 detik", icon: Clock, cost: 40, color: "from-cyan-400 to-blue-600" },
    { id: "double_xp", name: "Double XP 1 Jam", desc: "2x poin selama 60 menit", icon: Zap, cost: 80, color: "from-purple-500 to-fuchsia-600" },
    { id: "shield", name: "Shield Streak", desc: "Lindungi streak 1 hari", icon: Shield, cost: 60, color: "from-emerald-400 to-teal-600" },
  ];

  function getToday() {
    const wib = new Date(Date.now() + 7 * 3600 * 1000);
    return wib.toISOString().split("T")[0];
  }

  async function loadAll() {
    const today = getToday();
    const { data: streak } = await supabase.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
    if (streak) {
      setCoins((streak as any).streak_coins || 0);
      setMultiplier(Number((streak as any).current_multiplier) || 1);
      setCurrentStreak(streak.current_streak || 0);
    }
    const { data: box } = await supabase.from("mystery_box_claims").select("*").eq("visitor_id", visitorId).eq("claim_date", today).maybeSingle();
    setBoxOpened(!!box);
    if (box) setReward(box);

    const { data: shopItems } = await supabase.from("streak_shop_items").select("*").eq("is_active", true).order("sort_order");
    setItems((shopItems as any[]) || []);

    const { data: coinPkgs } = await supabase.from("streak_coin_packages" as any).select("id, name, coins, price").eq("is_active", true).order("sort_order");
    setCoinPackages((coinPkgs as any[]) || []);

    const nowIso = new Date().toISOString();
    const { data: chs } = await supabase.from("weekly_challenges").select("*").eq("is_active", true).gte("ends_at", nowIso).order("starts_at");
    if (chs) {
      const { data: progs } = await supabase.from("weekly_challenge_progress").select("*").eq("visitor_id", visitorId).in("challenge_id", chs.map(c => c.id));
      const progMap = Object.fromEntries((progs || []).map((p: any) => [p.challenge_id, p]));
      setChallenges(chs.map((c: any) => ({
        ...c,
        current_value: progMap[c.id]?.current_value || 0,
        is_completed: progMap[c.id]?.is_completed || false,
        claimed_at: progMap[c.id]?.claimed_at || null,
        is_locked: new Date(c.starts_at) > new Date(),
      })));
    }

    // Daily missions (reset per day)
    const { data: dms } = await supabase.from("daily_challenges").select("*").eq("is_active", true).order("sort_order");
    if (dms) {
      const { data: dprogs } = await supabase.from("daily_challenge_progress")
        .select("*")
        .eq("visitor_id", visitorId)
        .eq("challenge_date", today)
        .in("challenge_id", dms.map((d: any) => d.id));
      const dpMap = Object.fromEntries((dprogs || []).map((p: any) => [p.challenge_id, p]));
      setDailyMissions(dms.map((c: any) => ({
        ...c,
        starts_at: today,
        ends_at: today,
        current_value: dpMap[c.id]?.current_value || 0,
        is_completed: dpMap[c.id]?.is_completed || false,
        claimed_at: dpMap[c.id]?.claimed_at || null,
        is_locked: false,
      })));
    }
  }

  useEffect(() => {
    if (visitorId) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitorId]);

  async function openMysteryBox() {
    setOpening(true);
    try {
      const { data, error } = await supabase.functions.invoke("mystery-box-open", { body: { visitorId } });
      if (error || data?.error) {
        toast({ title: "Gagal", description: data?.error || error?.message, variant: "destructive" });
      } else if (data?.alreadyOpened) {
        toast({ title: "Sudah dibuka", description: "Mystery box hari ini sudah dibuka." });
        setReward(data.reward);
        setBoxOpened(true);
      } else {
        setReward(data.reward);
        setBoxOpened(true);
        trackDailyMission(visitorId, "mystery_box", 1);
        loadAll();
      }
    } finally {
      setOpening(false);
    }
  }

  async function redeem(item: ShopItem) {
    setRedeeming(item.id);
    try {
      const { data, error } = await supabase.functions.invoke("streak-shop-redeem", { body: { visitorId, itemId: item.id } });
      if (error || data?.error) {
        toast({ title: "Gagal", description: data?.error || error?.message, variant: "destructive" });
      } else {
        toast({
          title: `🛒 ${item.name} ditebus!`,
          description: data.rewardCode ? `Kode: ${data.rewardCode}` : "Reward sudah ditambahkan!",
        });
        loadAll();
      }
    } finally {
      setRedeeming(null);
    }
  }

  async function topUpCoins(pkgId: string) {
    if (!topupPin.trim()) {
      toast({ title: "PIN diperlukan", description: "Masukkan PIN untuk melanjutkan", variant: "destructive" });
      return;
    }
    setToppingUp(true);
    setTopupPkgId(pkgId);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-streak-coins", {
        body: { visitorId, packageId: pkgId, pin: topupPin.trim(), action: "purchase" },
      });
      if (error || data?.error) {
        toast({ title: "Gagal top up", description: data?.error || error?.message, variant: "destructive" });
      } else {
        toast({
          title: "🎉 Top Up Berhasil!",
          description: `+${data.coins_added.toLocaleString("id-ID")} koin. Sisa saldo: Rp${data.balance_remaining.toLocaleString("id-ID")}`,
        });
        setTopupPin("");
        loadAll();
      }
    } finally {
      setToppingUp(false);
      setTopupPkgId(null);
    }
  }

  async function claimChallenge(ch: Challenge) {
    const { data, error } = await supabase.functions.invoke("check-weekly-challenge", { body: { visitorId, claimChallengeId: ch.id } });
    if (error || data?.error) {
      toast({ title: "Gagal", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "🏆 Reward Diklaim!", description: `+${data.reward_coins} Streak Coins` });
      loadAll();
    }
  }

  async function claimDailyMission(ch: Challenge) {
    const { data, error } = await supabase.functions.invoke("check-daily-challenge", { body: { visitorId, claimChallengeId: ch.id } });
    if (error || data?.error) {
      toast({ title: "Gagal", description: data?.error || error?.message, variant: "destructive" });
    } else {
      toast({ title: "🎯 Misi Harian Selesai!", description: `+${data.reward_coins} Streak Coins` });
      loadAll();
    }
  }

  const rarityColor = (r: string) =>
    r === "legendary" ? "from-yellow-400 to-orange-600"
    : r === "epic" ? "from-purple-500 to-pink-600"
    : r === "rare" ? "from-blue-400 to-cyan-500"
    : "from-slate-400 to-slate-600";

  return (
    <div className="space-y-3">
      {/* Coins + multiplier neon header */}
      <div className="cyber-card rounded-2xl p-4 relative scanline">
        <div className="absolute inset-0 cyber-grid opacity-30 rounded-2xl" />
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="text-[10px] font-black tracking-widest neon-text-cyan uppercase">Streak Coins</div>
            <div className="flex items-center gap-2 mt-1">
              <Coins className="w-7 h-7 icon-3d-coin neon-pulse" strokeWidth={2.5} />
              <span className="text-3xl font-black neon-gradient-text tabular-nums">{coins.toLocaleString("id-ID")}</span>
            </div>
          </div>
          {multiplier > 1 && (
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="px-3 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white text-xs font-black shadow-[0_0_20px_hsl(var(--neon-pink)/0.7)] flex items-center gap-1"
            >
              <Zap className="w-3.5 h-3.5 icon-3d-zap" strokeWidth={3} />
              x{multiplier} BOOST
            </motion.div>
          )}
        </div>
      </div>

      {/* Mystery Box */}
      <button
        onClick={openMysteryBox}
        disabled={opening || boxOpened}
        className="w-full cyber-card-pink rounded-2xl p-4 text-left relative overflow-hidden group disabled:opacity-80"
      >
        <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full bg-pink-500/30 blur-3xl group-hover:bg-pink-500/50 transition" />
        <div className="relative flex items-center gap-3">
          <motion.div
            animate={boxOpened ? {} : { rotate: [0, -6, 6, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="flex items-center justify-center w-14 h-14"
          >
            <Gift className="w-12 h-12 icon-3d-gift" strokeWidth={2.5} />
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="text-xs neon-text-cyan font-black tracking-widest uppercase">Mystery Box Harian</div>
            <div className="font-extrabold text-white text-base">
              {boxOpened ? (reward?.reward_label || "Sudah dibuka") : "Buka sekarang!"}
            </div>
            <div className="text-[11px] text-white/70">
              {boxOpened ? "Kembali besok untuk box baru" : "Reward acak: coins, credit, freeze..."}
            </div>
          </div>
          {opening ? <Loader2 className="w-5 h-5 animate-spin text-white" /> : <Sparkles className="w-5 h-5 neon-text-yellow neon-pulse" />}
        </div>
      </button>

      {/* Daily Missions */}
      {dailyMissions.length > 0 && (
        <div className="cyber-card-pink rounded-2xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 icon-3d-target" strokeWidth={2.5} />
              <span className="text-xs font-black neon-text-pink tracking-widest uppercase">Tantangan Harian</span>
            </div>
            <span className="text-[9px] font-bold text-white/60 uppercase tracking-wider">Reset 00:00 WIB</span>
          </div>
          {dailyMissions.map(ch => {
            const pct = Math.min(100, ((ch.current_value || 0) / ch.target_value) * 100);
            const claimable = ch.is_completed && !ch.claimed_at;
            return (
              <div key={ch.id} className="bg-black/30 rounded-xl p-3 border border-pink-500/20">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="font-extrabold text-white text-sm flex items-center gap-1.5">
                      {(() => { const p = parseTitleIcon(ch.title); return (<>{p.Icon && <p.Icon className={`w-4 h-4 ${p.cls}`} strokeWidth={2.5} />}<span>{p.text}</span></>); })()}
                    </div>
                    <div className="text-[10px] text-white/60">{ch.description}</div>
                  </div>
                  <div className="text-[10px] font-black tabular-nums whitespace-nowrap flex items-center gap-1"><span className="neon-text-yellow">+{ch.reward_coins}</span><Coins className="w-3 h-3 icon-3d-coin" strokeWidth={2.5} /></div>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    className="h-full bg-gradient-to-r from-pink-400 to-yellow-400 shadow-[0_0_10px_hsl(var(--neon-pink)/0.7)]"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/70 tabular-nums">
                    {ch.current_value || 0} / {ch.target_value}
                  </span>
                  {claimable && (
                    <Button size="sm" onClick={() => claimDailyMission(ch)} className="h-6 text-[10px] bg-gradient-to-r from-pink-400 to-yellow-400 text-black font-black">
                      KLAIM
                    </Button>
                  )}
                  {ch.claimed_at && <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3 icon-3d-check" strokeWidth={3} /> DIKLAIM HARI INI</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Weekly Challenges */}
      {challenges.length > 0 && (
        <div className="cyber-card-cyan rounded-2xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 icon-3d-trophy" strokeWidth={2.5} />
            <span className="text-xs font-black neon-text-cyan tracking-widest uppercase">Tantangan Mingguan</span>
          </div>
          {challenges.map(ch => {
            const pct = Math.min(100, ((ch.current_value || 0) / ch.target_value) * 100);
            const claimable = ch.is_completed && !ch.claimed_at && !ch.is_locked;
            const daysToStart = ch.is_locked
              ? Math.max(1, Math.ceil((new Date(ch.starts_at).getTime() - Date.now()) / 86400000))
              : 0;
            return (
              <div key={ch.id} className={`bg-black/30 rounded-xl p-3 border ${ch.is_locked ? "border-white/10 opacity-70" : "border-cyan-500/20"} relative`}>
                {ch.is_locked && (
                  <div className="absolute top-2 right-2 text-[9px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/20 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5 icon-3d-lock" strokeWidth={3} /> {daysToStart}h lagi
                  </div>
                )}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 pr-16">
                    <div className="font-extrabold text-white text-sm flex items-center gap-1.5">
                      {(() => { const p = parseTitleIcon(ch.title); return (<>{p.Icon && <p.Icon className={`w-4 h-4 ${p.cls}`} strokeWidth={2.5} />}<span>{p.text}</span></>); })()}
                    </div>
                    <div className="text-[10px] text-white/60">{ch.description}</div>
                  </div>
                  {!ch.is_locked && <div className="text-[10px] font-black tabular-nums flex items-center gap-1"><span className="neon-text-yellow">+{ch.reward_coins}</span><Coins className="w-3 h-3 icon-3d-coin" strokeWidth={2.5} /></div>}
                </div>
                {!ch.is_locked && (
                  <div className="h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      className="h-full bg-gradient-to-r from-cyan-400 to-pink-500 shadow-[0_0_10px_hsl(var(--neon-cyan)/0.7)]"
                    />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white/70 tabular-nums flex items-center gap-1">
                    {ch.is_locked ? (
                      <>Hadiah: +{ch.reward_coins}<Coins className="w-3 h-3 icon-3d-coin" strokeWidth={2.5} /></>
                    ) : (
                      `${ch.current_value || 0} / ${ch.target_value}`
                    )}
                  </span>
                  {claimable && (
                    <Button size="sm" onClick={() => claimChallenge(ch)} className="h-6 text-[10px] bg-gradient-to-r from-yellow-400 to-pink-500 text-black font-black">
                      KLAIM
                    </Button>
                  )}
                  {ch.claimed_at && <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3 icon-3d-check" strokeWidth={3} /> DIKLAIM</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Streak Shop button */}
      <Button
        onClick={() => setShowShop(true)}
        className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-600 text-white font-black h-12 shadow-[0_0_20px_hsl(var(--neon-purple)/0.5)] hover:shadow-[0_0_30px_hsl(var(--neon-pink)/0.7)]"
      >
        <ShoppingBag className="w-5 h-5 mr-2" /> STREAK SHOP — Tukar Coins
      </Button>

      {/* Mystery reward popup */}
      <AnimatePresence>
        {reward && !boxOpened && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/80 backdrop-blur flex items-center justify-center p-4"
            onClick={() => setReward(null)}
          >
            <motion.div
              initial={{ scale: 0.3, rotate: 180 }} animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring" }}
              className={`max-w-xs w-full rounded-3xl p-6 text-center bg-gradient-to-br ${rarityColor(reward.rarity)} shadow-2xl`}
              onClick={e => e.stopPropagation()}
            >
              <div className="mb-3 flex justify-center">
                <Gift className="w-20 h-20 icon-3d-gift drop-shadow-2xl" strokeWidth={2.5} />
              </div>
              <div className="text-[10px] font-black tracking-widest text-white/80 mb-1">{reward.rarity?.toUpperCase()}</div>
              <div className="text-2xl font-black text-white drop-shadow mb-2">{reward.reward_label}</div>
              <Button onClick={() => setReward(null)} className="bg-white text-black font-black w-full">
                Mantap! <Rocket className="w-4 h-4 ml-1.5 icon-3d-rocket" strokeWidth={2.5} />
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shop dialog */}
      <Dialog open={showShop} onOpenChange={setShowShop}>
        <DialogContent className="max-w-md bg-gradient-to-br from-purple-950 via-slate-950 to-cyan-950 border-purple-500/40">
          <DialogHeader>
            <DialogTitle className="neon-gradient-text text-2xl font-black flex items-center gap-2">
              <ShoppingBag className="w-6 h-6 text-pink-400" /> STREAK SHOP
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-yellow-500/30">
            <span className="text-xs font-bold text-white/80">Saldo Coins</span>
            <span className="text-xl font-black neon-text-yellow tabular-nums flex items-center gap-1.5">
              <Coins className="w-5 h-5 icon-3d-coin" strokeWidth={2.5} /> {coins.toLocaleString("id-ID")}
            </span>
          </div>

          {/* Top Up Koin via Saldo */}
          {coinPackages.length > 0 && (
            <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/60 to-purple-950/60 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 icon-3d-coin" strokeWidth={2.5} />
                <span className="text-xs font-black neon-text-cyan tracking-widest uppercase">Top Up Koin (Bayar Saldo)</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {coinPackages.map((pkg) => (
                  <button
                    key={pkg.id}
                    disabled={toppingUp}
                    onClick={() => topUpCoins(pkg.id)}
                    className="relative p-2.5 rounded-lg border border-cyan-400/40 bg-black/40 text-left hover:border-cyan-300 hover:scale-[1.02] transition disabled:opacity-50"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <Plus className="w-3.5 h-3.5 text-cyan-300" strokeWidth={3} />
                      <span className="text-sm font-black text-white tabular-nums">{pkg.coins.toLocaleString("id-ID")}</span>
                      <Coins className="w-3.5 h-3.5 icon-3d-coin" strokeWidth={2.5} />
                    </div>
                    <div className="text-[10px] font-bold neon-text-yellow tabular-nums">Rp{pkg.price.toLocaleString("id-ID")}</div>
                    {toppingUp && topupPkgId === pkg.id && (
                      <Loader2 className="w-3 h-3 animate-spin text-cyan-300 absolute top-2 right-2" />
                    )}
                  </button>
                ))}
              </div>
              <Input
                type="password"
                inputMode="numeric"
                placeholder="Masukkan PIN saldo"
                value={topupPin}
                onChange={(e) => setTopupPin(e.target.value)}
                className="h-9 text-xs bg-black/40 border-cyan-500/30 text-white placeholder:text-white/40"
              />
              <p className="text-[10px] text-white/50">Pembayaran dipotong dari saldo akun. PIN wajib untuk konfirmasi.</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 max-h-[40vh] overflow-y-auto">
            {items.map(item => {
              const canBuy = coins >= item.cost_coins;
              return (
                <button
                  key={item.id}
                  disabled={!canBuy || redeeming === item.id}
                  onClick={() => redeem(item)}
                  className={`relative p-3 rounded-xl border text-left transition group ${
                    canBuy ? "bg-gradient-to-br from-purple-900/60 to-pink-900/60 border-pink-500/40 hover:border-pink-400 hover:scale-[1.02]" : "bg-black/40 border-white/10 opacity-50"
                  }`}
                >
                  <div className="mb-1"><EmojiIcon emoji={item.icon} className="w-8 h-8" /></div>
                  <div className="font-extrabold text-white text-xs leading-tight">{item.name}</div>
                  <div className="text-[10px] text-white/60 mb-2 line-clamp-2">{item.description}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black neon-text-yellow tabular-nums flex items-center gap-1">
                      <Coins className="w-3.5 h-3.5 icon-3d-coin" strokeWidth={2.5} /> {item.cost_coins}
                    </span>
                    {redeeming === item.id && <Loader2 className="w-3 h-3 animate-spin text-white" />}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-center text-white/50">Coins didapat dari klaim streak harian (bonus saat multiplier aktif), Mystery Box, dan Tantangan Mingguan.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
