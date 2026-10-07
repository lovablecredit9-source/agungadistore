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

/** Karaoke fill 0..1 for a line: spans the estimated sung length, never past the next line. */
export function karaokeProgress(lines: CinematicLyricLine[], idx: number, t: number, duration: number) {
  if (idx < 0 || idx >= lines.length) return 0;
  const start = lines[idx].time_seconds;
  const next = idx + 1 < lines.length ? lines[idx + 1].time_seconds : Math.max(start + 4, duration || start + 4);
  const words = lines[idx].text.trim().split(/\s+/).filter(Boolean).length || 1;
  const span = Math.max(0.6, Math.min((next - start) * 0.95, words * 0.55 + 0.8));
  return Math.max(0, Math.min(1, (t - start) / span));
}

