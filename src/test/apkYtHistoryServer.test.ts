import { describe, expect, it } from "vitest";
import { sanitizeEntry } from "../../supabase/functions/apk-premium/history.ts";

const U = "https://www.youtube.com/watch?v=abc";

describe("apk youtube history (server sanitizer)", () => {
  it("never stores a media link for a failed conversion", () => {
    const e = sanitizeEntry({ type: "mp3", title: "x", url: U, status: "fail", media_url: "https://cdn.example.com/a.mp3" });
    expect(e?.media_url).toBeNull();
  });
  it("keeps https media link for successful conversion with matching kind", () => {
    const e = sanitizeEntry({ type: "mp4", title: "x", url: U, status: "ok", media_url: "https://cdn.example.com/a.mp4" });
    expect(e?.media_url).toBe("https://cdn.example.com/a.mp4");
    expect(e?.media_kind).toBe("video");
  });
  it("rejects data: URLs and links carrying api keys", () => {
    expect(sanitizeEntry({ type: "mp3", title: "x", status: "ok", media_url: "data:audio/mp3;base64,AAA" })?.media_url).toBeNull();
    expect(sanitizeEntry({ type: "mp3", title: "x", status: "ok", media_url: "https://p.com/a.mp3?apikey=SECRET" })?.media_url).toBeNull();
  });
  it("rejects non-YouTube source URLs and unknown types", () => {
    expect(sanitizeEntry({ type: "mp3", title: "x", url: "https://evil.com/v" })?.url).toBeNull();
    expect(sanitizeEntry({ type: "drop", title: "x" })).toBeNull();
  });
  it("dedupes searches case-insensitively and separates MP4 qualities", () => {
    expect(sanitizeEntry({ type: "search", title: "Lofi" })?.dedupe_key).toBe(sanitizeEntry({ type: "search", title: " lofi " })?.dedupe_key);
    expect(sanitizeEntry({ type: "mp4", title: "v", url: U, quality: "360" })?.dedupe_key).not.toBe(sanitizeEntry({ type: "mp4", title: "v", url: U, quality: "720" })?.dedupe_key);
  });
});
