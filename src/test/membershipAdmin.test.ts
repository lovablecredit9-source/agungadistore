import { describe, it, expect } from "vitest";
import { memberState, grantWindow, durationSeconds, summarizeHistory, filterHistory } from "@/components/premium/premiumAdminLogic";
import { buildBenefits, DEFAULT_PREMIUM_CONFIG as C } from "@/components/premium/premiumBenefits";
import { bestSellers, newArrivals, priceDrops, flashPriceFor, totalSold } from "@/lib/storeShowcase";

const NOW = Date.parse("2026-10-09T00:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const DAY = 86400000;

describe("store premium membership (admin)", () => {
  it("member state: active, ending, locked, expired", () => {
    expect(memberState({ is_active: true, expires_at: iso(NOW + 10 * DAY) }, NOW)).toBe("active");
    expect(memberState({ is_active: true, expires_at: iso(NOW + 2 * DAY) }, NOW)).toBe("ending");
    expect(memberState({ is_active: true, expires_at: iso(NOW + 10 * DAY), locked_until: iso(NOW + DAY) }, NOW)).toBe("locked");
    expect(memberState({ is_active: true, expires_at: iso(NOW - 1) }, NOW)).toBe("expired");
    expect(memberState({ is_active: false, expires_at: iso(NOW + DAY) }, NOW)).toBe("expired");
  });
  it("manual grant extends from a running membership instead of overwriting", () => {
    const g = grantWindow(iso(NOW + 5 * DAY), 30, NOW);
    expect(g.extended).toBe(true);
    expect(g.startsAt).toBe(iso(NOW + 5 * DAY));
    expect(g.expiresAt).toBe(iso(NOW + 35 * DAY));
    const fresh = grantWindow(iso(NOW - DAY), 0, NOW);
    expect(fresh.extended).toBe(false);
    expect(fresh.days).toBe(1);
    expect(fresh.expiresAt).toBe(iso(NOW + DAY));
  });
  it("duration seconds ignores negatives", () => {
    expect(durationSeconds(1, 2, 3, 4)).toBe(86400 + 7200 + 180 + 4);
    expect(durationSeconds(-1, -1, 0)).toBe(0);
  });
  it("history summary separates paid purchases and admin grants", () => {
    const rows = [{ expires_at: null, price_paid: 20000 }, { expires_at: null, price_paid: 0 }, { expires_at: null, price_paid: 50000 }];
    expect(summarizeHistory(rows)).toEqual({ total: 3, paid: 2, manual: 1, revenue: 70000 });
    expect(filterHistory(rows, "manual")).toHaveLength(1);
    expect(filterHistory(rows, "paid")).toHaveLength(2);
  });
  it("membership cards only list benefits the admin enabled", () => {
    const active = buildBenefits({ ...C, game_credit_discount_enabled: false }, true).filter((b) => b.status === "active").map((b) => b.key);
    expect(active).toContain("voucher");
    expect(active).not.toContain("gameshop");
  });
});

describe("store profile showcase", () => {
  const products = [
    { id: "a", title: "A", price: 10000, image_url: null, sold_count: 5, created_at: iso(NOW - 2 * DAY) },
    { id: "b", title: "B", price: 20000, image_url: null, sold_count: 0, created_at: iso(NOW - 40 * DAY) },
    { id: "c", title: "C", price: 30000, image_url: null, sold_count: 12, created_at: iso(NOW - 20 * DAY) },
  ];
  it("best sellers exclude products never sold", () => {
    expect(bestSellers(products).map((p) => p.id)).toEqual(["c", "a"]);
    expect(totalSold(products)).toBe(17);
  });
  it("new arrivals use the real created date window", () => {
    expect(newArrivals(products, 14, 10, NOW).map((p) => p.id)).toEqual(["a"]);
    expect(newArrivals(products, 30, 10, NOW).map((p) => p.id)).toEqual(["a", "c"]);
  });
  it("price drops only come from live flash sales", () => {
    const sales = [
      { id: "s1", product_id: "b", mode: "discount_percent", discount_percent: 25, starts_at: iso(NOW - DAY), ends_at: iso(NOW + DAY), quota: 0, sold: 0 },
      { id: "s2", product_id: "c", mode: "manual", flash_price: 27000, starts_at: iso(NOW - DAY), ends_at: iso(NOW + DAY), quota: 5, sold: 5 },
      { id: "s3", product_id: "a", mode: "manual", flash_price: 8000, starts_at: iso(NOW + DAY), ends_at: iso(NOW + 2 * DAY), quota: 0, sold: 0 },
    ];
    const drops = priceDrops(products, sales, NOW);
    expect(drops).toHaveLength(1);
    expect(drops[0]).toMatchObject({ original: 20000, price: 15000, pct: 25 });
    expect(flashPriceFor({ mode: "manual", flash_price: 9000 }, 10000)).toBe(9000);
  });
});
