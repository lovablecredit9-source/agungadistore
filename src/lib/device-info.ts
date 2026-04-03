type StoredDeviceInfo = {
  type?: string;
  source?: "ua-data" | "reduced-ua" | "ua";
  device?: string;
  os?: string;
  browser?: string;
  ua?: string;
  model?: string;
  platform?: string;
  platformVersion?: string;
  brands?: Array<{ brand?: string; version?: string }>;
  mobile?: boolean;
};

function isReducedAndroidUA(ua: string): boolean {
  return /Android 10; K/.test(ua);
}

function parseBrowserFromUA(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung Browser";
  if (/Chrome\//.test(ua) && !/Edg/.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
  return "Unknown";
}

function pickBrowserBrand(brands: Array<{ brand?: string; version?: string }> = []): string {
  const realBrand = brands.find((item) => {
    const brand = item.brand || "";
    return brand && !brand.startsWith("Not") && brand !== "Chromium";
  });

  return realBrand?.brand || "";
}

function formatOS(platform: string, platformVersion: string): string {
  if (!platform) return "Unknown";

  if (platform === "Android") {
    return platformVersion ? `Android ${platformVersion}` : "Android";
  }

  if (platform === "Windows") {
    const major = Number.parseInt(platformVersion.split(".")[0] || "0", 10);
    if (major >= 13) return "Windows 11";
    if (major > 0) return "Windows 10";
    return "Windows";
  }

  if (platform === "iOS") {
    return platformVersion ? `iOS ${platformVersion}` : "iOS";
  }

  if (platform === "macOS") {
    return platformVersion ? `macOS ${platformVersion}` : "macOS";
  }

  return platformVersion ? `${platform} ${platformVersion}` : platform;
}

function parseDeviceInfoFromUA(ua: string): { device: string; os: string; browser: string } {
  let device = "Unknown";
  let os = "Unknown";

  if (/Android (\d+(\.\d+)?)/.test(ua)) {
    const version = ua.match(/Android (\d+(\.\d+)?)/)?.[1] || "";
    os = version ? `Android ${version}` : "Android";
  } else if (/iPhone|iPad/.test(ua)) {
    const version = ua.match(/OS (\d+[_\d]*)/)?.[1]?.replace(/_/g, ".") || "";
    os = version ? `iOS ${version}` : "iOS";
  } else if (/Windows NT/.test(ua)) {
    os = "Windows";
  } else if (/Mac OS X/.test(ua)) {
    os = "macOS";
  } else if (/Linux/.test(ua)) {
    os = "Linux";
  }

  if (/iPhone/.test(ua)) {
    device = "iPhone";
  } else if (/iPad/.test(ua)) {
    device = "iPad";
  } else if (/Tablet/.test(ua)) {
    device = "Tablet";
  } else if (/Mobile|Android/.test(ua)) {
    const model = ua.match(/;\s*([^;)]+)\s*Build/)?.[1]?.trim();
    if (model && model.length > 1 && model !== "K" && !/^Linux/i.test(model)) {
      device = model;
    } else {
      device = "Smartphone";
    }
  } else {
    device = "Desktop/Laptop";
  }

  return { device, os, browser: parseBrowserFromUA(ua) };
}

function serializeStoredInfo(data: StoredDeviceInfo): string {
  return JSON.stringify({ type: "device-info-v2", ...data });
}

export async function collectDeviceInfo(): Promise<{
  device: string;
  os: string;
  browser: string;
  raw: string;
}> {
  const ua = navigator.userAgent || "";
  const uaData = (navigator as Navigator & {
    userAgentData?: {
      mobile?: boolean;
      brands?: Array<{ brand?: string; version?: string }>;
      platform?: string;
      getHighEntropyValues?: (hints: string[]) => Promise<Record<string, unknown>>;
    };
  }).userAgentData;

  if (uaData?.getHighEntropyValues) {
    try {
      const hints = await uaData.getHighEntropyValues([
        "model",
        "platform",
        "platformVersion",
        "fullVersionList",
      ]);

      const model = typeof hints.model === "string" ? hints.model.trim() : "";
      const platform = typeof hints.platform === "string" ? hints.platform : uaData.platform || "Unknown";
      const platformVersion = typeof hints.platformVersion === "string" ? hints.platformVersion : "";
      const fullVersionList = Array.isArray(hints.fullVersionList)
        ? (hints.fullVersionList as Array<{ brand?: string; version?: string }>)
        : uaData.brands || [];

      const browser = pickBrowserBrand(fullVersionList) || parseBrowserFromUA(ua);
      const os = formatOS(platform, platformVersion);
      const device = uaData.mobile ? (model || "Smartphone") : "Desktop/Laptop";

      return {
        device,
        os,
        browser,
        raw: serializeStoredInfo({
          source: "ua-data",
          device,
          os,
          browser,
          ua,
          model,
          platform,
          platformVersion,
          brands: fullVersionList,
          mobile: Boolean(uaData.mobile),
        }),
      };
    } catch {
      // fallback below
    }
  }

  const parsed = parseDeviceInfoFromUA(ua);
  const reduced = isReducedAndroidUA(ua);

  return {
    device: reduced ? "Model HP tidak tersedia" : parsed.device,
    os: reduced ? "Android (disamarkan browser)" : parsed.os,
    browser: parsed.browser,
    raw: serializeStoredInfo({
      source: reduced ? "reduced-ua" : "ua",
      device: reduced ? "Model HP tidak tersedia" : parsed.device,
      os: reduced ? "Android (disamarkan browser)" : parsed.os,
      browser: parsed.browser,
      ua,
    }),
  };
}

export function parseDeviceInfo(stored: string): { device: string; os: string; browser: string } {
  try {
    const parsed = JSON.parse(stored) as StoredDeviceInfo;

    if (parsed?.type === "device-info-v2") {
      return {
        device: parsed.device || "Unknown",
        os: parsed.os || "Unknown",
        browser: parsed.browser || (parsed.ua ? parseBrowserFromUA(parsed.ua) : "Unknown"),
      };
    }

    if (parsed && (parsed.model !== undefined || parsed.platform !== undefined)) {
      const browser = pickBrowserBrand(parsed.brands) || (parsed.ua ? parseBrowserFromUA(parsed.ua) : "Unknown");
      const os = formatOS(parsed.platform || "Unknown", parsed.platformVersion || "");
      const reduced = parsed.ua ? isReducedAndroidUA(parsed.ua) : false;

      return {
        device: parsed.model?.trim() || (parsed.mobile ? (reduced ? "Model HP tidak tersedia" : "Smartphone") : "Desktop/Laptop"),
        os: reduced ? "Android (disamarkan browser)" : os,
        browser,
      };
    }
  } catch {
    // raw UA string fallback below
  }

  if (isReducedAndroidUA(stored)) {
    return {
      device: "Model HP tidak tersedia",
      os: "Android (disamarkan browser)",
      browser: parseBrowserFromUA(stored),
    };
  }

  return parseDeviceInfoFromUA(stored);
}

export function getDeviceSummary(stored: string): string {
  const { device, os, browser } = parseDeviceInfo(stored);
  return `${browser} • ${os} • ${device}`;
}
