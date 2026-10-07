import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { invokeRoyale } from "@/components/luck/royale/invokeRoyale";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatCompactNumber } from "@/lib/utils";
import LoginGate from "@/components/LoginGate";
import {
  ArrowLeft, Heart, Lightbulb, Timer, Shield, Gem, Coins, Sparkles, Crown,
  Loader2, Trophy, Zap, X, Dices, BarChart3, Flame, Star, Award, TrendingUp,
  Brain, Target, TrendingDown, CheckCircle2, AlertCircle, Rocket, Gift, Flame as FlameIcon,
  Package, Ticket, Clock, ShoppingBag,
} from "lucide-react";
import MegaSpinArena from "@/components/luck/MegaSpinArena";
import PremiumSpinPanel from "@/components/luck/PremiumSpinPanel";
import TierSpinArena from "@/components/luck/TierSpinArena";
import SpinTicketShop from "@/components/luck/SpinTicketShop";
import PremiumMilestonePanel from "@/components/luck/PremiumMilestonePanel";
import DiamondRoyaleInline from "@/components/streak/DiamondRoyaleInline";
import DiscountShop from "@/components/luck/DiscountShop";
import PrizeVoucherVault from "@/components/luck/PrizeVoucherVault";
import FadedWheel from "@/components/streak/FadedWheel";
import GemShop from "@/components/streak/GemShop";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RARITY_STYLE, getKindIcon } from "@/components/luck/royale/theme";
import RoyaleSection from "@/components/luck/royale/RoyaleSection";
import RoyaleHero from "@/components/luck/royale/RoyaleHero";
import RoyaleWallet from "@/components/luck/royale/RoyaleWallet";
import RoyaleSpinStage from "@/components/luck/royale/RoyaleSpinStage";
import RoyaleSpinControls, { type SpinOption } from "@/components/luck/royale/RoyaleSpinControls";
import { RoyaleStreak, RoyaleLuckyHour, RoyaleJackpot } from "@/components/luck/royale/RoyaleStatus";
import RoyalePrizePool from "@/components/luck/royale/RoyalePrizePool";
import RoyaleHistory from "@/components/luck/royale/RoyaleHistory";
import RoyaleLeaderboard from "@/components/luck/royale/RoyaleLeaderboard";
import RoyaleWinOverlay from "@/components/luck/royale/RoyaleWinOverlay";
import RoyaleWarnDialog from "@/components/luck/royale/RoyaleWarnDialog";
import RoyalePremiumCard from "@/components/luck/royale/RoyalePremiumCard";


interface Prize {
  kind: "extra_life" | "auto_hint" | "time_freeze" | "streak_freeze" | "streak_coins" | "gems" | "coins";
  value: number;
  label: string;
  emoji: string;
  rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  weight: number;
  color: string;
}

interface SpinResult extends Prize {
  index: number;
}

interface HistoryItem {
  id: string;
  reward_label: string;
  rarity: string;
  reward_kind: string;
  reward_value: number;
  spin_type: string;
  created_at: string;
}


