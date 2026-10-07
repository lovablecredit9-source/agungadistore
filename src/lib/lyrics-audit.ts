// Aturan audit lirik (dipakai Admin Musik). Murni, tanpa akses jaringan.
export type LyricsReviewStatus = "unchecked" | "synced" | "needs_review" | "missing" | "mismatch" | "instrumental";

export interface LyricLine { time_seconds: number; text: string; line_order: number }

// Menerima [mm:ss.xx], [mm:ss:xx] (format rusak umum) dan [mm:ss].
const LRC_RE = /^\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]\s*(.*)$/;

export function parseLrcText(text: string): { lines: LyricLine[]; untimed: number } {
  const lines: LyricLine[] = [];
  let untimed = 0;
  text.split("\n").map((l) => l.trim()).filter(Boolean).forEach((raw) => {
    const m = raw.match(LRC_RE);
    if (!m) { untimed += 1; lines.push({ time_seconds: -1, text: raw, line_order: lines.length }); return; }
    const frac = m[3] ? Number(`0.${m[3]}`) : 0;
    lines.push({ time_seconds: Math.round((Number(m[1]) * 60 + Number(m[2]) + frac) * 100) / 100, text: m[4].trim(), line_order: lines.length });
  });
  return { lines, untimed };
}

export function validateLyricLines(lines: LyricLine[], durationSeconds?: number | null): string[] {
  const issues: string[] = [];
  if (!lines.length) return ["Lirik kosong"];
  const sorted = [...lines].sort((a, b) => a.line_order - b.line_order);
  sorted.forEach((l, i) => {
    const n = i + 1;
    if (l.time_seconds < 0) issues.push(`Baris ${n}: tanpa timestamp / negatif`);
    if (durationSeconds && durationSeconds > 0 && l.time_seconds > durationSeconds) issues.push(`Baris ${n}: melebihi durasi audio`);
    if (i > 0 && l.time_seconds <= sorted[i - 1].time_seconds) issues.push(`Baris ${n}: timestamp mundur/duplikat`);
    if (/^\[\d{1,2}:\d{2}/.test(l.text)) issues.push(`Baris ${n}: tag waktu rusak di teks`);
    if (!l.text.trim()) issues.push(`Baris ${n}: teks kosong`);
  });
  return issues;
}

export function formatLrcTime(t: number) {
  const m = Math.floor(t / 60);
  return `${String(m).padStart(2, "0")}:${(t - m * 60).toFixed(2).padStart(5, "0")}`;
}

export const STATUS_META: Record<LyricsReviewStatus, { label: string; dot: string }> = {
  synced: { label: "Synced", dot: "🟢" },
  needs_review: { label: "Needs Review", dot: "🟡" },
  missing: { label: "Missing", dot: "🔴" },
  mismatch: { label: "Audio Mismatch", dot: "⚠️" },
  instrumental: { label: "Instrumental", dot: "🎵" },
  unchecked: { label: "Belum dicek", dot: "⚪" },
};

/** True when gaps between lines are almost identical: a sign of "duration divided evenly", not audio timing. */
export function looksEvenlyDistributed(times: number[]) {
  if (times.length < 6) return false;
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  if (avg <= 0) return false;
  const sd = Math.sqrt(gaps.reduce((a, g) => a + (g - avg) ** 2, 0) / gaps.length);
  return sd / avg < 0.08;
}
