import { describe, it, expect, beforeEach } from "vitest";
import { clampVolume, loadPlayerVolume, savePlayerVolume, pickNextIndex } from "@/lib/player-state";
import { clampPan, panLabel } from "@/lib/audio-visualizer";
import { findActiveLyricIndex, karaokeProgress } from "@/components/music/lyricsTiming";

describe("player volume state", () => {
  beforeEach(() => localStorage.clear());
  it("defaults to full volume, unmuted", () => {
    expect(loadPlayerVolume()).toEqual({ volume: 1, muted: false });
  });
  it("persists and clamps volume + mute", () => {
    for (const v of [0, 0.1, 0.25, 0.5, 0.75, 1]) {
      savePlayerVolume(v, false);
      expect(loadPlayerVolume().volume).toBe(v);
    }
    savePlayerVolume(3, true);
    expect(loadPlayerVolume()).toEqual({ volume: 1, muted: true });
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(NaN)).toBe(1);
  });
  it("ignores corrupted storage", () => {
    localStorage.setItem("music_player_volume_v1", "{oops");
    expect(loadPlayerVolume()).toEqual({ volume: 1, muted: false });
  });
});

describe("next song", () => {
  it("wraps sequentially", () => {
    expect(pickNextIndex(0, 3, false)).toBe(1);
    expect(pickNextIndex(2, 3, false)).toBe(0);
  });
  it("shuffle never repeats the current song", () => {
    for (let i = 0; i < 50; i++) {
      const r = Math.random;
      expect(pickNextIndex(2, 5, true, r)).not.toBe(2);
    }
    expect(pickNextIndex(0, 1, true)).toBe(0);
  });
});

describe("balance L/R", () => {
  it("clamps pan to -1..1 and labels presets", () => {
    expect(clampPan(-5)).toBe(-1);
    expect(clampPan(5)).toBe(1);
    expect(clampPan(undefined)).toBe(0);
    expect(panLabel(-1)).toBe("L100");
    expect(panLabel(-0.5)).toBe("L50");
    expect(panLabel(0)).toBe("Tengah");
    expect(panLabel(0.5)).toBe("R50");
    expect(panLabel(1)).toBe("R100");
  });
});

describe("karaoke follows audio time after seek", () => {
  const lines = [0, 5, 10, 15, 20].map((t, i) => ({ id: String(i), time_seconds: t, text: "a b c" }));
  it("jumps straight to the right line on seek forward/back", () => {
    expect(findActiveLyricIndex(lines, 3)).toBe(0);
    expect(findActiveLyricIndex(lines, 13)).toBe(2);
    expect(findActiveLyricIndex(lines, 3)).toBe(0);
    expect(findActiveLyricIndex(lines, 25)).toBe(4);
  });
  it("same audio time gives the same karaoke fill (paused = frozen)", () => {
    expect(karaokeProgress(lines, 2, 11, 30)).toBe(karaokeProgress(lines, 2, 11, 30));
  });
});
