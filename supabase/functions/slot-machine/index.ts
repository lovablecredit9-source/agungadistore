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
  legenda: [12, 12, 13, 16, 16, 15, 14],
  maha:   [10, 11, 12, 15, 16, 16, 16],
};

type Tier = "hemat" | "sedang" | "besar" | "mega" | "ultra" | "sultan" | "raja" | "dewa" | "legenda" | "maha";

const TIER_COSTS: Record<Tier, number> = { hemat: 1, sedang: 5, besar: 10, mega: 50, ultra: 100, sultan: 200, raja: 500, dewa: 1000, legenda: 5000, maha: 10000 };

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

// Spin 3x3 grid (9 simbol) dengan "lucky bias" — saat booster aktif, peluang baris tengah match reel 1 baris tengah
function spinGrid3x3(tier: Tier, luckMultiplier = 1): string[] {
  // Generate 9 simbol independen
  const grid: string[] = [];
  for (let i = 0; i < 9; i++) grid.push(spinReel(tier, luckMultiplier));

  // Bias aktif mulai x2: peluang baris tengah jadi 3-sama
  const matchProb = Math.min(0.7, Math.max(0, (luckMultiplier - 1) * 0.08));
  if (Math.random() < matchProb) {
    grid[4] = grid[3];
    grid[5] = grid[3];
  }
  return grid;
}

// 8 payline pada index grid 0..8 (baris 0:[0,1,2], baris 1:[3,4,5], baris 2:[6,7,8])
const PAYLINES: { name: string; indices: number[] }[] = [
  { name: "row_top",    indices: [0, 1, 2] },
  { name: "row_mid",    indices: [3, 4, 5] },
  { name: "row_bot",    indices: [6, 7, 8] },
  { name: "diag_down",  indices: [0, 4, 8] },
  { name: "diag_up",    indices: [6, 4, 2] },
  { name: "col_left",   indices: [0, 3, 6] },
  { name: "col_mid",    indices: [1, 4, 7] },
  { name: "col_right",  indices: [2, 5, 8] },
];

