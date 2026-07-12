import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function wibNow(): Date {
  return new Date(Date.now() + 7 * 60 * 60 * 1000);
}
function todayWIB(): string {
  return wibNow().toISOString().split("T")[0];
}
function weekStartWIB(): string {
  const wib = wibNow();
  const day = wib.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(wib);
  monday.setUTCDate(wib.getUTCDate() + diff);
  return monday.toISOString().split("T")[0];
}
function weekStartISO(): string {
  return weekStartWIB() + "T00:00:00.000Z";
}

const MISSIONS = [
  { key: "beli_produk", title: "Beli 3 Produk", desc: "Belanja produk pakai saldo", icon: "shopping", target: 3, reward: 3000 },
  { key: "isi_saldo", title: "Isi Saldo 1x", desc: "Lakukan top up saldo", icon: "wallet", target: 1, reward: 2000 },
  { key: "putar_roda", title: "Putar Roda 3x", desc: "Main Roda Diskon", icon: "spin", target: 3, reward: 1500 },
  { key: "ajak_teman", title: "Ajak 1 Teman", desc: "Undang lewat kode referral", icon: "users", target: 1, reward: 3000 },
];

const DAILY_BOX = [
  { v: 500, w: 40 }, { v: 1000, w: 30 }, { v: 2000, w: 18 }, { v: 3000, w: 9 }, { v: 5000, w: 3 },
];
const BONUS_BOX = [
  { v: 2000, w: 40 }, { v: 3000, w: 30 }, { v: 5000, w: 20 }, { v: 10000, w: 10 },
];
function pick(pool: { v: number; w: number }[]): number {
  const total = pool.reduce((s, p) => s + p.w, 0);
  let r = Math.random() * total;
  for (const p of pool) { if ((r -= p.w) <= 0) return p.v; }
  return pool[0].v;
}

