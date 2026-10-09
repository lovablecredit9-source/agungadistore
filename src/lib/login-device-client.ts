// Client-reported device details sent with each login. The server re-parses and sanitizes them
// (supabase/functions/_shared/login-device.ts) and takes the IP from request headers, never from here.

export type LoginDeviceDetails = {
  ua: string;
  model?: string;
  platform?: string;
  platformVersion?: string;
  browserName?: string;
  browserVersion?: string;
  networkType?: string;
};

type UAData = {
  brands?: Array<{ brand?: string; version?: string }>;
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
};

let cached: LoginDeviceDetails | null = null;

function pickBrand(list: Array<{ brand?: string; version?: string }> = []) {
  return list.find((b) => b.brand && !/^Not/i.test(b.brand) && b.brand !== "Chromium") || null;
}

/** Synchronous best-effort snapshot (UA + last high-entropy result once primed). */
export function loginDeviceDetails(): LoginDeviceDetails {
  const conn = (navigator as Navigator & { connection?: { type?: string } }).connection;
  const base = cached ?? { ua: navigator.userAgent };
  return { ...base, ua: navigator.userAgent.slice(0, 400), networkType: conn?.type || undefined };
}

/** Prime high-entropy Client Hints (model, Android version, full browser version). Safe to call often. */
export async function primeLoginDeviceDetails(): Promise<LoginDeviceDetails> {
  const uaData = (navigator as Navigator & { userAgentData?: UAData }).userAgentData;
  const next: LoginDeviceDetails = { ua: navigator.userAgent.slice(0, 400) };
  if (uaData?.getHighEntropyValues) {
    try {
      const h = await uaData.getHighEntropyValues(["model", "platform", "platformVersion", "fullVersionList"]);
      if (typeof h.model === "string" && h.model.trim()) next.model = h.model.trim();
      if (typeof h.platform === "string") next.platform = h.platform;
      if (typeof h.platformVersion === "string" && h.platformVersion) next.platformVersion = h.platformVersion;
      const b = pickBrand(Array.isArray(h.fullVersionList) ? (h.fullVersionList as Array<{ brand?: string; version?: string }>) : uaData.brands);
      if (b?.brand) { next.browserName = b.brand; next.browserVersion = b.version; }
    } catch { /* hints not granted: server falls back to UA parsing */ }
  }
  cached = next;
  return loginDeviceDetails();
}
