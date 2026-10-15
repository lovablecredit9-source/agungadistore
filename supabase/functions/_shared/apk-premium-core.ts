// Pure rules for APK PREMIUM (JereAPI proxy). Shared by the `apk-premium` edge function and Vitest.
// No network, no secrets here.
import type { ApkFeature } from "./apk-premium-catalog.ts";

export const MAX_PARAM_LEN = 4000;
export const MAX_URL_LEN = 2048;
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const PRIVATE_V4 = [
  /^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^22[4-9]\./, /^2[3-5]\d\./,
];

export function isPrivateIp(ip: string): boolean {
  const v = ip.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) return PRIVATE_V4.some((r) => r.test(v));
  if (v.includes(":")) {
    if (v === "::" || v === "::1") return true;
    if (/^f[cd]/.test(v) || /^fe[89ab]/.test(v)) return true;
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]);
  }
  return false;
}

/** Validates an admin-supplied provider base URL (SSRF guard, before DNS check). */
export function validateBaseUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let u: URL;
  try { u = new URL(String(raw || "").trim()); } catch { return { ok: false, error: "Base URL tidak valid" }; }
  if (u.protocol !== "https:") return { ok: false, error: "Base URL wajib https://" };
  if (u.username || u.password) return { ok: false, error: "Base URL tidak boleh berisi kredensial" };
  if (u.search || u.hash) return { ok: false, error: "Base URL tidak boleh berisi query atau #" };
  if (u.port && u.port !== "443") return { ok: false, error: "Base URL hanya boleh port 443" };
  const host = u.hostname.toLowerCase();
  if (!host.includes(".") || host === "localhost" || /\.(local|localhost|internal|lan|home|corp)$/.test(host)) {
    return { ok: false, error: "Alamat internal tidak diizinkan" };
  }
  if (/^[\d.]+$/.test(host) || host.startsWith("[")) {
    if (isPrivateIp(host)) return { ok: false, error: "Alamat IP internal tidak diizinkan" };
  }
  if (host === "metadata.google.internal") return { ok: false, error: "Alamat internal tidak diizinkan" };
  return { ok: true, url: `${u.origin}${u.pathname.replace(/\/+$/, "")}` };
}

const DOMAIN_RULES: { test: RegExp; hosts: string[]; label: string }[] = [
  { test: /^downloader\.(yt|youtube|ssyoutube|savetube|y2mate)/, hosts: ["youtube.com", "youtu.be"], label: "YouTube" },
  { test: /^downloader\.(instagram|fastdl|reelsvideo)/, hosts: ["instagram.com"], label: "Instagram" },
  { test: /^downloader\.(tiktok|tt|savett)/, hosts: ["tiktok.com"], label: "TikTok" },
  { test: /^downloader\.spotify/, hosts: ["spotify.com"], label: "Spotify" },
  { test: /^downloader\.(facebook)/, hosts: ["facebook.com", "fb.watch", "fb.com"], label: "Facebook" },
];

export function domainRuleFor(id: string) {
  return DOMAIN_RULES.find((r) => r.test.test(id)) ?? null;
}

function hostMatches(host: string, allowed: string[]) {
  const h = host.toLowerCase();
  return allowed.some((a) => h === a || h.endsWith("." + a));
}

export type ParamCheck = { ok: true; values: Record<string, string> } | { ok: false; error: string; field?: string };

/** Validates user input against the catalog entry. Unknown keys are dropped. */
export function validateParams(feature: ApkFeature, input: Record<string, unknown> | null | undefined): ParamCheck {
  const values: Record<string, string> = {};
  const src = input ?? {};
  for (const p of feature.params) {
    const raw = src[p.key];
    let v = raw == null ? "" : String(raw).trim();
    if (!v && p.default != null) v = String(p.default);
    if (!v) {
      if (p.required) return { ok: false, error: `Kolom "${p.key}" wajib diisi`, field: p.key };
      continue;
    }
    if (v.length > MAX_PARAM_LEN) return { ok: false, error: `Kolom "${p.key}" terlalu panjang`, field: p.key };
    if (p.options?.length && !p.options.includes(v)) return { ok: false, error: `Pilihan "${p.key}" tidak valid (${p.options.join("/")})`, field: p.key };
    if (p.type === "number" && !/^-?\d+(\.\d+)?$/.test(v)) return { ok: false, error: `Kolom "${p.key}" harus angka`, field: p.key };
    if (p.type === "url") {
      if (v.length > MAX_URL_LEN) return { ok: false, error: `URL terlalu panjang`, field: p.key };
      let u: URL;
      try { u = new URL(v); } catch { return { ok: false, error: `Kolom "${p.key}" harus URL lengkap (https://...)`, field: p.key }; }
      if (u.protocol !== "https:" && u.protocol !== "http:") return { ok: false, error: "URL harus http/https", field: p.key };
      if (p.key === "url") {
        const rule = domainRuleFor(feature.id);
        if (rule && !hostMatches(u.hostname, rule.hosts)) return { ok: false, error: `Masukkan link ${rule.label} yang valid`, field: p.key };
      }
    }
    values[p.key] = v;
  }
  return { ok: true, values };
}

