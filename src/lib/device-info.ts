// Parse user agent into readable device info
export function parseDeviceInfo(ua: string): { device: string; os: string; browser: string } {
  let device = "Unknown";
  let os = "Unknown";
  let browser = "Unknown";

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
  if (/Mobile|Android/.test(ua)) {
    device = "Smartphone";
    const model = ua.match(/;\s*([^;)]+)\s*Build/)?.[1]?.trim();
    if (model && model !== "K") device = model;
  } else if (/Tablet|iPad/.test(ua)) {
    device = "Tablet";
  } else {
    device = "Desktop/Laptop";
  }

  // Browser
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/.test(ua)) browser = "Opera";
  else if (/SamsungBrowser/.test(ua)) browser = "Samsung Browser";
  else if (/Chrome\//.test(ua) && !/Edg/.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = "Safari";

  return { device, os, browser };
}

export function getDeviceSummary(ua: string): string {
  const { device, os, browser } = parseDeviceInfo(ua);
  return `${browser} • ${os} • ${device}`;
}
