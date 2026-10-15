// APK PREMIUM multi-key rules shared by the `apk-premium` edge function and Vitest.
// Pure functions only: failure classification, quota parsing, colour/percentage view, summary and the rotation loop.

export const MAX_KEY_ATTEMPTS = 5;
const WIB_OFFSET_MS = 7 * 3600_000;

export type FailureKind = "quota" | "rate" | "invalid" | "provider_down" | "network" | "other";

export type CallOutcome = {
  httpStatus: number | null;
  error?: string;
  /** Raw provider message (before our Indonesian wrapping), used for classification. */
  providerMessage?: string;
  quotaHeaders?: { limit: number | null; remaining: number | null };
};

const QUOTA_RE = /kuota|quota|limit|credit|kredit|habis|exceed|exhausted/i;
const KEYWORD_RE = /api\s*_?key|apikey|token|kunci/i;
const INVALID_RE = /invalid|tidak\s+valid|salah|not\s+found|tidak\s+ditemukan|expired|kadaluarsa|kedaluwarsa|unauthori[sz]ed|login|wajib|required|missing|diblokir|banned|suspend/i;
const DOWN = new Set([502, 503, 504, 520, 521, 522, 523, 524, 525, 526]);

/** Decide why a provider call failed. Only "quota", "rate" and "invalid" are safe to retry with another key
 *  (the provider rejected the request before running it). */
export function classifyFailure(o: CallOutcome): FailureKind | null {
  if (!o.error) return null;
  const s = o.httpStatus;
  const msg = `${o.providerMessage ?? ""} ${o.error}`;
  if (s == null) return "network";
  if (DOWN.has(s)) return "provider_down";
  if (s === 429 || s === 402) return QUOTA_RE.test(msg) ? "quota" : "rate";
  if (s === 401) return "invalid";
  if (s === 403 && KEYWORD_RE.test(msg) && INVALID_RE.test(msg)) return "invalid";
  if (s === 403 && KEYWORD_RE.test(msg) && QUOTA_RE.test(msg)) return "quota";
  return "other";
}

export const isRotatable = (k: FailureKind | null) => k === "quota" || k === "rate" || k === "invalid";

/** "Kuota harian habis. Limit 120 request/hari ..." -> 120 */
export function parseLimitFromMessage(msg: string | undefined | null): number | null {
  const m = /limit\s*:?\s*(\d{1,7})/i.exec(msg || "");
  return m ? Number(m[1]) : null;
}

/** Reads explicit daily-quota headers if the provider sends them; returns nulls otherwise (never invents numbers).
 *  The generic `x-ratelimit-*` headers JereAPI sends are an IP-level 60/minute limiter (present even for invalid
 *  keys), not the per-key daily quota, so they are deliberately ignored. */
export function parseQuotaHeaders(get: (name: string) => string | null): { limit: number | null; remaining: number | null } {
  const num = (names: string[]) => {
    for (const n of names) {
      const v = get(n);
      if (v != null && /^\d+$/.test(v.trim())) return Number(v.trim());
    }
    return null;
  };
  return {
    limit: num(["x-quota-limit", "x-ratelimit-limit-day", "x-daily-limit"]),
    remaining: num(["x-quota-remaining", "x-ratelimit-remaining-day", "x-daily-remaining"]),
  };
}

