import { useEffect, useState } from "react";
import { checkVisitorPremium } from "@/hooks/useStorePremium";
import PremiumBadge from "./PremiumBadge";

const cache = new Map<string, boolean>();

export default function PremiumBadgeAsync({ visitorId, size = "xs" }: { visitorId: string; size?: "xs" | "sm" | "md" }) {
  const [isPremium, setIsPremium] = useState<boolean>(cache.get(visitorId) ?? false);

  useEffect(() => {
    let cancelled = false;
    if (cache.has(visitorId)) {
      setIsPremium(cache.get(visitorId)!);
      return;
    }
    checkVisitorPremium(visitorId).then((r) => {
      if (cancelled) return;
      cache.set(visitorId, r);
      setIsPremium(r);
    });
    return () => { cancelled = true; };
  }, [visitorId]);

  if (!isPremium) return null;
  return <PremiumBadge size={size} />;
}
