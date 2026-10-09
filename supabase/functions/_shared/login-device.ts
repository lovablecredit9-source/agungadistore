// Login-history device record rules, shared by the balance-auth edge function and Vitest.
// IP comes ONLY from request headers (server). Device/OS/browser/network are client-reported:
// shown to the owner as information, never used as a security decision.

export type ClientDeviceDetails = {
  model?: unknown;
  platform?: unknown;
  platformVersion?: unknown;
  browserName?: unknown;
  browserVersion?: unknown;
  networkType?: unknown;
  ua?: unknown;
};

export type LoginDeviceFields = {
  device_brand: string | null;
  device_model: string | null;
  os_name: string | null;
  os_version: string | null;
  browser_name: string | null;
  browser_version: string | null;
  network_type: string | null;
  user_agent: string | null;
};

const clean = (v: unknown, max = 60): string | null => {
  if (typeof v !== "string") return null;
  // eslint-disable-next-line no-control-regex -- strip control characters from client input
  const s = v.replace(/[\u0000-\u001f<>]/g, "").trim();
  return s ? s.slice(0, max) : null;
};

/** First public-looking IP from proxy headers; null when the server cannot tell. */
export function serverIpFromHeaders(headers: Headers): string | null {
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = fwd || headers.get("cf-connecting-ip")?.trim() || headers.get("x-real-ip")?.trim() || "";
  return /^[0-9a-fA-F:.]{3,45}$/.test(ip) ? ip : null;
}

const BRAND_PREFIXES: Array<[RegExp, string]> = [
  [/^(SM-|SAMSUNG|GALAXY)/i, "Samsung"],
  [/^(CPH|OPPO|PH[A-Z]\d)/i, "OPPO"],
  [/^(RMX|REALME)/i, "Realme"],
  [/^(REDMI|POCO|MI |XIAOMI|2\d{3}[A-Z0-9]{4,})/i, "Xiaomi"],
  [/^(VIVO|V\d{4})/i, "Vivo"],
  [/^(INFINIX|X6\d{2})/i, "Infinix"],
  [/^TECNO/i, "Tecno"],
  [/^PIXEL/i, "Google"],
  [/^(MOTO|XT\d)/i, "Motorola"],
  [/^NOKIA/i, "Nokia"],
  [/^(ASUS|ASUS_)/i, "ASUS"],
  [/^(HUAWEI|VOG-|ELE-|MAR-)/i, "Huawei"],
  [/^(ONEPLUS|CPH25|IN20|LE21)/i, "OnePlus"],
  [/^IPHONE/i, "Apple"],
  [/^IPAD/i, "Apple"],
];

/** Brand only when the model prefix is a known manufacturer code; otherwise null (no guessing). */
export function brandFromModel(model: string | null): string | null {
  if (!model) return null;
  for (const [re, brand] of BRAND_PREFIXES) if (re.test(model)) return brand;
  return null;
}

