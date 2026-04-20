import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REWARD_POOL = [
  { type: "auto_hint",     value: 3,   label: "+3 Hint Otomatis",  icon: "💡", coin: 200, gem: 12 },
  { type: "extra_life",    value: 2,   label: "+2 Nyawa Ekstra",   icon: "❤️", coin: 250, gem: 15 },
  { type: "streak_freeze", value: 1,   label: "+1 Streak Freeze",  icon: "🧊", coin: 300, gem: 18 },
  { type: "double_xp",     value: 2,   label: "Double XP 2 Jam",   icon: "⚡", coin: 400, gem: 22 },
  { type: "streak_coins",  value: 500, label: "+500 Koin Bonus",   icon: "🪙", coin: 0,   gem: 25 },
  { type: "time_freeze",   value: 3,   label: "+3 Time Freeze",    icon: "⏱️", coin: 350, gem: 20 },
];

function wibDateStr(offsetDays = 0): string {
  const wib = new Date(Date.now() + (7 * 60 + offsetDays * 24 * 60) * 60 * 1000);
  return wib.toISOString().split("T")[0];
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

function pickWeighted<T extends { weight: number }>(arr: T[]): T {
  const total = arr.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const x of arr) { r -= x.weight; if (r <= 0) return x; }
  return arr[arr.length - 1];
}

// Slot UTC waktu sesuai WIB
const SLOTS = [
  { key: "morning",   wibHour: 10, durationH: 3 },
  { key: "afternoon", wibHour: 15, durationH: 3 },
  { key: "evening",   wibHour: 20, durationH: 3 },
];

