/**
 * Seleksi etalase Profil Toko (murni, tanpa I/O) dari data produk & flash sale asli.
 * Tidak ada riwayat harga produk di database, jadi "Penurunan Harga" hanya memakai
 * flash sale yang sedang berlaku (harga normal → harga flash sale).
 */
export interface ShowcaseProduct {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
  sold_count?: number | null;
  stock?: number | null;
  created_at?: string | null;
}

export interface ShowcaseFlashSale {
  id: string;
  product_id: string;
  mode?: string | null;
  discount_percent?: number | null;
  flash_price?: number | null;
  starts_at: string;
  ends_at: string;
  quota?: number | null;
  sold?: number | null;
}

/** Harga flash sale (sama dengan rumus yang sudah dipakai kartu Flash Sale). */
export function flashPriceFor(sale: Pick<ShowcaseFlashSale, "mode" | "discount_percent" | "flash_price">, original: number): number {
  if (sale.mode === "discount_percent") return Math.max(0, Math.round(original * (1 - (sale.discount_percent || 0) / 100)));
  return Math.max(0, Number(sale.flash_price ?? 0));
}

export function isFlashLive(s: ShowcaseFlashSale, now = Date.now()): boolean {
  const quota = Number(s.quota || 0);
  return new Date(s.starts_at).getTime() <= now && new Date(s.ends_at).getTime() > now && (quota === 0 || Number(s.sold || 0) < quota);
}

/** Produk terlaris: hanya yang benar-benar pernah terjual, urut sold_count. */
export function bestSellers<T extends ShowcaseProduct>(products: T[], limit = 10): T[] {
  return products
    .filter((p) => Number(p.sold_count || 0) > 0)
    .sort((a, b) => Number(b.sold_count || 0) - Number(a.sold_count || 0) || a.title.localeCompare(b.title))
    .slice(0, limit);
}

/** Produk baru: ditambahkan dalam `days` hari terakhir, terbaru dulu. */
export function newArrivals<T extends ShowcaseProduct>(products: T[], days = 14, limit = 10, now = Date.now()): T[] {
  const since = now - days * 86400000;
  return products
    .filter((p) => p.created_at && new Date(p.created_at).getTime() >= since && new Date(p.created_at).getTime() <= now)
    .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
    .slice(0, limit);
}

export interface PriceDrop<T> { product: T; sale: ShowcaseFlashSale; original: number; price: number; pct: number }

/** Penurunan harga dari flash sale yang sedang LIVE; diskon terbesar dulu. */
export function priceDrops<T extends ShowcaseProduct>(products: T[], sales: ShowcaseFlashSale[], now = Date.now(), limit = 10): PriceDrop<T>[] {
  const map = new Map(products.map((p) => [p.id, p]));
  const best = new Map<string, PriceDrop<T>>();
  for (const s of sales) {
    const product = map.get(s.product_id);
    if (!product || !isFlashLive(s, now)) continue;
    const original = Number(product.price || 0);
    const price = flashPriceFor(s, original);
    if (original <= 0 || price >= original) continue;
    const pct = Math.round(((original - price) / original) * 100);
    const prev = best.get(product.id);
    if (!prev || price < prev.price) best.set(product.id, { product, sale: s, original, price, pct });
  }
  return [...best.values()].sort((a, b) => b.pct - a.pct || a.price - b.price).slice(0, limit);
}

export function totalSold(products: ShowcaseProduct[]): number {
  return products.reduce((a, p) => a + Math.max(0, Number(p.sold_count || 0)), 0);
}
