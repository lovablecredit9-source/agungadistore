import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { getVisitorId } from "@/lib/visitor-id";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, Key, CalendarDays, HardDrive, Loader2, Lock, Infinity, Layers3, Package, Sparkles, Zap, Crown, Gift, Star, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGameCredits, GameCreditsBadge } from "@/components/games/GameCredits";
import { useGameBalance, GameBalanceBadge, triggerGameBalanceRefresh } from "@/components/games/GameBalance";
import { motion } from "framer-motion";
import { BanBanner, BanLock } from "@/components/BanBanner";


function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price);
}

interface UserBalance { id: string; visitor_id: string; username: string; phone: string; balance: number; }
interface CreditPackage { id: string; credits: number; price: number; label: string; is_unlimited?: boolean; unlimited_days?: number; originalPrice?: number; }
interface StreakPackage { id: string; name: string; days: number; price: number; is_active: boolean; sort_order: number; originalPrice?: number; }
interface StoragePackage { id: string; name: string; storage_mb: number; price: number; is_active: boolean; sort_order: number; }
interface BundlePackage { id: string; name: string; credits: number; streak_days: number; storage_mb: number; price: number; }

export default function PlusTab() {
  const visitorId = getVisitorId();
  const { toast } = useToast();
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const [loading, setLoading] = useState(true);

  const { credits, isUnlimited, unlimitedUntil, fetchCredits } = useGameCredits(
    localStorage.getItem("balance_visitor_id") || visitorId
  );
  const { amount: gameBalance } = useGameBalance(localStorage.getItem("balance_visitor_id") || visitorId);
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [creditBuying, setCreditBuying] = useState<string | null>(null);
  const [creditPin, setCreditPin] = useState("");
  const [creditNeedPin, setCreditNeedPin] = useState(false);
  const [creditSelectedPkg, setCreditSelectedPkg] = useState<string | null>(null);

  const [streakPackages, setStreakPackages] = useState<StreakPackage[]>([]);
  const [streakBuying, setStreakBuying] = useState<string | null>(null);
  const [streakPin, setStreakPin] = useState("");
  const [streakNeedPin, setStreakNeedPin] = useState(false);
  const [streakSelectedPkg, setStreakSelectedPkg] = useState<string | null>(null);

  const [storagePackages, setStoragePackages] = useState<StoragePackage[]>([]);
  const [storageBuying, setStorageBuying] = useState<string | null>(null);
  const [storagePin, setStoragePin] = useState("");
  const [storageNeedPin, setStorageNeedPin] = useState(false);
  const [storageSelectedPkg, setStorageSelectedPkg] = useState<string | null>(null);

  const [bundlePackages, setBundlePackages] = useState<BundlePackage[]>([]);
  const [bundleBuying, setBundleBuying] = useState<string | null>(null);
  const [bundlePin, setBundlePin] = useState("");
  const [bundleNeedPin, setBundleNeedPin] = useState(false);
  const [bundleSelectedPkg, setBundleSelectedPkg] = useState<string | null>(null);

  const [creditVoucher, setCreditVoucher] = useState("");
  const [creditVoucherValid, setCreditVoucherValid] = useState(false);

  const [flashSaleEnd, setFlashSaleEnd] = useState("");
  const [creditDiscount, setCreditDiscount] = useState(0);
  const [streakDiscount, setStreakDiscount] = useState(0);
  const [paymentSource, setPaymentSource] = useState<"auto" | "game" | "main">("auto");

  const fetchBalance = useCallback(async () => {
    setLoading(true);
    const balVid = localStorage.getItem("balance_visitor_id");
    if (!balVid) { setLoading(false); return; }
    const { data } = await supabase.from("user_balances_public" as any).select("*").eq("visitor_id", balVid).maybeSingle();
    if (data) setUserBalance(data as unknown as UserBalance);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchBalance();

    (async () => {
      const { data: settingsData } = await supabase.from("admin_settings").select("*");
      const settings: Record<string, string> = {};
      if (settingsData) (settingsData as any[]).forEach((s: any) => { settings[s.setting_key] = s.setting_value; });
      const fsEnd = settings.flash_sale_end || "";
      setFlashSaleEnd(fsEnd);
      const isFlashActive = !!fsEnd && new Date(fsEnd) > new Date();
      const cDisc = parseInt(settings.promo_credit_discount || "0");
      const sDisc = parseInt(settings.promo_streak_discount || "0");
      setCreditDiscount(isFlashActive ? cDisc : 0);
      setStreakDiscount(isFlashActive ? sDisc : 0);

      // Credits
      const { data: creditData } = await supabase.functions.invoke("purchase-game-credits", { body: { action: "get_packages" } });
      if (creditData?.packages) {
        const pkgs = (creditData.packages as CreditPackage[]).map(pkg => {
          if (isFlashActive && cDisc > 0) {
            return { ...pkg, originalPrice: pkg.price, price: Math.max(0, Math.round(pkg.price * (1 - cDisc / 100))) };
          }
          return pkg;
        });
        setCreditPackages(pkgs);
      }

      // Streak
      const { data: streakData } = await supabase.from("streak_packages").select("*").eq("is_active", true).order("sort_order");
      if (streakData) {
        const pkgs = (streakData as StreakPackage[]).map(pkg => {
          if (isFlashActive && sDisc > 0) {
            return { ...pkg, originalPrice: pkg.price, price: Math.max(0, Math.round(pkg.price * (1 - sDisc / 100))) };
          }
          return pkg;
        });
        setStreakPackages(pkgs);
      }
    })();

    // Storage
    supabase.from("storage_packages").select("*").eq("is_active", true).order("sort_order").then(({ data }) => {
      if (data) setStoragePackages(data as StoragePackage[]);
    });

    // Bundles
    supabase.functions.invoke("purchase-bundle", { body: { action: "get_packages" } }).then(({ data }) => {
      if (data?.packages) setBundlePackages(data.packages);
    });
  }, []);

  const handleBuyCredit = async (pkgId: string, pin?: string) => {
    const balVid = localStorage.getItem("balance_visitor_id");
    if (!balVid) { toast({ title: "Login dulu ke akun saldo", variant: "destructive" }); return; }
    setCreditBuying(pkgId);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-game-credits", {
        body: { action: "purchase", visitorId: balVid, packageId: pkgId, pin: pin || undefined, voucherCode: creditVoucherValid ? creditVoucher.trim() : undefined, paymentSource },
      });
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const errBody = await error.context.json();
          if (errBody?.needPin) { setCreditNeedPin(true); setCreditSelectedPkg(pkgId); setCreditBuying(null); return; }
          toast({ title: "Gagal", description: errBody?.error || "Terjadi kesalahan", variant: "destructive" }); setCreditBuying(null); return;
        }
        throw error;
      }
      if (data?.needPin) { setCreditNeedPin(true); setCreditSelectedPkg(pkgId); setCreditBuying(null); return; }
      if (data?.error) { toast({ title: "Gagal", description: data.error, variant: "destructive" }); setCreditBuying(null); return; }
      toast({ title: "Berhasil!", description: `${data.package.label} berhasil dibeli. Sisa saldo: ${formatPrice(data.balance_remaining)}` });
      setCreditNeedPin(false); setCreditPin(""); setCreditSelectedPkg(null);
      fetchCredits(); fetchBalance(); triggerGameBalanceRefresh();
    } catch (e: any) { toast({ title: "Error", description: e?.message || "Terjadi kesalahan", variant: "destructive" }); }
    finally { setCreditBuying(null); }
  };

  const handleBuyStreak = async (pkgId: string, pin?: string) => {
    const balVid = localStorage.getItem("balance_visitor_id");
    if (!balVid) { toast({ title: "Login dulu ke akun saldo", variant: "destructive" }); return; }
    setStreakBuying(pkgId);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-streak-plan", {
        body: { visitorId: balVid, packageId: pkgId, pin: pin || undefined, paymentSource },
      });
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const errBody = await error.context.json();
          if (errBody?.needPin) { setStreakNeedPin(true); setStreakSelectedPkg(pkgId); setStreakBuying(null); return; }
          toast({ title: "Gagal", description: errBody?.error || "Terjadi kesalahan", variant: "destructive" }); setStreakBuying(null); return;
        }
        throw error;
      }
      if (data?.needPin) { setStreakNeedPin(true); setStreakSelectedPkg(pkgId); setStreakBuying(null); return; }
      if (data?.error) { toast({ title: "Gagal", description: data.error, variant: "destructive" }); setStreakBuying(null); return; }
      toast({ title: "Berhasil!", description: `Paket streak berhasil dibeli. Sisa saldo: ${formatPrice(data.balance_remaining)}` });
      setStreakNeedPin(false); setStreakPin(""); setStreakSelectedPkg(null);
      fetchBalance(); triggerGameBalanceRefresh();
    } catch (e: any) { toast({ title: "Error", description: e?.message || "Terjadi kesalahan", variant: "destructive" }); }
    finally { setStreakBuying(null); }
  };

  const handleBuyStorage = async (pkgId: string, pin?: string) => {
    const balVid = localStorage.getItem("balance_visitor_id");
    if (!balVid) { toast({ title: "Login dulu ke akun saldo", variant: "destructive" }); return; }
    setStorageBuying(pkgId);
    try {
      const { data, error } = await supabase.functions.invoke("upgrade-storage", {
        body: { visitorId: balVid, packageId: pkgId, pin: pin || undefined, paymentSource },
      });
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const errBody = await error.context.json();
          if (errBody?.needPin) { setStorageNeedPin(true); setStorageSelectedPkg(pkgId); setStorageBuying(null); return; }
          toast({ title: "Gagal", description: errBody?.error || "Terjadi kesalahan", variant: "destructive" }); setStorageBuying(null); return;
        }
        throw error;
      }
      if (data?.needPin) { setStorageNeedPin(true); setStorageSelectedPkg(pkgId); setStorageBuying(null); return; }
      if (data?.error) { toast({ title: "Gagal", description: data.error, variant: "destructive" }); setStorageBuying(null); return; }
      toast({ title: "Berhasil!", description: `Storage berhasil ditambah. Sisa saldo: ${formatPrice(data.balance_remaining)}` });
      setStorageNeedPin(false); setStoragePin(""); setStorageSelectedPkg(null);
      fetchBalance(); triggerGameBalanceRefresh();
    } catch (e: any) { toast({ title: "Error", description: e?.message || "Terjadi kesalahan", variant: "destructive" }); }
    finally { setStorageBuying(null); }
  };

  const handleBuyBundle = async (pkgId: string, pin?: string) => {
    const balVid = localStorage.getItem("balance_visitor_id");
    if (!balVid) { toast({ title: "Login dulu ke akun saldo", variant: "destructive" }); return; }
    setBundleBuying(pkgId);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-bundle", {
        body: { visitorId: balVid, packageId: pkgId, pin: pin || undefined, paymentSource },
      });
      if (error) {
        if (error instanceof FunctionsHttpError) {
          const errBody = await error.context.json();
          if (errBody?.needPin) { setBundleNeedPin(true); setBundleSelectedPkg(pkgId); setBundleBuying(null); return; }
          toast({ title: "Gagal", description: errBody?.error || "Terjadi kesalahan", variant: "destructive" }); setBundleBuying(null); return;
        }
        throw error;
      }
      if (data?.needPin) { setBundleNeedPin(true); setBundleSelectedPkg(pkgId); setBundleBuying(null); return; }
      if (data?.error) { toast({ title: "Gagal", description: data.error, variant: "destructive" }); setBundleBuying(null); return; }
      toast({ title: "Berhasil!", description: `${data.bundle_name} berhasil dibeli. Sisa saldo: ${formatPrice(data.balance_remaining)}` });
      setBundleNeedPin(false); setBundlePin(""); setBundleSelectedPkg(null);
      fetchCredits(); fetchBalance(); triggerGameBalanceRefresh();
    } catch (e: any) { toast({ title: "Error", description: e?.message || "Terjadi kesalahan", variant: "destructive" }); }
    finally { setBundleBuying(null); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5 relative">
      <BanBanner />

      {/* === MAXIMALIST HERO === */}
      <div className="relative overflow-hidden rounded-3xl p-[2px] update-aurora-bg animate-neon-border">
        <div className="relative rounded-3xl bg-background/85 backdrop-blur-xl p-5 overflow-hidden">
          {/* Floating background blobs */}
          <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-pink-500/30 blur-3xl animate-blob" />
          <div className="absolute -bottom-10 -right-10 w-32 h-32 rounded-full bg-cyan-500/30 blur-3xl animate-blob" style={{ animationDelay: "2s" }} />
          <div className="absolute top-1/2 left-1/2 w-24 h-24 rounded-full bg-amber-400/20 blur-3xl animate-blob" style={{ animationDelay: "4s" }} />

          {/* Floating emojis */}
          <div className="absolute top-2 right-4 text-2xl animate-sticker">✨</div>
          <div className="absolute bottom-3 left-3 text-xl animate-sticker" style={{ animationDelay: "1s" }}>💎</div>
          <div className="absolute top-1/2 right-10 text-lg animate-sticker" style={{ animationDelay: "1.5s" }}>🚀</div>

          <div className="relative flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 via-violet-500 to-cyan-500 flex items-center justify-center shadow-[0_0_25px_rgba(168,85,247,0.6)] animate-tilt">
                <Layers3 className="w-6 h-6 text-white" strokeWidth={2} />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-400 animate-ping" />
            </div>
            <div>
              <h2 className="text-2xl font-black bg-gradient-to-r from-pink-500 via-violet-500 to-cyan-500 bg-clip-text text-transparent animate-rainbow-text tracking-tight">
                Plus Hub
              </h2>
              <p className="text-[11px] text-muted-foreground font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" /> Pusat upgrade premium
              </p>
            </div>
          </div>

          {userBalance ? (
            <div className="relative rounded-2xl bg-gradient-to-br from-violet-600/20 via-pink-500/20 to-amber-400/20 border border-white/20 p-4 overflow-hidden">
              <div className="absolute inset-0 animate-shimmer-bar pointer-events-none" />
              <div className="relative flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1">
                    <Crown className="w-3 h-3 text-amber-400" /> Hai, {userBalance.username}
                  </p>
                  <p className="text-3xl font-black tabular-nums bg-gradient-to-r from-emerald-400 via-cyan-400 to-violet-500 bg-clip-text text-transparent animate-count-glow">
                    {formatPrice(userBalance.balance)}
                  </p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.5)] quick-action-float">
                  <Wallet className="w-7 h-7 text-white" strokeWidth={2} />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-gradient-to-r from-pink-500/15 to-violet-500/15 border border-pink-500/30 p-4 text-center">
              <p className="text-sm font-semibold text-foreground">🔐 Login ke tab <strong className="text-pink-500">Saldo</strong> untuk mulai</p>
            </div>
          )}
        </div>
      </div>

      <BanLock fallbackLabel="Plus / Streak Shop">

      {/* === BADGES === */}
      <div className="flex items-center gap-2 flex-wrap animate-pop-in">
        <GameCreditsBadge credits={credits} isUnlimited={isUnlimited} unlimitedUntil={unlimitedUntil} />
        <GameBalanceBadge amount={gameBalance} />
      </div>

      {/* === REFERRAL === */}
      <ReferralCard activeVisitorId={userBalance?.visitor_id || localStorage.getItem("balance_visitor_id")} />


      <div className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-pink-500/10 to-violet-500/10 border border-amber-500/30 p-3">
        <p className="text-[11px] text-foreground font-medium leading-relaxed flex items-start gap-2">
          <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 animate-sticker" />
          <span><strong className="text-amber-500">Saldo IN</strong> dipakai untuk Game, Streak, dan Storage — bukan pembelian produk.</span>
        </p>
      </div>

      {/* SUMBER PEMBAYARAN */}
      <div className="rounded-2xl bg-card border-2 border-border p-3 space-y-2">
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Wallet className="w-3 h-3" /> Sumber Pembayaran
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => setPaymentSource("auto")}
            className={`text-[11px] font-bold rounded-lg py-2 px-1 border-2 transition ${paymentSource === "auto" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}
          >
            Otomatis
          </button>
          <button
            type="button"
            onClick={() => setPaymentSource("game")}
            className={`text-[11px] font-bold rounded-lg py-2 px-1 border-2 transition ${paymentSource === "game" ? "bg-emerald-600 text-white border-emerald-600" : "bg-card border-border text-muted-foreground"}`}
          >
            Saldo IN
          </button>
          <button
            type="button"
            onClick={() => setPaymentSource("main")}
            className={`text-[11px] font-bold rounded-lg py-2 px-1 border-2 transition ${paymentSource === "main" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}
          >
            Saldo Utama
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          {paymentSource === "auto" ? "Pakai Saldo IN dulu jika cukup, jika tidak baru Saldo Utama (atau gabungan)." : paymentSource === "game" ? `Pakai Saldo IN saja (Rp ${gameBalance.toLocaleString("id-ID")}).` : `Pakai Saldo Utama saja (${formatPrice(userBalance?.balance || 0)}).`}
        </p>
      </div>

      {/* === FLASH SALE BANNER === */}
      {flashSaleEnd && new Date(flashSaleEnd) > new Date() && (
        <div className="relative overflow-hidden rounded-2xl p-[2px] update-aurora-bg animate-neon-border">
          <div className="relative rounded-2xl bg-background/90 backdrop-blur p-3 text-center overflow-hidden">
            <div className="absolute inset-0 animate-shimmer-bar pointer-events-none" />
            <p className="relative text-sm font-black bg-gradient-to-r from-pink-500 via-amber-400 to-rose-500 bg-clip-text text-transparent flex items-center justify-center gap-2">
              <span className="text-lg animate-sticker">🔥</span>
              FLASH SALE sampai {new Date(flashSaleEnd).toLocaleString("id-ID")}
              <span className="text-lg animate-sticker">⚡</span>
            </p>
          </div>
        </div>
      )}

      {/* PAKET BUNDEL */}
      {bundlePackages.length > 0 && (
        <SectionCard
          title="Paket Bundel"
          icon={<Package className="w-5 h-5 text-white" strokeWidth={2.2} />}
          description="Hemat lebih banyak dengan paket kombo"
          gradient="from-pink-500 via-rose-500 to-amber-500"
          glowColor="236,72,153"
          emoji="🎁"
          needPin={bundleNeedPin}
          pin={bundlePin}
          setPin={setBundlePin}
          buying={bundleBuying}
          selectedPkg={bundleSelectedPkg}
          onConfirmPin={() => handleBuyBundle(bundleSelectedPkg!, bundlePin)}
          onCancelPin={() => { setBundleNeedPin(false); setBundlePin(""); setBundleSelectedPkg(null); }}
        >
          {bundlePackages.map((pkg, i) => {
            const parts: string[] = [];
            if (pkg.credits > 0) parts.push(`${pkg.credits} Kredit`);
            if (pkg.streak_days > 0) parts.push(`${pkg.streak_days} Hari Streak`);
            if (pkg.storage_mb > 0) parts.push(`${(pkg.storage_mb / 1024).toFixed(0)} GB Storage (30 hari)`);
            return (
              <PackageButton
                key={pkg.id}
                index={i}
                label={parts.join(" + ")}
                price={pkg.price}
                buying={bundleBuying === pkg.id}
                anyBuying={!!bundleBuying}
                icon={<Gift className="w-4 h-4 text-white" strokeWidth={2.2} />}
                accentGradient="from-pink-500 to-amber-500"
                onClick={() => handleBuyBundle(pkg.id)}
              />
            );
          })}
        </SectionCard>
      )}

      {/* KREDIT GAME */}
      <SectionCard
        title="Kredit Game"
        icon={<Key className="w-5 h-5 text-white" strokeWidth={2.2} />}
        description="1 kredit = 1x lihat kunci jawaban"
        gradient="from-cyan-500 via-blue-500 to-violet-500"
        glowColor="34,211,238"
        emoji="🔑"
        needPin={creditNeedPin}
        pin={creditPin}
        setPin={setCreditPin}
        buying={creditBuying}
        selectedPkg={creditSelectedPkg}
        onConfirmPin={() => handleBuyCredit(creditSelectedPkg!, creditPin)}
        onCancelPin={() => { setCreditNeedPin(false); setCreditPin(""); setCreditSelectedPkg(null); }}
      >
        {creditPackages.map((pkg, i) => (
          <PackageButton
            key={pkg.id}
            index={i}
            label={pkg.label}
            price={pkg.price}
            originalPrice={pkg.originalPrice}
            buying={creditBuying === pkg.id}
            anyBuying={!!creditBuying}
            icon={pkg.is_unlimited ? <Infinity className="w-4 h-4 text-white" strokeWidth={2.2} /> : <Key className="w-4 h-4 text-white" strokeWidth={2.2} />}
            accentGradient={pkg.is_unlimited ? "from-amber-400 to-rose-500" : "from-cyan-500 to-violet-500"}
            featured={pkg.is_unlimited}
            onClick={() => handleBuyCredit(pkg.id)}
          />
        ))}
      </SectionCard>

      {/* STREAK */}
      <SectionCard
        title="Paket Streak"
        icon={<CalendarDays className="w-5 h-5 text-white" strokeWidth={2.2} />}
        description="Auto-klaim streak harian"
        gradient="from-emerald-500 via-teal-500 to-cyan-500"
        glowColor="16,185,129"
        emoji="🔥"
        needPin={streakNeedPin}
        pin={streakPin}
        setPin={setStreakPin}
        buying={streakBuying}
        selectedPkg={streakSelectedPkg}
        onConfirmPin={() => handleBuyStreak(streakSelectedPkg!, streakPin)}
        onCancelPin={() => { setStreakNeedPin(false); setStreakPin(""); setStreakSelectedPkg(null); }}
      >
        {streakPackages.map((pkg, i) => (
          <PackageButton
            key={pkg.id}
            index={i}
            label={`${pkg.name} (${pkg.days} hari)`}
            price={pkg.price}
            originalPrice={pkg.originalPrice}
            buying={streakBuying === pkg.id}
            anyBuying={!!streakBuying}
            icon={<CalendarDays className="w-4 h-4 text-white" strokeWidth={2.2} />}
            accentGradient="from-emerald-500 to-cyan-500"
            onClick={() => handleBuyStreak(pkg.id)}
          />
        ))}
      </SectionCard>

      {/* STORAGE */}
      <SectionCard
        title="Paket Storage Musik"
        icon={<HardDrive className="w-5 h-5 text-white" strokeWidth={2.2} />}
        description="Tambah ruang penyimpanan musik"
        gradient="from-violet-500 via-purple-500 to-fuchsia-500"
        glowColor="168,85,247"
        emoji="💾"
        needPin={storageNeedPin}
        pin={storagePin}
        setPin={setStoragePin}
        buying={storageBuying}
        selectedPkg={storageSelectedPkg}
        onConfirmPin={() => handleBuyStorage(storageSelectedPkg!, storagePin)}
        onCancelPin={() => { setStorageNeedPin(false); setStoragePin(""); setStorageSelectedPkg(null); }}
      >
        {storagePackages.map((pkg, i) => (
          <PackageButton
            key={pkg.id}
            index={i}
            label={`${pkg.name} (${pkg.storage_mb >= 1024 ? `${(pkg.storage_mb/1024).toFixed(0)} GB` : `${pkg.storage_mb} MB`} • 30 hari)`}
            price={pkg.price}
            buying={storageBuying === pkg.id}
            anyBuying={!!storageBuying}
            icon={<HardDrive className="w-4 h-4 text-white" strokeWidth={2.2} />}
            accentGradient="from-violet-500 to-fuchsia-500"
            onClick={() => handleBuyStorage(pkg.id)}
          />
        ))}
      </SectionCard>

      
      </BanLock>
    </div>
  );
}

