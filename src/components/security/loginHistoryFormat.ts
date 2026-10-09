// Display rules for login-history rows. Missing values show "Tidak tersedia"-style labels; nothing is guessed.

export type LoginHistoryRow = {
  id: string;
  logged_in_at: string;
  device_info: string | null;
  browser: string | null;
  ip_address: string | null;
  ip_source?: string | null;
  device_visitor_id?: string | null;
  device_brand?: string | null;
  device_model?: string | null;
  os_name?: string | null;
  os_version?: string | null;
  browser_name?: string | null;
  browser_version?: string | null;
  network_type?: string | null;
  login_method?: string | null;
  is_this_device?: boolean;
};

const NA = "Tidak tersedia";

export function deviceLabel(r: LoginHistoryRow): string {
  if (r.device_model) {
    const brand = r.device_brand && !r.device_model.toUpperCase().startsWith(r.device_brand.toUpperCase()) ? `${r.device_brand} ` : "";
    return `${brand}${r.device_model}`;
  }
  return "Model tidak tersedia";
}

export function osLabel(r: LoginHistoryRow): string {
  if (!r.os_name) return "Sistem operasi tidak tersedia";
  if (r.os_version) return `${r.os_name} ${r.os_version}`;
  return r.os_name === "Android" ? "Versi Android tidak tersedia" : r.os_name;
}

export function browserLabel(r: LoginHistoryRow): string {
  if (r.browser_name) return r.browser_version ? `${r.browser_name} ${r.browser_version}` : r.browser_name;
  return NA;
}

const NETWORK: Record<string, string> = { wifi: "Wi-Fi", cellular: "Data seluler", ethernet: "Ethernet", bluetooth: "Bluetooth", wimax: "WiMAX", other: "Lainnya", none: "Offline" };
export function networkLabel(r: LoginHistoryRow): string {
  return (r.network_type && NETWORK[r.network_type]) || NA;
}

export function ipLabel(r: LoginHistoryRow): string {
  return r.ip_address || NA;
}

const METHOD: Record<string, string> = { password: "Sandi", auth: "Akun login (email/Google)", code: "Kode / barcode login", wa_token: "Token WhatsApp", register: "Pendaftaran akun" };
export function methodLabel(r: LoginHistoryRow): string {
  return (r.login_method && METHOD[r.login_method]) || "Metode tidak tercatat";
}

/** True when the row only has legacy free-text device data (logged before structured fields existed). */
export function isLegacyRow(r: LoginHistoryRow): boolean {
  return !r.device_model && !r.os_name && !r.browser_name;
}

const dateFmt = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hour12: false });

/** Server timestamp rendered in WIB, e.g. "09 Okt 2026 • 18:51 WIB". */
export function formatWib(iso: string | null | undefined): string {
  if (!iso) return NA;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NA;
  return `${dateFmt.format(d)} • ${timeFmt.format(d).replace(".", ":")} WIB`;
}
