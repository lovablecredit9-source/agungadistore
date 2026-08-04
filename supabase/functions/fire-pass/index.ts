import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ===== SEASON OTOMATIS (rollover tiap bulan WIB) =====
const SEASON_THEMES = [
  "Ignition", "Blaze Rising", "Ember Storm", "Solar Flare", "Phoenix Dawn",
  "Inferno Core", "Nova Burst", "Crimson Sky", "Molten Reign", "Eternal Flame",
  "Starfall", "Aurora Blaze",
];

function wibMonthBounds(d = new Date()) {
  const jak = new Date(d.getTime() + 7 * 3600 * 1000);
  const y = jak.getUTCFullYear();
  const m = jak.getUTCMonth(); // 0-based
  const pad = (n: number) => String(n).padStart(2, "0");
  const startIso = new Date(`${y}-${pad(m + 1)}-01T00:00:00+07:00`).toISOString();
  const ny = m === 11 ? y + 1 : y;
  const nm = m === 11 ? 0 : m + 1;
  const endIso = new Date(`${ny}-${pad(nm + 1)}-01T00:00:00+07:00`).toISOString();
  return { startIso, endIso, monthKey: `${y}-${pad(m + 1)}` };
}

const TIER_COUNT = 300;

function seasonScale(n: number) { return 1 + 0.2 * Math.max(0, n - 1); }

// Reward berbeda tiap season: pool dirotasi berdasarkan season_number
const PREM_POOL = [
  "gems", "coins", "game_credits", "hint", "extra_life", "time_freeze",
  "streak_coins", "spin_ticket_normal", "saldo_in", "lucky_ticket",
  "spin_ticket_premium", "voucher_saldo", "server_luck_x2_hours", "storage_mb",
];
const FREE_POOL = ["coins", "hint", "game_credits", "streak_coins", "extra_life", "time_freeze", "spin_ticket_normal", "gems"];

function makeReward(type: string, tier: number, seasonNumber: number, boost = 1) {
  const f = (1 + tier / 60) * seasonScale(seasonNumber) * boost;
  const r = (n: number) => Math.max(1, Math.round(n * f));
  switch (type) {
    case "gems": return { type, value: r(8), hours: 0, label: `${r(8)} 💎 Gem` };
    case "coins": return { type, value: r(25), hours: 0, label: `${r(25)} 🪙 Koin` };
    case "streak_coins": return { type, value: r(15), hours: 0, label: `${r(15)} 🔥 Streak Koin` };
    case "game_credits": return { type, value: r(3), hours: 0, label: `${r(3)} 🎮 Kredit Game` };
    case "hint": return { type, value: r(2), hours: 0, label: `${r(2)} 💡 Petunjuk` };
    case "extra_life": return { type, value: r(2), hours: 0, label: `${r(2)} ❤️ Nyawa Ekstra` };
    case "time_freeze": return { type, value: r(2), hours: 0, label: `${r(2)} ⏱️ Time Freeze` };
    case "spin_ticket_normal": return { type, value: r(2), hours: 0, label: `${r(2)} 🎟️ Tiket Spin Normal` };
    case "spin_ticket_premium": return { type, value: r(1), hours: 0, label: `${r(1)} 🎫 Tiket Spin Premium` };
    case "lucky_ticket": return { type, value: r(2), hours: 0, label: `${r(2)} 🍀 Tiket Lucky Draw` };
    case "storage_mb": return { type, value: r(50), hours: 720, label: `${r(50)} MB Storage Musik` };
    case "server_luck_x2_hours": return { type, value: r(2), hours: 0, label: `Server Luck x2 · ${r(2)} jam` };
    case "premium_quest_days": return { type, value: r(1), hours: 0, label: `Premium Quest ${r(1)} hari` };
    case "voucher_saldo": {
      const v = Math.round(r(1000) / 500) * 500 || 500;
      return { type, value: v, hours: 168, label: `Voucher Rp ${v.toLocaleString("id-ID")}` };
    }
    case "saldo_in": {
      const v = Math.round(r(1500) / 500) * 500 || 500;
      return { type, value: v, hours: 0, label: `Saldo IN Rp ${v.toLocaleString("id-ID")}` };
    }
    default: return { type: "coins", value: r(20), hours: 0, label: `${r(20)} 🪙 Koin` };
  }
}

function buildTiers(seasonId: string, seasonNumber: number) {
  const rows: any[] = [];
  for (let tier = 1; tier <= TIER_COUNT; tier++) {
    const badge_required = Math.round(10 * tier + tier * tier * 0.15);
    const isMilestone = tier % 25 === 0;
    const isMega = tier % 100 === 0;
    const pIdx = (tier + seasonNumber * 3) % PREM_POOL.length;
    const pType = isMega ? "saldo_in" : isMilestone ? "voucher_saldo" : PREM_POOL[pIdx];
    const prem = makeReward(pType, tier, seasonNumber, isMega ? 4 : isMilestone ? 2.2 : 1);

    const row: any = {
      season_id: seasonId,
      tier_level: tier,
      badge_required,
      premium_reward_type: prem.type,
      premium_reward_value: prem.value,
      premium_reward_duration_hours: prem.hours,
      premium_reward_label: prem.label,
      free_reward_type: null,
      free_reward_value: 0,
      free_reward_duration_hours: 0,
      free_reward_label: null,
    };
    if (tier % 5 === 0) {
      const fIdx = (tier / 5 + seasonNumber * 2) % FREE_POOL.length;
      const free = makeReward(FREE_POOL[fIdx], tier, seasonNumber, isMilestone ? 1.6 : 0.7);
      row.free_reward_type = free.type;
      row.free_reward_value = free.value;
      row.free_reward_duration_hours = free.hours;
      row.free_reward_label = free.label;
    }
    rows.push(row);
  }
  return rows;
}

let _seasonCache: { at: number; data: any } | null = null;