export function wibDate(now: Date): string {
  return new Date(now.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Next 00:00 WIB. The provider says the quota is per day; its exact reset time is not documented. */
export function nextResetWib(now: Date): Date {
  const d = wibDate(now);
  return new Date(Date.parse(`${d}T00:00:00Z`) - WIB_OFFSET_MS + 86_400_000);
}

export type KeyRow = {
  id: string; label: string; key_last4: string; enabled: boolean; priority: number; status: string; status_message: string | null;
  quota_limit: number | null; quota_limit_source: string | null; quota_remaining: number | null; quota_remaining_source: string | null;
  quota_checked_at: string | null; exhausted_until: string | null; used_day: string | null; used_today: number; total_used: number;
  last_used_at: string | null; last_error_at: string | null; created_at: string;
};

export type KeyColor = "green" | "yellow" | "red" | "grey" | "error";
export type KeyView = {
  state: "disabled" | "invalid" | "exhausted" | "ok" | "unknown" | "error";
  usable: boolean;
  usedToday: number;
  limit: number | null;
  remaining: number | null;
  remainingSource: "provider" | "estimate" | null;
  pct: number | null;
  color: KeyColor;
  label: string;
};

export function keyView(k: KeyRow, now: Date): KeyView {
  const today = wibDate(now);
  const usedToday = k.used_day === today ? k.used_today : 0;
  const exhausted = !!k.exhausted_until && Date.parse(k.exhausted_until) > now.getTime();
  const limit = k.quota_limit ?? null;
  let remaining: number | null = null;
  let remainingSource: KeyView["remainingSource"] = null;
  const checkedToday = !!k.quota_checked_at && wibDate(new Date(k.quota_checked_at)) === today;
  if (exhausted) { remaining = 0; remainingSource = "provider"; }
  else if (k.quota_remaining != null && k.quota_remaining_source === "provider_header" && checkedToday) { remaining = k.quota_remaining; remainingSource = "provider"; }
  else if (limit != null) { remaining = Math.max(0, limit - usedToday); remainingSource = "estimate"; }
  if (k.status === "invalid") { remaining = null; remainingSource = null; }
  const pct = k.status === "invalid" ? null : limit && remaining != null ? Math.max(0, Math.min(100, Math.round((remaining / limit) * 100))) : exhausted ? 0 : null;

  let state: KeyView["state"];
  if (!k.enabled) state = "disabled";
  else if (k.status === "invalid") state = "invalid";
  else if (exhausted || (remaining === 0 && remainingSource === "provider")) state = "exhausted";
  else if (k.status === "error") state = "error";
  else if (k.status === "ok") state = "ok";
  else state = "unknown";

  let color: KeyColor;
  if (state === "disabled") color = "grey";
  else if (state === "invalid") color = "error";
  else if (state === "exhausted") color = "red";
  else if (pct == null) color = "grey";
  else color = pct >= 70 ? "green" : pct > 0 ? "yellow" : "red";

  const label = state === "disabled" ? "Nonaktif" : state === "invalid" ? "Key tidak valid" : state === "exhausted" ? "Kuota habis"
    : state === "error" ? "Error terakhir" : state === "ok" ? (pct == null ? "Aktif • kuota belum diketahui" : "Aktif") : "Belum diperiksa";
  // A key whose estimated remaining is 0 may still work (estimate only counts this website's calls), so only
  // provider-confirmed exhaustion and invalid status block selection.
  const usable = k.enabled && k.status !== "invalid" && !exhausted;
  return { state, usable, usedToday, limit, remaining, remainingSource, pct, color, label };
}

export function summarize(keys: KeyRow[], now: Date) {
  const views = keys.map((k) => ({ k, v: keyView(k, now) }));
  const active = views.filter((x) => x.k.enabled);
  const known = active.filter((x) => x.v.remaining != null);
  return {
    total: keys.length,
    enabled: active.length,
    usable: views.filter((x) => x.v.usable).length,
    exhausted: views.filter((x) => x.v.state === "exhausted").length,
    invalid: views.filter((x) => x.v.state === "invalid").length,
    activeRemaining: known.length ? known.reduce((s, x) => s + (x.v.remaining ?? 0), 0) : null,
    activeRemainingKnownKeys: known.length,
    activeRemainingFromProviderOnly: known.every((x) => x.v.remainingSource === "provider"),
    usedToday: views.reduce((s, x) => s + x.v.usedToday, 0),
  };
}

export function maskKey(last4: string) {
  return `••••••••${last4}`;
}

// ---- rotation loop ----
export type PickedKey = { id: string; label: string };
export type RotationResult<R> = {
  result: R | null;
  key: PickedKey | null;
  attempts: number;
  failures: { keyId: string; kind: FailureKind }[];
  reason: "ok" | "no_keys" | "all_exhausted" | "all_unusable" | "failed";
};

/** Try keys one by one. Only moves on when the provider clearly rejected the request because of the key
 *  (quota / rate / invalid). Any other outcome (success, provider error, timeout) is returned as-is, so an
 *  operation that may have run is never repeated. Bounded by `maxAttempts`. */
export async function runWithRotation<R extends CallOutcome>(o: {
  maxAttempts?: number;
  pick: (exclude: string[]) => Promise<PickedKey | null>;
  call: (key: PickedKey) => Promise<R>;
  report: (key: PickedKey, kind: FailureKind | null, r: R) => Promise<void>;
}): Promise<RotationResult<R>> {
  const max = Math.max(1, Math.min(o.maxAttempts ?? MAX_KEY_ATTEMPTS, 20));
  const tried: string[] = [];
  const failures: RotationResult<R>["failures"] = [];
  let last: R | null = null;
  let lastKey: PickedKey | null = null;
  for (let i = 0; i < max; i++) {
    const key = await o.pick(tried);
    if (!key || tried.includes(key.id)) break;
    tried.push(key.id);
    const r = await o.call(key);
    const kind = classifyFailure(r);
    await o.report(key, kind, r);
    last = r; lastKey = key;
    if (isRotatable(kind)) { failures.push({ keyId: key.id, kind: kind! }); continue; }
    return { result: r, key, attempts: tried.length, failures, reason: kind ? "failed" : "ok" };
  }
  if (!tried.length) return { result: null, key: null, attempts: 0, failures, reason: "no_keys" };
  const reason = failures.length && failures.every((f) => f.kind === "quota") ? "all_exhausted" : "all_unusable";
  return { result: last, key: lastKey, attempts: tried.length, failures, reason };
}
