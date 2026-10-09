/** Harga membership setelah diskon (voucher / Lucky Bonus). Persen dibatasi 1–90, dibulatkan ke bawah ke rupiah. */
export function discountedMembershipPrice(price: number, percent: number | null | undefined): { final: number; cut: number } {
  const base = Math.max(0, Math.round(price));
  const pct = percent ? Math.min(90, Math.max(1, Math.round(percent))) : 0;
  const cut = Math.floor((base * pct) / 100);
  return { final: base - cut, cut };
}

export interface MembershipDiscount { id: string; discount_percent: number; expires_at: string; used_at: string | null }

/** Pilih diskon terbesar yang belum dipakai & belum kedaluwarsa. */
export function pickBestDiscount(list: MembershipDiscount[], nowMs: number): MembershipDiscount | null {
  return list
    .filter((d) => !d.used_at && Date.parse(d.expires_at) > nowMs)
    .sort((a, b) => b.discount_percent - a.discount_percent || Date.parse(a.expires_at) - Date.parse(b.expires_at))[0] ?? null;
}
