// Sewa Bot Telegram. All prices, voucher rules, expiry and slot counts are decided in DB RPCs
// (bot_rental_purchase / bot_rental_quote / bot_rental_admin_extend / bot_rental_tick).
// Bot tokens are write-only: never returned, never logged.
// Runtime: no isolated bot hosting runtime is connected yet, so START never fakes ACTIVE.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { resolveWalletIdentity } from "../_shared/wallet-identity.ts";
import { verifyAccountPin } from "../_shared/pin.ts";
import { isAdminRequest } from "../_shared/admin.ts";
import { encryptToken, decryptToken, hookSecret, redact } from "../_shared/bot-crypto.ts";
import { inspectZip } from "./zip-check.ts";
import { readSources, scanSource, aiAdapt, runtimeReport, buildAdaptedZip, getRouter } from "./ai-adapt.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: cors });
const TOKEN_RE = /^\d{6,12}:[A-Za-z0-9_-]{30,60}$/;
const MAX_FILE = 5 * 1024 * 1024;
// Runtime = Telegram webhook -> bot-hook interpreting adistore-bot.json (no user code executed).
const RUNTIME_AVAILABLE = true;
const HOOK_URL = `${Deno.env.get("SUPABASE_URL")}/functions/v1/bot-hook`;
async function tg(token: string, method: string, body: Record<string, unknown> = {}) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    return { ok: !!j.ok, result: j.result, error: j.ok ? undefined : redact(String(j.description ?? `HTTP ${r.status}`)) };
  } catch { return { ok: false, result: null, error: "Tidak dapat menghubungi Telegram" }; }
}

