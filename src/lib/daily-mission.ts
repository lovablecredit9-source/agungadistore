import { supabase } from "@/integrations/supabase/client";

const recentMissionEvents = new Map<string, number>();
const DUPLICATE_WINDOW_MS = 2_000;

export type MissionEvent =
  | "game_play"
  | "game_win"
  | "streak_claim"
  | "mystery_box"
  | "game_points"
  | "spin_wheel"
  | "gift_box"
  | "scratch_card"
  | "lucky_draw"
  | "music_listen"
  | "purchase";

/**
 * Track progress on daily AND weekly missions.
 * Best-effort; returns whether at least one quest bucket accepted progress.
 */
export async function trackDailyMission(
  visitorId: string | null | undefined,
  eventType: MissionEvent,
  increment = 1,
  options: { purchaseAmount?: number; songId?: string; listenSeconds?: number } = {},
): Promise<{ dailyUpdated: number; weeklyUpdated: number; monthlyUpdated: number; premiumUpdated: number }> {
  if (!visitorId) return { dailyUpdated: 0, weeklyUpdated: 0, monthlyUpdated: 0, premiumUpdated: 0 };

  const safeIncrement = Number.isFinite(increment) ? Math.max(1, Math.floor(increment)) : 1;
  const eventKey = `${visitorId}:${eventType}:${safeIncrement}:${options.songId || options.purchaseAmount || ""}`;
  const lastTrackedAt = recentMissionEvents.get(eventKey) || 0;
  const now = Date.now();
  if (now - lastTrackedAt < DUPLICATE_WINDOW_MS) return { dailyUpdated: 0, weeklyUpdated: 0, monthlyUpdated: 0, premiumUpdated: 0 };
  recentMissionEvents.set(eventKey, now);

  const dailyPayload = { visitorId, eventType, increment: safeIncrement, songId: options.songId, listenSeconds: options.listenSeconds };

  if (eventType === "music_listen") {
    const daily = await supabase.functions.invoke("check-daily-challenge", { body: dailyPayload });
    const accepted = !!(daily.data as any)?.musicAccepted;
    if (!accepted) return { dailyUpdated: Number((daily.data as any)?.updated || 0), weeklyUpdated: 0, monthlyUpdated: 0, premiumUpdated: 0 };
    const [weekly, monthly, premium] = await Promise.allSettled([
      supabase.functions.invoke("weekly-quest", {
        body: { action: "track", visitorId, eventType, increment: safeIncrement },
      }),
      supabase.functions.invoke("monthly-quest", {
        body: { action: "track", visitorId, eventType, increment: safeIncrement },
      }),
      supabase.functions.invoke("premium-quest", {
        body: { action: "track", visitorId, eventType, increment: safeIncrement, purchaseAmount: options.purchaseAmount || 0 },
      }),
    ]);
    const weeklyValue = weekly.status === "fulfilled" ? weekly.value : null;
    const monthlyValue = monthly.status === "fulfilled" ? monthly.value : null;
    const premiumValue = premium.status === "fulfilled" ? premium.value : null;
    return {
      dailyUpdated: Number((daily.data as any)?.updated || 0),
      weeklyUpdated: Number((weeklyValue?.data as any)?.updated || 0),
      monthlyUpdated: Number((monthlyValue?.data as any)?.updated || 0),
      premiumUpdated: Number((premiumValue?.data as any)?.updated || 0),
    };
  }

  const [daily, weekly, monthly, premium] = await Promise.allSettled([
    supabase.functions.invoke("check-daily-challenge", { body: dailyPayload }),
    supabase.functions.invoke("weekly-quest", {
      body: { action: "track", visitorId, eventType, increment: safeIncrement },
    }),
    supabase.functions.invoke("monthly-quest", {
      body: { action: "track", visitorId, eventType, increment: safeIncrement },
    }),
    supabase.functions.invoke("premium-quest", {
      body: { action: "track", visitorId, eventType, increment: safeIncrement, purchaseAmount: options.purchaseAmount || 0 },
    }),
  ]);

  const dailyValue = daily.status === "fulfilled" ? daily.value : null;
  const weeklyValue = weekly.status === "fulfilled" ? weekly.value : null;
  const monthlyValue = monthly.status === "fulfilled" ? monthly.value : null;
  const premiumValue = premium.status === "fulfilled" ? premium.value : null;

  return {
    dailyUpdated: Number((dailyValue?.data as any)?.updated || 0),
    weeklyUpdated: Number((weeklyValue?.data as any)?.updated || 0),
    monthlyUpdated: Number((monthlyValue?.data as any)?.updated || 0),
    premiumUpdated: Number((premiumValue?.data as any)?.updated || 0),
  };
}
