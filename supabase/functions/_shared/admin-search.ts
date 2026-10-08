// Aturan pencarian user untuk admin (murni). Dipakai admin-reset-user, diuji di src/test/adminSearch.test.ts.

/** Buang karakter yang bisa merusak filter PostgREST `.or()` / pola ilike, batasi panjang. */
export function sanitizeSearchQuery(raw: unknown): string {
  return String(raw ?? "").trim().replace(/[%,()*\\]/g, "").slice(0, 80);
}

/** Filter case-insensitive di username, nomor HP, email, dan visitor_id. */
export function userSearchOrFilter(q: string): string {
  return `username.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,visitor_id.ilike.%${q}%`;
}

/** Gabungkan hasil langsung + hasil relasi perangkat tanpa duplikat, hasil langsung didahulukan. */
export function mergeUserResults<T extends { id: string }>(direct: T[], viaHistory: T[], limit = 20): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const u of [...direct, ...viaHistory]) {
    if (!u?.id || seen.has(u.id)) continue;
    seen.add(u.id);
    out.push(u);
    if (out.length >= limit) break;
  }
  return out;
}

/** ID akun dari riwayat login yang belum ada di hasil langsung. */
export function extraAccountIds(history: { user_balance_id: string | null }[], direct: { id: string }[]): string[] {
  const have = new Set(direct.map((u) => u.id));
  return [...new Set(history.map((h) => h.user_balance_id).filter((id): id is string => !!id && !have.has(id)))];
}
