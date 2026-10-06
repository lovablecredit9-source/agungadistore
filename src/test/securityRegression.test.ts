import { describe, it, expect } from "vitest";

/**
 * Regression keamanan terhadap backend asli (kunci publik/anon).
 * Semua percobaan tulis di bawah ini HARUS ditolak. Jika salah satu lolos,
 * berarti aturan akses kembali terbuka dan orang luar bisa memberi diri sendiri saldo/hadiah.
 */
const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
const run = URL && KEY ? describe : describe.skip;

async function rest(method: string, path: string, body?: unknown) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    method,
    headers: { apikey: KEY!, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text };
}

const VID = "qa_regress_never_created";

run("security regression (anon tidak boleh menulis data uang/hadiah)", () => {
  const denied = [
    ["user_balances", { visitor_id: VID, username: VID, balance: 999999 }],
    ["streak_subscriptions", { visitor_id: VID, plan_name: "QA", plan_days: 30, expires_at: "2030-01-01" }],
    ["game_balance", { visitor_id: VID, amount: 999999 }],
    ["lucky_draw_tickets", { visitor_id: VID, ticket_count: 999 }],
    ["streak_active_boosters", { visitor_id: VID, booster_type: "x2", expires_at: "2030-01-01" }],
    ["confess_vouchers", { code: "QAREGRESS", discount_percent: 100 }],
    ["balance_login_history", { visitor_id: VID, user_balance_id: "00000000-0000-0000-0000-000000000000" }],
  ] as const;

  for (const [table, row] of denied) {
    it(`menolak insert ke ${table}`, async () => {
      const r = await rest("POST", table, row);
      expect(r.status, `${table}: ${r.text}`).toBeGreaterThanOrEqual(400);
    }, 20000);
  }

  it("riwayat login tidak terbaca publik", async () => {
    const r = await rest("GET", "balance_login_history?select=user_balance_id,ip_address&limit=1");
    expect(r.status).toBe(200);
    expect(JSON.parse(r.text)).toEqual([]);
  }, 20000);

  it("status penarikan seller tidak bisa diubah publik", async () => {
    const r = await rest("PATCH", "seller_withdrawals?status=eq.pending", { status: "paid" });
    expect(r.status === 200 ? JSON.parse(r.text) : []).toEqual([]);
  }, 20000);

  it("persetujuan deposit & koreksi saldo hanya untuk admin", async () => {
    const a = await rest("POST", "rpc/admin_approve_deposit", { p_deposit_id: "00000000-0000-0000-0000-000000000000" });
    const b = await rest("POST", "rpc/admin_adjust_balance", { p_visitor_id: VID, p_mode: "add", p_amount: 1000, p_note: "x", p_tx_type: "topup" });
    expect(a.status).toBeGreaterThanOrEqual(400);
    expect(b.status).toBeGreaterThanOrEqual(400);
  }, 20000);

  it("mutator mata uang tidak bisa dipanggil publik", async () => {
    const r = await rest("POST", "rpc/add_account_gems", { p_visitor_id: VID, p_amount: 1000 });
    expect(r.status).toBeGreaterThanOrEqual(400);
  }, 20000);
});
