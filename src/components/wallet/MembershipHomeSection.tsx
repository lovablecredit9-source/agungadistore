import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStorePremium, usePremiumBenefits } from "@/hooks/useStorePremium";
import { buildBenefits } from "@/components/premium/premiumBenefits";
import { GemMembershipHomeCard, StorePremiumHomeCard } from "./StorePremiumHomeCard";
import type { GemSub } from "./membershipHomeState";

interface Props { visitorId: string; onGo: (tab: string) => void }

/** Two independent memberships near the balance: Gem/Streak and Premium Toko. */
export default function MembershipHomeSection({ visitorId, onGo }: Props) {
  const premium = useStorePremium(visitorId);
  const { cfg } = usePremiumBenefits();
  const benefitCount = buildBenefits(cfg, true).filter((b) => b.status === "active").length;
  const [gemSub, setGemSub] = useState<GemSub | null>(null);
  const [gemLoaded, setGemLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());

  const loadGem = useCallback(async () => {
    // Same query as the existing DailyStreak membership check.
    const { data } = await supabase
      .from("streak_subscriptions" as never)
      .select("plan_name, expires_at")
      .eq("visitor_id", visitorId)
      .eq("is_active", true)
      .gte("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setGemSub((data as GemSub | null) ?? null);
    setGemLoaded(true);
  }, [visitorId]);

  useEffect(() => {
    void loadGem();
    const on = () => void loadGem();
    const onVis = () => { if (document.visibilityState === "visible") void loadGem(); };
    window.addEventListener("balance-updated", on);
    window.addEventListener("streak-updated", on);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("balance-updated", on);
      window.removeEventListener("streak-updated", on);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [loadGem]);

  // Minute tick for the remaining-time text; expiry also hides the card before the next backend refresh.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const openPremium = () => window.dispatchEvent(new CustomEvent("open-store-profile", { detail: { tab: "premium" } }));

  return (
    <section aria-label="Membership saya" className="grid gap-2 sm:grid-cols-2">
      <StorePremiumHomeCard premium={premium} activeBenefitCount={benefitCount} onOpen={openPremium} now={now} />
      <GemMembershipHomeCard sub={gemSub} loaded={gemLoaded} onOpen={() => onGo("streakshop")} now={now} />
    </section>
  );
}
