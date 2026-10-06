/** Aturan murni untuk fitur Shop (badge, trending, rekomendasi, banding, promo keranjang). */
export type AnyProduct = Record<string, any> & { id: string };

export const COMPARE_MAX = 3;
export const NEW_DAYS = 7;
export const ALMOST_GONE_PCT = 80;

export function toggleCompare(list: string[], id: string, max = COMPARE_MAX): { list: string[]; error?: string } {
  if (list.includes(id)) return { list: list.filter((x) => x !== id) };
  if (list.length >= max) return { list, error: `Maksimal ${max} produk untuk dibandingkan` };
  return { list: [...list, id] };
}

/** Harga satuan sama seperti fungsi checkout server: flash sale aktif > harga promo > harga normal. */
export function unitPrice(p: AnyProduct, flash?: { flash_price: number } | null) {
  if (flash) return Number(flash.flash_price);
  const promo = Number(p.promo_price || 0);
  return promo > 0 && promo < Number(p.price) ? promo : Number(p.price);
}

export function trendScore(p: AnyProduct) {
  return Number(p.sold_count || 0) * 3 + Number(p.cart_count || 0) + Number(p.views || 0) * 0.2 + Number(p.rating_count || 0) * 2;
}

export function trending(products: AnyProduct[], n = 8) {
  return products.filter((p) => trendScore(p) > 0 && Number(p.stock) > 0).sort((a, b) => trendScore(b) - trendScore(a)).slice(0, n);
}

/** Rekomendasi dari kategori yang sering dilihat/di-wishlist/dibeli; sisanya diisi produk populer. Tanpa data dummy. */
export function recommend(products: AnyProduct[], sig: { recent?: string[]; wishlist?: string[]; purchased?: string[] }, n = 8) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const weight: Record<string, number> = {};
  const add = (ids: string[] | undefined, w: number) => (ids || []).forEach((id) => { const c = byId.get(id)?.category; if (c) weight[c] = (weight[c] || 0) + w; });
  add(sig.recent, 1); add(sig.wishlist, 2); add(sig.purchased, 3);
  const seen = new Set([...(sig.purchased || [])]);
  const pool = products.filter((p) => Number(p.stock) > 0 && !seen.has(p.id));
  const scored = pool.filter((p) => weight[p.category]).sort((a, b) => (weight[b.category] - weight[a.category]) || (trendScore(b) - trendScore(a)));
  const out: AnyProduct[] = [...scored.slice(0, n)];
  for (const p of [...pool].sort((a, b) => trendScore(b) - trendScore(a))) { if (out.length >= n) break; if (!out.includes(p)) out.push(p); }
  return { items: out, personalized: scored.length > 0 };
}

export function relatedForCart(products: AnyProduct[], cartProductIds: string[], n = 6) {
  const inCart = products.filter((p) => cartProductIds.includes(p.id));
  const cats = new Set(inCart.map((p) => p.category).filter(Boolean));
  const stores = new Set(inCart.map((p) => p.store_id));
  return products
    .filter((p) => !cartProductIds.includes(p.id) && Number(p.stock) > 0 && (cats.has(p.category) || stores.has(p.store_id)))
    .sort((a, b) => Number(cats.has(b.category)) - Number(cats.has(a.category)) || trendScore(b) - trendScore(a))
    .slice(0, n);
}

export type Badge = { key: string; label: string; tone: "hot" | "good" | "info" | "danger" };
export function productBadges(p: AnyProduct, ctx: { flash?: boolean; topSold?: Set<string>; popular?: Set<string>; now?: number }): Badge[] {
  const now = ctx.now ?? Date.now();
  const b: Badge[] = [];
  if (ctx.flash) b.push({ key: "flash", label: "⚡ Flash Sale", tone: "hot" });
  if (ctx.topSold?.has(p.id)) b.push({ key: "terlaris", label: "🔥 Terlaris", tone: "hot" });
  if (Number(p.rating_avg) >= 4.5 && Number(p.rating_count) >= 3) b.push({ key: "rating", label: "⭐ Rating Tinggi", tone: "good" });
  if (p.created_at && now - new Date(p.created_at).getTime() < NEW_DAYS * 86400_000) b.push({ key: "baru", label: "🆕 Baru", tone: "info" });
  if (p.is_featured) b.push({ key: "premium", label: "💎 Premium", tone: "info" });
  if (ctx.popular?.has(p.id)) b.push({ key: "populer", label: "❤️ Populer", tone: "good" });
  b.push(Number(p.stock) > 0 ? { key: "stok", label: "🟢 Stok Tersedia", tone: "good" } : { key: "habis", label: "🔴 Habis", tone: "danger" });
  return b;
}

/** Info promo keranjang dari voucher toko yang ada. */
export function cartPromo(subtotal: number, vouchers: any[]) {
  const calc = (v: any, s: number) => Math.min(v.discount_type === "percent" ? Math.floor(s * Number(v.discount_value) / 100) : Number(v.discount_value), Number(v.max_discount || Infinity), s);
  const usable = vouchers.filter((v) => subtotal >= Number(v.min_purchase || 0)).map((v) => ({ v, save: calc(v, subtotal) })).sort((a, b) => b.save - a.save)[0];
  const next = vouchers.filter((v) => subtotal < Number(v.min_purchase || 0)).sort((a, b) => Number(a.min_purchase) - Number(b.min_purchase))[0];
  return {
    best: usable && usable.save > 0 ? { code: usable.v.code as string, save: usable.save } : null,
    next: next ? { code: next.code as string, need: Number(next.min_purchase) - subtotal } : null,
  };
}

export function flashProgress(f: { sold: number; flash_stock: number }) {
  const pct = Math.min(100, Math.round((Number(f.sold) / Math.max(1, Number(f.flash_stock))) * 100));
  return { pct, left: Math.max(0, Number(f.flash_stock) - Number(f.sold)), almostGone: pct >= ALMOST_GONE_PCT };
}
