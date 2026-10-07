// Shared, testable pieces of the existing Music player state (PlaylistTab).
const VOLUME_KEY = "music_player_volume_v1";

export function clampVolume(v: unknown) {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 1;
  return Math.max(0, Math.min(1, n));
}

export function loadPlayerVolume(): { volume: number; muted: boolean } {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (!raw) return { volume: 1, muted: false };
    const p = JSON.parse(raw);
    return { volume: clampVolume(p?.volume), muted: p?.muted === true };
  } catch {
    return { volume: 1, muted: false };
  }
}

export function savePlayerVolume(volume: number, muted: boolean) {
  try { localStorage.setItem(VOLUME_KEY, JSON.stringify({ volume: clampVolume(volume), muted: !!muted })); } catch { void 0; }
}

/** Next song index: sequential with wrap-around, or a random *different* song when shuffle is on. */
export function pickNextIndex(fromIndex: number, length: number, shuffle: boolean, rand: () => number = Math.random) {
  if (length <= 0) return -1;
  if (!shuffle) return fromIndex < length - 1 ? fromIndex + 1 : 0;
  if (length === 1) return 0;
  const r = Math.floor(rand() * (length - 1));
  return r >= fromIndex && fromIndex >= 0 ? r + 1 : r;
}
