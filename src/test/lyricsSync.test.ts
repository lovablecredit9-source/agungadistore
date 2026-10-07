import { describe, it, expect } from "vitest";
import { findActiveLyricIndex, karaokeProgress, heardTime, isTimingVerified, syllableCount } from "@/components/music/lyricsTiming";
import { parseLrcText, validateLyricLines, looksEvenlyDistributed } from "@/lib/lyrics-audit";

const lines = [
  { id: "a", time_seconds: 5, text: "Saya mau pergi" },
  { id: "b", time_seconds: 9.5, text: "jauh sekali dari sini" },
  { id: "c", time_seconds: 30, text: "pulang" },
];

/** Simulasi pemutar: lirik hanya membaca currentTime audio. */
const at = (t: number) => findActiveLyricIndex(lines, heardTime(t, 0));

describe("lirik mengikuti waktu audio", () => {
  it("1. baris aktif mengikuti currentTime", () => { expect(at(4.9)).toBe(-1); expect(at(5)).toBe(0); expect(at(10)).toBe(1); });
  it("2-3. pause menahan baris, resume melanjutkan dari posisi audio", () => {
    const paused = 7; expect(at(paused)).toBe(0); expect(at(paused)).toBe(0); expect(at(paused + 3)).toBe(1);
  });
  it("4. seek langsung mengganti baris", () => { expect(at(31)).toBe(2); expect(at(6)).toBe(0); });
  it("5-6. ganti lagu memakai lirik lagu baru", () => {
    const other = [{ id: "x", time_seconds: 1, text: "lagu lain" }];
    expect(findActiveLyricIndex(other, 2)).toBe(0);
    expect(findActiveLyricIndex([], 2)).toBe(-1);
  });
  it("10. saat diputar normal, baris tidak pernah mundur", () => {
    let prev = -1;
    for (let t = 0; t < 40; t += 0.05) { const i = at(t); expect(i).toBeGreaterThanOrEqual(prev); prev = i; }
  });
  it("11. kompensasi latensi tidak pernah negatif dan menolak nilai rusak", () => {
    expect(heardTime(0.1, 0.3)).toBe(0);
    expect(heardTime(10, NaN)).toBe(10);
    expect(heardTime(10, 5)).toBe(10);
    expect(heardTime(NaN, 0.1)).toBe(0);
    expect(heardTime(10, 0.2)).toBeCloseTo(9.8);
  });
  it("16. sapuan per kata tetap di dalam baris (0..1) dan selesai sebelum baris berikutnya", () => {
    for (let t = 5; t < 9.5; t += 0.1) { const k = karaokeProgress(lines, 0, t, 60); expect(k).toBeGreaterThanOrEqual(0); expect(k).toBeLessThanOrEqual(1); }
    expect(karaokeProgress(lines, 0, 9.49, 60)).toBe(1);
    expect(karaokeProgress(lines, 0, 4, 60)).toBe(0);
  });
  it("kata panjang diberi waktu lebih lama daripada kata pendek", () => { expect(syllableCount("sekali")).toBeGreaterThan(syllableCount("mau")); });
});

describe("validasi timestamp", () => {
  it("7-9. monoton, tidak negatif, tidak melewati durasi", () => {
    expect(validateLyricLines([{ time_seconds: 1, text: "a", line_order: 0 }, { time_seconds: 2, text: "b", line_order: 1 }], 10)).toEqual([]);
    expect(validateLyricLines([{ time_seconds: 3, text: "a", line_order: 0 }, { time_seconds: 2, text: "b", line_order: 1 }], 10).join()).toMatch(/mundur/);
    expect(validateLyricLines([{ time_seconds: -1, text: "a", line_order: 0 }], 10).join()).toMatch(/negatif/);
    expect(validateLyricLines([{ time_seconds: 20, text: "a", line_order: 0 }], 10).join()).toMatch(/durasi/);
  });
  it("12-13. lirik kosong dan rusak tidak membuat crash", () => {
    expect(validateLyricLines([])).toEqual(["Lirik kosong"]);
    const p = parseLrcText("bukan lrc\n[xx:yy] rusak\n[00:05.00] baik");
    expect(p.untimed).toBe(2);
    expect(validateLyricLines(p.lines).length).toBeGreaterThan(0);
  });
  it("14. lagu tanpa status synced dianggap belum sinkron", () => {
    expect(isTimingVerified("synced")).toBe(true);
    for (const s of ["needs_review", "unchecked", "missing", null, undefined]) expect(isTimingVerified(s)).toBe(false);
  });
  it("15. waktu yang dibagi rata terdeteksi, bukan dianggap sinkron", () => {
    expect(looksEvenlyDistributed([10, 15, 20, 25, 30, 35, 40])).toBe(true);
    expect(looksEvenlyDistributed([5.7, 9.1, 11, 17.4, 19.2, 26, 27.5])).toBe(false);
  });
});
