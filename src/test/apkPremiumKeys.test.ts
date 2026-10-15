import { describe, it, expect } from "vitest";
import {
  classifyFailure, runWithRotation, parseLimitFromMessage, parseQuotaHeaders, keyView, summarize, nextResetWib, maskKey,
  MAX_KEY_ATTEMPTS, type CallOutcome, type KeyRow, type PickedKey, type FailureKind,
} from "../../supabase/functions/_shared/apk-premium-keys";

const NOW = new Date("2026-10-15T12:00:00Z"); // 19:00 WIB
const QUOTA_429: CallOutcome = { httpStatus: 429, providerMessage: "Kuota harian habis. Limit 120 request/hari untuk plan free.", error: "Provider error HTTP 429: Kuota harian habis. Limit 120 request/hari untuk plan free." };
const OK: CallOutcome = { httpStatus: 200 };

/** In-memory model of the DB pick function: enabled, not invalid, not exhausted, not excluded; ordered by priority. */
function makePool(keys: { id: string; enabled?: boolean; responds: CallOutcome }[]) {
  const state = keys.map((k) => ({ ...k, enabled: k.enabled !== false, exhausted: false, invalid: false, calls: 0 }));
  const run = () =>
    runWithRotation<CallOutcome>({
      pick: async (exclude) => {
        const k = state.find((s) => s.enabled && !s.exhausted && !s.invalid && !exclude.includes(s.id));
        return k ? { id: k.id, label: k.id } : null;
      },
      call: async (key: PickedKey) => { const s = state.find((x) => x.id === key.id)!; s.calls++; return s.responds; },
      report: async (key, kind: FailureKind | null) => {
        const s = state.find((x) => x.id === key.id)!;
        if (kind === "quota") s.exhausted = true;
        if (kind === "invalid") s.invalid = true;
      },
    });
  return { state, run };
}

describe("classifyFailure", () => {
  it("treats the provider's 429 'Kuota harian habis' as quota", () => expect(classifyFailure(QUOTA_429)).toBe("quota"));
  it("treats 401 as invalid key", () => expect(classifyFailure({ httpStatus: 401, error: "x" })).toBe("invalid"));
  it("treats 403 'apikey tidak valid' as invalid", () => expect(classifyFailure({ httpStatus: 403, providerMessage: "Apikey tidak valid", error: "e" })).toBe("invalid"));
  it("does not treat feature-level 403 'Akses Ditolak' as invalid or quota", () => expect(classifyFailure({ httpStatus: 403, providerMessage: "Akses Ditolak", error: "e" })).toBe("other"));
  it("does not treat provider 5xx / Cloudflare 522 / timeout as quota", () => {
    expect(classifyFailure({ httpStatus: 500, error: "e" })).toBe("other");
    expect(classifyFailure({ httpStatus: 522, error: "e" })).toBe("provider_down");
    expect(classifyFailure({ httpStatus: null, error: "timeout" })).toBe("network");
  });
  it("success is not a failure", () => expect(classifyFailure(OK)).toBeNull());
});