function SectionCard({ title, icon, description, children, gradient = "from-primary to-primary", glowColor = "168,85,247", emoji = "✨", needPin, pin, setPin, buying, selectedPkg, onConfirmPin, onCancelPin }: {
  title: string; icon: React.ReactNode; description: string; children: React.ReactNode;
  gradient?: string; glowColor?: string; emoji?: string;
  needPin: boolean; pin: string; setPin: (v: string) => void; buying: string | null; selectedPkg: string | null;
  onConfirmPin: () => void; onCancelPin: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="relative group"
    >
      {/* Glow halo */}
      <div
        className="absolute -inset-0.5 rounded-3xl opacity-50 blur-xl group-hover:opacity-90 transition-opacity duration-500"
        style={{ background: `linear-gradient(135deg, rgba(${glowColor},0.4), rgba(${glowColor},0.1))` }}
      />
      <Card className={`relative overflow-hidden border-2 border-white/10 bg-gradient-to-br from-card via-card to-card/80 backdrop-blur shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-3xl`}>
        {/* Decorative corner blob */}
        <div
          className={`absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br ${gradient} opacity-20 blur-2xl animate-blob`}
        />
        <div className="absolute top-2 right-3 text-2xl opacity-70 animate-sticker pointer-events-none">{emoji}</div>

        <CardContent className="relative p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} shadow-[0_4px_20px_rgba(0,0,0,0.2)] quick-action-float`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className={`font-black text-base bg-gradient-to-r ${gradient} bg-clip-text text-transparent tracking-tight`}>
                {title}
              </h3>
              <p className="text-[11px] text-muted-foreground font-medium">{description}</p>
            </div>
          </div>

          {needPin && selectedPkg ? (
            <div className="space-y-2 rounded-2xl bg-gradient-to-br from-amber-500/10 to-rose-500/10 border border-amber-500/30 p-3">
              <p className="text-sm font-black flex items-center gap-1 text-amber-500">
                <Lock className="w-4 h-4" /> Masukkan PIN
              </p>
              <Input
                type="password"
                maxLength={6}
                placeholder="PIN 6 digit"
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
                className="rounded-xl border-2 border-amber-500/30 focus-visible:ring-amber-500 text-center font-mono text-lg tracking-[0.5em]"
              />
              <Button
                className={`w-full rounded-xl bg-gradient-to-r ${gradient} text-white font-bold shadow-lg`}
                disabled={pin.length !== 6 || !!buying}
                onClick={onConfirmPin}
              >
                {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Konfirmasi"}
              </Button>
              <Button variant="ghost" className="w-full text-xs" onClick={onCancelPin}>Batal</Button>
            </div>
          ) : (
            <div className="grid gap-2">{children}</div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function PackageButton({ label, price, originalPrice, buying, anyBuying, icon, onClick, accentGradient = "from-violet-500 to-cyan-500", featured = false, index = 0 }: {
  label: string; price: number; originalPrice?: number; buying: boolean; anyBuying: boolean; icon: React.ReactNode; onClick: () => void;
  accentGradient?: string; featured?: boolean; index?: number;
}) {
  const hasPromo = originalPrice && originalPrice !== price;
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.3 }}
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.02, y: -2 }}
      className="relative group/btn"
    >
      {featured && (
        <div className="absolute -top-2 -right-2 z-10 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-rose-500 text-[9px] font-black text-white shadow-lg animate-sticker flex items-center gap-0.5">
          <Star className="w-2.5 h-2.5 fill-white" /> HOT
        </div>
      )}
      <button
        type="button"
        disabled={anyBuying}
        onClick={onClick}
        className={`relative w-full flex items-center justify-between gap-3 rounded-2xl p-3 overflow-hidden border-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed
          ${featured
            ? "border-amber-400/50 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-pink-500/10 shadow-[0_4px_20px_rgba(251,191,36,0.25)]"
            : "border-white/10 bg-gradient-to-r from-background via-card to-background hover:border-white/30"}
        `}
      >
        {/* Shimmer overlay on hover */}
        <div className="absolute inset-0 opacity-0 group-hover/btn:opacity-100 transition-opacity">
          <div className="absolute inset-0 animate-shimmer-bar" />
        </div>

        <div className="relative flex items-center gap-3 min-w-0 flex-1">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${accentGradient} shadow-[0_3px_12px_rgba(0,0,0,0.2)] quick-action-bounce`}>
            {icon}
          </div>
          <span className="font-bold text-sm text-left text-foreground truncate">{label}</span>
        </div>

        <div className="relative flex items-center gap-2 shrink-0">
          {hasPromo ? (
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground line-through block">{formatPrice(originalPrice!)}</span>
              <span className={`text-sm font-black bg-gradient-to-r ${accentGradient} bg-clip-text text-transparent`}>
                {formatPrice(price)}
              </span>
            </div>
          ) : (
            <span className={`text-sm font-black bg-gradient-to-r ${accentGradient} bg-clip-text text-transparent`}>
              {formatPrice(price)}
            </span>
          )}
          {buying && <Loader2 className="w-4 h-4 animate-spin text-foreground" />}
        </div>
      </button>
    </motion.div>
  );
}
