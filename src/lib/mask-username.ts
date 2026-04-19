// Mask sebagian username untuk privasi pemain lain di leaderboard/feed publik.
// Contoh: "agungadi" -> "agu***di", "abc" -> "a***c", kosong -> "?????".
export function maskUsername(name: string | null | undefined, fallback = "?????"): string {
  const value = (name ?? "").trim();
  if (!value) return fallback;
  if (value.length <= 2) return value[0] + "***";
  if (value.length <= 4) return value[0] + "***" + value[value.length - 1];
  return value.slice(0, 3) + "***" + value.slice(-2);
}
