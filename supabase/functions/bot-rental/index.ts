// Sewa Bot Telegram. All prices, voucher rules, expiry and slot counts are decided in DB RPCs
// (bot_rental_purchase / bot_rental_quote / bot_rental_admin_extend / bot_rental_tick).
// Bot tokens are write-only: never returned, never logged.
// Runtime: no isolated bot hosting runtime is connected yet, so START never fakes ACTIVE.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { resolveWalletIdentity } from "../_shared/wallet-identity.ts";
import { verifyAccountPin } from "../_shared/pin.ts";
import { isAdminRequest } from "../_shared/admin.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: cors });
const TOKEN_RE = /^\d{6,12}:[A-Za-z0-9_-]{30,60}$/;
const MAX_FILE = 5 * 1024 * 1024;
const RUNTIME_AVAILABLE = false; // flip only when a real sandboxed runtime is wired in
const RUNTIME_MSG = "Server runtime bot belum tersedia. File & konfigurasi tersimpan aman, bot belum bisa dijalankan.";

const BOT_COLS = "id, rental_id, name, telegram_username, owner_telegram_id, status, runtime, current_version, total_users, total_messages, total_commands, last_activity_at, started_at, created_at, updated_at, bot_token";
// deno-lint-ignore no-explicit-any
const safeBot = (b: any) => { const { bot_token, ...rest } = b; return { ...rest, has_token: !!bot_token }; };

// deno-lint-ignore no-explicit-any
async function getAdminUid(req: Request, db: any) {
  const t = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data } = await db.auth.getUser(t);
  return data?.user?.id as string;
}