describe("rotation", () => {
  it("1. one active key with quota is used once", async () => {
    const p = makePool([{ id: "k1", responds: OK }]);
    const r = await p.run();
    expect(r.reason).toBe("ok"); expect(r.key?.id).toBe("k1"); expect(r.attempts).toBe(1);
  });
  it("2. first key exhausted -> second key", async () => {
    const p = makePool([{ id: "k1", responds: QUOTA_429 }, { id: "k2", responds: OK }]);
    const r = await p.run();
    expect(r.key?.id).toBe("k2"); expect(r.attempts).toBe(2); expect(p.state[0].exhausted).toBe(true);
  });
  it("3. first two exhausted -> third key", async () => {
    const p = makePool([{ id: "k1", responds: QUOTA_429 }, { id: "k2", responds: QUOTA_429 }, { id: "k3", responds: OK }]);
    const r = await p.run();
    expect(r.key?.id).toBe("k3"); expect(r.attempts).toBe(3);
  });
  it("4. all keys exhausted -> all_exhausted, and later requests do not call the provider again", async () => {
    const p = makePool([{ id: "k1", responds: QUOTA_429 }, { id: "k2", responds: QUOTA_429 }]);
    expect((await p.run()).reason).toBe("all_exhausted");
    const again = await p.run();
    expect(again.reason).toBe("no_keys"); expect(again.attempts).toBe(0);
    expect(p.state.map((s) => s.calls)).toEqual([1, 1]);
  });
  it("5. disabled key is skipped even with quota", async () => {
    const p = makePool([{ id: "k1", enabled: false, responds: OK }, { id: "k2", responds: OK }]);
    expect((await p.run()).key?.id).toBe("k2"); expect(p.state[0].calls).toBe(0);
  });
  it("6. re-enabled key is used again in priority order", async () => {
    const p = makePool([{ id: "k1", enabled: false, responds: OK }, { id: "k2", responds: OK }]);
    await p.run();
    p.state[0].enabled = true;
    expect((await p.run()).key?.id).toBe("k1");
  });
  it("invalid key moves on and mixed failures report all_unusable", async () => {
    const p = makePool([{ id: "k1", responds: { httpStatus: 401, error: "x" } }, { id: "k2", responds: QUOTA_429 }]);
    const r = await p.run();
    expect(r.reason).toBe("all_unusable"); expect(p.state[0].invalid).toBe(true);
  });
  it("provider error / timeout is returned without trying another key (no repeat of a possibly-run operation)", async () => {
    for (const resp of [{ httpStatus: 500, error: "e" }, { httpStatus: null, error: "timeout" }, { httpStatus: 522, error: "down" }]) {
      const p = makePool([{ id: "k1", responds: resp }, { id: "k2", responds: OK }]);
      const r = await p.run();
      expect(r.reason).toBe("failed"); expect(r.attempts).toBe(1); expect(p.state[1].calls).toBe(0);
    }
  });
  it("attempts are bounded even if every key keeps failing", async () => {
    const p = makePool(Array.from({ length: 12 }, (_, i) => ({ id: `k${i}`, responds: QUOTA_429 })));
    const r = await p.run();
    expect(r.attempts).toBe(MAX_KEY_ATTEMPTS);
    expect(p.state.reduce((s, x) => s + x.calls, 0)).toBe(MAX_KEY_ATTEMPTS);
  });
  it("11. concurrent requests: once a key is marked exhausted no request picks it, and none loops", async () => {
    const p = makePool([{ id: "k1", responds: QUOTA_429 }, { id: "k2", responds: OK }]);
    const rs = await Promise.all(Array.from({ length: 6 }, () => p.run()));
    expect(rs.every((r) => r.key?.id === "k2" && r.attempts <= 2)).toBe(true);
    expect(p.state[0].calls).toBeLessThanOrEqual(6);
    const later = await p.run();
    expect(later.attempts).toBe(1); expect(later.key?.id).toBe("k2");
  });
});

describe("quota parsing", () => {
  it("reads limit 120 from the provider message", () => expect(parseLimitFromMessage(QUOTA_429.providerMessage)).toBe(120));
  it("returns null when no limit in message", () => expect(parseLimitFromMessage("Akses Ditolak")).toBeNull());
  it("reads explicit daily quota headers only when present", () => {
    const h: Record<string, string> = { "x-quota-limit": "120", "x-quota-remaining": "37" };
    expect(parseQuotaHeaders((n) => h[n] ?? null)).toEqual({ limit: 120, remaining: 37 });
  });
  it("ignores the provider's per-minute x-ratelimit headers (they are not the daily quota)", () => {
    const h: Record<string, string> = { "x-ratelimit-limit": "60", "x-ratelimit-remaining": "59" };
    expect(parseQuotaHeaders((n) => h[n] ?? null)).toEqual({ limit: null, remaining: null });
    expect(parseQuotaHeaders(() => null)).toEqual({ limit: null, remaining: null });
  });
  it("next reset is 00:00 WIB", () => expect(nextResetWib(NOW).toISOString()).toBe("2026-10-15T17:00:00.000Z"));
  it("masks keys", () => expect(maskKey("a81x")).toBe("••••••••a81x"));
});

