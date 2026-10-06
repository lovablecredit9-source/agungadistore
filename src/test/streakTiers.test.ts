import { describe, it, expect } from "vitest";
import { getStreakTier, getNextStreakTier, getMilestoneProgress, MILESTONES } from "@/components/streak/streakTiers";

describe("streak visual tiers", () => {
  it("1-2 hari = Small Flame", () => {
    expect(getStreakTier(1).name).toBe("Small Flame");
    expect(getStreakTier(2).name).toBe("Small Flame");
  });
  it("3-6 hari = Burning Flame", () => {
    expect(getStreakTier(3).name).toBe("Burning Flame");
    expect(getStreakTier(6).name).toBe("Burning Flame");
  });
  it("7-13 hari = Energy Flame", () => expect(getStreakTier(13).name).toBe("Energy Flame"));
  it("14-29 hari = Crystal Flame", () => expect(getStreakTier(29).name).toBe("Crystal Flame"));
  it("30-59 hari = Royal Flame", () => expect(getStreakTier(30).name).toBe("Royal Flame"));
  it("60-99 hari = Inferno Flame", () => expect(getStreakTier(99).name).toBe("Inferno Flame"));
  it("100-119 hari = Diamond Flame", () => expect(getStreakTier(100).name).toBe("Diamond Flame"));
  it("120-149 hari = Mythic Flame", () => expect(getStreakTier(149).name).toBe("Mythic Flame"));
  it("150-364 hari = Supreme Flame", () => expect(getStreakTier(364).name).toBe("Supreme Flame"));
  it("365+ hari = Immortal Flame", () => expect(getStreakTier(500).name).toBe("Immortal Flame"));
  it("tier is deterministic for the same streak", () => expect(getStreakTier(30)).toBe(getStreakTier(30)));
  it("next tier after 30 is Inferno at 60", () => expect(getNextStreakTier(30)?.minDays).toBe(60));
  it("milestones stay 3/7/14/30/60/100/120/150/365", () =>
    expect(MILESTONES.map(m => m.days)).toEqual([3, 7, 14, 30, 60, 100, 120, 150, 365]));
  it("30 hari: next milestone 60, 30 hari lagi", () => {
    const p = getMilestoneProgress(30);
    expect(p.next?.days).toBe(60);
    expect(p.remaining).toBe(30);
  });
});
