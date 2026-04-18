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
    let rewardSummary = "Reward sudah ditambahkan!";

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
      rewardSummary = `Voucher diskon Rp${Number(item.reward_value).toLocaleString("id-ID")}`;
    } else if (item.reward_type === "game_credit") {
      // DIRECTLY ADD GAME CREDITS to user_game_credits
      const { data: gc } = await admin
        .from("user_game_credits")
        .select("id, credits")
        .eq("visitor_id", visitorId)
        .maybeSingle();

      if (gc) {
        const { error: updErr } = await admin
          .from("user_game_credits")
          .update({ credits: (gc.credits || 0) + item.reward_value })
          .eq("id", gc.id);
        if (updErr) {
          return Response.json({ error: `Gagal menambah credit: ${updErr.message}` }, { status: 500, headers: corsHeaders });
        }
      } else {
        const { error: insErr } = await admin
          .from("user_game_credits")
          .insert({ visitor_id: visitorId, credits: item.reward_value });
        if (insErr) {
          return Response.json({ error: `Gagal membuat credit: ${insErr.message}` }, { status: 500, headers: corsHeaders });
        }
      }

      await admin.from("balance_transactions").insert({
        visitor_id: visitorId,
        amount: 0,
        type: "game_credit_reward",
        description: `Streak Shop: ${item.name} (+${item.reward_value} credit)`,
      });
      rewardSummary = `+${item.reward_value} Credit Game ditambahkan!`;
    } else if (item.reward_type === "music_storage") {
      // DIRECTLY ADD MUSIC STORAGE to user_music_storage (no voucher needed)
      rewardCode = generateCode("MUS");
      const { error: insErr } = await admin.from("user_music_storage").insert({
        visitor_id: visitorId,
        storage_mb: item.reward_value,
        voucher_code: rewardCode,
        expires_at: null,
      });
      if (insErr) {
        return Response.json({ error: `Gagal menambah storage: ${insErr.message}` }, { status: 500, headers: corsHeaders });
      }
      rewardSummary = `+${item.reward_value}MB storage musik ditambahkan!`;
      rewardCode = null; // don't show code to user, it's already applied
    } else if (item.reward_type === "streak_freeze") {
      const { error: updErr } = await admin.from("daily_streaks").update({
        freeze_count: (streak.freeze_count || 0) + item.reward_value,
      }).eq("id", streak.id);
      if (updErr) {
        return Response.json({ error: `Gagal menambah freeze: ${updErr.message}` }, { status: 500, headers: corsHeaders });
      }
      rewardSummary = `+${item.reward_value} Streak Freeze ditambahkan!`;
    } else if (
      item.reward_type === "extra_life" ||
      item.reward_type === "auto_hint" ||
      item.reward_type === "time_freeze" ||
      item.reward_type === "double_xp"
    ) {
      // Pastikan row ada
      const { data: pu } = await admin
        .from("user_power_ups")
        .select("*")
        .eq("visitor_id", visitorId)
        .maybeSingle();

      const updates: Record<string, unknown> = {};
      if (item.reward_type === "double_xp") {
        const baseMs = pu?.double_xp_until && new Date(pu.double_xp_until).getTime() > Date.now()
          ? new Date(pu.double_xp_until).getTime()
          : Date.now();
        updates.double_xp_until = new Date(baseMs + item.reward_value * 3600 * 1000).toISOString();
        rewardSummary = `Double XP aktif ${item.reward_value} jam!`;
      } else {
        const cur = (pu?.[item.reward_type] as number) || 0;
        updates[item.reward_type] = cur + item.reward_value;
        const labelMap: Record<string, string> = {
          extra_life: "Nyawa Ekstra",
          auto_hint: "Hint Otomatis",
          time_freeze: "Time Freeze",
        };
        rewardSummary = `+${item.reward_value} ${labelMap[item.reward_type]} ditambahkan!`;
      }

      if (pu) {
        const { error: upErr } = await admin
          .from("user_power_ups")
          .update(updates)
          .eq("visitor_id", visitorId);
        if (upErr) {
          return Response.json({ error: `Gagal update power-up: ${upErr.message}` }, { status: 500, headers: corsHeaders });
        }
      } else {
        const { error: insErr } = await admin
          .from("user_power_ups")
          .insert({ visitor_id: visitorId, ...updates });
        if (insErr) {
          return Response.json({ error: `Gagal buat power-up: ${insErr.message}` }, { status: 500, headers: corsHeaders });
        }
      }
    }

    // Deduct coins
    const { error: deductErr } = await admin.from("daily_streaks").update({
      streak_coins: coins - item.cost_coins,
    }).eq("id", streak.id);
    if (deductErr) {
      return Response.json({ error: `Gagal memotong coins: ${deductErr.message}` }, { status: 500, headers: corsHeaders });
    }

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
      message: rewardCode ? `Kode: ${rewardCode}` : rewardSummary,
      type: "streak_shop",
    });

    return Response.json({ success: true, rewardCode, rewardSummary, item }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
