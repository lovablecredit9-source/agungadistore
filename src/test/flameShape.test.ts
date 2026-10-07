import { describe, it, expect } from "vitest";
import { getFlameShape } from "@/components/streak/flameShape";
import { getStreakTier, STREAK_TIERS } from "@/components/streak/streakTiers";

describe("live flame shape per tier", () => {
  it("batas tier sesuai streak", () => {
    const cases: [number, string][] = [[1,"small"],[2,"small"],[3,"burning"],[6,"burning"],[7,"energy"],[13,"energy"],[14,"crystal"],[29,"crystal"],[30,"royal"],[59,"royal"],[60,"inferno"],[99,"inferno"],[100,"diamond"],[119,"diamond"],[120,"mythic"],[149,"mythic"],[150,"supreme"],[364,"supreme"],[365,"immortal"],[500,"immortal"]];
    for (const [d, id] of cases) expect(getStreakTier(d).id).toBe(id);
  });
  it("bentuk api tumbuh dan berbeda tiap tier (bukan hanya warna)", () => {
    const shapes = STREAK_TIERS.map(getFlameShape);
    for (let i = 1; i < shapes.length; i++) {
      expect(shapes[i].height).toBeGreaterThan(shapes[i - 1].height);
      expect(shapes[i].sideTongues.length).toBeGreaterThanOrEqual(shapes[i - 1].sideTongues.length);
    }
    expect(getFlameShape(getStreakTier(1)).sideTongues.length).toBe(0);
    expect(getFlameShape(getStreakTier(14)).sharp).toBe(true);
    expect(getFlameShape(getStreakTier(30)).crown).toBe(true);
    expect(getFlameShape(getStreakTier(100)).facet).toBe(true);
    expect(getFlameShape(getStreakTier(365)).twin && getFlameShape(getStreakTier(365)).crown).toBe(true);
  });
});
