import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const FREE_MAX = 5;
const PAID_MAX = 10;
const PLANS: Record<string, { price: number; days: number | null; label: string }> = {
  "1m": { price: 10000, days: 30, label: "1 Bulan" },
  "2m": { price: 20000, days: 60, label: "2 Bulan" },
  "1y": { price: 30000, days: 365, label: "1 Tahun" },
  perm: { price: 50000, days: null, label: "Permanen" },
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// deno-lint-ignore no-explicit-any
async function readStatus(admin: any, visitorId: string) {
  const { data: subs } = await admin.from("account_slot_subscriptions")
    .select("plan, price, expires_at, created_at").eq("visitor_id", visitorId)
    .order("created_at", { ascending: false }).limit(50);
  const now = Date.now();
  // deno-lint-ignore no-explicit-any
  const list = (subs || []) as any[];
  const permanent = list.some((s) => !s.expires_at);
  const latest = list.map((s) => (s.expires_at ? new Date(s.expires_at).getTime() : 0))
    .filter((t) => t > now).sort((a, b) => b - a)[0] as number | undefined;
  const active = permanent || !!latest;
  return {
    active, permanent,
    max_accounts: active ? PAID_MAX : FREE_MAX,
    expires_at: permanent ? null : latest ? new Date(latest).toISOString() : null,
    latest: latest ?? null,
    history: list.map((x) => ({ plan: String(x.plan), label: PLANS[x.plan]?.label ?? x.plan, price: Number(x.price), created_at: x.created_at, expires_at: x.expires_at ?? null })),
  };
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), visitorId: z.string().min(1).max(100) }),
  z.object({ action: z.literal("buy"), visitorId: z.string().min(1).max(100), plan: z.enum(["1m", "2m", "1y", "perm"]), pin: z.string().regex(/^\d{6}$/, "PIN harus 6 digit") }),
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ ok: false, error: parsed.error.issues[0]?.message || "Data tidak valid", active: false, permanent: false, max_accounts: FREE_MAX, expires_at: null }, 400);
    const data = parsed.data;
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const s = await readStatus(admin, data.visitorId);
    const base = { active: s.active, permanent: s.permanent, max_accounts: s.max_accounts, expires_at: s.expires_at, history: s.history };
    if (data.action === "status") return json({ ok: true, ...base });

    const fail = (error: string) => json({ ok: false, error, ...base });
    const plan = PLANS[data.plan];
    if (s.permanent) return fail("Slot kamu sudah permanen");
    const { data: pinRow } = await admin.from("user_pins").select("pin_hash").eq("visitor_id", data.visitorId).maybeSingle();
    if (!pinRow) return fail("PIN belum dibuat. Buat PIN dulu.");
    if ((await sha256(data.pin)) !== pinRow.pin_hash) return fail("PIN salah");

    const { data: bal } = await admin.from("user_balances").select("id, balance").eq("visitor_id", data.visitorId).maybeSingle();
    if (!bal) return fail("Saldo tidak ditemukan");
    if (Number(bal.balance) < plan.price) return fail(`Saldo kurang. Butuh Rp${plan.price.toLocaleString("id-ID")}`);
    const { data: upd, error: updErr } = await admin.from("user_balances")
      .update({ balance: Number(bal.balance) - plan.price }).eq("id", bal.id).eq("balance", bal.balance).select("id");
    if (updErr || !upd?.length) return fail("Gagal memotong saldo, coba lagi");

    const start = s.latest ?? Date.now();
    const expires = plan.days ? new Date(start + plan.days * 86400000).toISOString() : null;
    const trxId = `SLOT-${Date.now()}-${crypto.randomUUID().replace(/-/g, "").slice(0, 5).toUpperCase()}`;
    const { error: insErr } = await admin.from("account_slot_subscriptions").insert({
      visitor_id: data.visitorId, plan: data.plan, max_accounts: PAID_MAX, price: plan.price, trx_id: trxId, expires_at: expires,
    });
    if (insErr) {
      await admin.from("user_balances").update({ balance: bal.balance }).eq("id", bal.id);
      return fail("Gagal menyimpan paket");
    }
    await admin.from("balance_transactions").insert({
      visitor_id: data.visitorId, type: "purchase", amount: plan.price, description: `Slot Akun Tersimpan 10 (${plan.label})`,
    });
    const after = await readStatus(admin, data.visitorId);
    return json({ ok: true, active: after.active, permanent: after.permanent, max_accounts: after.max_accounts, expires_at: after.expires_at, history: after.history });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : "Terjadi kesalahan", active: false, permanent: false, max_accounts: FREE_MAX, expires_at: null }, 500);
  }
});
