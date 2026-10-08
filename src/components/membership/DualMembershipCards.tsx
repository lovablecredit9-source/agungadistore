import { useEffect, useState } from "react";
import { Crown, Gem, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePremiumBenefits, useStorePremium } from "@/hooks/useStorePremium";
import { buildBenefits } from "@/components/premium/premiumBenefits";
import { Button } from "@/components/ui/button";

interface GemPlan {
  id: string; name: string; duration_days: number; price_idr: number | null; price_gems: number | null; price_coins: number | null;
  bonus_gems: number | null; bonus_daily_gems: number | null; bonus_streak_coins: number | null; daily_reward_coins: number | null; bonus_freeze_count: number | null;
}
interface StorePlan { id: string; name: string; duration_days: number; price: number; description: string | null }

const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");

function gemPrice(p: GemPlan) {
  if (p.price_idr) return rp(p.price_idr);
  if (p.price_gems) return `${p.price_gems.toLocaleString("id-ID")} 💎`;
  if (p.price_coins) return `${p.price_coins.toLocaleString("id-ID")} 🪙`;
  return "-";
}

function gemPerks(p: GemPlan) {
  const out: string[] = [];
  if (p.bonus_daily_gems) out.push(`${p.bonus_daily_gems} 💎 per hari`);
  if (p.bonus_gems) out.push(`Bonus ${p.bonus_gems.toLocaleString("id-ID")} 💎`);
  if (p.daily_reward_coins) out.push(`${p.daily_reward_coins.toLocaleString("id-ID")} 🪙 per hari`);
  if (p.bonus_streak_coins) out.push(`Bonus ${p.bonus_streak_coins.toLocaleString("id-ID")} 🪙`);
  if (p.bonus_freeze_count) out.push(`${p.bonus_freeze_count}× Streak Freeze`);
  return out;
}

interface Props { visitorId: string | null; onOpenGem: () => void }

/** Two separate real memberships side by side: Gem (streak_membership_plans) and Premium Toko (store_premium_plans). */
export default function DualMembershipCards({ visitorId, onOpenGem }: Props) {
  const [gemPlans, setGemPlans] = useState<GemPlan[] | null>(null);
  const [storePlans, setStorePlans] = useState<StorePlan[] | null>(null);
  const premium = useStorePremium(visitorId);
  const { cfg } = usePremiumBenefits();
  const activeBenefits = buildBenefits(cfg, true).filter((b) => b.status === "active");

  useEffect(() => {
    supabase.from("streak_membership_plans").select("*").eq("category", "gem").eq("is_active", true).order("sort_order")
      .then(({ data }) => setGemPlans((data as unknown as GemPlan[]) || []));
    supabase.from("store_premium_plans").select("id,name,duration_days,price,description").eq("is_active", true).order("sort_order")
      .then(({ data }) => setStorePlans((data as StorePlan[]) || []));
  }, []);

  const loading = <div className="grid place-items-center py-6"><Loader2 className="h-5 w-5 animate-spin opacity-60" /></div>;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <section className="relative overflow-hidden rounded-2xl border border-cyan-400/40 bg-gradient-to-br from-cyan-500/15 via-blue-600/10 to-violet-600/15 p-4">
        <header className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-primary-foreground shadow-lg"><Gem className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h3 className="text-sm font-black tracking-wider text-cyan-100">GEM MEMBERSHIP</h3>
            <p className="text-[11px] text-foreground/60">Bonus gem & koin streak</p>
          </div>
        </header>
        {gemPlans === null ? loading : gemPlans.length === 0 ? (
          <p className="mt-3 text-xs text-foreground/60">Belum ada paket aktif.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {gemPlans.map((p) => (
              <li key={p.id} className="rounded-xl border border-cyan-300/20 bg-background/30 p-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] font-black">{p.name}</span>
                  <span className="shrink-0 text-[12px] font-black text-cyan-200">{gemPrice(p)}<span className="text-[10px] font-semibold text-foreground/50"> / {p.duration_days} hari</span></span>
                </div>
                {gemPerks(p).length > 0 && <p className="mt-1 text-[10px] text-foreground/70">{gemPerks(p).join(" · ")}</p>}
              </li>
            ))}
          </ul>
        )}
        <Button onClick={onOpenGem} className="mt-3 h-10 w-full bg-gradient-to-r from-cyan-500 to-blue-600 font-black text-primary-foreground">Beli Gem Membership</Button>
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-amber-400/50 bg-gradient-to-br from-amber-400/20 via-yellow-500/10 to-orange-500/15 p-4">
        <header className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 text-primary-foreground shadow-lg"><Crown className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black tracking-wider text-amber-100">PREMIUM TOKO</h3>
            <p className="text-[11px] text-foreground/60">Member VIP Agung Adi Store</p>
          </div>
          {premium.isPremium && <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[9px] font-black text-amber-950">AKTIF · {premium.daysLeft} hari</span>}
        </header>
        {activeBenefits.length > 0 && (
          <ul className="mt-3 space-y-1">
            {activeBenefits.map((b) => <li key={b.key} className="text-[11px] text-foreground/80">{b.icon} {b.name}</li>)}
          </ul>
        )}
        {storePlans === null ? loading : storePlans.length === 0 ? (
          <p className="mt-3 text-xs text-foreground/60">Belum ada paket aktif.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {storePlans.map((p) => (
              <span key={p.id} className="rounded-lg border border-amber-300/30 bg-background/30 px-2 py-1 text-[11px] font-bold">
                {p.name} · <span className="text-amber-200">{rp(p.price)}</span><span className="text-foreground/50"> / {p.duration_days} hari</span>
              </span>
            ))}
          </div>
        )}
        <Button
          onClick={() => window.dispatchEvent(new CustomEvent("open-store-profile", { detail: { tab: "premium" } }))}
          className="mt-3 h-10 w-full bg-gradient-to-r from-amber-300 via-yellow-400 to-orange-500 font-black text-amber-950"
        >
          {premium.isPremium ? "Kelola Premium" : "Aktifkan Premium"}
        </Button>
      </section>
    </div>
  );
}
