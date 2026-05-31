import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REFRESH_COST = 5; // gem
const SPIN_COST = 25; // gem untuk spin ke-2 dst (spin pertama gratis)
const SIDE_COUNT = 8;

// Bobot rarity untuk segmen diskon roda — persen besar makin langka
const DISCOUNT_SEGMENTS = [
  { value: 5, weight: 36 },
  { value: 10, weight: 30 },
  { value: 25, weight: 18 },
  { value: 50, weight: 9 },
  { value: 80, weight: 4 },
  { value: 90, weight: 1 },
];

// Pool hadiah samping (kredit game & item streak), harga wajar dalam gem.
// Tidak ada hadiah gem (beli gem pakai gem = tidak wajar).
type Item = { id: string; label: string; emoji: string; type: string; value: number; gem: number };
const ITEM_POOL: Item[] = [
  { id: "freeze1", label: "Streak Freeze", emoji: "🛡️", type: "freeze_token", value: 1, gem: 80 },
  { id: "freeze2", label: "2× Streak Freeze", emoji: "🛡️", type: "freeze_token", value: 2, gem: 130 },
  { id: "coins200", label: "200 Koin Streak", emoji: "🪙", type: "streak_coins", value: 200, gem: 60 },
  { id: "coins500", label: "500 Koin Streak", emoji: "🪙", type: "streak_coins", value: 500, gem: 110 },
  { id: "coins1000", label: "1.000 Koin Streak", emoji: "💰", type: "streak_coins", value: 1000, gem: 180 },
  { id: "credit3", label: "3 Kredit Game", emoji: "🎮", type: "credits", value: 3, gem: 80 },
  { id: "credit5", label: "5 Kredit Game", emoji: "🎮", type: "credits", value: 5, gem: 130 },
  { id: "credit10", label: "10 Kredit Game", emoji: "🎮", type: "credits", value: 10, gem: 240 },
  { id: "credit20", label: "20 Kredit Game", emoji: "🎮", type: "credits", value: 20, gem: 450 },
];

function getToday() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().split("T")[0];
}

// PRNG deterministik dari seed (mulberry32)
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sideItems(seed: number, purchased: string[], discount: number) {
  const rng = mulberry32(seed);
  const pool = [...ITEM_POOL];
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const available = pool.filter((p) => !purchased.includes(p.id)).slice(0, SIDE_COUNT);
  return available.map((p) => ({
    ...p,
    finalGem: Math.max(1, Math.ceil(p.gem * (1 - discount / 100))),
  }));
}

