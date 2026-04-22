import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Item {
  code: string;
  name: string;
  icon: string;
  rarity: string;
  weight: number;
}

function todayWIB() {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

function nextMidnightWIB(): string {
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  wib.setUTCHours(24, 0, 0, 0);
  return new Date(wib.getTime() - 7 * 60 * 60 * 1000).toISOString();
}

function rollItems(pool: Item[], count: number): Item[] {
  const out: Item[] = [];
  const total = pool.reduce((s, i) => s + i.weight, 0);
  for (let i = 0; i < count; i++) {
    let r = Math.random() * total;
    for (const it of pool) {
      r -= it.weight;
      if (r <= 0) { out.push(it); break; }
    }
  }
  return out;
}

async function addInventory(supabase: any, visitorId: string, items: Item[]) {
  // Aggregate counts
  const counts: Record<string, number> = {};
  for (const it of items) counts[it.code] = (counts[it.code] || 0) + 1;
  for (const [code, qty] of Object.entries(counts)) {
    const { data: existing } = await supabase
      .from("streak_power_pack_inventory")
      .select("id, quantity")
      .eq("visitor_id", visitorId)
      .eq("item_code", code)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("streak_power_pack_inventory")
        .update({ quantity: existing.quantity + qty, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("streak_power_pack_inventory")
        .insert({ visitor_id: visitorId, item_code: code, quantity: qty });
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json();
    const { action, visitorId } = body;

    if (!visitorId) {
      return new Response(JSON.stringify({ error: "visitorId required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== LIST =====
    if (action === "list") {
      const [packsRes, itemsRes, subsRes, invRes, claimsRes] = await Promise.all([
        supabase.from("streak_power_packs").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("streak_power_pack_items").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("streak_power_pack_subscriptions").select("*").eq("visitor_id", visitorId).eq("is_active", true).gt("expires_at", new Date().toISOString()),
        supabase.from("streak_power_pack_inventory").select("*").eq("visitor_id", visitorId),
        supabase.from("streak_power_pack_claims").select("*").eq("visitor_id", visitorId).eq("claim_date", todayWIB()).eq("is_instant", false),
      ]);

      // Get user balance for purchase
      const { data: gameProfile } = await supabase
        .from("game_profiles")
        .select("user_balance_id")
        .eq("visitor_id", visitorId)
        .maybeSingle();

      let mainBalance = 0;
      let gameBalance = 0;
      if (gameProfile?.user_balance_id) {
        const { data: bal } = await supabase
          .from("user_balances")
          .select("balance")
          .eq("id", gameProfile.user_balance_id)
          .maybeSingle();
        mainBalance = bal?.balance || 0;
      }

      const claimedToday: Record<string, boolean> = {};
      for (const c of claimsRes.data || []) {
        if (c.subscription_id) claimedToday[c.subscription_id] = true;
      }

      return new Response(JSON.stringify({
        packs: packsRes.data || [],
        items: itemsRes.data || [],
        subscriptions: subsRes.data || [],
        inventory: invRes.data || [],
        claimed_today_map: claimedToday,
        main_balance: mainBalance,
        game_balance: gameBalance,
        next_unlock: nextMidnightWIB(),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== PURCHASE =====
    if (action === "purchase") {
      const { packId } = body;
      const { data: pack } = await supabase.from("streak_power_packs").select("*").eq("id", packId).eq("is_active", true).maybeSingle();
      if (!pack) return new Response(JSON.stringify({ error: "Paket tidak ditemukan" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Check & deduct balance
      const { data: gp } = await supabase.from("game_profiles").select("user_balance_id").eq("visitor_id", visitorId).maybeSingle();
      if (!gp?.user_balance_id) {
        return new Response(JSON.stringify({ error: "Login akun saldo dulu untuk pembelian" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: bal } = await supabase.from("user_balances").select("id, balance").eq("id", gp.user_balance_id).maybeSingle();
      if (!bal || bal.balance < pack.price_idr) {
        return new Response(JSON.stringify({ error: `Saldo tidak cukup. Butuh Rp${pack.price_idr.toLocaleString("id-ID")}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await supabase.from("user_balances").update({ balance: bal.balance - pack.price_idr }).eq("id", bal.id);

      // Cek apakah ada subscription aktif untuk pack yang sama → extend (perpanjang) durasinya
      const nowIso = new Date().toISOString();
      const { data: existingSub } = await supabase
        .from("streak_power_pack_subscriptions")
        .select("*")
        .eq("visitor_id", visitorId)
        .eq("pack_id", pack.id)
        .eq("is_active", true)
        .gt("expires_at", nowIso)
        .order("expires_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let sub: any;
      if (existingSub) {
        // Extend dari expires_at lama (stack durasi)
        const base = new Date(existingSub.expires_at);
        base.setDate(base.getDate() + pack.duration_days);
        const { data: updated } = await supabase
          .from("streak_power_pack_subscriptions")
          .update({ expires_at: base.toISOString() })
          .eq("id", existingSub.id)
          .select()
          .single();
        sub = updated;
      } else {
        // Buat subscription baru
        const expires = new Date();
        expires.setDate(expires.getDate() + pack.duration_days);
        const { data: created } = await supabase.from("streak_power_pack_subscriptions").insert({
          visitor_id: visitorId,
          pack_id: pack.id,
          pack_name: pack.name,
          expires_at: expires.toISOString(),
        }).select().single();
        sub = created;
      }

      // Instant rewards
      const { data: items } = await supabase.from("streak_power_pack_items").select("*").eq("is_active", true);
      const pool = items || [];
      let instantItems: Item[] = [];
      if (pack.instant_full_pack) {
        // Premium: kasih 2 dari setiap item
        instantItems = pool.flatMap((it: any) => [it, it]);
      } else if (pack.instant_item_count > 0) {
        instantItems = rollItems(pool, pack.instant_item_count);
      }
      if (instantItems.length > 0) {
        await addInventory(supabase, visitorId, instantItems);
        await supabase.from("streak_power_pack_claims").insert({
          visitor_id: visitorId,
          subscription_id: sub.id,
          pack_id: pack.id,
          items_awarded: instantItems.map((i) => ({ code: i.code, name: i.name, icon: i.icon, rarity: i.rarity })),
          is_instant: true,
        });
      }

      return new Response(JSON.stringify({
        success: true,
        pack_name: pack.name,
        expires_at: expires.toISOString(),
        instant_items: instantItems.map((i) => ({ code: i.code, name: i.name, icon: i.icon, rarity: i.rarity })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== DAILY CLAIM =====
    if (action === "daily-claim") {
      const { subscriptionId } = body;
      const { data: sub } = await supabase
        .from("streak_power_pack_subscriptions")
        .select("*, streak_power_packs(*)")
        .eq("id", subscriptionId)
        .eq("visitor_id", visitorId)
        .eq("is_active", true)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (!sub) return new Response(JSON.stringify({ error: "Langganan tidak aktif" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Check today's claim
      const { data: existing } = await supabase
        .from("streak_power_pack_claims")
        .select("id")
        .eq("visitor_id", visitorId)
        .eq("subscription_id", subscriptionId)
        .eq("claim_date", todayWIB())
        .eq("is_instant", false)
        .maybeSingle();
      if (existing) return new Response(JSON.stringify({ error: "Sudah klaim hari ini" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const pack = sub.streak_power_packs;
      const { data: items } = await supabase.from("streak_power_pack_items").select("*").eq("is_active", true);
      const pool = items || [];
      const count = Math.floor(Math.random() * (pack.daily_item_max - pack.daily_item_min + 1)) + pack.daily_item_min;
      const rolled = rollItems(pool, count);
      await addInventory(supabase, visitorId, rolled);
      await supabase.from("streak_power_pack_claims").insert({
        visitor_id: visitorId,
        subscription_id: subscriptionId,
        pack_id: pack.id,
        items_awarded: rolled.map((i) => ({ code: i.code, name: i.name, icon: i.icon, rarity: i.rarity })),
        is_instant: false,
      });

      return new Response(JSON.stringify({
        success: true,
        items: rolled.map((i) => ({ code: i.code, name: i.name, icon: i.icon, rarity: i.rarity })),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
