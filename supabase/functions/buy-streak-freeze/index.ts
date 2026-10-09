import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { verifyAccountPin } from "../_shared/pin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: corsHeaders });
const SOURCES = ["auto", "game", "main"];

// Harga hanya dari DB (streak_freeze_price); pembayaran + freeze + transaksi atomik & idempotent di RPC buy_streak_freeze.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { action, visitorId, pin, source = "main", requestId } = await req.json();
    if (!visitorId || typeof visitorId !== "string") return json({ error: "Visitor ID diperlukan" }, 400);
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: price } = await admin.rpc("streak_freeze_price");
    const { data: ub } = await admin.from("user_balances").select("id, balance, visitor_id").eq("visitor_id", visitorId).maybeSingle();

    if (action === "quote") {
      const { data: gb } = await admin.from("game_balance").select("amount").eq("visitor_id", visitorId).maybeSingle();
      const { data: ds } = await admin.from("daily_streaks").select("freeze_count").eq("visitor_id", visitorId).maybeSingle();
      return json({ price: Number(price), main: ub ? Number(ub.balance) : null, game: Number(gb?.amount ?? 0), freeze_count: ds?.freeze_count ?? 0 });
    }

    if (!ub) return json({ error: "Akun saldo tidak ditemukan. Login/daftar saldo dulu di tab Plus → Saldo Saya." }, 404);
    if (!SOURCES.includes(source)) return json({ error: "Sumber pembayaran tidak valid" }, 400);
    if (!pin) return json({ error: "PIN diperlukan", needPin: true });
    const pinErr = await verifyAccountPin(admin, ub.visitor_id || visitorId, pin);
    if (pinErr) {
      if (pinErr.startsWith("PIN belum")) return json({ error: "PIN belum dibuat. Buat PIN di tab Plus → Saldo Saya.", needPin: true });
      return json({ error: pinErr, code: "PIN" }, 403);
    }
    const { data, error } = await admin.rpc("buy_streak_freeze", { p_visitor_id: visitorId, p_source: source, p_request_id: String(requestId || "") });
    if (error) { console.error("[buy-streak-freeze]", error.message); return json({ error: "Gagal memproses pembelian. Coba lagi." }, 500); }
    if (data?.error) return json({ error: data.error }, 400);
    return json(data);
  } catch (e) {
    console.error("[buy-streak-freeze] exception", e instanceof Error ? e.message : e);
    return json({ error: "Terjadi kesalahan. Coba lagi." }, 500);
  }
});
