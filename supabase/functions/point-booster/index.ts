// Booster Poin game: katalog harga, status akun, dan pembelian — semuanya ditentukan server.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { resolveWalletIdentity } from "../_shared/wallet-identity.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: cors });

const ERRORS: Record<string, string> = {
  PACKAGE_NOT_FOUND: "Paket booster tidak tersedia.",
  MEMBERSHIP_REQUIRED: "Booster ini butuh Membership aktif.",
  ALREADY_ACTIVE: "Booster dengan pengali ini masih aktif.",
  INSUFFICIENT_GEMS: "Gem kamu tidak cukup.",
  INVALID_REF: "Permintaan tidak valid, muat ulang halaman.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const body = await req.json().catch(() => ({}));
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const [{ data: tiers }, { data: durations }] = await Promise.all([
      admin.from("game_point_booster_tiers").select("*").eq("is_active", true).order("multiplier"),
      admin.from("game_point_booster_durations").select("*").eq("is_active", true).order("sort_order"),
    ]);
    // Harga dihitung di server dari tabel konfigurasi (sama dengan rumus RPC pembelian).
    const prices: Record<string, number> = {};
    for (const t of tiers || []) for (const d of durations || []) prices[`${t.multiplier}:${d.key}`] = Math.ceil(t.base_gems * Number(d.price_factor));
    const catalog = { tiers: tiers || [], durations: durations || [], prices };

    if (body.action === "catalog") return json({ ok: true, ...catalog });

    const id = await resolveWalletIdentity(req, admin, body.visitorId);
    if (!id.ok) return json({ ok: false, error: id.error, code: id.code }, id.status);

    if (body.action === "buy") {
      const multiplier = Number(body.multiplier);
      const duration = String(body.durationKey || "");
      const ref = String(body.purchaseRef || "");
      const { data, error } = await admin.rpc("buy_point_booster", {
        p_wallet_id: id.walletId, p_visitor_id: id.visitorId, p_multiplier: multiplier, p_duration: duration, p_purchase_ref: ref,
      });
      if (error) {
        const msg = error.message || "";
        const code = Object.keys(ERRORS).find((k) => msg.includes(k)) || (msg.includes("LEVEL_REQUIRED") ? "LEVEL_REQUIRED" : "FAILED");
        const lvl = msg.match(/LEVEL_REQUIRED:(\d+)/)?.[1];
        const text = code === "LEVEL_REQUIRED" ? `Butuh Game Level ${lvl}.` : ERRORS[code] || "Pembelian gagal, Gem tidak dipotong.";
        console.warn("point-booster buy rejected", code);
        return json({ ok: false, code, error: text }, 400);
      }
      if (!data?.replayed) {
        const b = data.booster;
        await admin.from("notifications").insert({
          visitor_id: id.visitorId, type: "booster",
          title: `Booster x${b.multiplier} aktif`,
          message: `Berlaku sampai ${new Date(b.expires_at).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB.`,
        }).then(() => undefined, () => undefined);
      }
    }

    // Status: Gem, level, membership, booster aktif dan riwayat — dari database.
    const nowIso = new Date().toISOString();
    const [gems, lvl, mem, active, history] = await Promise.all([
      admin.rpc("get_account_gems", { p_visitor_id: id.visitorId }),
      admin.from("game_levels").select("level").eq("visitor_id", id.visitorId).maybeSingle(),
      admin.from("streak_user_memberships").select("plan_name, expires_at").eq("visitor_id", id.visitorId).eq("is_active", true).gt("expires_at", nowIso).order("expires_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("game_point_boosters").select("id, multiplier, duration_key, duration_minutes, gem_cost, starts_at, expires_at").eq("wallet_id", id.walletId).gt("expires_at", nowIso).order("expires_at"),
      admin.from("game_point_boosters").select("id, multiplier, duration_key, duration_minutes, gem_cost, starts_at, expires_at, created_at").eq("wallet_id", id.walletId).order("created_at", { ascending: false }).limit(20),
    ]);
    return json({
      ok: true, ...catalog, serverNow: nowIso,
      gems: typeof gems.data === "number" ? gems.data : 0,
      level: lvl.data?.level ?? 1,
      membership: mem.data ?? null,
      active: active.data || [],
      history: history.data || [],
      lastPurchase: body.action === "buy" ? true : undefined,
    });
  } catch (e) {
    console.error("point-booster error", e instanceof Error ? e.message : e);
    return json({ ok: false, error: "Sistem sedang gangguan, coba lagi." }, 500);
  }
});
