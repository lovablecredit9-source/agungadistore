// APK PREMIUM: server-side proxy to the admin-configured JereAPI provider.
// The API key is write-only (AES-GCM encrypted, never returned or logged); every response is redacted.
// Feature list comes from `_shared/apk-premium-catalog.ts` (generated from Jere-MD plugin source).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { isAdminRequest } from "../_shared/admin.ts";
import { encryptToken, decryptToken } from "../_shared/bot-crypto.ts";
import { APK_FEATURES, APK_EXCLUDED, APK_CATEGORY_LABEL, type ApkFeature } from "../_shared/apk-premium-catalog.ts";
import { validateBaseUrl, validateParams, normalizeResponse, redactSecret, checkUpload, isPrivateIp } from "../_shared/apk-premium-core.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) => Response.json(b, { status, headers: cors });
const PROVIDER_ID = "jereapi";
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
  const [p, f, cat] = await Promise.all([
    c.from("apk_premium_provider").select("*").eq("id", PROVIDER_ID).maybeSingle(),
    c.from("apk_premium_feature_settings").select("feature_id, enabled, hidden"),
    c.from("apk_premium_category_settings").select("category, hidden"),
  ]);
  const feat = new Map<string, { enabled: boolean; hidden: boolean }>((f.data ?? []).map((r: { feature_id: string; enabled: boolean; hidden: boolean }) => [r.feature_id, r]));
  const hiddenCats = new Set<string>((cat.data ?? []).filter((r: { hidden: boolean }) => r.hidden).map((r: { category: string }) => r.category));
  return { provider: p.data, feat, hiddenCats };
}

function publicProvider(p: Record<string, unknown> | null) {
  if (!p) return null;
  return {
    name: p.name, base_url: p.base_url, enabled: p.enabled, has_key: !!p.api_key_enc, key_last4: p.key_last4 ?? null,
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
    const bytes = await readCapped(res);
    if (/^(image|audio|video)\//.test(ct)) {
      if (!res.ok) return { httpStatus: res.status, latency, error: `Provider error HTTP ${res.status}` };
      return { httpStatus: res.status, latency, binary: { type: ct.split(";")[0], dataUrl: `data:${ct.split(";")[0]};base64,${b64(bytes)}`, size: bytes.byteLength } };
    }
    const text = new TextDecoder().decode(bytes);
    let parsed: unknown = text;
    try { parsed = JSON.parse(text); } catch { /* plain text */ }
    if (!res.ok) {
      const p = parsed as Record<string, unknown>;
      const msg = typeof parsed === "object" && parsed ? (p.error ?? p.message ?? p.msg ?? p.detail) : null;
      return { httpStatus: res.status, latency, error: `Provider error HTTP ${res.status}${msg ? `: ${String(typeof msg === "string" ? msg : JSON.stringify(msg)).slice(0, 200)}` : ""}` };
    }
    return { httpStatus: res.status, latency, parsed };
  } catch (e) {
    const aborted = (e as Error)?.name === "AbortError";
    return { httpStatus: null, latency: Date.now() - t0, error: aborted ? "Provider tidak merespons (timeout 55 detik)" : (e as Error)?.message?.includes("terlalu besar") ? (e as Error).message : "Tidak dapat menghubungi provider" };
  } finally {
    clearTimeout(timer);
  }
}

const FALLBACK: Record<string, string> = { "stalker.igstalk": "tools.instagram-stalker" };

