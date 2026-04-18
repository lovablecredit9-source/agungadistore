import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

const PRICE_BALANCE = 25000;
const PRICE_GEMS = 500;
const PRICE_COINS = 5000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, visitorId, source, tierLevel, pin } = await req.json();
    if (!visitorId) throw new Error("visitorId required");

    // ensure pass row
    let { data: pass } = await supa.from("game_season_pass").select("*").eq("visitor_id", visitorId).maybeSingle();
    if (!pass) {
      const { data: created } = await supa.from("game_season_pass").insert({ visitor_id: visitorId }).select().single();
      pass = created;
    }

    if (action === "get") {
      // recompute total xp from game_stats
      const { data: stats } = await supa.from("game_stats").select("points").eq("visitor_id", visitorId);
      const xp = (stats || []).reduce((s: number, r: any) => s + (r.points || 0), 0);
      if (xp !== pass.total_xp) {
        await supa.from("game_season_pass").update({ total_xp: xp }).eq("id", pass.id);
        pass.total_xp = xp;
      }
      return new Response(JSON.stringify({ pass }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "buy_premium") {
      if (pass.is_premium) throw new Error("Premium sudah aktif");

      if (source === "balance") {
        if (!pin) throw new Error("PIN saldo wajib");
        // find active balance account
        const { data: hist } = await supa.from("balance_login_history")
          .select("user_balance_id").eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
        if (!hist) throw new Error("Belum login akun saldo");
        const { data: acc } = await supa.from("user_balances").select("*").eq("id", hist.user_balance_id).maybeSingle();
        if (!acc) throw new Error("Akun saldo tidak ditemukan");
        if (acc.pin_hash) {
          const enc = new TextEncoder();
          const buf = await crypto.subtle.digest("SHA-256", enc.encode(pin));
          const hashed = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
          if (hashed !== acc.pin_hash) throw new Error("PIN salah");
        }
        if ((acc.balance || 0) < PRICE_BALANCE) throw new Error("Saldo tidak cukup");
        await supa.from("user_balances").update({ balance: acc.balance - PRICE_BALANCE }).eq("id", acc.id);
        await supa.from("balance_transactions").insert({
          visitor_id: visitorId, amount: -PRICE_BALANCE, type: "purchase",
          description: "Season Pass Premium Q2 2026",
        });
      } else if (source === "gems") {
        const { data: gp } = await supa.from("game_profiles").select("*").eq("visitor_id", visitorId).maybeSingle();
        if (!gp || (gp.gems || 0) < PRICE_GEMS) throw new Error("Gems tidak cukup");
        await supa.from("game_profiles").update({ gems: gp.gems - PRICE_GEMS }).eq("id", gp.id);
        await supa.from("gem_transactions").insert({
          visitor_id: visitorId, amount: -PRICE_GEMS, type: "spend",
          description: "Season Pass Premium",
        });
      } else if (source === "coins") {
        const { data: streak } = await supa.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
        if (!streak || (streak.streak_coins || 0) < PRICE_COINS) throw new Error("Streak Koin tidak cukup");
        await supa.from("daily_streaks").update({ streak_coins: streak.streak_coins - PRICE_COINS }).eq("id", streak.id);
      } else {
        throw new Error("Source harus balance|gems|coins");
      }

      const { data: updated } = await supa.from("game_season_pass").update({
        is_premium: true, premium_source: source, premium_purchased_at: new Date().toISOString(),
      }).eq("id", pass.id).select().single();
      return new Response(JSON.stringify({ pass: updated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "claim_tier") {
      const lvl = Number(tierLevel);
      if (!lvl || lvl < 1 || lvl > 30) throw new Error("Invalid tier");
      const isPremium = lvl % 3 === 0;
      const value = isPremium ? lvl * 10 : lvl * 3;
      const xpReq = lvl * 50;
      // refresh xp
      const { data: stats } = await supa.from("game_stats").select("points").eq("visitor_id", visitorId);
      const xp = (stats || []).reduce((s: number, r: any) => s + (r.points || 0), 0);
      if (xp < xpReq) throw new Error("XP belum cukup");
      if (isPremium && !pass.is_premium) throw new Error("Tier Premium butuh Premium Pass");
      if ((pass.claimed_tiers || []).includes(lvl)) throw new Error("Tier sudah diklaim");

      // award streak coins
      const { data: streak } = await supa.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
      if (streak) await supa.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) + value }).eq("id", streak.id);

      const claimed = [...(pass.claimed_tiers || []), lvl];
      const { data: updated } = await supa.from("game_season_pass").update({ claimed_tiers: claimed, total_xp: xp }).eq("id", pass.id).select().single();
      return new Response(JSON.stringify({ pass: updated, awarded: value }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Unknown action");
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