const base = (o: Partial<KeyRow>): KeyRow => ({
  id: "x", label: "K", key_last4: "abcd", enabled: true, priority: 1, status: "ok", status_message: null,
  quota_limit: null, quota_limit_source: null, quota_remaining: null, quota_remaining_source: null, quota_checked_at: null,
  exhausted_until: null, used_day: "2026-10-15", used_today: 0, total_used: 0, last_used_at: null, last_error_at: null, created_at: "2026-10-01T00:00:00Z", ...o,
});
const hdr = (remaining: number, limit = 120) => base({ quota_limit: limit, quota_limit_source: "provider_header", quota_remaining: remaining, quota_remaining_source: "provider_header", quota_checked_at: NOW.toISOString() });

describe("9. colour and percentage", () => {
  it("green at >=70%", () => { const v = keyView(hdr(84), NOW); expect(v.pct).toBe(70); expect(v.color).toBe("green"); });
  it("yellow below 70% and above 0", () => { const v = keyView(hdr(83), NOW); expect(v.pct).toBe(69); expect(v.color).toBe("yellow"); });
  it("red when provider says exhausted", () => {
    const v = keyView(base({ status: "exhausted", exhausted_until: "2026-10-15T17:00:00Z", quota_limit: 120 }), NOW);
    expect(v.color).toBe("red"); expect(v.remaining).toBe(0); expect(v.state).toBe("exhausted"); expect(v.usable).toBe(false);
  });
  it("grey when disabled", () => expect(keyView(base({ enabled: false, quota_limit: 120 }), NOW).color).toBe("grey"));
  it("grey and unknown (not 120) when quota is unknown", () => {
    const v = keyView(base({ status: "unknown" }), NOW);
    expect(v.color).toBe("grey"); expect(v.remaining).toBeNull(); expect(v.pct).toBeNull(); expect(v.limit).toBeNull();
  });
  it("error colour for invalid key", () => { const v = keyView(base({ status: "invalid" }), NOW); expect(v.color).toBe("error"); expect(v.usable).toBe(false); });
  it("internal estimate = limit - used today, labelled estimate", () => {
    const v = keyView(base({ quota_limit: 120, quota_limit_source: "provider_message", used_today: 30 }), NOW);
    expect(v.remaining).toBe(90); expect(v.remainingSource).toBe("estimate"); expect(v.pct).toBe(75);
  });
  it("used_today from a previous WIB day counts as 0", () => expect(keyView(base({ quota_limit: 120, used_day: "2026-10-14", used_today: 100 }), NOW).remaining).toBe(120));
  it("exhaustion expires after reset", () => expect(keyView(base({ exhausted_until: "2026-10-15T11:00:00Z" }), NOW).usable).toBe(true));
});

describe("8. summary total of active known quota", () => {
  const k1 = { ...hdr(20), id: "1" }, k2 = { ...hdr(120), id: "2" }, k3 = { ...hdr(60), id: "3" };
  it("20 + 120 + 60 = 200", () => expect(summarize([k1, k2, k3], NOW).activeRemaining).toBe(200));
  it("disabling key 2 gives 80, re-enabling gives 200 again", () => {
    expect(summarize([k1, { ...k2, enabled: false }, k3], NOW).activeRemaining).toBe(80);
    expect(summarize([k1, k2, k3], NOW).activeRemaining).toBe(200);
  });
  it("keys with unknown quota are excluded and counted separately", () => {
    const s = summarize([k1, { ...base({ status: "unknown" }), id: "4" }], NOW);
    expect(s.activeRemaining).toBe(20); expect(s.activeRemainingKnownKeys).toBe(1); expect(s.enabled).toBe(2);
  });
  it("no known quota -> null, not 0", () => expect(summarize([base({ status: "unknown" })], NOW).activeRemaining).toBeNull());
  it("counts exhausted and usable", () => {
    const s = summarize([k1, { ...base({ exhausted_until: "2026-10-15T17:00:00Z" }), id: "5" }], NOW);
    expect(s.usable).toBe(1); expect(s.exhausted).toBe(1);
  });
});
