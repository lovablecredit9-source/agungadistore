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
const SEASON_KEY = "Q2-2026";

// ===== Slot Reward (mirror src/components/games/seasonPassRewards.ts) =====
type RewardKind = "coins" | "gems" | "credits" | "storage" | "lives" | "hints" | "time" | "balance";
interface RewardDef { kind: RewardKind; emoji: string; label: string; fullValue: number; partialValue: number; minValue: number; }

const REWARD_POOL: Record<RewardKind, RewardDef> = {
  coins:   { kind: "coins",   emoji: "🪙", label: "Streak Koin",  fullValue: 5,    partialValue: 2,    minValue: 1 },
  gems:    { kind: "gems",    emoji: "💎", label: "Gems",         fullValue: 5,    partialValue: 2,    minValue: 1 },
  credits: { kind: "credits", emoji: "🎮", label: "Kredit Game",  fullValue: 5,    partialValue: 2,    minValue: 1 },
  storage: { kind: "storage", emoji: "💽", label: "Storage MB",   fullValue: 50,   partialValue: 20,   minValue: 5 },
  lives:   { kind: "lives",   emoji: "❤️", label: "Nyawa Ekstra", fullValue: 3,    partialValue: 1,    minValue: 1 },
  hints:   { kind: "hints",   emoji: "💡", label: "Petunjuk",     fullValue: 3,    partialValue: 1,    minValue: 1 },
  time:    { kind: "time",    emoji: "⏱️", label: "Time Freeze",  fullValue: 3,    partialValue: 1,    minValue: 1 },
  balance: { kind: "balance", emoji: "💵", label: "Saldo (Rp)",   fullValue: 5000, partialValue: 2000, minValue: 500 },
};
const FREE_POOL    = (["coins","credits","lives","hints","time","storage"] as RewardKind[]).map(k => REWARD_POOL[k]);
const PREMIUM_POOL = (["coins","gems","credits","storage","lives","hints","time","balance"] as RewardKind[]).map(k => REWARD_POOL[k]);

function hash32(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}
const pick = <T,>(arr: T[], seed: number): T => arr[seed % arr.length];

function rollSlot(visitorId: string, tier: number, isPremium: boolean) {
  const pool = isPremium ? PREMIUM_POOL : FREE_POOL;
  const seedBase = `${visitorId}|${SEASON_KEY}|${tier}|${isPremium ? "P" : "F"}`;
  const jackpotChance = isPremium ? (tier % 3 === 0 ? 0.5 : 0.18) : (tier % 5 === 0 ? 0.3 : 0.1);
  const partialChance = 0.45;
  const roll = (hash32(seedBase + "|outcome") % 1000) / 1000;

  const k1 = pick(pool, hash32(seedBase + "|r1"));
  let k2 = pick(pool, hash32(seedBase + "|r2"));
  let k3 = pick(pool, hash32(seedBase + "|r3"));
  let matchType: "jackpot" | "partial" | "miss";

  if (roll < jackpotChance) { k2 = k1; k3 = k1; matchType = "jackpot"; }
  else if (roll < jackpotChance + partialChance) {
    k2 = k1; let s = 1;
    while (k3.kind === k1.kind) { k3 = pick(pool, hash32(seedBase + "|r3s" + s)); s++; if (s > 20) break; }
    matchType = "partial";
  } else {
    let s = 1;
    while (k2.kind === k1.kind) { k2 = pick(pool, hash32(seedBase + "|r2s" + s)); s++; if (s > 20) break; }
    s = 1;
    while (k3.kind === k1.kind || k3.kind === k2.kind) { k3 = pick(pool, hash32(seedBase + "|r3m" + s)); s++; if (s > 20) break; }
    matchType = "miss";
  }
  const value = matchType === "jackpot" ? k1.fullValue : matchType === "partial" ? k1.partialValue : k1.minValue;
  return { reels: [k1, k2, k3], matchType, primary: k1, awardedValue: value, display: `${k1.emoji}${k2.emoji}${k3.emoji}` };
}

