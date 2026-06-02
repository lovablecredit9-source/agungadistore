import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REFRESH_COST = 5; // gem
// Biaya spin TETAP (permanen) 500 gem setiap spin.
const SPIN_COST = 500;
const MAX_SPINS = 9; // 9 diskon: 10,20,30,40,50,60,70,80,90
const SPIN_COSTS = Array.from({ length: MAX_SPINS }, () => SPIN_COST);
const LUCKY_BASE_GEM = 10000; // harga dasar 1x spin Lucky Royale (gem)
const SIDE_COUNT = 30; // hadiah samping ditampilkan sampai 30
const PER_DISCOUNT_MAX = 30; // tiap diskon maksimal 30 pembelian

// Hadiah gem berdasarkan total barang yang dibeli (reset 00:00 WIB).
const BUY_MILESTONES = [
  { count: 3, gem: 30 },
  { count: 5, gem: 60 },
  { count: 10, gem: 200 },
];

// Diskon roda 10%–90%. Persen besar makin langka (bobot makin kecil).
const DISCOUNT_SEGMENTS = [
  { value: 10, weight: 400 },
  { value: 20, weight: 260 },
  { value: 30, weight: 160 },
  { value: 40, weight: 90 },
  { value: 50, weight: 50 },
  { value: 60, weight: 25 },
  { value: 70, weight: 12 },
  { value: 80, weight: 6 },
  { value: 90, weight: 3 },
];
const ALL_DISCOUNTS = DISCOUNT_SEGMENTS.map((d) => d.value);

function spinCostFor(_spinsUsed: number) {
  return SPIN_COST;
}

// Pool hadiah samping. Selain item streak & kredit, ada voucher Lucky Royale
// (potong harga spin gem, hanya bisa didapat lewat roda) dan voucher membership
// (potongan harga beli Store Premium). Harga dalam gem.
type Item = {
  id: string;
  label: string;
  emoji: string;
  type: string;
  value: number;
  gem: number;
  days?: number;
  hours?: number;
};
const ITEM_POOL: Item[] = [
  { id: "freeze1", label: "Streak Freeze", emoji: "🛡️", type: "freeze_token", value: 1, gem: 30 },
  { id: "freeze2", label: "2× Streak Freeze", emoji: "🛡️", type: "freeze_token", value: 2, gem: 55 },
  { id: "freeze3", label: "3× Streak Freeze", emoji: "🛡️", type: "freeze_token", value: 3, gem: 75 },
  { id: "coins100", label: "100 Koin Streak", emoji: "🪙", type: "streak_coins", value: 100, gem: 12 },
  { id: "coins200", label: "200 Koin Streak", emoji: "🪙", type: "streak_coins", value: 200, gem: 22 },
  { id: "coins500", label: "500 Koin Streak", emoji: "🪙", type: "streak_coins", value: 500, gem: 45 },
  { id: "coins1000", label: "1.000 Koin Streak", emoji: "💰", type: "streak_coins", value: 1000, gem: 80 },
  { id: "coins2000", label: "2.000 Koin Streak", emoji: "💰", type: "streak_coins", value: 2000, gem: 140 },
  { id: "credit2", label: "2 Kredit Game", emoji: "🎮", type: "credits", value: 2, gem: 20 },
  { id: "credit3", label: "3 Kredit Game", emoji: "🎮", type: "credits", value: 3, gem: 30 },
  { id: "credit5", label: "5 Kredit Game", emoji: "🎮", type: "credits", value: 5, gem: 48 },
  { id: "credit10", label: "10 Kredit Game", emoji: "🎮", type: "credits", value: 10, gem: 90 },
  { id: "credit15", label: "15 Kredit Game", emoji: "🎮", type: "credits", value: 15, gem: 130 },
  { id: "credit20", label: "20 Kredit Game", emoji: "🎮", type: "credits", value: 20, gem: 170 },
  { id: "lucky50", label: "Voucher Lucky Royale -50% Spin", emoji: "🎰", type: "lucky_voucher", value: 50, gem: 1200, hours: 24 },
  { id: "lucky70", label: "Voucher Lucky Royale -70% Spin", emoji: "🎰", type: "lucky_voucher", value: 70, gem: 2000, hours: 12 },
  { id: "lucky80", label: "Voucher Lucky Royale -80% Spin", emoji: "🎰", type: "lucky_voucher", value: 80, gem: 3000, hours: 5 },
  { id: "lucky90", label: "Voucher Lucky Royale -90% Spin", emoji: "🎰", type: "lucky_voucher", value: 90, gem: 4500, hours: 2 },
  { id: "mem5k", label: "Voucher Membership -Rp 5.000", emoji: "👑", type: "membership_voucher", value: 5000, gem: 120, days: 7 },
  { id: "mem10k", label: "Voucher Membership -Rp 10.000", emoji: "👑", type: "membership_voucher", value: 10000, gem: 220, days: 7 },
  { id: "mem15k", label: "Voucher Membership -Rp 15.000", emoji: "👑", type: "membership_voucher", value: 15000, gem: 320, days: 7 },
  { id: "hint1", label: "1× Hint Game", emoji: "💡", type: "auto_hint", value: 1, gem: 25 },
  { id: "hint3", label: "3× Hint Game", emoji: "💡", type: "auto_hint", value: 3, gem: 65 },
  { id: "hint5", label: "5× Hint Game", emoji: "💡", type: "auto_hint", value: 5, gem: 100 },
  { id: "life1", label: "1× Nyawa Game", emoji: "❤️", type: "extra_life", value: 1, gem: 40 },
  { id: "life3", label: "3× Nyawa Game", emoji: "❤️", type: "extra_life", value: 3, gem: 105 },
  { id: "life5", label: "5× Nyawa Game", emoji: "❤️", type: "extra_life", value: 5, gem: 165 },
  { id: "coins300", label: "300 Koin Streak", emoji: "🪙", type: "streak_coins", value: 300, gem: 30 },
  { id: "coins5000", label: "5.000 Koin Streak", emoji: "💰", type: "streak_coins", value: 5000, gem: 320 },
  { id: "credit30", label: "30 Kredit Game", emoji: "🎮", type: "credits", value: 30, gem: 240 },
  { id: "freeze5", label: "5× Streak Freeze", emoji: "🛡️", type: "freeze_token", value: 5, gem: 120 },
];