async function getActiveSeason(admin: any) {
  if (_seasonCache && Date.now() - _seasonCache.at < 30000) return _seasonCache.data;
  const now = Date.now();
  const { data: all } = await admin.from("fire_pass_seasons").select("*").order("season_number", { ascending: false });
  const list = all || [];

  // 1) Season yang periodenya mencakup sekarang
  let current = list.find((s: any) =>
    new Date(s.starts_at).getTime() <= now && new Date(s.ends_at).getTime() > now);

  if (!current) {
    // 2) Buat season baru untuk bulan berjalan (WIB)
    const { startIso, endIso } = wibMonthBounds();
    const nextNumber = (list[0]?.season_number || 0) + 1;
    const theme = SEASON_THEMES[(nextNumber - 1) % SEASON_THEMES.length];
    const { data: created } = await admin.from("fire_pass_seasons").insert({
      season_number: nextNumber,
      name: `Season ${nextNumber} - ${theme}`,
      description: `Musim baru! Reward & misi direset. Kumpulkan badge untuk membuka ${TIER_COUNT} tier reward.`,
      starts_at: startIso,
      ends_at: endIso,
      is_active: true,
      free_premium_enabled: false,
      price_saldo_in: 25000 + (nextNumber - 1) * 5000,
      price_gems: 200 + (nextNumber - 1) * 50,
      pro_price_saldo_in: 30000,
      pro_price_gems: 500,
    }).select().single();
    if (created) {
      const rows = buildTiers(created.id, nextNumber);
      for (let i = 0; i < rows.length; i += 300) {
        await admin.from("fire_pass_tiers").insert(rows.slice(i, i + 300));
      }
      // Kloning misi dari season sebelumnya dengan reward lebih besar (misi beda tiap season)
      const prev = list[0];
      if (prev) {
        const { data: prevMissions } = await admin.from("fire_pass_missions").select("*").eq("season_id", prev.id);
        const boost = seasonScale(nextNumber) / seasonScale(prev.season_number || 1);
        const clones = (prevMissions || []).map((m: any) => {
          const { id, created_at, updated_at, ...rest } = m;
          return {
            ...rest,
            season_id: created.id,
            code: `${m.code}_s${nextNumber}`,
            badge_reward: Math.max(1, Math.round(Number(m.badge_reward || 1) * boost)),
            target_value: Math.max(1, Math.round(Number(m.target_value || 1) * 1.1)),
          };
        });
        for (let i = 0; i < clones.length; i += 200) {
          await admin.from("fire_pass_missions").insert(clones.slice(i, i + 200));
        }
      }
      current = created;
    }

  }

  if (current) {
    // Pastikan hanya season berjalan yang aktif
    const stale = list.filter((s: any) => s.id !== current.id && s.is_active);
    if (stale.length) {
      await admin.from("fire_pass_seasons").update({ is_active: false }).in("id", stale.map((s: any) => s.id));
    }
    if (!current.is_active) {
      await admin.from("fire_pass_seasons").update({ is_active: true }).eq("id", current.id);
      current.is_active = true;
    }
  }

  _seasonCache = { at: Date.now(), data: current || null };
  return current || null;
}


// Cari profil gem "utama" mengikuti logika add_account_gems:
// - Jika visitor login akun saldo → profil paling awal (created_at ASC) pada user_balance tsb
// - Jika belum login → profil milik visitor_id itu sendiri
async function getGemProfile(admin: any, visitorId: string) {
  const { data: blh } = await admin.from("balance_login_history")
    .select("user_balance_id").eq("visitor_id", visitorId)
    .order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
  const ubId = blh?.user_balance_id ?? null;
  if (ubId) {
    const { data: gp } = await admin.from("game_profiles")
      .select("id, gems").eq("user_balance_id", ubId)
      .order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (gp) return gp;
  }
  const { data: gp2 } = await admin.from("game_profiles")
    .select("id, gems").eq("visitor_id", visitorId).maybeSingle();
  return gp2;
}

async function getOrCreateProgress(admin: any, visitorId: string, seasonId: string) {
  const { data: blh } = await admin.from("balance_login_history").select("user_balance_id").eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
  const ub_id = blh?.user_balance_id ?? null;

  const { data: existing } = await admin.from("fire_pass_progress").select("*")
    .eq("season_id", seasonId)
    .or(ub_id ? `visitor_id.eq.${visitorId},user_balance_id.eq.${ub_id}` : `visitor_id.eq.${visitorId}`)
    .maybeSingle();
  if (existing) {
    // Auto-enable premium jika free_premium_enabled
    const { data: s } = await admin.from("fire_pass_seasons").select("free_premium_enabled").eq("id", seasonId).maybeSingle();
    if (s?.free_premium_enabled && !existing.is_premium) {
      await admin.from("fire_pass_progress").update({ is_premium: true, premium_activated_at: new Date().toISOString() }).eq("id", existing.id);
      existing.is_premium = true;
    }
    return existing;
  }
  const { data: s } = await admin.from("fire_pass_seasons").select("free_premium_enabled").eq("id", seasonId).maybeSingle();
  const { data: created } = await admin.from("fire_pass_progress").insert({
    season_id: seasonId,
    visitor_id: visitorId,
    user_balance_id: ub_id,
    badges: 0,
    is_premium: !!s?.free_premium_enabled,
    premium_activated_at: s?.free_premium_enabled ? new Date().toISOString() : null,
  }).select().single();
  return created;
}

function isFreeRewardTier(tierLevel: number) {
  return Number.isFinite(tierLevel) && tierLevel > 0 && tierLevel % 5 === 0;
}

