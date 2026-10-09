import { describe, it, expect } from "vitest";
import { discountedMembershipPrice, pickBestDiscount } from "../../supabase/functions/_shared/membership-discount";

const NOW = Date.parse("2026-10-09T12:00:00Z");
describe("membership discount", () => {
  it("10% off Rp20.000 = Rp18.000, 20% off = Rp16.000", () => {
    expect(discountedMembershipPrice(20000, 10)).toEqual({ final: 18000, cut: 2000 });
    expect(discountedMembershipPrice(20000, 20).final).toBe(16000);
    expect(discountedMembershipPrice(20000, null).final).toBe(20000);
  });
  it("caps at 90%", () => { expect(discountedMembershipPrice(10000, 150).final).toBe(1000); });
  it("picks the biggest unused, unexpired discount", () => {
    const d = pickBestDiscount([
      { id: "a", discount_percent: 20, expires_at: "2026-10-08T00:00:00Z", used_at: null },
      { id: "b", discount_percent: 30, expires_at: "2026-10-12T00:00:00Z", used_at: "2026-10-09T00:00:00Z" },
      { id: "c", discount_percent: 10, expires_at: "2026-10-12T00:00:00Z", used_at: null },
    ], NOW);
    expect(d?.id).toBe("c");
  });
});
