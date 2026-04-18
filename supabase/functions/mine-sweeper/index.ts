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

const GRID_SIZE = 9;

function multiplierFor(mines: number, revealed: number): number {
  const safe = GRID_SIZE - mines;
  if (revealed <= 0) return 1;
  let m = 1;
  for (let i = 0; i < revealed; i++) {
    m *= (GRID_SIZE - i) / (safe - i);
  }
  return Math.max(1, +(m * 0.9).toFixed(2));
}

function pickMines(mines: number): number[] {
  const idx = Array.from({ length: GRID_SIZE }, (_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, mines).sort((a, b) => a - b);
}

async function chargeCredits(visitorId: string, amount: number): Promise<{ ok: boolean; error?: string }> {
  const { data } = await supabase.from("user_game_credits").select("id, credits, unlimited_until").eq("visitor_id", visitorId).maybeSingle();
  const isUnlimited = data?.unlimited_until && new Date(data.unlimited_until) > new Date();
  if (isUnlimited) return { ok: true };
  if (!data || (data.credits || 0) < amount) return { ok: false, error: "Kredit tidak cukup" };
  await supabase.from("user_game_credits").update({ credits: data.credits - amount }).eq("id", data.id);
  return { ok: true };
}

async function applyReward(visitorId: string, payout: { type: string; value: number; label: string }) {
  if (payout.type === "game_balance") {
    const { data: gb } = await supabase.from("game_balance").select("id, amount, total_earned").eq("visitor_id", visitorId).maybeSingle();
    if (gb) {
      await supabase.from("game_balance").update({ amount: (gb.amount || 0) + payout.value, total_earned: (gb.total_earned || 0) + payout.value }).eq("id", gb.id);
    } else {
      await supabase.from("game_balance").insert({ visitor_id: visitorId, amount: payout.value, total_earned: payout.value });
    }
    await supabase.from("game_balance_transactions").insert({
      visitor_id: visitorId, amount: payout.value, type: "mine_win", description: `Mine Sweeper: ${payout.label}`,
    });
  } else if (payout.type === "game_credits") {
    const { data: gc } = await supabase.from("user_game_credits").select("id, credits").eq("visitor_id", visitorId).maybeSingle();
    if (gc) await supabase.from("user_game_credits").update({ credits: (gc.credits || 0) + payout.value }).eq("id", gc.id);
    else await supabase.from("user_game_credits").insert({ visitor_id: visitorId, credits: payout.value });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const body = await req.json();
    const { action, visitorId } = body;
    if (!visitorId) return new Response(JSON.stringify({ error: "visitorId required" }), { status: 400, headers: corsHeaders });

    if (action === "start") {
      const bet = Math.max(1, Math.min(10, Number(body.bet) || 1));
      const mines = Math.max(1, Math.min(7, Number(body.mines) || 3));
      const charge = await chargeCredits(visitorId, bet);
      if (!charge.ok) return new Response(JSON.stringify({ error: charge.error }), { status: 400, headers: corsHeaders });
      const minePositions = pickMines(mines);
      // Upsert session (overwrites any prior unfinished session for same visitor)
      await supabase.from("mine_sweeper_sessions").upsert({
        visitor_id: visitorId,
        bet,
        mines,
        mine_positions: minePositions,
        revealed: [],
        status: "active",
        updated_at: new Date().toISOString(),
      }, { onConflict: "visitor_id" });
      return new Response(JSON.stringify({ success: true, bet, mines, gridSize: GRID_SIZE, multiplier: 1 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: s } = await supabase.from("mine_sweeper_sessions").select("*").eq("visitor_id", visitorId).maybeSingle();
    if (!s || s.status !== "active") return new Response(JSON.stringify({ error: "Tidak ada sesi aktif. Mulai game baru." }), { status: 400, headers: corsHeaders });

    if (action === "reveal") {
      const tile = Number(body.tile);
      if (!Number.isInteger(tile) || tile < 0 || tile >= GRID_SIZE) return new Response(JSON.stringify({ error: "Tile invalid" }), { status: 400, headers: corsHeaders });
      const revealed: number[] = s.revealed || [];
      const minePositions: number[] = s.mine_positions || [];
      if (revealed.includes(tile)) return new Response(JSON.stringify({ error: "Tile sudah dibuka" }), { status: 400, headers: corsHeaders });

      if (minePositions.includes(tile)) {
        await supabase.from("mine_sweeper_history").insert({
          visitor_id: visitorId, bet_credits: s.bet, mines_count: s.mines, tiles_revealed: revealed.length,
          multiplier: 0, payout_type: "none", payout_value: 0, payout_label: "Boom! Kena bom 💣", status: "lost",
        });
        await supabase.from("mine_sweeper_sessions").delete().eq("visitor_id", visitorId);
        return new Response(JSON.stringify({ success: true, status: "lost", tile, minePositions, revealed, payout: { type: "none", value: 0, label: "💥 Boom! Kena bom" } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const newRevealed = [...revealed, tile];
      await supabase.from("mine_sweeper_sessions").update({ revealed: newRevealed, updated_at: new Date().toISOString() }).eq("visitor_id", visitorId);
      const mult = multiplierFor(s.mines, newRevealed.length);
      const wonNow = Math.floor(s.bet * mult);
      return new Response(JSON.stringify({ success: true, status: "active", tile, revealed: newRevealed, multiplier: mult, potentialCredits: wonNow }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "cashout") {
      const revealed: number[] = s.revealed || [];
      const minePositions: number[] = s.mine_positions || [];
      if (revealed.length === 0) return new Response(JSON.stringify({ error: "Buka minimal 1 tile" }), { status: 400, headers: corsHeaders });
      const mult = multiplierFor(s.mines, revealed.length);
      let payout: { type: string; value: number; label: string };
      if (mult >= 4 && s.bet >= 5) {
        const value = Math.min(5000, Math.floor(s.bet * mult * 100));
        payout = { type: "game_balance", value, label: `Saldo Game Rp ${value.toLocaleString("id-ID")}` };
      } else {
        const value = Math.max(1, Math.floor(s.bet * mult));
        payout = { type: "game_credits", value, label: `+${value} Credits` };
      }
      await applyReward(visitorId, payout);
      await supabase.from("mine_sweeper_history").insert({
        visitor_id: visitorId, bet_credits: s.bet, mines_count: s.mines, tiles_revealed: revealed.length,
        multiplier: mult, payout_type: payout.type, payout_value: payout.value, payout_label: payout.label, status: "cashout",
      });
      await supabase.from("mine_sweeper_sessions").delete().eq("visitor_id", visitorId);
      return new Response(JSON.stringify({ success: true, status: "cashout", multiplier: mult, payout, minePositions }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Action tidak dikenal" }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
