import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const ok = (b: unknown, status = 200) => Response.json(b, { status, headers: corsHeaders });

function generateCode(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = prefix + "-";
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function todayWIB(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
function endOfDayWIB(): string {
  const d = todayWIB();
  return new Date(new Date(d + "T00:00:00Z").getTime() + 17 * 3600 * 1000).toISOString();
}
const DAILY_DEAL_PCT = 25;
const DAILY_DEAL_COUNT = 3;

// Deterministic daily deal pick (server-side, same for every user per WIB day)
function dailyDealIds(items: any[]): string[] {
  const seedStr = todayWIB();
  let seed = 0;
  for (const c of seedStr) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
  const pool = items.filter((i) => !i.plus_only && i.cost_coins > 0).sort((a, b) => a.id.localeCompare(b.id));
  const out: string[] = [];
  while (out.length < DAILY_DEAL_COUNT && pool.length > 0) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    out.push(pool.splice(seed % pool.length, 1)[0].id);
  }
  return out;
}

function effectivePrice(item: any, dealIds: string[]) {
  const now = Date.now();
  if (item.sale_price_coins && item.sale_ends_at && new Date(item.sale_ends_at).getTime() > now) {
    return { coins: item.sale_price_coins, source: "flash" as const, endsAt: item.sale_ends_at };
  }
  if (dealIds.includes(item.id)) {
    return { coins: Math.round(item.cost_coins * (100 - DAILY_DEAL_PCT) / 100), source: "daily" as const, endsAt: endOfDayWIB() };
  }
  return { coins: item.cost_coins, source: "normal" as const, endsAt: null };
}

const COSMETIC = (t: string) => t.startsWith("cosmetic_");
const MYSTERY_TABLE = [
  { rarity: "common", w: 55, coins: 40 },
  { rarity: "rare", w: 25, coins: 150 },
  { rarity: "epic", w: 13, coins: 400 },
  { rarity: "legendary", w: 6, coins: 1200 },
  { rarity: "mythic", w: 1, coins: 4000 },
];
function rollMystery(luck = 1) {
  // luck >1 shifts weight to higher rarities
  const table = MYSTERY_TABLE.map((r, i) => ({ ...r, w: i === 0 ? r.w / luck : r.w * (i >= 2 ? luck : 1) }));
  const total = table.reduce((s, r) => s + r.w, 0);
  let x = Math.random() * total;
  for (const r of table) { if ((x -= r.w) <= 0) return r; }
  return table[0];
}

async function activePlus(admin: any, visitorId: string) {
  const { data } = await admin
    .from("streak_user_memberships")
    .select("plan_id, plan_name, expires_at, bonus_multiplier, streak_membership_plans!inner(category)")
    .eq("visitor_id", visitorId).eq("is_active", true).gte("expires_at", new Date().toISOString())
    .eq("streak_membership_plans.category", "plus")
    .order("bonus_multiplier", { ascending: false }).limit(1);
  return data?.[0] || null;
}

async function addInventory(admin: any, visitorId: string, item: any) {
  const isTimed = item.reward_type === "streak_boost";
  const { data: existing } = await admin.from("streak_shop_inventory").select("*")
    .eq("visitor_id", visitorId).eq("item_id", item.id).maybeSingle();
  if (existing) {
    const upd: Record<string, unknown> = {};
    if (isTimed) {
      const base = existing.expires_at && new Date(existing.expires_at).getTime() > Date.now() ? new Date(existing.expires_at).getTime() : Date.now();
      upd.expires_at = new Date(base + (item.duration_hours || 72) * 3600 * 1000).toISOString();
    } else if (!COSMETIC(item.reward_type)) {
      upd.quantity = (existing.quantity || 0) + 1;
    }
    if (Object.keys(upd).length) await admin.from("streak_shop_inventory").update(upd).eq("id", existing.id);
  } else {
    await admin.from("streak_shop_inventory").insert({
      visitor_id: visitorId, item_id: item.id, reward_type: item.reward_type, item_name: item.name, icon: item.icon,
      rarity: item.rarity, quantity: 1,
      expires_at: isTimed ? new Date(Date.now() + (item.duration_hours || 72) * 3600 * 1000).toISOString() : null,
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { visitorId, itemId, paymentMethod, action = "buy", inventoryId } = body || {};
    if (!visitorId || typeof visitorId !== "string") return ok({ error: "visitorId required" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ---------- CATALOG ----------
    if (action === "catalog") {
      const [{ data: items }, { data: streak }, plus, { data: inv }] = await Promise.all([
        admin.from("streak_shop_items").select("*").eq("is_active", true).order("sort_order"),
        admin.from("daily_streaks").select("current_streak, streak_coins").eq("visitor_id", visitorId).maybeSingle(),
        activePlus(admin, visitorId),
        admin.from("streak_shop_inventory").select("item_id, quantity").eq("visitor_id", visitorId),
      ]);
      const dealIds = dailyDealIds(items || []);
      const owned = new Map((inv || []).map((r: any) => [r.item_id, r.quantity]));
      const cur = streak?.current_streak || 0;
      const list = (items || []).map((it: any) => {
        const p = effectivePrice(it, dealIds);
        return {
          ...it, price_coins: p.coins, price_source: p.source, price_ends_at: p.endsAt,
          locked_streak: cur < (it.required_streak || 0), locked_plus: !!it.plus_only && !plus,
          owned_qty: owned.get(it.id) || 0,
        };
      });
      return ok({ items: list, dailyDealIds: dealIds, dailyDealPct: DAILY_DEAL_PCT, currentStreak: cur, coins: streak?.streak_coins || 0, plus, serverNow: new Date().toISOString() });
    }

    // ---------- INVENTORY ----------
    if (action === "inventory") {
      const { data } = await admin.from("streak_shop_inventory").select("*").eq("visitor_id", visitorId).order("created_at", { ascending: false });
      return ok({ inventory: data || [], today: todayWIB(), serverNow: new Date().toISOString() });
    }

    if (action === "equip" || action === "unequip") {
      const { data: row } = await admin.from("streak_shop_inventory").select("*").eq("id", inventoryId).eq("visitor_id", visitorId).maybeSingle();
      if (!row) return ok({ error: "Item tidak ada di inventory" });
      if (!COSMETIC(row.reward_type)) return ok({ error: "Item ini tidak bisa dipasang" });
      if (action === "equip") {
        await admin.from("streak_shop_inventory").update({ is_equipped: false }).eq("visitor_id", visitorId).eq("reward_type", row.reward_type);
      }
      await admin.from("streak_shop_inventory").update({ is_equipped: action === "equip" }).eq("id", row.id);
      return ok({ success: true });
    }

    // Use consumable item: mystery box
    if (action === "use") {
      const { data: row } = await admin.from("streak_shop_inventory").select("*").eq("id", inventoryId).eq("visitor_id", visitorId).maybeSingle();
      if (!row || row.quantity <= 0) return ok({ error: "Item habis" });
      if (row.reward_type !== "mystery_box") return ok({ error: "Item ini aktif otomatis saat klaim streak" });
      const { data: item } = await admin.from("streak_shop_items").select("reward_value").eq("id", row.item_id).maybeSingle();
      const { data: dec } = await admin.from("streak_shop_inventory").update({ quantity: row.quantity - 1 }).eq("id", row.id).eq("quantity", row.quantity).select("id");
      if (!dec?.length) return ok({ error: "Coba lagi" });
      const roll = rollMystery(item?.reward_value && item.reward_value > 1 ? 2 : 1);
      const { data: st } = await admin.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
      if (st) await admin.from("daily_streaks").update({ streak_coins: (st.streak_coins || 0) + roll.coins }).eq("id", st.id);
      return ok({ success: true, rarity: roll.rarity, coins: roll.coins });
    }

    // Apply boosts after today's claim (server validates claim happened today, once per day)
    if (action === "claim_bonus") {
      const today = todayWIB();
      const { data: st } = await admin.from("daily_streaks").select("id, streak_coins, last_claim_date, current_multiplier").eq("visitor_id", visitorId).maybeSingle();
      if (!st || st.last_claim_date !== today) return ok({ error: "Klaim streak hari ini dulu" });
      const base = Math.max(10, Math.round(10 * Number(st.current_multiplier || 1)));
      const { data: inv } = await admin.from("streak_shop_inventory").select("*").eq("visitor_id", visitorId)
        .in("reward_type", ["streak_boost", "double_reward", "lucky_boost"]);
      let bonus = 0;
      const applied: string[] = [];
      for (const r of inv || []) {
        if (r.last_applied_date === today) continue;
        if (r.reward_type === "streak_boost") {
          if (!r.expires_at || new Date(r.expires_at).getTime() < Date.now()) continue;
          bonus += Math.round(base * 0.5); applied.push("Streak Boost +50%");
          await admin.from("streak_shop_inventory").update({ last_applied_date: today }).eq("id", r.id);
        } else if (r.quantity > 0) {
          if (r.reward_type === "double_reward") { bonus += base; applied.push("Double Reward 2x"); }
          if (r.reward_type === "lucky_boost") { const roll = rollMystery(3); bonus += roll.coins; applied.push(`Lucky Boost (${roll.rarity})`); }
          await admin.from("streak_shop_inventory").update({ quantity: r.quantity - 1, last_applied_date: today }).eq("id", r.id);
        }
      }
      // Streak Plus bonus multiplier — once per day
      const plus = await activePlus(admin, visitorId);
      if (plus) {
        const { data: mark } = await admin.from("streak_shop_inventory").select("id, last_applied_date").eq("visitor_id", visitorId).eq("reward_type", "plus_daily_marker").maybeSingle();
        if (!mark || mark.last_applied_date !== today) {
          const extra = Math.round(base * (Number(plus.bonus_multiplier || 1) - 1));
          if (extra > 0) { bonus += extra; applied.push(`${plus.plan_name} x${plus.bonus_multiplier}`); }
          if (mark) await admin.from("streak_shop_inventory").update({ last_applied_date: today }).eq("id", mark.id);
          else await admin.from("streak_shop_inventory").insert({ visitor_id: visitorId, reward_type: "plus_daily_marker", item_name: "plus", quantity: 0, last_applied_date: today });
        }
      }
      if (bonus > 0) await admin.from("daily_streaks").update({ streak_coins: (st.streak_coins || 0) + bonus }).eq("id", st.id);
      return ok({ success: true, bonus, applied });
    }

    // ---------- BUY ----------
    if (!itemId) return ok({ error: "itemId required" }, 400);
    const payMethod = paymentMethod === "gem" ? "gem" : "coin";

    const { data: item } = await admin.from("streak_shop_items").select("*").eq("id", itemId).eq("is_active", true).maybeSingle();
    if (!item) return ok({ error: "Item tidak ditemukan" });

    const { data: streak } = await admin.from("daily_streaks").select("*").eq("visitor_id", visitorId).maybeSingle();
    if (!streak) return ok({ error: "Mulai streak dulu untuk dapat coins!" });

    if ((item.required_streak || 0) > (streak.current_streak || 0)) {
      return ok({ error: `🔒 Membutuhkan Streak ${item.required_streak} Hari` });
    }
    if (item.plus_only && !(await activePlus(admin, visitorId))) {
      return ok({ error: "👑 Item khusus Streak Plus" });
    }
    if (item.stock === 0) return ok({ error: "Stok habis" });
    if (COSMETIC(item.reward_type)) {
      const { data: has } = await admin.from("streak_shop_inventory").select("id").eq("visitor_id", visitorId).eq("item_id", item.id).maybeSingle();
      if (has) return ok({ error: "Kamu sudah memiliki item ini" });
    }

    const { data: allItems } = await admin.from("streak_shop_items").select("id, plus_only, cost_coins").eq("is_active", true);
    const price = effectivePrice(item, dailyDealIds(allItems || []));
    const coins = streak.streak_coins || 0;
    let costPaidCoins = 0;
    let costPaidGems = 0;

    // Deduct payment FIRST (atomic conditional update for coins)
    if (payMethod === "gem") {
      const gemCost = item.cost_gems || 0;
      if (gemCost <= 0) return ok({ error: "Pembayaran gem belum tersedia untuk item ini" });
      const { data: accountGems } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      const userGems = Number(accountGems) || 0;
      if (userGems < gemCost) return ok({ error: `Gem tidak cukup. Butuh ${gemCost} 💎, kamu punya ${userGems} 💎.` });
      const { error: deductGemErr } = await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -gemCost });
      if (deductGemErr) return ok({ error: `Gagal memotong gem: ${deductGemErr.message}` });
      costPaidGems = gemCost;
      await admin.from("gem_transactions").insert({ visitor_id: visitorId, amount: -gemCost, type: "shop", description: `Streak Shop: ${item.name} (-${gemCost} 💎)`, reference_id: itemId });
    } else {
      if (coins < price.coins) return ok({ error: `Coins tidak cukup. Butuh ${price.coins}, kamu punya ${coins}.` });
      const { data: upd, error: deductErr } = await admin.from("daily_streaks")
        .update({ streak_coins: coins - price.coins }).eq("id", streak.id).eq("streak_coins", coins).select("id");
      if (deductErr || !upd?.length) return ok({ error: "Saldo coin berubah, coba lagi" });
      costPaidCoins = price.coins;
      streak.streak_coins = coins - price.coins;
    }
    if (item.stock > 0) {
      await admin.from("streak_shop_items").update({ stock: item.stock - 1 }).eq("id", item.id).eq("stock", item.stock);
    }

    let rewardCode: string | null = null;
    let rewardSummary = "Reward sudah ditambahkan!";
    const rt = item.reward_type;

    if (rt === "discount_voucher") {
      rewardCode = generateCode("STR");
      await admin.from("discount_vouchers").insert({ code: rewardCode, discount_amount: item.reward_value, max_uses: 1, is_active: true, expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() });
      rewardSummary = `Voucher diskon Rp${Number(item.reward_value).toLocaleString("id-ID")}`;
    } else if (rt === "game_credit") {
      const { data: gc } = await admin.from("user_game_credits").select("id, credits").eq("visitor_id", visitorId).maybeSingle();
      if (gc) await admin.from("user_game_credits").update({ credits: (gc.credits || 0) + item.reward_value }).eq("id", gc.id);
      else await admin.from("user_game_credits").insert({ visitor_id: visitorId, credits: item.reward_value });
      await admin.from("balance_transactions").insert({ visitor_id: visitorId, amount: 0, type: "game_credit_reward", description: `Streak Shop: ${item.name} (+${item.reward_value} credit)` });
      rewardSummary = `+${item.reward_value} Credit Game ditambahkan!`;
    } else if (rt === "music_storage") {
      await admin.from("user_music_storage").insert({ visitor_id: visitorId, storage_mb: item.reward_value, voucher_code: generateCode("MUS"), expires_at: new Date(Date.now() + 30 * 86400000).toISOString() });
      rewardSummary = `+${item.reward_value}MB storage musik ditambahkan! Berlaku 30 hari.`;
    } else if (rt === "streak_freeze") {
      await admin.from("daily_streaks").update({ freeze_count: (streak.freeze_count || 0) + item.reward_value }).eq("id", streak.id);
      rewardSummary = `+${item.reward_value} Streak Freeze/Shield ditambahkan!`;
    } else if (["extra_life", "auto_hint", "time_freeze", "double_xp"].includes(rt)) {
      const { data: pu } = await admin.from("user_power_ups").select("*").eq("visitor_id", visitorId).maybeSingle();
      const updates: Record<string, unknown> = {};
      if (rt === "double_xp") {
        const baseMs = pu?.double_xp_until && new Date(pu.double_xp_until).getTime() > Date.now() ? new Date(pu.double_xp_until).getTime() : Date.now();
        updates.double_xp_until = new Date(baseMs + item.reward_value * 3600 * 1000).toISOString();
        rewardSummary = `Double XP aktif ${item.reward_value} jam!`;
      } else {
        updates[rt] = ((pu?.[rt] as number) || 0) + item.reward_value;
        rewardSummary = `+${item.reward_value} ${({ extra_life: "Nyawa Ekstra", auto_hint: "Hint Otomatis", time_freeze: "Time Freeze" } as any)[rt]} ditambahkan!`;
      }
      if (pu) await admin.from("user_power_ups").update(updates).eq("visitor_id", visitorId);
      else await admin.from("user_power_ups").insert({ visitor_id: visitorId, ...updates });
    } else if (rt === "streak_boost" || rt === "double_reward" || rt === "lucky_boost" || rt === "mystery_box" || COSMETIC(rt)) {
      await addInventory(admin, visitorId, item);
      rewardSummary = rt === "mystery_box" ? "Mystery Box masuk inventory — buka di tab Inventory!"
        : COSMETIC(rt) ? "Item masuk inventory — pasang di tab Inventory!"
        : "Item masuk inventory dan aktif otomatis saat klaim streak!";
    }

    await admin.from("streak_shop_redemptions").insert({
      visitor_id: visitorId, item_id: itemId, cost_coins: costPaidCoins, reward_type: rt, reward_value: item.reward_value, reward_code: rewardCode, payment_method: payMethod,
    });
    await admin.from("notifications").insert({ visitor_id: visitorId, title: `🛒 Streak Shop: ${item.name}`, message: rewardCode ? `Kode: ${rewardCode}` : rewardSummary, type: "streak_shop" });

    return ok({ success: true, rewardCode, rewardSummary, item, paidCoins: costPaidCoins, paidGems: costPaidGems, coinsLeft: streak.streak_coins });
  } catch (e) {
    return ok({ error: e instanceof Error ? e.message : "Error" }, 500);
  }
});
