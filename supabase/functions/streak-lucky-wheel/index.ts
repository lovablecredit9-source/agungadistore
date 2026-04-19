import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PITY_THRESHOLD = 50; // jaminan jackpot setelah 50 spin
const COST_COINS = 100;
const COST_GEMS = 10;
const COST_BALANCE = 1000;

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
      const [segs, pity, recentJackpots, mySpins] = await Promise.all([
        admin.from("streak_wheel_segments").select("*").eq("is_active", true).order("sort_order"),
        admin.from("streak_wheel_pity").select("*").eq("visitor_id", visitorId).maybeSingle(),
        admin.from("streak_wheel_spins").select("display_name, reward_label, created_at").eq("is_jackpot", true).order("created_at", { ascending: false }).limit(5),
        admin.from("streak_wheel_spins").select("reward_label, reward_type, reward_value, is_jackpot, created_at").eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(10),
      ]);
      const pityData = pity.data || { spins_since_jackpot: 0, total_jackpots: 0, total_spins: 0, free_spin_used_date: null };
      return Response.json({
        segments: segs.data || [],
        pity: pityData,
        pityThreshold: PITY_THRESHOLD,
        freeSpinAvailable: pityData.free_spin_used_date !== today,
        costs: { coins: COST_COINS, gems: COST_GEMS, balance: COST_BALANCE },
        recentJackpots: recentJackpots.data || [],
        mySpins: mySpins.data || [],
      }, { headers: corsHeaders });
    }

    // ============ SPIN ============
    if (action === "spin") {
      const { paymentMethod, pin } = body; // 'free' | 'coins' | 'gems' | 'balance'
      const today = getTodayWIB();

      // Get pity
      const { data: existingPity } = await admin.from("streak_wheel_pity").select("*").eq("visitor_id", visitorId).maybeSingle();
      const pity = existingPity || { visitor_id: visitorId, spins_since_jackpot: 0, total_jackpots: 0, total_spins: 0, free_spin_used_date: null };

      // ---- Validate payment ----
      if (paymentMethod === "free") {
        if (pity.free_spin_used_date === today) {
          return Response.json({ error: "Spin gratis hari ini sudah dipakai!" }, { status: 400, headers: corsHeaders });
        }
      } else if (paymentMethod === "coins") {
        const { data: streak } = await admin.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
        if (!streak || (streak.streak_coins || 0) < COST_COINS) {
          return Response.json({ error: `Butuh ${COST_COINS} koin streak` }, { status: 400, headers: corsHeaders });
        }
        await admin.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) - COST_COINS }).eq("id", streak.id);
      } else if (paymentMethod === "gems") {
        const { data: totalGems } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
        const have = Number(totalGems) || 0;
        if (have < COST_GEMS) {
          return Response.json({ error: `Butuh ${COST_GEMS} gem` }, { status: 400, headers: corsHeaders });
        }
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -COST_GEMS });
      } else if (paymentMethod === "balance") {
        // PIN required
        const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
        if (!pinRow) return Response.json({ error: "PIN belum dibuat", needPin: true }, { status: 200, headers: corsHeaders });
        if (!pin) return Response.json({ error: "PIN diperlukan", needPin: true }, { status: 200, headers: corsHeaders });
        const hashHex = await sha256(pin);
        if (hashHex !== pinRow.pin_hash) return Response.json({ error: "PIN salah", needPin: true }, { status: 200, headers: corsHeaders });

        const { data: bal } = await admin.from("user_balances").select("id, balance").eq("visitor_id", visitorId).maybeSingle();
        if (!bal || bal.balance < COST_BALANCE) return Response.json({ error: "Saldo tidak cukup" }, { status: 400, headers: corsHeaders });
        await admin.from("user_balances").update({ balance: bal.balance - COST_BALANCE }).eq("id", bal.id);
        await admin.from("balance_transactions").insert({ visitor_id: visitorId, type: "purchase", amount: COST_BALANCE, description: "Lucky Wheel Spin" });
      } else {
        return Response.json({ error: "Metode bayar tidak valid" }, { status: 400, headers: corsHeaders });
      }

      // ---- Pick segment ----
      const { data: segments } = await admin.from("streak_wheel_segments").select("*").eq("is_active", true).order("sort_order");
      if (!segments || segments.length === 0) return Response.json({ error: "Roda kosong" }, { status: 500, headers: corsHeaders });

      const forceJackpot = pity.spins_since_jackpot + 1 >= PITY_THRESHOLD;
      const winning = pickSegment(segments, forceJackpot);
      const isJackpot = !!winning.is_jackpot;

      // ---- Apply reward ----
      const cost = paymentMethod === "free" ? 0 : paymentMethod === "coins" ? COST_COINS : paymentMethod === "gems" ? COST_GEMS : COST_BALANCE;
      let displayName = "Player";
      const { data: prof } = await admin.from("game_profiles").select("display_name").eq("visitor_id", visitorId).maybeSingle();
      if (prof?.display_name) displayName = prof.display_name;

      if (winning.reward_type === "streak_coins") {
        const { data: ds } = await admin.from("daily_streaks").select("id, streak_coins, longest_streak, current_streak, total_claims").eq("visitor_id", visitorId).maybeSingle();
        if (ds) {
          await admin.from("daily_streaks").update({ streak_coins: (ds.streak_coins || 0) + winning.reward_value }).eq("id", ds.id);
        } else {
          await admin.from("daily_streaks").insert({ visitor_id: visitorId, streak_coins: winning.reward_value });
        }
      } else if (winning.reward_type === "gems") {
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: winning.reward_value });
        await admin.from("gem_transactions").insert({ visitor_id: visitorId, type: "earn", amount: winning.reward_value, description: "Lucky Wheel Win" });
      } else if (winning.reward_type === "freeze_token") {
        const { data: ds } = await admin.from("daily_streaks").select("id, freeze_count").eq("visitor_id", visitorId).maybeSingle();
        if (ds) {
          await admin.from("daily_streaks").update({ freeze_count: (ds.freeze_count || 0) + winning.reward_value }).eq("id", ds.id);
        } else {
          await admin.from("daily_streaks").insert({ visitor_id: visitorId, freeze_count: winning.reward_value });
        }
      } else if (winning.reward_type === "balance") {
        const { data: bal } = await admin.from("user_balances").select("id, balance").eq("visitor_id", visitorId).maybeSingle();
        if (bal) {
          await admin.from("user_balances").update({ balance: bal.balance + winning.reward_value }).eq("id", bal.id);
          await admin.from("balance_transactions").insert({ visitor_id: visitorId, type: "reward", amount: winning.reward_value, description: `Lucky Wheel: ${winning.label}` });
        }
      }

      // ---- Update pity ----
      const newPity = {
        visitor_id: visitorId,
        spins_since_jackpot: isJackpot ? 0 : pity.spins_since_jackpot + 1,
        total_jackpots: pity.total_jackpots + (isJackpot ? 1 : 0),
        total_spins: pity.total_spins + 1,
        free_spin_used_date: paymentMethod === "free" ? today : pity.free_spin_used_date,
        updated_at: new Date().toISOString(),
      };
      if (existingPity) {
        await admin.from("streak_wheel_pity").update(newPity).eq("visitor_id", visitorId);
      } else {
        await admin.from("streak_wheel_pity").insert(newPity);
      }

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
        title: isJackpot ? `🎰 JACKPOT! ${winning.label}` : `🎁 Lucky Wheel: ${winning.label}`,
        message: isJackpot ? "Selamat! Kamu memenangkan JACKPOT!" : `Hadiah berhasil ditambahkan ke akunmu`,
        type: "lucky_wheel",
      });

      return Response.json({
        success: true,
        winning,
        isJackpot,
        isPity: forceJackpot,
        newPity,
      }, { headers: corsHeaders });
    }

    return Response.json({ error: "Action tidak valid" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    console.error("lucky-wheel error:", e);
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
