import { describe, expect, it } from "vitest";
import { buildDeviceFields, normalizeHistoryQuery, parseUserAgent, serverIpFromHeaders } from "../../supabase/functions/_shared/login-device";
import { deviceLabel, formatWib, osLabel } from "@/components/security/loginHistoryFormat";

const OPPO_UA = "Mozilla/5.0 (Linux; Android 14; CPH2631 Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const REDUCED_UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";

describe("login device record", () => {
  it("parses brand, model, Android version and browser from a full UA", () => {
    const r = parseUserAgent(OPPO_UA);
    expect(r).toMatchObject({ device_brand: "OPPO", device_model: "CPH2631", os_name: "Android", os_version: "14", browser_name: "Chrome Mobile", browser_version: "140" });
  });

  it("does not invent model or Android version from Chrome's reduced UA", () => {
    const r = parseUserAgent(REDUCED_UA);
    expect(r.device_model).toBeNull();
    expect(r.os_version).toBeNull();
  });

  it("uses Client Hints model and Android version when the browser provides them", () => {
    const r = buildDeviceFields({ ua: REDUCED_UA, model: "SM-S928B", platform: "Android", platformVersion: "16.0.0" }, null);
    expect(r).toMatchObject({ device_brand: "Samsung", device_model: "SM-S928B", os_version: "16" });
  });

  it("keeps brand empty for an unknown model prefix", () => {
    expect(buildDeviceFields({ ua: REDUCED_UA, model: "ZZ-1000" }, null).device_brand).toBeNull();
  });

  it("rejects network types outside the known list", () => {
    expect(buildDeviceFields({ ua: OPPO_UA, networkType: "5g-super" }, null).network_type).toBeNull();
    expect(buildDeviceFields({ ua: OPPO_UA, networkType: "wifi" }, null).network_type).toBe("wifi");
  });

  it("takes the IP from forwarding headers only", () => {
    expect(serverIpFromHeaders(new Headers({ "x-forwarded-for": "36.80.1.2, 10.0.0.1" }))).toBe("36.80.1.2");
    expect(serverIpFromHeaders(new Headers({}))).toBeNull();
    expect(serverIpFromHeaders(new Headers({ "x-forwarded-for": "<script>" }))).toBeNull();
  });

  it("clamps history filters to 7/30/90 days and max 30 rows", () => {
    expect(normalizeHistoryQuery({ days: 365, limit: 500 })).toMatchObject({ days: 30, limit: 30, scope: "all" });
    expect(normalizeHistoryQuery({ days: 90, limit: 5, scope: "other" })).toMatchObject({ days: 90, limit: 5, scope: "other" });
  });

  it("shows 'not available' labels instead of guessing", () => {
    const row = { id: "1", logged_in_at: "2026-10-09T11:51:00Z", device_info: null, browser: null, ip_address: null, os_name: "Android" };
    expect(deviceLabel(row)).toBe("Model tidak tersedia");
    expect(osLabel(row)).toBe("Versi Android tidak tersedia");
  });

  it("renders server timestamps in WIB", () => {
    expect(formatWib("2026-10-09T11:51:00Z")).toBe("09 Okt 2026 • 18:51 WIB");
  });
});
