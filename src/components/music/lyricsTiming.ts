export interface CinematicLyricLine {
  id: string;
  time_seconds: number;
  text: string;
}

/** Index of the last line whose timestamp is <= t (binary search), -1 before the first line. */
export function findActiveLyricIndex(lines: CinematicLyricLine[], t: number) {
  let lo = 0, hi = lines.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (lines[mid].time_seconds <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

/** Suku kata kasar (kelompok huruf vokal); kata panjang dinyanyikan lebih lama daripada kata pendek. */
export function syllableCount(word: string) {
  return Math.max(1, (word.toLowerCase().match(/[aiueoy]+/g) || []).length);
}

/**
 * Karaoke fill 0..1 for a line. Line start comes from the stored (audio-aligned) timestamp; the sweep
 * inside the line is an estimate weighted by syllables because per-word timestamps are not stored.
 * Never runs past the next line's start.
 */
export function karaokeProgress(lines: CinematicLyricLine[], idx: number, t: number, duration: number) {
  if (idx < 0 || idx >= lines.length) return 0;
  const start = lines[idx].time_seconds;
  const next = idx + 1 < lines.length ? lines[idx + 1].time_seconds : Math.max(start + 4, duration || start + 4);
  const syl = lines[idx].text.trim().split(/\s+/).filter(Boolean).reduce((n, w) => n + syllableCount(w), 0) || 1;
  const span = Math.max(0.6, Math.min(Math.max(0.6, next - start) * 0.95, syl * 0.26 + 0.6));
  return Math.max(0, Math.min(1, (t - start) / span));
}

/** Waktu yang benar-benar terdengar: audio.currentTime dikurangi latensi output yang valid, tidak pernah negatif. */
export function heardTime(currentTime: number, outputLatency: number) {
  const ct = Number.isFinite(currentTime) && currentTime > 0 ? currentTime : 0;
  const lat = Number.isFinite(outputLatency) && outputLatency > 0 && outputLatency < 0.6 ? outputLatency : 0;
  return Math.max(0, ct - lat);
}

/** Hanya lirik berstatus "synced" (diverifikasi audio/admin) yang boleh tampil sebagai karaoke tepat. */
export function isTimingVerified(status: string | null | undefined) {
  return status === "synced";
}