async function grantSaldoIn(admin: any, visitorId: string, amount: number, desc: string) {
  const { data: bal } = await admin.from("user_balances").select("id,bonus_balance").eq("visitor_id", visitorId).maybeSingle();
  if (!bal) throw new Error("Akun saldo tidak ditemukan");
  await admin.from("user_balances").update({ bonus_balance: (bal.bonus_balance || 0) + amount }).eq("id", bal.id);
  const trx = "#" + Math.floor(10000 + Math.random() * 89999);
  await admin.from("balance_transactions").insert({
    visitor_id: visitorId, type: "reward", amount, description: desc, trx_id: trx,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let body: any = {};
    try { body = await req.json(); } catch { body = {}; }
    const action = body?.action || "status";
    const visitorId: string = body?.visitorId;
    if (!visitorId) return Response.json({ error: "visitorId required" }, { status: 400, headers: corsHeaders });

    const week = weekStartWIB();
    const weekISO = weekStartISO();
    const today = todayWIB();

    async function computeProgress() {
      const { data: bal } = await admin.from("user_balances").select("id").eq("visitor_id", visitorId).maybeSingle();
      const [buy, topup, spin, ref] = await Promise.all([
        admin.from("balance_transactions").select("id", { count: "exact", head: true }).eq("visitor_id", visitorId).eq("type", "purchase").gte("created_at", weekISO),
        admin.from("balance_transactions").select("id", { count: "exact", head: true }).eq("visitor_id", visitorId).in("type", ["topup", "topup_bonus"]).gte("created_at", weekISO),
        admin.from("spin_wheel_history").select("id", { count: "exact", head: true }).eq("visitor_id", visitorId).gte("created_at", weekISO),
        bal ? admin.from("store_referral_uses").select("id", { count: "exact", head: true }).eq("referrer_balance_id", bal.id).gte("created_at", weekISO) : Promise.resolve({ count: 0 }),
      ]);
      return {
        beli_produk: (buy as any).count || 0,
        isi_saldo: (topup as any).count || 0,
        putar_roda: (spin as any).count || 0,
        ajak_teman: (ref as any).count || 0,
      } as Record<string, number>;
    }

    if (action === "status") {
      const progress = await computeProgress();
      const { data: claims } = await admin.from("ruangku_mission_claims").select("mission_key").eq("visitor_id", visitorId).eq("week_start", week);
      const claimedKeys = new Set((claims || []).map((c: any) => c.mission_key));
      const missions = MISSIONS.map((m) => {
        const current = Math.min(progress[m.key] || 0, m.target);
        return { ...m, current, completed: (progress[m.key] || 0) >= m.target, claimed: claimedKeys.has(m.key) };
      });
      const allClaimed = missions.every((m) => m.claimed);

      const { data: dailyBox } = await admin.from("ruangku_luckybox_claims").select("id,reward_value").eq("visitor_id", visitorId).eq("claim_date", today).eq("source", "daily").maybeSingle();
      const { data: weekBonusBox } = await admin.from("ruangku_luckybox_claims").select("id").eq("visitor_id", visitorId).eq("source", "weekly_bonus").gte("claimed_at", weekISO).maybeSingle();

      // leaderboard: top saldo in
      const { data: top } = await admin.from("user_balances").select("visitor_id,username,bonus_balance").order("bonus_balance", { ascending: false }).limit(5);
      const leaderboard = (top || []).map((r: any) => ({
        me: r.visitor_id === visitorId,
        username: (r.username || "User").slice(0, 3) + "•••",
        value: r.bonus_balance || 0,
      }));

      return Response.json({
        weekStart: week,
        missions,
        dailyBoxAvailable: !dailyBox,
        weekBonusUnlocked: allClaimed && !weekBonusBox,
        leaderboard,
      }, { headers: corsHeaders });
    }

    if (action === "claim_mission") {
      const key = body?.missionKey;
      const mission = MISSIONS.find((m) => m.key === key);
      if (!mission) return Response.json({ error: "Misi tidak ditemukan" }, { status: 404, headers: corsHeaders });
      const progress = await computeProgress();
      if ((progress[key] || 0) < mission.target) return Response.json({ error: "Misi belum selesai" }, { status: 400, headers: corsHeaders });
      const { error: insErr } = await admin.from("ruangku_mission_claims").insert({
        visitor_id: visitorId, week_start: week, mission_key: key, reward_value: mission.reward,
      });
      if (insErr) return Response.json({ error: "Misi sudah diklaim" }, { status: 400, headers: corsHeaders });
      await grantSaldoIn(admin, visitorId, mission.reward, `Misi Mingguan: ${mission.title}`);
      return Response.json({ ok: true, reward: mission.reward }, { headers: corsHeaders });
    }

    if (action === "open_box") {
      const kind = body?.kind === "weekly_bonus" ? "weekly_bonus" : "daily";
      if (kind === "daily") {
        const { data: exist } = await admin.from("ruangku_luckybox_claims").select("id").eq("visitor_id", visitorId).eq("claim_date", today).eq("source", "daily").maybeSingle();
        if (exist) return Response.json({ error: "Kotak harian sudah dibuka" }, { status: 400, headers: corsHeaders });
        const value = pick(DAILY_BOX);
        const { error } = await admin.from("ruangku_luckybox_claims").insert({
          visitor_id: visitorId, claim_date: today, source: "daily", reward_type: "saldo_in", reward_value: value, reward_label: "Lucky Box Harian",
        });
        if (error) return Response.json({ error: "Kotak harian sudah dibuka" }, { status: 400, headers: corsHeaders });
        await grantSaldoIn(admin, visitorId, value, "Lucky Box Harian");
        return Response.json({ ok: true, reward: value }, { headers: corsHeaders });
      } else {
        // weekly bonus: require all missions claimed & not yet taken this week
        const { data: claims } = await admin.from("ruangku_mission_claims").select("mission_key").eq("visitor_id", visitorId).eq("week_start", week);
        const claimedKeys = new Set((claims || []).map((c: any) => c.mission_key));
        const allClaimed = MISSIONS.every((m) => claimedKeys.has(m.key));
        if (!allClaimed) return Response.json({ error: "Selesaikan semua misi dulu" }, { status: 400, headers: corsHeaders });
        const { data: exist } = await admin.from("ruangku_luckybox_claims").select("id").eq("visitor_id", visitorId).eq("source", "weekly_bonus").gte("claimed_at", weekISO).maybeSingle();
        if (exist) return Response.json({ error: "Kotak bonus minggu ini sudah dibuka" }, { status: 400, headers: corsHeaders });
        const value = pick(BONUS_BOX);
        await admin.from("ruangku_luckybox_claims").insert({
          visitor_id: visitorId, claim_date: today, source: "weekly_bonus", reward_type: "saldo_in", reward_value: value, reward_label: "Lucky Box Bonus Mingguan",
        });
        await grantSaldoIn(admin, visitorId, value, "Lucky Box Bonus Mingguan");
        return Response.json({ ok: true, reward: value }, { headers: corsHeaders });
      }
    }

    return Response.json({ error: "unknown action" }, { status: 400, headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "error" }, { status: 500, headers: corsHeaders });
  }
});
