/** Aturan tampilan & perhitungan panel admin Premium Toko (murni, tanpa I/O). */

export interface PremiumSubLike {
  is_active?: boolean | null;
  expires_at: string | null;
  locked_until?: string | null;
  price_paid?: number | null;
  plan_id?: string | null;
  created_at?: string | null;
}

export type MemberState = "active" | "ending" | "locked" | "expired";

/** Status anggota: terkunci > berakhir ≤ 3 hari > aktif; nonaktif/lewat = expired. */
export function memberState(s: PremiumSubLike, now = Date.now()): MemberState {
  const exp = s.expires_at ? new Date(s.expires_at).getTime() : 0;
  if (!s.is_active || exp <= now) return "expired";
  if (s.locked_until && new Date(s.locked_until).getTime() > now) return "locked";
  return exp - now <= 3 * 86400000 ? "ending" : "active";
}

/** Pemberian manual menyambung dari masa aktif yang masih berjalan (tidak menimpa). */
export function grantWindow(existingExpiresAt: string | null | undefined, days: number, now = Date.now()) {
  const d = Math.max(1, Math.trunc(Number(days)) || 0);
  const existing = existingExpiresAt ? new Date(existingExpiresAt).getTime() : 0;
  const start = existing > now ? existing : now;
  return { days: d, startsAt: new Date(start).toISOString(), expiresAt: new Date(start + d * 86400000).toISOString(), extended: existing > now };
}

export function durationSeconds(d: number, h: number, m: number, s = 0): number {
  return Math.max(0, Math.trunc(d) || 0) * 86400 + Math.max(0, Math.trunc(h) || 0) * 3600 + Math.max(0, Math.trunc(m) || 0) * 60 + Math.max(0, Math.trunc(s) || 0);
}

export interface HistorySummary { total: number; paid: number; manual: number; revenue: number }

/** Ringkasan riwayat: transaksi berbayar vs pemberian admin (price_paid 0). */
export function summarizeHistory(rows: PremiumSubLike[]): HistorySummary {
  let paid = 0, manual = 0, revenue = 0;
  for (const r of rows) {
    const p = Math.max(0, Number(r.price_paid || 0));
    if (p > 0) { paid++; revenue += p; } else manual++;
  }
  return { total: rows.length, paid, manual, revenue };
}

export function filterHistory<T extends PremiumSubLike>(rows: T[], kind: "all" | "paid" | "manual"): T[] {
  if (kind === "all") return rows;
  return rows.filter((r) => (Number(r.price_paid || 0) > 0) === (kind === "paid"));
}