async function runFeature(c: Db, req: Request, body: Record<string, unknown>, opts: { admin: boolean }) {
  const f = BY_ID.get(String(body.feature_id || ""));
  if (!f) return json({ error: "Fitur tidak ditemukan" }, 404);
  if (f.unsupported) return json({ error: `Fitur belum didukung di web: ${f.unsupported}`, code: "UNSUPPORTED" }, 400);
  const { provider, feat, hiddenCats } = await loadState(c);
  const s = feat.get(f.id);
  if (!opts.admin && (s?.enabled === false || s?.hidden || hiddenCats.has(f.cat))) return json({ error: "Fitur sedang dinonaktifkan admin", code: "DISABLED" }, 403);
  const check = validateParams(f, body.params as Record<string, unknown>);
  if (!check.ok) return json({ error: check.error, field: check.field, code: "INVALID" }, 400);
  if (!provider?.api_key_enc) return json({ error: "Provider APK PREMIUM belum dikonfigurasi admin (API key kosong)", code: "NOT_CONFIGURED" }, 503);
  if (!provider.enabled && !opts.admin) return json({ error: "Provider APK PREMIUM sedang dinonaktifkan admin", code: "PROVIDER_OFF" }, 503);
  const base = validateBaseUrl(provider.base_url);
  if (!base.ok) return json({ error: `Base URL provider tidak valid: ${base.error}`, code: "BAD_BASE" }, 503);

  let upload: Upload = null;
  if (f.form && f.fileField) {
    const u = body.file as { name?: string; type?: string; data?: string } | null;
    const size = u?.data ? Math.floor((u.data.length * 3) / 4) : 0;
    const up = checkUpload(u?.data ? { name: u.name, type: u.type, size } : null, f.fileField);
    if (!up.ok) return json({ error: up.error, code: "INVALID", field: "file" }, 400);
    upload = { name: u!.name, type: u!.type, data: u!.data! };
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

  let apiKey: string | null = null;
  try { apiKey = await decryptToken(provider.api_key_enc); } catch { apiKey = null; }
  if (!apiKey) return json({ error: "API key provider tidak dapat dibaca. Admin perlu menyimpan ulang API key.", code: "NOT_CONFIGURED" }, 503);

  let r = await callProvider(base.url, apiKey, f, check.values, upload);
  // Same retry the Jere-MD plugin does (igstalk.js falls back to tools/instagram-stalker).
  const fb = FALLBACK[f.id] ? BY_ID.get(FALLBACK[f.id]) : null;
  if ("error" in r && r.error && fb) {
    const fc = validateParams(fb, check.values);
    if (fc.ok) { const r2 = await callProvider(base.url, apiKey, fb, fc.values, null); if (!("error" in r2 && r2.error)) r = r2; }
  }
  const log = async (status: string, error?: string) => {
    await c.from("apk_premium_usage").insert({ feature_id: f.id, client_hash: opts.admin ? `admin:${client}` : client, status, http_status: r.httpStatus, latency_ms: r.latency, error: error ? redactSecret(error, apiKey).slice(0, 300) : null });
  };
  if ("error" in r && r.error) {
    await log("error", r.error);
    return json({ ok: false, error: redactSecret(r.error, apiKey), http_status: r.httpStatus, latency_ms: r.latency }, 502);
  }
  if ("binary" in r && r.binary) {
    await log("ok");
    const kind = r.binary.type.startsWith("image") ? "image" : r.binary.type.startsWith("audio") ? "audio" : "video";
    return json({ ok: true, feature_id: f.id, latency_ms: r.latency, normalized: { ok: true, texts: [], items: [], media: [{ url: r.binary.dataUrl, kind, label: `Hasil (${Math.round(r.binary.size / 1024)} KB)` }] }, raw: null });
  }
  const safeText = redactSecret(typeof r.parsed === "string" ? r.parsed : JSON.stringify(r.parsed), apiKey);
  let safe: unknown = safeText;
  try { safe = typeof r.parsed === "string" ? safeText : JSON.parse(safeText); } catch { safe = safeText; }
  const norm = normalizeResponse(safe);
  const redactedLinks = (safeText.match(/api_?key=\*\*\*/gi) || []).length;
  await log(norm.ok ? "ok" : "empty", norm.ok ? undefined : norm.error);
  const rawStr = typeof safe === "string" ? safe : JSON.stringify(safe, null, 2);
  return json({ ok: norm.ok, error: norm.ok ? undefined : norm.error, feature_id: f.id, latency_ms: r.latency, normalized: norm, raw: rawStr.length > 60_000 ? rawStr.slice(0, 60_000) + "\n…(dipotong)" : rawStr, redacted_links: redactedLinks }, norm.ok ? 200 : 502);
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
      const { provider, feat, hiddenCats } = await loadState(c);
      const providerReady = !!provider?.api_key_enc && !!provider?.enabled;
      const features = APK_FEATURES.filter((f) => !feat.get(f.id)?.hidden && !hiddenCats.has(f.cat)).map((f) => {
        const off = feat.get(f.id)?.enabled === false;
        const available = providerReady && !off && !f.unsupported;
        const reason = f.unsupported ? f.unsupported : off ? "Dinonaktifkan admin" : !provider?.api_key_enc ? "Provider belum dikonfigurasi" : !provider?.enabled ? "Provider dinonaktifkan" : null;
        return { id: f.id, cat: f.cat, label: f.label, help: f.help, method: f.method, form: f.form, fileField: f.fileField, params: f.params, available, reason };
      });
      return json({ provider: { configured: !!provider?.api_key_enc, enabled: !!provider?.enabled, last_check_ok: provider?.last_check_ok ?? null }, categories: APK_CATEGORY_LABEL, features });
    }
    if (action === "run") return await runFeature(c, req, body, { admin: false });

    // ---- admin-only below ----
    if (!action.startsWith("admin_")) return json({ error: "Aksi tidak dikenal" }, 400);
    if (!(await isAdminRequest(req, c))) return json({ error: "Forbidden — admin only" }, 403);
    const uid = (await c.auth.getUser((req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, ""))).data?.user?.id ?? null;

    if (action === "admin_get") {
      const { provider, feat, hiddenCats } = await loadState(c);
      const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
      const { data: logs } = await c.from("apk_premium_usage").select("feature_id, status, http_status, latency_ms, error, created_at").gte("created_at", dayAgo).order("created_at", { ascending: false }).limit(500);
      const stats: Record<string, { ok: number; fail: number }> = {};
      for (const l of logs ?? []) { const s = (stats[l.feature_id] ||= { ok: 0, fail: 0 }); if (l.status === "ok") s.ok++; else s.fail++; }
      return json({
        provider: publicProvider(provider),
        categories: APK_CATEGORY_LABEL,
        hidden_categories: [...hiddenCats],
        features: APK_FEATURES.map((f) => ({ ...f, enabled: feat.get(f.id)?.enabled !== false, hidden: !!feat.get(f.id)?.hidden })),
        excluded: APK_EXCLUDED,
        stats,
        recent: (logs ?? []).slice(0, 40),
      });
    }
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
      if (body.clear_key === true) { patch.api_key_enc = null; patch.key_last4 = null; patch.enabled = false; }
      else if (typeof body.api_key === "string" && body.api_key.trim()) {
        const k = body.api_key.trim();
        if (k.length < 4 || k.length > 512 || /\s/.test(k)) return json({ error: "Format API key tidak valid" }, 400);
        patch.api_key_enc = await encryptToken(k);
        patch.key_last4 = k.slice(-4);
        patch.last_check_at = null; patch.last_check_ok = null; patch.last_check_message = null;
      }
      const { error } = await c.from("apk_premium_provider").update(patch).eq("id", PROVIDER_ID);
      if (error) return json({ error: "Gagal menyimpan konfigurasi" }, 500);
      const { provider } = await loadState(c);
      return json({ ok: true, provider: publicProvider(provider) });
    }
    if (action === "admin_test") {
      const { provider } = await loadState(c);
      const base = validateBaseUrl(provider?.base_url ?? "");
      let ok = false;
      let message = "";
      if (!base.ok) message = base.error;
      else if (!provider?.api_key_enc) message = "API key belum diisi";
      else {
        const dnsErr = await hostResolvesPublic(base.url);
        if (dnsErr) message = dnsErr;
        else {
          const key = await decryptToken(provider.api_key_enc).catch(() => null);
          const f = BY_ID.get("search.youtube")!;
          const r = key ? await callProvider(base.url, key, f, { q: "test" }, null) : { error: "API key tidak dapat dibaca", httpStatus: null, latency: 0 };
          if ("error" in r && r.error) message = redactSecret(r.error, key);
          else {
            const n = normalizeResponse("parsed" in r ? r.parsed : null);
            ok = n.ok;
            message = n.ok ? `Terhubung (HTTP ${r.httpStatus}, ${r.latency} ms) — uji YouTube Search mengembalikan ${n.items.length} hasil` : redactSecret(`Terhubung tetapi respons tidak valid: ${n.error}`, key);
          }
        }
      }
      await c.from("apk_premium_provider").update({ last_check_at: new Date().toISOString(), last_check_ok: ok, last_check_message: message.slice(0, 300) }).eq("id", PROVIDER_ID);
      const { provider: p2 } = await loadState(c);
      return json({ ok, message, provider: publicProvider(p2) });
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
