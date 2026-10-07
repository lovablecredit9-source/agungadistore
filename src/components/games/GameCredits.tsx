import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import CreditShopPanel from "./CreditShop";
import { Key, Loader2, ShoppingCart, Infinity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

/** Shop Kredit: tombol + dialog yang memakai alur beli bersama (CreditShopPanel). */
export function BuyCreditsDialog({ visitorId, onPurchased }: BuyCreditsDialogProps) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1 text-xs">
          <ShoppingCart className="w-3 h-3" /> Beli Kredit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md w-[calc(100vw-1rem)] max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-2xl">
        <DialogHeader className="sr-only"><DialogTitle>Beli Kredit Jawaban</DialogTitle></DialogHeader>
        <CreditShopPanel visitorId={visitorId} onPurchased={onPurchased} onUseCredits={() => setOpen(false)} />
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
