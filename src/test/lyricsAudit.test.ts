import { describe, it, expect } from "vitest";
import { parseLrcText, validateLyricLines } from "@/lib/lyrics-audit";

describe("lyrics audit", () => {
  it("parses broken [mm:ss:xx] tags instead of saving time 0", () => {
    const { lines, untimed } = parseLrcText("[01:08:90]Bila memang\n[01:10.5]Lagi");
    expect(untimed).toBe(0);
    expect(lines[0]).toMatchObject({ time_seconds: 68.9, text: "Bila memang", line_order: 0 });
    expect(lines[1].time_seconds).toBe(70.5);
  });
  it("flags untimed, backwards, duplicate and over-duration lines", () => {
    const { lines } = parseLrcText("tanpa waktu\n[00:10.00]A\n[00:10.00]B\n[00:05.00]C\n[09:00.00]D");
    const issues = validateLyricLines(lines, 200).join("|");
    expect(issues).toMatch(/tanpa timestamp/);
    expect(issues).toMatch(/mundur\/duplikat/);
    expect(issues).toMatch(/melebihi durasi/);
  });
  it("accepts valid lyrics and keeps text exactly", () => {
    const { lines } = parseLrcText("[00:01.00]Ingatkah, kau\n[00:02.00]Lagi");
    expect(validateLyricLines(lines, 10)).toEqual([]);
    expect(lines[0].text).toBe("Ingatkah, kau");
  });
  it("reports missing lyrics", () => expect(validateLyricLines([], 10)).toEqual(["Lirik kosong"]));
});
