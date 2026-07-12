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

// Rebalanced. Hadiah max: gems 10, kredit 15, streak coins 20, saldo 5.000.
// Zonk diturunkan dari 45→30 base; booster sangat efektif menekan zonk + naikkan epic/legendary.
// Rebalanced (v2): Saldo dipangkas drastis (max Rp 500), kredit diperbanyak.
// Walau booster Server Luck naik, saldo tetap dibatasi & langka.
const PRIZES = [
  // ZONK base 30% tanpa booster
  { type: "none",         value: 0,    label: "Zonk! Coba lagi",       rarity: "common",    weight: 30 },

  // Hadiah kecil — DOMINASI KREDIT
  { type: "game_credits", value: 1,    label: "1 Game Credit",         rarity: "common",    weight: 22 },
  { type: "game_credits", value: 2,    label: "2 Game Credits",        rarity: "common",    weight: 20 },
  { type: "game_credits", value: 3,    label: "3 Game Credits",        rarity: "common",    weight: 16 },
  { type: "streak_coins", value: 10,   label: "10 Streak Coins",       rarity: "common",    weight: 10 },
  { type: "gems",         value: 2,    label: "2 Gems",                rarity: "common",    weight: 7  },
  { type: "game_credits", value: 4,    label: "4 Game Credits",        rarity: "rare",      weight: 8  },
  { type: "streak_coins", value: 20,   label: "20 Streak Coins",       rarity: "rare",      weight: 5  },
  { type: "gems",         value: 4,    label: "4 Gems",                rarity: "rare",      weight: 3  },

  // Saldo SANGAT langka & kecil — max Rp 100 di tier rare
  { type: "game_balance", value: 100,  label: "Saldo IN Rp 100",       rarity: "rare",      weight: 1.5 },

  // Hadiah menengah (langka) — kredit max 5
  { type: "game_credits", value: 5,    label: "5 Game Credits (MAX)",  rarity: "epic",      weight: 1.5 },
  { type: "gems",         value: 6,    label: "6 Gems",                rarity: "epic",      weight: 0.4 },
  { type: "game_balance", value: 200,  label: "Saldo IN Rp 200",       rarity: "epic",      weight: 0.25 },

  // Mega prize (super langka) — saldo dipangkas dari 5.000 → 500
  { type: "game_balance", value: 500,  label: "MEGA! Saldo IN Rp 500", rarity: "legendary", weight: 0.05 },

  // Hadiah baru — Saldo IN + Gem gede tapi SANGAT susah didapat
  { type: "gems",         value: 10,   label: "JACKPOT! 10 Gems",       rarity: "legendary", weight: 0.04 },
  { type: "game_balance", value: 1000, label: "MEGA! Saldo IN Rp 1.000", rarity: "legendary", weight: 0.02 },
];

function pickPrize(luckMultiplier = 1) {
  // Booster: ZONK turun drastis (kuadrat), epic linear, legendary kuadrat
  const adjusted = PRIZES.map(p => {
    let w = p.weight;
    if (p.type === "none") w = w / (luckMultiplier * luckMultiplier);
    // Saldo IN tidak ikut booster (tetap langka walau luck x20)
    else if (p.type === "game_balance") w = w;
    else if (p.rarity === "rare") w = w * Math.sqrt(luckMultiplier);
    else if (p.rarity === "epic") w = w * luckMultiplier;
    else if (p.rarity === "legendary") w = w * luckMultiplier * luckMultiplier;
    return { ...p, _w: w };
  });
  const total = adjusted.reduce((s, r) => s + r._w, 0);
  let roll = Math.random() * total;
  for (const r of adjusted) {
    roll -= r._w;
    if (roll <= 0) return r;
  }
  return adjusted[0];
}

async function getOrCreateTickets(visitorId: string) {
  let { data } = await supabase.from("lucky_draw_tickets").select("*").eq("visitor_id", visitorId).maybeSingle();
  if (!data) {
    const { data: created } = await supabase.from("lucky_draw_tickets").insert({ visitor_id: visitorId }).select().single();
    data = created;
  }
  return data!;
}

async function getActiveLuck(visitorId: string): Promise<number> {
  const { data } = await supabase.from("server_luck_boosters").select("active_tier, active_until").eq("visitor_id", visitorId).maybeSingle();
  if (!data) return 1;
  if (!data.active_until) return 1;
  if (new Date(data.active_until).getTime() < Date.now()) return 1;
  return data.active_tier || 1;
}

