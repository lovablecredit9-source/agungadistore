import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getTodayWIB() {
  const wib = new Date(Date.now() + 7 * 3600 * 1000);
  return wib.toISOString().split("T")[0];
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function pickSegment(segments: any[], forceJackpot: boolean) {
  if (forceJackpot) {
    const jp = segments.find(s => s.is_jackpot);
    if (jp) return jp;
  }
  const total = segments.reduce((sum, s) => sum + (s.weight || 1), 0);
  let r = Math.random() * total;
  for (const s of segments) {
    r -= (s.weight || 1);
    if (r <= 0) return s;
  }
  return segments[0];
}

async function addDailyStreakReward(admin: any, visitorId: string, column: "streak_coins" | "freeze_count", amount: number) {
  const { data: ds } = await admin.from("daily_streaks").select(`id, ${column}`).eq("visitor_id", visitorId).maybeSingle();
  if (ds) await admin.from("daily_streaks").update({ [column]: (ds[column] || 0) + amount }).eq("id", ds.id);
  else await admin.from("daily_streaks").insert({ visitor_id: visitorId, [column]: amount });
}

async function addPowerUpReward(admin: any, visitorId: string, column: "extra_life" | "auto_hint" | "time_freeze", amount: number) {
  const { data: power } = await admin.from("user_power_ups").select(`id, ${column}`).eq("visitor_id", visitorId).maybeSingle();
  if (power) await admin.from("user_power_ups").update({ [column]: (power[column] || 0) + amount }).eq("id", power.id);
  else await admin.from("user_power_ups").insert({ visitor_id: visitorId, [column]: amount });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { action, visitorId } = body;
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ============ LIST ============
    if (action === "list") {
      const today = getTodayWIB();
      const [tiersRes, segs, pity, recentJackpots, mySpins] = await Promise.all([
        admin.from("streak_wheel_tier_config").select("*").eq("is_active", true).order("sort_order"),
        admin.from("streak_wheel_segments").select("*").eq("is_active", true).order("sort_order"),
        admin.from("streak_wheel_pity").select("*").eq("visitor_id", visitorId).maybeSingle(),
        admin.from("streak_wheel_spins").select("display_name, reward_label, created_at").eq("is_jackpot", true).order("created_at", { ascending: false }).limit(5),
        admin.from("streak_wheel_spins").select("reward_label, reward_type, reward_value, is_jackpot, created_at").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(10),
      ]);
      const pityData = pity.data || { spins_since_jackpot: 0, total_jackpots: 0, total_spins: 0, free_spin_used_per_tier: {} };
      const tiers = tiersRes.data || [];
      const allSegments = segs.data || [];

      // Group segments by tier
      const segmentsByTier: Record<string, any[]> = {};
      for (const t of tiers) segmentsByTier[t.tier_key] = [];
      for (const s of allSegments) {
        if (segmentsByTier[s.tier]) segmentsByTier[s.tier].push(s);
      }

      // Free spin availability per tier
      const freeUsed = pityData.free_spin_used_per_tier || {};
      const freeAvailable: Record<string, boolean> = {};
      for (const t of tiers) {
        freeAvailable[t.tier_key] = t.free_daily && freeUsed[t.tier_key] !== today;
      }

      return Response.json({
        tiers,
        segmentsByTier,
        pity: pityData,
        freeAvailable,
        recentJackpots: recentJackpots.data || [],
        mySpins: mySpins.data || [],
      }, { headers: corsHeaders });
    }

    // ============ SPIN ============
    if (action === "spin") {
      const { tierKey, paymentMethod, pin } = body; // tierKey: cheap/normal/premium, paymentMethod: 'free'|'coins'|'gems'|'balance'
      const today = getTodayWIB();

      if (!tierKey) return Response.json({ error: "Tier wajib dipilih" }, { status: 400, headers: corsHeaders });

      // Get tier config
      const { data: tier } = await admin.from("streak_wheel_tier_config").select("*").eq("tier_key", tierKey).eq("is_active", true).maybeSingle();
      if (!tier) return Response.json({ error: "Tier tidak ditemukan" }, { status: 404, headers: corsHeaders });

      // Get pity
      const { data: existingPity } = await admin.from("streak_wheel_pity").select("*").eq("visitor_id", visitorId).maybeSingle();
      const pity = existingPity || { visitor_id: visitorId, spins_since_jackpot: 0, total_jackpots: 0, total_spins: 0, free_spin_used_per_tier: {} };
      const freeUsed = pity.free_spin_used_per_tier || {};

      // ---- Validate payment ----
      if (paymentMethod === "free") {
        if (!tier.free_daily) return Response.json({ error: "Tier ini tidak ada free spin" }, { status: 400, headers: corsHeaders });
        if (freeUsed[tierKey] === today) return Response.json({ error: "Free spin tier ini sudah dipakai hari ini" }, { status: 400, headers: corsHeaders });
      } else if (paymentMethod === "coins") {
        if (tier.cost_coins <= 0) return Response.json({ error: "Tier tidak terima koin" }, { status: 400, headers: corsHeaders });
        const { data: streak } = await admin.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
        if (!streak || (streak.streak_coins || 0) < tier.cost_coins) {
          return Response.json({ error: `Butuh ${tier.cost_coins} koin streak` }, { status: 400, headers: corsHeaders });
        }
        await admin.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) - tier.cost_coins }).eq("id", streak.id);
      } else if (paymentMethod === "gems") {
        if (tier.cost_gems <= 0) return Response.json({ error: "Tier tidak terima gem" }, { status: 400, headers: corsHeaders });
        const { data: totalGems } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
        const have = Number(totalGems) || 0;
        if (have < tier.cost_gems) return Response.json({ error: `Butuh ${tier.cost_gems} gem` }, { status: 400, headers: corsHeaders });
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -tier.cost_gems });
      } else if (paymentMethod === "balance") {
        if (tier.cost_balance <= 0) return Response.json({ error: "Tier tidak terima saldo" }, { status: 400, headers: corsHeaders });
        const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
        if (!pinRow) return Response.json({ error: "PIN belum dibuat", needPin: true }, { status: 200, headers: corsHeaders });
        if (!pin) return Response.json({ error: "PIN diperlukan", needPin: true }, { status: 200, headers: corsHeaders });
        const hashHex = await sha256(pin);
        if (hashHex !== pinRow.pin_hash) return Response.json({ error: "PIN salah", needPin: true }, { status: 200, headers: corsHeaders });

        const { data: bal } = await admin.from("user_balances").select("id, balance, bonus_balance").eq("visitor_id", visitorId).maybeSingle();
        if (!bal || ((bal.balance || 0) + (bal.bonus_balance || 0)) < tier.cost_balance) return Response.json({ error: "Saldo tidak cukup" }, { status: 400, headers: corsHeaders });
        await admin.from("user_balances").update({ balance: bal.balance - tier.cost_balance }).eq("id", bal.id);
        await admin.from("balance_transactions").insert({ visitor_id: visitorId, type: "purchase", amount: tier.cost_balance, description: `Lucky Wheel ${tier.tier_name}` });
      } else {
        return Response.json({ error: "Metode bayar tidak valid" }, { status: 400, headers: corsHeaders });
      }

      // ---- Pick segment from this tier's pool ----
      const { data: segments } = await admin.from("streak_wheel_segments").select("*").eq("is_active", true).eq("tier", tierKey).order("sort_order");
      if (!segments || segments.length === 0) return Response.json({ error: "Pool tier kosong" }, { status: 500, headers: corsHeaders });

      const forceJackpot = pity.spins_since_jackpot + 1 >= (tier.pity_threshold || 50);
      const winning = pickSegment(segments, forceJackpot);
      const isJackpot = !!winning.is_jackpot;

      const cost = paymentMethod === "free" ? 0 : paymentMethod === "coins" ? tier.cost_coins : paymentMethod === "gems" ? tier.cost_gems : tier.cost_balance;

      let displayName = "Player";
      const { data: prof } = await admin.from("game_profiles").select("display_name").eq("visitor_id", visitorId).maybeSingle();
      if (prof?.display_name) displayName = prof.display_name;

      // ---- Apply reward ----
      if (winning.reward_type === "streak_coins" || winning.reward_type === "coins") {
        await addDailyStreakReward(admin, visitorId, "streak_coins", winning.reward_value);
      } else if (winning.reward_type === "gems") {
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: winning.reward_value });
        await admin.from("gem_transactions").insert({ visitor_id: visitorId, type: "earn", amount: winning.reward_value, description: "Lucky Wheel Win" });
      } else if (winning.reward_type === "freeze_token" || winning.reward_type === "streak_freeze") {
        await addDailyStreakReward(admin, visitorId, "freeze_count", winning.reward_value);
      } else if (["extra_life", "auto_hint", "time_freeze"].includes(winning.reward_type)) {
        await addPowerUpReward(admin, visitorId, winning.reward_type, winning.reward_value);
      } else if (winning.reward_type === "balance") {
        const { data: bal } = await admin.from("user_balances").select("id, balance, bonus_balance").eq("visitor_id", visitorId).maybeSingle();
        if (bal) {
          await admin.from("user_balances").update({ balance: bal.balance + winning.reward_value }).eq("id", bal.id);
          await admin.from("balance_transactions").insert({ visitor_id: visitorId, type: "reward", amount: winning.reward_value, description: `Lucky Wheel: ${winning.label}` });
        }
      }

      // ---- Update pity ----
      const newFreeUsed = { ...freeUsed };
      if (paymentMethod === "free") newFreeUsed[tierKey] = today;

      const newPity = {
        visitor_id: visitorId,
        spins_since_jackpot: isJackpot ? 0 : pity.spins_since_jackpot + 1,
        total_jackpots: pity.total_jackpots + (isJackpot ? 1 : 0),
        total_spins: pity.total_spins + 1,
        free_spin_used_per_tier: newFreeUsed,
        updated_at: new Date().toISOString(),
      };
      if (existingPity) await admin.from("streak_wheel_pity").update(newPity).eq("visitor_id", visitorId);
      else await admin.from("streak_wheel_pity").insert(newPity);

      // ---- Log spin ----
      await admin.from("streak_wheel_spins").insert({
        visitor_id: visitorId,
        segment_id: winning.id,
        reward_label: winning.label,
        reward_type: winning.reward_type,
        reward_value: winning.reward_value,
        cost_paid: cost,
        payment_method: paymentMethod,
        is_jackpot: isJackpot,
        is_pity: forceJackpot,
        display_name: displayName,
      });

      // ---- Notification ----
      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: isJackpot ? `🎰 JACKPOT ${tier.tier_name}! ${winning.label}` : `🎁 Lucky Wheel ${tier.tier_name}: ${winning.label}`,
        message: isJackpot ? "Selamat! Kamu memenangkan JACKPOT!" : "Hadiah berhasil ditambahkan ke akunmu",
        type: "lucky_wheel",
      });

      return Response.json({ success: true, winning, isJackpot, isPity: forceJackpot, tier: tier.tier_key }, { headers: corsHeaders });
    }

    return Response.json({ error: "Action tidak valid" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    console.error("lucky-wheel error:", e);
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