export default function LuckRoyaleNyawa() {
  const nav = useNavigate();
  const { toast } = useToast();
  // Wajib login akun saldo: jangan fallback ke visitor tamu.
  const isLoggedIn = typeof window !== "undefined"
    && localStorage.getItem("balance_logged_in") === "true"
    && !!localStorage.getItem("balance_visitor_id");
  const visitorId = typeof window !== "undefined"
    ? localStorage.getItem("balance_visitor_id")
    : null;

  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [gems, setGems] = useState(0);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [singleCost, setSingleCost] = useState(50);
  const [rarityRates, setRarityRates] = useState<Record<string, number> | null>(null);
  const [bundles, setBundles] = useState<Array<{ count: number; cost: number; label: string; badge?: string }>>([]);
  const [normalDiscount, setNormalDiscount] = useState<{ limitPerDay: number; prices: Record<number, number>; usage: Record<number, number> }>({ limitPerDay: 5, prices: {}, usage: {} });
  const [results, setResults] = useState<SpinResult[] | null>(null);
  const [revealCount, setRevealCount] = useState(0);
  const [revealDone, setRevealDone] = useState(false);
  const [reelSpinning, setReelSpinning] = useState(false);
  const [freeSpinAvailable, setFreeSpinAvailable] = useState(false);
  const [luckyStreak, setLuckyStreak] = useState(0);
  const [streakMultiplier, setStreakMultiplier] = useState(1);
  const [bonusPopup, setBonusPopup] = useState<number | null>(null);
  const [jackpotPopup, setJackpotPopup] = useState<number | null>(null);
  const [tokenPopup, setTokenPopup] = useState<number | null>(null);
  const [luckyTokens, setLuckyTokens] = useState(0);
  const [tokenProgress, setTokenProgress] = useState(0);
  const [tokenThreshold, setTokenThreshold] = useState(10);
  const [megaPool, setMegaPool] = useState(5000);
  // ⚠️ Popup peringatan menang/kalah — wajib di-acknowledge sebelum spin pertama
  const [warningOpen, setWarningOpen] = useState(false);
  const [warningAck, setWarningAck] = useState(false);
  const [warningEntry, setWarningEntry] = useState(false);
  const [warnDontRemind, setWarnDontRemind] = useState(false);
  const [pendingSpin, setPendingSpin] = useState<{ mode: "single" | "pack" | "free"; count?: number } | null>(null);
  useEffect(() => {
    const until = Number(localStorage.getItem("lr_warn_skip_until") || 0);
    if (until > Date.now()) { setWarningAck(true); return; }
    setWarningEntry(true);
    setWarningOpen(true);
  }, []);
  const [tokenShop, setTokenShop] = useState<Array<{ code: string; name: string; cost: number; kind: string; value: number; rarity: string; emoji: string; tier?: "free" | "premium" | "super_premium" | "ultra" }>>([]);
  const [freeDailyShop, setFreeDailyShop] = useState<Array<{ code: string; name: string; kind: string; value: number; rarity: string; emoji: string; claimedToday: boolean }>>([]);
  const [shopAccess, setShopAccess] = useState<{ isActive: boolean; activeUntil: string | null; purchasedAt: string | null; price: number; durationDays: number }>({ isActive: false, activeUntil: null, purchasedAt: null, price: 100000, durationDays: 30 });
  const [superShopAccess, setSuperShopAccess] = useState<{ isActive: boolean; activeUntil: string | null; purchasedAt: string | null; price: number; durationDays: number }>({ isActive: false, activeUntil: null, purchasedAt: null, price: 300000, durationDays: 30 });
  const [ultraShopAccess, setUltraShopAccess] = useState<{ isActive: boolean; activeUntil: string | null; purchasedAt: string | null; price: number; durationDays: number }>({ isActive: false, activeUntil: null, purchasedAt: null, price: 500000, durationDays: 30 });
  const [nyawaPremium, setNyawaPremium] = useState<{ isActive: boolean; activeUntil: string | null; purchasedAt: string | null; price: number; durationHours: number }>({ isActive: false, activeUntil: null, purchasedAt: null, price: 50000, durationHours: 24 });
  const [premiumShopUnlock, setPremiumShopUnlock] = useState<{ isActive: boolean; activeUntil: string | null; grantedAt: string | null; durationDays: number }>({ isActive: false, activeUntil: null, grantedAt: null, durationDays: 7 });
  const [npPinOpen, setNpPinOpen] = useState(false);
  const [npPin, setNpPin] = useState("");
  const [npBuying, setNpBuying] = useState(false);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [luckyVoucher, setLuckyVoucher] = useState("");
  const [activeLuckyVoucher, setActiveLuckyVoucher] = useState<{ code: string; pct: number; expiresAt: string } | null>(null);
  const [activatingVoucher, setActivatingVoucher] = useState(false);
  const [shopTier, setShopTier] = useState<"free" | "premium" | "super_premium" | "ultra">("free");
  const [spinSubtab, setSpinSubtab] = useState<"normal" | "premium" | "tier">("normal");
  const [milestoneRefreshKey, setMilestoneRefreshKey] = useState(0);
  const [luckyHour, setLuckyHour] = useState<{ active: boolean; hour: number; date: string; nextActiveAt: string; boostedUntil?: string | null; source?: "free" | "purchased" | null } | null>(null);
  const [lhPackages, setLhPackages] = useState<Array<{ code: string; hours: number; price: number; firstPrice?: number; effectivePrice: number; isFirstDiscountAvailable: boolean; label: string; badge?: string }>>([]);
  const [lhFirstUsed, setLhFirstUsed] = useState(false);
  const [buyingLh, setBuyingLh] = useState<string | null>(null);
  const [lhPinOpen, setLhPinOpen] = useState(false);
  const [lhPin, setLhPin] = useState("");
  const [lhSelectedPkg, setLhSelectedPkg] = useState<{ code: string; label: string; effectivePrice: number; usingFirstDiscount: boolean } | null>(null);
  const [shopPinOpen, setShopPinOpen] = useState(false);
  const [shopPin, setShopPin] = useState("");
  const [shopPinTier, setShopPinTier] = useState<"premium" | "super_premium" | "ultra">("premium");
  const [nowTick, setNowTick] = useState(Date.now());
  const [tickets, setTickets] = useState<{ normal: number; premium: number }>({ normal: 0, premium: 0 });
  const [ticketPacks, setTicketPacks] = useState<any[]>([]);
  const [ticketRate, setTicketRate] = useState<{ normal: number; premium: number }>({ normal: 50, premium: 100 });
  const [powerUps, setPowerUps] = useState<{ nyawa: number; hint: number; freeze: number } | null>(null);
  type ShopTab = "tickets" | "vouchers" | "bonuses" | "premium";
  const [shopTab, setShopTab] = useState<ShopTab>("tickets");
  const [buyGemsOpen, setBuyGemsOpen] = useState(false);
  // Synchronous guard: blocks a second spin request before React re-renders `spinning`.
  const spinLockRef = useRef(false);
  useEffect(() => { const t = setInterval(() => setNowTick(Date.now()), 1000); return () => clearInterval(t); }, []);
  const luckyVoucherPct = Math.max(0, Math.min(100, Number(activeLuckyVoucher?.pct || 0)));
  const applyLuckyVoucherCost = (cost: number) => luckyVoucherPct > 0 ? Math.max(1, cost - Math.floor((cost * luckyVoucherPct) / 100)) : cost;

  const effectivePremiumShopUnlock = (() => {
    if (premiumShopUnlock.isActive) return premiumShopUnlock;
    if (!nyawaPremium.isActive || !nyawaPremium.purchasedAt) return premiumShopUnlock;
    const grantedAtMs = new Date(nyawaPremium.purchasedAt).getTime();
    if (!Number.isFinite(grantedAtMs)) return premiumShopUnlock;
    const activeUntil = new Date(grantedAtMs + 7 * 24 * 60 * 60 * 1000).toISOString();
    return new Date(activeUntil).getTime() > nowTick
      ? { isActive: true, activeUntil, grantedAt: nyawaPremium.purchasedAt, durationDays: 7 }
      : premiumShopUnlock;
  })();

  // Reveal hadiah satu per satu - kecepatan adaptif berdasarkan jumlah
  useEffect(() => {
    if (!results || results.length === 0) {
      setRevealDone(true);
      return;
    }
    setRevealCount(0);
    setRevealDone(false);
    const total = results.length;
    // CEPAT: normal spin langsung terasa responsif; pack besar selesai reveal < 1 detik.
    const totalDurationMs = total <= 1 ? 80 : total <= 10 ? 260 : total <= 50 ? 420 : total <= 150 ? 620 : total <= 300 ? 780 : 950;
    // Items per tick agresif untuk pack besar (frame ~16ms target)
    const itemsPerTick = total <= 1 ? 1 : total <= 10 ? 2 : total <= 50 ? 5 : total <= 100 ? 10 : total <= 200 ? 20 : total <= 350 ? 35 : 60;
    const ticks = Math.ceil(total / itemsPerTick);
    const tickMs = Math.max(16, Math.floor(totalDurationMs / ticks));
    let current = 0;
    const interval = setInterval(() => {
      current = Math.min(total, current + itemsPerTick);
      setRevealCount(current);
      if (current >= total) {
        clearInterval(interval);
        setRevealDone(true);
      }
    }, tickMs);
    return () => clearInterval(interval);
  }, [results]);

  // Leaderboard state & loader
  const [lbLoading, setLbLoading] = useState(false);
  const [lbLoaded, setLbLoaded] = useState(false);
  const [topSpinners, setTopSpinners] = useState<Array<{ name: string; total: number; jackpots: number }>>([]);
  const [topJackpots, setTopJackpots] = useState<Array<{ name: string; count: number; latestLabel: string; latestAt: string }>>([]);
  const [lbInner, setLbInner] = useState<"spin" | "jackpot">("spin");
  const fetchLeaderboard = async () => {
    setLbLoading(true);
    try {
      const { data } = await invokeRoyale({
        body: { visitorId, action: "leaderboard" },
      });
      if (data?.success) {
        setTopSpinners(data.topSpinners || []);
        setTopJackpots(data.topJackpots || []);
        setLbLoaded(true);
      }
    } finally { setLbLoading(false); }
  };

  const fetchData = async () => {
    if (!visitorId) return;
    try {
      const { data, error } = await invokeRoyale({
        body: { visitorId, action: "check" },
      });
      if (error) throw error;
      setPrizes(data.prizes || []);
      setGems(data.gems || 0);
      if (data.powerUps) setPowerUps(data.powerUps);
      setHistory(data.history || []);
      setSingleCost(data.singleCostGems || 50);
      setBundles(data.bundles || []);
      if (data.rarityRates?.normal) setRarityRates(data.rarityRates.normal);
      if (data.normalDiscount) setNormalDiscount(data.normalDiscount);
      setFreeSpinAvailable(!!data.freeSpinAvailable);
      setLuckyStreak(Number(data.luckyStreak || 0));
      setStreakMultiplier(Number(data.streakMultiplier || 1));
      setLuckyTokens(Number(data.luckyTokens || 0));
      setTokenProgress(Number(data.luckyTokenProgress || 0));
      setTokenThreshold(Number(data.luckyTokenThreshold || 10));
      setMegaPool(Number(data.megaJackpotPool || 5000));
      setTokenShop(data.tokenShop || []);
      setFreeDailyShop(data.freeDailyShop || []);
      setShopAccess(data.shopAccess || { isActive: false, activeUntil: null, purchasedAt: null, price: 100000, durationDays: 30 });
      setSuperShopAccess(data.superShopAccess || { isActive: false, activeUntil: null, purchasedAt: null, price: 300000, durationDays: 30 });
      setUltraShopAccess(data.ultraShopAccess || { isActive: false, activeUntil: null, purchasedAt: null, price: 500000, durationDays: 30 });
      if (data.nyawaPremium) setNyawaPremium(data.nyawaPremium);
      if (data.premiumShopUnlock) setPremiumShopUnlock(data.premiumShopUnlock);
      if (data.luckyHour) setLuckyHour(data.luckyHour);
      if (Array.isArray(data.luckyHourPackages)) setLhPackages(data.luckyHourPackages);
      setLhFirstUsed(!!data.luckyHourFirstDiscountUsed);
      if (data.tickets) setTickets(data.tickets);
      if (Array.isArray(data.ticketPacks)) setTicketPacks(data.ticketPacks);
      if (data.ticketRate) setTicketRate(data.ticketRate);
      setActiveLuckyVoucher(data.activeLuckyVoucher || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isLoggedIn) fetchData(); }, [isLoggedIn, visitorId]);
  useEffect(() => {
    // Tampilkan otomatis saat masuk halaman — kecuali user sudah centang "jangan ingatkan 1 hari".
    const until = Number(localStorage.getItem("lr_warn_skip_until") || 0);
    if (until > Date.now()) { setWarningAck(true); setWarningOpen(false); setWarningEntry(false); return; }
    if (isLoggedIn) setWarningOpen(true);
  }, [isLoggedIn]);

  const doSpin = async (mode: "single" | "pack" | "free", count?: number, skipWarning = false) => {
    if (!visitorId || spinning || spinLockRef.current) return;
    // ⚠️ Tahan spin pertama sampai user setuju peringatan menang/kalah
    if (!skipWarning && !warningAck) {
      setPendingSpin({ mode, count });
      setWarningOpen(true);
      return;
    }
    spinLockRef.current = true;
    setSpinning(true);
    setReelSpinning(true);
    try {
      const body: any = { visitorId };
      if (mode === "single") {
        body.action = "spin_single";
        body.useTickets = true;
        if (luckyVoucher.trim()) body.voucherCode = luckyVoucher.trim();
      } else if (mode === "free") {
        body.action = "spin_free";
      } else {
        body.action = "spin_pack";
        body.count = count;
        body.useTickets = true;
      }
      const { data, error } = await invokeRoyale({ body });
      if (error) throw error;
      if (data.error) {
        toast({ title: "Gagal spin", description: data.error, variant: "destructive" });
        setReelSpinning(false);
        return;
      }
      setReelSpinning(false);
      setRevealCount(0);
      setRevealDone(false);
      setResults(data.results);
      setGems(data.gems);
      if (data.luckyVoucherApplied && data.luckyVoucherApplied > 0) {
        toast({ title: "🎟️ Voucher Lucky Royale dipakai!", description: `Hemat ${data.luckyVoucherApplied} gem (${data.luckyVoucherCode}).` });
        setLuckyVoucher("");
      }
      if (typeof data.luckyStreak === "number") setLuckyStreak(data.luckyStreak);
      if (typeof data.streakMultiplier === "number") setStreakMultiplier(data.streakMultiplier);
      if (data.totalBonusGems && data.totalBonusGems > 0) {
        setBonusPopup(data.totalBonusGems);
        setTimeout(() => setBonusPopup(null), 4000);
      }
      if (data.jackpotWonTotal && data.jackpotWonTotal > 0) {
        setJackpotPopup(data.jackpotWonTotal);
        setTimeout(() => setJackpotPopup(null), 6000);
      }
      if (data.earnedTokens && data.earnedTokens > 0) {
        setTokenPopup(data.earnedTokens);
        setTimeout(() => setTokenPopup(null), 4000);
      }
      if (typeof data.luckyTokens === "number") setLuckyTokens(data.luckyTokens);
      if (typeof data.luckyTokenProgress === "number") setTokenProgress(data.luckyTokenProgress);
      if (typeof data.megaJackpotPool === "number") setMegaPool(data.megaJackpotPool);
      if (data.tickets) setTickets(data.tickets);
      if (mode === "free") setFreeSpinAvailable(false);
      setMilestoneRefreshKey((n) => n + 1);
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Gagal", variant: "destructive" });
      setReelSpinning(false);
    } finally {
      spinLockRef.current = false;
      setSpinning(false);
    }
  };

  const activateLuckyVoucher = async () => {
    if (!visitorId || activatingVoucher || !luckyVoucher.trim()) return;
    setActivatingVoucher(true);
    try {
      const { data, error } = await invokeRoyale({
        body: { visitorId, action: "activate_lucky_voucher", voucherCode: luckyVoucher.trim() },
      });
      if (error) throw error;
      if (data.error) {
        toast({ title: "Gagal aktifkan", description: data.error, variant: "destructive" });
        return;
      }
      setLuckyVoucher("");
      toast({ title: "🎟️ Voucher aktif!", description: `Diskon ${data.pct}% untuk semua spin selama ${data.hours % 24 === 0 ? data.hours / 24 + " hari" : data.hours + " jam"}.` });
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Gagal", variant: "destructive" });
    } finally {
      setActivatingVoucher(false);
    }
  };

  const redeemToken = async (itemCode: string) => {
    if (!visitorId || redeeming) return;
    setRedeeming(itemCode);
    try {
      const { data, error } = await invokeRoyale({
        body: { visitorId, action: "redeem_token", itemCode },
      });
      if (error) throw error;
      if (data.error) {
        toast({ title: "Gagal tukar", description: data.error, variant: "destructive" });
        return;
      }
      setLuckyTokens(data.luckyTokens);
      setGems(data.gems);
      toast({ title: "🎟️ Token Ditukar!", description: `Kamu dapat: ${data.item.name}` });
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Gagal", variant: "destructive" });
    } finally {
      setRedeeming(null);
    }
  };

  const claimFreeDaily = async (itemCode: string) => {
    if (!visitorId || redeeming) return;
    setRedeeming(itemCode);
    try {
      const { data, error } = await invokeRoyale({
        body: { visitorId, action: "claim_free_daily", itemCode },
      });
      if (error) throw error;
      if (data.error) {
        toast({ title: "Gagal klaim", description: data.error, variant: "destructive" });
        return;
      }
      setGems(data.gems);
      toast({ title: "🎁 Hadiah Gratis Diklaim!", description: `Kamu dapat: ${data.item.name}` });
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Gagal", variant: "destructive" });
    } finally {
      setRedeeming(null);
    }
  };

  const buyShopAccess = async (tier: "premium" | "super_premium" | "ultra" = "premium") => {
    if (!visitorId || redeeming) return;
    setShopPinTier(tier);
    setShopPin("");
    setShopPinOpen(true);
  };

  const confirmBuyShopAccess = async () => {
    if (!visitorId || redeeming) return;
    const tier = shopPinTier;
    const access = tier === "ultra" ? ultraShopAccess : tier === "super_premium" ? superShopAccess : shopAccess;
    const tierLabel = tier === "ultra" ? "Ultra" : tier === "super_premium" ? "Super Premium" : "Premium";
    if (shopPin.length !== 6) {
      toast({ title: "PIN salah", description: "Masukkan 6 digit PIN", variant: "destructive" });
      return;
    }
    const key = tier === "ultra" ? "__ultra_shop_access__" : tier === "super_premium" ? "__super_shop_access__" : "__shop_access__";
    setRedeeming(key);
    try {
      const { data, error } = await invokeRoyale({
        body: { visitorId, action: "buy_shop_access", tier, pin: shopPin },
      });
      if (error) throw error;
      if (data.error) {
        toast({ title: "Gagal beli akses", description: data.error, variant: "destructive" });
        if (data.needPin) setShopPin("");
        return;
      }
      if (tier === "ultra" && data.ultraShopAccess) setUltraShopAccess(data.ultraShopAccess);
      else if (tier === "super_premium" && data.superShopAccess) setSuperShopAccess(data.superShopAccess);
      else if (data.shopAccess) setShopAccess(data.shopAccess);
      setShopPinOpen(false);
      setShopPin("");
      toast({
        title: `🔓 Akses ${tierLabel} Aktif!`,
        description: `Berlaku ${access.durationDays} hari - sisa saldo Rp ${data.balance.toLocaleString("id-ID")}`,
      });
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Gagal", variant: "destructive" });
    } finally {
      setRedeeming(null);
    }
  };

  const buyNyawaPremium = async () => {
    if (!visitorId || npBuying) return;
    if (!npPin || npPin.length !== 6) {
      toast({ title: "PIN salah", description: "Masukkan 6 digit PIN", variant: "destructive" });
      return;
    }
    setNpBuying(true);
    try {
      const { data, error } = await invokeRoyale({
        body: { visitorId, action: "buy_nyawa_premium", pin: npPin },
      });
      if (error) throw error;
      if (data.error) {
        toast({ title: "Gagal", description: data.error, variant: "destructive" });
        return;
      }
      if (data.nyawaPremium) setNyawaPremium(data.nyawaPremium);
      if (data.premiumShopUnlock) setPremiumShopUnlock(data.premiumShopUnlock);
      if (data.nyawaPremium?.isActive) setSpinSubtab("premium");
      setNpPinOpen(false);
      setNpPin("");
      toast({
        title: "👑 Nyawa Premium Aktif!",
        description: `Pool MANTAP JIWA + Premium Spin aktif 30 hari - sisa saldo Rp ${(data.balance || 0).toLocaleString("id-ID")}`,
      });
      fetchData();
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Gagal", variant: "destructive" });
    } finally {
      setNpBuying(false);
    }
  };

  // 🏆 Hadiah Utama: tampilkan hadiah PALING JACKPOT dulu (mythic → legendary → epic),
  // bukan power-up common. Player harus lihat "wow factor" sebelum spin.
  const RARITY_RANK: Record<string, number> = { mythic: 5, legendary: 4, epic: 3, rare: 2, common: 1 };
  const featured = [...prizes]
    .sort((a, b) => {
      const ra = RARITY_RANK[a.rarity] || 0;
      const rb = RARITY_RANK[b.rarity] || 0;
      if (rb !== ra) return rb - ra;
      // tie-breaker: nilai hadiah lebih besar di depan
      return (b.value || 0) - (a.value || 0);
    });
  const totalPrizeWeight = prizes.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);
  // Server picks rarity first (fixed odds), then an item inside that rarity by weight.
  const rarityWeight: Record<string, number> = {};
  for (const p of prizes) rarityWeight[p.rarity] = (rarityWeight[p.rarity] || 0) + (Number(p.weight) || 0);
  const prizeChance = (p: { rarity: string; weight?: number }) => rarityRates
    ? (rarityRates[p.rarity] || 0) * ((Number(p.weight) || 0) / (rarityWeight[p.rarity] || 1)) * 100
    : (totalPrizeWeight ? ((Number(p.weight) || 0) / totalPrizeWeight) * 100 : 0);

  // ---------- Spin price options — every number comes from the server `check` payload ----------
  const discountLimit = normalDiscount.limitPerDay || 5;
  const spinOption = (count: number, listCost: number, label: string, badge?: string): SpinOption => {
    const dPrice = normalDiscount.prices?.[count];
    const dUsed = normalDiscount.usage?.[count] || 0;
    const dActive = dPrice != null && dPrice < listCost && dUsed < discountLimit;
    const beforeVoucher = dActive ? dPrice : listCost;
    const effective = applyLuckyVoucherCost(beforeVoucher);
    const ticketUsed = Math.min(tickets.normal + luckyTokens, count);
    const remainingSpins = count - ticketUsed;
    const gemCost = remainingSpins > 0 ? (count === 1 ? effective : Math.ceil((effective * remainingSpins) / count)) : 0;
    const listSavings = singleCost * count - listCost;
    const note = dActive
      ? `Diskon · sisa ${Math.max(0, discountLimit - dUsed)}×`
      : effective < beforeVoucher
      ? `Voucher −${luckyVoucherPct}%`
      : listSavings > 0
      ? `Hemat ${Math.round((listSavings / (singleCost * count)) * 100)}%`
      : undefined;
    return { count, label, badge, gemCost, ticketUsed, original: effective < listCost ? listCost : undefined, note, highlight: count === 20 || count === 125 };
  };
  const singleOption = spinOption(1, singleCost, "1 SPIN");
  const bundleOptions = bundles.map((b) => spinOption(b.count, b.cost, b.label, b.badge));
  const openShop = (tab: ShopTab) => {
    setShopTab(tab);
    requestAnimationFrame(() => document.getElementById("royal-shop")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const onTicketShopUpdate = (d: { tickets?: { normal: number; premium: number }; gems?: number; luckyTokens?: number }) => {
    if (d.tickets) setTickets(d.tickets);
    if (typeof d.gems === "number") setGems(d.gems);
    if (typeof d.luckyTokens === "number") setLuckyTokens(d.luckyTokens);
  };
  const tabCls = "royale-tab h-10 rounded-xl text-[11px] font-black tracking-[0.18em] data-[state=active]:bg-transparent data-[state=active]:text-amber-100 data-[state=active]:shadow-none";


  if (!isLoggedIn || !visitorId) {
    return (
      <div className="royale-page min-h-screen text-white relative overflow-x-hidden">
        <div className="sticky top-0 z-30 backdrop-blur-xl bg-black/70 border-b-2 border-orange-500/50 relative">
          <div className="flex items-center justify-between px-3 py-2.5 relative">
            <Button variant="ghost" size="sm" className="text-white hover:bg-orange-500/20 border border-orange-500/30" onClick={() => nav(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-orange-400" fill="currentColor" />
              <h1 className="font-black text-sm tracking-[0.25em] battle-title-gradient">LUCK ROYALE</h1>
            </div>
            <div className="w-10" />
          </div>
        </div>
        <LoginGate
          title="Luck Royale"
          description="Login akun saldo dulu untuk membuka Lucky Royale, spin, klaim free spin, voucher, tiket, dan hadiah."
          emoji="👑"
          gradient="from-orange-500 to-red-600"
          onGoToLogin={() => nav("/?tab=saldo")}
        />
      </div>
    );
  }


  return (
    <div className="royale-page min-h-screen text-white relative overflow-x-hidden">
      <div aria-hidden className="royale-particles pointer-events-none fixed inset-0" />

      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-black/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-xl items-center justify-between px-3 py-2">
          <button type="button" onClick={() => nav(-1)} aria-label="Kembali" className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-white/80 transition hover:bg-white/10 active:scale-95">
            <ArrowLeft className="h-[18px] w-[18px]" />
          </button>
          <div className="flex items-center gap-1.5">
            <Crown className="h-4 w-4 text-amber-300" fill="currentColor" />
            <span className="text-[11px] font-black tracking-[0.3em] text-white/85">LUCK ROYALE</span>
          </div>
          <button type="button" onClick={() => setBuyGemsOpen(true)} aria-label="Saldo Gem, beli Gem" className="flex h-10 items-center gap-1 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-3 transition hover:bg-cyan-400/20">
            <Gem className="h-3.5 w-3.5 text-cyan-300" fill="currentColor" />
            <span className="text-[12px] font-black tabular-nums text-cyan-50">{formatCompactNumber(gems)}</span>
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-amber-300" />
        </div>
      ) : (
        <main className="relative z-10 mx-auto w-full max-w-md space-y-4 px-3 pb-28 pt-4 sm:max-w-xl">
          <RoyaleHero gems={gems} nyawa={powerUps ? powerUps.nyawa : null} streak={luckyStreak} tickets={tickets} />
          <RoyaleWallet gems={gems} spinCost={singleOption.gemCost || singleCost} hasFreeSpin={freeSpinAvailable || tickets.normal + luckyTokens > 0} onBuy={() => setBuyGemsOpen(true)} />

          {/* 🎰 SPIN AREA — fokus utama */}
          <section id="royale-spin" className="royale-glass royale-gold-border scroll-mt-20 rounded-3xl p-3 sm:p-4" aria-label="Area spin">
            <Tabs value={spinSubtab} onValueChange={(v) => setSpinSubtab(v as "normal" | "premium" | "tier")} className="w-full" data-spin-subtabs>
              <TabsList className="royale-tabs grid h-auto w-full grid-cols-3 gap-1 rounded-2xl p-1">
                <TabsTrigger value="normal" className={tabCls}>NORMAL</TabsTrigger>
                <TabsTrigger value="premium" className={tabCls}>PREMIUM</TabsTrigger>
                <TabsTrigger value="tier" className={tabCls}>TIER</TabsTrigger>
              </TabsList>

              <TabsContent value="normal" className="mt-4 space-y-4">
                <RoyaleSpinStage prizes={prizes} featured={featured} spinning={reelSpinning} />
                <RoyaleSpinControls
                  single={singleOption}
                  bundles={bundleOptions}
                  spinning={spinning}
                  onSpin={(count) => (count === 1 ? doSpin("single") : doSpin("pack", count))}
                />
                <button
                  type="button"
                  disabled={!freeSpinAvailable || spinning}
                  onClick={() => doSpin("free")}
                  className={`flex min-h-[56px] w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition active:scale-[0.99] disabled:cursor-not-allowed ${freeSpinAvailable ? "border-emerald-300/35 bg-emerald-400/[0.08] hover:bg-emerald-400/[0.12]" : "border-white/[0.06] bg-white/[0.02] opacity-70"}`}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-400/15 text-lg">🎁</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-black text-white">Daily Free Spin</span>
                    <span className="block text-[10px] text-white/55">{freeSpinAvailable ? "Gratis 1× hari ini · reset 00:00 WIB" : "Sudah diklaim, kembali besok"}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black tracking-wider ${freeSpinAvailable ? "bg-emerald-400 text-emerald-950" : "bg-white/10 text-white/50"}`}>
                    {freeSpinAvailable ? "PUTAR" : "✓"}
                  </span>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => openShop("vouchers")} className={`min-h-[56px] rounded-2xl border px-3 py-2 text-left transition hover:bg-white/5 ${activeLuckyVoucher ? "border-emerald-300/35 bg-emerald-400/[0.07]" : "border-white/[0.08] bg-white/[0.03]"}`}>
                    <span className="flex items-center gap-1 text-[9px] font-black tracking-[0.2em] text-white/50"><Ticket className="h-3 w-3" /> VOUCHER</span>
                    <span className={`mt-0.5 block truncate text-[12px] font-black ${activeLuckyVoucher ? "text-emerald-200" : "text-white/85"}`}>
                      {activeLuckyVoucher ? `−${activeLuckyVoucher.pct}% aktif` : "Punya voucher?"}
                    </span>
                  </button>
                  <button type="button" onClick={() => openShop("bonuses")} className="min-h-[56px] rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-left transition hover:bg-white/5">
                    <span className="flex items-center justify-between text-[9px] font-black tracking-[0.2em] text-white/50">
                      <span className="flex items-center gap-1"><Award className="h-3 w-3" /> LUCKY TOKEN</span>
                      <span className="text-[12px] tabular-nums text-amber-200">{luckyTokens}</span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-gradient-to-r from-amber-300 to-orange-500 transition-all" style={{ width: `${Math.min(100, (tokenProgress / Math.max(1, tokenThreshold)) * 100)}%` }} />
                    </span>
                    <span className="mt-1 block text-[9px] text-white/45">{tokenProgress}/{tokenThreshold} spin berbayar → +1</span>
                  </button>
                </div>
              </TabsContent>

              <TabsContent value="premium" className="mt-4 space-y-4">
                <RoyalePremiumCard isActive={nyawaPremium.isActive} activeUntil={nyawaPremium.activeUntil} price={nyawaPremium.price} onBuy={() => setNpPinOpen(true)} />
              <PremiumSpinPanel
                visitorId={visitorId}
                gems={gems}
                setGems={setGems}
                isUnlocked={nyawaPremium.isActive}
                expiresAt={nyawaPremium.activeUntil}
                price={nyawaPremium.price}
                shopUnlock={effectivePremiumShopUnlock}
                useTickets={true}
                ticketBalance={tickets.premium}
                luckyTokens={luckyTokens}
                onLuckyTokensUpdate={setLuckyTokens}
                onTicketsUpdate={(t) => setTickets(t)}
              />
              </TabsContent>

              <TabsContent value="tier" className="mt-4">
                <TierSpinArena visitorId={visitorId} gems={gems} setGems={setGems} />
              </TabsContent>
            </Tabs>
          </section>

          {/* 🔥 Status */}
          <div className="grid grid-cols-2 gap-3">
            <RoyaleStreak streak={luckyStreak} multiplier={streakMultiplier} />
            <RoyaleLuckyHour luckyHour={luckyHour} now={nowTick} />
          </div>
          <RoyaleJackpot pool={megaPool} />

          {spinSubtab === "normal" && prizes.length > 0 && (
            <RoyaleSection title="PRIZE POOL" subtitle="Normal Spin · peluang dari server" icon={<Trophy className="h-4 w-4" />}>
              <RoyalePrizePool prizes={prizes} chanceOf={prizeChance} rarityRates={rarityRates} />
            </RoyaleSection>
          )}

          {/* 🎟️ Tiket ringkas */}
          <section className="royale-glass flex items-center gap-2 rounded-2xl p-3" aria-label="Tiket spin">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/[0.06] px-2.5 py-1.5">
                <p className="text-[9px] font-black tracking-[0.2em] text-cyan-200/80">🎟 NORMAL</p>
                <p className="text-lg font-black leading-tight tabular-nums">{tickets.normal}</p>
              </div>
              <div className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-400/[0.06] px-2.5 py-1.5">
                <p className="text-[9px] font-black tracking-[0.2em] text-fuchsia-200/80">🎟 PREMIUM</p>
                <p className="text-lg font-black leading-tight tabular-nums">{tickets.premium}</p>
              </div>
            </div>
            <button type="button" onClick={() => openShop("tickets")} className="h-12 shrink-0 rounded-xl border border-white/10 px-3 text-[10px] font-black tracking-wider text-white/80 transition hover:bg-white/5">
              Ticket<br />Shop
            </button>
          </section>

          <RoyaleSection title="RECENT SPINS" icon={<Clock className="h-4 w-4" />} collapsible defaultOpen>
            <RoyaleHistory history={history} />
          </RoyaleSection>

          {/* 🛍️ ROYAL SHOP */}
          <RoyaleSection id="royal-shop" title="ROYAL SHOP" subtitle="Tiket, voucher, bonus & premium" icon={<ShoppingBag className="h-4 w-4" />}>
            <Tabs value={shopTab} onValueChange={(v) => setShopTab(v as ShopTab)} className="w-full">
              <TabsList className="royale-tabs royale-scroll-x flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl p-1">
                <TabsTrigger value="tickets" className={`${tabCls} flex-1 shrink-0 px-3 text-[10px]`}>TICKETS</TabsTrigger>
                <TabsTrigger value="vouchers" className={`${tabCls} flex-1 shrink-0 px-3 text-[10px]`}>VOUCHERS</TabsTrigger>
                <TabsTrigger value="bonuses" className={`${tabCls} flex-1 shrink-0 px-3 text-[10px]`}>BONUSES</TabsTrigger>
                <TabsTrigger value="premium" className={`${tabCls} flex-1 shrink-0 px-3 text-[10px]`}>PREMIUM</TabsTrigger>
              </TabsList>
              <TabsContent value="tickets" className="mt-3 space-y-3">
                <SpinTicketShop visitorId={visitorId} type="normal" ticketBalance={tickets.normal} packs={ticketPacks} rate={ticketRate.normal} gems={gems} onPurchased={onTicketShopUpdate} />
                <SpinTicketShop visitorId={visitorId} type="premium" ticketBalance={tickets.premium} packs={ticketPacks} rate={ticketRate.premium} gems={gems} onPurchased={onTicketShopUpdate} />
              </TabsContent>
              <TabsContent value="vouchers" className="mt-3 space-y-3">
          {/* 🎟️ REDEEM VOUCHER LUCKY ROYALE (dari Roda Diskon) */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-300/25 bg-amber-400/[0.06] p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Ticket className="w-4 h-4 text-amber-300" />
              <span className="text-[11px] font-black tracking-wider text-amber-100">VOUCHER DISKON SPIN</span>
            </div>
            {activeLuckyVoucher ? (
              <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/40 p-2.5">
                <p className="text-[11px] font-black text-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Diskon {activeLuckyVoucher.pct}% AKTIF untuk semua spin!
                </p>
                <p className="text-[10px] text-emerald-300/90 mt-0.5">
                  Kode {activeLuckyVoucher.code} • berakhir dalam{" "}
                  {(() => {
                    const ms = new Date(activeLuckyVoucher.expiresAt).getTime() - nowTick;
                    if (ms <= 0) return "0 detik";
                    const h = Math.floor(ms / 3600000);
                    const m = Math.floor((ms % 3600000) / 60000);
                    const s = Math.floor((ms % 60000) / 1000);
                    return h > 0 ? `${h}j ${m}m` : m > 0 ? `${m}m ${s}d` : `${s}d`;
                  })()}
                </p>
              </div>
            ) : (
              <>
                <p className="text-[10px] text-white/70 mb-2 leading-snug">
                  Tempel kode voucher Lucky Royale dari Roda Diskon, lalu tekan <b>Aktifkan</b>. Diskon berlaku untuk <b>SEMUA spin</b> selama durasi voucher (2/5/12/24 jam).
                </p>
                <div className="flex items-center gap-2">
                  <input
                    value={luckyVoucher}
                    onChange={(e) => setLuckyVoucher(e.target.value.toUpperCase())}
                    placeholder="LUCKY-XXXXXX"
                    className="flex-1 h-10 rounded-xl bg-black/40 border border-amber-400/40 px-3 text-sm font-mono font-bold text-amber-100 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
                  />
                  <button
                    onClick={activateLuckyVoucher}
                    disabled={!luckyVoucher.trim() || activatingVoucher}
                    className="h-10 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-fuchsia-500 text-white text-xs font-black active:scale-95 disabled:opacity-50"
                  >
                    {activatingVoucher ? "..." : "Aktifkan"}
                  </button>
                </div>
              </>
            )}
          </div>
                <PrizeVoucherVault visitorId={visitorId} />
                <DiscountShop visitorId={visitorId} onUpdate={() => fetchData()} />
              </TabsContent>
              <TabsContent value="bonuses" className="mt-3 space-y-3">
          <PremiumMilestonePanel visitorId={visitorId} gems={gems} setGems={setGems} refreshKey={milestoneRefreshKey} />
          {/* 🎁 FREE DAILY SHOP - gratis 1x per hari */}
          {freeDailyShop.length > 0 && (
            <div className="rounded-2xl bg-gradient-to-br from-emerald-900/40 via-green-900/30 to-teal-900/40 border-2 border-emerald-400/50 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-emerald-300" fill="currentColor" />
                  <h3 className="text-xs font-black tracking-widest text-emerald-200">| FREE DAILY - GRATIS 1× SEHARI</h3>
                </div>
                <Badge className="bg-emerald-500 text-black font-black text-[8px]">🎁 FREE</Badge>
              </div>
              <p className="text-[10px] text-emerald-100/80 mb-2.5">
                Klaim hadiah <span className="font-black text-emerald-300">tanpa biaya</span> - reset tiap hari (jam 00:00 WIB)!
              </p>
              <div className="grid grid-cols-2 gap-2">
                {freeDailyShop.map((item) => {
                  const style = RARITY_STYLE[item.rarity] || RARITY_STYLE.common;
                  const claimed = item.claimedToday;
                  return (
                    <button
                      key={item.code}
                      disabled={claimed || redeeming === item.code}
                      onClick={() => claimFreeDaily(item.code)}
                      className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${claimed ? "from-slate-700 to-slate-900 opacity-60" : style.gradient} ring-2 ${claimed ? "ring-slate-500/30" : "ring-emerald-400/60"} p-2.5 text-left active:scale-95 transition disabled:cursor-not-allowed`}
                    >
                      <div className="absolute top-1 right-1 bg-black/60 rounded-full px-1.5 py-0.5">
                        <span className="text-[8px] font-black text-emerald-200">{claimed ? "✓ DONE" : "GRATIS"}</span>
                      </div>
                      <div className="text-2xl mb-0.5">{item.emoji}</div>
                      <div className="text-[10px] font-black text-white leading-tight">{item.name}</div>
                      <div className="text-[8px] font-bold text-white/70 mt-1">{claimed ? "Kembali besok" : "Tap untuk klaim"}</div>
                      {redeeming === item.code && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {/* 🎟️ TOKEN SHOP - 4 tier (Free / Premium / Super / Ultra) */}
          {tokenShop.length > 0 && (
            <div className="relative rounded-2xl">
              <div className="relative rounded-2xl border border-white/[0.08] bg-black/25 p-3 overflow-hidden">

                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-orange-300 drop-shadow-[0_0_6px_rgba(249,115,22,0.8)]" fill="currentColor" />
                      <h3 className="text-xs font-black tracking-[0.2em] battle-title-gradient">TOKEN ARSENAL</h3>
                    </div>
                    <Badge className="bg-gradient-to-r from-orange-500 to-red-600 text-white font-black text-[9px] rounded-sm shadow-lg shadow-orange-500/50">🎟️ {luckyTokens}</Badge>
                  </div>
                  <p className="text-[10px] text-orange-100/80 mb-2 font-semibold">
                    <span className="font-black text-emerald-300">FREE</span> bebas tukar · <span className="font-black text-amber-300">PREMIUM</span>, <span className="font-black text-orange-300">SUPER</span> & <span className="font-black text-red-300">ULTRA</span> butuh akses bulanan.
                  </p>

                  {/* 4-tier toggle — battle clipped */}
                  <div className="grid grid-cols-4 gap-1 mb-2.5 bg-black/60 rounded-md p-1 border border-orange-500/30">
                    <button
                      onClick={() => setShopTier("free")}
                      className={`py-1.5 battle-tier-chip text-[9px] font-black tracking-wider transition ${shopTier === "free" ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/50" : "bg-black/40 text-emerald-200/60 hover:text-emerald-100"}`}
                    >
                      🎁 FREE
                    </button>
                    <button
                      onClick={() => setShopTier("premium")}
                      className={`py-1.5 battle-tier-chip text-[9px] font-black tracking-wider transition ${shopTier === "premium" ? "bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/60" : "bg-black/40 text-amber-200/60 hover:text-amber-100"}`}
                    >
                      👑 PREMIUM
                    </button>
                    <button
                      onClick={() => setShopTier("super_premium")}
                      className={`py-1.5 battle-tier-chip text-[9px] font-black tracking-wider transition ${shopTier === "super_premium" ? "bg-gradient-to-r from-orange-500 via-red-500 to-rose-600 text-white shadow-lg shadow-red-500/60" : "bg-black/40 text-orange-200/60 hover:text-orange-100"}`}
                    >
                      💎 SUPER
                    </button>
                    <button
                      onClick={() => setShopTier("ultra")}
                      className={`py-1.5 battle-tier-chip text-[9px] font-black tracking-wider transition ${shopTier === "ultra" ? "bg-gradient-to-r from-red-600 via-rose-600 to-amber-500 text-white shadow-lg shadow-rose-500/60" : "bg-black/40 text-red-200/60 hover:text-red-100"}`}
                    >
                      💠 ULTRA
                    </button>
                  </div>

                  {/* 👑 Premium Shop Unlock 7-day banner */}
                  {effectivePremiumShopUnlock.isActive && effectivePremiumShopUnlock.activeUntil && (
                    <div className="mb-2 relative rounded-md border-2 border-orange-400/70 p-2 flex items-center gap-2 overflow-hidden">
                      <div className="absolute inset-0 battle-banner-shine" />
                      <span className="relative text-base drop-shadow-[0_0_6px_rgba(249,115,22,0.8)]">🔓</span>
                      <div className="relative flex-1 min-w-0">
                        <div className="text-[10px] font-black text-amber-100 tracking-wider">PREMIUM UNLOCK · SEMUA TIER TERBUKA</div>
                        <div className="text-[9px] text-amber-200/95 truncate font-semibold">
                          Sampai {new Date(effectivePremiumShopUnlock.activeUntil).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short", year: "2-digit" })} WIB · {effectivePremiumShopUnlock.durationDays} hari dari Nyawa Premium
                        </div>
                      </div>
                    </div>
                  )}

              {/* Per-tier locked banner (disembunyikan jika premium unlock aktif) */}
              {!effectivePremiumShopUnlock.isActive && shopTier === "premium" && !shopAccess.isActive && (
                <div className="mb-2 rounded-lg bg-rose-950/60 border border-rose-500/40 p-2 text-center">
                  <p className="text-[10px] font-black text-rose-200">
                    🔒 Akses Premium belum aktif - beli Rp {shopAccess.price.toLocaleString("id-ID")} di atas, atau beli Nyawa Premium Rp 50.000 untuk unlock 7 hari semua tier
                  </p>
                </div>
              )}
              {!effectivePremiumShopUnlock.isActive && shopTier === "super_premium" && !superShopAccess.isActive && (
                <div className="mb-2 rounded-lg bg-fuchsia-950/60 border border-fuchsia-500/40 p-2 text-center">
                  <p className="text-[10px] font-black text-fuchsia-200">
                    🔒 Akses Super Premium belum aktif - beli Rp {superShopAccess.price.toLocaleString("id-ID")} di atas, atau Nyawa Premium Rp 50.000 untuk unlock 7 hari
                  </p>
                </div>
              )}
              {!effectivePremiumShopUnlock.isActive && shopTier === "ultra" && !ultraShopAccess.isActive && (
                <div className="mb-2 rounded-lg bg-cyan-950/60 border border-cyan-400/50 p-2 text-center">
                  <p className="text-[10px] font-black text-cyan-200">
                    🔒 Akses Ultra belum aktif - beli Rp {ultraShopAccess.price.toLocaleString("id-ID")} di atas, atau Nyawa Premium Rp 50.000 untuk unlock 7 hari
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {tokenShop.filter(item => (item.tier || "free") === shopTier).map((item) => {
                  const style = RARITY_STYLE[item.rarity] || RARITY_STYLE.common;
                  const canAfford = luckyTokens >= item.cost;
                  const tierLocked = !effectivePremiumShopUnlock.isActive && (
                    (item.tier === "premium" && !shopAccess.isActive) ||
                    (item.tier === "super_premium" && !superShopAccess.isActive) ||
                    (item.tier === "ultra" && !ultraShopAccess.isActive)
                  );
                  const disabled = tierLocked || !canAfford || redeeming === item.code;
                  return (
                    <button
                      key={item.code}
                      disabled={disabled}
                      onClick={() => redeemToken(item.code)}
                      className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${style.gradient} ring-2 ${style.ring} p-2.5 text-left active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <div className="absolute top-1 right-1 flex items-center gap-0.5 bg-black/60 rounded-full px-1.5 py-0.5">
                        <Award className="w-2.5 h-2.5 text-amber-300" fill="currentColor" />
                        <span className="text-[9px] font-black text-amber-200">{item.cost}</span>
                      </div>
                      <div className="text-2xl mb-0.5">{item.emoji}</div>
                      <div className="text-[10px] font-black text-white leading-tight">{item.name}</div>
                      <div className="text-[8px] font-bold text-white/70 mt-1">{style.label}</div>
                      {tierLocked && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                          <span className="text-lg">🔒</span>
                        </div>
                      )}
                      {redeeming === item.code && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 animate-spin text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
                <p className="text-[9px] text-orange-100/70 mt-2 text-center font-semibold tracking-wider">
                  {shopTier === "free" && "26 ITEM FREE — bisa diklaim tanpa langganan"}
                  {shopTier === "premium" && "40 ITEM PREMIUM — hadiah MANTAP (Rp 100k/bln)"}
                  {shopTier === "super_premium" && "20 ITEM SUPER — hadiah MEGA DIVINE (Rp 300k/bln)"}
                  {shopTier === "ultra" && "20 ITEM ULTRA — hadiah PALING DAHSYAT GOD-TIER (Rp 500k/bln)"}
                </p>
                </div>
              </div>
            </div>
          )}
          {/* 💸 BELI JAM HOKI — bayar saldo + PIN */}
          {lhPackages.length > 0 && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-950 border border-emerald-500/40 p-3 shadow-lg shadow-emerald-900/40">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">💸</span>
                  <div>
                    <h3 className="text-xs font-black text-emerald-200 tracking-wide">BELI JAM HOKI</h3>
                    <p className="text-[9px] text-slate-400">Perpanjang durasi hoki · bayar saldo + PIN</p>
                  </div>
                </div>
                {!lhFirstUsed && (
                  <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-amber-950 animate-pulse">
                    DISKON PERTAMA
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {lhPackages.map(pkg => {
                  const usingDiscount = pkg.isFirstDiscountAvailable;
                  return (
                    <button
                      key={pkg.code}
                      disabled={!!buyingLh}
                      onClick={() => {
                        setLhSelectedPkg({
                          code: pkg.code,
                          label: pkg.label,
                          effectivePrice: pkg.effectivePrice,
                          usingFirstDiscount: usingDiscount,
                        });
                        setLhPin("");
                        setLhPinOpen(true);
                      }}
                      className="relative text-left p-2 rounded-xl bg-gradient-to-br from-emerald-600/30 to-teal-700/30 border border-emerald-500/40 hover:border-emerald-300 active:scale-95 transition disabled:opacity-50"
                    >
                      {pkg.badge && (
                        <span className="absolute -top-1 -right-1 text-[8px] font-black px-1.5 py-0.5 rounded-full bg-amber-400 text-amber-950 shadow">
                          {pkg.badge}
                        </span>
                      )}
                      <div className="text-[11px] font-black text-white">{pkg.label}</div>
                      <div className="mt-0.5 flex items-baseline gap-1 flex-wrap">
                        {usingDiscount ? (
                          <>
                            <span className="text-[11px] font-black text-amber-300">
                              Rp {pkg.effectivePrice.toLocaleString("id-ID")}
                            </span>
                            <span className="text-[8px] text-slate-400 line-through">
                              Rp {pkg.price.toLocaleString("id-ID")}
                            </span>
                          </>
                        ) : (
                          <span className="text-[11px] font-black text-emerald-200">
                            Rp {pkg.effectivePrice.toLocaleString("id-ID")}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="text-[9px] text-slate-400 mt-2 leading-snug">
                ✨ Durasi <b>akumulatif</b> — beli lagi memperpanjang sisa waktu hoki yang aktif. Free random 1 jam/hari tetap berjalan.
              </p>
            </div>
          )}
              </TabsContent>
              <TabsContent value="premium" className="mt-3 space-y-3">
                <RoyalePremiumCard
                  isActive={nyawaPremium.isActive}
                  activeUntil={nyawaPremium.activeUntil}
                  price={nyawaPremium.price}
                  onBuy={() => setNpPinOpen(true)}
                  onEnter={() => { setSpinSubtab("premium"); document.getElementById("royale-spin")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                />
          {/* 🔓 AKSES PREMIUM (Rp 100k/bln) & SUPER PREMIUM (Rp 300k/bln) */}
          {tokenShop.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Premium */}
              <div className={`rounded-2xl border-2 p-3 ${shopAccess.isActive ? "bg-gradient-to-br from-emerald-900/50 via-teal-900/40 to-cyan-900/50 border-emerald-400/60" : "bg-gradient-to-br from-rose-900/50 via-red-900/40 to-orange-900/50 border-rose-400/60"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Crown className={`w-4 h-4 ${shopAccess.isActive ? "text-emerald-300" : "text-rose-300"}`} fill="currentColor" />
                    <h3 className={`text-[11px] font-black tracking-widest ${shopAccess.isActive ? "text-emerald-200" : "text-rose-200"}`}>
                      | PREMIUM {shopAccess.isActive ? "AKTIF" : "LOCKED"}
                    </h3>
                  </div>
                  <Badge className={`${shopAccess.isActive ? "bg-emerald-500" : "bg-rose-500"} text-white font-black text-[8px]`}>
                    {shopAccess.isActive ? "✓" : "🔒"}
                  </Badge>
                </div>
                {shopAccess.isActive ? (
                  <p className="text-[10px] text-emerald-100/90">
                    Aktif sampai <span className="font-black text-emerald-200">{shopAccess.activeUntil ? new Date(shopAccess.activeUntil).toLocaleDateString("id-ID") : "-"}</span>
                    {shopAccess.activeUntil && <> · ⏳ <span className="font-black">{Math.max(0, Math.ceil((new Date(shopAccess.activeUntil).getTime() - Date.now()) / 86400000))} hari</span></>}
                  </p>
                ) : (
                  <>
                    <p className="text-[10px] text-rose-100/90 mb-2">
                      Tukar Lucky Token tier <span className="font-black">Premium</span> (20-60). Hadiah MANTAP. Berlaku <span className="font-black">{shopAccess.durationDays} hari</span>.
                    </p>
                    <Button
                      disabled={redeeming === "__shop_access__"}
                      onClick={() => buyShopAccess("premium")}
                      className="w-full h-9 text-[11px] font-black bg-gradient-to-r from-amber-400 via-orange-500 to-red-600 hover:from-amber-500 hover:via-orange-600 hover:to-red-700 text-white shadow-lg shadow-orange-500/40"
                    >
                      {redeeming === "__shop_access__" ? <Loader2 className="w-4 h-4 animate-spin" /> : <>🔓 Rp {shopAccess.price.toLocaleString("id-ID")} / {shopAccess.durationDays} HARI</>}
                    </Button>
                  </>
                )}
              </div>

              {/* Super Premium */}
              <div className={`rounded-2xl border-2 p-3 ${superShopAccess.isActive ? "bg-gradient-to-br from-fuchsia-900/60 via-purple-900/50 to-amber-900/40 border-fuchsia-400/70" : "bg-gradient-to-br from-purple-900/50 via-fuchsia-900/40 to-rose-900/50 border-purple-400/60"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Crown className={`w-4 h-4 ${superShopAccess.isActive ? "text-amber-300" : "text-fuchsia-300"}`} fill="currentColor" />
                    <h3 className={`text-[11px] font-black tracking-widest ${superShopAccess.isActive ? "text-amber-200" : "text-fuchsia-200"}`}>
                      | SUPER {superShopAccess.isActive ? "AKTIF" : "LOCKED"}
                    </h3>
                  </div>
                  <Badge className={`${superShopAccess.isActive ? "bg-amber-500" : "bg-fuchsia-600"} text-white font-black text-[8px]`}>
                    {superShopAccess.isActive ? "✓ DIVINE" : "👑 MEGA"}
                  </Badge>
                </div>
                {superShopAccess.isActive ? (
                  <p className="text-[10px] text-amber-100/90">
                    Aktif sampai <span className="font-black text-amber-200">{superShopAccess.activeUntil ? new Date(superShopAccess.activeUntil).toLocaleDateString("id-ID") : "-"}</span>
                    {superShopAccess.activeUntil && <> · ⏳ <span className="font-black">{Math.max(0, Math.ceil((new Date(superShopAccess.activeUntil).getTime() - Date.now()) / 86400000))} hari</span></>}
                  </p>
                ) : (
                  <>
                    <p className="text-[10px] text-fuchsia-100/90 mb-2">
                      Tier <span className="font-black text-amber-300">SUPER PREMIUM</span> (70-150) - hadiah MEGA: 100k Gem, 1jt Coin, 15k Nyawa! Berlaku <span className="font-black">{superShopAccess.durationDays} hari</span>.
                    </p>
                    <Button
                      disabled={redeeming === "__super_shop_access__"}
                      onClick={() => buyShopAccess("super_premium")}
                      className="w-full h-9 text-[11px] font-black bg-gradient-to-r from-fuchsia-500 via-purple-600 to-amber-500 hover:from-fuchsia-600 hover:via-purple-700 hover:to-amber-600 text-white shadow-lg shadow-fuchsia-500/40"
                    >
                      {redeeming === "__super_shop_access__" ? <Loader2 className="w-4 h-4 animate-spin" /> : <>👑 Rp {superShopAccess.price.toLocaleString("id-ID")} / {superShopAccess.durationDays} HARI</>}
                    </Button>
                  </>
                )}
              </div>

              {/* ULTRA — Rp 500k/bln */}
              <div className={`sm:col-span-2 rounded-2xl border-2 p-3 ${ultraShopAccess.isActive ? "bg-gradient-to-br from-cyan-900/50 via-emerald-900/40 to-amber-900/40 border-cyan-300/70" : "bg-gradient-to-br from-cyan-950/60 via-emerald-950/50 to-amber-950/50 border-cyan-400/50"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Crown className={`w-4 h-4 ${ultraShopAccess.isActive ? "text-cyan-200" : "text-cyan-300"}`} fill="currentColor" />
                    <h3 className={`text-[11px] font-black tracking-widest ${ultraShopAccess.isActive ? "text-cyan-100" : "text-cyan-200"}`}>
                      | ULTRA {ultraShopAccess.isActive ? "AKTIF" : "LOCKED"}
                    </h3>
                  </div>
                  <Badge className={`${ultraShopAccess.isActive ? "bg-gradient-to-r from-cyan-400 via-emerald-400 to-amber-400" : "bg-cyan-700"} text-white font-black text-[8px]`}>
                    {ultraShopAccess.isActive ? "✦ GOD-TIER" : "💠 GOD-TIER"}
                  </Badge>
                </div>
                {ultraShopAccess.isActive ? (
                  <p className="text-[10px] text-cyan-100/90">
                    Aktif sampai <span className="font-black text-cyan-100">{ultraShopAccess.activeUntil ? new Date(ultraShopAccess.activeUntil).toLocaleDateString("id-ID") : "-"}</span>
                    {ultraShopAccess.activeUntil && <> · ⏳ <span className="font-black">{Math.max(0, Math.ceil((new Date(ultraShopAccess.activeUntil).getTime() - Date.now()) / 86400000))} hari</span></>}
                  </p>
                ) : (
                  <>
                    <p className="text-[10px] text-cyan-100/90 mb-2">
                      Tier <span className="font-black text-amber-200">ULTRA</span> (160-300) — hadiah PALING DAHSYAT: <span className="font-black">100k Gem</span>, <span className="font-black">10jt Coin</span>, <span className="font-black">100k Nyawa</span>! Berlaku <span className="font-black">{ultraShopAccess.durationDays} hari</span>.
                    </p>
                    <Button
                      disabled={redeeming === "__ultra_shop_access__"}
                      onClick={() => buyShopAccess("ultra")}
                      className="w-full h-9 text-[11px] font-black bg-gradient-to-r from-cyan-400 via-emerald-500 to-amber-500 hover:from-cyan-500 hover:via-emerald-600 hover:to-amber-600 text-white shadow-lg shadow-cyan-500/40"
                    >
                      {redeeming === "__ultra_shop_access__" ? <Loader2 className="w-4 h-4 animate-spin" /> : <>💠 Rp {ultraShopAccess.price.toLocaleString("id-ID")} / {ultraShopAccess.durationDays} HARI</>}
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
              </TabsContent>
            </Tabs>
          </RoyaleSection>

          <RoyaleSection title="MORE ROYALE GAMES" subtitle="Mystery Box · Diamond · Mega Arena" icon={<Package className="h-4 w-4" />} collapsible defaultOpen={false}>
            <Tabs defaultValue="mbox" className="w-full">
              <TabsList className="royale-tabs grid h-auto w-full grid-cols-3 gap-1 rounded-2xl p-1">
                <TabsTrigger value="mbox" className={`${tabCls} text-[10px]`}>MYSTERY</TabsTrigger>
                <TabsTrigger value="diamond" className={`${tabCls} text-[10px]`}>DIAMOND</TabsTrigger>
                <TabsTrigger value="mega" className={`${tabCls} text-[10px]`}>MEGA</TabsTrigger>
              </TabsList>
            <TabsContent value="mbox" className="mt-3">
              <FadedWheel visitorId={visitorId} onGemsChange={(g) => { setGems(g); setMilestoneRefreshKey((n) => n + 1); }} activeLuckyVoucher={activeLuckyVoucher} />
            </TabsContent>

            <TabsContent value="diamond" className="mt-3">
              <DiamondRoyaleInline visitorId={visitorId} onGemsChange={(g) => setGems(g)} activeLuckyVoucher={activeLuckyVoucher} />
            </TabsContent>

            <TabsContent value="mega" className="mt-3">
              <MegaSpinArena visitorId={visitorId} gems={gems} setGems={setGems} activeLuckyVoucher={activeLuckyVoucher} />
            </TabsContent>
            </Tabs>
          </RoyaleSection>

          <RoyaleSection title="INSIGHTS" subtitle="Tips, statistik & hadiah langka" icon={<BarChart3 className="h-4 w-4" />} collapsible defaultOpen={false}>
            <Tabs defaultValue="tips" className="w-full">
              <TabsList className="royale-tabs grid h-auto w-full grid-cols-3 gap-1 rounded-2xl p-1">
                <TabsTrigger value="tips" className={`${tabCls} text-[10px]`}>TIPS</TabsTrigger>
                <TabsTrigger value="stats" className={`${tabCls} text-[10px]`}>STATS</TabsTrigger>
                <TabsTrigger value="top" className={`${tabCls} text-[10px]`}>RARE</TabsTrigger>
              </TabsList>
            <TabsContent value="tips" className="mt-3 space-y-3">
              {(() => {
                const total = history.length;
                const mythicCount = history.filter(h => h.rarity === "mythic").length;
                const legendaryCount = history.filter(h => h.rarity === "legendary").length;
                const epicCount = history.filter(h => h.rarity === "epic").length;
                const rareEpicPlus = mythicCount + legendaryCount + epicCount;
                const rareRate = total > 0 ? (rareEpicPlus / total) * 100 : 0;

                // Hitung spin sejak hadiah langka terakhir (pity tracker)
                const lastRareIdx = history.findIndex(h => ["mythic", "legendary", "epic"].includes(h.rarity));
                const spinsSinceRare = lastRareIdx === -1 ? total : lastRareIdx;
                const pityProgress = Math.min(100, (spinsSinceRare / 30) * 100);

                // Analisis waktu (jam paling sering dapat hadiah langka)
                const rareHours = history
                  .filter(h => ["mythic", "legendary", "epic"].includes(h.rarity))
                  .map(h => new Date(h.created_at).getHours());
                const hourCounts: Record<number, number> = {};
                rareHours.forEach(h => { hourCounts[h] = (hourCounts[h] || 0) + 1; });
                const luckyHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];

                // Rekomendasi mode spin
                const bundle10 = bundles.find(b => b.count === 10);
                const bundle20 = bundles.find(b => b.count === 20);
                const recommendedBundle = gems >= (bundle20?.cost || 999999)
                  ? bundle20
                  : gems >= (bundle10?.cost || 999999)
                  ? bundle10
                  : null;

                // Smart recommendations
                const recs: Array<{ icon: any; color: string; title: string; desc: string; priority: "high" | "med" | "low" }> = [];

                if (spinsSinceRare >= 20) {
                  recs.push({
                    icon: Rocket,
                    color: "from-red-500 to-orange-600",
                    title: "🔥 PITY HAMPIR PECAH!",
                    desc: `Sudah ${spinsSinceRare} spin tanpa Epic+. Peluang hadiah langka SANGAT TINGGI sekarang!`,
                    priority: "high",
                  });
                }

                if (gems < singleCost) {
                  recs.push({
                    icon: AlertCircle,
                    color: "from-amber-500 to-yellow-600",
                    title: "Gems Tidak Cukup",
                    desc: `Butuh ${singleCost} gems untuk 1 spin. Top up dulu di Gem Shop atau coba Mystery Box!`,
                    priority: "high",
                  });
                } else if (recommendedBundle) {
                  const savings = singleCost * recommendedBundle.count - recommendedBundle.cost;
                  recs.push({
                    icon: Target,
                    color: "from-fuchsia-500 to-purple-600",
                    title: `Pakai Bundle ${recommendedBundle.label}`,
                    desc: `Hemat ${savings.toLocaleString()} gems & peluang Mythic 10x lebih besar dengan multi-spin!`,
                    priority: "high",
                  });
                }

                if (total < 5) {
                  recs.push({
                    icon: Sparkles,
                    color: "from-cyan-500 to-blue-600",
                    title: "Pemula? Mulai Pelan-pelan",
                    desc: "Coba 1 SPIN dulu untuk merasakan ritme. Setelah 5 spin, baru pertimbangkan bundle!",
                    priority: "med",
                  });
                }

                if (rareRate < 10 && total >= 10) {
                  recs.push({
                    icon: TrendingDown,
                    color: "from-slate-500 to-slate-700",
                    title: "Luck Rate Rendah",
                    desc: `Rare rate kamu ${rareRate.toFixed(1)}%. Coba Mystery Box - tiap spin buka box & klaim hadiah random!`,
                    priority: "med",
                  });
                } else if (rareRate >= 20 && total >= 10) {
                  recs.push({
                    icon: CheckCircle2,
                    color: "from-emerald-500 to-green-600",
                    title: "Lagi Hoki Banget! 🍀",
                    desc: `Rare rate kamu ${rareRate.toFixed(1)}% - di atas rata-rata. Manfaatkan momen ini dengan multi-spin!`,
                    priority: "high",
                  });
                }

                if (luckyHour && parseInt(luckyHour[1] as any) >= 2) {
                  const h = parseInt(luckyHour[0]);
                  recs.push({
                    icon: Timer,
                    color: "from-indigo-500 to-purple-600",
                    title: `Jam Hoki: ${h}:00 WIB`,
                    desc: `Mayoritas hadiah langka kamu didapat sekitar jam ${h}:00. Spin lagi di jam ini!`,
                    priority: "low",
                  });
                }

                if (mythicCount === 0 && total >= 15) {
                  recs.push({
                    icon: Star,
                    color: "from-pink-500 to-rose-600",
                    title: "Belum Pernah Mythic",
                    desc: "Mythic punya peluang super tipis. Bundle besar paling efektif untuk berburu MEGA JACKPOT 50.000 Gems!",
                    priority: "med",
                  });
                }

                recs.push({
                  icon: Lightbulb,
                  color: "from-amber-500 to-orange-600",
                  title: "Tips Pro",
                  desc: "Inventory power-up tidak menambah peluang spin. Jangan buang gems untuk yang sudah penuh!",
                  priority: "low",
                });

                const sorted = recs.sort((a, b) => {
                  const order = { high: 0, med: 1, low: 2 };
                  return order[a.priority] - order[b.priority];
                });

                return (
                  <>
                    {/* Pity Tracker Card */}
                    <div className="rounded-2xl bg-gradient-to-br from-pink-900/40 via-rose-900/40 to-purple-900/40 border-2 border-pink-500/40 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Brain className="w-4 h-4 text-pink-300" />
                        <h3 className="text-xs font-black tracking-widest text-pink-200">| AI REKOMENDASI</h3>
                      </div>
                      <div className="bg-black/30 rounded-xl p-3 mb-2">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold text-pink-200/80 tracking-wider">PITY TRACKER (Epic+)</span>
                          <span className="text-[10px] font-black text-pink-100 tabular-nums">{spinsSinceRare}/30</span>
                        </div>
                        <div className="h-2.5 rounded-full bg-black/50 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-rose-500 transition-all duration-500"
                            style={{ width: `${pityProgress}%` }}
                          />
                        </div>
                        <p className="text-[9px] text-pink-200/60 mt-1">
                          {spinsSinceRare >= 25
                            ? "🔥 Hadiah langka HAMPIR PASTI di spin berikutnya!"
                            : spinsSinceRare >= 15
                            ? "⚡ Peluang hadiah langka mulai meningkat..."
                            : "💫 Lanjutkan spin untuk membangun peluang!"}
                        </p>
                      </div>

                      {/* Quick Stats */}
                      <div className="grid grid-cols-3 gap-1.5 mt-2">
                        <div className="bg-black/40 rounded-lg p-1.5 text-center">
                          <div className="text-[9px] text-pink-200/60 font-bold">RARE RATE</div>
                          <div className="text-sm font-black text-pink-100 tabular-nums">{rareRate.toFixed(1)}%</div>
                        </div>
                        <div className="bg-black/40 rounded-lg p-1.5 text-center">
                          <div className="text-[9px] text-pink-200/60 font-bold">SISA GEMS</div>
                          <div className="text-sm font-black text-cyan-200 tabular-nums">{gems}</div>
                        </div>
                        <div className="bg-black/40 rounded-lg p-1.5 text-center">
                          <div className="text-[9px] text-pink-200/60 font-bold">SPIN BISA</div>
                          <div className="text-sm font-black text-amber-200 tabular-nums">{Math.floor(gems / singleCost)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Recommendations List */}
                    <div className="space-y-2">
                      {sorted.map((r, i) => {
                        const Icon = r.icon;
                        return (
                          <div
                            key={i}
                            className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${r.color} p-3 shadow-lg ring-1 ring-white/20`}
                          >
                            <div className="absolute inset-0 opacity-20" style={{
                              backgroundImage: "radial-gradient(circle at top right, white, transparent 60%)",
                            }} />
                            <div className="relative flex gap-2.5">
                              <div className="w-9 h-9 rounded-lg bg-black/30 flex items-center justify-center shrink-0">
                                <Icon className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <h4 className="text-xs font-black text-white tracking-wide">{r.title}</h4>
                                  {r.priority === "high" && (
                                    <Badge className="bg-red-600/80 text-white text-[7px] font-black px-1 py-0">HOT</Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-white/90 leading-relaxed">{r.desc}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Strategy Card */}
                    <div className="rounded-xl bg-gradient-to-br from-purple-900/50 to-indigo-900/50 border border-purple-500/40 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="w-4 h-4 text-purple-300" />
                        <h4 className="text-xs font-black tracking-widest text-purple-200">| STRATEGI OPTIMAL</h4>
                      </div>
                      <ul className="space-y-1.5 text-[10px] text-purple-100/90">
                        <li className="flex gap-2">
                          <span className="text-amber-300">▸</span>
                          <span><b className="text-amber-200">Hemat:</b> Bundle 10 spin = hemat ~10% gems</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-fuchsia-300">▸</span>
                          <span><b className="text-fuchsia-200">Jackpot:</b> Bundle 125 spin paling besar peluang Mythic</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-cyan-300">▸</span>
                          <span><b className="text-cyan-200">Mystery:</b> Mystery Box buka kotak random — kadang dapat jackpot besar!</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="text-emerald-300">▸</span>
                          <span><b className="text-emerald-200">Pity:</b> Setelah 25+ spin tanpa Epic, peluang naik drastis</span>
                        </li>
                      </ul>
                    </div>
                  </>
                );
              })()}
            </TabsContent>

            <TabsContent value="stats" className="mt-3 space-y-3">
              {(() => {
                const total = history.length || 1;
                const buckets = ["mythic", "legendary", "epic", "rare", "common"] as const;
                const counts = buckets.map(b => ({
                  rarity: b,
                  count: history.filter(h => h.rarity === b).length,
                }));
                const gemsWon = history
                  .filter(h => h.reward_kind === "gems")
                  .reduce((s, h) => s + (h.reward_value || 0), 0);
                const livesWon = history
                  .filter(h => h.reward_kind === "extra_life")
                  .reduce((s, h) => s + (h.reward_value || 0), 0);
                return (
                  <>
                    <div className="rounded-2xl bg-gradient-to-br from-emerald-900/40 to-teal-900/40 border border-emerald-500/30 p-3">
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-emerald-300" />
                        <h3 className="text-xs font-black tracking-widest text-emerald-200">| RARITY BREAKDOWN</h3>
                      </div>
                      <div className="space-y-2">
                        {counts.map(({ rarity, count }) => {
                          const style = RARITY_STYLE[rarity];
                          const pct = Math.round((count / total) * 100);
                          return (
                            <div key={rarity}>
                              <div className="flex items-center justify-between text-[10px] font-bold mb-1">
                                <span className="tracking-widest">{style.label}</span>
                                <span className="tabular-nums">{count} ({pct}%)</span>
                              </div>
                              <div className="h-2 rounded-full bg-black/40 overflow-hidden">
                                <div
                                  className={`h-full bg-gradient-to-r ${style.gradient} transition-all duration-500`}
                                  style={{ width: `${Math.max(pct, count > 0 ? 4 : 0)}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-gradient-to-br from-cyan-900/50 to-blue-900/50 border border-cyan-500/40 p-3 text-center">
                        <Gem className="w-6 h-6 text-cyan-300 mx-auto mb-1" />
                        <div className="text-[10px] text-cyan-200/70 font-bold tracking-wider">TOTAL GEMS</div>
                        <div className="text-lg font-black text-cyan-100 tabular-nums">{formatCompactNumber(gemsWon)}</div>
                      </div>
                      <div className="rounded-xl bg-gradient-to-br from-rose-900/50 to-pink-900/50 border border-rose-500/40 p-3 text-center">
                        <Heart className="w-6 h-6 text-rose-300 mx-auto mb-1" fill="currentColor" />
                        <div className="text-[10px] text-rose-200/70 font-bold tracking-wider">EXTRA LIFE</div>
                        <div className="text-lg font-black text-rose-100 tabular-nums">{livesWon}</div>
                      </div>
                    </div>

                    <div className="rounded-xl bg-gradient-to-br from-amber-900/40 to-orange-900/40 border border-amber-500/30 p-3 flex items-center gap-3">
                      <Flame className="w-8 h-8 text-amber-400 shrink-0" />
                      <div>
                        <div className="text-[10px] font-black tracking-widest text-amber-200">LUCK SCORE</div>
                        <div className="text-xl font-black text-amber-100">
                          {Math.min(100, Math.round((counts[0].count * 50 + counts[1].count * 20 + counts[2].count * 8) / Math.max(total, 1)))}
                          <span className="text-xs text-amber-300/70">/100</span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </TabsContent>
            <TabsContent value="top" className="mt-3 space-y-2">
              <div className="rounded-xl bg-gradient-to-br from-fuchsia-900/40 to-purple-900/40 border border-fuchsia-500/30 p-3 mb-2">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-fuchsia-300" />
                  <h3 className="text-xs font-black tracking-widest text-fuchsia-200">| TOP HADIAH LANGKA</h3>
                </div>
                <p className="text-[10px] text-fuchsia-200/70 mt-1">Hadiah Mythic, Legendary & Epic dari spin-mu</p>
              </div>

              {(() => {
                const top = history
                  .filter(h => ["mythic", "legendary", "epic"].includes(h.rarity))
                  .slice(0, 20);
                if (top.length === 0) {
                  return (
                    <div className="rounded-xl bg-black/30 border border-purple-500/20 p-6 text-center">
                      <Trophy className="w-10 h-10 text-purple-400/50 mx-auto mb-2" />
                      <p className="text-xs text-purple-200/70 font-bold">Belum ada hadiah langka</p>
                      <p className="text-[10px] text-purple-300/50 mt-1">Spin sekarang untuk mengincar Mythic!</p>
                    </div>
                  );
                }
                return top.map((h, idx) => {
                  const style = RARITY_STYLE[h.rarity] || RARITY_STYLE.common;
                  return (
                    <div key={h.id} className={`relative flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-r ${style.gradient} ring-1 ${style.ring} shadow-md ${style.glow} overflow-hidden`}>
                      <div className="absolute top-0 left-0 w-8 h-8 rounded-br-xl bg-black/50 flex items-center justify-center text-[10px] font-black text-amber-200">
                        #{idx + 1}
                      </div>
                      <div className="w-10 h-10 text-white shrink-0 ml-6">{getKindIcon(h.reward_kind)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-black truncate text-white">{h.reward_label}</div>
                        <div className="text-[9px] text-white/70">{new Date(h.created_at).toLocaleString("id-ID")}</div>
                      </div>
                      <Badge className="bg-black/70 text-[8px] font-black tracking-widest">{style.label}</Badge>
                    </div>
                  );
                });
              })()}
            </TabsContent>
            </Tabs>
          </RoyaleSection>

          <RoyaleSection title="TOP SPINNERS" icon={<Trophy className="h-4 w-4" />}>
            <RoyaleLeaderboard loading={lbLoading} loaded={lbLoaded} topSpinners={topSpinners} topJackpots={topJackpots} onLoad={fetchLeaderboard} />
          </RoyaleSection>
        </main>
      )}

      {results && results.length > 0 && (
        <RoyaleWinOverlay
          results={results}
          revealCount={revealCount}
          revealDone={revealDone}
          onSkip={() => { setRevealCount(results.length); setRevealDone(true); }}
          onClose={() => setResults(null)}
        />
      )}

      {/* 🔥 Streak Bonus Popup */}
      {bonusPopup !== null && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] animate-fade-in pointer-events-none">
          <div className="bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 rounded-full px-5 py-2.5 shadow-2xl shadow-orange-500/60 ring-4 ring-amber-300/40 flex items-center gap-2 animate-pulse">
            <FlameIcon className="w-5 h-5 text-amber-200" fill="currentColor" />
            <div>
              <div className="text-[9px] font-black text-amber-200 tracking-widest leading-none">STREAK BONUS!</div>
              <div className="text-base font-black text-white leading-tight">+{formatCompactNumber(bonusPopup)} 💎</div>
            </div>
          </div>
        </div>
      )}

      {/* 💥 MEGA JACKPOT WIN POPUP */}
      {jackpotPopup !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center pointer-events-none animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-gradient-to-br from-purple-700 via-fuchsia-600 to-pink-600 rounded-3xl p-6 shadow-2xl shadow-fuchsia-500/80 ring-4 ring-amber-300/60 animate-pulse max-w-xs mx-4 text-center">
            <div className="text-5xl mb-2">💥🎰💥</div>
            <div className="text-[10px] font-black text-amber-200 tracking-widest mb-1">MEGA JACKPOT PECAH!</div>
            <div className="text-3xl font-black text-white drop-shadow mb-1">+{formatCompactNumber(jackpotPopup)}</div>
            <div className="flex items-center justify-center gap-1 text-amber-300 font-black">
              <Gem className="w-5 h-5" fill="currentColor" /> GEM
            </div>
            <p className="text-[10px] text-fuchsia-100/90 mt-2">Selamat, kamu pecahkan pool komunitas!</p>
          </div>
        </div>
      )}

      {/* 🎟️ EARNED TOKEN POPUP */}
      {tokenPopup !== null && (
        <div className="fixed top-32 left-1/2 -translate-x-1/2 z-[60] animate-fade-in pointer-events-none">
          <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-pink-500 rounded-full px-5 py-2.5 shadow-2xl shadow-amber-500/60 ring-4 ring-amber-200/40 flex items-center gap-2">
            <Award className="w-5 h-5 text-white" fill="currentColor" />
            <div>
              <div className="text-[9px] font-black text-white tracking-widest leading-none">LUCKY TOKEN!</div>
              <div className="text-base font-black text-white leading-tight">+{tokenPopup} 🎟️</div>
            </div>
          </div>
        </div>
      )}

      {warningOpen && (
        <RoyaleWarnDialog
          entry={warningEntry}
          dontRemind={warnDontRemind}
          onDontRemindChange={(v) => { setWarnDontRemind(v); if (v) localStorage.setItem("lr_warn_skip_until", String(Date.now() + 86400000)); else localStorage.removeItem("lr_warn_skip_until"); }}
          onCancel={() => { setWarningOpen(false); setPendingSpin(null); if (warningEntry) nav(-1); }}
          onAccept={() => {
            setWarningAck(true);
            setWarningOpen(false);
            if (warnDontRemind) localStorage.setItem("lr_warn_skip_until", String(Date.now() + 86400000));
            setWarningEntry(false);
            const p = pendingSpin;
            setPendingSpin(null);
            if (p) setTimeout(() => doSpin(p.mode, p.count, true), 50);
          }}
        />
      )}

      <Dialog open={buyGemsOpen} onOpenChange={setBuyGemsOpen}>
        <DialogContent className="max-h-[88dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto rounded-3xl border-white/10 bg-[hsl(248_30%_9%)] p-4 text-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-black tracking-[0.2em]">💎 BUY GEMS</DialogTitle>
          </DialogHeader>
          {buyGemsOpen && <GemShop visitorId={visitorId} onUpdate={() => fetchData()} />}
        </DialogContent>
      </Dialog>

      {/* 💸 MODAL PIN — Beli Akses Token Shop */}
      {shopPinOpen && (() => {
        const access = shopPinTier === "ultra" ? ultraShopAccess : shopPinTier === "super_premium" ? superShopAccess : shopAccess;
        const tierLabel = shopPinTier === "ultra" ? "Ultra" : shopPinTier === "super_premium" ? "Super Premium" : "Premium";
        const key = shopPinTier === "ultra" ? "__ultra_shop_access__" : shopPinTier === "super_premium" ? "__super_shop_access__" : "__shop_access__";
        return (
          <div className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="relative w-full max-w-sm rounded-2xl overflow-hidden border-2 border-fuchsia-400/60 shadow-2xl shadow-fuchsia-500/40 animate-scale-in bg-gradient-to-br from-fuchsia-950 via-slate-900 to-purple-950">
              <div className="p-5 text-white">
                <div className="text-center mb-3">
                  <div className="text-3xl mb-1">🎟️</div>
                  <h3 className="text-lg font-black tracking-tight text-fuchsia-200">Beli Akses {tierLabel}</h3>
                  <p className="text-[11px] text-slate-300 mt-1">Token Shop Luck Royale · berlaku <b className="text-white">{access.durationDays} hari</b></p>
                  <p className="text-[18px] font-black text-amber-300 mt-1">Rp {access.price.toLocaleString("id-ID")}</p>
                </div>

                <label className="block text-[11px] font-bold text-slate-300 mb-1.5">Masukkan PIN 6 digit</label>
                <input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={shopPin}
                  onChange={(e) => setShopPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••••"
                  className="w-full text-center text-2xl tracking-[0.5em] font-black bg-black/40 border border-fuchsia-500/40 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-fuchsia-300"
                  autoFocus
                />

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button
                    disabled={redeeming === key}
                    onClick={() => { setShopPinOpen(false); setShopPin(""); }}
                    className="rounded-xl bg-slate-700/80 hover:bg-slate-600 active:scale-95 transition px-3 py-2.5 font-black text-xs tracking-wider text-white border border-white/10 disabled:opacity-50"
                  >
                    BATAL
                  </button>
                  <button
                    disabled={redeeming === key || shopPin.length !== 6}
                    onClick={confirmBuyShopAccess}
                    className="rounded-xl bg-gradient-to-br from-fuchsia-500 via-purple-600 to-pink-600 hover:brightness-110 active:scale-95 transition px-3 py-2.5 font-black text-xs tracking-wider text-white shadow-lg shadow-fuchsia-500/50 ring-1 ring-fuchsia-300/50 disabled:opacity-50"
                  >
                    {redeeming === key ? "MEMPROSES..." : "BAYAR"}
                  </button>
                </div>
                <p className="text-center text-[9px] text-fuchsia-200/70 mt-2 font-semibold tracking-wider">
                  Saldo dipotong otomatis setelah PIN benar.
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 💸 MODAL PIN — Beli Jam Hoki */}
      {lhPinOpen && lhSelectedPkg && (
        <div className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="relative w-full max-w-sm rounded-2xl overflow-hidden border-2 border-emerald-400/60 shadow-2xl shadow-emerald-500/40 animate-scale-in bg-gradient-to-br from-emerald-950 via-slate-900 to-emerald-950">
            <div className="p-5 text-white">
              <div className="text-center mb-3">
                <div className="text-3xl mb-1">🍀</div>
                <h3 className="text-lg font-black tracking-tight text-emerald-200">Beli Jam Hoki</h3>
                <p className="text-[11px] text-slate-300 mt-1">
                  Paket <b className="text-white">{lhSelectedPkg.label}</b>
                </p>
                <p className="text-[18px] font-black text-amber-300 mt-1">
                  Rp {lhSelectedPkg.effectivePrice.toLocaleString("id-ID")}
                </p>
                {lhSelectedPkg.usingFirstDiscount && (
                  <p className="text-[10px] text-amber-200 mt-0.5">
                    🎉 Diskon pembelian pertama (sekali seumur hidup)
                  </p>
                )}
              </div>

              <label className="block text-[11px] font-bold text-slate-300 mb-1.5">Masukkan PIN 6 digit</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={lhPin}
                onChange={(e) => setLhPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                className="w-full text-center text-2xl tracking-[0.5em] font-black bg-black/40 border border-emerald-500/40 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-emerald-300"
                autoFocus
              />

              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  disabled={!!buyingLh}
                  onClick={() => { setLhPinOpen(false); setLhSelectedPkg(null); setLhPin(""); }}
                  className="rounded-xl bg-slate-700/80 hover:bg-slate-600 active:scale-95 transition px-3 py-2.5 font-black text-xs tracking-wider text-white border border-white/10 disabled:opacity-50"
                >
                  BATAL
                </button>
                <button
                  disabled={!!buyingLh || lhPin.length !== 6}
                  onClick={async () => {
                    if (!visitorId || !lhSelectedPkg) return;
                    setBuyingLh(lhSelectedPkg.code);
                    try {
                      const { data, error } = await invokeRoyale({
                        body: { visitorId, action: "buy_lucky_hour", itemCode: lhSelectedPkg.code, pin: lhPin },
                      });
                      if (error) throw error;
                      if (data?.error) {
                        toast({ title: "Gagal beli", description: data.error, variant: "destructive" });
                        if (!data.needPin) { setLhPinOpen(false); setLhSelectedPkg(null); }
                        setLhPin("");
                        return;
                      }
                      toast({
                        title: "🍀 Jam Hoki Aktif!",
                        description: `Aktif sampai ${new Date(data.boostedUntil).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB`,
                      });
                      setLhPinOpen(false);
                      setLhSelectedPkg(null);
                      setLhPin("");
                      fetchData();
                    } catch (e: any) {
                      toast({ title: "Error", description: e.message || "Gagal", variant: "destructive" });
                    } finally {
                      setBuyingLh(null);
                    }
                  }}
                  className="rounded-xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 hover:brightness-110 active:scale-95 transition px-3 py-2.5 font-black text-xs tracking-wider text-white shadow-lg shadow-emerald-500/50 ring-1 ring-emerald-300/50 disabled:opacity-50"
                >
                  {buyingLh ? "MEMPROSES..." : "BAYAR"}
                </button>
              </div>
              <p className="text-center text-[9px] text-emerald-200/70 mt-2 font-semibold tracking-wider">
                Saldo dipotong otomatis. Durasi akumulatif dengan boost yang masih aktif.
              </p>
            </div>
          </div>
        </div>
      )}

      {npPinOpen && (
        <div className="fixed inset-0 z-[90] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="relative w-full max-w-sm rounded-2xl overflow-hidden border-2 border-amber-400/60 shadow-2xl shadow-amber-500/40 animate-scale-in bg-gradient-to-br from-rose-950 via-slate-900 to-amber-950">
            <div className="p-5 text-white">
              <div className="text-center mb-3">
                <div className="text-3xl mb-1">👑</div>
                <h3 className="text-lg font-black tracking-tight text-amber-200">Beli Nyawa Premium</h3>
                <p className="text-[11px] text-slate-300 mt-1">Pool hadiah <b className="text-white">MANTAP JIWA</b> + akses <b className="text-fuchsia-200">Premium Spin</b> selama <b className="text-amber-200">30 hari</b></p>
                <p className="text-[18px] font-black text-amber-300 mt-1">Rp 50.000</p>
                <p className="text-[10px] text-amber-100/80 mt-1">Banyak Epic+, peluang Mythic 5×, akses paket Premium Spin (1 - 1.000 spin) + Mega Jackpot.</p>
              </div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1.5">Masukkan PIN 6 digit</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={npPin}
                onChange={(e) => setNpPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                className="w-full text-center text-2xl tracking-[0.5em] font-black bg-black/40 border border-amber-500/40 rounded-xl px-3 py-3 text-white focus:outline-none focus:border-amber-300"
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  disabled={npBuying}
                  onClick={() => { setNpPinOpen(false); setNpPin(""); }}
                  className="rounded-xl bg-slate-700/80 hover:bg-slate-600 active:scale-95 transition px-3 py-2.5 font-black text-xs tracking-wider text-white border border-white/10 disabled:opacity-50"
                >
                  BATAL
                </button>
                <button
                  disabled={npBuying || npPin.length !== 6}
                  onClick={buyNyawaPremium}
                  className="rounded-xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 hover:brightness-110 active:scale-95 transition px-3 py-2.5 font-black text-xs tracking-wider text-white shadow-lg shadow-amber-500/50 ring-1 ring-amber-300/50 disabled:opacity-50"
                >
                  {npBuying ? "MEMPROSES..." : "BAYAR"}
                </button>
              </div>
              <p className="text-center text-[9px] text-amber-200/70 mt-2 font-semibold tracking-wider">
                Saldo dipotong otomatis. Durasi akumulatif jika masih aktif.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}
