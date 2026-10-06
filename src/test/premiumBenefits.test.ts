import { describe, it, expect } from "vitest";
import { buildBenefits, DEFAULT_PREMIUM_CONFIG as C, memberPrice, premiumPhase, flashAccessible } from "@/components/premium/premiumBenefits";

describe("premium benefits", () => {
  it("never shows a disabled benefit as active", () => {
    const list = buildBenefits({ ...C, member_discount_enabled: false, weekly_game_enabled: false }, true);
    expect(list.find((b) => b.key === "discount")!.status).toBe("soon");
    expect(list.find((b) => b.key === "game")!.status).toBe("soon");
    expect(list.find((b) => b.key === "voucher")!.status).toBe("active");
  });
  it("requires membership for non-premium and respects lock", () => {
    expect(buildBenefits(C, false).find((b) => b.key === "voucher")!.status).toBe("membership");
    expect(buildBenefits(C, true, true).find((b) => b.key === "voucher")!.status).toBe("locked");
  });
  it("member price only for premium, never stacked with flash sale", () => {
    const cfg = { ...C, member_discount_enabled: true, member_discount_pct: 10 };
    expect(memberPrice(10000, cfg, true)).toBe(9000);
    expect(memberPrice(10000, cfg, false)).toBe(10000);
    expect(memberPrice(10000, cfg, true, true)).toBe(10000);
    expect(memberPrice(10000, { ...cfg, member_discount_pct: 95 }, true)).toBe(1000);
  });
  it("phase switches to ending within 3 days", () => {
    const now = Date.parse("2026-10-01T00:00:00Z");
    expect(premiumPhase(true, "2026-10-20T00:00:00Z", now)).toBe("active");
    expect(premiumPhase(true, "2026-10-03T00:00:00Z", now)).toBe("ending");
    expect(premiumPhase(false, "2026-10-20T00:00:00Z", now)).toBe("none");
  });
  it("flash access modes match server rules", () => {
    const now = Date.parse("2026-10-01T10:00:00Z");
    const in20 = "2026-10-01T10:20:00Z";
    expect(flashAccessible("premium_early", in20, true, 30, now)).toBe(true);
    expect(flashAccessible("premium_early", in20, false, 30, now)).toBe(false);
    expect(flashAccessible("premium_only", "2026-10-01T09:00:00Z", false, 30, now)).toBe(false);
    expect(flashAccessible("all", in20, true, 30, now)).toBe(false);
  });
});
