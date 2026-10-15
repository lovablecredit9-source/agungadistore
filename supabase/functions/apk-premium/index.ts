// APK PREMIUM: server-side proxy to the admin-configured JereAPI provider.
// The API key is write-only (AES-GCM encrypted, never returned or logged); every response is redacted.
// Feature list comes from `_shared/apk-premium-catalog.ts` (generated from Jere-MD plugin source).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { isAdminRequest } from "../_shared/admin.ts";
import { encryptToken, decryptToken } from "../_shared/bot-crypto.ts";
import { APK_FEATURES, APK_EXCLUDED, APK_CATEGORY_LABEL, APK_DOCS_TOTAL, APK_DOCS_FEATURES, APK_DOCS_EXCLUDED, type ApkFeature } from "../_shared/apk-premium-catalog.ts";
import { validateBaseUrl, validateParams, normalizeResponse, redactSecret, checkUpload, isPrivateIp } from "../_shared/apk-premium-core.ts";
import {
  runWithRotation, classifyFailure, isRotatable, parseQuotaHeaders, parseLimitFromMessage, nextResetWib, keyView, summarize, maskKey, MAX_KEY_ATTEMPTS,
  type FailureKind, type KeyRow, type PickedKey,
} from "../_shared/apk-premium-keys.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: cors });
const PROVIDER_ID = "jereapi";
// Unique documented/source endpoints not offered, with the reason shown to users (no secrets in here).
const EXCLUDED_PUBLIC = [...new Map(APK_EXCLUDED.map((e) => [e.path, { path: e.path, reason: e.reason }])).values()];
const TIMEOUT_MS = 55_000;
const MAX_BODY = 6 * 1024 * 1024;
const RATE_PER_MIN = 10;
const RATE_PER_DAY = 150;
const BY_ID = new Map(APK_FEATURES.map((f) => [f.id, f]));

const db = () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

async function sha(s: string) {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

async function loadState(c: Db) {
  const [p, f, cat, k] = await Promise.all([
    c.from("apk_premium_provider").select("*").eq("id", PROVIDER_ID).maybeSingle(),
    c.from("apk_premium_feature_settings").select("feature_id, enabled, hidden"),
    c.from("apk_premium_category_settings").select("category, hidden"),
    c.from("apk_premium_keys").select("id, enabled, status, exhausted_until").eq("provider_id", PROVIDER_ID),
  ]);
  const now = Date.now();
  // deno-lint-ignore no-explicit-any
  const keyRows = (k.data ?? []) as any[];
  const isExh = (r: { exhausted_until: string | null }) => !!r.exhausted_until && Date.parse(r.exhausted_until) > now;
  const keys = {
    total: keyRows.length,
    enabled: keyRows.filter((r) => r.enabled).length,
    usable: keyRows.filter((r) => r.enabled && r.status !== "invalid" && !isExh(r)).length,
    exhausted: keyRows.filter((r) => r.enabled && isExh(r)).length,
  };
  const feat = new Map<string, { enabled: boolean; hidden: boolean }>((f.data ?? []).map((r: { feature_id: string; enabled: boolean; hidden: boolean }) => [r.feature_id, r]));
  const hiddenCats = new Set<string>((cat.data ?? []).filter((r: { hidden: boolean }) => r.hidden).map((r: { category: string }) => r.category));
  return { provider: p.data, feat, hiddenCats, keys };
}

function publicProvider(p: Record<string, unknown> | null) {
  if (!p) return null;
  return {
    name: p.name, base_url: p.base_url, enabled: p.enabled, rotation_mode: p.rotation_mode ?? "auto",
    last_check_at: p.last_check_at, last_check_ok: p.last_check_ok, last_check_message: p.last_check_message, updated_at: p.updated_at,
  };
}

async function hostResolvesPublic(baseUrl: string): Promise<string | null> {
  const host = new URL(baseUrl).hostname;
  try {
    // deno-lint-ignore no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resolve = (Deno as any).resolveDns as ((h: string, t: string) => Promise<string[]>) | undefined;
    if (!resolve) return null;
    const ips = [...(await resolve(host, "A").catch(() => [])), ...(await resolve(host, "AAAA").catch(() => []))];
    if (!ips.length) return "Domain tidak dapat di-resolve";
    if (ips.some(isPrivateIp)) return "Domain mengarah ke alamat internal";
  } catch { /* DNS API unavailable: rely on static checks */ }
  return null;
}

async function readCapped(res: Response): Promise<Uint8Array> {
  const reader = res.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY) { await reader.cancel(); throw new Error("Respons provider terlalu besar (maks 6 MB)"); }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}