function decodeFile(b64: string): Uint8Array | null {
  try { const bin = atob(b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "catalog") {
      const [{ data: plans }, { data: st }] = await Promise.all([
        db.from("bot_rental_plans").select("code,name,duration_label,duration_seconds,price,popular,sort_order").eq("active", true).order("sort_order"),
        db.from("bot_rental_settings").select("slot_price").eq("id", 1).maybeSingle(),
      ]);
      return json({ plans: plans ?? [], slot_price: Number(st?.slot_price ?? 0), runtime_available: RUNTIME_AVAILABLE });
    }

    // ---------------- ADMIN ----------------
    if (action.startsWith("admin_")) {
      if (!(await isAdminRequest(req, db))) return json({ error: "Forbidden — admin only" }, 403);
      const adminId = await getAdminUid(req, db);
      await db.rpc("bot_rental_tick");
      const audit = (a: string, extra: Record<string, unknown> = {}) => db.from("bot_audit_logs").insert({ admin_id: adminId, action: a, ...extra });

      if (action === "admin_overview") {
        const [{ data: rentals }, { data: bots }, { data: txs }, { data: vouchers }, { data: plans }, { data: st }, { data: auditRows }] = await Promise.all([
          db.from("bot_rentals").select("*, user_balances(username, phone)").order("created_at", { ascending: false }).limit(300),
          db.from("bot_instances").select(BOT_COLS + ", user_balance_id").is("deleted_at", null).limit(500),
          db.from("bot_transactions").select("transaction_id, kind, amount, discount, status, duration_label, slots_added, created_at, visitor_id, rental_id, note").order("created_at", { ascending: false }).limit(200),
          db.from("bot_vouchers").select("*").order("created_at", { ascending: false }),
          db.from("bot_rental_plans").select("*").order("sort_order"),
          db.from("bot_rental_settings").select("slot_price").eq("id", 1).maybeSingle(),
          db.from("bot_audit_logs").select("*").order("created_at", { ascending: false }).limit(50),
        ]);
        const { data: rev } = await db.from("bot_transactions").select("amount").eq("status", "SUCCESS");
        const revenue = (rev ?? []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
        return json({ rentals, bots: (bots ?? []).map(safeBot), transactions: txs, vouchers, plans, slot_price: Number(st?.slot_price ?? 0), audit: auditRows, revenue });
      }
      if (action === "admin_extend") {
        const { data, error } = await db.rpc("bot_rental_admin_extend", { p_admin: adminId, p_rental: body.rentalId, p_seconds: Number(body.seconds), p_reason: String(body.reason || "") });
        if (error) return json({ error: "Gagal memperpanjang" }, 500);
        return json(data, data?.error ? 400 : 200);
      }
      if (action === "admin_freeze") {
        const { data: r } = await db.from("bot_rentals").select("id, expires_at").eq("id", body.rentalId).maybeSingle();
        if (!r) return json({ error: "Rental tidak ditemukan" }, 404);
        await db.from("bot_rentals").update({ status: "FROZEN", updated_at: new Date().toISOString() }).eq("id", r.id);
        await db.from("bot_instances").update({ status: "FROZEN" }).eq("rental_id", r.id).is("deleted_at", null);
        await audit("freeze", { rental_id: r.id, reason: String(body.reason || "") });
        return json({ success: true });
      }
      if (action === "admin_unfreeze") {
        const { data: r } = await db.from("bot_rentals").select("id, expires_at").eq("id", body.rentalId).maybeSingle();
        if (!r) return json({ error: "Rental tidak ditemukan" }, 404);
        if (new Date(r.expires_at) <= new Date()) return json({ error: "Masa sewa sudah habis — gunakan Tambah Masa Sewa." }, 400);
        await db.from("bot_rentals").update({ status: "ACTIVE" }).eq("id", r.id);
        await db.from("bot_instances").update({ status: "STOPPED" }).eq("rental_id", r.id).eq("status", "FROZEN");
        await audit("unfreeze", { rental_id: r.id, reason: String(body.reason || "") });
        return json({ success: true });
      }
      if (action === "admin_stop_bot") {
        await db.from("bot_instances").update({ status: "STOPPED" }).eq("id", body.botId).not("status", "in", "(DELETED,FROZEN)");
        await audit("stop_bot", { bot_id: body.botId });
        return json({ success: true });
      }
      if (action === "admin_logs") {
        const { data } = await db.from("bot_runtime_logs").select("level, message, created_at").eq("bot_id", body.botId).order("created_at", { ascending: false }).limit(100);
        return json({ logs: data ?? [] });
      }
      if (action === "admin_update_plan") {
        const price = Math.floor(Number(body.price));
        if (!Number.isFinite(price) || price < 0 || price > 100000000) return json({ error: "Harga tidak valid" }, 400);
        const { data: old } = await db.from("bot_rental_plans").select("price, active").eq("code", body.code).maybeSingle();
        if (!old) return json({ error: "Paket tidak ditemukan" }, 404);
        await db.from("bot_rental_plans").update({ price, active: body.active !== false, updated_at: new Date().toISOString() }).eq("code", body.code);
        await audit("update_plan", { detail: { code: body.code, old, price, active: body.active !== false } });
        return json({ success: true });
      }
      if (action === "admin_slot_price") {
        const price = Math.floor(Number(body.price));
        if (!Number.isFinite(price) || price < 0) return json({ error: "Harga tidak valid" }, 400);
        await db.from("bot_rental_settings").update({ slot_price: price, updated_at: new Date().toISOString() }).eq("id", 1);
        await audit("slot_price", { detail: { price } });
        return json({ success: true });
      }
      if (action === "admin_save_voucher") {
        const v = body.voucher || {};
        const code = String(v.code || "").trim().toUpperCase();
        if (!/^[A-Z0-9_-]{3,30}$/.test(code)) return json({ error: "Kode voucher 3-30 huruf/angka" }, 400);
        if (!["percent", "fixed"].includes(v.discount_type)) return json({ error: "Tipe diskon tidak valid" }, 400);
        const val = Math.floor(Number(v.discount_value));
        if (!(val > 0) || (v.discount_type === "percent" && val > 100)) return json({ error: "Nilai diskon tidak valid" }, 400);
        const row = {
          code, discount_type: v.discount_type, discount_value: val,
          applies_to: ["all", "plan", "slot"].includes(v.applies_to) ? v.applies_to : "all",
          min_purchase: Math.max(0, Math.floor(Number(v.min_purchase) || 0)),
          max_uses: v.max_uses ? Math.max(1, Math.floor(Number(v.max_uses))) : null,
          starts_at: v.starts_at || null, ends_at: v.ends_at || null, active: v.active !== false, updated_at: new Date().toISOString(),
        };
        const q = v.id ? db.from("bot_vouchers").update(row).eq("id", v.id) : db.from("bot_vouchers").insert({ ...row, created_by: adminId });
        const { error } = await q;
        if (error) return json({ error: error.code === "23505" ? "Kode voucher sudah ada" : "Gagal menyimpan voucher" }, 400);
        await audit(v.id ? "edit_voucher" : "create_voucher", { detail: row });
        return json({ success: true });
      }
      if (action === "admin_voucher_usage") {
        const { data } = await db.from("bot_voucher_redemptions").select("transaction_id, discount, created_at, user_balances(username)").eq("voucher_id", body.voucherId).order("created_at", { ascending: false });
        return json({ usage: data ?? [] });
      }
      return json({ error: "Aksi admin tidak dikenal" }, 400);
    }

    // ---------------- USER ----------------
    const who = await resolveWalletIdentity(req, db, body.visitorId);
    if (!who.ok) return json({ error: who.error, code: who.code }, who.status);
    const wallet = who.walletId;
    await db.rpc("bot_rental_tick"); // expire on demand too, not only via cron

    const { data: rental } = await db.from("bot_rentals").select("*, bot_rental_plans(duration_label)").eq("user_balance_id", wallet).maybeSingle();
    const ownBot = async (id: unknown) => {
      if (typeof id !== "string") return null;
      const { data } = await db.from("bot_instances").select(BOT_COLS).eq("id", id).eq("user_balance_id", wallet).is("deleted_at", null).maybeSingle();
      return data;
    };
    const rentalActive = !!rental && rental.status === "ACTIVE" && new Date(rental.expires_at) > new Date();
    const log = (botId: string, message: string, level = "info") => db.from("bot_runtime_logs").insert({ bot_id: botId, level, message });

    if (action === "status") {
      const [{ data: bots }, { data: txs }, { data: ub }] = await Promise.all([
        db.from("bot_instances").select(BOT_COLS).eq("user_balance_id", wallet).is("deleted_at", null).order("created_at"),
        db.from("bot_transactions").select("transaction_id, kind, duration_label, slots_added, base_amount, discount, amount, previous_expires_at, new_expires_at, payment_source, balance_before, balance_after, status, created_at").eq("user_balance_id", wallet).order("created_at", { ascending: false }).limit(50),
        db.from("user_balances").select("balance").eq("id", wallet).maybeSingle(),
      ]);
      return json({ rental, active: rentalActive, bots: (bots ?? []).map(safeBot), transactions: txs ?? [], balance: Number(ub?.balance ?? 0), runtime_available: RUNTIME_AVAILABLE });
    }

    if (action === "quote") {
      const { data, error } = await db.rpc("bot_rental_quote", { p_wallet: wallet, p_kind: body.kind, p_plan_code: body.planCode ?? null, p_slots: body.slots ?? null, p_voucher: body.voucher ?? null });
      if (error) return json({ error: "Gagal menghitung harga" }, 500);
      return json(data, data?.error ? 400 : 200);
    }

    if (action === "purchase") {
      if (!/^\d{6}$/.test(String(body.pin || ""))) return json({ error: "PIN 6 digit diperlukan", needPin: true }, 400);
      const pinErr = await verifyAccountPin(db, who.visitorId, body.pin);
      if (pinErr) return json({ error: pinErr, code: "PIN" }, 403);
      const { data, error } = await db.rpc("bot_rental_purchase", {
        p_wallet: wallet, p_kind: body.kind, p_plan_code: body.planCode ?? null, p_slots: body.slots ?? null,
        p_voucher: body.voucher ?? null, p_request_id: String(body.requestId || ""),
      });
      if (error) { console.error("[bot-rental] purchase rpc", error.message); return json({ error: "Gagal memproses pembayaran. Saldo tidak dipotong." }, 500); }
      return json(data, data?.error ? 400 : 200);
    }

    if (action === "create_bot") {
      if (!rental) return json({ error: "Anda belum memiliki paket sewa aktif. Silakan pilih paket sewa terlebih dahulu.", code: "no_rental" }, 400);
      if (!rentalActive) return json({ error: "Masa sewa habis. Perpanjang sewa dulu.", code: "expired" }, 400);
      const { count } = await db.from("bot_instances").select("id", { count: "exact", head: true }).eq("user_balance_id", wallet).is("deleted_at", null);
      if ((count ?? 0) >= rental.slots) return json({ error: `Slot bot penuh (${rental.slots}). Tambah slot dulu.`, code: "slots_full" }, 400);
      const name = String(body.name || "").trim().slice(0, 60);
      if (!name) return json({ error: "Nama bot wajib diisi" }, 400);
      const token = String(body.token || "").trim();
      if (!TOKEN_RE.test(token)) return json({ error: "Format Bot Token tidak valid" }, 400);
      const ownerId = String(body.ownerTelegramId || "").trim();
      if (ownerId && !/^-?\d{3,20}$/.test(ownerId)) return json({ error: "Owner Telegram ID harus angka" }, 400);
      let username: string | null = null;
      try {
        const r = await fetch(`https://api.telegram.org/bot${token}/getMe`);
        const j = await r.json();
        if (!j.ok) return json({ error: "Bot Token ditolak Telegram. Periksa token dari @BotFather." }, 400);
        username = j.result?.username ?? null;
      } catch { return json({ error: "Tidak dapat menghubungi Telegram untuk memverifikasi token. Coba lagi." }, 502); }
      const { data: bot, error } = await db.from("bot_instances").insert({
        rental_id: rental.id, user_balance_id: wallet, name, telegram_username: username, owner_telegram_id: ownerId || null, bot_token: token, status: "STOPPED",
      }).select(BOT_COLS).single();
      if (error) return json({ error: "Gagal membuat bot" }, 500);
      await log(bot.id, `Bot dibuat (@${username ?? "-"}). Token diverifikasi Telegram.`);
      return json({ success: true, bot: safeBot(bot) });
    }

    if (action === "update_bot") {
      const bot = await ownBot(body.botId);
      if (!bot) return json({ error: "Bot tidak ditemukan" }, 404);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.name !== undefined) { const n = String(body.name).trim().slice(0, 60); if (!n) return json({ error: "Nama bot wajib diisi" }, 400); patch.name = n; }
      if (body.ownerTelegramId !== undefined) { const o = String(body.ownerTelegramId).trim(); if (o && !/^-?\d{3,20}$/.test(o)) return json({ error: "Owner Telegram ID harus angka" }, 400); patch.owner_telegram_id = o || null; }
      if (body.token) {
        const t = String(body.token).trim();
        if (!TOKEN_RE.test(t)) return json({ error: "Format Bot Token tidak valid" }, 400);
        const j = await fetch(`https://api.telegram.org/bot${t}/getMe`).then((r) => r.json()).catch(() => null);
        if (!j?.ok) return json({ error: "Bot Token ditolak Telegram" }, 400);
        patch.bot_token = t; patch.telegram_username = j.result?.username ?? null;
      }
      await db.from("bot_instances").update(patch).eq("id", bot.id);
      await log(bot.id, "Konfigurasi bot diperbarui" + (body.token ? " (token diganti)" : ""));
      return json({ success: true });
    }

    if (action === "upload_version") {
      const bot = await ownBot(body.botId);
      if (!bot) return json({ error: "Bot tidak ditemukan" }, 404);
      const fileName = String(body.fileName || "").replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
      if (!/\.(zip|js|mjs|cjs)$/i.test(fileName)) return json({ error: "Hanya file .zip atau .js yang didukung" }, 400);
      const bytes = decodeFile(String(body.base64 || ""));
      if (!bytes || bytes.length === 0) return json({ error: "File kosong/tidak valid" }, 400);
      if (bytes.length > MAX_FILE) return json({ error: "Ukuran file maksimal 5 MB" }, 400);
      const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
      if (/\.zip$/i.test(fileName) && !isZip) return json({ error: "File .zip rusak / bukan ZIP" }, 400);
      if (!/\.zip$/i.test(fileName)) {
        // JS must be plain UTF-8 text, no binary/executable headers (ELF/PE/Mach-O).
        if ((bytes[0] === 0x7f && bytes[1] === 0x45) || (bytes[0] === 0x4d && bytes[1] === 0x5a) || bytes.slice(0, 4096).includes(0)) return json({ error: "File berisi data biner, ditolak" }, 400);
      }
      const { data: last } = await db.from("bot_versions").select("version").eq("bot_id", bot.id).order("version", { ascending: false }).limit(1).maybeSingle();
      const version = (last?.version ?? 0) + 1;
      const path = `${wallet}/${bot.id}/v${version}-${fileName}`;
      const up = await db.storage.from("bot-files").upload(path, bytes, { contentType: "application/octet-stream", upsert: false });
      if (up.error) return json({ error: "Gagal menyimpan file" }, 500);
      const { error } = await db.from("bot_versions").insert({ bot_id: bot.id, version, storage_path: path, file_name: fileName, file_size: bytes.length, status: "STORED", deployment_status: RUNTIME_AVAILABLE ? "PENDING" : "RUNTIME_UNAVAILABLE" });
      if (error) return json({ error: "Gagal mencatat versi" }, 500);
      // Previous deployed version is left untouched (rollback-safe): current_version only moves on successful deploy.
      if (bot.current_version == null) await db.from("bot_instances").update({ current_version: version }).eq("id", bot.id);
      await log(bot.id, `File v${version} diunggah (${fileName}, ${bytes.length} byte). ${RUNTIME_AVAILABLE ? "" : "Belum dideploy: runtime belum tersedia."}`);
      return json({ success: true, version, deployed: false, message: RUNTIME_AVAILABLE ? undefined : RUNTIME_MSG });
    }

    if (action === "detail") {
      const bot = await ownBot(body.botId);
      if (!bot) return json({ error: "Bot tidak ditemukan" }, 404);
      const [{ data: versions }, { data: logs }] = await Promise.all([
        db.from("bot_versions").select("version, file_name, file_size, status, deployment_status, uploaded_at").eq("bot_id", bot.id).order("version", { ascending: false }),
        db.from("bot_runtime_logs").select("level, message, created_at").eq("bot_id", bot.id).order("created_at", { ascending: false }).limit(100),
      ]);
      return json({ bot: safeBot(bot), versions: versions ?? [], logs: logs ?? [], rental, active: rentalActive, runtime_available: RUNTIME_AVAILABLE });
    }

    if (action === "start" || action === "restart") {
      const bot = await ownBot(body.botId);
      if (!bot) return json({ error: "Bot tidak ditemukan" }, 404);
      if (!rentalActive) return json({ error: "Perpanjang sewa untuk mengaktifkan bot.", code: "expired" }, 400);
      if (!bot.current_version) return json({ error: "Upload file bot terlebih dahulu." }, 400);
      if (!RUNTIME_AVAILABLE) {
        await log(bot.id, `${action.toUpperCase()} diminta, tetapi runtime belum tersedia. Status tetap ${bot.status}.`, "warn");
        return json({ error: RUNTIME_MSG, code: "runtime_unavailable" }, 503);
      }
      return json({ error: RUNTIME_MSG }, 503);
    }

    if (action === "stop") {
      const bot = await ownBot(body.botId);
      if (!bot) return json({ error: "Bot tidak ditemukan" }, 404);
      if (bot.status === "FROZEN") return json({ error: "Bot dibekukan karena masa sewa habis." }, 400);
      await db.from("bot_instances").update({ status: "STOPPED", updated_at: new Date().toISOString() }).eq("id", bot.id);
      await log(bot.id, "Bot dihentikan oleh pemilik");
      return json({ success: true });
    }

    if (action === "delete_bot") {
      const bot = await ownBot(body.botId);
      if (!bot) return json({ error: "Bot tidak ditemukan" }, 404);
      const { data: versions } = await db.from("bot_versions").select("storage_path").eq("bot_id", bot.id);
      const paths = (versions ?? []).map((v: { storage_path: string }) => v.storage_path);
      if (paths.length) await db.storage.from("bot-files").remove(paths);
      await db.from("bot_instances").update({ status: "DELETED", deleted_at: new Date().toISOString(), bot_token: null, updated_at: new Date().toISOString() }).eq("id", bot.id);
      await log(bot.id, "Bot dihapus pemilik; file & token dihapus, riwayat transaksi tetap");
      return json({ success: true });
    }

    return json({ error: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    console.error("[bot-rental] exception", e instanceof Error ? e.message : "unknown");
    return json({ error: "Terjadi kesalahan. Coba lagi." }, 500);
  }
});
