import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, Key, CalendarDays, HardDrive, Loader2, Lock, Tag, CheckCircle, Infinity, Coins, ShoppingCart, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGameCredits, GameCreditsBadge } from "@/components/games/GameCredits";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { motion } from "framer-motion";

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price);
}

interface UserBalance {
  id: string;
  visitor_id: string;
  username: string;
  phone: string;
  balance: number;
}

interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  label: string;
  is_unlimited?: boolean;
  unlimited_days?: number;
  originalPrice?: number;
}

interface StreakPackage {
  id: string;
  name: string;
  days: number;
  price: number;
  is_active: boolean;
  sort_order: number;
}

interface StoragePackage {
  id: string;
  name: string;
  storage_mb: number;
  price: number;
  is_active: boolean;
  sort_order: number;
}

export default function PlusTab() {
  const visitorId = getVisitorId();
  const { toast } = useToast();
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null);
  const [loading, setLoading] = useState(true);

  // Credits
  const { credits, isUnlimited, unlimitedUntil, fetchCredits } = useGameCredits(
    localStorage.getItem("balance_visitor_id") || visitorId
  );
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [creditBuying, setCreditBuying] = useState<string | null>(null);
  const [creditPin, setCreditPin] = useState("");
  const [creditNeedPin, setCreditNeedPin] = useState(false);
  const [creditSelectedPkg, setCreditSelectedPkg] = useState<string | null>(null);

  // Streak
  const [streakPackages, setStreakPackages] = useState<StreakPackage[]>([]);
  const [streakBuying, setStreakBuying] = useState<string | null>(null);
  const [streakPin, setStreakPin] = useState("");
  const [streakNeedPin, setStreakNeedPin] = useState(false);
  const [streakSelectedPkg, setStreakSelectedPkg] = useState<string | null>(null);

  // Storage
  const [storagePackages, setStoragePackages] = useState<StoragePackage[]>([]);
  const [storageBuying, setStorageBuying] = useState<string | null>(null);
  const [storagePin, setStoragePin] = useState("");
  const [storageNeedPin, setStorageNeedPin] = useState(false);
  const [storageSelectedPkg, setStorageSelectedPkg] = useState<string | null>(null);

  // Voucher states
  const [creditVoucher, setCreditVoucher] = useState("");
  const [creditVoucherValid, setCreditVoucherValid] = useState(false);
  const [creditVoucherDiscount, setCreditVoucherDiscount] = useState(0);

  // Flash sale
  const [flashSaleEnd, setFlashSaleEnd] = useState("");
  const [creditDiscount, setCreditDiscount] = useState(0);

  // Fetch user balance
  const fetchBalance = useCallback(async () => {
    setLoading(true);
    const balVid = localStorage.getItem("balance_visitor_id");
    if (!balVid) { setLoading(false); return; }
    const { data } = await supabase.from("user_balances").select("*").eq("visitor_id", balVid).maybeSingle();
    if (data) setUserBalance(data as unknown as UserBalance);
    setLoading(false);
  }, []);

  // Fetch all packages
  useEffect(() => {
    fetchBalance();
    // Credits
    (async () => {
      const { data } = await supabase.functions.invoke("purchase-game-credits", { body: { action: "get_packages" } });
      if (data?.packages) {
        const { data: settingsData } = await supabase.from("admin_settings").select("*");
        const settings: Record<string, string> = {};
        if (settingsData) (settingsData as any[]).forEach((s: any) => { settings[s.setting_key] = s.setting_value; });
        const fsEnd = settings.flash_sale_end || "";
        setFlashSaleEnd(fsEnd);
        const disc = parseInt(settings.promo_credit_discount || "0");
        const isFlashActive = fsEnd && new Date(fsEnd) > new Date();
        setCreditDiscount(isFlashActive ? disc : 0);
        const pkgs = (data.packages as CreditPackage[]).map(pkg => {
          if (isFlashActive && disc > 0) {
            return { ...pkg, originalPrice: pkg.price, price: Math.max(0, Math.round(pkg.price * (1 - disc / 100))) };
          }
          return pkg;
        });
        setCreditPackages(pkgs);
      }
    })();
    // Streak
    supabase.from("streak_packages").select("*").eq("is_active", true).order("sort_order").then(({ data }) => {
      if (data) setStreakPackages(data as StreakPackage[]);
    });
    // Storage
    supabase.from("storage_packages").select("*").eq("is_active", true).order("sort_order").then(({ data }) => {
      if (data) setStoragePackages(data as StoragePackage[]);
    });
  }, []);

  // Buy credit
  const handleBuyCredit = async (pkgId: string, pin?: string) => {
    const balVid = localStorage.getItem("balance_visitor_id");
    if (!balVid) { toast({ title: "Login dulu ke akun saldo", variant: "destructive" }); return; }
    setCreditBuying(pkgId);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-game-credits", {
        body: { action: "purchase", visitorId: balVid, packageId: pkgId, pin: pin || undefined, voucherCode: creditVoucherValid ? creditVoucher.trim() : undefined },
      });
      if (error) throw error;
      if (data?.needPin) { setCreditNeedPin(true); setCreditSelectedPkg(pkgId); setCreditBuying(null); return; }
      if (data?.error) { toast({ title: "Gagal", description: data.error, variant: "destructive" }); setCreditBuying(null); return; }
      toast({ title: "Berhasil!", description: `${data.package.label} berhasil dibeli. Sisa saldo: ${formatPrice(data.balance_remaining)}` });
      setCreditNeedPin(false); setCreditPin(""); setCreditSelectedPkg(null);
      fetchCredits(); fetchBalance();
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setCreditBuying(null); }
  };

  // Buy streak
  const handleBuyStreak = async (pkgId: string, pin?: string) => {
    const balVid = localStorage.getItem("balance_visitor_id");
    if (!balVid) { toast({ title: "Login dulu ke akun saldo", variant: "destructive" }); return; }
    setStreakBuying(pkgId);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-streak-plan", {
        body: { visitorId: balVid, packageId: pkgId, pin: pin || undefined },
      });
      if (error) throw error;
      if (data?.needPin) { setStreakNeedPin(true); setStreakSelectedPkg(pkgId); setStreakBuying(null); return; }
      if (data?.error) { toast({ title: "Gagal", description: data.error, variant: "destructive" }); setStreakBuying(null); return; }
      toast({ title: "Berhasil!", description: `Paket streak berhasil dibeli. Sisa saldo: ${formatPrice(data.balance_remaining)}` });
      setStreakNeedPin(false); setStreakPin(""); setStreakSelectedPkg(null);
      fetchBalance();
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setStreakBuying(null); }
  };

  // Buy storage
  const handleBuyStorage = async (pkgId: string, pin?: string) => {
    const balVid = localStorage.getItem("balance_visitor_id");
    if (!balVid) { toast({ title: "Login dulu ke akun saldo", variant: "destructive" }); return; }
    setStorageBuying(pkgId);
    try {
      const { data, error } = await supabase.functions.invoke("upgrade-storage", {
        body: { visitorId: balVid, packageId: pkgId, pin: pin || undefined },
      });
      if (error) throw error;
      if (data?.needPin) { setStorageNeedPin(true); setStorageSelectedPkg(pkgId); setStorageBuying(null); return; }
      if (data?.error) { toast({ title: "Gagal", description: data.error, variant: "destructive" }); setStorageBuying(null); return; }
      toast({ title: "Berhasil!", description: `Storage berhasil ditambah. Sisa saldo: ${formatPrice(data.balance_remaining)}` });
      setStorageNeedPin(false); setStoragePin(""); setStorageSelectedPkg(null);
      fetchBalance();
    } catch { toast({ title: "Error", variant: "destructive" }); }
    finally { setStorageBuying(null); }
  };

  const balVid = localStorage.getItem("balance_visitor_id");

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-extrabold flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" /> Plus
      </h2>

      {/* Balance Card */}
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

      {/* Credit Status */}
      <div className="flex items-center gap-2 flex-wrap">
        <GameCreditsBadge credits={credits} isUnlimited={isUnlimited} unlimitedUntil={unlimitedUntil} />
      </div>

      {/* Flash Sale Banner */}
      {flashSaleEnd && new Date(flashSaleEnd) > new Date() && (
        <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg p-2 text-center">
          <p className="text-xs font-bold text-yellow-600 flex items-center justify-center gap-1">
            🔥 FLASH SALE! Berakhir {new Date(flashSaleEnd).toLocaleString("id-ID")}
          </p>
        </div>
      )}

      {/* === KREDIT GAME === */}
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

      {/* === STREAK === */}
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
            buying={streakBuying === pkg.id}
            anyBuying={!!streakBuying}
            icon={<CalendarDays className="w-4 h-4 text-orange-500" />}
            onClick={() => handleBuyStreak(pkg.id)}
          />
        ))}
      </SectionCard>

      {/* === STORAGE === */}
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

// Reusable section card with PIN support
function SectionCard({ title, icon, description, children, needPin, pin, setPin, buying, selectedPkg, onConfirmPin, onCancelPin }: {
  title: string;
  icon: React.ReactNode;
  description: string;
  children: React.ReactNode;
  needPin: boolean;
  pin: string;
  setPin: (v: string) => void;
  buying: string | null;
  selectedPkg: string | null;
  onConfirmPin: () => void;
  onCancelPin: () => void;
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

// Reusable package button
function PackageButton({ label, price, originalPrice, buying, anyBuying, icon, onClick }: {
  label: string;
  price: number;
  originalPrice?: number;
  buying: boolean;
  anyBuying: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  const hasPromo = originalPrice && originalPrice !== price;
  return (
    <motion.div whileTap={{ scale: 0.97 }}>
      <Button variant="outline" className="w-full justify-between h-auto py-3" disabled={anyBuying} onClick={onClick}>
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-bold text-sm">{label}</span>
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
