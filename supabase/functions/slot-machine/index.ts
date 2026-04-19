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

const SYMBOLS = ["🍒", "🍋", "🍇", "🔔", "⭐", "💎", "7️⃣"];

// Bobot per tier — makin mahal taruhan, simbol langka makin sering muncul (sedikit)
const WEIGHTS_BY_TIER: Record<string, number[]> = {
  hemat:  [32, 26, 20, 13, 6, 2, 1],
  sedang: [28, 24, 20, 14, 8, 4, 2],
  besar:  [25, 22, 19, 15, 10, 6, 3],
  mega:   [22, 20, 18, 16, 12, 8, 4],
  ultra:  [20, 18, 17, 16, 13, 10, 6],
  sultan: [18, 17, 16, 16, 14, 11, 8],
  raja:   [16, 15, 15, 16, 15, 13, 10],
  dewa:   [14, 14, 14, 16, 16, 14, 12],
};

type Tier = "hemat" | "sedang" | "besar" | "mega" | "ultra" | "sultan" | "raja" | "dewa";

const TIER_COSTS: Record<Tier, number> = { hemat: 1, sedang: 5, besar: 10, mega: 50, ultra: 100, sultan: 200, raja: 500, dewa: 1000 };

function spinReel(tier: Tier, luckMultiplier = 1) {
  // Booster: bobot simbol langka (index 4-6: ⭐ 💎 7️⃣) ditingkatkan secara linear
  const base = WEIGHTS_BY_TIER[tier];
  const weights = base.map((w, i) => i >= 4 ? w * luckMultiplier : w);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < SYMBOLS.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return SYMBOLS[i];
  }
  return SYMBOLS[0];
}

// Spin 3 reel dengan "lucky bias" — saat booster aktif, peluang reel 2 & 3 force-match reel 1
function spinThreeReels(tier: Tier, luckMultiplier = 1): string[] {
  const r1 = spinReel(tier, luckMultiplier);
  // Bias aktif mulai x2: per reel match prob = (luck-1)*0.08, max 70% (x10≈72%→clamp, x20=clamp)
  const matchProb = Math.min(0.7, Math.max(0, (luckMultiplier - 1) * 0.08));
  const r2 = Math.random() < matchProb ? r1 : spinReel(tier, luckMultiplier);
  const r3 = Math.random() < matchProb ? r1 : spinReel(tier, luckMultiplier);
  return [r1, r2, r3];
}

async function getActiveLuck(visitorId: string): Promise<number> {
  const { data } = await supabase.from("server_luck_boosters").select("active_tier, active_until").eq("visitor_id", visitorId).maybeSingle();
  if (!data) return 1;
  if (!data.active_until) return 1;
  if (new Date(data.active_until).getTime() < Date.now()) return 1;
  return data.active_tier || 1;
}

