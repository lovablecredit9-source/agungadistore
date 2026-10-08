// Aturan pesanan Gem (murni). Dipakai edge function gem-purchase dan diuji di src/test/gemOrder.test.ts.
// Pemotongan saldo yang asli tetap dilakukan atomik oleh RPC `gem_purchase_pay`;
// `planGemPayment` adalah cermin aturan RPC itu untuk pratinjau & pengujian.

export type GemPaySource = "auto" | "game" | "main";

export function normalizePaymentSource(raw: unknown): GemPaySource {
  return raw === "game" || raw === "main" ? raw : "auto";
}

export function clampGemQuantity(raw: unknown): number {
  return Math.max(1, Math.min(99, Math.trunc(Number(raw)) || 1));
}

export interface GemPackageLike {
  price: number | string;
  gems: number;
  bonus_gems?: number | null;
  bonus_streak_coins?: number | null;
  bonus_game_credits?: number | null;
}

export type GemOrder =
  | { ok: true; unitPrice: number; totalPrice: number; totalGems: number; totalStreakCoins: number; totalGameCredits: number }
  | { ok: false; error: string };

export function computeGemOrder(pkg: GemPackageLike, quantity: number): GemOrder {
  const unitPrice = Math.trunc(Number(pkg.price));
  if (!Number.isSafeInteger(unitPrice) || unitPrice <= 0) return { ok: false, error: "Harga paket tidak valid" };
  const q = clampGemQuantity(quantity);
  return {
    ok: true,
    unitPrice,
    totalPrice: unitPrice * q,
    totalGems: (Number(pkg.gems) + Number(pkg.bonus_gems || 0)) * q,
    totalStreakCoins: Number(pkg.bonus_streak_coins || 0) * q,
    totalGameCredits: Number(pkg.bonus_game_credits || 0) * q,
  };
}

export type GemPaymentPlan =
  | { ok: true; fromGame: number; fromMain: number; label: string }
  | { ok: false; error: string };

/** Auto = Saldo IN dulu lalu Saldo Utama; pilihan tunggal tidak pernah fallback ke sumber lain. */
export function planGemPayment(source: GemPaySource, total: number, saldoIn: number, saldoMain: number): GemPaymentPlan {
  if (!(total > 0)) return { ok: false, error: "Nominal tidak valid" };
  const inBal = Math.max(0, saldoIn || 0);
  const main = Math.max(0, saldoMain || 0);
  if (source === "game") {
    return inBal < total ? { ok: false, error: "Saldo IN kurang" } : { ok: true, fromGame: total, fromMain: 0, label: "Saldo IN" };
  }
  if (source === "main") {
    return main < total ? { ok: false, error: "Saldo Utama kurang" } : { ok: true, fromGame: 0, fromMain: total, label: "Saldo Utama" };
  }
  const fromGame = Math.min(inBal, total);
  const fromMain = total - fromGame;
  if (main < fromMain) return { ok: false, error: "Saldo tidak cukup" };
  const label = fromGame > 0 && fromMain > 0 ? "Saldo IN + Saldo Utama" : fromGame > 0 ? "Saldo IN" : "Saldo Utama";
  return { ok: true, fromGame, fromMain, label };
}