// Apply reward ke tabel masing-masing
async function applyReward(visitorId: string, kind: RewardKind, value: number) {
  if (kind === "coins") {
    const { data: r } = await supa.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
    if (r) await supa.from("daily_streaks").update({ streak_coins: (r.streak_coins || 0) + value }).eq("id", r.id);
    else await supa.from("daily_streaks").insert({ visitor_id: visitorId, streak_coins: value });
  } else if (kind === "gems") {
    await supa.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: value });
    await supa.from("gem_transactions").insert({ visitor_id: visitorId, amount: value, type: "earn", description: "Season Pass reward" });
  } else if (kind === "credits") {
    const { data: r } = await supa.from("user_game_credits").select("id, credits").eq("visitor_id", visitorId).maybeSingle();
    if (r) await supa.from("user_game_credits").update({ credits: (r.credits || 0) + value }).eq("id", r.id);
    else await supa.from("user_game_credits").insert({ visitor_id: visitorId, credits: value });
  } else if (kind === "storage") {
    const { data: r } = await supa.from("user_music_storage").select("id, storage_mb").eq("visitor_id", visitorId).maybeSingle();
    if (r) await supa.from("user_music_storage").update({ storage_mb: (r.storage_mb || 0) + value }).eq("id", r.id);
    else await supa.from("user_music_storage").insert({ visitor_id: visitorId, storage_mb: value });
  } else if (kind === "lives" || kind === "hints" || kind === "time") {
    const col = kind === "lives" ? "extra_life" : kind === "hints" ? "auto_hint" : "time_freeze";
    const { data: r } = await supa.from("user_power_ups").select(`id, ${col}`).eq("visitor_id", visitorId).maybeSingle();
    if (r) await supa.from("user_power_ups").update({ [col]: ((r as any)[col] || 0) + value }).eq("id", r.id);
    else await supa.from("user_power_ups").insert({ visitor_id: visitorId, [col]: value });
  } else if (kind === "balance") {
    const { data: r } = await supa.from("user_balances").select("id, balance").eq("visitor_id", visitorId).maybeSingle();
    if (r) {
      await supa.from("user_balances").update({ balance: (r.balance || 0) + value }).eq("id", r.id);
      await supa.from("balance_transactions").insert({ visitor_id: visitorId, amount: value, type: "reward", description: "Season Pass reward" });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { action, visitorId, source, tierLevel, pin } = await req.json();
    if (!visitorId) throw new Error("visitorId required");

    let { data: pass } = await supa.from("game_season_pass").select("*").eq("visitor_id", visitorId).maybeSingle();
    if (!pass) {
      const { data: created } = await supa.from("game_season_pass").insert({ visitor_id: visitorId }).select().single();
      pass = created;
    }

    if (action === "get") {
      const { data: stats } = await supa.from("game_stats").select("points").eq("visitor_id", visitorId);
      const xp = (stats || []).reduce((s: number, r: any) => s + (r.points || 0), 0);
      if (xp !== pass.total_xp) {
        await supa.from("game_season_pass").update({ total_xp: xp }).eq("id", pass.id);
        pass.total_xp = xp;
      }
      // Pre-roll preview untuk semua tier (free + premium versi)
      const previews = Array.from({ length: 30 }, (_, i) => {
        const lvl = i + 1;
        const isPremiumTier = lvl % 3 === 0;
        const slot = rollSlot(visitorId, lvl, isPremiumTier);
        return { tier: lvl, isPremiumTier, ...slot };
      });
      return new Response(JSON.stringify({ pass, previews }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "buy_premium") {
      if (pass.is_premium) throw new Error("Premium sudah aktif");

      if (source === "balance") {
        if (!pin) throw new Error("PIN saldo wajib");
        const { data: pinRow } = await supa.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
        if (!pinRow) throw new Error("PIN belum dibuat");
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
        const hashed = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
        if (hashed !== pinRow.pin_hash) throw new Error("PIN salah");
        const { data: acc } = await supa.from("user_balances").select("*").eq("visitor_id", visitorId).maybeSingle();
        if (!acc) throw new Error("Akun saldo tidak ditemukan");
        if ((acc.balance || 0) < PRICE_BALANCE) throw new Error("Saldo tidak cukup");
        await supa.from("user_balances").update({ balance: acc.balance - PRICE_BALANCE }).eq("id", acc.id);
        await supa.from("balance_transactions").insert({
          visitor_id: visitorId, amount: -PRICE_BALANCE, type: "purchase",
          description: "Season Pass Premium Q2 2026",
        });
      } else if (source === "gems") {
        const { data: totalGems } = await supa.rpc("get_account_gems", { p_visitor_id: visitorId });
        if ((totalGems || 0) < PRICE_GEMS) throw new Error(`Gems tidak cukup. Butuh ${PRICE_GEMS} 💎, kamu punya ${totalGems || 0} 💎`);
        const { error: dErr } = await supa.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -PRICE_GEMS });
        if (dErr) throw new Error(dErr.message || "Gagal potong gem");
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
      const isPremiumTier = lvl % 3 === 0;
      const xpReq = lvl * 50;

      const { data: stats } = await supa.from("game_stats").select("points").eq("visitor_id", visitorId);
      const xp = (stats || []).reduce((s: number, r: any) => s + (r.points || 0), 0);
      if (xp < xpReq) throw new Error("XP belum cukup");
      if (isPremiumTier && !pass.is_premium) throw new Error("Tier Premium butuh Premium Pass");
      if ((pass.claimed_tiers || []).includes(lvl)) throw new Error("Tier sudah diklaim");

      const slot = rollSlot(visitorId, lvl, isPremiumTier);
      await applyReward(visitorId, slot.primary.kind, slot.awardedValue);

      const claimed = [...(pass.claimed_tiers || []), lvl];
      const { data: updated } = await supa.from("game_season_pass").update({ claimed_tiers: claimed, total_xp: xp }).eq("id", pass.id).select().single();
      return new Response(JSON.stringify({
        pass: updated,
        slot,
        awarded: slot.awardedValue,
        rewardKind: slot.primary.kind,
        rewardLabel: slot.primary.label,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error("Unknown action");
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