function b64(u: Uint8Array) {
  let s = "";
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

type Upload = { name?: string; type?: string; data: string } | null;

async function callProvider(baseUrl: string, apiKey: string, f: ApkFeature, values: Record<string, string>, upload: Upload) {
  const qs = new URLSearchParams({ apikey: apiKey });
  let body: BodyInit | undefined;
  const headers: Record<string, string> = { Accept: "application/json, */*" };
  if (f.method === "GET") {
    for (const [k, v] of Object.entries(values)) qs.set(k, v);
  } else if (f.form) {
    const fd = new FormData();
    if (f.fileField && upload) {
      const bytes = Uint8Array.from(atob(upload.data), (c) => c.charCodeAt(0));
      fd.append(f.fileField, new Blob([bytes], { type: upload.type || "application/octet-stream" }), (upload.name || "upload").slice(0, 80));
    }
    for (const [k, v] of Object.entries(values)) fd.append(k, v);
    body = fd;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ apikey: apiKey, ...values });
  }
  const url = `${baseUrl}${f.path}?${qs.toString()}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(url, { method: f.method, headers, body, signal: ctl.signal, redirect: "manual" });
    const latency = Date.now() - t0;
    if (res.status >= 300 && res.status < 400) return { httpStatus: res.status, latency, error: `Provider mengalihkan permintaan (HTTP ${res.status})` };
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const quotaHeaders = parseQuotaHeaders((n) => res.headers.get(n));
    const bytes = await readCapped(res);
    if (/^(image|audio|video)\//.test(ct)) {
      if (!res.ok) return { httpStatus: res.status, latency, quotaHeaders, error: `Provider error HTTP ${res.status}` };
      return { httpStatus: res.status, latency, quotaHeaders, binary: { type: ct.split(";")[0], dataUrl: `data:${ct.split(";")[0]};base64,${b64(bytes)}`, size: bytes.byteLength } };
    }
    const text = new TextDecoder().decode(bytes);
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* plain text */ }
    if (!res.ok) {
      // Gateway errors (Cloudflare 502/503/504/52x) mean the provider's own server is down, not a bad input.
      if ([502, 503, 504, 520, 521, 522, 523, 524, 525, 526].includes(res.status)) {
        return { httpStatus: res.status, latency, quotaHeaders, error: `Server penyedia API sedang tidak bisa dihubungi (HTTP ${res.status}). Coba lagi beberapa menit lagi.` };
      }
      const p = parsed as Record<string, unknown>;
      // Some endpoints send `error: true` next to the real text in `message`; prefer the first non-boolean field.
      const msg = typeof parsed === "object" && parsed ? [p.message, p.msg, p.error, p.detail].find((v) => v != null && typeof v !== "boolean" && String(v).trim() !== "") ?? null : null;
      const providerMessage = msg ? String(typeof msg === "string" ? msg : JSON.stringify(msg)).slice(0, 300) : text.slice(0, 300);
      return { httpStatus: res.status, latency, quotaHeaders, providerMessage, error: `Provider error HTTP ${res.status}${msg ? `: ${String(typeof msg === "string" ? msg : JSON.stringify(msg)).slice(0, 200)}` : ""}` };
    }
    return { httpStatus: res.status, latency, quotaHeaders, parsed };
  } catch (e) {
    const aborted = (e as Error)?.name === "AbortError";
    return { httpStatus: null, latency: Date.now() - t0, error: aborted ? "Provider tidak merespons (timeout 55 detik)" : (e as Error)?.message?.includes("terlalu besar") ? (e as Error).message : "Tidak dapat menghubungi provider" };
  } finally {
    clearTimeout(timer);
  }
}

const FALLBACK: Record<string, string> = { "stalker.igstalk": "tools.instagram-stalker" };

type ProvResult = Awaited<ReturnType<typeof callProvider>>;

/** Persist one provider outcome on the key row (atomic UPDATE inside `apk_premium_key_result`). */
async function reportKey(c: Db, keyId: string, kind: FailureKind | null, r: ProvResult | null, secrets: string[], override?: { outcome: string; message: string }) {
  const red = (m: string) => secrets.reduce((acc, k) => redactSecret(acc, k), m).slice(0, 300);
  const h = r?.quotaHeaders ?? { limit: null, remaining: null };
  let p: { outcome: string; counted: boolean; limit: number | null; limitSrc: string | null; rem: number | null; remSrc: string | null; msg: string | null; until: string | null };
  if (override) p = { outcome: override.outcome, counted: false, limit: null, limitSrc: null, rem: null, remSrc: null, msg: override.message, until: null };
  else if (kind === null || kind === "other") {
    // Provider accepted the key (success, or a feature-level error that is not about the key).
    p = { outcome: "ok", counted: true, limit: h.limit, limitSrc: h.limit != null ? "provider_header" : null, rem: h.remaining, remSrc: h.remaining != null ? "provider_header" : null,
      msg: kind === null ? `OK (HTTP ${r?.httpStatus})` : red(`Key diterima; fitur gagal: ${r?.error ?? ""}`), until: null };
  } else if (kind === "quota") {
    const lim = parseLimitFromMessage(r?.providerMessage ?? r?.error);
    p = { outcome: "exhausted", counted: false, limit: lim, limitSrc: lim != null ? "provider_message" : null, rem: 0, remSrc: "provider_429",
      msg: red(r?.providerMessage || r?.error || "Kuota habis"), until: nextResetWib(new Date()).toISOString() };
  } else if (kind === "invalid") {
    p = { outcome: "invalid", counted: false, limit: null, limitSrc: null, rem: null, remSrc: null, msg: red(r?.providerMessage || r?.error || "Key ditolak provider"), until: null };
  } else if (kind === "rate") {
    p = { outcome: "error", counted: false, limit: null, limitSrc: null, rem: null, remSrc: null, msg: red(`Dibatasi sementara: ${r?.providerMessage || r?.error || "HTTP 429"}`), until: null };
  } else {
    // provider_down / network: says nothing about the key; keep its status.
    p = { outcome: "keep", counted: false, limit: null, limitSrc: null, rem: null, remSrc: null, msg: null, until: null };
  }
  const { error } = await c.rpc("apk_premium_key_result", {
    _id: keyId, _outcome: p.outcome, _counted: p.counted, _limit: p.limit, _limit_source: p.limitSrc,
    _remaining: p.rem, _remaining_source: p.remSrc, _message: p.msg, _exhausted_until: p.until,
  });
  if (error) console.error("apk-premium key_result failed", error.message);
}

/** Every provider call goes through here: picks keys per rotation mode and moves on only when the key itself was rejected. */
async function withKeys(c: Db, mode: string, call: (apiKey: string) => Promise<ProvResult>, onlyKeyId?: string) {
  const plain = new Map<string, string>();
  const secrets: string[] = [];
  const rot = await runWithRotation<ProvResult>({
    maxAttempts: onlyKeyId ? 1 : MAX_KEY_ATTEMPTS,
    pick: async (exclude): Promise<PickedKey | null> => {
      for (let guard = 0; guard < MAX_KEY_ATTEMPTS; guard++) {
        let row: { id: string; key_enc: string; label: string } | null = null;
        if (onlyKeyId) {
          if (exclude.includes(onlyKeyId)) return null;
          row = (await c.from("apk_premium_keys").select("id, key_enc, label").eq("id", onlyKeyId).maybeSingle()).data;
        } else {
          const { data, error } = await c.rpc("apk_premium_pick_key", { _provider: PROVIDER_ID, _mode: mode, _exclude: exclude });
          if (error) { console.error("apk-premium pick failed", error.message); return null; }
          row = data?.[0] ?? null;
        }
        if (!row) return null;
        const k = await decryptToken(row.key_enc).catch(() => null);
        if (k) { plain.set(row.id, k); secrets.push(k); return { id: row.id, label: row.label }; }
        await reportKey(c, row.id, null, null, secrets, { outcome: "invalid", message: "Key tersimpan tidak dapat dibaca server; ganti key ini" });
        if (onlyKeyId) return null;
      }
      return null;
    },
    call: (key) => call(plain.get(key.id)!),
    report: (key, kind, r) => reportKey(c, key.id, kind, r, secrets),
  });
  return { rot, secrets };
}

function keyFailureResponse(reason: string, keys: { total: number; enabled: number; exhausted: number }) {
  if (reason === "all_exhausted" || (reason === "no_keys" && keys.exhausted > 0 && keys.exhausted >= keys.enabled))
    return { status: 503, body: { ok: false, error: "Kuota API sedang habis untuk semua API key aktif. Coba lagi setelah kuota direset atau hubungi admin.", code: "QUOTA_EXHAUSTED" } };
  if (reason === "no_keys" && keys.enabled === 0)
    return { status: 503, body: { ok: false, error: "Layanan APK PREMIUM belum siap: belum ada API key aktif.", code: "NOT_CONFIGURED" } };
  return { status: 503, body: { ok: false, error: "Layanan sedang tidak tersedia: semua API key aktif habis kuota atau tidak valid.", code: "KEYS_UNAVAILABLE" } };
}

async function runFeature(c: Db, req: Request, body: Record<string, unknown>, opts: { admin: boolean }) {
  const f = BY_ID.get(String(body.feature_id || ""));
  if (!f) return json({ error: "Fitur tidak ditemukan" }, 404);
  if (f.unsupported) return json({ error: `Fitur belum didukung di web: ${f.unsupported}`, code: "UNSUPPORTED" }, 400);
  const { provider, feat, hiddenCats, keys } = await loadState(c);
  const s = feat.get(f.id);
  if (!opts.admin && (s?.enabled === false || s?.hidden || hiddenCats.has(f.cat))) return json({ error: "Fitur sedang dinonaktifkan admin", code: "DISABLED" }, 403);
  const check = validateParams(f, body.params as Record<string, unknown>);
  if (!check.ok) return json({ error: check.error, field: check.field, code: "INVALID" }, 400);
  if (!provider || keys.total === 0) return json({ error: "Provider APK PREMIUM belum dikonfigurasi admin (belum ada API key)", code: "NOT_CONFIGURED" }, 503);
  if (!provider.enabled && !opts.admin) return json({ error: "Provider APK PREMIUM sedang dinonaktifkan admin", code: "PROVIDER_OFF" }, 503);
  const base = validateBaseUrl(provider.base_url);
  if (!base.ok) return json({ error: `Base URL provider tidak valid: ${base.error}`, code: "BAD_BASE" }, 503);

  let upload: Upload = null;
  if (f.form && f.fileField) {
    const u = body.file as { name?: string; type?: string; data?: string } | null;
    const vals = (body.params ?? {}) as Record<string, unknown>;
    // Docs tools accept either an uploaded file or a URL param ("Wajib jika tidak upload file").
    const hasUrl = f.fileOptional && f.params.some((p) => /^(url|urls|audio_url)$/.test(p.key) && String(vals[p.key] ?? "").trim());
    if (u?.data || !hasUrl) {
      if (!u?.data && f.fileOptional) return json({ error: "Unggah file atau isi Link / URL", code: "INVALID", field: "file" }, 400);
      const size = u?.data ? Math.floor((u.data.length * 3) / 4) : 0;
      const up = checkUpload(u?.data ? { name: u.name, type: u.type, size } : null, f.fileField, f.accept);
      if (!up.ok) return json({ error: up.error, code: "INVALID", field: "file" }, 400);
      upload = { name: u!.name, type: u!.type, data: u!.data! };
    }
  }

  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";
  const client = await sha(`${ip}|${req.headers.get("user-agent") || ""}`);
  if (!opts.admin) {
    const minAgo = new Date(Date.now() - 60_000).toISOString();
    const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
    const [m, d] = await Promise.all([
      c.from("apk_premium_usage").select("id", { count: "exact", head: true }).eq("client_hash", client).gte("created_at", minAgo),
      c.from("apk_premium_usage").select("id", { count: "exact", head: true }).eq("client_hash", client).gte("created_at", dayAgo),
    ]);
    if ((m.count ?? 0) >= RATE_PER_MIN) return json({ error: "Terlalu banyak permintaan. Coba lagi dalam 1 menit.", code: "RATE_LIMIT" }, 429);
    if ((d.count ?? 0) >= RATE_PER_DAY) return json({ error: "Batas harian tercapai. Coba lagi besok.", code: "RATE_LIMIT" }, 429);
  }
  const dnsErr = await hostResolvesPublic(base.url);
  if (dnsErr) return json({ error: `Base URL provider ditolak: ${dnsErr}`, code: "BAD_BASE" }, 503);

  // Same retry the Jere-MD plugin does (igstalk.js falls back to tools/instagram-stalker), using the same key.
  const fb = FALLBACK[f.id] ? BY_ID.get(FALLBACK[f.id]) : null;
  const { rot, secrets } = await withKeys(c, provider.rotation_mode === "priority" ? "priority" : "auto", async (apiKey) => {
    const r1 = await callProvider(base.url, apiKey, f, check.values, upload);
    if ("error" in r1 && r1.error && fb && !isRotatable(classifyFailure(r1))) {
      const fc = validateParams(fb, check.values);
      if (fc.ok) { const r2 = await callProvider(base.url, apiKey, fb, fc.values, null); if (!("error" in r2 && r2.error)) return r2; }
    }
    return r1;
  });
  const redact = (m: string) => secrets.reduce((acc, k) => redactSecret(acc, k), m);
  const r = rot.result;
  const log = async (status: string, error?: string) => {
    await c.from("apk_premium_usage").insert({ feature_id: f.id, client_hash: opts.admin ? `admin:${client}` : client, status, http_status: r?.httpStatus ?? null, latency_ms: r?.latency ?? null, error: error ? redact(error).slice(0, 300) : null, key_id: rot.key?.id ?? null, attempts: rot.attempts });
  };
  if (!r || (rot.reason !== "ok" && rot.reason !== "failed")) {
    const fail = keyFailureResponse(rot.reason, keys);
    await log("error", `${fail.body.code}: ${fail.body.error}`);
    return json({ ...fail.body, attempts: rot.attempts }, fail.status);
  }
  if ("error" in r && r.error) {
    await log("error", r.error);
    return json({ ok: false, error: redact(r.error), http_status: r.httpStatus, latency_ms: r.latency, attempts: rot.attempts }, 502);
  }
  if ("binary" in r && r.binary) {
    await log("ok");
    const kind = r.binary.type.startsWith("image") ? "image" : r.binary.type.startsWith("audio") ? "audio" : "video";
    return json({ ok: true, feature_id: f.id, latency_ms: r.latency, normalized: { ok: true, texts: [], items: [], media: [{ url: r.binary.dataUrl, kind, label: `Hasil (${Math.round(r.binary.size / 1024)} KB)` }] }, raw: null });
  }
  const safeText = redact(typeof r.parsed === "string" ? r.parsed : JSON.stringify(r.parsed));
  let safe: unknown = safeText;
  try { safe = typeof r.parsed === "string" ? safeText : JSON.parse(safeText); } catch { safe = safeText; }
  const norm = normalizeResponse(safe);
  const redactedLinks = (safeText.match(/api_?key=\*\*\*/gi) || []).length;
  await log(norm.ok ? "ok" : "empty", norm.ok ? undefined : norm.error);
  const rawStr = typeof safe === "string" ? safe : JSON.stringify(safe, null, 2);
  return json({ ok: norm.ok, error: norm.ok ? undefined : norm.error, feature_id: f.id, latency_ms: r.latency, normalized: norm, raw: rawStr.length > 60_000 ? rawStr.slice(0, 60_000) + "\n…(dipotong)" : rawStr, redacted_links: redactedLinks }, norm.ok ? 200 : 502);
}

async function loadKeysView(c: Db) {
  const { data } = await c.from("apk_premium_keys")
    .select("id, label, key_last4, enabled, priority, status, status_message, quota_limit, quota_limit_source, quota_remaining, quota_remaining_source, quota_checked_at, exhausted_until, used_day, used_today, total_used, last_used_at, last_error_at, created_at")
    .eq("provider_id", PROVIDER_ID).order("priority").order("created_at");
  const rows = (data ?? []) as KeyRow[];
  const now = new Date();
  // Never include key_enc; only a masked tail leaves the server.
  const keys = rows.map((k) => {
    const { key_last4, ...rest } = k;
    return { ...rest, masked: maskKey(key_last4), view: keyView(k, now) };
  });
  return { keys, summary: summarize(rows, now), next_reset: nextResetWib(now).toISOString() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "Body harus JSON" }, 400); }
  const action = String(body.action || "");
  const c = db();

  try {
    if (action === "catalog") {
      const { provider, feat, hiddenCats, keys } = await loadState(c);
      const configured = keys.total > 0;
      const providerReady = configured && !!provider?.enabled && keys.enabled > 0;
      const features = APK_FEATURES.filter((f) => !feat.get(f.id)?.hidden && !hiddenCats.has(f.cat)).map((f) => {
        const off = feat.get(f.id)?.enabled === false;
        const available = providerReady && !off && !f.unsupported;
        const reason = f.unsupported ? f.unsupported : off ? "Dinonaktifkan admin" : !configured ? "Provider belum dikonfigurasi" : !provider?.enabled ? "Provider dinonaktifkan" : keys.enabled === 0 ? "Belum ada API key aktif" : null;
        return { id: f.id, cat: f.cat, label: f.label, help: f.help, desc: f.desc ?? null, tier: f.tier ?? null, accept: f.accept ?? null, fileOptional: !!f.fileOptional, method: f.method, form: f.form, fileField: f.fileField, params: f.params, available, reason };
      });
      return json({ provider: { configured, enabled: !!provider?.enabled, last_check_ok: provider?.last_check_ok ?? null, quota_available: keys.usable > 0 }, categories: APK_CATEGORY_LABEL, features, docs_total: APK_DOCS_TOTAL, docs_features: APK_DOCS_FEATURES, excluded_total: APK_DOCS_EXCLUDED, excluded: EXCLUDED_PUBLIC });
    }
    if (action === "run") return await runFeature(c, req, body, { admin: false });

    // ---- admin-only below ----
    if (!action.startsWith("admin_")) return json({ error: "Aksi tidak dikenal" }, 400);
    if (!(await isAdminRequest(req, c))) return json({ error: "Forbidden — admin only" }, 403);
    const uid = (await c.auth.getUser((req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""))).data?.user?.id ?? null;
    const audit = async (keyId: string | null, act: string, detail: Record<string, unknown> = {}) => {
      const { error } = await c.from("apk_premium_key_audit").insert({ key_id: keyId, action: act, actor: uid, detail });
      if (error) console.error("apk-premium audit failed", error.message);
    };
    const validKey = (v: unknown) => typeof v === "string" && v.trim().length >= 4 && v.trim().length <= 512 && !/\s/.test(v.trim());
    const validLabel = (v: unknown) => typeof v === "string" && v.trim().length >= 1 && v.trim().length <= 60;

    if (action === "admin_get") {
      const { provider, feat, hiddenCats } = await loadState(c);
      const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
      const [{ data: logs }, keysView, { data: auditRows }] = await Promise.all([
        c.from("apk_premium_usage").select("feature_id, status, http_status, latency_ms, error, created_at, key_id, attempts").gte("created_at", dayAgo).order("created_at", { ascending: false }).limit(500),
        loadKeysView(c),
        c.from("apk_premium_key_audit").select("key_id, action, detail, created_at").order("created_at", { ascending: false }).limit(20),
      ]);
      const stats: Record<string, { ok: number; fail: number }> = {};
      for (const l of logs ?? []) { const s = (stats[l.feature_id] ||= { ok: 0, fail: 0 }); if (l.status === "ok") s.ok++; else s.fail++; }
      return json({
        provider: publicProvider(provider),
        ...keysView,
        key_audit: auditRows ?? [],
        categories: APK_CATEGORY_LABEL,
        hidden_categories: [...hiddenCats],
        features: APK_FEATURES.map((f) => ({ ...f, enabled: feat.get(f.id)?.enabled !== false, hidden: !!feat.get(f.id)?.hidden })),
        excluded: APK_EXCLUDED,
        stats,
        recent: (logs ?? []).slice(0, 40),
      });
    }
    if (action === "admin_keys") return json(await loadKeysView(c));
    if (action === "admin_save_provider") {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: uid };
      if (body.base_url !== undefined) {
        const v = validateBaseUrl(String(body.base_url));
        if (!v.ok) return json({ error: v.error }, 400);
        const dnsErr = await hostResolvesPublic(v.url);
        if (dnsErr) return json({ error: dnsErr }, 400);
        patch.base_url = v.url;
      }
      if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
      if (body.rotation_mode !== undefined) {
        if (body.rotation_mode !== "auto" && body.rotation_mode !== "priority") return json({ error: "Mode rotasi tidak dikenal" }, 400);
        patch.rotation_mode = body.rotation_mode;
      }
      const { error } = await c.from("apk_premium_provider").update(patch).eq("id", PROVIDER_ID);
      if (error) return json({ error: "Gagal menyimpan konfigurasi" }, 500);
      if (patch.rotation_mode) await audit(null, "set_mode", { mode: patch.rotation_mode });
      if (typeof patch.enabled === "boolean") await audit(null, "provider_enabled", { enabled: patch.enabled });
      const { provider } = await loadState(c);
      return json({ ok: true, provider: publicProvider(provider) });
    }
    if (action === "admin_key_add") {
      if (!validLabel(body.label)) return json({ error: "Label wajib 1–60 karakter" }, 400);
      if (!validKey(body.api_key)) return json({ error: "Format API key tidak valid (4–512 karakter, tanpa spasi)" }, 400);
      const k = String(body.api_key).trim();
      const { data: maxRow } = await c.from("apk_premium_keys").select("priority").eq("provider_id", PROVIDER_ID).order("priority", { ascending: false }).limit(1).maybeSingle();
      const { data, error } = await c.from("apk_premium_keys").insert({
        provider_id: PROVIDER_ID, label: String(body.label).trim(), key_enc: await encryptToken(k), key_last4: k.slice(-4),
        enabled: body.enabled !== false, priority: (maxRow?.priority ?? 0) + 1, created_by: uid,
      }).select("id").single();
      if (error) return json({ error: "Gagal menambah key" }, 500);
      await audit(data.id, "add", { label: String(body.label).trim(), last4: k.slice(-4) });
      return json({ ok: true, id: data.id, ...(await loadKeysView(c)) });
    }
    if (action === "admin_key_update") {
      const id = String(body.id || "");
      const { data: cur } = await c.from("apk_premium_keys").select("id, label, enabled").eq("id", id).eq("provider_id", PROVIDER_ID).maybeSingle();
      if (!cur) return json({ error: "Key tidak ditemukan" }, 404);
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const changed: Record<string, unknown> = {};
      if (body.label !== undefined) { if (!validLabel(body.label)) return json({ error: "Label wajib 1–60 karakter" }, 400); patch.label = String(body.label).trim(); changed.label = patch.label; }
      if (typeof body.enabled === "boolean") { patch.enabled = body.enabled; changed.enabled = body.enabled; }
      if (body.quota_limit !== undefined) {
        if (body.quota_limit === null) { patch.quota_limit = null; patch.quota_limit_source = null; }
        else {
          const n = Number(body.quota_limit);
          if (!Number.isInteger(n) || n < 1 || n > 10_000_000) return json({ error: "Kuota maksimum harus bilangan bulat 1–10.000.000" }, 400);
          patch.quota_limit = n; patch.quota_limit_source = "admin";
        }
        changed.quota_limit = patch.quota_limit;
      }
      if (body.api_key !== undefined) {
        if (!validKey(body.api_key)) return json({ error: "Format API key tidak valid (4–512 karakter, tanpa spasi)" }, 400);
        const k = String(body.api_key).trim();
        Object.assign(patch, { key_enc: await encryptToken(k), key_last4: k.slice(-4), status: "unknown", status_message: "Key diganti, belum diperiksa",
          quota_remaining: null, quota_remaining_source: null, quota_checked_at: null, exhausted_until: null, used_today: 0, used_day: null, last_error_at: null });
        changed.replaced_key_last4 = k.slice(-4);
      }
      const { error } = await c.from("apk_premium_keys").update(patch).eq("id", id);
      if (error) return json({ error: "Gagal menyimpan key" }, 500);
      await audit(id, "update", changed);
      return json({ ok: true, ...(await loadKeysView(c)) });
    }
    if (action === "admin_key_delete") {
      const id = String(body.id || "");
      const { data: cur } = await c.from("apk_premium_keys").select("id, label, key_last4").eq("id", id).eq("provider_id", PROVIDER_ID).maybeSingle();
      if (!cur) return json({ error: "Key tidak ditemukan" }, 404);
      const { error } = await c.from("apk_premium_keys").delete().eq("id", id);
      if (error) return json({ error: "Gagal menghapus key" }, 500);
      await audit(id, "delete", { label: cur.label, last4: cur.key_last4 });
      return json({ ok: true, ...(await loadKeysView(c)) });
    }
    if (action === "admin_key_reorder") {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
      const { data: all } = await c.from("apk_premium_keys").select("id").eq("provider_id", PROVIDER_ID);
      const known = new Set((all ?? []).map((r: { id: string }) => r.id));
      if (ids.length !== known.size || new Set(ids).size !== ids.length || ids.some((i) => !known.has(i))) return json({ error: "Urutan harus memuat semua key tepat satu kali" }, 400);
      for (let i = 0; i < ids.length; i++) {
        const { error } = await c.from("apk_premium_keys").update({ priority: i + 1, updated_at: new Date().toISOString() }).eq("id", ids[i]);
        if (error) return json({ error: "Gagal menyimpan urutan" }, 500);
      }
      await audit(null, "reorder", { ids });
      return json({ ok: true, ...(await loadKeysView(c)) });
    }
    if (action === "admin_keys_bulk_enable") {
      if (typeof body.enabled !== "boolean") return json({ error: "Nilai enabled wajib" }, 400);
      const { error } = await c.from("apk_premium_keys").update({ enabled: body.enabled, updated_at: new Date().toISOString() }).eq("provider_id", PROVIDER_ID);
      if (error) return json({ error: "Gagal menyimpan" }, 500);
      await audit(null, body.enabled ? "enable_all" : "disable_all");
      return json({ ok: true, ...(await loadKeysView(c)) });
    }
    if (action === "admin_test" || action === "admin_key_test") {
      // admin_test: one YouTube Search through the normal rotation; admin_key_test: the chosen key only (uses 1 provider request).
      const { provider } = await loadState(c);
      const base = validateBaseUrl(provider?.base_url ?? "");
      const keyId = action === "admin_key_test" ? String(body.id || "") : undefined;
      let ok = false;
      let message = "";
      let usedKey: string | null = null;
      let attempts = 0;
      if (!base.ok) message = base.error;
      else {
        const dnsErr = await hostResolvesPublic(base.url);
        if (dnsErr) message = dnsErr;
        else {
          const f = BY_ID.get("search.youtube")!;
          const { rot, secrets } = await withKeys(c, provider?.rotation_mode === "priority" ? "priority" : "auto", (k) => callProvider(base.url, k, f, { q: "test" }, null), keyId);
          const red = (m: string) => secrets.reduce((acc, k) => redactSecret(acc, k), m);
          usedKey = rot.key?.label ?? null; attempts = rot.attempts;
          const r = rot.result;
          if (!r) message = keyFailureResponse(rot.reason, { total: 0, enabled: 0, exhausted: 0 }).body.error;
          else if ("error" in r && r.error) message = red(r.error);
          else {
            const n = normalizeResponse("parsed" in r ? r.parsed : null);
            ok = n.ok;
            message = n.ok ? `Terhubung (HTTP ${r.httpStatus}, ${r.latency} ms) — YouTube Search mengembalikan ${n.items.length} hasil` : red(`Terhubung tetapi respons tidak valid: ${n.error}`);
          }
          if (rot.failures.length) message += ` • dilewati: ${rot.failures.length} key (${rot.failures.map((x) => x.kind).join(", ")})`;
        }
      }
      if (!keyId) await c.from("apk_premium_provider").update({ last_check_at: new Date().toISOString(), last_check_ok: ok, last_check_message: message.slice(0, 300) }).eq("id", PROVIDER_ID);
      await audit(keyId ?? null, keyId ? "test_key" : "test_rotation", { ok, used: usedKey, attempts });
      const { provider: p2 } = await loadState(c);
      return json({ ok, message, used_key: usedKey, attempts, provider: publicProvider(p2), ...(await loadKeysView(c)) });
    }
    if (action === "admin_set_feature") {
      const id = String(body.feature_id || "");
      if (!BY_ID.has(id)) return json({ error: "Fitur tidak ditemukan" }, 404);
      const row: Record<string, unknown> = { feature_id: id, updated_at: new Date().toISOString() };
      const cur = (await c.from("apk_premium_feature_settings").select("enabled, hidden").eq("feature_id", id).maybeSingle()).data;
      row.enabled = typeof body.enabled === "boolean" ? body.enabled : cur?.enabled ?? true;
      row.hidden = typeof body.hidden === "boolean" ? body.hidden : cur?.hidden ?? false;
      const { error } = await c.from("apk_premium_feature_settings").upsert(row);
      if (error) return json({ error: "Gagal menyimpan" }, 500);
      return json({ ok: true });
    }
    if (action === "admin_set_category") {
      const cat = String(body.category || "");
      if (!APK_FEATURES.some((f) => f.cat === cat)) return json({ error: "Kategori tidak ditemukan" }, 404);
      const { error } = await c.from("apk_premium_category_settings").upsert({ category: cat, hidden: !!body.hidden, updated_at: new Date().toISOString() });
      if (error) return json({ error: "Gagal menyimpan" }, 500);
      return json({ ok: true });
    }
    if (action === "admin_run") return await runFeature(c, req, body, { admin: true });
    return json({ error: "Aksi tidak dikenal" }, 400);
  } catch (e) {
    console.error("apk-premium error", (e as Error)?.message);
    return json({ error: "Terjadi kesalahan server" }, 500);
  }
});
