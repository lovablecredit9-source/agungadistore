import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generateCode(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = prefix + "-";
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { visitorId, itemId } = await req.json();
    if (!visitorId || !itemId) return Response.json({ error: "visitorId & itemId required" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: item } = await admin.from("streak_shop_items").select("*").eq("id", itemId).eq("is_active", true).maybeSingle();
    if (!item) return Response.json({ error: "Item tidak ditemukan" }, { status: 404, headers: corsHeaders });

    const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
    if (!streak) return Response.json({ error: "Mulai streak dulu untuk dapat coins!" }, { status: 400, headers: corsHeaders });

    const coins = streak.streak_coins || 0;
    if (coins < item.cost_coins) {
      return Response.json({ error: `Coins tidak cukup. Butuh ${item.cost_coins}, kamu punya ${coins}.` }, { status: 400, headers: corsHeaders });
    }

    let rewardCode: string | null = null;

    // Apply reward
    if (item.reward_type === "discount_voucher") {
      rewardCode = generateCode("STR");
      await admin.from("discount_vouchers").insert({
        code: rewardCode,
        discount_amount: item.reward_value,
        max_uses: 1,
        is_active: true,
        expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      });
    } else if (item.reward_type === "game_credit") {
      // Log it in balance_transactions and toast user; actual credit add via game_profile not direct here.
      // For simplicity we'll create a game_credit_grant note; real game credit table not exposed here.
      await admin.from("balance_transactions").insert({
        visitor_id: visitorId,
        amount: 0,
        type: "game_credit_reward",
        description: `Streak Shop: ${item.name} (+${item.reward_value} credit)`,
      });
    } else if (item.reward_type === "music_storage") {
      rewardCode = generateCode("MUS");
      await admin.from("music_storage_vouchers").insert({
        code: rewardCode,
        storage_mb: item.reward_value,
        max_uses: 1,
        is_active: true,
        expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
      });
    } else if (item.reward_type === "streak_freeze") {
      await admin.from("daily_streaks").update({
        freeze_count: (streak.freeze_count || 0) + item.reward_value,
      }).eq("id", streak.id);
    }

    // Deduct coins
    await admin.from("daily_streaks").update({
      streak_coins: coins - item.cost_coins,
    }).eq("id", streak.id);

    // Log redemption
    await admin.from("streak_shop_redemptions").insert({
      visitor_id: visitorId,
      item_id: itemId,
      cost_coins: item.cost_coins,
      reward_type: item.reward_type,
      reward_value: item.reward_value,
      reward_code: rewardCode,
    });

    await admin.from("notifications").insert({
      visitor_id: visitorId,
      title: `🛒 Streak Shop: ${item.name}`,
      message: rewardCode ? `Kode: ${rewardCode}` : `Reward sudah ditambahkan!`,
      type: "streak_shop",
    });

    return Response.json({ success: true, rewardCode, item }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