async function addGameBalance(visitorId: string, value: number, label: string) {
  const { data: gb } = await supabase.from("game_balance").select("id, amount, total_earned").eq("visitor_id", visitorId).maybeSingle();
  if (gb) {
    await supabase.from("game_balance")
      .update({ amount: (gb.amount || 0) + value, total_earned: (gb.total_earned || 0) + value })
      .eq("id", gb.id);
  } else {
    await supabase.from("game_balance").insert({ visitor_id: visitorId, amount: value, total_earned: value });
  }
  await supabase.from("game_balance_transactions").insert({
    visitor_id: visitorId, amount: value, type: "lucky_draw_win", description: `Lucky Draw: ${label}`,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { action, visitorId } = body;
    if (!visitorId) return new Response(JSON.stringify({ error: "visitorId required" }), { status: 400, headers: corsHeaders });

    if (action !== "status") {
      const { data: banned } = await supabase.rpc("is_account_banned", { p_visitor_id: visitorId });
      if (banned) return new Response(JSON.stringify({ error: "Akun Anda dibanned. Tidak bisa bermain." }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "status") {
      const tickets = await getOrCreateTickets(visitorId);
      const luck = await getActiveLuck(visitorId);
      return new Response(JSON.stringify({ tickets, luck }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "buy") {
      const { packageId } = body;
      const { data: pkg } = await supabase.from("lucky_draw_ticket_packages").select("*").eq("id", packageId).eq("is_active", true).maybeSingle();
      if (!pkg) return new Response(JSON.stringify({ error: "Paket tidak ditemukan" }), { status: 404, headers: corsHeaders });

      if (pkg.cost_currency === "gems") {
        const { data: totalGems } = await supabase.rpc("get_account_gems", { p_visitor_id: visitorId });
        if ((totalGems || 0) < pkg.cost_amount) {
          return new Response(JSON.stringify({ error: `Gems tidak cukup. Butuh ${pkg.cost_amount} 💎, kamu punya ${totalGems || 0} 💎` }), { status: 400, headers: corsHeaders });
        }
        const { error: deductErr } = await supabase.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -pkg.cost_amount });
        if (deductErr) {
          return new Response(JSON.stringify({ error: deductErr.message || "Gagal potong gems" }), { status: 400, headers: corsHeaders });
        }
        await supabase.from("gem_transactions").insert({
          visitor_id: visitorId, amount: -pkg.cost_amount, type: "lucky_draw_buy",
          description: `Beli ${pkg.tickets} tiket Lucky Draw`,
        });
      } else {
        const { data: s } = await supabase.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
        if (!s || (s.streak_coins || 0) < pkg.cost_amount) {
          return new Response(JSON.stringify({ error: "Coins tidak cukup" }), { status: 400, headers: corsHeaders });
        }
        await supabase.from("daily_streaks").update({ streak_coins: s.streak_coins - pkg.cost_amount }).eq("id", s.id);
      }

      const tickets = await getOrCreateTickets(visitorId);
      const { data: updated } = await supabase.from("lucky_draw_tickets").update({
        ticket_count: tickets.ticket_count + pkg.tickets,
        total_purchased: tickets.total_purchased + pkg.tickets,
      }).eq("id", tickets.id).select().single();

      return new Response(JSON.stringify({ success: true, tickets: updated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "draw") {
      const tickets = await getOrCreateTickets(visitorId);
      if ((tickets.ticket_count || 0) < 1) {
        return new Response(JSON.stringify({ error: "Tidak punya tiket" }), { status: 400, headers: corsHeaders });
      }

      const luck = await getActiveLuck(visitorId);
      const prize = pickPrize(luck);
      let voucherCode: string | null = null;

      if (prize.type === "game_balance") {
        await addGameBalance(visitorId, prize.value, prize.label);
      } else if (prize.type === "gems") {
        await supabase.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: prize.value });
        await supabase.from("gem_transactions").insert({ visitor_id: visitorId, amount: prize.value, type: "lucky_draw_win", description: prize.label });
      } else if (prize.type === "streak_coins") {
        const { data: s } = await supabase.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
        if (s) await supabase.from("daily_streaks").update({ streak_coins: (s.streak_coins || 0) + prize.value }).eq("id", s.id);
      } else if (prize.type === "game_credits") {
        const { data: gc } = await supabase.from("user_game_credits").select("id, credits").eq("visitor_id", visitorId).maybeSingle();
        if (gc) {
          await supabase.from("user_game_credits").update({ credits: (gc.credits || 0) + prize.value }).eq("id", gc.id);
        } else {
          await supabase.from("user_game_credits").insert({ visitor_id: visitorId, credits: prize.value });
        }
      }
      // type === "none" → tidak apply apapun, tetap konsumsi tiket

      await supabase.from("lucky_draw_tickets").update({
        ticket_count: tickets.ticket_count - 1,
        total_used: tickets.total_used + 1,
      }).eq("id", tickets.id);

      const { data: hist } = await supabase.from("lucky_draw_history").insert({
        visitor_id: visitorId,
        reward_type: prize.type, reward_value: prize.value, reward_label: prize.label, rarity: prize.rarity,
        voucher_code: voucherCode,
      }).select().single();

      return new Response(JSON.stringify({ success: true, prize: hist, luck }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
