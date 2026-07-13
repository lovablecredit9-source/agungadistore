import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_USER_ID = "7729a4c3-fcf6-4ae1-8424-9e6cc950d0fd";

function json(data: Record<string, unknown>, status = 200) {
  return Response.json(data, { status, headers: corsHeaders });
}

function getIp(req: Request) {
  return (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "").split(",")[0].trim() || null;
}

function getWibToday(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().split("T")[0];
}

function periodStart(period: string): string {
  const wib = new Date(Date.now() + 7 * 3600 * 1000);
  if (period === "weekly") {
    const day = wib.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    wib.setUTCDate(wib.getUTCDate() + diff);
  } else if (period === "monthly") {
    wib.setUTCDate(1);
  }
  return wib.toISOString().split("T")[0];
}

async function sha256(pin: string) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getBalanceAccount(admin: any, visitorId: string) {
  const [{ data: balance }, { data: login }] = await Promise.all([
    admin.from("user_balances").select("id, visitor_id, username, balance").eq("visitor_id", visitorId).maybeSingle(),
    admin.from("balance_login_history").select("user_balance_id").eq("visitor_id", visitorId).order("logged_in_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const userBalanceId = login?.user_balance_id ?? balance?.id ?? null;
  return { balance, userBalanceId };
}

async function isPremiumActive(admin: any, visitorId: string) {
  const { data } = await admin.rpc("is_premium_quest_active", { p_visitor_id: visitorId });
  return !!data;
}

async function addRewards(admin: any, visitorId: string, quest: any) {
  const rewardCoins = Number(quest.reward_coins || 0);
  const rewardSaldoIn = Number(quest.reward_saldo_in || 0);
  const rewardGems = Number(quest.reward_gems || 0);

  if (rewardCoins > 0) {
    const today = getWibToday();
    const { data: streak } = await admin.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
    if (streak) {
      await admin.from("daily_streaks").update({ streak_coins: Number(streak.streak_coins || 0) + rewardCoins }).eq("id", streak.id);
    } else {
      await admin.from("daily_streaks").insert({ visitor_id: visitorId, streak_coins: rewardCoins, last_claim_date: today });
    }
  }

  if (rewardSaldoIn > 0) {
    const { data: gameBal } = await admin.from("game_balance").select("amount,total_earned").eq("visitor_id", visitorId).maybeSingle();
    if (gameBal) {
      await admin.from("game_balance").update({
        amount: Number(gameBal.amount || 0) + rewardSaldoIn,
        total_earned: Number(gameBal.total_earned || 0) + rewardSaldoIn,
        updated_at: new Date().toISOString(),
      }).eq("visitor_id", visitorId);
    } else {
      await admin.from("game_balance").insert({ visitor_id: visitorId, amount: rewardSaldoIn, total_earned: rewardSaldoIn });
    }
    await admin.from("game_balance_transactions").insert({
      visitor_id: visitorId,
      type: "premium_quest_reward",
      amount: rewardSaldoIn,
      description: `Premium Quest: ${quest.title}`,
    });
  }

  if (rewardGems > 0) {
    await admin.rpc("add_account_gems", { p_visitor_id: visitorId, p_amount: rewardGems });
  }
}

async function trackQuest(admin: any, visitorId: string, eventType: string, increment: number, purchaseAmount = 0) {
  if (!visitorId || !eventType) return 0;
  if (!(await isPremiumActive(admin, visitorId))) return 0;
  const { userBalanceId } = await getBalanceAccount(admin, visitorId);
  const nowIso = new Date().toISOString();

  const { data: quests } = await admin
    .from("premium_quests")
    .select("*")
    .eq("is_active", true)
    .eq("quest_type", eventType)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order("sort_order", { ascending: true });

  let updated = 0;
  for (const quest of quests || []) {
    if (eventType === "purchase" && Number(quest.min_purchase_amount || 0) > Number(purchaseAmount || 0)) continue;
    const start = periodStart(quest.period || "daily");
    const { data: existing } = await admin
      .from("premium_quest_progress")
      .select("*")
      .eq("quest_id", quest.id)
      .eq("visitor_id", visitorId)
      .eq("period_start", start)
      .maybeSingle();

    if (existing?.is_completed) continue;
    const next = Math.min(Number(quest.target_value || 1), Number(existing?.current_value || 0) + Math.max(1, Math.floor(Number(increment || 1))));
    const payload = {
      quest_id: quest.id,
      visitor_id: visitorId,
      user_balance_id: userBalanceId,
      period: quest.period,
      period_start: start,
      current_value: next,
      is_completed: next >= Number(quest.target_value || 1),
      updated_at: new Date().toISOString(),
    };
    if (existing) await admin.from("premium_quest_progress").update(payload).eq("id", existing.id);
    else await admin.from("premium_quest_progress").insert(payload);
    updated++;
  }
  return updated;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
    let body: any = {};
    if (req.method !== "GET") {
      try { body = await req.json(); } catch { body = {}; }
    }
    const url = new URL(req.url);
    const action = body.action || url.searchParams.get("action") || "status";

    if (action === "status") {
      const visitorId = body.visitorId || url.searchParams.get("visitorId");
      if (!visitorId) return json({ error: "visitorId required" }, 400);
      const nowIso = new Date().toISOString();
      const { userBalanceId } = await getBalanceAccount(admin, visitorId);
      const [{ data: infoRows }, { data: plans }, { data: quests }] = await Promise.all([
        admin.rpc("get_premium_quest_info", { p_visitor_id: visitorId }),
        admin.from("premium_quest_plans").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
        admin.from("premium_quests").select("*").eq("is_active", true).order("sort_order", { ascending: true }),
      ]);
      const info = Array.isArray(infoRows) ? infoRows[0] : infoRows;
      const starts = [...new Set((quests || []).map((q: any) => periodStart(q.period || "daily")))];
      const ids = (quests || []).map((q: any) => q.id);
      let progress: any[] = [];
      if (ids.length) {
        const { data } = await admin.from("premium_quest_progress").select("*").eq("visitor_id", visitorId).in("quest_id", ids).in("period_start", starts);
        progress = data || [];
      }
      let historyQuery = admin
        .from("premium_quest_subscriptions")
        .select("id, plan_name, duration_seconds, price_paid_balance, price_paid_saldo_in, starts_at, expires_at, is_permanent, is_active, source, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      historyQuery = userBalanceId ? historyQuery.or(`visitor_id.eq.${visitorId},user_balance_id.eq.${userBalanceId}`) : historyQuery.eq("visitor_id", visitorId);
      const { data: history } = await historyQuery;
      return json({ now: nowIso, info: info || { is_active: false, can_trial: true }, plans: plans || [], quests: quests || [], progress, history: history || [] });
    }

    if (action === "track") {
      const updated = await trackQuest(admin, String(body.visitorId || ""), String(body.eventType || ""), Number(body.increment || 1), Number(body.purchaseAmount || 0));
      return json({ updated });
    }

    if (action === "claim") {
      const visitorId = String(body.visitorId || "");
      const questId = String(body.questId || "");
      if (!visitorId || !questId) return json({ error: "visitorId & questId required" }, 400);
      if (!(await isPremiumActive(admin, visitorId))) return json({ error: "Premium Quest belum aktif / sudah habis" }, 403);
      const { data: quest } = await admin.from("premium_quests").select("*").eq("id", questId).maybeSingle();
      if (!quest) return json({ error: "Quest tidak ditemukan" }, 404);
      const start = periodStart(quest.period || "daily");
      const { data: progress } = await admin.from("premium_quest_progress").select("*").eq("quest_id", questId).eq("visitor_id", visitorId).eq("period_start", start).maybeSingle();
      if (!progress || !progress.is_completed) return json({ error: "Quest belum selesai" }, 400);
      if (progress.claimed_at) return json({ error: "Sudah diklaim" }, 400);
      await addRewards(admin, visitorId, quest);
      await admin.from("premium_quest_progress").update({ claimed_at: new Date().toISOString() }).eq("id", progress.id);
      await trackQuest(admin, visitorId, "quest_claim", 1, 0);
      await admin.rpc("create_notification", {
        p_visitor_id: visitorId,
        p_title: `👑 Premium Quest Selesai`,
        p_message: `Reward ${quest.title}: 💎 ${quest.reward_gems || 0} + 🪙 ${quest.reward_coins || 0} + IN ${quest.reward_saldo_in || 0}`,
        p_type: "success",
        p_related_id: questId,
      });
      return json({ success: true, coins: quest.reward_coins || 0, saldo_in: quest.reward_saldo_in || 0, gems: quest.reward_gems || 0 });
    }

    if (action === "trial") {
      const visitorId = String(body.visitorId || "");
      const deviceKey = String(body.deviceKey || "");
      if (!visitorId || !deviceKey) return json({ error: "Login dan perangkat wajib" }, 400);
      const { balance, userBalanceId } = await getBalanceAccount(admin, visitorId);
      if (!balance) return json({ error: "Login akun saldo dulu" }, 403);
      const ip = getIp(req);
      const ipFilter = ip ? `,ip_address.eq.${ip}` : "";
      const { data: existing } = await admin.from("premium_quest_trials").select("id").or(`visitor_id.eq.${visitorId},device_key.eq.${deviceKey}${userBalanceId ? `,user_balance_id.eq.${userBalanceId}` : ""}${ipFilter}`).limit(1);
      if (existing && existing.length > 0) return json({ error: "Trial gratis sudah pernah diklaim akun/perangkat ini" }, 400);
      const startsAt = new Date();
      const expiresAt = new Date(startsAt.getTime() + 86400 * 1000);
      await admin.from("premium_quest_trials").insert({ visitor_id: visitorId, user_balance_id: userBalanceId, device_key: deviceKey, ip_address: ip });
      await admin.from("premium_quest_subscriptions").insert({
        visitor_id: visitorId,
        user_balance_id: userBalanceId,
        plan_name: "Trial Premium Quest 1 Hari",
        duration_seconds: 86400,
        price_paid_balance: 0,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        source: "trial",
        device_key: deviceKey,
        ip_address: ip,
      });
      await admin.rpc("create_notification", { p_visitor_id: visitorId, p_title: "👑 Trial Premium Quest Aktif", p_message: "Gratis 1 hari aktif. Selesaikan PRO LEGEND sebelum waktu habis!", p_type: "success", p_related_id: null });
      return json({ success: true, expires_at: expiresAt.toISOString() });
    }

    if (action === "purchase") {
      const visitorId = String(body.visitorId || "");
      const planId = String(body.planId || "");
      const pin = String(body.pin || "");
      if (!visitorId || !planId) return json({ error: "Data tidak lengkap" }, 400);
      if (pin.length !== 6) return json({ error: "PIN 6 digit diperlukan", needPin: true }, 400);
      const { data: plan } = await admin.from("premium_quest_plans").select("*").eq("id", planId).eq("is_active", true).maybeSingle();
      if (!plan || plan.code === "TRIAL_1D") return json({ error: "Paket tidak tersedia" }, 400);
      const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", visitorId).maybeSingle();
      if (!pinRow) return json({ error: "PIN belum dibuat", needPin: true }, 400);
      if ((await sha256(pin)) !== pinRow.pin_hash) return json({ error: "PIN salah", needPin: true }, 400);
      const { balance, userBalanceId } = await getBalanceAccount(admin, visitorId);
      if (!balance) return json({ error: "Akun saldo tidak ditemukan" }, 404);
      const { data: gameBal } = await admin.from("game_balance").select("id, amount, total_spent").eq("visitor_id", visitorId).maybeSingle();
      const price = Number(plan.price_balance || 0) + Number(plan.price_saldo_in || 0);
      const gameAmount = Number(gameBal?.amount || 0);
      const mainAmount = Number(balance.balance || 0);
      const payFromGame = Math.min(gameAmount, price);
      const payFromMain = price - payFromGame;
      if (mainAmount < payFromMain) return json({ error: "Saldo tidak cukup" }, 400);

      const { data: existingSub } = await admin.from("premium_quest_subscriptions")
        .select("expires_at, is_permanent")
        .eq("is_active", true)
        .or(`visitor_id.eq.${visitorId}${userBalanceId ? `,user_balance_id.eq.${userBalanceId}` : ""}`)
        .order("expires_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      if (existingSub?.is_permanent) return json({ error: "Premium Quest sudah permanen" }, 400);
      const startsAt = existingSub?.expires_at && new Date(existingSub.expires_at).getTime() > Date.now() ? new Date(existingSub.expires_at) : new Date();
      const expiresAt = plan.is_permanent ? null : new Date(startsAt.getTime() + Number(plan.duration_seconds || 0) * 1000);

      if (payFromGame > 0 && gameBal) {
        await admin.from("game_balance").update({ amount: gameAmount - payFromGame, total_spent: Number(gameBal.total_spent || 0) + payFromGame }).eq("id", gameBal.id);
        await admin.from("game_balance_transactions").insert({ visitor_id: visitorId, type: "spend", amount: -payFromGame, description: `Beli ${plan.name}` });
      }
      if (payFromMain > 0) await admin.from("user_balances").update({ balance: mainAmount - payFromMain }).eq("id", balance.id);
      await admin.from("balance_transactions").insert({ visitor_id: visitorId, type: "purchase", amount: payFromMain, description: `Premium Quest: ${plan.name}` });
      await admin.from("premium_quest_subscriptions").insert({
        visitor_id: visitorId,
        user_balance_id: userBalanceId,
        plan_id: plan.id,
        plan_name: plan.name,
        duration_seconds: plan.duration_seconds,
        price_paid_balance: payFromMain,
        price_paid_saldo_in: payFromGame,
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt?.toISOString() ?? null,
        is_permanent: !!plan.is_permanent,
        source: "purchase",
        device_key: body.deviceKey || null,
        ip_address: getIp(req),
      });
      await admin.rpc("create_notification", { p_visitor_id: visitorId, p_title: "👑 Premium Quest Aktif", p_message: `${plan.name} aktif${expiresAt ? ` sampai ${expiresAt.toLocaleString("id-ID")}` : " permanen"}.`, p_type: "success", p_related_id: null });
      return json({ success: true, plan_name: plan.name, expires_at: expiresAt?.toISOString() ?? null, is_permanent: !!plan.is_permanent });
    }

    if (action === "adminGrant") {
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      if (!token) return json({ error: "Admin auth required" }, 401);
      const { data: userData } = await admin.auth.getUser(token);
      if (userData?.user?.id !== ADMIN_USER_ID) return json({ error: "Bukan admin" }, 403);
      const username = String(body.username || "").trim();
      const seconds = Math.max(1, Number(body.seconds || 0));
      if (!username || seconds <= 0) return json({ error: "Username dan durasi wajib" }, 400);
      const { data: users } = await admin.from("user_balances").select("id, visitor_id, username").ilike("username", username).limit(2);
      if (!users || users.length === 0) return json({ error: "User tidak ditemukan" }, 404);
      if (users.length > 1) return json({ error: "Username ganda" }, 400);
      const u = users[0];
      const { data: existing } = await admin.from("premium_quest_subscriptions").select("expires_at,is_permanent").eq("is_active", true).or(`visitor_id.eq.${u.visitor_id},user_balance_id.eq.${u.id}`).order("expires_at", { ascending: false, nullsFirst: false }).limit(1).maybeSingle();
      if (existing?.is_permanent) return json({ error: "User sudah permanen" }, 400);
      const startsAt = existing?.expires_at && new Date(existing.expires_at).getTime() > Date.now() ? new Date(existing.expires_at) : new Date();
      const expiresAt = new Date(startsAt.getTime() + seconds * 1000);
      await admin.from("premium_quest_subscriptions").insert({ visitor_id: u.visitor_id, user_balance_id: u.id, plan_name: `Premium Quest Admin (${Math.ceil(seconds / 86400)} hari)`, duration_seconds: seconds, starts_at: startsAt.toISOString(), expires_at: expiresAt.toISOString(), source: "admin", admin_note: body.note || null });
      await admin.rpc("create_notification", { p_visitor_id: u.visitor_id, p_title: "👑 Premium Quest Diaktifkan Admin", p_message: `Premium Quest aktif sampai ${expiresAt.toLocaleString("id-ID")}.`, p_type: "success", p_related_id: null });
      return json({ success: true, username: u.username, expires_at: expiresAt.toISOString() });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Error" }, 500);
  }
});