async function applyReward(admin: any, visitorId: string, ubId: string | null, type: string | null, value: number, durationHours: number, label: string | null, minPurchase: number = 0) {
  if (!type || !value) return;
  try {
    if (type === "saldo_in") {
      await admin.rpc("add_topup_bonus_to_saldo_in", { p_visitor_id: visitorId, p_amount: value });
    } else if (type === "coins") {
      await admin.rpc("add_account_credits", { p_visitor_id: visitorId, p_amount: value });
    } else if (type === "gems") {
      const gp = await getGemProfile(admin, visitorId);
      if (gp) await admin.from("game_profiles").update({ gems: (gp.gems || 0) + value }).eq("id", gp.id);
    } else if (type === "premium_quest_days") {
      const expiresAt = new Date(Date.now() + value * 86400000).toISOString();
      await admin.from("premium_quest_subscriptions").insert({
        visitor_id: visitorId, user_balance_id: ubId,
        plan_name: `Fire Pass ${value} Hari`, plan_code: "FIRE_PASS_REWARD",
        expires_at: expiresAt, is_active: true, is_permanent: false, purchase_source: "fire_pass",
      });
    } else if (type === "hint") {
      const { data: up } = await admin.from("user_power_ups").select("id, auto_hint").eq("visitor_id", visitorId).maybeSingle();
      if (up) await admin.from("user_power_ups").update({ auto_hint: (up.auto_hint || 0) + value }).eq("id", up.id);
      else await admin.from("user_power_ups").insert({ visitor_id: visitorId, auto_hint: value });
    } else if (type === "extra_life" || type === "nyawa") {
      const { data: up } = await admin.from("user_power_ups").select("id, extra_life").eq("visitor_id", visitorId).maybeSingle();
      if (up) await admin.from("user_power_ups").update({ extra_life: (up.extra_life || 0) + value }).eq("id", up.id);
      else await admin.from("user_power_ups").insert({ visitor_id: visitorId, extra_life: value });
    } else if (type === "time_freeze") {
      const { data: up } = await admin.from("user_power_ups").select("id, time_freeze").eq("visitor_id", visitorId).maybeSingle();
      if (up) await admin.from("user_power_ups").update({ time_freeze: (up.time_freeze || 0) + value }).eq("id", up.id);
      else await admin.from("user_power_ups").insert({ visitor_id: visitorId, time_freeze: value });
    } else if (type === "game_credits" || type === "kredit") {
      const { data: gc } = await admin.from("user_game_credits").select("id, credits").eq("visitor_id", visitorId).maybeSingle();
      if (gc) await admin.from("user_game_credits").update({ credits: (gc.credits || 0) + value }).eq("id", gc.id);
      else await admin.from("user_game_credits").insert({ visitor_id: visitorId, credits: value });
    } else if (type === "storage_mb") {
      await admin.from("user_music_storage").insert({
        visitor_id: visitorId, storage_mb: value, voucher_code: `FIREPASS-${Date.now()}`,
        expires_at: durationHours ? new Date(Date.now() + durationHours * 3600000).toISOString() : null,
      });
    } else if (type === "server_luck_hours" || type?.startsWith("server_luck_x")) {
      let tier = 2;
      const m = type?.match(/server_luck_x(\d+)_hours/);
      if (m) tier = parseInt(m[1], 10) || 2;
      const activeUntil = new Date(Date.now() + value * 3600000).toISOString();
      const { data: sl } = await admin.from("server_luck_boosters").select("id, active_tier, active_until, highest_tier_owned").eq("visitor_id", visitorId).maybeSingle();
      const curExp = sl?.active_until ? new Date(sl.active_until).getTime() : 0;
      const stillActive = curExp > Date.now();
      const nextTier = stillActive ? Math.max(sl?.active_tier || 0, tier) : tier;
      const nextUntil = stillActive && (sl?.active_tier || 0) === tier
        ? new Date(curExp + value * 3600000).toISOString()
        : activeUntil;
      if (sl) await admin.from("server_luck_boosters").update({ active_tier: nextTier, active_until: nextUntil, highest_tier_owned: Math.max(sl.highest_tier_owned || 0, tier) }).eq("id", sl.id);
      else await admin.from("server_luck_boosters").insert({ visitor_id: visitorId, active_tier: tier, active_until: activeUntil, highest_tier_owned: tier });
    } else if (type === "streak_coins") {
      const { data: st } = await admin.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
      if (st) await admin.from("daily_streaks").update({ streak_coins: (st.streak_coins || 0) + value }).eq("id", st.id);
      else await admin.from("daily_streaks").insert({ visitor_id: visitorId, streak_coins: value });
    } else if (type === "lucky_ticket" || type === "lucky_draw_ticket") {
      const { data: lt } = await admin.from("lucky_draw_tickets").select("id, ticket_count, total_purchased").eq("visitor_id", visitorId).maybeSingle();
      if (lt) await admin.from("lucky_draw_tickets").update({ ticket_count: (lt.ticket_count || 0) + value, total_purchased: (lt.total_purchased || 0) + value }).eq("id", lt.id);
      else await admin.from("lucky_draw_tickets").insert({ visitor_id: visitorId, ticket_count: value, total_purchased: value });
    } else if (type === "spin_ticket_normal" || type === "spin_ticket_premium") {
      const ticketType = type === "spin_ticket_premium" ? "premium" : "normal";
      const { data: blh } = await admin.from("balance_login_history").select("user_balance_id").eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
      const ub = blh?.user_balance_id || null;
      const key = ub ? `ub:${ub}` : `v:${visitorId}`;
      const { data: row } = await admin.from("luck_spin_tickets").select("id, balance, total_purchased").eq("account_key", key).eq("ticket_type", ticketType).maybeSingle();
      if (row) await admin.from("luck_spin_tickets").update({ balance: (row.balance || 0) + value, total_purchased: (row.total_purchased || 0) + value, updated_at: new Date().toISOString() }).eq("id", row.id);
      else await admin.from("luck_spin_tickets").insert({ account_key: key, visitor_id: visitorId, user_balance_id: ub, ticket_type: ticketType, balance: value, total_purchased: value });
      await admin.from("luck_spin_ticket_log").insert({ account_key: key, visitor_id: visitorId, ticket_type: ticketType, delta: value, reason: "fire_pass_reward" });
    } else if (type === "voucher_saldo" || type === "admin_voucher") {
      const code = `FP${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      const validHours = durationHours && durationHours > 0 ? durationHours : 24;
      await admin.from("discount_vouchers").insert({
        visitor_id: visitorId, user_balance_id: ubId, code, discount_amount: value,
        min_purchase: minPurchase || 0,
        source: "fire_pass", is_active: true, max_uses: 1,
        expires_at: new Date(Date.now() + validHours * 3600000).toISOString(),
      });
    }
  } catch (e) {
    console.error("applyReward error", type, e);
  }
}

// Level kesulitan misi berdasarkan badge reward + tarif gem instan.
function missionLevel(badge: number) {
  const b = badge || 1;
  if (b <= 5) return { level: 1, label: "Mudah", gemCost: 20 };
  if (b <= 15) return { level: 2, label: "Sedang", gemCost: 50 };
  if (b <= 30) return { level: 3, label: "Sulit", gemCost: 100 };
  if (b <= 60) return { level: 4, label: "Sangat Sulit", gemCost: 200 };
  if (b <= 120) return { level: 5, label: "Ekstrem", gemCost: 500 };
  return { level: 6, label: "Legendaris", gemCost: 1000 };
}

async function computeMissions(admin: any, visitorId: string) {
  const now = new Date();
  const jakOffsetMs = 7 * 3600 * 1000;
  const jak = new Date(now.getTime() + jakOffsetMs);
  const dayKey = jak.toISOString().slice(0, 10);
  const monthKey = dayKey.slice(0, 7);
  const d = new Date(Date.UTC(jak.getUTCFullYear(), jak.getUTCMonth(), jak.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  const weekKey = `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  const dayStartIso = new Date(dayKey + "T00:00:00+07:00").toISOString();
  const weekMonday = new Date(jak); weekMonday.setUTCDate(jak.getUTCDate() - (day - 1));
  const weekStartIso = new Date(weekMonday.toISOString().slice(0, 10) + "T00:00:00+07:00").toISOString();
  const monthStartIso = new Date(monthKey + "-01T00:00:00+07:00").toISOString();

  const { data: missions } = await admin.from("fire_pass_missions").select("*").eq("is_active", true).order("sort_order");
  const { data: claims } = await admin.from("fire_pass_mission_progress").select("*").eq("visitor_id", visitorId);

  const season = await getActiveSeason(admin);
  let isPremium = false;
  let isProActive = false;
  if (season) {
    const { data: prog } = await admin.from("fire_pass_progress").select("is_premium, pro_missions_until").eq("season_id", season.id).eq("visitor_id", visitorId).maybeSingle();
    isPremium = !!prog?.is_premium;
    isProActive = !!prog?.pro_missions_until && new Date(prog.pro_missions_until).getTime() > Date.now();
  }

  const [{ data: streak }, { data: songLogsDay }, { data: songLogsWeek }, { data: songLogsMonth }, { data: txDay }, { data: txWeek }, { data: txMonth }, { data: loginDay }, { data: loginMonth }, { data: qcDay }, { data: qcWeek }, { data: qcMonth }] = await Promise.all([
    admin.from("daily_streaks").select("last_claim_date").eq("visitor_id", visitorId).maybeSingle(),
    admin.from("song_listening_log").select("id, song_id").eq("visitor_id", visitorId).gte("created_at", dayStartIso),
    admin.from("song_listening_log").select("id").eq("visitor_id", visitorId).gte("created_at", weekStartIso),
    admin.from("song_listening_log").select("id").eq("visitor_id", visitorId).gte("created_at", monthStartIso),
    admin.from("balance_transactions").select("amount, type, created_at").eq("visitor_id", visitorId).gte("created_at", dayStartIso),
    admin.from("balance_transactions").select("amount, type, created_at").eq("visitor_id", visitorId).gte("created_at", weekStartIso),
    admin.from("balance_transactions").select("amount, type, created_at").eq("visitor_id", visitorId).gte("created_at", monthStartIso),
    admin.from("balance_login_history").select("id").eq("visitor_id", visitorId).gte("logged_in_at", dayStartIso).limit(1),
    admin.from("balance_login_history").select("logged_in_at").eq("visitor_id", visitorId).gte("logged_in_at", monthStartIso),
    admin.from("premium_quest_progress").select("id, claimed_at").eq("visitor_id", visitorId).gte("claimed_at", dayStartIso),
    admin.from("premium_quest_progress").select("id, claimed_at").eq("visitor_id", visitorId).gte("claimed_at", weekStartIso),
    admin.from("premium_quest_progress").select("id, claimed_at").eq("visitor_id", visitorId).gte("claimed_at", monthStartIso),
  ]);
  const purchaseTypesDay = (txDay || []).filter((t: any) => (t.type || "").includes("purchase") || t.amount < 0);
  const purchaseTypesWeek = (txWeek || []).filter((t: any) => (t.type || "").includes("purchase") || t.amount < 0);
  const purchaseTypesMonth = (txMonth || []).filter((t: any) => (t.type || "").includes("purchase") || t.amount < 0);
  const topupDay = (txDay || []).filter((t: any) => (t.type || "").includes("topup") || (t.type || "").includes("deposit"));
  const topupWeek = (txWeek || []).filter((t: any) => (t.type || "").includes("topup") || (t.type || "").includes("deposit"));
  const topupMonth = (txMonth || []).filter((t: any) => (t.type || "").includes("topup") || (t.type || "").includes("deposit"));
  const loginDaysMonth = new Set((loginMonth || []).map((r: any) => (r.logged_in_at || "").slice(0, 10))).size;

  return (missions || []).map((m: any) => {
    const mt = m.mission_type;
    const isWeekly = mt === "weekly";
    const isMonthly = mt === "monthly";
    const isPrem = mt === "premium";
    const isPro = mt === "pro";
    const periodKey = isMonthly || isPro ? monthKey : isWeekly ? weekKey : dayKey;
    const claim = (claims || []).find((c: any) => c.mission_id === m.id && c.period_key === periodKey);
    let current = 0;
    switch (m.requirement_type) {
      case "daily_login": current = (loginDay?.length || 0) > 0 ? 1 : 0; break;
      case "streak_claim": current = streak?.last_claim_date === dayKey ? 1 : 0; break;
      case "streak_claim_week": current = 0; break;
      case "listen_song": current = new Set((songLogsDay || []).map((r: any) => r.song_id)).size; break;
      case "listen_song_week": current = (songLogsWeek || []).length; break;
      case "listen_song_month": current = (songLogsMonth || []).length; break;
      case "purchase_count": current = purchaseTypesDay.length; break;
      case "purchase_count_week": current = purchaseTypesWeek.length; break;
      case "purchase_count_month": current = purchaseTypesMonth.length; break;
      case "topup_amount": current = topupDay.reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0); break;
      case "topup_amount_week": current = topupWeek.reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0); break;
      case "topup_amount_month": current = topupMonth.reduce((s: number, t: any) => s + Math.abs(t.amount || 0), 0); break;
      case "quest_claim_week": current = isPrem ? (qcDay || []).length : (qcWeek || []).length; break;
      case "quest_claim_month": current = (qcMonth || []).length; break;
      case "login_days_month": current = loginDaysMonth; break;
      default: current = 0;
    }
    const period = isPro ? "pro" : isMonthly ? "monthly" : isWeekly ? "weekly" : isPrem ? "premium" : "daily";
    const lvl = missionLevel(m.badge_reward || 1);
    return {
      ...m,
      period,
      period_key: periodKey,
      current_value: current,
      is_completed: current >= m.target_value && (!isPrem || isPremium) && (!isPro || isProActive),
      is_claimed: !!claim?.is_claimed,
      locked: (isPrem && !isPremium) || (isPro && !isProActive),
      pro_active: isProActive,
      mission_level: lvl.level,
      level_label: lvl.label,
      gem_cost: lvl.gemCost,
    };
  });
}



Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const action = body.action;

    if (action === "status") {
      const { visitorId } = body;
      const season = await getActiveSeason(admin);
      if (!season) return Response.json({ season: null, tiers: [], progress: null }, { headers: corsHeaders });
      const { data: tiers } = await admin.from("fire_pass_tiers").select("*").eq("season_id", season.id).order("tier_level");
      const normalizedTiers = (tiers || []).map((t: any) => isFreeRewardTier(Number(t.tier_level)) ? t : {
        ...t,
        free_reward_type: null,
        free_reward_value: 0,
        free_reward_duration_hours: 0,
        free_reward_min_purchase: 0,
        free_reward_label: null,
      });
      const progress = visitorId ? await getOrCreateProgress(admin, visitorId, season.id) : null;
      return Response.json({ season, tiers: normalizedTiers, progress }, { headers: corsHeaders });
    }

    if (action === "add_badges") {
      const { visitorId, amount, source } = body;
      const season = await getActiveSeason(admin);
      if (!season) return Response.json({ error: "no active season" }, { status: 400, headers: corsHeaders });
      const progress = await getOrCreateProgress(admin, visitorId, season.id);
      const newBadges = (progress.badges || 0) + (amount || 1);
      await admin.from("fire_pass_progress").update({ badges: newBadges }).eq("id", progress.id);
      await admin.from("fire_pass_badge_log").insert({ season_id: season.id, visitor_id: visitorId, source: source || "manual", amount: amount || 1 });
      return Response.json({ success: true, badges: newBadges }, { headers: corsHeaders });
    }

    if (action === "claim_tier") {
      const { visitorId, tierLevel, track } = body;
      const season = await getActiveSeason(admin);
      if (!season) return Response.json({ error: "no active season" }, { status: 400, headers: corsHeaders });
      const { data: tier } = await admin.from("fire_pass_tiers").select("*").eq("season_id", season.id).eq("tier_level", tierLevel).maybeSingle();
      if (!tier) return Response.json({ error: "Tier tidak ditemukan" }, { status: 404, headers: corsHeaders });
      const progress = await getOrCreateProgress(admin, visitorId, season.id);
      if ((progress.badges || 0) < tier.badge_required) return Response.json({ error: "Badge belum cukup" }, { status: 400, headers: corsHeaders });

      const isPremium = track === "premium";
      if (isPremium && !progress.is_premium) return Response.json({ error: "Butuh Fire Pass Premium" }, { status: 403, headers: corsHeaders });
      if (!isPremium && !isFreeRewardTier(Number(tierLevel))) {
        return Response.json({ error: "Reward Free hanya tersedia di milestone tiap 5 tier" }, { status: 400, headers: corsHeaders });
      }

      const field = isPremium ? "claimed_premium_tiers" : "claimed_free_tiers";
      const claimed: number[] = progress[field] ?? [];
      if (claimed.includes(tierLevel)) return Response.json({ error: "Tier sudah diklaim" }, { status: 400, headers: corsHeaders });

      const rType = isPremium ? tier.premium_reward_type : tier.free_reward_type;
      const rValue = isPremium ? tier.premium_reward_value : tier.free_reward_value;
      const rDuration = isPremium ? tier.premium_reward_duration_hours : tier.free_reward_duration_hours;
      const rLabel = isPremium ? tier.premium_reward_label : tier.free_reward_label;
      const rMinPurchase = isPremium ? (tier.premium_reward_min_purchase || 0) : (tier.free_reward_min_purchase || 0);

      await applyReward(admin, visitorId, progress.user_balance_id, rType, rValue || 0, rDuration || 0, rLabel, rMinPurchase);

      await admin.from("fire_pass_progress").update({ [field]: [...claimed, tierLevel] }).eq("id", progress.id);
      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: `🔥 Fire Pass Tier ${tierLevel} Diklaim`,
        message: `${isPremium ? "💎 Premium: " : ""}${rLabel || "Reward diterima"}`,
        type: "success",
      });
      return Response.json({ success: true, reward_label: rLabel }, { headers: corsHeaders });
    }

    if (action === "buy_premium") {
      const { visitorId, method } = body; // method = 'saldo' | 'gems'
      const season = await getActiveSeason(admin);
      if (!season) return Response.json({ error: "no active season" }, { status: 400, headers: corsHeaders });
      const progress = await getOrCreateProgress(admin, visitorId, season.id);
      if (progress.is_premium) return Response.json({ error: "Sudah Premium" }, { status: 400, headers: corsHeaders });

      if (method === "gems") {
        const gp = await getGemProfile(admin, visitorId);
        if (!gp || (gp.gems || 0) < season.price_gems) return Response.json({ error: `Butuh ${season.price_gems} 💎` }, { status: 400, headers: corsHeaders });
        await admin.from("game_profiles").update({ gems: gp.gems - season.price_gems }).eq("id", gp.id);
      } else {
        const { data: bal } = await admin.from("user_balances").select("id, balance").eq("id", progress.user_balance_id).maybeSingle();
        if (!bal || (bal.balance || 0) < season.price_saldo_in) return Response.json({ error: `Saldo IN tidak cukup (butuh Rp ${season.price_saldo_in.toLocaleString("id-ID")})` }, { status: 400, headers: corsHeaders });
        await admin.rpc("consume_main_balance_only", { p_balance_id: bal.id, p_amount: season.price_saldo_in });
        await admin.from("balance_transactions").insert({ visitor_id: visitorId, amount: -season.price_saldo_in, type: "fire_pass_premium", description: `Fire Pass Premium ${season.name}` });
      }

      await admin.from("fire_pass_progress").update({ is_premium: true, premium_activated_at: new Date().toISOString() }).eq("id", progress.id);
      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: "🔥 Fire Pass Premium Aktif!",
        message: `Selamat! Kamu bisa klaim reward Premium di ${season.name}.`,
        type: "success",
      });
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (action === "buy_pro_missions") {
      const { visitorId, method } = body; // 'saldo' | 'gems'
      const season = await getActiveSeason(admin);
      if (!season) return Response.json({ error: "no active season" }, { status: 400, headers: corsHeaders });
      const progress = await getOrCreateProgress(admin, visitorId, season.id);

      const priceSaldo = season.pro_price_saldo_in ?? 30000;
      const priceGems = season.pro_price_gems ?? 500;

      if (method === "gems") {
        const gp = await getGemProfile(admin, visitorId);
        if (!gp || (gp.gems || 0) < priceGems) return Response.json({ error: `Butuh ${priceGems} 💎` }, { status: 400, headers: corsHeaders });
        await admin.from("game_profiles").update({ gems: gp.gems - priceGems }).eq("id", gp.id);
      } else {
        const { data: bal } = await admin.from("user_balances").select("id, balance").eq("id", progress.user_balance_id).maybeSingle();
        if (!bal || (bal.balance || 0) < priceSaldo) return Response.json({ error: `Saldo IN tidak cukup (butuh Rp ${priceSaldo.toLocaleString("id-ID")})` }, { status: 400, headers: corsHeaders });
        await admin.rpc("consume_main_balance_only", { p_balance_id: bal.id, p_amount: priceSaldo });
        await admin.from("balance_transactions").insert({ visitor_id: visitorId, amount: -priceSaldo, type: "fire_pass_pro_missions", description: `Fire Pass Misi PRO 30 hari` });
      }

      const currentUntil = progress.pro_missions_until ? new Date(progress.pro_missions_until).getTime() : 0;
      const base = Math.max(Date.now(), currentUntil);
      const newUntil = new Date(base + 30 * 86400000).toISOString();
      await admin.from("fire_pass_progress").update({ pro_missions_until: newUntil }).eq("id", progress.id);
      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: "🔮 Misi PRO Aktif!",
        message: `Kamu bisa akses misi PRO selama 30 hari.`,
        type: "success",
      });
      return Response.json({ success: true, pro_missions_until: newUntil }, { headers: corsHeaders });
    }

    // ===== MISSIONS =====
    if (action === "list_missions") {
      const { visitorId } = body;
      const season = await getActiveSeason(admin);
      const enriched = await computeMissions(admin, visitorId);
      return Response.json({ missions: enriched, season }, { headers: corsHeaders });
    }

    if (action === "claim_mission") {
      const { visitorId, missionId } = body;
      const { data: mission } = await admin.from("fire_pass_missions").select("*").eq("id", missionId).maybeSingle();
      if (!mission) return Response.json({ error: "Misi tidak ditemukan" }, { status: 404, headers: corsHeaders });
      const enriched = await computeMissions(admin, visitorId);
      const m = enriched.find((x: any) => x.id === missionId);
      if (!m) return Response.json({ error: "Misi tidak valid" }, { status: 400, headers: corsHeaders });
      if (!m.is_completed) return Response.json({ error: "Misi belum selesai" }, { status: 400, headers: corsHeaders });
      if (m.is_claimed) return Response.json({ error: "Sudah diklaim" }, { status: 400, headers: corsHeaders });

      await admin.from("fire_pass_mission_progress").upsert({
        visitor_id: visitorId, mission_id: missionId, period_key: m.period_key,
        current_value: m.current_value, is_completed: true, is_claimed: true, claimed_at: new Date().toISOString(),
      }, { onConflict: "visitor_id,mission_id,period_key" });

      const season = await getActiveSeason(admin);
      if (season) {
        const progress = await getOrCreateProgress(admin, visitorId, season.id);
        const newBadges = (progress.badges || 0) + (mission.badge_reward || 1);
        await admin.from("fire_pass_progress").update({ badges: newBadges }).eq("id", progress.id);
        await admin.from("fire_pass_badge_log").insert({ season_id: season.id, visitor_id: visitorId, source: `mission:${mission.code}`, amount: mission.badge_reward || 1 });
      }
      return Response.json({ success: true, badges_awarded: mission.badge_reward }, { headers: corsHeaders });
    }

    if (action === "complete_with_gems") {
      const { visitorId, missionId } = body;
      const { data: mission } = await admin.from("fire_pass_missions").select("*").eq("id", missionId).maybeSingle();
      if (!mission) return Response.json({ error: "Misi tidak ditemukan" }, { status: 404, headers: corsHeaders });

      const b = mission.badge_reward || 1;
      const lvlInfo = missionLevel(b);
      const gemCost = lvlInfo.gemCost;
      const bonus = Math.max(1, Math.ceil(b * 0.5));

      const enriched = await computeMissions(admin, visitorId);
      const m = enriched.find((x: any) => x.id === missionId);
      if (!m) return Response.json({ error: "Misi tidak valid" }, { status: 400, headers: corsHeaders });
      if (m.is_claimed) return Response.json({ error: "Sudah diklaim" }, { status: 400, headers: corsHeaders });
      if (m.is_completed) return Response.json({ error: "Misi sudah selesai, gunakan Klaim biasa" }, { status: 400, headers: corsHeaders });

      const gp = await getGemProfile(admin, visitorId);
      if (!gp || (gp.gems || 0) < gemCost) return Response.json({ error: `Butuh ${gemCost} 💎 (kamu punya ${gp?.gems || 0})` }, { status: 400, headers: corsHeaders });
      await admin.from("game_profiles").update({ gems: (gp.gems || 0) - gemCost }).eq("id", gp.id);

      await admin.from("fire_pass_mission_progress").upsert({
        visitor_id: visitorId, mission_id: missionId, period_key: m.period_key,
        current_value: mission.target_value, is_completed: true, is_claimed: true, claimed_at: new Date().toISOString(),
      }, { onConflict: "visitor_id,mission_id,period_key" });

      const totalBadges = b + bonus;
      const season = await getActiveSeason(admin);
      if (season) {
        const progress = await getOrCreateProgress(admin, visitorId, season.id);
        const newBadges = (progress.badges || 0) + totalBadges;
        await admin.from("fire_pass_progress").update({ badges: newBadges }).eq("id", progress.id);
        await admin.from("fire_pass_badge_log").insert({ season_id: season.id, visitor_id: visitorId, source: `gem_complete:${mission.code}`, amount: totalBadges });
        await admin.from("fire_pass_gem_spend").insert({
          season_id: season.id,
          visitor_id: visitorId,
          user_balance_id: progress.user_balance_id ?? null,
          mission_id: missionId,
          mission_title: mission.title,
          mission_level: lvlInfo.level,
          gems_spent: gemCost,
          badges_awarded: totalBadges,
        });
      }
      await admin.from("notifications").insert({
        visitor_id: visitorId,
        title: "💎 Misi Diselesaikan dengan Gem",
        message: `${mission.title} · Lv.${lvlInfo.level} ${lvlInfo.label} · -${gemCost} 💎 · +${totalBadges} 🏅 (bonus +${bonus})`,
        type: "success",
      });
      return Response.json({ success: true, badges_awarded: totalBadges, gem_cost: gemCost, bonus, mission_level: lvlInfo.level, level_label: lvlInfo.label }, { headers: corsHeaders });
    }


    if (action === "gem_leaderboard") {
      const { visitorId } = body;
      const season = await getActiveSeason(admin);
      if (!season) return Response.json({ rows: [], me: null }, { headers: corsHeaders });
      const { data: spends } = await admin.from("fire_pass_gem_spend")
        .select("visitor_id, user_balance_id, gems_spent, badges_awarded, mission_level")
        .eq("season_id", season.id);

      const map = new Map<string, any>();
      for (const s of spends || []) {
        const key = s.user_balance_id || `v:${s.visitor_id}`;
        const cur = map.get(key) || { key, user_balance_id: s.user_balance_id, visitor_id: s.visitor_id, gems: 0, badges: 0, missions: 0, best_level: 0 };
        cur.gems += s.gems_spent || 0;
        cur.badges += s.badges_awarded || 0;
        cur.missions += 1;
        cur.best_level = Math.max(cur.best_level, s.mission_level || 1);
        map.set(key, cur);
      }
      const all = [...map.values()].sort((a, b) => b.gems - a.gems);

      const ubIds = all.map((r) => r.user_balance_id).filter(Boolean);
      const nameMap = new Map<string, any>();
      if (ubIds.length) {
        const { data: ubs } = await admin.from("user_balances").select("id, username, avatar_url").in("id", ubIds);
        for (const u of ubs || []) nameMap.set(u.id, u);
      }
      const mask = (n: string) => (n.length <= 2 ? n[0] + "***" : n.length <= 4 ? n[0] + "***" + n.slice(-1) : n.slice(0, 3) + "***" + n.slice(-2));

      let myUbId: string | null = null;
      if (visitorId) {
        const { data: blh } = await admin.from("balance_login_history").select("user_balance_id").eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
        myUbId = blh?.user_balance_id ?? null;
      }
      const myKey = myUbId || (visitorId ? `v:${visitorId}` : null);

      const rows = all.slice(0, 50).map((r, i) => {
        const u = r.user_balance_id ? nameMap.get(r.user_balance_id) : null;
        const isMe = myKey != null && r.key === myKey;
        return {
          rank: i + 1,
          name: u?.username ? (isMe ? u.username : mask(u.username)) : "Tamu",
          avatar_url: u?.avatar_url ?? null,
          gems: r.gems,
          badges: r.badges,
          missions: r.missions,
          best_level: r.best_level,
          is_me: isMe,
          has_account: !!r.user_balance_id,
        };
      });

      let me: any = null;
      if (myKey) {
        const idx = all.findIndex((r) => r.key === myKey);
        if (idx >= 0) {
          const r = all[idx];
          const u = r.user_balance_id ? nameMap.get(r.user_balance_id) : null;
          me = { rank: idx + 1, name: u?.username || "Tamu", gems: r.gems, badges: r.badges, missions: r.missions, best_level: r.best_level, is_me: true, has_account: !!r.user_balance_id };
        }
      }
      return Response.json({ rows, me, total_players: all.length }, { headers: corsHeaders });
    }

    // ===== PROFIL PEMAIN =====
    if (action === "profile" || action === "search_profiles") {
      const season = await getActiveSeason(admin);
      if (!season) return Response.json({ season: null, me: null, results: [] }, { headers: corsHeaders });

      const { data: tiers } = await admin.from("fire_pass_tiers")
        .select("tier_level, badge_required").eq("season_id", season.id).order("tier_level");
      const levelOf = (badges: number) => {
        let lvl = 0;
        for (const t of tiers || []) { if ((badges || 0) >= t.badge_required) lvl = t.tier_level; else break; }
        return lvl;
      };
      const maxLevel = (tiers || []).length;

      const { data: rows } = await admin.from("fire_pass_progress")
        .select("visitor_id, user_balance_id, badges, is_premium, claimed_free_tiers, claimed_premium_tiers, pro_missions_until")
        .eq("season_id", season.id);

      const ubIds = [...new Set((rows || []).map((r: any) => r.user_balance_id).filter(Boolean))];
      const nameMap = new Map<string, any>();
      if (ubIds.length) {
        const { data: ubs } = await admin.from("user_balances").select("id, username, avatar_url").in("id", ubIds);
        for (const u of ubs || []) nameMap.set(u.id, u);
      }

      const toCard = (r: any) => {
        const u = r.user_balance_id ? nameMap.get(r.user_balance_id) : null;
        return {
          name: u?.username || "Tamu",
          avatar_url: u?.avatar_url ?? null,
          badges: r.badges || 0,
          level: levelOf(r.badges || 0),
          max_level: maxLevel,
          is_premium: !!r.is_premium,
          pro_active: !!r.pro_missions_until && new Date(r.pro_missions_until).getTime() > Date.now(),
          claimed_tiers: (r.claimed_free_tiers?.length || 0) + (r.claimed_premium_tiers?.length || 0),
          visitor_id: r.visitor_id,
        };
      };

      const visitorId = body.visitorId;
      let myUbId: string | null = null;
      if (visitorId) {
        const { data: blh } = await admin.from("balance_login_history").select("user_balance_id")
          .eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(1).maybeSingle();
        myUbId = blh?.user_balance_id ?? null;
      }
      const myRow = (rows || []).find((r: any) =>
        (myUbId && r.user_balance_id === myUbId) || r.visitor_id === visitorId) || null;
      const me = myRow ? toCard(myRow) : null;

      if (action === "profile") {
        return Response.json({ season, me, total_players: (rows || []).length, max_level: maxLevel }, { headers: corsHeaders });
      }

      const q = String(body.query || "").trim().toLowerCase();
      let cards = (rows || []).map(toCard).filter((c: any) => c.name !== "Tamu");
      if (q) cards = cards.filter((c: any) => c.name.toLowerCase().includes(q));
      cards.sort((a: any, b: any) => b.badges - a.badges);
      return Response.json({
        season, me, max_level: maxLevel,
        total_players: (rows || []).length,
        results: cards.slice(0, 10).map((c: any) => ({ ...c, visitor_id: undefined })),
      }, { headers: corsHeaders });
    }

    if (action === "admin_upsert_mission") {
      const { id, ...rest } = body.mission;
      if (id) await admin.from("fire_pass_missions").update(rest).eq("id", id);
      else await admin.from("fire_pass_missions").insert(rest);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (action === "admin_delete_mission") {
      await admin.from("fire_pass_missions").delete().eq("id", body.id);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    // === ADMIN ===
    if (action === "admin_upsert_season") {
      const { id, season_number, name, description, starts_at, ends_at, is_active, free_premium_enabled, price_saldo_in, price_gems, pro_price_saldo_in, pro_price_gems } = body;
      const payload: any = { season_number, name, description, starts_at, ends_at, is_active, free_premium_enabled, price_saldo_in, price_gems };
      if (pro_price_saldo_in !== undefined) payload.pro_price_saldo_in = pro_price_saldo_in;
      if (pro_price_gems !== undefined) payload.pro_price_gems = pro_price_gems;
      if (id) await admin.from("fire_pass_seasons").update(payload).eq("id", id);
      else await admin.from("fire_pass_seasons").insert(payload);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (action === "history") {
      const { visitorId } = body;
      const season = await getActiveSeason(admin);
      if (!season) return Response.json({ badges: [], tiers: [], missions: [] }, { headers: corsHeaders });
      const progress = await getOrCreateProgress(admin, visitorId, season.id);

      const [{ data: badgeLog }, { data: tiers }, { data: missionClaims }, { data: allMissions }] = await Promise.all([
        admin.from("fire_pass_badge_log").select("*").eq("season_id", season.id).eq("visitor_id", visitorId).order("created_at", { ascending: false }).limit(100),
        admin.from("fire_pass_tiers").select("*").eq("season_id", season.id).order("tier_level"),
        admin.from("fire_pass_mission_progress").select("*").eq("visitor_id", visitorId).eq("is_claimed", true).order("claimed_at", { ascending: false }).limit(100),
        admin.from("fire_pass_missions").select("id, title, mission_type, badge_reward"),
      ]);

      const claimedFree: number[] = progress.claimed_free_tiers || [];
      const claimedPrem: number[] = progress.claimed_premium_tiers || [];
      const tierRows = (tiers || []).flatMap((t: any) => {
        const rows: any[] = [];
        if (claimedFree.includes(t.tier_level)) rows.push({ tier_level: t.tier_level, track: "free", label: t.free_reward_label });
        if (claimedPrem.includes(t.tier_level)) rows.push({ tier_level: t.tier_level, track: "premium", label: t.premium_reward_label });
        return rows;
      });

      const missionMap = new Map((allMissions || []).map((m: any) => [m.id, m]));
      const missionRows = (missionClaims || []).map((c: any) => {
        const m = missionMap.get(c.mission_id);
        return {
          claimed_at: c.claimed_at,
          title: m?.title || "Misi",
          mission_type: m?.mission_type || "-",
          badge_reward: m?.badge_reward || 0,
        };
      });

      return Response.json({ badges: badgeLog || [], tiers: tierRows, missions: missionRows }, { headers: corsHeaders });
    }

    if (action === "admin_upsert_tier") {
      const { id, ...rest } = body.tier;
      if (id) await admin.from("fire_pass_tiers").update(rest).eq("id", id);
      else await admin.from("fire_pass_tiers").insert(rest);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (action === "admin_delete_tier") {
      await admin.from("fire_pass_tiers").delete().eq("id", body.id);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    if (action === "admin_grant_premium") {
      const { visitorId } = body;
      const season = await getActiveSeason(admin);
      if (!season) return Response.json({ error: "no active season" }, { status: 400, headers: corsHeaders });
      const progress = await getOrCreateProgress(admin, visitorId, season.id);
      await admin.from("fire_pass_progress").update({ is_premium: true, premium_activated_at: new Date().toISOString() }).eq("id", progress.id);
      return Response.json({ success: true }, { headers: corsHeaders });
    }

    return Response.json({ error: "Unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500, headers: corsHeaders });
  }
});