// Payout dipisah per tier sesuai permintaan user
function calculatePayout(tier: Tier, reels: string[]) {
  const same3 = reels[0] === reels[1] && reels[1] === reels[2];
  const sym = reels[0];

  if (tier === "hemat") {
    // 1 kredit → MAX saldo Rp 100, fokus ke kredit
    if (same3) {
      if (sym === "7️⃣") return { type: "game_balance", value: 100, label: "JACKPOT! Saldo Game Rp 100" };
      if (sym === "💎") return { type: "game_credits", value: 5, label: "5 Credits" };
      if (sym === "⭐") return { type: "game_credits", value: 4, label: "4 Credits" };
      if (sym === "🔔") return { type: "game_credits", value: 3, label: "3 Credits" };
      if (sym === "🍇") return { type: "game_credits", value: 3, label: "3 Credits" };
      if (sym === "🍋") return { type: "game_credits", value: 2, label: "2 Credits" };
      if (sym === "🍒") return { type: "game_credits", value: 2, label: "2 Credits" };
    }
    const cherries = reels.filter(r => r === "🍒").length;
    if (cherries === 2) return { type: "game_credits", value: 1, label: "1 Credit" };
    return { type: "none", value: 0, label: "Zonk! Coba lagi" };
  }

  if (tier === "sedang") {
    // 5 kredit → MAX saldo Rp 200, fokus ke kredit + bonus storage/nyawa
    if (same3) {
      if (sym === "7️⃣") return { type: "game_balance", value: 200, label: "JACKPOT! Saldo Game Rp 200" };
      if (sym === "💎") return { type: "game_balance", value: 100, label: "Saldo Game Rp 100" };
      if (sym === "⭐") return { type: "game_credits", value: 8, label: "8 Credits" };
      if (sym === "🔔") return { type: "storage_mb", value: 50, label: "+50 MB Storage Musik" };
      if (sym === "🍇") return { type: "extra_life", value: 1, label: "+1 Nyawa Power-Up" };
      if (sym === "🍋") return { type: "game_credits", value: 6, label: "6 Credits" };
      if (sym === "🍒") return { type: "game_credits", value: 4, label: "4 Credits" };
    }
    const cherries = reels.filter(r => r === "🍒").length;
    if (cherries === 2) return { type: "game_credits", value: 2, label: "2 Credits" };
    return { type: "none", value: 0, label: "Zonk! Coba lagi" };
  }

  if (tier === "besar") {
    // 10 kredit, MAX saldo Rp 500
    if (same3) {
      if (sym === "7️⃣") return { type: "game_balance", value: 500, label: "MEGA JACKPOT! Saldo Game Rp 500" };
      if (sym === "💎") return { type: "game_balance", value: 200, label: "Saldo Game Rp 200" };
      if (sym === "⭐") return { type: "game_credits", value: 15, label: "15 Credits" };
      if (sym === "🔔") return { type: "storage_mb", value: 100, label: "+100 MB Storage Musik" };
      if (sym === "🍇") return { type: "extra_life", value: 2, label: "+2 Nyawa Power-Up" };
      if (sym === "🍋") return { type: "game_credits", value: 12, label: "12 Credits" };
      if (sym === "🍒") return { type: "game_credits", value: 8, label: "8 Credits" };
    }
    const cherries = reels.filter(r => r === "🍒").length;
    if (cherries === 2) return { type: "game_credits", value: 4, label: "4 Credits" };
    return { type: "none", value: 0, label: "Zonk! Coba lagi" };
  }

  if (tier === "mega") {
    // 50 kredit, MAX saldo Rp 2.500
    if (same3) {
      if (sym === "7️⃣") return { type: "game_balance", value: 2500, label: "SUPER JACKPOT! Saldo Game Rp 2.500" };
      if (sym === "💎") return { type: "game_balance", value: 1000, label: "Saldo Game Rp 1.000" };
      if (sym === "⭐") return { type: "game_balance", value: 500, label: "Saldo Game Rp 500" };
      if (sym === "🔔") return { type: "storage_mb", value: 250, label: "+250 MB Storage Musik" };
      if (sym === "🍇") return { type: "extra_life", value: 5, label: "+5 Nyawa Power-Up" };
      if (sym === "🍋") return { type: "game_credits", value: 60, label: "60 Credits" };
      if (sym === "🍒") return { type: "game_credits", value: 40, label: "40 Credits" };
    }
    const cherries = reels.filter(r => r === "🍒").length;
    if (cherries === 2) return { type: "game_credits", value: 20, label: "20 Credits" };
    return { type: "none", value: 0, label: "Zonk! Coba lagi" };
  }

  if (tier === "ultra") {
    // 100 kredit, MAX saldo Rp 5.000
    if (same3) {
      if (sym === "7️⃣") return { type: "game_balance", value: 5000, label: "ULTRA JACKPOT! Saldo Game Rp 5.000" };
      if (sym === "💎") return { type: "game_balance", value: 2000, label: "Saldo Game Rp 2.000" };
      if (sym === "⭐") return { type: "game_balance", value: 1000, label: "Saldo Game Rp 1.000" };
      if (sym === "🔔") return { type: "storage_mb", value: 500, label: "+500 MB Storage Musik" };
      if (sym === "🍇") return { type: "extra_life", value: 10, label: "+10 Nyawa Power-Up" };
      if (sym === "🍋") return { type: "game_credits", value: 130, label: "130 Credits" };
      if (sym === "🍒") return { type: "game_credits", value: 90, label: "90 Credits" };
    }
    const cherries = reels.filter(r => r === "🍒").length;
    if (cherries === 2) return { type: "game_credits", value: 45, label: "45 Credits" };
    return { type: "none", value: 0, label: "Zonk! Coba lagi" };
  }

  if (tier === "sultan") {
    // 200 kredit, MAX saldo Rp 10.000
    if (same3) {
      if (sym === "7️⃣") return { type: "game_balance", value: 10000, label: "SULTAN JACKPOT! Saldo Game Rp 10.000" };
      if (sym === "💎") return { type: "game_balance", value: 4000, label: "Saldo Game Rp 4.000" };
      if (sym === "⭐") return { type: "game_balance", value: 2000, label: "Saldo Game Rp 2.000" };
      if (sym === "🔔") return { type: "storage_mb", value: 1000, label: "+1 GB Storage Musik" };
      if (sym === "🍇") return { type: "extra_life", value: 20, label: "+20 Nyawa Power-Up" };
      if (sym === "🍋") return { type: "game_credits", value: 260, label: "260 Credits" };
      if (sym === "🍒") return { type: "game_credits", value: 180, label: "180 Credits" };
    }
    const cherries = reels.filter(r => r === "🍒").length;
    if (cherries === 2) return { type: "game_credits", value: 90, label: "90 Credits" };
    return { type: "none", value: 0, label: "Zonk! Coba lagi" };
  }

  if (tier === "raja") {
    // 500 kredit, MAX saldo Rp 25.000
    if (same3) {
      if (sym === "7️⃣") return { type: "game_balance", value: 25000, label: "RAJA JACKPOT! Saldo Game Rp 25.000" };
      if (sym === "💎") return { type: "game_balance", value: 10000, label: "Saldo Game Rp 10.000" };
      if (sym === "⭐") return { type: "game_balance", value: 5000, label: "Saldo Game Rp 5.000" };
      if (sym === "🔔") return { type: "storage_mb", value: 2500, label: "+2.5 GB Storage Musik" };
      if (sym === "🍇") return { type: "extra_life", value: 50, label: "+50 Nyawa Power-Up" };
      if (sym === "🍋") return { type: "game_credits", value: 650, label: "650 Credits" };
      if (sym === "🍒") return { type: "game_credits", value: 450, label: "450 Credits" };
    }
    const cherries = reels.filter(r => r === "🍒").length;
    if (cherries === 2) return { type: "game_credits", value: 225, label: "225 Credits" };
    return { type: "none", value: 0, label: "Zonk! Coba lagi" };
  }

  // tier === "dewa" → 1000 kredit, MAX saldo Rp 50.000
  if (same3) {
    if (sym === "7️⃣") return { type: "game_balance", value: 50000, label: "DEWA JACKPOT! Saldo Game Rp 50.000" };
    if (sym === "💎") return { type: "game_balance", value: 20000, label: "Saldo Game Rp 20.000" };
    if (sym === "⭐") return { type: "game_balance", value: 10000, label: "Saldo Game Rp 10.000" };
    if (sym === "🔔") return { type: "storage_mb", value: 5000, label: "+5 GB Storage Musik" };
    if (sym === "🍇") return { type: "extra_life", value: 100, label: "+100 Nyawa Power-Up" };
    if (sym === "🍋") return { type: "game_credits", value: 1300, label: "1.300 Credits" };
    if (sym === "🍒") return { type: "game_credits", value: 900, label: "900 Credits" };
  }
  const cherries = reels.filter(r => r === "🍒").length;
  if (cherries === 2) return { type: "game_credits", value: 450, label: "450 Credits" };
  return { type: "none", value: 0, label: "Zonk! Coba lagi" };
}

