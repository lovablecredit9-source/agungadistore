import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { getVisitorId } from "@/lib/visitor-id";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, Key, CalendarDays, HardDrive, Loader2, Lock, Infinity, Sparkles, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGameCredits, GameCreditsBadge } from "@/components/games/GameCredits";
import { useGameBalance, GameBalanceBadge } from "@/components/games/GameBalance";
import { motion } from "framer-motion";

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
        body: { action: "purchase", visitorId: balVid, packageId: pkgId, pin: pin || undefined, voucherCode: creditVoucherValid ? creditVoucher.trim() : undefined },
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
      fetchCredits(); fetchBalance();
    } catch (e: any) { toast({ title: "Error", description: e?.message || "Terjadi kesalahan", variant: "destructive" }); }
    finally { setCreditBuying(null); }
  };

  const handleBuyStreak = async (pkgId: string, pin?: string) => {
    const balVid = localStorage.getItem("balance_visitor_id");
    if (!balVid) { toast({ title: "Login dulu ke akun saldo", variant: "destructive" }); return; }
    setStreakBuying(pkgId);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-streak-plan", {
        body: { visitorId: balVid, packageId: pkgId, pin: pin || undefined },
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
      fetchBalance();
    } catch (e: any) { toast({ title: "Error", description: e?.message || "Terjadi kesalahan", variant: "destructive" }); }
    finally { setStreakBuying(null); }
  };

  const handleBuyStorage = async (pkgId: string, pin?: string) => {
    const balVid = localStorage.getItem("balance_visitor_id");
    if (!balVid) { toast({ title: "Login dulu ke akun saldo", variant: "destructive" }); return; }
    setStorageBuying(pkgId);
    try {
      const { data, error } = await supabase.functions.invoke("upgrade-storage", {
        body: { visitorId: balVid, packageId: pkgId, pin: pin || undefined },
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
      fetchBalance();
    } catch (e: any) { toast({ title: "Error", description: e?.message || "Terjadi kesalahan", variant: "destructive" }); }
    finally { setStorageBuying(null); }
  };

  const handleBuyBundle = async (pkgId: string, pin?: string) => {
    const balVid = localStorage.getItem("balance_visitor_id");
    if (!balVid) { toast({ title: "Login dulu ke akun saldo", variant: "destructive" }); return; }
    setBundleBuying(pkgId);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-bundle", {
        body: { visitorId: balVid, packageId: pkgId, pin: pin || undefined },
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
      fetchCredits(); fetchBalance();
    } catch (e: any) { toast({ title: "Error", description: e?.message || "Terjadi kesalahan", variant: "destructive" }); }
    finally { setBundleBuying(null); }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-extrabold flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" /> Plus
      </h2>

      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
        <CardContent className="p-4">
          {userBalance ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Hai, {userBalance.username}</p>
                <p className="text-2xl font-extrabold text-primary">{formatPrice(userBalance.balance)}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                <Wallet className="w-6 h-6 text-primary-foreground" />
              </div>
            </div>
          ) : (
            <div className="text-center py-2">
              <p className="text-sm text-muted-foreground">Login ke tab <strong>Saldo</strong> untuk melihat saldo & membeli</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        <GameCreditsBadge credits={credits} isUnlimited={isUnlimited} unlimitedUntil={unlimitedUntil} />
        <GameBalanceBadge amount={gameBalance} />
      </div>
      <p className="text-[10px] text-muted-foreground -mt-2 px-1">
        💡 <strong>Saldo IN</strong> hanya bisa dipakai untuk Game, Streak, dan Storage — tidak untuk produk.
      </p>

      {flashSaleEnd && new Date(flashSaleEnd) > new Date() && (
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg p-2 text-center">
          <p className="text-xs font-bold text-yellow-600 flex items-center justify-center gap-1">
            🔥 FLASH SALE! Berakhir {new Date(flashSaleEnd).toLocaleString("id-ID")}
          </p>
        </div>
      )}

      {/* PAKET BUNDEL */}
      {bundlePackages.length > 0 && (
        <SectionCard
          title="Paket Bundel"
          icon={<Package className="w-4 h-4 text-purple-500" />}
          description="Hemat lebih banyak dengan paket kombo"
          needPin={bundleNeedPin}
          pin={bundlePin}
          setPin={setBundlePin}
          buying={bundleBuying}
          selectedPkg={bundleSelectedPkg}
          onConfirmPin={() => handleBuyBundle(bundleSelectedPkg!, bundlePin)}
          onCancelPin={() => { setBundleNeedPin(false); setBundlePin(""); setBundleSelectedPkg(null); }}
        >
          {bundlePackages.map(pkg => {
            const parts: string[] = [];
            if (pkg.credits > 0) parts.push(`${pkg.credits} Kredit`);
            if (pkg.streak_days > 0) parts.push(`${pkg.streak_days} Hari Streak`);
            if (pkg.storage_mb > 0) parts.push(`${(pkg.storage_mb / 1024).toFixed(0)} GB Storage`);
            return (
              <PackageButton
                key={pkg.id}
                label={parts.join(" + ")}
                price={pkg.price}
                buying={bundleBuying === pkg.id}
                anyBuying={!!bundleBuying}
                icon={<Package className="w-4 h-4 text-purple-500" />}
                onClick={() => handleBuyBundle(pkg.id)}
              />
            );
          })}
        </SectionCard>
      )}

      {/* KREDIT GAME */}
      <SectionCard
        title="Kredit Game"
        icon={<Key className="w-4 h-4 text-accent" />}
        description="1 kredit = 1x lihat kunci jawaban"
        needPin={creditNeedPin}
        pin={creditPin}
        setPin={setCreditPin}
        buying={creditBuying}
        selectedPkg={creditSelectedPkg}
        onConfirmPin={() => handleBuyCredit(creditSelectedPkg!, creditPin)}
        onCancelPin={() => { setCreditNeedPin(false); setCreditPin(""); setCreditSelectedPkg(null); }}
      >
        {creditPackages.map(pkg => (
          <PackageButton
            key={pkg.id}
            label={pkg.label}
            price={pkg.price}
            originalPrice={pkg.originalPrice}
            buying={creditBuying === pkg.id}
            anyBuying={!!creditBuying}
            icon={pkg.is_unlimited ? <Infinity className="w-4 h-4 text-purple-500" /> : <Key className="w-4 h-4 text-accent" />}
            onClick={() => handleBuyCredit(pkg.id)}
          />
        ))}
      </SectionCard>

      {/* STREAK */}
      <SectionCard
        title="Paket Streak"
        icon={<CalendarDays className="w-4 h-4 text-orange-500" />}
        description="Auto-klaim streak harian"
        needPin={streakNeedPin}
        pin={streakPin}
        setPin={setStreakPin}
        buying={streakBuying}
        selectedPkg={streakSelectedPkg}
        onConfirmPin={() => handleBuyStreak(streakSelectedPkg!, streakPin)}
        onCancelPin={() => { setStreakNeedPin(false); setStreakPin(""); setStreakSelectedPkg(null); }}
      >
        {streakPackages.map(pkg => (
          <PackageButton
            key={pkg.id}
            label={`${pkg.name} (${pkg.days} hari)`}
            price={pkg.price}
            originalPrice={pkg.originalPrice}
            buying={streakBuying === pkg.id}
            anyBuying={!!streakBuying}
            icon={<CalendarDays className="w-4 h-4 text-orange-500" />}
            onClick={() => handleBuyStreak(pkg.id)}
          />
        ))}
      </SectionCard>

      {/* STORAGE */}
      <SectionCard
        title="Paket Storage Musik"
        icon={<HardDrive className="w-4 h-4 text-blue-500" />}
        description="Tambah ruang penyimpanan musik"
        needPin={storageNeedPin}
        pin={storagePin}
        setPin={setStoragePin}
        buying={storageBuying}
        selectedPkg={storageSelectedPkg}
        onConfirmPin={() => handleBuyStorage(storageSelectedPkg!, storagePin)}
        onCancelPin={() => { setStorageNeedPin(false); setStoragePin(""); setStorageSelectedPkg(null); }}
      >
        {storagePackages.map(pkg => (
          <PackageButton
            key={pkg.id}
            label={`${pkg.name} (${pkg.storage_mb} MB)`}
            price={pkg.price}
            buying={storageBuying === pkg.id}
            anyBuying={!!storageBuying}
            icon={<HardDrive className="w-4 h-4 text-blue-500" />}
            onClick={() => handleBuyStorage(pkg.id)}
          />
        ))}
      </SectionCard>
    </div>
  );
}

function SectionCard({ title, icon, description, children, needPin, pin, setPin, buying, selectedPkg, onConfirmPin, onCancelPin }: {
  title: string; icon: React.ReactNode; description: string; children: React.ReactNode;
  needPin: boolean; pin: string; setPin: (v: string) => void; buying: string | null; selectedPkg: string | null;
  onConfirmPin: () => void; onCancelPin: () => void;
}) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-sm flex items-center gap-2">{icon} {title}</h3>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
        {needPin && selectedPkg ? (
          <div className="space-y-2">
            <p className="text-sm font-bold flex items-center gap-1"><Lock className="w-4 h-4" /> Masukkan PIN</p>
            <Input type="password" maxLength={6} placeholder="PIN 6 digit" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} />
            <Button className="w-full" disabled={pin.length !== 6 || !!buying} onClick={onConfirmPin}>
              {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Konfirmasi"}
            </Button>
            <Button variant="ghost" className="w-full text-xs" onClick={onCancelPin}>Batal</Button>
          </div>
        ) : (
          <div className="grid gap-2">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

function PackageButton({ label, price, originalPrice, buying, anyBuying, icon, onClick }: {
  label: string; price: number; originalPrice?: number; buying: boolean; anyBuying: boolean; icon: React.ReactNode; onClick: () => void;
}) {
  const hasPromo = originalPrice && originalPrice !== price;
  return (
    <motion.div whileTap={{ scale: 0.97 }}>
      <Button variant="outline" className="w-full justify-between h-auto py-3" disabled={anyBuying} onClick={onClick}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-bold text-sm text-left">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          {hasPromo ? (
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground line-through block">{formatPrice(originalPrice!)}</span>
              <span className="text-xs font-bold text-green-600">{formatPrice(price)}</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{formatPrice(price)}</span>
          )}
          {buying && <Loader2 className="w-3 h-3 animate-spin" />}
        </div>
      </Button>
    </motion.div>
  );
}
