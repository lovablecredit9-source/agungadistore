// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function getWIBDateStr(): string {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return wib.toISOString().split("T")[0];
}

async function addSpinTicket(admin: any, visitorId: string, type: "normal" | "premium", amount: number) {
  const { data: ubId } = await admin.rpc("get_active_user_balance_id", { p_visitor_id: visitorId });
  const accountKey = ubId ? `ub:${ubId}` : `v:${visitorId}`;
  const { data: row } = await admin.from("luck_spin_tickets").select("*").eq("account_key", accountKey).eq("ticket_type", type).maybeSingle();
  if (row) await admin.from("luck_spin_tickets").update({ balance: Number(row.balance || 0) + amount, total_purchased: Number(row.total_purchased || 0) + amount, updated_at: new Date().toISOString() }).eq("id", row.id);
  else await admin.from("luck_spin_tickets").insert({ account_key: accountKey, visitor_id: visitorId, user_balance_id: ubId || null, ticket_type: type, balance: amount, total_purchased: amount });
}

async function addLuckyDrawTicket(admin: any, visitorId: string, amount: number) {
  const { data: row } = await admin.from("lucky_draw_tickets").select("*").eq("visitor_id", visitorId).maybeSingle();
  if (row) await admin.from("lucky_draw_tickets").update({ ticket_count: Number(row.ticket_count || 0) + amount, total_purchased: Number(row.total_purchased || 0) + amount, updated_at: new Date().toISOString() }).eq("id", row.id);
  else await admin.from("lucky_draw_tickets").insert({ visitor_id: visitorId, ticket_count: amount, total_purchased: amount });
}

async function addServerLuck(admin: any, visitorId: string, hours: number) {
  const { data: row } = await admin.from("server_luck_boosters").select("*").eq("visitor_id", visitorId).maybeSingle();
  const base = row?.active_until && new Date(row.active_until).getTime() > Date.now() ? new Date(row.active_until).getTime() : Date.now();
  const activeUntil = new Date(base + hours * 3600_000).toISOString();
  if (row) await admin.from("server_luck_boosters").update({ active_tier: Math.max(2, row.active_tier || 1), active_until: activeUntil, highest_tier_owned: Math.max(2, row.highest_tier_owned || 1), updated_at: new Date().toISOString() }).eq("id", row.id);
  else await admin.from("server_luck_boosters").insert({ visitor_id: visitorId, active_tier: 2, active_until: activeUntil, highest_tier_owned: 2 });
}