/** Parse a user-agent string. Fields stay null when the UA does not contain them. */
export function parseUserAgent(ua: string | null): Omit<LoginDeviceFields, "network_type" | "user_agent"> {
  const out = { device_brand: null, device_model: null, os_name: null, os_version: null, browser_name: null, browser_version: null } as Omit<LoginDeviceFields, "network_type" | "user_agent">;
  if (!ua) return out;

  const android = ua.match(/Android\s([\d.]+)/);
  const ios = ua.match(/(?:iPhone|iPad|iPod).*?OS\s([\d_]+)/);
  if (android) { out.os_name = "Android"; out.os_version = android[1]; }
  else if (ios) { out.os_name = "iOS"; out.os_version = ios[1].replace(/_/g, "."); }
  else if (/Windows NT/.test(ua)) out.os_name = "Windows";
  else if (/Mac OS X/.test(ua)) out.os_name = "macOS";
  else if (/CrOS/.test(ua)) out.os_name = "ChromeOS";
  else if (/Linux/.test(ua)) out.os_name = "Linux";

  // "Android 10; K" is Chrome's reduced UA: model hidden, version frozen -> not trustworthy.
  if (/Android 10; K[;)]/.test(ua)) { out.os_version = null; }
  else {
    const model = ua.match(/Android[^;]*;\s*([^;)]+?)(?:\s+Build\/|\))/)?.[1]?.trim();
    if (model && model.length > 1 && !/^(wv|Linux|U|K)$/i.test(model)) out.device_model = model;
  }
  if (/iPhone/.test(ua)) out.device_model = "iPhone";
  else if (/iPad/.test(ua)) out.device_model = "iPad";
  out.device_brand = brandFromModel(out.device_model);

  const browsers: Array<[RegExp, string]> = [
    [/EdgA?\/([\d.]+)/, "Edge"],
    [/OPR\/([\d.]+)/, "Opera"],
    [/SamsungBrowser\/([\d.]+)/, "Samsung Internet"],
    [/FxiOS\/([\d.]+)/, "Firefox"],
    [/CriOS\/([\d.]+)/, "Chrome"],
    [/Firefox\/([\d.]+)/, "Firefox"],
    [/Chrome\/([\d.]+)/, "Chrome"],
    [/Version\/([\d.]+).*Safari/, "Safari"],
  ];
  for (const [re, name] of browsers) {
    const m = ua.match(re);
    if (m) {
      out.browser_name = name + (/Mobile/.test(ua) && name !== "Samsung Internet" ? " Mobile" : "");
      out.browser_version = m[1].split(".")[0];
      break;
    }
  }
  return out;
}

const NETWORK_TYPES = new Set(["wifi", "cellular", "ethernet", "bluetooth", "wimax", "other", "none"]);

/** Merge UA parsing with optional Client Hints details (high-entropy model/platform version). */
export function buildDeviceFields(details: ClientDeviceDetails | null | undefined, fallbackUa: string | null): LoginDeviceFields {
  const ua = clean(details?.ua, 400) ?? clean(fallbackUa, 400);
  const fromUa = parseUserAgent(ua);
  const hintModel = clean(details?.model);
  const platform = clean(details?.platform, 20);
  const platformVersion = clean(details?.platformVersion, 20);
  const model = hintModel ?? fromUa.device_model;
  let osName = fromUa.os_name;
  let osVersion = fromUa.os_version;
  if (platform === "Android" && platformVersion) { osName = "Android"; osVersion = platformVersion.split(".")[0]; }
  if (platform === "Windows" && platformVersion) {
    const major = Number.parseInt(platformVersion.split(".")[0] || "0", 10);
    osName = "Windows"; osVersion = major >= 13 ? "11" : major > 0 ? "10" : null;
  }
  const net = clean(details?.networkType, 12)?.toLowerCase() ?? null;
  return {
    device_brand: brandFromModel(model),
    device_model: model,
    os_name: osName,
    os_version: osVersion,
    browser_name: clean(details?.browserName, 30) ?? fromUa.browser_name,
    browser_version: clean(details?.browserVersion, 12)?.split(".")[0] ?? fromUa.browser_version,
    network_type: net && NETWORK_TYPES.has(net) ? net : null,
    user_agent: ua,
  };
}

/** Allowed history filters, clamped server-side. */
export function normalizeHistoryQuery(q: { days?: unknown; limit?: unknown; before?: unknown; scope?: unknown }) {
  const days = [7, 30, 90].includes(Number(q.days)) ? Number(q.days) : 30;
  const limit = Math.min(Math.max(Number(q.limit) || 10, 1), 30);
  const before = typeof q.before === "string" && !Number.isNaN(Date.parse(q.before)) ? new Date(q.before).toISOString() : null;
  const scope = q.scope === "this" || q.scope === "other" ? q.scope : "all";
  return { days, limit, before, scope } as const;
}
