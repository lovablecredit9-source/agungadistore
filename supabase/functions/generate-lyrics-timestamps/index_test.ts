import { assertEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { alignLyricsToTranscript, sanitizeLyricsText } from "./index.ts";

Deno.test("sanitizeLyricsText removes existing LRC timestamps", () => {
  const result = sanitizeLyricsText("[00:12.00]Dan terjadi lagi\n[00:15.50]Kisah lama yang terulang kembali");

  assertEquals(result, "Dan terjadi lagi\nKisah lama yang terulang kembali");
});

Deno.test("alignLyricsToTranscript keeps provided lyrics while borrowing audio timing", () => {
  const lyrics = [
    "Dan terjadi lagi",
    "Kisah lama yang terulang kembali",
    "Kau terluka lagi",
    "Dari cinta murni yang kau jalani",
  ].join("\n");

  const transcript = [
    "[00:23.23]Dan terjadi lagi",
    "[00:32.48]Kisah lama yang terulang kembali",
    "[00:41.31]Kau terluka lagi",
    "[00:48.33]Dari cinta rumit yang kau jalani",
  ].join("\n");

  const result = alignLyricsToTranscript(lyrics, transcript);
  const lines = result.split("\n");

  assertEquals(lines.length, 4);
  assertMatch(lines[0], /^\[00:23\.23\]Dan terjadi lagi$/);
  assertMatch(lines[1], /^\[00:32\.48\]Kisah lama yang terulang kembali$/);
  assertMatch(lines[2], /^\[00:41\.31\]Kau terluka lagi$/);
  assertMatch(lines[3], /^\[00:48\.33\]Dari cinta murni yang kau jalani$/);
});