import { describe, it, expect } from "vitest";
import { findActiveLyricIndex, karaokeProgress } from "@/components/music/lyricsTiming";

const lines = [
  { id: "a", time_seconds: 10, text: "satu dua tiga" },
  { id: "b", time_seconds: 15, text: "empat lima" },
  { id: "c", time_seconds: 40, text: "enam" },
];

describe("cinematic lyrics timing", () => {
  it("finds the active line from audio time", () => {
    expect(findActiveLyricIndex(lines, 0)).toBe(-1);
    expect(findActiveLyricIndex(lines, 10)).toBe(0);
    expect(findActiveLyricIndex(lines, 14.99)).toBe(0);
    expect(findActiveLyricIndex(lines, 15)).toBe(1);
    expect(findActiveLyricIndex(lines, 999)).toBe(2);
  });

  it("karaoke fill follows audio time and never exceeds 1", () => {
    expect(karaokeProgress(lines, 0, 10, 60)).toBe(0);
    expect(karaokeProgress(lines, 0, 11, 60)).toBeGreaterThan(0);
    expect(karaokeProgress(lines, 0, 14.9, 60)).toBeLessThanOrEqual(1);
    // long instrumental gap: fill finishes with the sung words, not at the next line
    expect(karaokeProgress(lines, 1, 18, 60)).toBe(1);
    expect(karaokeProgress(lines, -1, 5, 60)).toBe(0);
  });
});
