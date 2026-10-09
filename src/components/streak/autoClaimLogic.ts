// Aturan tampilan Auto-Klaim (cermin `purchase_streak_plan_atomic`: paket baru mulai dari masa berakhir lama).
const DAY = 86_400_000;

/** Sisa hari (dibulatkan ke atas) sampai `until`, 0 bila sudah lewat. */
export function remainingDays(until: string | null | undefined, now: number): number {
  if (!until) return 0;
  const ms = Date.parse(until) - now;
  return ms > 0 ? Math.ceil(ms / DAY) : 0;
}

/** Pratinjau perpanjangan: sisa sekarang + hari paket = total, berakhir di until lama + hari paket. */
export function previewExtend(until: string | null | undefined, days: number, now: number) {
  const base = until && Date.parse(until) > now ? Date.parse(until) : now;
  const before = remainingDays(until, now);
  const newUntil = new Date(base + days * DAY).toISOString();
  return { before, add: days, total: remainingDays(newUntil, now), newUntil };
}

/** Status reminder sesuai sisa waktu (sama dengan `streak_reminder_kind` di server). */
export function reminderKind(until: string | null | undefined, now: number): "3d" | "1d" | "1h" | null {
  if (!until) return null;
  const left = Date.parse(until) - now;
  if (left <= 0) return null;
  if (left <= 3_600_000) return "1h";
  if (left <= DAY) return "1d";
  if (left <= 3 * DAY) return "3d";
  return null;
}

/** Hitung mundur hh:mm:ss (atau "Xh hh:mm:ss") berdasarkan selisih jam server. */
export function countdownText(endIso: string, now: number): string {
  const s = Math.max(0, Math.floor((Date.parse(endIso) - now) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const hms = [h, m, sec].map((x) => String(x).padStart(2, "0")).join(":");
  return d > 0 ? `${d}h ${hms}` : hms;
}
