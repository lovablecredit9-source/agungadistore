import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { Key, Loader2, ShoppingCart, Infinity, Coins, Lock, Gift } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getDailyFreeReveals, useDailyFreeReveal, MAX_FREE_REVEALS } from "./gameStore";

interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  label: string;
}

const PACKAGES: CreditPackage[] = [
  { id: "10", credits: 10, price: 5000, label: "10 Kredit" },
  { id: "30", credits: 30, price: 10000, label: "30 Kredit" },
  { id: "60", credits: 60, price: 15000, label: "60 Kredit" },
  { id: "100", credits: 100, price: 20000, label: "100 Kredit" },
  { id: "200", credits: 200, price: 50000, label: "200 Kredit" },
  { id: "500", credits: 500, price: 30000, label: "500 Kredit" },
  { id: "1000", credits: 1000, price: 50000, label: "1000 Kredit" },
  { id: "unlimited", credits: -1, price: 100000, label: "Unlimited 1 Bulan" },
];

export function useGameCredits(visitorId: string | null) {
  const [credits, setCredits] = useState(0);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [unlimitedUntil, setUnlimitedUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [freeRemaining, setFreeRemaining] = useState(getDailyFreeReveals().remaining);

  const refreshFree = useCallback(() => {
    setFreeRemaining(getDailyFreeReveals().remaining);
  }, []);

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
    refreshFree();
  }, [visitorId, refreshFree]);

  useEffect(() => { fetchCredits(); }, [fetchCredits]);

  const useCredit = useCallback(async (): Promise<boolean> => {
    // Try daily free first
    if (freeRemaining > 0) {
      const used = useDailyFreeReveal();
      if (used) {
        setFreeRemaining(getDailyFreeReveals().remaining);
        return true;
      }
    }

    // Fall back to paid credits
    if (!visitorId) return false;
    const { data, error } = await supabase.functions.invoke("purchase-game-credits", {
      body: { action: "use_credit", visitorId },
    });
    if (error || data?.error) return false;
    setCredits(data.credits);
    setIsUnlimited(data.is_unlimited);
    return true;
  }, [visitorId, freeRemaining]);

  return { credits, isUnlimited, unlimitedUntil, loading, fetchCredits, useCredit, freeRemaining };
}

interface GameCreditsBadgeProps {
  credits: number;
  isUnlimited: boolean;
  freeRemaining?: number;
}

export function GameCreditsBadge({ credits, isUnlimited, freeRemaining }: GameCreditsBadgeProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Daily free badge */}
      {(freeRemaining !== undefined && freeRemaining > 0) && (
        <div className="flex items-center gap-1 text-xs bg-green-500/10 border border-green-500/30 rounded-lg px-2 py-1">
          <Gift className="w-3 h-3 text-green-500" />
          <span className="font-bold text-green-600">{freeRemaining}/{MAX_FREE_REVEALS} gratis hari ini</span>
        </div>
      )}
      <div className="flex items-center gap-1 text-xs bg-accent/20 border border-accent/30 rounded-lg px-2 py-1">
        <Key className="w-3 h-3 text-accent" />
        {isUnlimited ? (
          <span className="font-bold text-accent flex items-center gap-0.5"><Infinity className="w-3 h-3" /> Unlimited</span>
        ) : (
          <span className="font-bold">{credits} kredit</span>
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
  const { toast } = useToast();

  const handleBuy = async (pkgId: string, pinValue?: string) => {
    if (!visitorId) {
      toast({ title: "Login dulu", description: "Silakan login ke akun saldo terlebih dahulu", variant: "destructive" });
      return;
    }
    setBuying(pkgId);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-game-credits", {
        body: { action: "purchase", visitorId, packageId: pkgId, pin: pinValue || undefined },
      });
      if (error) throw error;
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
      toast({ title: "Berhasil!", description: `${data.package.label} berhasil dibeli. Sisa saldo: Rp${data.balance_remaining.toLocaleString("id-ID")}` });
      setNeedPin(false);
      setPin("");
      setSelectedPkg(null);
      onPurchased();
      setOpen(false);
    } catch {
      toast({ title: "Error", description: "Gagal membeli kredit", variant: "destructive" });
    } finally {
      setBuying(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setNeedPin(false); setPin(""); setSelectedPkg(null); } }}>
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
        <p className="text-xs text-muted-foreground">1 kredit = 1x lihat kunci jawaban game. Setiap hari dapat {MAX_FREE_REVEALS}x gratis!</p>

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
          <div className="grid gap-2">
            {PACKAGES.map(pkg => (
              <motion.div key={pkg.id} whileTap={{ scale: 0.97 }}>
                <Button
                  variant="outline"
                  className="w-full justify-between h-auto py-3"
                  disabled={!!buying}
                  onClick={() => handleBuy(pkg.id)}
                >
                  <div className="flex items-center gap-2">
                    {pkg.id === "unlimited" ? (
                      <Infinity className="w-4 h-4 text-purple-500" />
                    ) : (
                      <Key className="w-4 h-4 text-accent" />
                    )}
                    <span className="font-bold text-sm">{pkg.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Rp{pkg.price.toLocaleString("id-ID")}</span>
                    {buying === pkg.id && <Loader2 className="w-3 h-3 animate-spin" />}
                  </div>
                </Button>
              </motion.div>
            ))}
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
  freeRemaining?: number;
  disabled?: boolean;
}

export function RevealAnswerButton({ onReveal, visitorId, useCredit, credits, isUnlimited, freeRemaining = 0, disabled }: RevealAnswerButtonProps) {
  const [revealing, setRevealing] = useState(false);
  const { toast } = useToast();

  const handleReveal = async () => {
    // Free reveals don't need login
    if (freeRemaining > 0) {
      setRevealing(true);
      const ok = await useCredit();
      if (ok) {
        onReveal();
      }
      setRevealing(false);
      return;
    }

    if (!visitorId) {
      toast({ title: "Login dulu", description: "Login ke akun saldo untuk menggunakan kredit jawaban", variant: "destructive" });
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

  const canUse = freeRemaining > 0 || isUnlimited || credits > 0;

  return (
    <Button
      variant="secondary"
      size="sm"
      className="gap-1 text-xs"
      disabled={disabled || revealing || !canUse}
      onClick={handleReveal}
    >
      {revealing ? <Loader2 className="w-3 h-3 animate-spin" /> : freeRemaining > 0 ? <Gift className="w-3 h-3" /> : <Key className="w-3 h-3" />}
      {freeRemaining > 0 ? `Gratis (${freeRemaining})` : `Kunci Jawaban ${!isUnlimited ? `(${credits})` : ""}`}
    </Button>
  );
}