function pickDiscount(rng: () => number) {
  const total = DISCOUNT_SEGMENTS.reduce((s, d) => s + d.weight, 0);
  let r = rng() * total;
  for (const d of DISCOUNT_SEGMENTS) {
    r -= d.weight;
    if (r <= 0) return d.value;
  }
  return DISCOUNT_SEGMENTS[0].value;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { visitorId, action, itemId } = await req.json();
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const today = getToday();

    // Ensure today's row
    let { data: state } = await admin
      .from("discount_spin_state")
      .select("*")
      .eq("visitor_id", visitorId)
      .eq("spin_date", today)
      .maybeSingle();

    if (!state) {
      const seed = Math.floor(Math.random() * 1_000_000_000);
      const { data: created } = await admin
        .from("discount_spin_state")
        .insert({ visitor_id: visitorId, spin_date: today, side_seed: seed })
        .select("*")
        .single();
      state = created;
    }

    const { data: gems } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
    const gemBalance = gems ?? 0;

    const buildResponse = (extra: Record<string, unknown> = {}) => {
      const items = state!.current_discount > 0
        ? sideItems(Number(state!.side_seed), state!.purchased_items || [], state!.current_discount)
        : [];
      return Response.json({
        currentDiscount: state!.current_discount,
        spinsUsed: state!.spins_used,
        boughtSinceSpin: state!.bought_since_spin,
        purchasedItems: state!.purchased_items || [],
        gems: gemBalance,
        refreshCost: REFRESH_COST,
        spinCost: SPIN_COST,
        items,
        segments: DISCOUNT_SEGMENTS.map((d) => d.value),
        ...extra,
      }, { headers: corsHeaders });
    };

    if (action === "state") {
      return buildResponse();
    }

    if (action === "spin") {
      // Spin pertama gratis; setelahnya wajib sudah beli 1 item diskon
      if (state.spins_used > 0 && !state.bought_since_spin) {
        return Response.json({ error: "Beli dulu salah satu item diskon sebelum spin lagi!" }, { status: 400, headers: corsHeaders });
      }
      const rng = mulberry32(Math.floor(Math.random() * 1_000_000_000) ^ Date.now());
      const discount = pickDiscount(rng);
      const newSeed = Math.floor(Math.random() * 1_000_000_000);
      const { data: updated } = await admin
        .from("discount_spin_state")
        .update({
          current_discount: discount,
          spins_used: state.spins_used + 1,
          bought_since_spin: false,
          side_seed: newSeed,
        })
        .eq("id", state.id)
        .select("*")
        .single();
      state = updated;
      return buildResponse({ wonDiscount: discount });
    }

    if (action === "refresh") {
      if (state.current_discount <= 0) {
        return Response.json({ error: "Spin dulu untuk dapat diskon." }, { status: 400, headers: corsHeaders });
      }
      if (gemBalance < REFRESH_COST) {
        return Response.json({ error: `Butuh ${REFRESH_COST} gem untuk refresh hadiah.` }, { status: 400, headers: corsHeaders });
      }
      await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -REFRESH_COST });
      const newSeed = Math.floor(Math.random() * 1_000_000_000);
      const { data: updated } = await admin
        .from("discount_spin_state")
        .update({ side_seed: newSeed, refresh_count: (state.refresh_count || 0) + 1 })
        .eq("id", state.id)
        .select("*")
        .single();
      state = updated;
      const { data: g2 } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      return Response.json({
        currentDiscount: state!.current_discount,
        spinsUsed: state!.spins_used,
        boughtSinceSpin: state!.bought_since_spin,
        purchasedItems: state!.purchased_items || [],
        gems: g2 ?? 0,
        refreshCost: REFRESH_COST,
        items: sideItems(Number(state!.side_seed), state!.purchased_items || [], state!.current_discount),
        segments: DISCOUNT_SEGMENTS.map((d) => d.value),
      }, { headers: corsHeaders });
    }

    if (action === "buy") {
      if (state.current_discount <= 0) {
        return Response.json({ error: "Spin dulu untuk dapat diskon." }, { status: 400, headers: corsHeaders });
      }
      const item = ITEM_POOL.find((p) => p.id === itemId);
      if (!item) return Response.json({ error: "Item tidak ditemukan." }, { status: 400, headers: corsHeaders });
      if ((state.purchased_items || []).includes(item.id)) {
        return Response.json({ error: "Item ini sudah dibeli." }, { status: 400, headers: corsHeaders });
      }
      // Item harus ada di daftar yang sedang tampil
      const showing = sideItems(Number(state.side_seed), state.purchased_items || [], state.current_discount);
      const live = showing.find((s) => s.id === item.id);
      if (!live) return Response.json({ error: "Item tidak tersedia. Refresh dulu." }, { status: 400, headers: corsHeaders });

      const cost = live.finalGem;
      if (gemBalance < cost) {
        return Response.json({ error: `Gem tidak cukup. Butuh ${cost} gem.` }, { status: 400, headers: corsHeaders });
      }

      // Bayar gem
      await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -cost });

      // Berikan hadiah
      if (item.type === "gems") {
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: item.value });
      } else if (item.type === "credits") {
        await admin.rpc("add_account_credits", { p_visitor_id: visitorId, p_amount: item.value });
      } else if (item.type === "streak_coins" || item.type === "freeze_token") {
        const { data: ds } = await admin.from("daily_streaks").select("id, streak_coins, freeze_count").eq("visitor_id", visitorId).maybeSingle();
        if (ds) {
          const patch = item.type === "streak_coins"
            ? { streak_coins: (ds.streak_coins || 0) + item.value }
            : { freeze_count: (ds.freeze_count || 0) + item.value };
          await admin.from("daily_streaks").update(patch).eq("id", ds.id);
        } else {
          const ins = item.type === "streak_coins"
            ? { visitor_id: visitorId, streak_coins: item.value }
            : { visitor_id: visitorId, freeze_count: item.value };
          await admin.from("daily_streaks").insert(ins);
        }
      }

      const { data: updated } = await admin
        .from("discount_spin_state")
        .update({
          purchased_items: [...(state.purchased_items || []), item.id],
          bought_since_spin: true,
        })
        .eq("id", state.id)
        .select("*")
        .single();
      state = updated;

      await admin.rpc("create_notification", {
        p_visitor_id: visitorId,
        p_title: "🎡 Roda Diskon",
        p_message: `Kamu beli ${item.label} dengan diskon ${live.finalGem < item.gem ? Math.round((1 - live.finalGem / item.gem) * 100) : 0}% (${cost} gem).`,
        p_type: "success",
      });

      const { data: g3 } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      return Response.json({
        success: true,
        bought: { ...live },
        currentDiscount: state!.current_discount,
        spinsUsed: state!.spins_used,
        boughtSinceSpin: state!.bought_since_spin,
        purchasedItems: state!.purchased_items || [],
        gems: g3 ?? 0,
        refreshCost: REFRESH_COST,
        items: sideItems(Number(state!.side_seed), state!.purchased_items || [], state!.current_discount),
        segments: DISCOUNT_SEGMENTS.map((d) => d.value),
      }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
