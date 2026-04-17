import { supabase } from "@/integrations/supabase/client";

/**
 * Track progress on daily missions.
 * Fire-and-forget; never throws to caller.
 */
export async function trackDailyMission(
  visitorId: string | null | undefined,
  eventType: "game_play" | "game_win" | "streak_claim" | "mystery_box" | "game_points",
  increment = 1,
) {
  if (!visitorId) return;
  try {
    await supabase.functions.invoke("check-daily-challenge", {
      body: { visitorId, eventType, increment },
    });
  } catch {
    // silent
  }
}