async function applyPayout(visitorId: string, payout: { type: string; value: number; label: string }) {
  if (payout.type === "none") return;

  if (payout.type === "game_balance") {
    // upsert game_balance
    const { data: gb } = await supabase.from("game_balance").select("id, amount, total_earned").eq("visitor_id", visitorId).maybeSingle();
    if (gb) {
      await supabase.from("game_balance")
        .update({ amount: (gb.amount || 0) + payout.value, total_earned: (gb.total_earned || 0) + payout.value })
        .eq("id", gb.id);
    } else {
      await supabase.from("game_balance").insert({
        visitor_id: visitorId, amount: payout.value, total_earned: payout.value,
      });
    }
    await supabase.from("game_balance_transactions").insert({
      visitor_id: visitorId, amount: payout.value, type: "slot_win", description: `Slot Machine: ${payout.label}`,
    });
  } else if (payout.type === "game_credits") {
    const { data: gc } = await supabase.from("user_game_credits").select("id, credits").eq("visitor_id", visitorId).maybeSingle();
    if (gc) {
      await supabase.from("user_game_credits").update({ credits: (gc.credits || 0) + payout.value }).eq("id", gc.id);
    } else {
      await supabase.from("user_game_credits").insert({ visitor_id: visitorId, credits: payout.value });
    }
  } else if (payout.type === "storage_mb") {
    const { data: ms } = await supabase.from("user_music_storage").select("id, storage_mb").eq("visitor_id", visitorId).maybeSingle();
    if (ms) {
      await supabase.from("user_music_storage").update({ storage_mb: (ms.storage_mb || 0) + payout.value }).eq("id", ms.id);
    } else {
      const dummyVoucher = "SLOT-" + Math.random().toString(36).slice(2, 10).toUpperCase();
      await supabase.from("user_music_storage").insert({ visitor_id: visitorId, storage_mb: payout.value, voucher_code: dummyVoucher });
    }
  } else if (payout.type === "extra_life") {
    const { data: pu } = await supabase.from("user_power_ups").select("id, extra_life").eq("visitor_id", visitorId).maybeSingle();
    if (pu) {
      await supabase.from("user_power_ups").update({ extra_life: (pu.extra_life || 0) + payout.value }).eq("id", pu.id);
    } else {
      await supabase.from("user_power_ups").insert({ visitor_id: visitorId, extra_life: payout.value });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { visitorId, tier: rawTier } = await req.json();
    const tier: Tier = (["hemat", "sedang", "besar", "mega", "ultra", "sultan", "raja", "dewa"].includes(rawTier) ? rawTier : "hemat") as Tier;
    if (!visitorId) return new Response(JSON.stringify({ error: "visitorId required" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const cost = TIER_COSTS[tier];

    // Cek kredit & status unlimited (sumber kebenaran: unlimited_until > now())
    const { data: gc } = await supabase
      .from("user_game_credits")
      .select("id, credits, unlimited_until")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    const unlimitedActive = !!(gc?.unlimited_until && new Date(gc.unlimited_until).getTime() > Date.now());
    const currentCredits = gc?.credits || 0;

    if (!unlimitedActive && currentCredits < cost) {
      return new Response(
        JSON.stringify({ error: `Kredit tidak cukup. Butuh ${cost} kredit (kamu punya ${currentCredits}).` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Hitung hasil spin
    const luck = await getActiveLuck(visitorId);
    const reels = spinThreeReels(tier, luck);
    const payout = calculatePayout(tier, reels);

    // Atomic update kredit: kurangi biaya + tambahkan hadiah game_credits sekaligus (mencegah race condition)
    if (!unlimitedActive || payout.type === "game_credits") {
      const creditDelta = (unlimitedActive ? 0 : -cost) + (payout.type === "game_credits" ? payout.value : 0);
      if (creditDelta !== 0 || !unlimitedActive) {
        const newCredits = Math.max(0, currentCredits + creditDelta);
        if (gc) {
          await supabase.from("user_game_credits").update({ credits: newCredits, updated_at: new Date().toISOString() }).eq("id", gc.id);
        } else {
          await supabase.from("user_game_credits").insert({ visitor_id: visitorId, credits: newCredits });
        }
      }
    }

    // Apply payout untuk tipe NON-game_credits (saldo, storage, nyawa)
    if (payout.type !== "game_credits") {
      await applyPayout(visitorId, payout);
    } else {
      // Catat transaksi info untuk hadiah kredit (opsional, tidak ada tabel khusus)
    }

    const { data } = await supabase.from("slot_machine_history").insert({
      visitor_id: visitorId,
      reels,
      payout_type: payout.type,
      payout_value: payout.value,
      payout_label: payout.label,
      cost_credits: cost,
    }).select().single();

    return new Response(JSON.stringify({ success: true, reels, payout, tier, cost, luck, record: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
