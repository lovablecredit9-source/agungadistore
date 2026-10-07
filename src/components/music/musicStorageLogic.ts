export type StoragePkg = { id: string; name: string; storage_mb: number; price: number };

export const formatRupiah = (n: number) => `Rp${Math.round(Number(n) || 0).toLocaleString("id-ID")}`;

export function formatMb(mb: number) {
  if (mb >= 1024) { const gb = mb / 1024; return `${Number.isInteger(gb) ? gb : gb.toFixed(1)} GB`; }
  return `${mb} MB`;
}

/** Recommended = paket tengah (urutan admin); Best Value = harga per MB termurah. Hanya bila >1 paket. */
export function pickBadges(pkgs: StoragePkg[]): { recommendedId: string | null; bestValueId: string | null } {
  if (pkgs.length < 2) return { recommendedId: null, bestValueId: null };
  const recommendedId = pkgs[Math.floor((pkgs.length - 1) / 2)].id;
  const priced = pkgs.filter(p => p.storage_mb > 0 && p.price > 0);
  const best = priced.reduce<StoragePkg | null>((b, p) => (!b || p.price / p.storage_mb < b.price / b.storage_mb ? p : b), null);
  return { recommendedId, bestValueId: best?.id ?? null };
}
