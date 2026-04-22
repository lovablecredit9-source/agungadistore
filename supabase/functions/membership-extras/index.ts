import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Catalog
const DIAMOND_PLANS = [
  { tier: "elite", name: "Diamond Elite", price_idr: 30000, cashback_percent: 5, duration_days: 30 },
  { tier: "platinum", name: "Diamond Platinum", price_idr: 75000, cashback_percent: 10, duration_days: 30 },
  { tier: "diamond", name: "Diamond Royal", price_idr: 150000, cashback_percent: 15, duration_days: 30 },
];
const BOOST_PLANS = [
  { tier: "bronze", name: "Boost Bronze 1.5x", multiplier: 1.5, price_idr: 15000, duration_days: 7 },
  { tier: "silver", name: "Boost Silver 2x", multiplier: 2.0, price_idr: 35000, duration_days: 14 },
  { tier: "gold", name: "Boost Gold 3x", multiplier: 3.0, price_idr: 80000, duration_days: 30 },
];
const LUCKYBOX_PLANS = [
  { tier: "starter", name: "Lucky Box Starter", price_idr: 10000, duration_days: 7, items_per_day: 1 },
  { tier: "deluxe", name: "Lucky Box Deluxe", price_idr: 25000, duration_days: 14, items_per_day: 2 },
  { tier: "royal", name: "Lucky Box Royal", price_idr: 60000, duration_days: 30, items_per_day: 3 },
];
const SAVER_PLANS = [
  { tier: "basic", name: "Auto-Saver Basic", price_idr: 12000, duration_days: 7, auto_freeze_per_week: 3, restore_per_week: 0 },
  { tier: "pro", name: "Auto-Saver Pro", price_idr: 30000, duration_days: 14, auto_freeze_per_week: 7, restore_per_week: 1 },
  { tier: "ultra", name: "Auto-Saver Ultra", price_idr: 70000, duration_days: 30, auto_freeze_per_week: 14, restore_per_week: 2 },
];

const LUCKY_POOL = [
  { code: "coin", name: "Coin", icon: "🪙", min: 50, max: 500, weight: 40 },
  { code: "gem", name: "Gem", icon: "💎", min: 5, max: 30, weight: 25 },
  { code: "freeze", name: "Streak Freeze", icon: "🧊", min: 1, max: 2, weight: 15 },
  { code: "hint", name: "Hint", icon: "💡", min: 1, max: 3, weight: 10 },
  { code: "xp_boost", name: "XP Boost 1h", icon: "⚡", min: 1, max: 1, weight: 7 },
  { code: "mystery", name: "Mystery Box", icon: "🎁", min: 1, max: 1, weight: 3 },
];

