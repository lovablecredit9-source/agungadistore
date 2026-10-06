import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ShoppingCart, Zap, Gem, Crown, Package } from "lucide-react";
import StreakShopStore from "@/components/streak/StreakShopStore";
import MembershipCarousel from "@/components/streak/MembershipCarousel";
import BuyBoosterDialog from "./BuyBoosterDialog";
import { BuyCreditsDialog } from "./GameCredits";
import { syncPowerUpsFromServer } from "./gameStore";

interface Props {
  visitorId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialTab?: Tab;
  onChanged?: () => void;
}
type Tab = "items" | "booster" | "credits" | "membership";

/** One Game Shop that reuses existing purchase systems: Streak Shop items (server-priced),
 *  gem XP boosters, credit packages (purchase-game-credits) and memberships (purchase-membership). */
export default function GameShopSheet({ visitorId, open, onOpenChange, initialTab = "items", onChanged }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [coins, setCoins] = useState(0);
  const [gems, setGems] = useState(0);

  const loadBalances = useCallback(async () => {
    if (!visitorId) return;
    const [{ data: st }, { data: g }] = await Promise.all([
      supabase.from("daily_streaks").select("streak_coins").eq("visitor_id", visitorId).maybeSingle(),
      supabase.rpc("get_account_gems", { p_visitor_id: visitorId }),
    ]);
    setCoins((st as any)?.streak_coins || 0);
    setGems(Number(g) || 0);
  }, [visitorId]);

  useEffect(() => { if (open) { setTab(initialTab); loadBalances(); } }, [open, initialTab, loadBalances]);

  const changed = () => { loadBalances(); syncPowerUpsFromServer().catch(() => {}); window.dispatchEvent(new CustomEvent("power-ups-updated")); window.dispatchEvent(new CustomEvent("game-credits-refresh")); onChanged?.(); };
  const tabs: { id: Tab; label: string; Icon: any }[] = [
    { id: "items", label: "Item", Icon: Package }, { id: "booster", label: "XP Boost", Icon: Zap },
    { id: "credits", label: "Credits", Icon: Gem }, { id: "membership", label: "Member", Icon: Crown },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 border-purple-500/40 text-white">
        <DialogTitle className="flex items-center gap-2 text-white"><ShoppingCart className="w-5 h-5 text-amber-300" /> GAME SHOP</DialogTitle>
        <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-black/40 border border-white/10">
          {tabs.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)} className={`min-h-10 rounded-lg text-[11px] font-black flex items-center justify-center gap-1 transition ${tab === id ? "bg-amber-400 text-black" : "text-white/70"}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
        {!visitorId && <p className="text-center text-sm text-white/70 py-6">Login akun saldo dulu untuk belanja di Game Shop.</p>}
        {visitorId && tab === "items" && <StreakShopStore scope="game" visitorId={visitorId} coins={coins} gems={gems} onPurchased={changed} />}
        {visitorId && tab === "booster" && (
          <div className="rounded-2xl border border-amber-400/30 bg-black/30 p-4 space-y-3 text-center">
            <Zap className="w-10 h-10 mx-auto text-amber-300" />
            <p className="font-black">⚡ Booster Poin x2 / x3</p>
            <p className="text-xs text-white/70">Poin game dikali selama durasi aktif. Dibayar Gem 💎 ({gems.toLocaleString("id-ID")} tersedia).</p>
            <BuyBoosterDialog visitorId={visitorId} onActivated={changed} />
          </div>
        )}
        {visitorId && tab === "credits" && (
          <div className="rounded-2xl border border-cyan-400/30 bg-black/30 p-4 space-y-3 text-center">
            <Gem className="w-10 h-10 mx-auto text-cyan-300" />
            <p className="font-black">💎 GAME CREDITS</p>
            <p className="text-xs text-white/70">Paket & harga mengikuti pengaturan admin. Pembayaran pakai PIN.</p>
            <BuyCreditsDialog visitorId={visitorId} onPurchased={changed} />
          </div>
        )}
        {visitorId && tab === "membership" && <MembershipCarousel visitorId={visitorId} />}
      </DialogContent>
    </Dialog>
  );
}