// Ranking nilai payout untuk pilih garis menang terbaik
function payoutRank(p: { type: string; value: number }): number {
  const typeRank: Record<string, number> = { game_balance: 4, storage_mb: 3, extra_life: 2, game_credits: 1, none: 0 };
  return (typeRank[p.type] || 0) * 1e9 + (p.value || 0);
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
    // 1 kredit → MAX saldo Rp 300, fokus ke kredit
    if (same3) {
      if (sym === "7️⃣") return { type: "game_balance", value: 300, label: "JACKPOT! Saldo Game Rp 300" };
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
    // 5 kredit → MAX saldo Rp 600, fokus ke kredit + bonus storage/nyawa
    if (same3) {
      if (sym === "7️⃣") return { type: "game_balance", value: 600, label: "JACKPOT! Saldo Game Rp 600" };
      if (sym === "💎") return { type: "game_balance", value: 300, label: "Saldo Game Rp 300" };
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
    // 10 kredit, MAX saldo Rp 1.500
    if (same3) {
      if (sym === "7️⃣") return { type: "game_balance", value: 1500, label: "MEGA JACKPOT! Saldo Game Rp 1.500" };
      if (sym === "💎") return { type: "game_balance", value: 600, label: "Saldo Game Rp 600" };
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
    // 50 kredit, MAX saldo Rp 7.500
    if (same3) {
      if (sym === "7️⃣") return { type: "game_balance", value: 7500, label: "SUPER JACKPOT! Saldo Game Rp 7.500" };
      if (sym === "💎") return { type: "game_balance", value: 3000, label: "Saldo Game Rp 3.000" };
      if (sym === "⭐") return { type: "game_balance", value: 1500, label: "Saldo Game Rp 1.500" };
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
    // 100 kredit, MAX saldo Rp 15.000
    if (same3) {
      if (sym === "7️⃣") return { type: "game_balance", value: 15000, label: "ULTRA JACKPOT! Saldo Game Rp 15.000" };
      if (sym === "💎") return { type: "game_balance", value: 6000, label: "Saldo Game Rp 6.000" };
      if (sym === "⭐") return { type: "game_balance", value: 3000, label: "Saldo Game Rp 3.000" };
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
    // 200 kredit, MAX saldo Rp 30.000
    if (same3) {
      if (sym === "7️⃣") return { type: "game_balance", value: 30000, label: "SULTAN JACKPOT! Saldo Game Rp 30.000" };
      if (sym === "💎") return { type: "game_balance", value: 12000, label: "Saldo Game Rp 12.000" };
      if (sym === "⭐") return { type: "game_balance", value: 6000, label: "Saldo Game Rp 6.000" };
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
    // 500 kredit, MAX saldo Rp 75.000
    if (same3) {
      if (sym === "7️⃣") return { type: "game_balance", value: 75000, label: "RAJA JACKPOT! Saldo Game Rp 75.000" };
      if (sym === "💎") return { type: "game_balance", value: 30000, label: "Saldo Game Rp 30.000" };
      if (sym === "⭐") return { type: "game_balance", value: 15000, label: "Saldo Game Rp 15.000" };
      if (sym === "🔔") return { type: "storage_mb", value: 2500, label: "+2.5 GB Storage Musik" };
      if (sym === "🍇") return { type: "extra_life", value: 50, label: "+50 Nyawa Power-Up" };
      if (sym === "🍋") return { type: "game_credits", value: 650, label: "650 Credits" };
      if (sym === "🍒") return { type: "game_credits", value: 450, label: "450 Credits" };
    }
    const cherries = reels.filter(r => r === "🍒").length;
    if (cherries === 2) return { type: "game_credits", value: 225, label: "225 Credits" };
    return { type: "none", value: 0, label: "Zonk! Coba lagi" };
  }

  if (tier === "dewa") {
    // 1000 kredit, MAX saldo Rp 150.000
    if (same3) {
      if (sym === "7️⃣") return { type: "game_balance", value: 150000, label: "DEWA JACKPOT! Saldo Game Rp 150.000" };
      if (sym === "💎") return { type: "game_balance", value: 60000, label: "Saldo Game Rp 60.000" };
      if (sym === "⭐") return { type: "game_balance", value: 30000, label: "Saldo Game Rp 30.000" };
      if (sym === "🔔") return { type: "storage_mb", value: 5000, label: "+5 GB Storage Musik" };
      if (sym === "🍇") return { type: "extra_life", value: 100, label: "+100 Nyawa Power-Up" };
      if (sym === "🍋") return { type: "game_credits", value: 1300, label: "1.300 Credits" };
      if (sym === "🍒") return { type: "game_credits", value: 900, label: "900 Credits" };
    }
    const cherries = reels.filter(r => r === "🍒").length;
    if (cherries === 2) return { type: "game_credits", value: 450, label: "450 Credits" };
    return { type: "none", value: 0, label: "Zonk! Coba lagi" };
  }

  if (tier === "legenda") {
    // 5000 kredit, MAX saldo Rp 750.000
    if (same3) {
      if (sym === "7️⃣") return { type: "game_balance", value: 750000, label: "LEGENDA JACKPOT! Saldo Game Rp 750.000" };
      if (sym === "💎") return { type: "game_balance", value: 300000, label: "Saldo Game Rp 300.000" };
      if (sym === "⭐") return { type: "game_balance", value: 150000, label: "Saldo Game Rp 150.000" };
      if (sym === "🔔") return { type: "storage_mb", value: 10000, label: "+10 GB Storage Musik" };
      if (sym === "🍇") return { type: "extra_life", value: 250, label: "+250 Nyawa Power-Up" };
      if (sym === "🍋") return { type: "game_credits", value: 5000, label: "5.000 Credits" };
      if (sym === "🍒") return { type: "game_credits", value: 3500, label: "3.500 Credits" };
    }
    const cherries = reels.filter(r => r === "🍒").length;
    if (cherries === 2) return { type: "game_credits", value: 1750, label: "1.750 Credits" };
    return { type: "none", value: 0, label: "Zonk! Coba lagi" };
  }

  // tier === "maha" → 10000 kredit, MAX saldo Rp 1.500.000
  if (same3) {
    if (sym === "7️⃣") return { type: "game_balance", value: 1500000, label: "MAHA JACKPOT! Saldo Game Rp 1.500.000" };
    if (sym === "💎") return { type: "game_balance", value: 600000, label: "Saldo Game Rp 600.000" };
    if (sym === "⭐") return { type: "game_balance", value: 300000, label: "Saldo Game Rp 300.000" };
    if (sym === "🔔") return { type: "storage_mb", value: 20000, label: "+20 GB Storage Musik" };
    if (sym === "🍇") return { type: "extra_life", value: 500, label: "+500 Nyawa Power-Up" };
    if (sym === "🍋") return { type: "game_credits", value: 10000, label: "10.000 Credits" };
    if (sym === "🍒") return { type: "game_credits", value: 7000, label: "7.000 Credits" };
  }
  const cherries = reels.filter(r => r === "🍒").length;
  if (cherries === 2) return { type: "game_credits", value: 3500, label: "3.500 Credits" };
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
    const tier: Tier = (["hemat", "sedang", "besar", "mega", "ultra", "sultan", "raja", "dewa", "legenda", "maha"].includes(rawTier) ? rawTier : "hemat") as Tier;
    if (!visitorId) return new Response(JSON.stringify({ error: "visitorId required" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Ban guard
    const { data: banned } = await supabase.rpc("is_account_banned", { p_visitor_id: visitorId });
    if (banned) return new Response(JSON.stringify({ error: "Akun Anda dibanned. Tidak bisa bermain." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const cost = TIER_COSTS[tier];

    // Cek status unlimited (per visitor row tetap relevan untuk paket unlimited)
    const { data: gc } = await supabase
      .from("user_game_credits")
      .select("id, credits, unlimited_until")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    const unlimitedActive = !!(gc?.unlimited_until && new Date(gc.unlimited_until).getTime() > Date.now());

    // Sumber kebenaran kredit: total per akun (mendukung multi-visitor / akun balance)
    const { data: accountCreditsRaw } = await supabase.rpc("get_account_credits", { p_visitor_id: visitorId });
    const currentCredits: number = Number(accountCreditsRaw) || 0;

    if (!unlimitedActive && currentCredits < cost) {
      return new Response(
        JSON.stringify({ error: `Kredit tidak cukup. Butuh ${cost} kredit (kamu punya ${currentCredits}).` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Hitung hasil spin: 3x3 grid + cek 8 payline, ambil hadiah terbaik
    const luck = await getActiveLuck(visitorId);
    const grid = spinGrid3x3(tier, luck);

    let bestPayout = { type: "none", value: 0, label: "Zonk! Coba lagi" };
    let bestLine: { name: string; indices: number[] } | null = null;
    const winningLines: { name: string; indices: number[]; payout: any }[] = [];

    for (const line of PAYLINES) {
      const reelsOnLine = line.indices.map(i => grid[i]);
      const linePayout = calculatePayout(tier, reelsOnLine);
      if (linePayout.type !== "none") {
        winningLines.push({ name: line.name, indices: line.indices, payout: linePayout });
        if (payoutRank(linePayout) > payoutRank(bestPayout)) {
          bestPayout = linePayout;
          bestLine = line;
        }
      }
    }

    const payout = bestPayout;
    // Untuk kompatibilitas: reels = baris winning (atau baris tengah jika tidak menang)
    const reels = bestLine ? bestLine.indices.map(i => grid[i]) : [grid[3], grid[4], grid[5]];

    // Update kredit via RPC akun (atomic, multi-visitor aware)
    if (!unlimitedActive || payout.type === "game_credits") {
      const creditDelta = (unlimitedActive ? 0 : -cost) + (payout.type === "game_credits" ? payout.value : 0);
      if (creditDelta !== 0) {
        await supabase.rpc("add_account_credits", { p_visitor_id: visitorId, p_amount: creditDelta });
      }
    }

    // Apply payout untuk tipe NON-game_credits (saldo, storage, nyawa)
    if (payout.type !== "game_credits") {
      await applyPayout(visitorId, payout);
    }

    const { data } = await supabase.from("slot_machine_history").insert({
      visitor_id: visitorId,
      reels,
      payout_type: payout.type,
      payout_value: payout.value,
      payout_label: payout.label,
      cost_credits: cost,
    }).select().single();

    return new Response(JSON.stringify({
      success: true,
      grid,
      reels,
      payout,
      winningLines,
      bestLine: bestLine?.name || null,
      tier, cost, luck, record: data,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