function todayWIB() {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

function rollLuckyRewards(count: number) {
  const total = LUCKY_POOL.reduce((s, i) => s + i.weight, 0);
  const out: any[] = [];
  for (let i = 0; i < count; i++) {
    let r = Math.random() * total;
    for (const it of LUCKY_POOL) {
      r -= it.weight;
      if (r <= 0) {
        const qty = Math.floor(Math.random() * (it.max - it.min + 1)) + it.min;
        out.push({ code: it.code, name: it.name, icon: it.icon, qty });
        break;
      }
    }
  }
  return out;
}

async function deductBalance(supabase: any, visitorId: string, amount: number) {
  const { data: gp } = await supabase.from("game_profiles").select("user_balance_id").eq("visitor_id", visitorId).maybeSingle();
  if (!gp?.user_balance_id) throw new Error("Login akun saldo dulu");
  const { data: bal } = await supabase.from("user_balances").select("id, balance").eq("id", gp.user_balance_id).maybeSingle();
  if (!bal || bal.balance < amount) throw new Error(`Saldo kurang. Butuh Rp${amount.toLocaleString("id-ID")}`);
  await supabase.from("user_balances").update({ balance: bal.balance - amount }).eq("id", bal.id);
}

// Hitung total items_per_day dari SEMUA sub luckybox aktif (stack)
function computeLuckyboxTotalItems(activeSubs: any[]) {
  let total = 0;
  for (const s of activeSubs) {
    const plan = LUCKYBOX_PLANS.find((p) => p.tier === s.tier);
    if (plan) total += plan.items_per_day;
  }
  return total;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json();
    const { action, visitorId } = body;
    if (!visitorId) throw new Error("visitorId required");

    // ===== LIST =====
    if (action === "list") {
      const now = new Date().toISOString();
      const [diamondAll, boostAll, luckyboxAll, saverAll] = await Promise.all([
        supabase.from("streak_diamond_elite_subs").select("*").eq("visitor_id", visitorId).eq("is_active", true).gt("expires_at", now).order("expires_at", { ascending: false }),
        supabase.from("streak_boost_squad_subs").select("*").eq("visitor_id", visitorId).eq("is_active", true).gt("expires_at", now).order("expires_at", { ascending: false }),
        supabase.from("streak_lucky_box_subs").select("*").eq("visitor_id", visitorId).eq("is_active", true).gt("expires_at", now).order("created_at", { ascending: true }),
        supabase.from("streak_auto_saver_subs").select("*").eq("visitor_id", visitorId).eq("is_active", true).gt("expires_at", now).order("expires_at", { ascending: false }),
      ]);

      const luckyboxSubs = luckyboxAll.data || [];
      const totalItemsPerDay = computeLuckyboxTotalItems(luckyboxSubs);

      // claimed_today: cek di SEMUA sub aktif
      let claimedToday = false;
      let luckyboxPrimary = luckyboxSubs[0] || null;
      if (luckyboxSubs.length > 0) {
        const ids = luckyboxSubs.map((s: any) => s.id);
        const { data: claims } = await supabase
          .from("streak_lucky_box_claims")
          .select("id, sub_id")
          .in("sub_id", ids)
          .eq("claim_date", todayWIB());
        claimedToday = (claims?.length || 0) > 0;
        // total_days_claimed = jumlahkan dari semua sub
        const totalDays = luckyboxSubs.reduce((s: number, x: any) => s + (x.total_days_claimed || 0), 0);
        if (luckyboxPrimary) {
          luckyboxPrimary = {
            ...luckyboxPrimary,
            total_days_claimed: totalDays,
            stacked_count: luckyboxSubs.length,
            total_items_per_day: totalItemsPerDay,
          };
        }
      }

      const { data: gp } = await supabase.from("game_profiles").select("user_balance_id").eq("visitor_id", visitorId).maybeSingle();
      let mainBalance = 0;
      if (gp?.user_balance_id) {
        const { data: bal } = await supabase.from("user_balances").select("balance").eq("id", gp.user_balance_id).maybeSingle();
        mainBalance = bal?.balance || 0;
      }

      return new Response(JSON.stringify({
        catalogs: { diamond: DIAMOND_PLANS, boost: BOOST_PLANS, luckybox: LUCKYBOX_PLANS, saver: SAVER_PLANS },
        active: {
          diamond: (diamondAll.data || [])[0] || null,
          boost: (boostAll.data || [])[0] || null,
          luckybox: luckyboxPrimary,
          saver: (saverAll.data || [])[0] || null,
        },
        active_all: {
          diamond: diamondAll.data || [],
          boost: boostAll.data || [],
          luckybox: luckyboxSubs,
          saver: saverAll.data || [],
        },
        claimed_today: claimedToday,
        main_balance: mainBalance,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== PURCHASE =====
    if (action === "purchase") {
      const { kind, tier } = body;
      let plan: any = null;
      let table = "";
      let extra: any = {};
      const now = new Date().toISOString();

      if (kind === "diamond") {
        plan = DIAMOND_PLANS.find((p) => p.tier === tier);
        table = "streak_diamond_elite_subs";
        extra = { cashback_percent: plan?.cashback_percent };
      } else if (kind === "boost") {
        plan = BOOST_PLANS.find((p) => p.tier === tier);
        table = "streak_boost_squad_subs";
        extra = { multiplier: plan?.multiplier };
      } else if (kind === "luckybox") {
        plan = LUCKYBOX_PLANS.find((p) => p.tier === tier);
        table = "streak_lucky_box_subs";
      } else if (kind === "saver") {
        plan = SAVER_PLANS.find((p) => p.tier === tier);
        table = "streak_auto_saver_subs";
        extra = {
          auto_freeze_per_week: plan?.auto_freeze_per_week,
          restore_per_week: plan?.restore_per_week,
        };
      }
      if (!plan) throw new Error("Paket tidak ditemukan");

      // CEGAH BELI ULANG untuk diamond/boost/saver — lucky box BOLEH stack
      if (kind !== "luckybox") {
        const { data: existing } = await supabase
          .from(table)
          .select("id, tier, expires_at")
          .eq("visitor_id", visitorId)
          .eq("is_active", true)
          .gt("expires_at", now)
          .maybeSingle();
        if (existing) {
          const exp = new Date(existing.expires_at).toLocaleDateString("id-ID");
          if (existing.tier === tier) {
            throw new Error(`Kamu sudah punya paket ${plan.name} aktif sampai ${exp}. Tunggu sampai expired ya!`);
          }
          throw new Error(`Kamu sudah punya membership ${kind} (tier ${existing.tier?.toUpperCase()}) aktif sampai ${exp}. Tidak bisa beli tier lain bersamaan.`);
        }
      }

      await deductBalance(supabase, visitorId, plan.price_idr);
      const expires = new Date();
      expires.setDate(expires.getDate() + plan.duration_days);

      const insertData: any = {
        visitor_id: visitorId,
        tier: plan.tier,
        price_idr: plan.price_idr,
        duration_days: plan.duration_days,
        expires_at: expires.toISOString(),
        ...extra,
      };
      const { data: sub, error } = await supabase.from(table).insert(insertData).select().single();
      if (error) throw new Error(error.message);

      let msg = `🎉 ${plan.name} aktif sampai ${expires.toLocaleDateString("id-ID")}`;
      if (kind === "luckybox") {
        // Hitung total stack baru
        const { data: allSubs } = await supabase
          .from("streak_lucky_box_subs")
          .select("tier")
          .eq("visitor_id", visitorId)
          .eq("is_active", true)
          .gt("expires_at", now);
        const total = computeLuckyboxTotalItems(allSubs || []);
        msg = `🎉 ${plan.name} aktif! Sekarang dapat ${total} item/hari (${(allSubs || []).length} paket aktif)`;
      }

      return new Response(JSON.stringify({ success: true, message: msg, sub }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== LUCKY BOX DAILY CLAIM =====
    if (action === "claim_luckybox") {
      const now = new Date().toISOString();
      const { data: subs } = await supabase
        .from("streak_lucky_box_subs")
        .select("*")
        .eq("visitor_id", visitorId)
        .eq("is_active", true)
        .gt("expires_at", now)
        .order("created_at", { ascending: true });

      if (!subs || subs.length === 0) throw new Error("Tidak ada langganan Lucky Box aktif");

      const ids = subs.map((s: any) => s.id);
      const { data: existing } = await supabase
        .from("streak_lucky_box_claims")
        .select("id")
        .in("sub_id", ids)
        .eq("claim_date", todayWIB());
      if ((existing?.length || 0) > 0) throw new Error("Sudah klaim hari ini, balik besok!");

      // Total items dari SEMUA sub aktif
      const totalItems = computeLuckyboxTotalItems(subs);
      const rewards = rollLuckyRewards(totalItems);

      // Apply rewards
      for (const r of rewards) {
        if (r.code === "coin") {
          const { data: gp } = await supabase.from("game_profiles").select("id, coins").eq("visitor_id", visitorId).maybeSingle();
          if (gp) await supabase.from("game_profiles").update({ coins: (gp.coins || 0) + r.qty }).eq("id", gp.id);
        } else if (r.code === "gem") {
          await supabase.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: r.qty });
        }
      }

      // Catat klaim ke sub PERTAMA + update counter semua sub
      const primarySub = subs[0];
      await supabase.from("streak_lucky_box_claims").insert({
        visitor_id: visitorId,
        sub_id: primarySub.id,
        claim_date: todayWIB(),
        rewards,
      });
      // Increment total_days_claimed di setiap sub
      for (const s of subs) {
        await supabase.from("streak_lucky_box_subs").update({ total_days_claimed: (s.total_days_claimed || 0) + 1 }).eq("id", s.id);
      }

      return new Response(JSON.stringify({ success: true, rewards, total_items: totalItems, stacked: subs.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