function wibSlotToUTC(dateStr: string, wibHour: number, durationH: number) {
  const start = new Date(`${dateStr}T${String(wibHour).padStart(2, "0")}:00:00+07:00`);
  const end = new Date(start.getTime() + durationH * 3600 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function generate(admin: ReturnType<typeof createClient>) {
  const today = wibDateStr();

  // ===== AUTO FLASH SALES =====
  // Ambil produk aktif untuk variasi
  const { data: products } = await admin
    .from("products")
    .select("id,title,price,image_url")
    .order("created_at", { ascending: false })
    .limit(30);

  const productPool = (products ?? []).filter((p: any) => p.price > 0);

  const inserts: any[] = [];

  for (let i = 0; i < SLOTS.length; i++) {
    const slot = SLOTS[i];
    const { start, end } = wibSlotToUTC(today, slot.wibHour, slot.durationH);

    // Slot pagi & malam = produk, sore = reward → biar variatif tiap hari beda
    const isReward = i === 1; // sore = reward
    if (!isReward && productPool.length > 0) {
      const product = productPool[Math.floor(Math.random() * productPool.length)];
      const discount = 15 + Math.floor(Math.random() * 36); // 15-50%
      const flashPrice = Math.floor(product.price * (1 - discount / 100));
      inserts.push({
        sale_date: today,
        session_slot: slot.key,
        content_type: "product",
        target_id: product.id,
        target_kind: "product",
        title: product.title,
        description: `Diskon ${discount}% — terbatas!`,
        icon: "🛍️",
        discount_percent: discount,
        original_price: product.price,
        flash_price: flashPrice,
        total_stock: 50 + Math.floor(Math.random() * 50),
        starts_at: start,
        ends_at: end,
      });
    } else {
      // Reward: pilih 3 reward random
      const rewards = pickRandom(REWARD_POOL, 3);
      for (const r of rewards) {
        const discount = 30 + Math.floor(Math.random() * 41); // 30-70%
        const baseCoin = r.coin || 100;
        const baseGem = r.gem || 10;
        const flashCoin = Math.floor(baseCoin * (1 - discount / 100));
        const flashGem = Math.floor(baseGem * (1 - discount / 100));
        inserts.push({
          sale_date: today,
          session_slot: slot.key,
          content_type: "reward",
          target_kind: "reward",
          title: r.label,
          description: `${r.icon} Hemat ${discount}% — flash deal!`,
          icon: r.icon,
          discount_percent: discount,
          reward_type: r.type,
          reward_value: r.value,
          cost_coins: flashCoin,
          cost_gems: flashGem,
          original_price: baseCoin,
          flash_price: flashCoin,
          total_stock: 30 + Math.floor(Math.random() * 30),
          starts_at: start,
          ends_at: end,
        });
      }
    }
  }

  if (inserts.length > 0) {
    await admin.from("auto_flash_sales").upsert(inserts, {
      onConflict: "sale_date,session_slot,content_type,target_id",
      ignoreDuplicates: true,
    });
  }

  // ===== MYSTERY BOX DROPS (4x sehari, tiap 6 jam) =====
  const mysteryDrops: any[] = [];
  for (let slot = 0; slot < 4; slot++) {
    const wibHour = slot * 6; // 0, 6, 12, 18
    const { start, end } = wibSlotToUTC(today, wibHour, 6);
    const pool = pickRandom(REWARD_POOL, 4).map((r, idx) => ({
      label: r.label,
      type: r.type,
      value: r.value,
      icon: r.icon,
      rarity: ["common", "rare", "epic", "legendary"][idx],
      weight: [50, 30, 15, 5][idx],
    }));
    mysteryDrops.push({
      drop_date: today,
      slot_index: slot,
      starts_at: start,
      ends_at: end,
      total_stock: 200 + Math.floor(Math.random() * 300),
      rarity_pool: pool,
    });
  }

  await admin.from("mystery_box_drops").upsert(mysteryDrops, {
    onConflict: "drop_date,slot_index",
    ignoreDuplicates: true,
  });

  return { ok: true, flash_sales: inserts.length, mystery_drops: mysteryDrops.length };
}

async function tick(admin: ReturnType<typeof createClient>) {
  const now = new Date().toISOString();
  // Activate yang sudah waktunya, deactivate yg expired
  await admin.from("auto_flash_sales").update({ is_active: true }).lte("starts_at", now).gte("ends_at", now).eq("is_active", false);
  await admin.from("auto_flash_sales").update({ is_active: false }).lt("ends_at", now).eq("is_active", true);
  await admin.from("mystery_box_drops").update({ is_active: true }).lte("starts_at", now).gte("ends_at", now).eq("is_active", false);
  await admin.from("mystery_box_drops").update({ is_active: false }).lt("ends_at", now).eq("is_active", true);
  return { ok: true, ticked_at: now };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "list";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (action === "generate") {
      const r = await generate(admin);
      return Response.json(r, { headers: corsHeaders });
    }

    if (action === "tick") {
      const r = await tick(admin);
      return Response.json(r, { headers: corsHeaders });
    }

    if (action === "list") {
      // Jika belum ada hari ini, generate dulu
      const today = wibDateStr();
      const { data: existing } = await admin.from("auto_flash_sales").select("id").eq("sale_date", today).limit(1);
      if (!existing || existing.length === 0) await generate(admin);

      const nowIso = new Date().toISOString();
      const [{ data: active }, { data: upcoming }, { data: drops }] = await Promise.all([
        admin.from("auto_flash_sales").select("*").eq("sale_date", today).lte("starts_at", nowIso).gte("ends_at", nowIso).order("session_slot"),
        admin.from("auto_flash_sales").select("*").eq("sale_date", today).gt("starts_at", nowIso).order("starts_at").limit(6),
        admin.from("mystery_box_drops").select("*").eq("drop_date", today).order("slot_index"),
      ]);

      return Response.json({
        active: active ?? [],
        upcoming: upcoming ?? [],
        mystery_drops: drops ?? [],
        date: today,
        server_time: nowIso,
      }, { headers: corsHeaders });
    }

    if (action === "purchase_flash") {
      const body = await req.json();
      const { saleId, visitorId, paymentMethod = "coin" } = body;
      if (!saleId || !visitorId) return Response.json({ error: "saleId & visitorId required" }, { status: 400, headers: corsHeaders });

      const { data: sale } = await admin.from("auto_flash_sales").select("*").eq("id", saleId).maybeSingle();
      if (!sale) return Response.json({ error: "Flash sale tidak ditemukan" }, { status: 404, headers: corsHeaders });

      const now = Date.now();
      if (now < new Date(sale.starts_at).getTime() || now > new Date(sale.ends_at).getTime()) {
        return Response.json({ error: "Flash sale tidak aktif" }, { status: 400, headers: corsHeaders });
      }
      if (sale.sold_count >= sale.total_stock) return Response.json({ error: "Stok habis!" }, { status: 400, headers: corsHeaders });

      if (sale.content_type !== "reward") {
        return Response.json({ error: "Untuk produk silakan checkout via WhatsApp" }, { status: 400, headers: corsHeaders });
      }

      // Cek 1x per sesi
      const { data: prev } = await admin.from("auto_flash_sale_purchases").select("id").eq("sale_id", saleId).eq("visitor_id", visitorId).maybeSingle();
      if (prev) return Response.json({ error: "Sudah dibeli sesi ini" }, { status: 400, headers: corsHeaders });

      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (!streak) return Response.json({ error: "Mulai streak harian dulu" }, { status: 400, headers: corsHeaders });

      let costPaid = 0;
      if (paymentMethod === "gem") {
        const cost = sale.cost_gems || 0;
        const { data: gemTotal } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
        if ((Number(gemTotal) || 0) < cost) return Response.json({ error: `Gem kurang. Butuh ${cost} 💎` }, { status: 400, headers: corsHeaders });
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -cost });
        await admin.from("gem_transactions").insert({ visitor_id: visitorId, amount: -cost, type: "auto_flash_sale", description: `Flash Sale: ${sale.title}` });
        costPaid = cost;
      } else {
        const cost = sale.cost_coins || 0;
        if ((streak.streak_coins || 0) < cost) return Response.json({ error: `Koin kurang. Butuh ${cost} 🪙` }, { status: 400, headers: corsHeaders });
        await admin.from("daily_streaks").update({ streak_coins: streak.streak_coins - cost }).eq("id", streak.id);
        costPaid = cost;
      }

      // Apply reward
      const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
      const updates: any = {};
      if (sale.reward_type === "auto_hint") updates.auto_hint = (pu?.auto_hint || 0) + sale.reward_value;
      else if (sale.reward_type === "extra_life") updates.extra_life = (pu?.extra_life || 0) + sale.reward_value;
      else if (sale.reward_type === "time_freeze") updates.time_freeze = (pu?.time_freeze || 0) + sale.reward_value;
      else if (sale.reward_type === "double_xp") {
        const baseMs = pu?.double_xp_until && new Date(pu.double_xp_until).getTime() > Date.now() ? new Date(pu.double_xp_until).getTime() : Date.now();
        updates.double_xp_until = new Date(baseMs + sale.reward_value * 3600 * 1000).toISOString();
      } else if (sale.reward_type === "streak_freeze") {
        await admin.from("daily_streaks").update({ freeze_count: (streak.freeze_count || 0) + sale.reward_value }).eq("id", streak.id);
      } else if (sale.reward_type === "streak_coins") {
        await admin.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) - costPaid + sale.reward_value }).eq("id", streak.id);
      }

      if (Object.keys(updates).length > 0) {
        if (pu) await admin.from("user_power_ups").update(updates).eq("visitor_id", visitorId);
        else await admin.from("user_power_ups").insert({ visitor_id: visitorId, ...updates });
      }

      await admin.from("auto_flash_sales").update({ sold_count: sale.sold_count + 1 }).eq("id", saleId);
      await admin.from("auto_flash_sale_purchases").insert({
        sale_id: saleId, visitor_id: visitorId, cost_paid: costPaid, payment_method: paymentMethod,
        reward_type: sale.reward_type, reward_value: sale.reward_value,
      });

      return Response.json({ success: true, reward_label: sale.title, cost_paid: costPaid, payment_method: paymentMethod }, { headers: corsHeaders });
    }

    if (action === "spin_status") {
      const visitorId = url.searchParams.get("visitorId");
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });
      const today = wibDateStr();
      const [{ data: claim }, { data: segs }] = await Promise.all([
        admin.from("daily_free_spin_claims").select("*").eq("visitor_id", visitorId).eq("spin_date", today).maybeSingle(),
        admin.from("daily_free_spin_segments").select("*").eq("is_active", true).order("sort_order"),
      ]);
      return Response.json({ claimed_today: !!claim, claim, segments: segs ?? [], date: today }, { headers: corsHeaders });
    }

    if (action === "spin") {
      const body = await req.json();
      const { visitorId } = body;
      if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });
      const today = wibDateStr();

      const { data: existing } = await admin.from("daily_free_spin_claims").select("id").eq("visitor_id", visitorId).eq("spin_date", today).maybeSingle();
      if (existing) return Response.json({ error: "Sudah spin hari ini, balik lagi besok!" }, { status: 400, headers: corsHeaders });

      const { data: segs } = await admin.from("daily_free_spin_segments").select("*").eq("is_active", true);
      if (!segs || segs.length === 0) return Response.json({ error: "Belum ada segmen wheel" }, { status: 400, headers: corsHeaders });

      const winner = pickWeighted(segs as any);

      // Apply reward
      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (winner.reward_type === "streak_coins" && streak) {
        await admin.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) + winner.reward_value }).eq("id", streak.id);
      } else if (winner.reward_type === "streak_freeze" && streak) {
        await admin.from("daily_streaks").update({ freeze_count: (streak.freeze_count || 0) + winner.reward_value }).eq("id", streak.id);
      } else if (winner.reward_type === "gem") {
        await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: winner.reward_value });
        await admin.from("gem_transactions").insert({ visitor_id: visitorId, amount: winner.reward_value, type: "free_spin", description: `Free Spin: ${winner.label}` });
      } else if (["auto_hint", "extra_life", "time_freeze"].includes(winner.reward_type)) {
        const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
        const upd: any = { [winner.reward_type]: (pu?.[winner.reward_type] || 0) + winner.reward_value };
        if (pu) await admin.from("user_power_ups").update(upd).eq("visitor_id", visitorId);
        else await admin.from("user_power_ups").insert({ visitor_id: visitorId, ...upd });
      } else if (winner.reward_type === "double_xp") {
        const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
        const baseMs = pu?.double_xp_until && new Date(pu.double_xp_until).getTime() > Date.now() ? new Date(pu.double_xp_until).getTime() : Date.now();
        const newUntil = new Date(baseMs + winner.reward_value * 3600 * 1000).toISOString();
        if (pu) await admin.from("user_power_ups").update({ double_xp_until: newUntil }).eq("visitor_id", visitorId);
        else await admin.from("user_power_ups").insert({ visitor_id: visitorId, double_xp_until: newUntil });
      }

      await admin.from("daily_free_spin_claims").insert({
        visitor_id: visitorId, spin_date: today, segment_id: winner.id,
        reward_label: winner.label, reward_type: winner.reward_type, reward_value: winner.reward_value,
      });

      return Response.json({ success: true, segment: winner }, { headers: corsHeaders });
    }

    if (action === "mystery_open") {
      const body = await req.json();
      const { dropId, visitorId } = body;
      if (!dropId || !visitorId) return Response.json({ error: "dropId & visitorId required" }, { status: 400, headers: corsHeaders });

      const { data: drop } = await admin.from("mystery_box_drops").select("*").eq("id", dropId).maybeSingle();
      if (!drop) return Response.json({ error: "Drop tidak ditemukan" }, { status: 404, headers: corsHeaders });

      const now = Date.now();
      if (now < new Date(drop.starts_at).getTime() || now > new Date(drop.ends_at).getTime()) {
        return Response.json({ error: "Mystery box tidak aktif" }, { status: 400, headers: corsHeaders });
      }
      if (drop.opened_count >= drop.total_stock) return Response.json({ error: "Box sudah habis!" }, { status: 400, headers: corsHeaders });

      const { data: existing } = await admin.from("mystery_box_drop_claims").select("id").eq("drop_id", dropId).eq("visitor_id", visitorId).maybeSingle();
      if (existing) return Response.json({ error: "Sudah dibuka sesi ini" }, { status: 400, headers: corsHeaders });

      const pool = drop.rarity_pool as any[];
      const winner: any = pickWeighted(pool);

      // Apply reward (sama dengan spin)
      const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
      if (winner.type === "streak_coins" && streak) {
        await admin.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) + winner.value }).eq("id", streak.id);
      } else if (winner.type === "streak_freeze" && streak) {
        await admin.from("daily_streaks").update({ freeze_count: (streak.freeze_count || 0) + winner.value }).eq("id", streak.id);
      } else if (winner.type === "double_xp") {
        const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
        const baseMs = pu?.double_xp_until && new Date(pu.double_xp_until).getTime() > Date.now() ? new Date(pu.double_xp_until).getTime() : Date.now();
        const newUntil = new Date(baseMs + winner.value * 3600 * 1000).toISOString();
        if (pu) await admin.from("user_power_ups").update({ double_xp_until: newUntil }).eq("visitor_id", visitorId);
        else await admin.from("user_power_ups").insert({ visitor_id: visitorId, double_xp_until: newUntil });
      } else if (["auto_hint", "extra_life", "time_freeze"].includes(winner.type)) {
        const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
        const upd: any = { [winner.type]: (pu?.[winner.type] || 0) + winner.value };
        if (pu) await admin.from("user_power_ups").update(upd).eq("visitor_id", visitorId);
        else await admin.from("user_power_ups").insert({ visitor_id: visitorId, ...upd });
      }

      await admin.from("mystery_box_drops").update({ opened_count: drop.opened_count + 1 }).eq("id", dropId);
      await admin.from("mystery_box_drop_claims").insert({
        drop_id: dropId, visitor_id: visitorId,
        reward_label: winner.label, reward_type: winner.type, reward_value: winner.value, rarity: winner.rarity,
      });

      return Response.json({ success: true, reward: winner }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
