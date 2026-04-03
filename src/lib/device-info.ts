// Collect device info using modern API + fallback
export async function collectDeviceInfo(): Promise<{
  device: string;
  os: string;
  browser: string;
  raw: string;
}> {
  const ua = navigator.userAgent;

  // Try modern API first (Chrome/Edge 90+)
  if ("userAgentData" in navigator && (navigator as any).userAgentData) {
    try {
      const uaData = (navigator as any).userAgentData;
      const hints = await uaData.getHighEntropyValues([
        "model",
        "platform",
        "platformVersion",
        "fullVersionList",
      ]);

      const platform = hints.platform || uaData.platform || "Unknown";
      const platformVersion = hints.platformVersion || "";
      const model = hints.model || "";

      // OS
      let os = platform;
      if (platformVersion) {
        if (platform === "Android") {
          os = `Android ${platformVersion}`;
        } else if (platform === "Windows") {
          // Windows NT version mapping
          const major = parseInt(platformVersion.split(".")[0], 10);
          if (major >= 13) os = "Windows 11";
          else os = "Windows 10";
        } else if (platform === "macOS" || platform === "Chrome OS") {
          os = `${platform} ${platformVersion}`;
        } else {
          os = `${platform} ${platformVersion}`;
        }
      }

      // Device name
      let device = "Unknown";
      if (uaData.mobile) {
        device = model && model.length > 1 ? model : "Smartphone";
      } else {
        device = "Desktop/Laptop";
      }

      // Browser from fullVersionList
      let browser = "Unknown";
      const versionList: { brand: string; version: string }[] =
        hints.fullVersionList || uaData.brands || [];
      // Filter out "Not" brands (Chromium uses fake brands like "Not_A Brand")
      const realBrands = versionList.filter(
        (b: { brand: string }) => !b.brand.startsWith("Not") && b.brand !== "Chromium"
      );
      if (realBrands.length > 0) {
        const b = realBrands[0];
        browser = `${b.brand} ${b.version.split(".")[0]}`;
      } else {
        browser = parseBrowserFromUA(ua);
      }

      return {
        device,
        os,
        browser,
        raw: JSON.stringify({ model, platform, platformVersion, brands: realBrands, ua }),
      };
    } catch {
      // Fall through to legacy parsing
    }
  }

  // Fallback: parse user agent string
  const parsed = parseDeviceInfoFromUA(ua);
  return { ...parsed, raw: ua };
}

// Parse browser name from UA string
function parseBrowserFromUA(ua: string): string {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung Browser";
  if (/Chrome\//.test(ua) && !/Edg/.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
  return "Unknown";
}

// Legacy UA string parser
export function parseDeviceInfoFromUA(ua: string): { device: string; os: string; browser: string } {
  let device = "Unknown";
  let os = "Unknown";

  // OS
  if (/Android (\d+(\.\d+)?)/.test(ua)) {
    const ver = ua.match(/Android (\d+(\.\d+)?)/)?.[1] || "";
    os = `Android ${ver}`;
  } else if (/iPhone|iPad/.test(ua)) {
    const ver = ua.match(/OS (\d+[_\d]*)/)?.[1]?.replace(/_/g, ".") || "";
    os = `iOS ${ver}`;
  } else if (/Windows NT/.test(ua)) {
    os = "Windows";
  } else if (/Mac OS X/.test(ua)) {
    os = "macOS";
  } else if (/Linux/.test(ua)) {
    os = "Linux";
  }

  // Device
  if (/iPhone/.test(ua)) {
    device = "iPhone";
  } else if (/iPad/.test(ua)) {
    device = "iPad";
  } else if (/Mobile|Android/.test(ua)) {
    device = "Smartphone";
    const model = ua.match(/;\s*([^;)]+)\s*Build/)?.[1]?.trim();
    if (model && model.length > 2 && !/^[A-Z]$/.test(model) && !/^Linux/.test(model)) {
      device = model;
    }
  } else {
    device = "Desktop/Laptop";
  }

  const browser = parseBrowserFromUA(ua);
  return { device, os, browser };
}

// Parse stored device info (could be JSON from modern API or raw UA string)
export function parseDeviceInfo(stored: string): { device: string; os: string; browser: string } {
  // Try JSON format first (from modern API)
  try {
    const data = JSON.parse(stored);
    if (data.model !== undefined && data.platform !== undefined) {
      // It's our modern format
      const platform = data.platform || "Unknown";
      const platformVersion = data.platformVersion || "";

      let os = platform;
      if (platformVersion) {
        if (platform === "Android") os = `Android ${platformVersion}`;
        else if (platform === "Windows") {
          const major = parseInt(platformVersion.split(".")[0], 10);
          os = major >= 13 ? "Windows 11" : "Windows 10";
        } else {
          os = `${platform} ${platformVersion}`;
        }
      }

      let device = "Unknown";
      const model = data.model || "";
      if (model && model.length > 1) {
        device = model;
      } else if (data.ua && /Mobile|Android/.test(data.ua)) {
        device = "Smartphone";
      } else {
        device = "Desktop/Laptop";
      }

      let browser = "Unknown";
      const brands = data.brands || [];
      if (brands.length > 0) {
        browser = `${brands[0].brand} ${(brands[0].version || "").split(".")[0]}`;
      } else if (data.ua) {
        browser = parseBrowserFromUA(data.ua);
      }

      return { device, os, browser };
    }
  } catch {
    // Not JSON, treat as UA string
  }

  return parseDeviceInfoFromUA(stored);
}

export function getDeviceSummary(stored: string): string {
  const { device, os, browser } = parseDeviceInfo(stored);
  return `${browser} • ${os} • ${device}`;
}
