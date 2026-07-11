import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Zap, Gem, Loader2, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BOOSTER_TIERS, activatePointBooster, getPointBoosterUntil, setPointBoosterUntil, syncPowerUpsFromServer } from "./gameStore";

interface Props {
  visitorId: string | null;
  onActivated?: () => void;
  trigger?: React.ReactNode;
}

export default function BuyBoosterDialog({ visitorId, onActivated, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [gems, setGems] = useState(0);
  const [buying, setBuying] = useState<string | null>(null);
  const [activeUntil, setActiveUntil] = useState(0);
  const { toast } = useToast();

  const remainingMs = Math.max(0, activeUntil - Date.now());
  const isActive = remainingMs > 0;

  const activeLabel = useMemo(() => {
    if (!isActive) return "";
    const totalMinutes = Math.floor(remainingMs / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    const parts = [
      days > 0 ? `${days}h` : null,
      hours > 0 ? `${hours}j` : null,
      minutes > 0 || (!days && !hours) ? `${minutes}m` : null,
    ].filter(Boolean);
    return parts.join(" ");
  }, [isActive, remainingMs]);

  useEffect(() => {
    if (!open || !visitorId) return;
    (async () => {
      const { data } = await supabase.rpc("get_account_gems" as any, { p_visitor_id: visitorId });
      if (typeof data === "number") setGems(data);
      await syncPowerUpsFromServer();
      setActiveUntil(getPointBoosterUntil());
    })();
  }, [open, visitorId]);

  useEffect(() => {
    setActiveUntil(getPointBoosterUntil());
    const refresh = () => setActiveUntil(getPointBoosterUntil());
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener("power-ups-updated", refresh as EventListener);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("power-ups-updated", refresh as EventListener);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const handleBuy = async (tierKey: string) => {
    if (!visitorId) {
      toast({ title: "Login dulu", variant: "destructive" });
      return;
    }
    const tier = BOOSTER_TIERS.find(t => t.key === tierKey);
    if (!tier) return;
    if (gems < tier.gemCost) {
      toast({ title: "Gem tidak cukup", description: `Butuh ${tier.gemCost} gem, kamu punya ${gems}`, variant: "destructive" });
      return;
    }
    setBuying(tierKey);
    try {
      const { data, error } = await supabase.rpc("add_account_gems" as any, {
        p_visitor_id: visitorId,
        p_amount: -tier.gemCost,
      });
      if (error) throw error;
      const localUntil = activatePointBooster(tier.durationMs, tier.multiplier);
      const { data: syncData, error: syncError } = await supabase.functions.invoke("power-up-consume", {
        body: { action: "activate_double_xp", visitorId, durationMs: tier.durationMs },
      });
      if (syncError) throw syncError;
      const syncedUntil = syncData?.double_xp_until ? new Date(syncData.double_xp_until).getTime() : localUntil;
      setPointBoosterUntil(syncedUntil);
      setActiveUntil(syncedUntil);
      window.dispatchEvent(new CustomEvent("power-ups-updated"));
      setGems(typeof data === "number" ? data : gems - tier.gemCost);
      toast({ title: "🚀 Booster aktif!", description: `x${tier.multiplier} poin selama ${tier.label}` });
      onActivated?.();
      setOpen(false);
    } catch (e: any) {
      toast({ title: "Gagal", description: e?.message || "Error", variant: "destructive" });
    } finally {
      setBuying(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-1 h-7 text-[10px] font-bold">
            <Zap className="w-3 h-3 text-yellow-500" /> x2 Poin
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Zap className="w-5 h-5 text-yellow-500" /> Booster Poin
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
            <span className="text-xs font-bold flex items-center gap-1">
              <Gem className="w-3.5 h-3.5 text-purple-500" /> Gem kamu
            </span>
            <span className="text-sm font-extrabold">{gems}</span>
          </div>
          {isActive && (
            <div className="flex items-center gap-1.5 text-xs bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-2 text-yellow-700 dark:text-yellow-400 font-bold">
              <Clock className="w-3.5 h-3.5" />
              Aktif sampai {new Date(activeUntil).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} ({activeLabel})
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            Aktif untuk <strong>semua game</strong>. Pembelian saat booster masih aktif akan menambah durasinya.
          </p>
          {[2, 3].map(mult => (
            <div key={mult} className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-extrabold text-yellow-600 dark:text-yellow-400">
                <Zap className="w-3.5 h-3.5" /> x{mult} Poin
              </div>
              <div className="grid gap-2">
                {BOOSTER_TIERS.filter(t => t.multiplier === mult).map(tier => (
                  <Button
                    key={tier.key}
                    variant="outline"
                    disabled={!!buying}
                    onClick={() => handleBuy(tier.key)}
                    className="h-auto py-2.5 justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-500" />
                      <span className="font-bold text-sm">{tier.label}</span>
                    </span>
                    <span className="flex items-center gap-1 text-purple-600 font-extrabold">
                      {buying === tier.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Gem className="w-3.5 h-3.5" />}
                      {tier.gemCost}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
