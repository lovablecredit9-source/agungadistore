import { useEffect, useState } from "react";
import { checkVisitorPremium } from "@/hooks/useStorePremium";
import PremiumBadge from "./PremiumBadge";

const cache = new Map<string, boolean>();

export default function PremiumBadgeAsync({ visitorId, size = "xs" }: { visitorId: string; size?: "xs" | "sm" | "md" }) {
  const [isPremium, setIsPremium] = useState<boolean>(cache.get(visitorId) ?? false);

  useEffect(() => {
    let cancelled = false;
    const load = (force = false) => {
      if (!force && cache.has(visitorId)) {
        setIsPremium(cache.get(visitorId)!);
        return;
      }
      checkVisitorPremium(visitorId).then((r) => {
        if (cancelled) return;
        cache.set(visitorId, r);
        setIsPremium(r);
      });
    };
    load();

    const refresh = () => load(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("refresh-store-premium", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    const interval = window.setInterval(refresh, 30000);
    return () => {
      if (cancelled) return;
      cancelled = true;
      window.removeEventListener("refresh-store-premium", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(interval);
    };
  }, [visitorId]);

  if (!isPremium) return null;
  return <PremiumBadge size={size} />;
}
