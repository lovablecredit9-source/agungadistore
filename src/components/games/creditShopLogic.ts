export type PaySource = "auto" | "game" | "main";

/** Harga dari server (`game_credit_quote`). Klien tidak menghitung ulang diskon. */
export interface CreditQuote {
  package_id: string; label: string; credits: number; is_unlimited: boolean; unlimited_days: number;
  price: number; flash_pct: number; flash_discount: number; member_pct: number; member_discount: number;
  voucher_discount: number; voucher_error: string | null; final_price: number;
}

export function formatRupiah(n: number) {
  return `Rp${Math.max(0, Math.round(Number(n) || 0)).toLocaleString("id-ID")}`;
}

/** Cermin aturan sumber pembayaran di server (hanya untuk tampilan; server tetap memvalidasi). */
export function planPayment(total: number, source: PaySource, game: number, main: number) {
  const t = Math.max(0, total);
  let fromGame = 0, fromMain = 0, insufficient = false;
  if (t > 0) {
    if (source === "game") { fromGame = t; insufficient = game < t; }
    else if (source === "main") { fromMain = t; insufficient = main < t; }
    else { fromGame = Math.min(Math.max(0, game), t); fromMain = t - fromGame; insufficient = main < fromMain; }
  }
  const label = t === 0 ? "Gratis" : fromGame > 0 && fromMain > 0 ? "Saldo IN + Saldo Utama" : fromGame > 0 ? "Saldo IN" : "Saldo Utama";
  return { fromGame, fromMain, insufficient, label };
}

/** Harga per kredit dari harga final server (0 untuk unlimited / paket tanpa kredit). */
export function pricePerCredit(q: Pick<CreditQuote, "is_unlimited" | "credits" | "final_price">): number {
  return !q.is_unlimited && q.credits > 0 ? q.final_price / q.credits : 0;
}

/**
 * Paket "Paling Worth It" = harga final per kredit terendah.
 * Hanya muncul bila ada ≥2 paket berkredit dan harganya per kredit benar-benar berbeda;
 * tanpa dasar data, tidak ada paket yang direkomendasikan.
 */
export function bestValuePackageId(quotes: CreditQuote[]): string | null {
  const finite = quotes.filter(q => !q.is_unlimited && q.credits > 0 && q.final_price > 0);
  if (finite.length < 2) return null;
  const sorted = [...finite].sort((a, b) => pricePerCredit(a) - pricePerCredit(b));
  const best = sorted[0], worst = sorted[sorted.length - 1];
  if (pricePerCredit(best) >= pricePerCredit(worst)) return null;
  return best.package_id;
}

/** Persentase hemat dari harga normal vs harga final server; 0 bila tidak ada diskon. */
export function savingsPct(q: Pick<CreditQuote, "price" | "final_price">): number {
  if (!(q.price > 0) || !(q.final_price < q.price)) return 0;
  return Math.round(((q.price - q.final_price) / q.price) * 100);
}

/** Jelaskan saldo mana yang kurang, memakai aturan yang sama dengan planPayment. */
export function shortfallMessage(total: number, source: PaySource, game: number, main: number): string | null {
  const p = planPayment(total, source, game, main);
  if (!p.insufficient) return null;
  const t = Math.max(0, total);
  if (source === "game") return `Saldo IN kurang ${formatRupiah(t - game)}`;
  if (source === "main") return `Saldo Utama kurang ${formatRupiah(t - main)}`;
  return `Saldo IN + Saldo Utama kurang ${formatRupiah(t - Math.max(0, game) - Math.max(0, main))}`;
}


/** Pesan ramah pengguna; tidak pernah menampilkan error teknis mentah. */
export function creditErrorMessage(raw: string | null | undefined): string {
  const m = String(raw || "");
  if (m === "network") return "Koneksi bermasalah. Pembelian belum dapat diproses.";
  if (/PIN salah/i.test(m)) return "PIN salah. Silakan coba lagi.";
  if (/PIN belum dibuat/i.test(m)) return "PIN belum dibuat. Buat PIN dulu di tab Saldo.";
  if (/PIN/i.test(m)) return m.length < 80 ? m : "PIN tidak valid.";
  if (/tidak cukup/i.test(m)) return m.length < 140 ? m : "Saldo tidak cukup untuk membeli paket ini.";
  if (/voucher/i.test(m)) return "Voucher tidak valid atau sudah tidak berlaku.";
  if (/login|akun saldo/i.test(m)) return "Silakan login ke akun saldo terlebih dahulu.";
  if (/masih diproses/i.test(m)) return "Pembelian sebelumnya masih diproses. Tunggu beberapa detik.";
  if (/Paket/i.test(m)) return "Paket tidak tersedia. Muat ulang halaman.";
  return "Transaksi gagal diproses. Silakan coba lagi.";
}
