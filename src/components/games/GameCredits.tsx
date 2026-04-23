import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Key, Loader2, ShoppingCart, Infinity, Coins, Lock, Tag, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  label: string;
  is_unlimited?: boolean;
  unlimited_days?: number;
}

const GAME_CREDITS_REFRESH_EVENT = "game-credits-refresh";

export function triggerGameCreditsRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(GAME_CREDITS_REFRESH_EVENT));
  }
}

export function useGameCredits(visitorId: string | null) {
  const [credits, setCredits] = useState(0);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [unlimitedUntil, setUnlimitedUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchCredits = useCallback(async () => {
    if (!visitorId) return;
    const { data } = await supabase.functions.invoke("purchase-game-credits", {
      body: { action: "get_credits", visitorId },
    });
    if (data) {
      setCredits(data.credits || 0);
      setIsUnlimited(data.is_unlimited || false);
      setUnlimitedUntil(data.unlimited_until || null);
    }
  }, [visitorId]);

  useEffect(() => { fetchCredits(); }, [fetchCredits]);

  // Cross-component refresh listener
  useEffect(() => {
    const handler = () => fetchCredits();
    window.addEventListener(GAME_CREDITS_REFRESH_EVENT, handler);
    return () => window.removeEventListener(GAME_CREDITS_REFRESH_EVENT, handler);
  }, [fetchCredits]);

  // Realtime: auto-refresh when DB row changes (e.g. slot machine win)
  useEffect(() => {
    if (!visitorId) return;
    const channel = supabase
      .channel(`user_game_credits_${visitorId}_${Math.random().toString(36).slice(2, 10)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_game_credits", filter: `visitor_id=eq.${visitorId}` },
        () => fetchCredits(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [visitorId, fetchCredits]);

  const useCredit = useCallback(async (): Promise<boolean> => {
    if (!visitorId) return false;
    const { data, error } = await supabase.functions.invoke("purchase-game-credits", {
      body: { action: "use_credit", visitorId },
    });
    if (error || data?.error) return false;
    setCredits(data.credits);
    setIsUnlimited(data.is_unlimited);
    return true;
  }, [visitorId]);

  return { credits, isUnlimited, unlimitedUntil, loading, fetchCredits, useCredit };
}

interface GameCreditsBadgeProps {
  credits: number;
  isUnlimited: boolean;
  unlimitedUntil?: string | null;
}

export function GameCreditsBadge({ credits, isUnlimited, unlimitedUntil }: GameCreditsBadgeProps) {
  const expiryLabel = unlimitedUntil
    ? new Date(unlimitedUntil).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    : null;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-muted">
        <Key className="w-3.5 h-3.5" strokeWidth={1.8} />
      </div>
      <span className="font-semibold tabular-nums">{Math.max(0, credits)} kredit</span>
      <span className="opacity-40 text-muted-foreground">•</span>
      <div className="flex items-center gap-1">
        <span className="font-semibold text-muted-foreground">Aktif:</span>
        {isUnlimited ? (
          <span className="font-semibold text-foreground flex items-center gap-1">
            <Infinity className="w-3 h-3" strokeWidth={1.8} />
            <span>{expiryLabel ? `s/d ${expiryLabel}` : "Premium"}</span>
          </span>
        ) : (
          <span className="font-semibold text-muted-foreground">-</span>
        )}
      </div>
    </div>
  );
}

interface BuyCreditsDialogProps {
  visitorId: string | null;
  onPurchased: () => void;
}

export function BuyCreditsDialog({ visitorId, onPurchased }: BuyCreditsDialogProps) {
  const [open, setOpen] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [needPin, setNeedPin] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState(0);
  const [voucherValid, setVoucherValid] = useState(false);
  const [checkingVoucher, setCheckingVoucher] = useState(false);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [flashSaleEnd, setFlashSaleEnd] = useState<string>("");
  const [creditDiscount, setCreditDiscount] = useState(0);
  const [paymentSource, setPaymentSource] = useState<"auto" | "game" | "main">("auto");
  const [gameBalanceAmount, setGameBalanceAmount] = useState(0);
  const [mainBalanceAmount, setMainBalanceAmount] = useState(0);
  const { toast } = useToast();

  // Fetch packages from DB via edge function + balances
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke("purchase-game-credits", {
          body: { action: "get_packages" },
        });
        if (data?.packages) {
          // Check flash sale settings
          const { data: settingsData } = await supabase.from("admin_settings").select("*");
          const settings: Record<string, string> = {};
          if (settingsData) (settingsData as any[]).forEach((s: any) => { settings[s.setting_key] = s.setting_value; });
          const fsEnd = settings.flash_sale_end || "";
          setFlashSaleEnd(fsEnd);
          const disc = parseInt(settings.promo_credit_discount || "0");
          const isFlashActive = fsEnd && new Date(fsEnd) > new Date();
          setCreditDiscount(isFlashActive ? disc : 0);
          
          // Apply flash sale discount to packages
          const pkgs = (data.packages as CreditPackage[]).map(pkg => {
            if (isFlashActive && disc > 0) {
              const discountedPrice = Math.max(0, Math.round(pkg.price * (1 - disc / 100)));
              return { ...pkg, originalPrice: pkg.price, price: discountedPrice } as any;
            }
            return pkg;
          });
          setPackages(pkgs);
        }

        // Fetch both balances
        if (visitorId) {
          const [{ data: gb }, { data: mb }] = await Promise.all([
            supabase.from("game_balance" as any).select("amount").eq("visitor_id", visitorId).maybeSingle(),
            supabase.from("user_balances").select("balance").eq("visitor_id", visitorId).maybeSingle(),
          ]);
          setGameBalanceAmount(((gb as any)?.amount as number) || 0);
          setMainBalanceAmount(((mb as any)?.balance as number) || 0);
        }
      } catch {}
    })();
  }, [open, visitorId]);

  const resetVoucher = () => {
    setVoucherCode("");
    setVoucherDiscount(0);
    setVoucherValid(false);
  };

  const checkVoucher = async () => {
    if (!voucherCode.trim()) return;
    setCheckingVoucher(true);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-game-credits", {
        body: { action: "check_voucher", voucherCode: voucherCode.trim() },
      });
      if (error || data?.error) {
        toast({ title: "Voucher tidak valid", description: data?.error || "Gagal memvalidasi voucher", variant: "destructive" });
        setVoucherValid(false);
        setVoucherDiscount(0);
      } else {
        setVoucherValid(true);
        setVoucherDiscount(data.discount_amount || 0);
        toast({ title: "Voucher valid!", description: `Diskon Rp${(data.discount_amount || 0).toLocaleString("id-ID")}` });
      }
    } catch {
      toast({ title: "Error", description: "Gagal memeriksa voucher", variant: "destructive" });
    } finally {
      setCheckingVoucher(false);
    }
  };

  const handleBuy = async (pkgId: string, pinValue?: string) => {
    if (!visitorId) {
      toast({ title: "Login dulu", description: "Silakan login ke akun saldo terlebih dahulu", variant: "destructive" });
      return;
    }
    setBuying(pkgId);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-game-credits", {
        body: {
          action: "purchase",
          visitorId,
          packageId: pkgId,
          pin: pinValue || undefined,
          voucherCode: voucherValid ? voucherCode.trim() : undefined,
          paymentSource,
        },
      });
      if (error) {
        let errBody: any = null;
        try {
          if (error instanceof FunctionsHttpError && error.context) {
            errBody = await error.context.json();
          }
        } catch {
          errBody = null;
        }
        if (errBody?.needPin) {
          setNeedPin(true);
          setSelectedPkg(pkgId);
          setBuying(null);
          return;
        }
        toast({ title: "Gagal", description: errBody?.error || "Terjadi kesalahan", variant: "destructive" });
        setBuying(null);
        return;
      }
      if (data?.needPin) {
        setNeedPin(true);
        setSelectedPkg(pkgId);
        setBuying(null);
        return;
      }
      if (data?.error) {
        toast({ title: "Gagal", description: data.error, variant: "destructive" });
        setBuying(null);
        return;
      }
      const discountInfo = data.discount_amount > 0
        ? ` (Diskon Rp${data.discount_amount.toLocaleString("id-ID")})`
        : "";
      const sourceInfo = data.source_label ? ` via ${data.source_label}` : "";
      toast({ title: "Berhasil!", description: `${data.package.label} dibeli${sourceInfo}${discountInfo}. Saldo Utama: Rp${data.balance_remaining.toLocaleString("id-ID")} • Saldo IN: Rp${(data.game_balance_remaining || 0).toLocaleString("id-ID")}` });
      setNeedPin(false);
      setPin("");
      setSelectedPkg(null);
      resetVoucher();
      onPurchased();
      setOpen(false);
    } catch {
      toast({ title: "Error", description: "Gagal membeli kredit", variant: "destructive" });
    } finally {
      setBuying(null);
    }
  };

  const getDiscountedPrice = (price: number) => {
    if (!voucherValid || voucherDiscount <= 0) return price;
    return Math.max(0, price - voucherDiscount);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setNeedPin(false); setPin(""); setSelectedPkg(null); resetVoucher(); } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 text-xs">
          <ShoppingCart className="w-3 h-3" /> Beli Kredit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Coins className="w-5 h-5 text-primary" /> Beli Kredit Jawaban
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">1 kredit = 1x lihat kunci jawaban game</p>

        {needPin && selectedPkg ? (
          <div className="space-y-3">
            <p className="text-sm font-bold flex items-center gap-1"><Lock className="w-4 h-4" /> Masukkan PIN</p>
            <Input
              type="password"
              maxLength={6}
              placeholder="PIN 6 digit"
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
            />
            <Button
              className="w-full"
              disabled={pin.length !== 6 || !!buying}
              onClick={() => handleBuy(selectedPkg, pin)}
            >
              {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Konfirmasi"}
            </Button>
            <Button variant="ghost" className="w-full text-xs" onClick={() => { setNeedPin(false); setPin(""); setSelectedPkg(null); }}>
              Batal
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Voucher input */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Kode voucher diskon"
                  value={voucherCode}
                  onChange={e => { setVoucherCode(e.target.value.toUpperCase()); setVoucherValid(false); setVoucherDiscount(0); }}
                  className="pl-8 text-xs h-9"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs"
                disabled={!voucherCode.trim() || checkingVoucher}
                onClick={checkVoucher}
              >
                {checkingVoucher ? <Loader2 className="w-3 h-3 animate-spin" /> : "Cek"}
              </Button>
            </div>
            {voucherValid && (
              <div className="flex items-center gap-1 text-xs text-green-600 bg-green-500/10 rounded-lg px-2 py-1">
                <CheckCircle className="w-3 h-3" />
                <span className="font-bold">Diskon Rp{voucherDiscount.toLocaleString("id-ID")} aktif!</span>
              </div>
            )}

            {/* Flash sale banner */}
            {flashSaleEnd && new Date(flashSaleEnd) > new Date() && (
              <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-lg p-2 text-center">
                <p className="text-xs font-bold text-yellow-600 flex items-center justify-center gap-1">
                  🔥 FLASH SALE! Berakhir {new Date(flashSaleEnd).toLocaleString("id-ID")}
                </p>
              </div>
            )}

            {/* Payment source selector */}
            <div className="space-y-1.5 bg-muted/30 rounded-lg p-2">
              <p className="text-[10px] font-bold uppercase text-muted-foreground">Sumber Pembayaran</p>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaymentSource("auto")}
                  className={`text-[10px] font-bold rounded-md py-1.5 px-1 border transition ${paymentSource === "auto" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}
                >
                  Otomatis
                  <div className="text-[8px] font-normal opacity-80">IN dulu</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentSource("game")}
                  className={`text-[10px] font-bold rounded-md py-1.5 px-1 border transition ${paymentSource === "game" ? "bg-emerald-600 text-white border-emerald-600" : "bg-card border-border text-muted-foreground"}`}
                >
                  Saldo IN
                  <div className="text-[8px] font-normal opacity-80">Rp{gameBalanceAmount.toLocaleString("id-ID")}</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentSource("main")}
                  className={`text-[10px] font-bold rounded-md py-1.5 px-1 border transition ${paymentSource === "main" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-muted-foreground"}`}
                >
                  Saldo Utama
                  <div className="text-[8px] font-normal opacity-80">Rp{mainBalanceAmount.toLocaleString("id-ID")}</div>
                </button>
              </div>
            </div>

            {/* Package list */}
            <div className="grid gap-2">
              {packages.map(pkg => {
                const origPrice = (pkg as any).originalPrice || pkg.price;
                const isPromo = origPrice !== pkg.price;
                const discountedPrice = getDiscountedPrice(pkg.price);
                const hasDiscount = voucherValid && discountedPrice < pkg.price;
                return (
                  <motion.div key={pkg.id} whileTap={{ scale: 0.97 }}>
                    <Button
                      variant="outline"
                      className="w-full justify-between h-auto py-3"
                      disabled={!!buying}
                      onClick={() => handleBuy(pkg.id)}
                    >
                      <div className="flex items-center gap-2">
                        {pkg.is_unlimited ? (
                          <Infinity className="w-4 h-4 text-purple-500" />
                        ) : (
                          <Key className="w-4 h-4 text-accent" />
                        )}
                        <span className="font-bold text-sm">{pkg.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {isPromo || hasDiscount ? (
                          <div className="text-right">
                            <span className="text-[10px] text-muted-foreground line-through block">Rp{(isPromo ? origPrice : pkg.price).toLocaleString("id-ID")}</span>
                            <span className="text-xs font-bold text-green-600">Rp{(hasDiscount ? discountedPrice : pkg.price).toLocaleString("id-ID")}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Rp{pkg.price.toLocaleString("id-ID")}</span>
                        )}
                        {buying === pkg.id && <Loader2 className="w-3 h-3 animate-spin" />}
                      </div>
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface RevealAnswerButtonProps {
  onReveal: () => void;
  visitorId: string | null;
  useCredit: () => Promise<boolean>;
  credits: number;
  isUnlimited: boolean;
  disabled?: boolean;
}

export function RevealAnswerButton({ onReveal, visitorId, useCredit, credits, isUnlimited, disabled }: RevealAnswerButtonProps) {
  const [revealing, setRevealing] = useState(false);
  const [showBuyFirst, setShowBuyFirst] = useState(false);
  const { toast } = useToast();

  const handleReveal = async () => {
    if (!visitorId) {
      toast({ title: "Login dulu", description: "Login ke akun saldo untuk menggunakan kredit jawaban", variant: "destructive" });
      return;
    }
    if (!isUnlimited && credits <= 0) {
      setShowBuyFirst(true);
      return;
    }
    setRevealing(true);
    const ok = await useCredit();
    if (ok) {
      onReveal();
    } else {
      toast({ title: "Kredit habis", description: "Beli kredit jawaban terlebih dahulu", variant: "destructive" });
    }
    setRevealing(false);
  };

  const canUse = isUnlimited || credits > 0;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="secondary"
        size="sm"
        className="gap-1 text-xs"
        disabled={disabled || revealing}
        onClick={handleReveal}
      >
        {revealing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Key className="w-3 h-3" />}
        Kunci Jawaban {!isUnlimited && `(${credits})`}
      </Button>
      {showBuyFirst && (
        <BuyCreditsDialog visitorId={visitorId} onPurchased={() => { setShowBuyFirst(false); }} />
      )}
    </div>
  );
}
