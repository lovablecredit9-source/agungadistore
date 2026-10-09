import { describe, it, expect } from "vitest";
import { previewExtend, remainingDays, reminderKind, countdownText } from "../components/streak/autoClaimLogic";

const DAY = 86_400_000;
const NOW = Date.parse("2026-10-09T10:00:00Z");

describe("Auto-Klaim stacking", () => {
  it("10 days left + buy 15 = 25 days, ends old expiry + 15 days", () => {
    const until = new Date(NOW + 10 * DAY).toISOString();
    const p = previewExtend(until, 15, NOW);
    expect(p.before).toBe(10);
    expect(p.total).toBe(25);
    expect(p.newUntil).toBe(new Date(NOW + 25 * DAY).toISOString());
  });
  it("no active package starts from now", () => {
    expect(previewExtend(null, 15, NOW).total).toBe(15);
    expect(remainingDays(new Date(NOW - DAY).toISOString(), NOW)).toBe(0);
  });
});

describe("Auto-Klaim reminders (mirror of streak_reminder_kind)", () => {
  it("3 days, 1 day and 1 hour windows", () => {
    expect(reminderKind(new Date(NOW + 3 * DAY).toISOString(), NOW)).toBe("3d");
    expect(reminderKind(new Date(NOW + DAY).toISOString(), NOW)).toBe("1d");
    expect(reminderKind(new Date(NOW + 3_600_000).toISOString(), NOW)).toBe("1h");
    expect(reminderKind(new Date(NOW + 4 * DAY).toISOString(), NOW)).toBeNull();
  });
});

describe("flash sale countdown", () => {
  it("formats remaining time and stops at zero", () => {
    expect(countdownText(new Date(NOW + 751_000).toISOString(), NOW)).toBe("00:12:31");
    expect(countdownText(new Date(NOW - 1000).toISOString(), NOW)).toBe("00:00:00");
  });
});
