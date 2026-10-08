import { describe, it, expect } from "vitest";
import { normalizePaymentSource, clampGemQuantity, computeGemOrder, planGemPayment } from "../../supabase/functions/_shared/gem-order";

describe("gem purchase order", () => {
  it("normalizes payment source to auto for unknown input", () => {
    expect(normalizePaymentSource("game")).toBe("game");
    expect(normalizePaymentSource("main")).toBe("main");
    expect(normalizePaymentSource("saldo")).toBe("auto");
    expect(normalizePaymentSource(undefined)).toBe("auto");
  });
  it("clamps quantity to an integer 1..99", () => {
    expect(clampGemQuantity(0)).toBe(1);
    expect(clampGemQuantity(-5)).toBe(1);
    expect(clampGemQuantity(2.9)).toBe(2);
    expect(clampGemQuantity(500)).toBe(99);
    expect(clampGemQuantity("abc")).toBe(1);
  });
  it("computes totals from server package data", () => {
    const o = computeGemOrder({ price: 2200000, gems: 1000, bonus_gems: 100, bonus_streak_coins: 50, bonus_game_credits: 2 }, 3);
    expect(o).toEqual({ ok: true, unitPrice: 2200000, totalPrice: 6600000, totalGems: 3300, totalStreakCoins: 150, totalGameCredits: 6 });
  });
  it("rejects invalid package prices", () => {
    expect(computeGemOrder({ price: 0, gems: 10 }, 1).ok).toBe(false);
    expect(computeGemOrder({ price: "x", gems: 10 }, 1).ok).toBe(false);
  });
});

describe("gem payment source (mirror of gem_purchase_pay)", () => {
  it("auto spends Saldo IN first then main balance", () => {
    expect(planGemPayment("auto", 2200000, 500000, 14000000)).toEqual({ ok: true, fromGame: 500000, fromMain: 1700000, label: "Saldo IN + Saldo Utama" });
    expect(planGemPayment("auto", 10000, 50000, 0)).toEqual({ ok: true, fromGame: 10000, fromMain: 0, label: "Saldo IN" });
    expect(planGemPayment("auto", 10000, 0, 50000)).toEqual({ ok: true, fromGame: 0, fromMain: 10000, label: "Saldo Utama" });
  });
  it("auto fails when combined balance is short", () => {
    expect(planGemPayment("auto", 2200000, 100000, 2000000).ok).toBe(false);
  });
  it("explicit Saldo IN never falls back to main", () => {
    expect(planGemPayment("game", 2200000, 100000, 99000000)).toEqual({ ok: false, error: "Saldo IN kurang" });
  });
  it("explicit Saldo Utama never falls back to Saldo IN", () => {
    expect(planGemPayment("main", 2200000, 99000000, 100000)).toEqual({ ok: false, error: "Saldo Utama kurang" });
    expect(planGemPayment("main", 2200000, 0, 14139000)).toEqual({ ok: true, fromGame: 0, fromMain: 2200000, label: "Saldo Utama" });
  });
  it("rejects non-positive totals", () => {
    expect(planGemPayment("auto", 0, 10, 10).ok).toBe(false);
  });
});
