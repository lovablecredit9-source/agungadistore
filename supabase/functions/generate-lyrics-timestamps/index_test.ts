import { assertEquals, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { alignLyricsToTranscript, applyOnsetCompensationToLrc, sanitizeLyricsText } from "./index.ts";

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

Deno.test("alignLyricsToTranscript fills unmatched repeated lines progressively", () => {
  const lyrics = [
    "Aku ingin..",
    "Kau merasa",
    "Kamu mengerti aku mengerti kamu",
    "Aku ingin",
    "Kau pahami",
    "Cintamu bukanlah dia",
  ].join("\n");

  const transcript = [
    "[01:29.50]Aku ingin kau merasa",
    "[01:36.80]Kamu mengerti aku mengerti kamu",
    "[01:44.20]Aku ingin",
    "[01:47.80]Kau pahami",
    "[01:51.50]Cintamu bukanlah dia",
  ].join("\n");

  const result = alignLyricsToTranscript(lyrics, transcript).split("\n");

  assertMatch(result[0], /^\[01:29\.50\]Aku ingin\.\.$/);
  assertMatch(result[1], /^\[01:33\.15\]Kau merasa$/);
  assertMatch(result[2], /^\[01:36\.80\]Kamu mengerti aku mengerti kamu$/);
  assertMatch(result[3], /^\[01:44\.20\]Aku ingin$/);
  assertMatch(result[4], /^\[01:47\.80\]Kau pahami$/);
  assertMatch(result[5], /^\[01:51\.50\]Cintamu bukanlah dia$/);
});

Deno.test("applyOnsetCompensationToLrc nudges valid timestamps slightly earlier without reordering", () => {
  const result = applyOnsetCompensationToLrc([
    "[00:10.00]Dan terjadi lagi",
    "[00:14.00]Kisah lama yang terulang kembali",
    "[00:18.00]Kau terluka lagi",
  ].join("\n")).split("\n");

  assertMatch(result[0], /^\[00:09\.5\d\]Dan terjadi lagi$/);
  assertMatch(result[1], /^\[00:13\.5\d\]Kisah lama yang terulang kembali$/);
  assertMatch(result[2], /^\[00:17\.5\d\]Kau terluka lagi$/);
});