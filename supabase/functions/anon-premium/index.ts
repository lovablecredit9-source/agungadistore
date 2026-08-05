import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Plan = { code: string; name: string; days: number; price: number; gems: number | null };

const PLANS: Plan[] = [
  { code: "day", name: "1 Hari", days: 1, price: 5000, gems: 50 },
  { code: "week", name: "1 Minggu", days: 7, price: 20000, gems: 200 },
  { code: "month", name: "1 Bulan", days: 30, price: 30000, gems: 500 },
  { code: "year", name: "1 Tahun", days: 365, price: 50000, gems: 900 },
];

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function getUserBalanceId(admin: any, visitorId: string): Promise<string | null> {
  const { data } = await admin
    .from("balance_login_history")
    .select("user_balance_id")
    .eq("visitor_id", visitorId)
    .order("logged_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data?.user_balance_id) return data.user_balance_id;
  const { data: ub } = await admin.from("user_balances").select("id").eq("visitor_id", visitorId).maybeSingle();
  return ub?.id ?? null;
}


async function verifyPin(admin: any, visitorId: string, ubId: string | null, pin: string) {
  if (!/^\d{6}$/.test(pin)) return "PIN harus 6 digit";
  const ids = new Set<string>([visitorId]);
  if (ubId) {
    const { data: ub } = await admin.from("user_balances").select("visitor_id").eq("id", ubId).maybeSingle();
    if (ub?.visitor_id) ids.add(ub.visitor_id);
    const { data: hist } = await admin
      .from("balance_login_history").select("visitor_id").eq("user_balance_id", ubId)
      .order("logged_in_at", { ascending: false }).limit(50);
    for (const h of hist || []) if (h?.visitor_id) ids.add(h.visitor_id);
  }
  const { data: pins } = await admin.from("user_pins").select("pin_hash").in("visitor_id", Array.from(ids));
  if (!pins || pins.length === 0) return "PIN belum dibuat. Buat PIN dulu di menu Profil.";
  const hash = await sha256(pin);
  if (!pins.some((p: any) => p.pin_hash === hash)) return "PIN salah";
  return null;
}

async function linkedVisitorIds(admin: any, visitorId: string, ubId: string | null) {
  const ids = new Set<string>([visitorId]);
  if (ubId) {
    const { data: ub } = await admin.from("user_balances").select("visitor_id").eq("id", ubId).maybeSingle();
    if (ub?.visitor_id) ids.add(ub.visitor_id);
    const { data: hist } = await admin
      .from("balance_login_history").select("visitor_id").eq("user_balance_id", ubId)
      .order("logged_in_at", { ascending: false }).limit(50);
    for (const h of hist || []) if (h?.visitor_id) ids.add(h.visitor_id);
  }
  return Array.from(ids);
}

// Kumpulkan semua profil gem yang terhubung ke akun/visitor ini
async function getGemRows(admin: any, visitorId: string, ubId: string | null) {
  const rows = new Map<string, { id: string; gems: number; visitor_id: string | null }>();
  if (ubId) {
    const { data } = await admin.from("game_profiles").select("id, gems, visitor_id").eq("user_balance_id", ubId);
    for (const r of data || []) rows.set(r.id, r);
  }
  const ids = await linkedVisitorIds(admin, visitorId, ubId);
  const { data: byVisitor } = await admin.from("game_profiles").select("id, gems, visitor_id").in("visitor_id", ids);
  for (const r of byVisitor || []) rows.set(r.id, r);
  const list = Array.from(rows.values()).sort((a, b) => Number(b.gems || 0) - Number(a.gems || 0));
  const total = list.reduce((s, r) => s + Number(r.gems || 0), 0);
  return { list, total };
}

async function totalGems(admin: any, visitorId: string, ubId: string | null) {
  const { data: gemRpc } = await admin.rpc("get_account_gems", { p_visitor_id: visitorId });
  const { total } = await getGemRows(admin, visitorId, ubId);
  return Math.max(Number(gemRpc || 0), total);
}


async function loadStatus(admin: any, visitorIds: string[], ubId: string | null) {
  const ids = Array.from(new Set(visitorIds.filter(Boolean)));
  let q = admin.from("anon_premium_subscriptions").select("*").eq("is_active", true)
    .order("expires_at", { ascending: false }).limit(20);
  const ors = ids.map((v) => `visitor_id.eq.${v}`);
  if (ubId) ors.push(`user_balance_id.eq.${ubId}`);
  q = q.or(ors.join(","));
  const { data } = await q;
  const now = Date.now();
  const active = (data || []).find((s: any) => new Date(s.expires_at).getTime() > now) || null;
  return { active, history: data || [] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "status");
    const visitorId = String(body.visitorId || body.visitor_id || "").trim();
    if (!visitorId) return Response.json({ error: "Visitor tidak dikenal" }, { status: 400, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Anon Chat memakai visitor id sendiri (agung_visitor_id) yang tidak terhubung ke akun saldo.
    // Klien mengirim billingVisitorId (visitor id akun saldo) supaya saldo & gem terbaca benar.
    const billingVisitorId = String(body.billingVisitorId || "").trim() || visitorId;
    let ubId = await getUserBalanceId(admin, billingVisitorId);
    if (!ubId && billingVisitorId !== visitorId) ubId = await getUserBalanceId(admin, visitorId);

    if (action === "status") {
      const { active, history } = await loadStatus(admin, [visitorId, billingVisitorId], ubId);
      let balance = 0, gems = 0;
      if (ubId) {
        const { data } = await admin.from("user_balances").select("balance").eq("id", ubId).maybeSingle();
        balance = Number(data?.balance || 0);
      }
      gems = await totalGems(admin, billingVisitorId, ubId);


      return Response.json({
        is_premium: !!active,
        plan_name: active?.plan_name || null,
        expires_at: active?.expires_at || null,
        plans: PLANS,
        balance, gems,
        has_account: !!ubId,
        history,
      }, { headers: corsHeaders });
    }

    // ===== Cari user Anon Chat (untuk gift / cek status premium) =====
    if (action === "lookup") {
      const q = String(body.query || "").trim();
      if (q.length < 2) return Response.json({ error: "Masukkan minimal 2 karakter" }, { status: 400, headers: corsHeaders });
      const found: any[] = [];
      const { data: profs } = await admin.from("anon_chat_profiles")
        .select("visitor_id, nickname").ilike("nickname", `%${q}%`).limit(10);
      for (const p of profs || []) found.push({ visitor_id: p.visitor_id, name: p.nickname || "Anonim" });
      const { data: accs } = await admin.from("anon_chat_accounts")
        .select("primary_visitor_id, email").ilike("email", `%${q}%`).limit(10);
      for (const a of accs || []) {
        if (!a.primary_visitor_id) continue;
        if (found.some((f) => f.visitor_id === a.primary_visitor_id)) continue;
        found.push({ visitor_id: a.primary_visitor_id, name: a.email });
      }
      if (!found.length) return Response.json({ results: [], message: "Akun tidak ditemukan" }, { headers: corsHeaders });
      const ids = found.map((f) => f.visitor_id);
      const { data: subs } = await admin.from("anon_premium_subscriptions")
        .select("visitor_id, plan_name, expires_at, created_at").in("visitor_id", ids)
        .eq("is_active", true).gt("expires_at", new Date().toISOString());
      const results = found.map((f) => {
        const s = (subs || []).find((x: any) => x.visitor_id === f.visitor_id);
        const daysLeft = s ? Math.max(0, Math.ceil((new Date(s.expires_at).getTime() - Date.now()) / 86400000)) : 0;
        return { ...f, is_premium: !!s, plan_name: s?.plan_name || null, started_at: s?.created_at || null, expires_at: s?.expires_at || null, days_left: daysLeft };
      });
      return Response.json({ results }, { headers: corsHeaders });
    }

    // ===== Redeem kode voucher premium Anon Chat =====
    if (action === "redeem_voucher") {
      const code = String(body.code || "").trim().toUpperCase();
      if (!code) return Response.json({ error: "Kode voucher kosong" }, { status: 400, headers: corsHeaders });
      const { data: v } = await admin.from("anon_premium_vouchers").select("*").eq("code", code).maybeSingle();
      if (!v || !v.is_active) return Response.json({ error: "Kode voucher tidak ditemukan" }, { status: 400, headers: corsHeaders });
      if (v.expires_at && new Date(v.expires_at).getTime() < Date.now()) {
        return Response.json({ error: "Kode voucher sudah kedaluwarsa" }, { status: 400, headers: corsHeaders });
      }
      if (v.used_count >= v.max_uses) return Response.json({ error: "Kuota voucher sudah habis" }, { status: 400, headers: corsHeaders });

      const { error: redErr } = await admin.from("anon_premium_voucher_redemptions").insert({
        voucher_id: v.id, code, visitor_id: visitorId, days: v.days,
      });
      if (redErr) return Response.json({ error: "Kamu sudah pernah memakai kode ini" }, { status: 400, headers: corsHeaders });

      const { active: cur } = await loadStatus(admin, [visitorId, billingVisitorId], ubId);
      const base = cur ? new Date(cur.expires_at) : new Date();
      const exp = new Date(base.getTime() + v.days * 86400000);
      const trx = `ANONV-${Date.now()}-${code}`;
      await admin.from("anon_premium_subscriptions").insert({
        visitor_id: visitorId, user_balance_id: ubId, plan_code: "voucher", plan_name: `Voucher ${v.days} Hari`,
        method: "voucher", price: 0, gems: 0, trx_id: trx, expires_at: exp.toISOString(),
      });
      await admin.from("anon_premium_vouchers").update({ used_count: v.used_count + 1 }).eq("id", v.id);
      return Response.json({ ok: true, days: v.days, expires_at: exp.toISOString(), trx_id: trx }, { headers: corsHeaders });
    }

    // ===== Gift premium ke user lain =====
    if (action === "gift") {
      const targetVisitor = String(body.targetVisitorId || "").trim();
      const planCodeG = String(body.plan || "");
      const methodG = String(body.method || "saldo");
      const planG = PLANS.find((p) => p.code === planCodeG);
      if (!targetVisitor) return Response.json({ error: "Penerima tidak dipilih" }, { status: 400, headers: corsHeaders });
      if (!planG) return Response.json({ error: "Paket tidak valid" }, { status: 400, headers: corsHeaders });
      if (targetVisitor === visitorId) return Response.json({ error: "Tidak bisa gift ke diri sendiri" }, { status: 400, headers: corsHeaders });

      const { data: exists } = await admin.from("anon_chat_profiles").select("visitor_id, nickname").eq("visitor_id", targetVisitor).maybeSingle();
      if (!exists) return Response.json({ error: "Akun penerima tidak ditemukan atau sudah dihapus" }, { status: 400, headers: corsHeaders });

      const trxG = `ANONG-${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`;
      if (methodG === "gem") {
        if (planG.gems == null) return Response.json({ error: "Paket ini tidak bisa dibayar dengan Gem" }, { status: 400, headers: corsHeaders });
        const { data: gemRpc } = await admin.rpc("get_account_gems", { p_visitor_id: billingVisitorId });
        if (Number(gemRpc || 0) < planG.gems) {
          return Response.json({ error: `Gem kurang. Kamu punya ${Number(gemRpc || 0)}, butuh ${planG.gems} Gem` }, { status: 400, headers: corsHeaders });
        }
        const { error: gErr } = await admin.rpc("add_account_gems", { p_visitor_id: billingVisitorId, p_amount: -planG.gems });
        if (gErr) return Response.json({ error: "Gagal memotong gem" }, { status: 400, headers: corsHeaders });
      } else {
        if (!ubId) return Response.json({ error: "Login akun saldo dulu untuk bayar pakai saldo" }, { status: 400, headers: corsHeaders });
        const pErr = await verifyPin(admin, billingVisitorId, ubId, String(body.pin || ""));
        if (pErr) return Response.json({ error: pErr, needPin: true }, { status: 403, headers: corsHeaders });
        const { data: bal } = await admin.from("user_balances").select("id, balance").eq("id", ubId).maybeSingle();
        if (!bal || Number(bal.balance) < planG.price) {
          return Response.json({ error: `Saldo kurang. Butuh Rp ${planG.price.toLocaleString("id-ID")}` }, { status: 400, headers: corsHeaders });
        }
        await admin.from("user_balances").update({ balance: Number(bal.balance) - planG.price, updated_at: new Date().toISOString() }).eq("id", bal.id);
        await admin.from("balance_transactions").insert({
          visitor_id: billingVisitorId, type: "purchase", amount: planG.price,
          description: `Gift Anon Premium ${planG.name} → ${exists.nickname || "Anonim"}`, trx_id: trxG,
        });
      }

      const { active: tActive } = await loadStatus(admin, [targetVisitor], null);
      const tBase = tActive ? new Date(tActive.expires_at) : new Date();
      const tExp = new Date(tBase.getTime() + planG.days * 86400000);
      await admin.from("anon_premium_subscriptions").insert({
        visitor_id: targetVisitor, plan_code: planG.code, plan_name: `${planG.name} (Gift)`,
        method: methodG === "gem" ? "gem" : "saldo", price: methodG === "gem" ? 0 : planG.price,
        gems: methodG === "gem" ? planG.gems : 0, trx_id: trxG, expires_at: tExp.toISOString(),
      });

      return Response.json({
        ok: true, trx_id: trxG, target_name: exists.nickname || "Anonim",
        plan_name: planG.name, days: planG.days, expires_at: tExp.toISOString(),
        price: methodG === "gem" ? planG.gems : planG.price, method: methodG,
      }, { headers: corsHeaders });
    }

    if (action !== "buy") return Response.json({ error: "Aksi tidak dikenal" }, { status: 400, headers: corsHeaders });

    const planCode = String(body.plan || "");
    const method = String(body.method || "saldo");
    const plan = PLANS.find((p) => p.code === planCode);
    if (!plan) return Response.json({ error: "Paket tidak valid" }, { status: 400, headers: corsHeaders });

    if (method !== "saldo" && method !== "gem") {
      return Response.json({ error: "Metode pembayaran hanya Saldo atau Gem" }, { status: 400, headers: corsHeaders });
    }


    const { active } = await loadStatus(admin, [visitorId, billingVisitorId], ubId);
    const base = active ? new Date(active.expires_at) : new Date();
    const expires = new Date(base.getTime() + plan.days * 86400000);
    const trxId = `ANONP-${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`;

    if (method === "gem") {
      if (plan.gems == null) return Response.json({ error: "Paket ini tidak bisa dibayar dengan Gem" }, { status: 400, headers: corsHeaders });
      const { list, total } = await getGemRows(admin, billingVisitorId, ubId);
      const { data: gemRpc } = await admin.rpc("get_account_gems", { p_visitor_id: billingVisitorId });
      const myGems = Math.max(Number(gemRpc || 0), total);
      if (myGems < plan.gems) return Response.json({ error: `Gem kurang. Kamu punya ${myGems}, butuh ${plan.gems} Gem` }, { status: 400, headers: corsHeaders });

      // Potong gem langsung dari profil terhubung (terbanyak dulu)
      const taken: { id: string; amount: number }[] = [];
      let need = plan.gems;
      for (const row of list) {
        if (need <= 0) break;
        const have = Number(row.gems || 0);
        if (have <= 0) continue;
        const take = Math.min(have, need);
        const { error } = await admin.from("game_profiles").update({ gems: have - take }).eq("id", row.id);
        if (error) break;
        taken.push({ id: row.id, amount: take });
        need -= take;
      }
      const rollback = async () => {
        for (const t of taken) {
          const { data: cur } = await admin.from("game_profiles").select("gems").eq("id", t.id).maybeSingle();
          await admin.from("game_profiles").update({ gems: Number(cur?.gems || 0) + t.amount }).eq("id", t.id);
        }
      };
      if (need > 0) {
        await rollback();
        return Response.json({ error: "Gagal memotong gem" }, { status: 400, headers: corsHeaders });
      }

      const { error: insErr } = await admin.from("anon_premium_subscriptions").insert({
        visitor_id: visitorId, user_balance_id: ubId, plan_code: plan.code, plan_name: plan.name,
        method: "gem", price: 0, gems: plan.gems, trx_id: trxId, expires_at: expires.toISOString(),
      });
      if (insErr) {
        await rollback();
        return Response.json({ error: "Gagal menyimpan langganan" }, { status: 500, headers: corsHeaders });
      }
      return Response.json({ ok: true, expires_at: expires.toISOString(), trx_id: trxId }, { headers: corsHeaders });

    }

    // saldo
    if (!ubId) return Response.json({ error: "Login akun saldo dulu untuk bayar pakai saldo" }, { status: 400, headers: corsHeaders });
    const pinErr = await verifyPin(admin, billingVisitorId, ubId, String(body.pin || ""));
    if (pinErr) return Response.json({ error: pinErr, needPin: true }, { status: 403, headers: corsHeaders });

    const { data: bal } = await admin.from("user_balances").select("id, balance").eq("id", ubId).maybeSingle();
    if (!bal) return Response.json({ error: "Saldo tidak ditemukan" }, { status: 400, headers: corsHeaders });
    if (Number(bal.balance) < plan.price) {
      return Response.json({ error: `Saldo kurang. Butuh Rp ${plan.price.toLocaleString("id-ID")}` }, { status: 400, headers: corsHeaders });
    }

    const { error: updErr } = await admin.from("user_balances")
      .update({ balance: Number(bal.balance) - plan.price, updated_at: new Date().toISOString() }).eq("id", bal.id);
    if (updErr) return Response.json({ error: "Gagal memotong saldo" }, { status: 500, headers: corsHeaders });

    const { error: insErr } = await admin.from("anon_premium_subscriptions").insert({
      visitor_id: visitorId, user_balance_id: ubId, plan_code: plan.code, plan_name: plan.name,
      method: "saldo", price: plan.price, gems: 0, trx_id: trxId, expires_at: expires.toISOString(),
    });
    if (insErr) {
      await admin.from("user_balances").update({ balance: Number(bal.balance) }).eq("id", bal.id);
      return Response.json({ error: "Gagal menyimpan langganan" }, { status: 500, headers: corsHeaders });
    }

    await admin.from("balance_transactions").insert({
      visitor_id: billingVisitorId, type: "purchase", amount: plan.price,
      description: `Anon Premium ${plan.name}`, trx_id: trxId,
    });

    return Response.json({ ok: true, expires_at: expires.toISOString(), trx_id: trxId }, { headers: corsHeaders });
  } catch (e) {
    return Response.json({ error: String((e as any)?.message || e) }, { status: 500, headers: corsHeaders });
  }
});
