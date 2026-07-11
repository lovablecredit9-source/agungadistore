import { supabase } from "@/integrations/supabase/client";

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
  | "music_listen";

/**
 * Track progress on daily AND weekly missions.
 * Fire-and-forget; never throws to caller.
 */
export async function trackDailyMission(
  visitorId: string | null | undefined,
  eventType: MissionEvent,
  increment = 1,
) {
  if (!visitorId) return;
  // Daily challenge
  try {
    await supabase.functions.invoke("check-daily-challenge", {
      body: { visitorId, eventType, increment },
    });
  } catch {
    // silent
  }
  // Weekly quest (best-effort, don't await failures)
  try {
    await supabase.functions.invoke("weekly-quest", {
      body: { action: "track", visitorId, eventType, increment },
    });
  } catch {
    // silent
  }
}
