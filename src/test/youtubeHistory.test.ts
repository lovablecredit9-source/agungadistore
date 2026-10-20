import { beforeEach, describe, expect, it } from "vitest";
import { addHistory, clearHistory, loadHistory, removeHistory, YT_HISTORY_KEY, YT_HISTORY_MAX } from "@/components/apkpremium/youtubeHistory";

const U = "https://www.youtube.com/watch?v=abc";
beforeEach(() => localStorage.clear());

describe("youtube history", () => {
  it("persists and reads back newest first", () => {
    addHistory({ type: "search", title: "lagu a", at: 1 });
    addHistory({ type: "mp3", title: "Video", url: U, status: "ok", at: 2 });
    const l = loadHistory();
    expect(l.map((x) => x.type)).toEqual(["mp3", "search"]);
  });
  it("updates the same search instead of duplicating", () => {
    addHistory({ type: "search", title: "Lagu A", at: 1 });
    addHistory({ type: "search", title: " lagu a ", at: 2 });
    expect(loadHistory()).toHaveLength(1);
  });
  it("keeps different MP4 qualities as separate entries", () => {
    addHistory({ type: "mp4", title: "V", url: U, quality: "360", at: 1 });
    addHistory({ type: "mp4", title: "V", url: U, quality: "720", at: 2 });
    expect(loadHistory()).toHaveLength(2);
  });
  it("caps the list size", () => {
    for (let i = 0; i < YT_HISTORY_MAX + 20; i++) addHistory({ type: "search", title: `q${i}`, at: i + 1 });
    expect(loadHistory()).toHaveLength(YT_HISTORY_MAX);
  });
  it("drops invalid stored data and non-YouTube or credential-bearing URLs", () => {
    localStorage.setItem(YT_HISTORY_KEY, JSON.stringify([{ type: "hack", title: "x", at: 1 }, { type: "mp3", title: "ok", url: "https://evil.com/x", at: 2 }]));
    const l = loadHistory();
    expect(l).toHaveLength(1);
    expect(l[0].url).toBeUndefined();
    addHistory({ type: "mp3", title: "k", url: `${U}&apikey=SECRET`, at: 3 });
    expect(localStorage.getItem(YT_HISTORY_KEY)).not.toContain("SECRET");
  });
  it("removes one and clears all", () => {
    const [a] = addHistory({ type: "search", title: "a", at: 1 });
    addHistory({ type: "search", title: "b", at: 2 });
    expect(removeHistory(a.id === loadHistory()[0].id ? loadHistory()[1].id : a.id)).toHaveLength(1);
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});