/** Removes the API key from any text that leaves the server. */
export function redactSecret(text: string, secret: string | null | undefined): string {
  let out = text.replace(/([?&]api_?key=)[^&"'\s<>]+/gi, "$1***");
  if (secret && secret.length >= 4) out = out.split(secret).join("***");
  return out;
}

export type MediaKind = "video" | "audio" | "image" | "file";
export type NormMedia = { url: string; kind: MediaKind; label: string };
export type NormItem = { title: string; subtitle?: string; image?: string; url?: string; meta: { k: string; v: string }[] };
export type Normalized = { ok: boolean; error?: string; title?: string; texts: string[]; media: NormMedia[]; items: NormItem[]; taskId?: string };

const TEXT_KEYS = ["answer", "response", "reply", "message", "text", "result", "content", "output", "description", "lyrics", "summary", "translated", "translation"];
const TITLE_KEYS = ["title", "name", "judul", "nama", "username"];
const IMG_KEYS = ["thumbnail", "thumb", "imageurl", "image", "img", "cover", "poster", "avatar", "pp", "profile_pic", "photo", "icon", "banner"];
const LINK_KEYS = ["url", "link", "href", "permalink"];
const SKIP_META = new Set(["status", "creator", "author_url", "id", "_id"]);

const isUrl = (s: unknown): boolean => typeof s === "string" && /^https?:\/\/\S+$/i.test(s.trim()) && s.length < 4000;

export function mediaKindOf(url: string, key = ""): MediaKind {
  const p = url.toLowerCase().split("?")[0];
  const k = key.toLowerCase();
  if (/\.(mp4|webm|mov|mkv|m3u8)$/.test(p) || /video|nowm|play$|hdplay|wmplay|mp4/.test(k)) return "video";
  if (/\.(mp3|m4a|ogg|opus|wav|aac|flac)$/.test(p) || /audio|music|mp3|sound/.test(k)) return "audio";
  if (/\.(jpe?g|png|webp|gif|bmp|svg)$/.test(p) || IMG_KEYS.some((x) => k.includes(x))) return "image";
  return "file";
}

function firstString(o: Record<string, unknown>, keys: string[]): string | undefined {
  const lower = Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]));
  for (const k of keys) {
    const v = lower[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function toItem(o: Record<string, unknown>): NormItem | null {
  const title = firstString(o, TITLE_KEYS);
  const image = firstString(o, IMG_KEYS);
  const url = firstString(o, LINK_KEYS);
  const meta: { k: string; v: string }[] = [];
  for (const [k, v] of Object.entries(o)) {
    if (meta.length >= 6) break;
    const lk = k.toLowerCase();
    if (SKIP_META.has(lk) || TITLE_KEYS.includes(lk) || IMG_KEYS.includes(lk) || LINK_KEYS.includes(lk)) continue;
    if ((typeof v === "string" && v.trim() && v.length <= 160 && !isUrl(v)) || typeof v === "number" || typeof v === "boolean") meta.push({ k, v: String(v) });
    else if (v && typeof v === "object" && !Array.isArray(v)) {
      const n = firstString(v as Record<string, unknown>, ["name", "title", "text"]);
      if (n) meta.push({ k, v: n });
    }
  }
  if (!title && !image && !url && !meta.length) return null;
  return { title: title ?? (url ?? "Item"), image: image && isUrl(image) ? image : undefined, url: url && isUrl(url) ? url : undefined, meta };
}

/** Turns any provider JSON into displayable parts using only values that exist in the response. */
export function normalizeResponse(json: unknown): Normalized {
  const out: Normalized = { ok: true, texts: [], media: [], items: [] };
  if (json == null) return { ...out, ok: false, error: "Respons kosong dari provider" };
  if (typeof json === "string") {
    if (isUrl(json)) out.media.push({ url: json, kind: mediaKindOf(json), label: "Hasil" });
    else if (json.trim()) out.texts.push(json.trim());
    return out;
  }
  if (typeof json !== "object") { out.texts.push(String(json)); return out; }
  const root = json as Record<string, unknown>;
  if (root.status === false || root.success === false || (root.error && !root.result && !root.data)) {
    const e = root.error ?? root.message ?? root.msg ?? root.detail ?? "Provider menolak permintaan";
    return { ...out, ok: false, error: typeof e === "string" ? e : JSON.stringify(e).slice(0, 300) };
  }
  const body = (root.result ?? root.data ?? root) as unknown;
  const bodyObj = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  out.title = (typeof root.title === "string" && root.title) || (bodyObj && typeof bodyObj.title === "string" ? bodyObj.title : undefined) || undefined;
  const tid = root.task_id ?? root.taskId ?? bodyObj?.task_id ?? bodyObj?.taskId;
  if (typeof tid === "string" || typeof tid === "number") out.taskId = String(tid);

  // texts
  if (typeof body === "string" && !isUrl(body)) out.texts.push(body.trim());
  for (const src of [bodyObj, root]) {
    if (!src) continue;
    for (const k of TEXT_KEYS) {
      const v = src[k];
      if (typeof v === "string" && v.trim() && !isUrl(v) && !out.texts.includes(v.trim()) && v.length > 1) out.texts.push(v.trim());
    }
    if (out.texts.length) break;
  }

  // items: first array of objects
  const findArray = (v: unknown, depth: number): unknown[] | null => {
    if (depth > 3 || v == null) return null;
    if (Array.isArray(v)) return v.some((x) => x && typeof x === "object" && !Array.isArray(x)) ? v : null;
    if (typeof v === "object") {
      for (const val of Object.values(v as Record<string, unknown>)) {
        const r = findArray(val, depth + 1);
        if (r) return r;
      }
    }
    return null;
  };
  const arr = findArray(body, 0);
  if (arr) {
    for (const x of arr.slice(0, 50)) {
      if (x && typeof x === "object" && !Array.isArray(x)) {
        const it = toItem(x as Record<string, unknown>);
        if (it) out.items.push(it);
      }
    }
  }

  // media: walk all strings that are URLs
  const seen = new Set<string>();
  let nodes = 0;
  const walk = (v: unknown, key: string, parent: Record<string, unknown> | null, depth: number) => {
    if (nodes++ > 3000 || depth > 7 || out.media.length >= 40) return;
    if (typeof v === "string" && isUrl(v)) {
      const url = v.trim();
      if (seen.has(url)) return;
      const lk = key.toLowerCase();
      if (/(^|_)(author|channel|profile|source|creator|permalink|web|page|share)(_?url)?$/.test(lk) && !/download|video|audio|play/.test(lk)) return;
      seen.add(url);
      const pl = parent ? firstString(parent, ["label", "quality", "format", "type", "resolution", "name"]) : undefined;
      out.media.push({ url, kind: mediaKindOf(url, key), label: pl ? `${pl}` : key || "Hasil" });
      return;
    }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, key || String(i), parent, depth + 1)); return; }
    if (v && typeof v === "object") {
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) walk(val, k, v as Record<string, unknown>, depth + 1);
    }
  };
  walk(body, "", bodyObj, 0);
  if (body !== root) for (const k of ["downloadUrl", "url", "download", "thumbnail", "links", "medias", "raw_data"]) if (k in root) walk(root[k], k, root, 1);

  // When we have list items, item links/thumbnails belong to the list, not to a "download" section.
  if (out.items.length) {
    const itemUrls = new Set(out.items.flatMap((i) => [i.url, i.image].filter(Boolean) as string[]));
    out.media = out.media.filter((m) => !itemUrls.has(m.url));
  }
  // Fallback for objects with provider-specific keys (e.g. primbon `{ nama, arti }`, jadwal sholat
  // `{ lokasi, jadwal: { subuh: "04:16" } }`): show their real scalar fields as "key: value" lines.
  if (!out.texts.length && !out.media.length && !out.items.length && bodyObj) {
    const lines: string[] = [];
    const flat = (o: Record<string, unknown>, prefix: string, depth: number) => {
      for (const [k, v] of Object.entries(o)) {
        if (lines.length >= 40) return;
        const label = prefix ? `${prefix} ${k}` : k;
        if ((typeof v === "string" && v.trim() && !isUrl(v)) || typeof v === "number" || typeof v === "boolean") lines.push(`${label}: ${String(v).trim()}`);
        else if (v && typeof v === "object" && !Array.isArray(v) && depth < 2) flat(v as Record<string, unknown>, depth === 0 ? k : label, depth + 1);
      }
    };
    flat(bodyObj, "", 0);
    if (lines.length) out.texts.push(lines.join("\n"));
  }
  if (!out.texts.length && !out.media.length && !out.items.length && !out.taskId) {
    return { ...out, ok: false, error: "Provider tidak mengembalikan hasil yang bisa ditampilkan" };
  }
  return out;
}

/** Sanitizes a user-provided upload. */
export function checkUpload(file: { name?: string; type?: string; size: number } | null, fieldName: string | null) {
  if (!fieldName) return { ok: true as const };
  if (!file) return { ok: false as const, error: "File wajib diunggah" };
  if (file.size <= 0) return { ok: false as const, error: "File kosong" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false as const, error: "Ukuran file maksimal 5 MB" };
  const t = (file.type || "").toLowerCase();
  if (!/^(image\/(jpeg|png|webp|gif)|audio\/(mpeg|mp4|ogg|wav|x-wav|webm)|video\/(mp4|webm|quicktime))$/.test(t)) {
    return { ok: false as const, error: "Jenis file tidak didukung (gambar, audio, atau video)" };
  }
  return { ok: true as const };
}