function voucherDurationMs(item: Item) {
  if (item.hours && item.hours > 0) return item.hours * 3600 * 1000;
  return (item.days || 1) * 86400 * 1000;
}
function durationLabel(item: Item) {
  if (item.hours && item.hours > 0) {
    return item.hours % 24 === 0 ? `${item.hours / 24} hari` : `${item.hours} jam`;
  }
  return `${item.days || 1} hari`;
}

function getToday() {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().split("T")[0];
}

// Kunci periode event. Jika eventDays = 1, sama seperti reset harian biasa.
// Untuk eventDays > 1, semua hari dalam periode memetakan ke tanggal awal periode (WIB).
function getPeriodKey(eventDays: number) {
  const days = Math.max(1, Math.floor(eventDays || 1));
  if (days <= 1) return getToday();
  const wibMs = Date.now() + 7 * 3600 * 1000;
  const dayIndex = Math.floor(wibMs / 86400000);
  const periodStart = Math.floor(dayIndex / days) * days;
  return new Date(periodStart * 86400000).toISOString().split("T")[0];
}

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

// Pilih diskon yang BELUM pernah dimenangkan hari ini, berbobot rarity.
function pickDiscount(rng: () => number, won: number[]) {
  const pool = DISCOUNT_SEGMENTS.filter((d) => !won.includes(d.value));
  if (pool.length === 0) return null;
  const total = pool.reduce((s, d) => s + d.weight, 0);
  let r = rng() * total;
  for (const d of pool) {
    r -= d.weight;
    if (r <= 0) return d.value;
  }
  return pool[0].value;
}