async function addPowerUps(admin: any, visitorId: string, add: { auto_hint?: number; extra_life?: number; time_freeze?: number; double_xp_hours?: number }) {
  const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
  const updates: any = {};
  if (add.auto_hint) updates.auto_hint = (pu?.auto_hint || 0) + add.auto_hint;
  if (add.extra_life) updates.extra_life = (pu?.extra_life || 0) + add.extra_life;
  if (add.time_freeze) updates.time_freeze = (pu?.time_freeze || 0) + add.time_freeze;
  if (add.double_xp_hours) {
    const base = pu?.double_xp_until && new Date(pu.double_xp_until).getTime() > Date.now() ? new Date(pu.double_xp_until).getTime() : Date.now();
    updates.double_xp_until = new Date(base + add.double_xp_hours * 3600_000).toISOString();
  }
  if (pu) await admin.from("user_power_ups").update(updates).eq("visitor_id", visitorId);
  else await admin.from("user_power_ups").insert({ visitor_id: visitorId, ...updates });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const action = body.action || url.searchParams.get("action");
    const visitorId = body.visitorId || url.searchParams.get("visitorId");

    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const today = getWIBDateStr();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "purchase") {
      const { dealId, paymentMethod } = body;
      const { data: deal } = await admin.from("streak_flash_deals").select("*").eq("id", dealId).eq("is_active", true).maybeSingle();
      if (!deal) return Response.json({ error: "Deal tidak ditemukan" }, { status: 404, headers: corsHeaders });

      const payMethod = paymentMethod === "gem" ? "gem" : "coin";
      const coinCost = Math.floor(deal.original_cost * (1 - deal.discount_pct / 100));
      const gemCost = deal.cost_gems || 0;
      const costPaid = payMethod === "gem" ? gemCost : coinCost;
      const costLabel = payMethod === "gem" ? `${gemCost} 💎` : `${coinCost} 🪙`;

      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).single();
      
      // Perform payment
      if (payMethod === "gem") {
        const { error: gemErr } = await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -gemCost });
        if (gemErr) return Response.json({ error: gemErr.message }, { status: 400, headers: corsHeaders });
        await admin.from("gem_transactions").insert({ visitor_id: visitorId, amount: -gemCost, type: "flash_deal", description: `Flash Deal: ${deal.name}`, reference_id: dealId });
      } else {
        if ((streak.streak_coins || 0) < coinCost) return Response.json({ error: "Koin kurang" }, { status: 400, headers: corsHeaders });
        await admin.from("daily_streaks").update({ streak_coins: streak.streak_coins - coinCost }).eq("id", streak.id);
      }

      let rewardSummary = "";
      // Unified Reward Logic
      if (deal.reward_type === "streak_freeze") {
        await admin.from("daily_streaks").update({ freeze_count: (streak.freeze_count || 0) + deal.reward_value }).eq("id", streak.id);
        rewardSummary = `+${deal.reward_value} Streak Freeze`;
      } else if (deal.reward_type === "double_xp") {
        await addPowerUps(admin, visitorId, { double_xp_hours: deal.reward_value });
        rewardSummary = `Double XP ${deal.reward_value} jam`;
      } else if (deal.reward_type === "mystery_bundle") {
        await addPowerUps(admin, visitorId, { auto_hint: 5, extra_life: 3 });
        rewardSummary = "+5 Hint, +3 Nyawa";
      } else if (deal.reward_type === "vip_pack") {
        await addPowerUps(admin, visitorId, { auto_hint: 10, extra_life: 5, time_freeze: 5, double_xp_hours: 12 });
        await admin.from("daily_streaks").update({ freeze_count: (streak.freeze_count || 0) + 2 }).eq("id", streak.id);
        rewardSummary = "VIP Pack: Power-ups Lengkap";
      } else if (deal.reward_type === "server_luck") {
        await addServerLuck(admin, visitorId, deal.reward_value);
        rewardSummary = `Jam Hoki ${deal.reward_value} jam`;
      } else if (deal.reward_type === "ticket_normal" || deal.reward_type === "ticket_premium") {
        await addSpinTicket(admin, visitorId, deal.reward_type === "ticket_premium" ? "premium" : "normal", deal.reward_value);
        rewardSummary = `+${deal.reward_value} Tiket Spin`;
      } else if (deal.reward_type === "lucky_draw_ticket") {
        await addLuckyDrawTicket(admin, visitorId, deal.reward_value);
        rewardSummary = `+${deal.reward_value} Tiket Lucky Draw`;
      } else if (deal.reward_type === "fire_pass_card") {
        const { data: season } = await admin.from("fire_pass_seasons").select("id").eq("is_active", true).order("created_at", { ascending: false }).limit(1).single();
        const { data: prog } = await admin.from("fire_pass_progress").select("id").eq("visitor_id", visitorId).eq("season_id", season.id).maybeSingle();
        if (prog) await admin.from("fire_pass_progress").update({ is_premium: true, premium_activated_at: new Date().toISOString() }).eq("id", prog.id);
        else await admin.from("fire_pass_progress").insert({ visitor_id: visitorId, season_id: season.id, is_premium: true, premium_activated_at: new Date().toISOString() });
        rewardSummary = "Fire Pass Premium Aktif";
      } else if (deal.reward_type === "fire_pass_pro") {
        const { data: season } = await admin.from("fire_pass_seasons").select("id").eq("is_active", true).order("created_at", { ascending: false }).limit(1).single();
        const { data: pr } = await admin.from("fire_pass_progress").select("id, pro_missions_until").eq("visitor_id", visitorId).eq("season_id", season.id).maybeSingle();
        const until = new Date((pr?.pro_missions_until && new Date(pr.pro_missions_until).getTime() > Date.now() ? new Date(pr.pro_missions_until).getTime() : Date.now()) + (Number(deal.reward_value) || 30) * 86400_000).toISOString();
        if (pr) await admin.from("fire_pass_progress").update({ pro_missions_until: until }).eq("id", pr.id);
        else await admin.from("fire_pass_progress").insert({ visitor_id: visitorId, season_id: season.id, pro_missions_until: until });
        rewardSummary = "Fire Pass PRO Aktif";
      } else if (deal.reward_type === "firepass_badge") {
        const { data: season } = await admin.from("fire_pass_seasons").select("id").eq("is_active", true).single();
        const { data: prog } = await admin.from("fire_pass_progress").select("id, badges").eq("visitor_id", visitorId).eq("season_id", season.id).maybeSingle();
        if (prog) await admin.from("fire_pass_progress").update({ badges: (prog.badges || 0) + deal.reward_value }).eq("id", prog.id);
        else await admin.from("fire_pass_progress").insert({ visitor_id: visitorId, season_id: season.id, badges: deal.reward_value });
        rewardSummary = `+${deal.reward_value} Badge`;
      } else if (deal.reward_type === "bundle_sultan") {
        await addPowerUps(admin, visitorId, { auto_hint: 100, extra_life: 50, time_freeze: 50, double_xp_hours: 168 });
        await admin.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) + 1000000 }).eq("id", streak.id);
        await addServerLuck(admin, visitorId, 24);
        await addSpinTicket(admin, visitorId, "premium", 50);
        await addSpinTicket(admin, visitorId, "normal", 100);
        rewardSummary = "Paket Sultan: 1jt Koin + Item Lengkap!";
      } else if (deal.reward_type === "bundle_plus") {
        await addSpinTicket(admin, visitorId, "normal", 10);
        await addSpinTicket(admin, visitorId, "premium", 5);
        rewardSummary = "Paket Plus: Tiket N+P";
      }

      await admin.from("flash_deal_redemptions").insert({ visitor_id: visitorId, deal_id: dealId, redemption_date: today, cost_paid: costPaid, payment_method: payMethod });

      return Response.json({ success: true, rewardSummary, cost: costLabel }, { headers: corsHeaders });
    }

    return Response.json({ error: "Invalid action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
  }
});