const BOT_COLS = "id, rental_id, name, telegram_username, owner_telegram_id, status, runtime, current_version, total_users, total_messages, total_commands, last_activity_at, started_at, created_at, updated_at, bot_token, webhook_set, last_error";
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
        rental_id: rental.id, user_balance_id: wallet, name, telegram_username: username, owner_telegram_id: ownerId || null, bot_token: await encryptToken(token), status: "STOPPED",
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
        patch.bot_token = await encryptToken(t); patch.telegram_username = j.result?.username ?? null;
      }
      await db.from("bot_instances").update(patch).eq("id", bot.id);
      await log(bot.id, "Konfigurasi bot diperbarui" + (body.token ? " (token diganti)" : ""));
      return json({ success: true });
    }

    // Validate + record a version. Files are inspected in memory, never executed.
    const analyze = (fileName: string, bytes: Uint8Array) => {
      if (!/\.zip$/i.test(fileName)) {
        return { ok: true as const, spec: null, report: { compatible: false, runtime: "nodejs", dependencies: [], reasons: ["Bot tidak kompatibel dengan runtime serverless saat ini.", "File .js tunggal tidak bisa dijalankan dengan aman. Upload ZIP berisi adistore-bot.json."] } };
      }
      return inspectZip(bytes);
    };

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
      if (!/\.zip$/i.test(fileName) && ((bytes[0] === 0x7f && bytes[1] === 0x45) || (bytes[0] === 0x4d && bytes[1] === 0x5a) || bytes.slice(0, 4096).includes(0))) return json({ error: "File berisi data biner, ditolak" }, 400);
      const a = analyze(fileName, bytes);
      if (!a.ok) { await log(bot.id, `Upload ditolak: ${a.error}`, "warn"); return json({ error: a.error }, 400); }
      const { data: last } = await db.from("bot_versions").select("version").eq("bot_id", bot.id).order("version", { ascending: false }).limit(1).maybeSingle();
      const version = (last?.version ?? 0) + 1;
      const path = `${wallet}/${bot.id}/v${version}-${fileName}`;
      const up = await db.storage.from("bot-files").upload(path, bytes, { contentType: "application/octet-stream", upsert: false });
      if (up.error) return json({ error: "Gagal menyimpan file" }, 500);
      const { error } = await db.from("bot_versions").insert({
        bot_id: bot.id, version, storage_path: path, file_name: fileName, file_size: bytes.length,
        status: a.report.compatible ? "STORED" : "FAILED", deployment_status: a.report.compatible ? "READY" : "INCOMPATIBLE",
        compatible: a.report.compatible, config: a.spec, compat_report: a.report,
      });
      if (error) return json({ error: "Gagal mencatat versi" }, 500);
      // Active version only changes when the user picks it (or first compatible upload).
      if (a.report.compatible && bot.current_version == null) await db.from("bot_instances").update({ current_version: version }).eq("id", bot.id);
      await log(bot.id, `File v${version} diunggah (${fileName}, ${bytes.length} byte): ${a.report.compatible ? "KOMPATIBEL" : "TIDAK KOMPATIBEL"}`, a.report.compatible ? "info" : "warn");
      return json({ success: true, version, compatible: a.report.compatible, report: a.report });
    }

    // AI Bot Code Adapter: source -> AI -> validated adistore-bot.json as a NEW version. Original untouched.
    if (action === "ai_analyze" || action === "ai_adapt") {
      const bot = await ownBot(body.botId);
      if (!bot) return json({ error: "Bot tidak ditemukan" }, 404);
      const { data: v } = await db.from("bot_versions").select("id, version, file_name, storage_path, compat_report").eq("bot_id", bot.id).eq("version", Number(body.version)).is("deleted_at", null).maybeSingle();
      if (!v) return json({ error: "Versi tidak ditemukan" }, 404);
      if ((v.compat_report as any)?.ai_adapted) return json({ error: "Versi ini sudah hasil AI. Pilih file asli." }, 400);
      const fail = (status: number, failure: Record<string, unknown>, extra: Record<string, unknown> = {}) => json({ error: `${failure.stage}: ${failure.reason}`, failure, ...extra }, status);
      const dl = await db.storage.from("bot-files").download(v.storage_path);
      if (dl.error) return fail(500, { stage: "ANALYZING SOURCE", reason: "File versi tidak dapat dibaca dari penyimpanan", file: v.file_name, tried: ["Unduh file versi"], next: ["Upload ulang file"] });
      const src = readSources(v.file_name, new Uint8Array(await dl.data.arrayBuffer()));
      if (!src.ok) return fail(400, { stage: "ANALYZING SOURCE", reason: src.error, file: v.file_name, tried: ["Buka ZIP di memori"], next: ["Periksa ZIP tidak rusak dan tanpa path berbahaya"] });
      if (!Object.keys(src.files).length) return fail(400, { stage: "MAPPING PROJECT", reason: "Tidak ada file kode (.js/.ts) di source", file: v.file_name, tried: ["Cari .js/.mjs/.cjs/.ts/.jsx/.tsx di seluruh folder"], next: ["Upload ZIP yang berisi kode bot"] });
      const scan = scanSource(src.files, src.pkg, src.skipped);
      if (action === "ai_analyze") return json({ success: true, scan, runtime: runtimeReport() });
      if (scan.childProcess || scan.evalUse) await log(bot.id, `AI adapter: source memakai ${scan.childProcess ? "child_process " : ""}${scan.evalUse ? "eval/new Function" : ""} — bagian itu tidak dijalankan`, "warn");
      const router = await getRouter(db);
      if ("error" in router) return fail(400, { stage: "AI ADAPTATION", reason: router.error, tried: [], next: ["Admin pilih AI Router Lapak VIP di tab AI Key"] }, { scan });
      const t0 = Date.now();
      const { data: job } = await db.from("bot_ai_adapter_jobs").insert({ bot_id: bot.id, user_balance_id: wallet, source_version: v.version, model: router.model }).select("id").single();
      const a = await aiAdapt(router, src.files, scan, bot.name);
      const finish = (extra: Record<string, unknown>) => job ? db.from("bot_ai_adapter_jobs").update({ finished_at: new Date().toISOString(), latency_ms: Date.now() - t0, model: a.usage.model ?? router.model, input_tokens: a.usage.input_tokens, output_tokens: a.usage.output_tokens, total_tokens: a.usage.total_tokens, cost: a.usage.cost, ...extra }).eq("id", job.id) : null;
      if (!a.ok) {
        await finish({ status: "FAILED", error: `${a.failure.stage}: ${a.failure.reason}`.slice(0, 500) });
        await log(bot.id, `AI adapter v${v.version} gagal di ${a.failure.stage}: ${a.failure.reason}`, "warn");
        return fail(400, a.failure, { usage: a.usage, scan });
      }
      const { data: last } = await db.from("bot_versions").select("version").eq("bot_id", bot.id).order("version", { ascending: false }).limit(1).maybeSingle();
      const version = (last?.version ?? 0) + 1;
      const fileName = `${v.file_name.replace(/\.(zip|c?m?js|ts)$/i, "").slice(0, 50)}-v${v.version}-ai-adapted.zip`;
      const count = (st: string) => a.features.filter((f) => f.status === st).length;
      const handlers = { commands: Object.keys(a.spec.commands), hears: Object.keys(a.spec.hears ?? {}), callbacks: Object.keys(a.spec.callbacks ?? {}), keyboards: Object.keys(a.spec.buttons ?? {}).length, fallback: a.spec.fallback.mode };
      const scanLite = { ...scan, handlers: scan.handlers.slice(0, 200), files: scan.files.slice(0, 200) };
      const usage = { provider: "Lapak VIP AI Router", ...a.usage };
      const meta = { ai_adapted: true, source_version: v.version, source_file: v.file_name, provider: "lapak_vip_ai_router", model: a.usage.model, created_at: new Date().toISOString(), compatibility: a.compatibility, entrypoint: a.entrypoint, library: a.library, summary: a.summary, features: a.features, dependencies: a.dependencies, warnings: a.warnings, security: a.security, usage, handlers, files_sent_full: a.bundle.included, files_snippet_only: a.bundle.snippetOnly };
      const bytes = buildAdaptedZip(a.spec, meta, a.diff);
      const path = `${wallet}/${bot.id}/v${version}-${fileName}`;
      const up = await db.storage.from("bot-files").upload(path, bytes, { contentType: "application/zip", upsert: false });
      if (up.error) { await finish({ status: "FAILED", error: "CREATING VERSION: gagal menyimpan" }); return fail(500, { stage: "CREATING VERSION", reason: "Gagal menyimpan file versi AI", tried: ["Upload ke penyimpanan privat"], next: ["Coba lagi (Retry)"] }); }
      const report = { compatible: true, runtime: "webhook-spec", ai_adapted: true, source_version: v.version, source_file: v.file_name, compatibility: a.compatibility, entrypoint: a.entrypoint, library: a.library,
        dependencies: scan.dependencies, deps: a.dependencies, commands: handlers.commands, handlers, second_opinion: a.secondOpinion,
        reasons: [`Diadaptasi AI dari v${v.version}: ${handlers.commands.length} command, ${handlers.hears.length} teks, ${handlers.callbacks.length} callback · ${count("PRESERVED")} preserved, ${count("ADAPTED")} adapted, ${count("REPLACED")} replaced, ${count("UNSUPPORTED")} unsupported`],
        features: a.features, diff: a.diff, summary: a.summary, warnings: a.warnings, security: a.security, usage, files_sent_full: a.bundle.included.length, files_snippet_only: a.bundle.snippetOnly.length, scan: scanLite };
      const { error } = await db.from("bot_versions").insert({ bot_id: bot.id, version, storage_path: path, file_name: fileName, file_size: bytes.length, status: "STORED", deployment_status: "READY", compatible: true, config: a.spec, compat_report: report });
      if (error) { await finish({ status: "FAILED", error: "CREATING VERSION: gagal mencatat" }); return fail(500, { stage: "CREATING VERSION", reason: "Gagal mencatat versi AI", tried: ["Simpan catatan versi"], next: ["Coba lagi (Retry)"] }); }
      await finish({ status: "SUCCESS", result_version: version });
      await log(bot.id, `AI adapter: v${v.version} → v${version} [${a.compatibility}] ${report.reasons[0]}. Belum aktif sampai dipilih.`);
      return json({ success: true, version, report, runtime: runtimeReport() });
    }

    if (action === "download_version") {
      const bot = await ownBot(body.botId);
      if (!bot) return json({ error: "Bot tidak ditemukan" }, 404);
      const { data: v } = await db.from("bot_versions").select("storage_path, compat_report").eq("bot_id", bot.id).eq("version", Number(body.version)).is("deleted_at", null).maybeSingle();
      if (!v) return json({ error: "Versi tidak ditemukan" }, 404);
      if (!(v.compat_report as any)?.ai_adapted) return json({ error: "Hanya versi hasil AI yang bisa diunduh" }, 400);
      const s = await db.storage.from("bot-files").createSignedUrl(v.storage_path, 300);
      if (s.error) return json({ error: "Gagal membuat link unduhan" }, 500);
      return json({ url: s.data.signedUrl });
    }

    if (action === "recheck_version") {
      const bot = await ownBot(body.botId);
      if (!bot) return json({ error: "Bot tidak ditemukan" }, 404);
      const { data: v } = await db.from("bot_versions").select("id, version, file_name, storage_path").eq("bot_id", bot.id).eq("version", Number(body.version)).is("deleted_at", null).maybeSingle();
      if (!v) return json({ error: "Versi tidak ditemukan" }, 404);
      const dl = await db.storage.from("bot-files").download(v.storage_path);
      if (dl.error) return json({ error: "File versi tidak dapat dibaca" }, 500);
      const a = analyze(v.file_name, new Uint8Array(await dl.data.arrayBuffer()));
      if (!a.ok) return json({ error: a.error }, 400);
      await db.from("bot_versions").update({ compatible: a.report.compatible, config: a.spec, compat_report: a.report, status: a.report.compatible ? "STORED" : "FAILED", deployment_status: a.report.compatible ? "READY" : "INCOMPATIBLE" }).eq("id", v.id);
      await log(bot.id, `Cek ulang v${v.version}: ${a.report.compatible ? "KOMPATIBEL" : "TIDAK KOMPATIBEL"}`);
      return json({ success: true, compatible: a.report.compatible, report: a.report });
    }

    if (action === "set_active_version") {
      const bot = await ownBot(body.botId);
      if (!bot) return json({ error: "Bot tidak ditemukan" }, 404);
      const { data: v } = await db.from("bot_versions").select("version, compatible").eq("bot_id", bot.id).eq("version", Number(body.version)).is("deleted_at", null).maybeSingle();
      if (!v) return json({ error: "Versi tidak ditemukan" }, 404);
      if (!v.compatible) return json({ error: "Versi ini tidak kompatibel dengan runtime serverless, tidak bisa diaktifkan." }, 400);
      await db.from("bot_instances").update({ current_version: v.version, updated_at: new Date().toISOString() }).eq("id", bot.id);
      await log(bot.id, `Versi aktif diganti ke v${v.version}${bot.status === "ACTIVE" ? " (langsung dipakai webhook)" : ""}`);
      return json({ success: true, message: `v${v.version} jadi versi aktif` });
    }

    if (action === "delete_version") {
      const bot = await ownBot(body.botId);
      if (!bot) return json({ error: "Bot tidak ditemukan" }, 404);
      const ver = Number(body.version);
      if (ver === bot.current_version) return json({ error: "Versi aktif tidak bisa dihapus. Pilih versi lain dulu." }, 400);
      const { data: v } = await db.from("bot_versions").select("id, storage_path").eq("bot_id", bot.id).eq("version", ver).is("deleted_at", null).maybeSingle();
      if (!v) return json({ error: "Versi tidak ditemukan" }, 404);
      await db.storage.from("bot-files").remove([v.storage_path]);
      await db.from("bot_versions").update({ deleted_at: new Date().toISOString(), status: "SUPERSEDED", config: null }).eq("id", v.id);
      await log(bot.id, `Versi v${ver} dihapus`);
      return json({ success: true });
    }

    if (action === "detail") {
      const bot = await ownBot(body.botId);
      if (!bot) return json({ error: "Bot tidak ditemukan" }, 404);
      const [{ data: versions }, { data: logs }] = await Promise.all([
        db.from("bot_versions").select("version, file_name, file_size, status, deployment_status, uploaded_at, compatible, compat_report").eq("bot_id", bot.id).is("deleted_at", null).order("version", { ascending: false }),
        db.from("bot_runtime_logs").select("level, message, created_at").eq("bot_id", bot.id).order("created_at", { ascending: false }).limit(100),
      ]);
      return json({ bot: safeBot(bot), versions: versions ?? [], logs: logs ?? [], rental, active: rentalActive, runtime_available: RUNTIME_AVAILABLE });
    }

    if (action === "start" || action === "restart") {
      const bot = await ownBot(body.botId);
      if (!bot) return json({ error: "Bot tidak ditemukan" }, 404);
      if (!rentalActive) return json({ error: "Perpanjang sewa untuk mengaktifkan bot.", code: "expired" }, 400);
      if (!bot.current_version) return json({ error: "Belum ada versi kompatibel. Upload ZIP berisi adistore-bot.json." }, 400);
      const { data: v } = await db.from("bot_versions").select("compatible").eq("bot_id", bot.id).eq("version", bot.current_version).is("deleted_at", null).maybeSingle();
      if (!v?.compatible) return json({ error: "Versi aktif tidak kompatibel dengan runtime serverless saat ini." }, 400);
      let token: string | null;
      try { token = await decryptToken(bot.bot_token); } catch { token = null; }
      if (!token) return json({ error: "Token bot belum diisi. Edit bot dan masukkan token." }, 400);
      if (!String(bot.bot_token).startsWith("enc:")) await db.from("bot_instances").update({ bot_token: await encryptToken(token) }).eq("id", bot.id); // upgrade legacy plaintext
      await db.from("bot_instances").update({ status: "DEPLOYING" }).eq("id", bot.id);
      const me = await tg(token, "getMe");
      if (!me.ok) {
        await db.from("bot_instances").update({ status: "FAILED", last_error: `getMe: ${me.error}` }).eq("id", bot.id);
        await log(bot.id, `${action.toUpperCase()} gagal: token ditolak Telegram (${me.error})`, "error");
        return json({ error: `Telegram menolak token: ${me.error}` }, 400);
      }
      if (action === "restart") await tg(token, "deleteWebhook", { drop_pending_updates: false });
      const hook = `${HOOK_URL}?b=${bot.id}`;
      const set = await tg(token, "setWebhook", { url: hook, secret_token: await hookSecret(bot.id), allowed_updates: ["message", "edited_message", "callback_query"], max_connections: 5 });
      const info = await tg(token, "getWebhookInfo");
      const live = set.ok && info.ok && info.result?.url === hook;
      if (!live) {
        await db.from("bot_instances").update({ status: "FAILED", webhook_set: false, last_error: `setWebhook: ${set.error ?? "url tidak cocok"}` }).eq("id", bot.id);
        await log(bot.id, `${action.toUpperCase()} gagal: webhook tidak terpasang (${set.error ?? "url tidak cocok"})`, "error");
        return json({ error: `Gagal memasang webhook Telegram: ${set.error ?? "url tidak cocok"}` }, 502);
      }
      const now = new Date().toISOString();
      await db.from("bot_instances").update({ status: "ACTIVE", webhook_set: true, started_at: now, last_error: null, telegram_username: me.result?.username ?? bot.telegram_username, updated_at: now }).eq("id", bot.id);
      await log(bot.id, `${action.toUpperCase()} OK: @${me.result?.username} online via webhook, versi v${bot.current_version}`);
      await db.from("notifications").insert({ visitor_id: who.visitorId, title: action === "restart" ? "🔄 Bot di-restart" : "🟢 Bot aktif", message: `${bot.name} (@${me.result?.username}) online memakai v${bot.current_version}.`, type: "system", related_id: bot.id });
      return json({ success: true, message: `@${me.result?.username} online (v${bot.current_version})`, pending_updates: info.result?.pending_update_count ?? 0 });
    }

    if (action === "stop") {
      const bot = await ownBot(body.botId);
      if (!bot) return json({ error: "Bot tidak ditemukan" }, 404);
      if (bot.status === "STOPPED" && !bot.webhook_set) return json({ error: "Bot sudah berhenti." }, 400);
      const token = await decryptToken(bot.bot_token).catch(() => null);
      const del = token ? await tg(token, "deleteWebhook") : { ok: false, error: "token kosong" };
      await db.from("bot_instances").update({ status: bot.status === "FROZEN" ? "FROZEN" : "STOPPED", webhook_set: false, started_at: null, updated_at: new Date().toISOString() }).eq("id", bot.id);
      await log(bot.id, `STOP: webhook ${del.ok ? "dilepas dari Telegram" : `gagal dilepas (${del.error}); logic tetap tidak dijalankan`}`, del.ok ? "info" : "warn");
      await db.from("notifications").insert({ visitor_id: who.visitorId, title: "🔴 Bot dihentikan", message: `${bot.name} berhenti.`, type: "system", related_id: bot.id });
      return json({ success: true });
    }

    if (action === "delete_bot") {
      const bot = await ownBot(body.botId);
      if (!bot) return json({ error: "Bot tidak ditemukan" }, 404);
      const token = await decryptToken(bot.bot_token).catch(() => null);
      if (token && bot.webhook_set) await tg(token, "deleteWebhook");
      const { data: versions } = await db.from("bot_versions").select("storage_path").eq("bot_id", bot.id);
      const paths = (versions ?? []).map((v: { storage_path: string }) => v.storage_path);
      if (paths.length) await db.storage.from("bot-files").remove(paths);
      await db.from("bot_instances").update({ status: "DELETED", webhook_set: false, deleted_at: new Date().toISOString(), bot_token: null, updated_at: new Date().toISOString() }).eq("id", bot.id);
      await log(bot.id, "Bot dihapus pemilik; webhook dilepas, file & token dihapus, riwayat transaksi tetap");
      return json({ success: true });
    }

    return json({ error: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    console.error("[bot-rental] exception", e instanceof Error ? e.message : "unknown");
    return json({ error: "Terjadi kesalahan. Coba lagi." }, 500);
  }
});