function genCode(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { visitorId, action, itemId, milestoneCount } = await req.json();
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Pengaturan event roda diskon (diatur admin): durasi, status aktif, catatan.
    let eventDays = 1;
    let wheelActive = false;
    let wheelNote = "";
    try {
      const { data: weeklySettings } = await admin
        .from("weekly_spin_event_settings")
        .select("is_active, event_days, event_starts_at, event_ends_at, admin_note")
        .limit(1)
        .maybeSingle();
      if (weeklySettings) {
        const now = Date.now();
        const startsAt = weeklySettings.event_starts_at ? new Date(weeklySettings.event_starts_at).getTime() : null;
        const endsAt = weeklySettings.event_ends_at
          ? new Date(weeklySettings.event_ends_at).getTime()
          : startsAt
            ? startsAt + Number(weeklySettings.event_days ?? 1) * 86400_000
            : null;
        wheelActive = Boolean(weeklySettings.is_active) && (!startsAt || startsAt <= now) && (!endsAt || endsAt > now);
        eventDays = Math.max(1, Number(weeklySettings.event_days ?? 1));
        wheelNote = weeklySettings.admin_note ?? "";
      }

      const { data: settings } = await admin
        .from("admin_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["discount_wheel_event_days", "discount_wheel_active", "discount_wheel_note"]);
      const map: Record<string, string> = {};
      (settings ?? []).forEach((r: any) => { map[r.setting_key] = r.setting_value; });
      const parsed = parseInt(map["discount_wheel_event_days"] ?? "", 10);
      if (Number.isFinite(parsed) && parsed >= 1) eventDays = parsed;
      if (!weeklySettings && map["discount_wheel_active"] !== undefined && map["discount_wheel_active"] !== "") {
        wheelActive = map["discount_wheel_active"] === "true" || map["discount_wheel_active"] === "1";
      }
      wheelNote = wheelNote || map["discount_wheel_note"] || "";
    } catch (_) { /* default */ }

    // Jika event dinonaktifkan admin, hanya kembalikan status (tidak boleh spin/beli).
    if (!wheelActive) {
      if (action !== "state") {
        return Response.json({ error: "Event roda diskon sedang tidak aktif. Tunggu info dari admin." }, { status: 400, headers: corsHeaders });
      }
      return Response.json({
        currentDiscount: 0,
        spinsUsed: 0,
        wonDiscounts: [],
        allDiscounts: ALL_DISCOUNTS,
        remainingDiscounts: ALL_DISCOUNTS,
        purchasedItems: [],
        currentBuys: 0,
        perDiscountMax: PER_DISCOUNT_MAX,
        totalBought: 0,
        totalSaved: 0,
        claims: [],
        gems: 0,
        refreshCost: REFRESH_COST,
        spinCost: SPIN_COST,
        nextSpinCost: SPIN_COST,
        spinCosts: SPIN_COSTS,
        luckyBaseGem: LUCKY_BASE_GEM,
        items: [],
        segments: ALL_DISCOUNTS,
        milestones: BUY_MILESTONES,
        claimedMilestones: [],
        eventDays,
        wheelActive,
        wheelNote,
      }, { headers: corsHeaders });
    }

    const today = getPeriodKey(eventDays);


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
      const won: number[] = state!.won_discounts || [];
      const claims = state!.claims || [];
      const currentBuys = state!.current_discount > 0
        ? claims.filter((c: any) => c.discount === state!.current_discount).length
        : 0;
      const purchasedThisDiscount: string[] = state!.current_discount > 0
        ? claims.filter((c: any) => c.discount === state!.current_discount).map((c: any) => c.id)
        : [];
      const items = state!.current_discount > 0 && currentBuys < PER_DISCOUNT_MAX
        ? sideItems(Number(state!.side_seed), purchasedThisDiscount, state!.current_discount)
        : [];
      const nextSpinCost = spinCostFor(state!.spins_used);
      return Response.json({
        currentDiscount: state!.current_discount,
        spinsUsed: state!.spins_used,
        wonDiscounts: won,
        allDiscounts: ALL_DISCOUNTS,
        remainingDiscounts: ALL_DISCOUNTS.filter((d) => !won.includes(d)),
        purchasedItems: purchasedThisDiscount,
        currentBuys,
        perDiscountMax: PER_DISCOUNT_MAX,
        totalBought: state!.total_bought || 0,
        totalSaved: state!.total_saved || 0,
        claims,
        gems: gemBalance,
        refreshCost: REFRESH_COST,
        spinCost: nextSpinCost,
        nextSpinCost,
        spinCosts: SPIN_COSTS,
        luckyBaseGem: LUCKY_BASE_GEM,
        items,
        segments: ALL_DISCOUNTS,
        milestones: BUY_MILESTONES,
        claimedMilestones: state!.claimed_milestones || [],
        eventDays,
        wheelActive,
        wheelNote,
        ...extra,
      }, { headers: corsHeaders });
    };

    if (action === "state") {
      return buildResponse();
    }

    if (action === "spin") {
      const won: number[] = state.won_discounts || [];
      if (won.length >= ALL_DISCOUNTS.length) {
        return Response.json({ error: "Semua diskon sudah kamu dapat hari ini. Kembali besok!" }, { status: 400, headers: corsHeaders });
      }
      // Wajib beli minimal 1 hadiah sebelum bisa spin lagi.
      // Spin pertama (belum ada diskon aktif) tetap gratis syarat ini.
      if (state.current_discount > 0 && !state.bought_since_spin) {
        return Response.json({ error: "Beli minimal 1 hadiah samping dulu sebelum spin lagi." }, { status: 400, headers: corsHeaders });
      }
      const cost = spinCostFor(state.spins_used);
      if (gemBalance < cost) {
        return Response.json({ error: `Butuh ${cost} gem untuk spin ini.` }, { status: 400, headers: corsHeaders });
      }
      const rng = mulberry32(Math.floor(Math.random() * 1_000_000_000) ^ Date.now());
      const discount = pickDiscount(rng, won);
      if (discount === null) {
        return Response.json({ error: "Semua diskon sudah kamu dapat hari ini. Kembali besok!" }, { status: 400, headers: corsHeaders });
      }
      await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -cost });
      const newSeed = Math.floor(Math.random() * 1_000_000_000);
      const { data: updated } = await admin
        .from("discount_spin_state")
        .update({
          current_discount: discount,
          spins_used: state.spins_used + 1,
          won_discounts: [...won, discount],
          side_seed: newSeed,
          bought_since_spin: false,
        })
        .eq("id", state.id)
        .select("*")
        .single();
      state = updated;
      const { data: g } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      return buildResponse({ wonDiscount: discount, gems: g ?? gemBalance });
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
      return buildResponse({ gems: g2 ?? 0 });
    }

    if (action === "buy") {
      if (state.current_discount <= 0) {
        return Response.json({ error: "Spin dulu untuk dapat diskon." }, { status: 400, headers: corsHeaders });
      }
      const claims = state.claims || [];
      const purchasedThisDiscount: string[] = claims
        .filter((c: any) => c.discount === state.current_discount)
        .map((c: any) => c.id);
      if (purchasedThisDiscount.length >= PER_DISCOUNT_MAX) {
        return Response.json({ error: `Diskon ${state.current_discount}% sudah maksimal ${PER_DISCOUNT_MAX} pembelian. Spin lagi untuk diskon lain!` }, { status: 400, headers: corsHeaders });
      }
      const item = ITEM_POOL.find((p) => p.id === itemId);
      if (!item) return Response.json({ error: "Item tidak ditemukan." }, { status: 400, headers: corsHeaders });
      if (purchasedThisDiscount.includes(item.id)) {
        return Response.json({ error: "Item ini sudah dibeli pada diskon ini." }, { status: 400, headers: corsHeaders });
      }
      const showing = sideItems(Number(state.side_seed), purchasedThisDiscount, state.current_discount);
      const live = showing.find((s) => s.id === item.id);
      if (!live) return Response.json({ error: "Item tidak tersedia. Refresh dulu." }, { status: 400, headers: corsHeaders });

      const cost = live.finalGem;
      if (gemBalance < cost) {
        return Response.json({ error: `Gem tidak cukup. Butuh ${cost} gem.` }, { status: 400, headers: corsHeaders });
      }

      await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: -cost });

      const { data: blh } = await admin
        .from("balance_login_history")
        .select("user_balance_id")
        .eq("visitor_id", visitorId)
        .order("logged_in_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const ubId = blh?.user_balance_id ?? null;

      let voucherCode: string | null = null;

      if (item.type === "credits") {
        await admin.rpc("add_account_credits", { p_visitor_id: visitorId, p_amount: item.value });
      } else if (item.type === "auto_hint" || item.type === "extra_life") {
        const col = item.type === "auto_hint" ? "auto_hint" : "extra_life";
        const { data: pu } = await admin.from("user_power_ups").select(`id, ${col}`).eq("visitor_id", visitorId).maybeSingle();
        if (pu) {
          await admin.from("user_power_ups").update({ [col]: ((pu as any)[col] || 0) + item.value }).eq("id", pu.id);
        } else {
          await admin.from("user_power_ups").insert({ visitor_id: visitorId, [col]: item.value });
        }
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
      } else if (item.type === "lucky_voucher") {
        voucherCode = genCode("LUCKY");
        // expires_at = batas waktu untuk MENGAKTIFKAN voucher (7 hari).
        // duration_hours = lama diskon aktif untuk SEMUA spin setelah diaktifkan.
        const exp = new Date(Date.now() + 7 * 86400 * 1000).toISOString();
        await admin.from("discount_vouchers").insert({
          code: voucherCode, discount_amount: item.value, max_uses: 1, used_count: 0,
          is_active: true, expires_at: exp, duration_hours: item.hours || 24,
          visitor_id: visitorId, user_balance_id: ubId, source: "lucky_spin",
        });
      } else if (item.type === "membership_voucher") {
        voucherCode = genCode("MEMBER");
        const exp = new Date(Date.now() + voucherDurationMs(item)).toISOString();
        await admin.from("discount_vouchers").insert({
          code: voucherCode, discount_amount: item.value, max_uses: 1, used_count: 0,
          is_active: true, expires_at: exp, visitor_id: visitorId, user_balance_id: ubId, source: "membership_discount",
        });
      }

      const saved = Math.max(0, item.gem - cost);
      const claim = {
        id: item.id,
        label: item.label,
        emoji: item.emoji,
        gem: cost,
        saved,
        discount: state.current_discount,
        code: voucherCode,
        days: item.days || null,
        duration: voucherCode ? durationLabel(item) : null,
        at: new Date().toISOString(),
      };

      const { data: updated } = await admin
        .from("discount_spin_state")
        .update({
          bought_since_spin: true,
          total_bought: (state.total_bought || 0) + 1,
          total_saved: (state.total_saved || 0) + saved,
          claims: [...claims, claim],
        })
        .eq("id", state.id)
        .select("*")
        .single();
      state = updated;

      await admin.rpc("create_notification", {
        p_visitor_id: visitorId,
        p_title: "🎡 Roda Diskon",
        p_message: voucherCode
          ? `Kamu dapat ${item.label}! Kode: ${voucherCode} (aktif ${durationLabel(item)}).`
          : `Kamu beli ${item.label} dengan diskon ${state.current_discount}% (${cost} gem).`,
        p_type: "success",
      });

      const { data: g3 } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      return buildResponse({ success: true, bought: { ...live, code: voucherCode }, gems: g3 ?? 0 });
    }

    if (action === "claim_milestone") {
      const target = Number(milestoneCount);
      const milestone = BUY_MILESTONES.find((m) => m.count === target);
      if (!milestone) {
        return Response.json({ error: "Milestone tidak valid." }, { status: 400, headers: corsHeaders });
      }
      const claimed: number[] = state.claimed_milestones || [];
      if (claimed.includes(milestone.count)) {
        return Response.json({ error: "Hadiah milestone ini sudah diklaim." }, { status: 400, headers: corsHeaders });
      }
      if ((state.total_bought || 0) < milestone.count) {
        return Response.json({ error: `Beli ${milestone.count} barang dulu untuk klaim hadiah ini. (baru ${state.total_bought || 0})` }, { status: 400, headers: corsHeaders });
      }
      await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: milestone.gem });
      const { data: updated } = await admin
        .from("discount_spin_state")
        .update({ claimed_milestones: [...claimed, milestone.count] })
        .eq("id", state.id)
        .select("*")
        .single();
      state = updated;
      await admin.rpc("create_notification", {
        p_visitor_id: visitorId,
        p_title: "🎁 Hadiah Roda Diskon",
        p_message: `Kamu klaim bonus ${milestone.gem} gem karena sudah beli ${milestone.count} barang!`,
        p_type: "success",
      });
      const { data: g4 } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
      return buildResponse({ success: true, claimedGem: milestone.gem, gems: g4 ?? 0 });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
