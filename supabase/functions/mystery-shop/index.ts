import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function weekKeyWIB() {
  const wib = new Date(Date.now() + 7 * 3600_000);
  const y = wib.getUTCFullYear();
  const start = Date.UTC(y, 0, 1);
  const week = Math.floor((wib.getTime() - start) / (7 * 86400_000)) + 1;
  return `${y}-W${String(week).padStart(2, "0")}`;
}
function todayWIB() {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

// Katalog item Mystery Shop (harga dasar; diskon di-roll 0-90%)
const CATALOG = [
  { code: "coin_50k", label: "50.000 Koin Streak", reward_type: "coins", reward_value: 50000, gems: 400, coins: 0 },
  { code: "coin_150k", label: "150.000 Koin Streak", reward_type: "coins", reward_value: 150000, gems: 1000, coins: 0 },
  { code: "coin_400k", label: "400.000 Koin Streak", reward_type: "coins", reward_value: 400000, gems: 2400, coins: 0 },
  { code: "tick_n10", label: "10 Tiket Spin Normal", reward_type: "ticket_normal", reward_value: 10, gems: 450, coins: 9000 },
  { code: "tick_n25", label: "25 Tiket Spin Normal", reward_type: "ticket_normal", reward_value: 25, gems: 1000, coins: 20000 },
  { code: "tick_n60", label: "60 Tiket Spin Normal", reward_type: "ticket_normal", reward_value: 60, gems: 2200, coins: 45000 },
  { code: "tick_p5", label: "5 Tiket Spin Premium", reward_type: "ticket_premium", reward_value: 5, gems: 480, coins: 12000 },
  { code: "tick_p15", label: "15 Tiket Spin Premium", reward_type: "ticket_premium", reward_value: 15, gems: 1350, coins: 32000 },
  { code: "tick_p40", label: "40 Tiket Spin Premium", reward_type: "ticket_premium", reward_value: 40, gems: 3200, coins: 78000 },
  { code: "draw_10", label: "10 Tiket Lucky Draw", reward_type: "lucky_draw", reward_value: 10, gems: 300, coins: 7000 },
  { code: "draw_30", label: "30 Tiket Lucky Draw", reward_type: "lucky_draw", reward_value: 30, gems: 800, coins: 18000 },
  { code: "draw_80", label: "80 Tiket Lucky Draw", reward_type: "lucky_draw", reward_value: 80, gems: 1900, coins: 42000 },
  { code: "freeze_3", label: "3 Streak Freeze", reward_type: "freeze", reward_value: 3, gems: 350, coins: 8000 },
  { code: "freeze_10", label: "10 Streak Freeze", reward_type: "freeze", reward_value: 10, gems: 950, coins: 22000 },
  { code: "hint_10", label: "10 Hint Otomatis", reward_type: "auto_hint", reward_value: 10, gems: 250, coins: 6000 },
  { code: "hint_50", label: "50 Hint Otomatis", reward_type: "auto_hint", reward_value: 50, gems: 950, coins: 21000 },
  { code: "life_10", label: "10 Nyawa Ekstra", reward_type: "extra_life", reward_value: 10, gems: 300, coins: 7000 },
  { code: "life_40", label: "40 Nyawa Ekstra", reward_type: "extra_life", reward_value: 40, gems: 1000, coins: 24000 },
  { code: "tfrz_15", label: "15 Time Freeze", reward_type: "time_freeze", reward_value: 15, gems: 700, coins: 16000 },
  { code: "cred_50", label: "50 Kredit Game", reward_type: "game_credits", reward_value: 50, gems: 500, coins: 12000 },
  { code: "cred_200", label: "200 Kredit Game", reward_type: "game_credits", reward_value: 200, gems: 1600, coins: 38000 },
  { code: "luck_6", label: "Jam Hoki 6 Jam", reward_type: "server_luck", reward_value: 6, gems: 550, coins: 13000 },
  { code: "luck_24", label: "Jam Hoki 24 Jam", reward_type: "server_luck", reward_value: 24, gems: 1500, coins: 34000 },
  { code: "gem_300", label: "300 Gem Bonus", reward_type: "gems", reward_value: 300, gems: 0, coins: 30000 },
  { code: "gem_1000", label: "1.000 Gem Bonus", reward_type: "gems", reward_value: 1000, gems: 0, coins: 95000 },
  { code: "anon_3", label: "Voucher Anon Chat 3 Hari", reward_type: "anon_voucher", reward_value: 3, gems: 600, coins: 15000 },
  { code: "anon_10", label: "Voucher Anon Chat 10 Hari", reward_type: "anon_voucher", reward_value: 10, gems: 1700, coins: 40000 },
  { code: "vdisc_30", label: "Voucher Royale 30%", reward_type: "luck_voucher", reward_value: 30, gems: 500, coins: 12000 },
  { code: "vdisc_70", label: "Voucher Royale 70%", reward_type: "luck_voucher", reward_value: 70, gems: 1400, coins: 33000 },
];


const DISCOUNT_POOL = [0, 5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70, 80, 90];

function rollDiscount() {
  // Diskon besar makin langka
  const r = Math.random() * 100;
  if (r < 35) return DISCOUNT_POOL[Math.floor(Math.random() * 4)];        // 0-15%
  if (r < 70) return DISCOUNT_POOL[4 + Math.floor(Math.random() * 4)];    // 20-35%
  if (r < 90) return DISCOUNT_POOL[8 + Math.floor(Math.random() * 3)];    // 40-60%
  if (r < 98) return 70;
  if (r < 99.6) return 80;
  return 90;
}

async function getStreak(admin: any, visitorId: string) {
  let { data } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
  if (!data) {
    const { data: ins } = await admin.from("daily_streaks").insert({ visitor_id: visitorId }).select().single();
    data = ins;
  }
  return data;
}

async function addTicket(admin: any, visitorId: string, type: "normal" | "premium", amount: number) {
  const { data: ubId } = await admin.rpc("get_active_user_balance_id", { p_visitor_id: visitorId });
  const key = ubId ? `ub:${ubId}` : `v:${visitorId}`;
  const { data: row } = await admin.from("luck_spin_tickets").select("*")
    .eq("account_key", key).eq("ticket_type", type).maybeSingle();
  if (row) {
    await admin.from("luck_spin_tickets").update({
      balance: (row.balance || 0) + amount,
      total_purchased: (row.total_purchased || 0) + amount,
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
  } else {
    await admin.from("luck_spin_tickets").insert({
      account_key: key, visitor_id: visitorId, user_balance_id: ubId || null,
      ticket_type: type, balance: amount, total_purchased: amount,
    });
  }
}

async function applyReward(admin: any, visitorId: string, type: string, value: number, label: string) {
  if (type === "gems") {
    await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: value });
    await admin.from("gem_transactions").insert({ visitor_id: visitorId, amount: value, type: "reward", description: `Mystery Shop: ${label}` });
  } else if (type === "coins") {
    const s = await getStreak(admin, visitorId);
    await admin.from("daily_streaks").update({ streak_coins: (s?.streak_coins || 0) + value }).eq("visitor_id", visitorId);
  } else if (type === "freeze") {
    const s = await getStreak(admin, visitorId);
    await admin.from("daily_streaks").update({ freeze_count: (s?.freeze_count || 0) + value }).eq("visitor_id", visitorId);
  } else if (type === "ticket_normal") {
    await addTicket(admin, visitorId, "normal", value);
  } else if (type === "ticket_premium") {
    await addTicket(admin, visitorId, "premium", value);
  } else if (type === "lucky_draw") {
    const { data: row } = await admin.from("lucky_draw_tickets").select("*").eq("visitor_id", visitorId).maybeSingle();
    if (row) {
      await admin.from("lucky_draw_tickets").update({
        ticket_count: (row.ticket_count || 0) + value,
        total_purchased: (row.total_purchased || 0) + value,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
    } else {
      await admin.from("lucky_draw_tickets").insert({ visitor_id: visitorId, ticket_count: value, total_purchased: value });
    }
  } else if (type === "auto_hint" || type === "extra_life" || type === "time_freeze") {
    const { data: row } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
    const next = Number(row?.[type] || 0) + value;
    if (row) await admin.from("user_power_ups").update({ [type]: next }).eq("visitor_id", visitorId);
    else await admin.from("user_power_ups").insert({ visitor_id: visitorId, [type]: value });
  } else if (type === "game_credits") {
    await admin.rpc("add_account_credits", { p_visitor_id: visitorId, p_amount: value });
  } else if (type === "server_luck") {
    const { data: row } = await admin.from("server_luck_boosters").select("*").eq("visitor_id", visitorId).maybeSingle();
    const base = row?.active_until && new Date(row.active_until).getTime() > Date.now() ? new Date(row.active_until).getTime() : Date.now();
    const activeUntil = new Date(base + value * 3600_000).toISOString();
    if (row) await admin.from("server_luck_boosters").update({ active_tier: Math.max(2, row.active_tier || 1), active_until: activeUntil, highest_tier_owned: Math.max(2, row.highest_tier_owned || 1), updated_at: new Date().toISOString() }).eq("id", row.id);
    else await admin.from("server_luck_boosters").insert({ visitor_id: visitorId, active_tier: 2, active_until: activeUntil, highest_tier_owned: 2 });
  } else if (type === "anon_voucher") {
    const code = `ANON-${crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    await admin.from("anon_premium_vouchers").insert({ code, days: value, max_uses: 1, note: "Mystery Shop" });
  } else if (type === "luck_voucher") {
    const { data: ubId } = await admin.rpc("get_active_user_balance_id", { p_visitor_id: visitorId });
    await admin.from("luck_discount_vouchers").insert({ visitor_id: visitorId, user_balance_id: ubId || null, name: `Voucher Mystery ${value}%`, discount_percent: value, expires_at: new Date(Date.now() + 12 * 3600_000).toISOString(), source: "mystery_shop" });
  }

}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const { action, visitorId } = body as any;
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const week = weekKeyWIB();

    async function ensureRolls(force = false) {
      if (force) await admin.from("mystery_shop_rolls").delete().eq("visitor_id", visitorId).eq("week_key", week);
      const { data: existing } = await admin.from("mystery_shop_rolls").select("*")
        .eq("visitor_id", visitorId).eq("week_key", week).order("slot_index");
      if (existing && existing.length) return existing;
      const shuffled = [...CATALOG].sort(() => Math.random() - 0.5).slice(0, 12);
      const rows = shuffled.map((it, i) => ({
        visitor_id: visitorId,
        week_key: week,
        slot_index: i,
        item_code: it.code,
        item_label: it.label,
        reward_type: it.reward_type,
        reward_value: it.reward_value,
        base_price_gems: it.gems,
        base_price_coins: it.coins,
        discount_percent: rollDiscount(),
      }));
      const { data: ins } = await admin.from("mystery_shop_rolls").insert(rows).select().order("slot_index");
      return ins || [];
    }

    if (action === "list" || action === "reroll") {
      if (action === "reroll") {
        const REROLL_COST = 500;
        const streak = await getStreak(admin, visitorId);
        if ((Number(streak?.streak_coins) || 0) < REROLL_COST) return Response.json({ error: `Koin tidak cukup. Butuh ${REROLL_COST} 🪙` }, { headers: corsHeaders });
        await admin.from("daily_streaks").update({ streak_coins: Number(streak.streak_coins) - REROLL_COST }).eq("visitor_id", visitorId);
      }
      const rolls = await ensureRolls(action === "reroll");
      const [{ data: gems }, streak] = await Promise.all([
        admin.rpc("get_account_gems", { p_visitor_id: visitorId }),
        getStreak(admin, visitorId),
      ]);
      const wib = new Date(Date.now() + 7 * 3600_000);
      const daysToMonday = (8 - (wib.getUTCDay() || 7)) % 7 || 7;
      const resetAt = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() + daysToMonday) - 7 * 3600_000).toISOString();
      return Response.json({
        success: true,
        week,
        rolls,
        gems: Number(gems) || 0,
        coins: streak?.streak_coins || 0,
        rerollCost: 500,
        resetAt,
      }, { headers: corsHeaders });
    }

    if (action === "buy") {
      const rollId = String((body as any).rollId || "");
      const payWith = String((body as any).payWith || "gem");
      const { data: roll } = await admin.from("mystery_shop_rolls").select("*")
        .eq("id", rollId).eq("visitor_id", visitorId).maybeSingle();
      if (!roll) return Response.json({ error: "Item tidak ditemukan" }, { headers: corsHeaders });
      if (roll.week_key !== week) return Response.json({ error: "Penawaran sudah kedaluwarsa" }, { headers: corsHeaders });
      if (roll.purchased) return Response.json({ error: "Item sudah dibeli minggu ini" }, { headers: corsHeaders });

      const mult = (100 - roll.discount_percent) / 100;
      const priceGems = Math.max(0, Math.round(roll.base_price_gems * mult));
      const priceCoins = Math.max(0, Math.round(roll.base_price_coins * mult));

      if (payWith === "coin") {
        if (!roll.base_price_coins) return Response.json({ error: "Item ini tidak bisa dibeli dengan koin" }, { headers: corsHeaders });
        const s = await getStreak(admin, visitorId);
        if ((s?.streak_coins || 0) < priceCoins) return Response.json({ error: `Koin tidak cukup. Butuh ${priceCoins.toLocaleString("id-ID")} 🪙` }, { headers: corsHeaders });
        await admin.from("daily_streaks").update({ streak_coins: s.streak_coins - priceCoins }).eq("visitor_id", visitorId);
      } else {
        if (!roll.base_price_gems) return Response.json({ error: "Item ini tidak bisa dibeli dengan gem" }, { headers: corsHeaders });
        const { data: g } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
        if ((Number(g) || 0) < priceGems) return Response.json({ error: `Gem tidak cukup. Butuh ${priceGems.toLocaleString("id-ID")} 💎` }, { headers: corsHeaders });
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -priceGems });
        await admin.from("gem_transactions").insert({ visitor_id: visitorId, amount: -priceGems, type: "shop", description: `Mystery Shop: ${roll.item_label}` });
      }

      await applyReward(admin, visitorId, roll.reward_type, Number(roll.reward_value), roll.item_label);
      await admin.from("mystery_shop_rolls").update({ purchased: true, purchased_at: new Date().toISOString() }).eq("id", roll.id);

      return Response.json({
        success: true,
        message: `🎁 ${roll.item_label} berhasil dibeli (diskon ${roll.discount_percent}%)!`,
      }, { headers: corsHeaders });
    }

    // Reset diskon kilat harian pakai gem (tanpa nunggu jam 00:00)
    if (action === "reset_flash_daily") {
      const COST = 500;
      const { data: g } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      if ((Number(g) || 0) < COST) return Response.json({ error: `Gem tidak cukup. Butuh ${COST} 💎` }, { headers: corsHeaders });
      const today = todayWIB();
      const { count } = await admin.from("flash_deal_redemptions")
        .select("*", { count: "exact", head: true })
        .eq("visitor_id", visitorId).eq("redemption_date", today);
      if (!count) return Response.json({ error: "Belum ada diskon kilat yang kamu klaim hari ini" }, { headers: corsHeaders });
      await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -COST });
      await admin.from("gem_transactions").insert({ visitor_id: visitorId, amount: -COST, type: "shop", description: "Reset Diskon Kilat Harian" });
      await admin.from("flash_deal_redemptions").delete().eq("visitor_id", visitorId).eq("redemption_date", today);
      return Response.json({ success: true, message: `♻️ Diskon kilat harian direset! (${count} slot dibuka lagi)` }, { headers: corsHeaders });
    }

    if (action === "flash_status") {
      const today = todayWIB();
      const { count } = await admin.from("flash_deal_redemptions")
        .select("*", { count: "exact", head: true })
        .eq("visitor_id", visitorId).eq("redemption_date", today);
      return Response.json({ success: true, usedToday: count || 0, resetCost: 500 }, { headers: corsHeaders });
    }

    return Response.json({ error: "Action tidak valid" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
