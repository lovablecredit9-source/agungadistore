import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getWIBDate(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().split("T")[0];
}

type Rarity = "common" | "rare" | "epic" | "legendary";

interface RewardTemplate {
  type: string;
  value: number;
  label: string;
  emoji: string;
  rarity: Rarity;
  message: string;
}

const COMMON: RewardTemplate[] = [
  { type: "streak_coins", value: 20, label: "+20 Streak Coins", emoji: "🪙", rarity: "common", message: "Tetap semangat!" },
  { type: "streak_coins", value: 35, label: "+35 Streak Coins", emoji: "✨", rarity: "common", message: "Lumayan buat tabungan." },
  { type: "bonus_points", value: 10, label: "+10 Poin Bonus", emoji: "💫", rarity: "common", message: "Streak power up!" },
];
const RARE: RewardTemplate[] = [
  { type: "streak_coins", value: 80, label: "+80 Streak Coins", emoji: "🎁", rarity: "rare", message: "Lumayan langka!" },
  { type: "game_credit", value: 5, label: "+5 Game Credit", emoji: "🎮", rarity: "rare", message: "Main game lagi!" },
  { type: "bonus_points", value: 50, label: "+50 Poin Bonus", emoji: "💝", rarity: "rare", message: "Boost streak kamu!" },
];
const EPIC: RewardTemplate[] = [
  { type: "streak_coins", value: 200, label: "+200 Streak Coins", emoji: "💎", rarity: "epic", message: "EPIC reward!" },
  { type: "game_credit", value: 15, label: "+15 Game Credit", emoji: "⚡", rarity: "epic", message: "Game on!" },
  { type: "freeze_token", value: 1, label: "🛡️ Streak Freeze", emoji: "🛡️", rarity: "epic", message: "Lindungi streak kamu!" },
];
const LEGENDARY: RewardTemplate[] = [
  { type: "streak_coins", value: 500, label: "+500 Streak Coins LEGENDARY", emoji: "👑", rarity: "legendary", message: "Tersentuh Dewi Fortuna!" },
  { type: "game_credit", value: 50, label: "+50 Game Credit LEGENDARY", emoji: "🌟", rarity: "legendary", message: "Hadiah ultra langka!" },
];

function rollReward(): RewardTemplate {
  const r = Math.random() * 100;
  if (r < 2) return LEGENDARY[Math.floor(Math.random() * LEGENDARY.length)];
  if (r < 12) return EPIC[Math.floor(Math.random() * EPIC.length)];
  if (r < 35) return RARE[Math.floor(Math.random() * RARE.length)];
  return COMMON[Math.floor(Math.random() * COMMON.length)];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId } = await req.json();
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = getWIBDate();

    // Check if already opened today
    const { data: existing } = await admin
      .from("mystery_box_claims")
      .select("*")
      .eq("visitor_id", visitorId)
      .eq("claim_date", today)
      .maybeSingle();

    if (existing) {
      return Response.json({ alreadyOpened: true, reward: existing }, { headers: corsHeaders });
    }

    const reward = rollReward();

    // Apply reward
    const { data: streak } = await admin
      .from("daily_streaks")
      .select("*")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    if (streak) {
      const updates: Record<string, unknown> = {};
      if (reward.type === "streak_coins") {
        updates.streak_coins = (streak.streak_coins || 0) + reward.value;
      }
      if (reward.type === "bonus_points") {
        updates.total_bonus_points = (streak.total_bonus_points || 0) + reward.value;
      }
      if (reward.type === "freeze_token") {
        updates.freeze_count = (streak.freeze_count || 0) + reward.value;
      }
      if (Object.keys(updates).length > 0) {
        await admin.from("daily_streaks").update(updates).eq("id", streak.id);
      }
    }

    if (reward.type === "game_credit") {
      // Add to game credits via balance_transactions style — using game-credits table
      // We'll log it as a credit grant in balance_transactions for visibility
      await admin.from("balance_transactions").insert({
        visitor_id: visitorId,
        amount: 0,
        type: "game_credit_reward",
        description: `Mystery Box: ${reward.label}`,
      });
    }

    // Log claim
    await admin.from("mystery_box_claims").insert({
      visitor_id: visitorId,
      claim_date: today,
      reward_type: reward.type,
      reward_value: reward.value,
      reward_label: reward.label,
      rarity: reward.rarity,
    });

    // Notification
    await admin.from("notifications").insert({
      visitor_id: visitorId,
      title: `🎁 Mystery Box ${reward.rarity.toUpperCase()}!`,
      message: `Kamu mendapat ${reward.label}`,
      type: "mystery_box",
    }).select();

    return Response.json({ success: true, reward }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
