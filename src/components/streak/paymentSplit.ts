// Pratinjau pembagian bayar — cermin dari RPC `_account_pay` (server tetap penentu akhir).
export type PaySource = "auto" | "game" | "main";
export interface SplitPreview { fromGame: number; fromMain: number; gameAfter: number; mainAfter: number; ok: boolean; error?: string }

export function previewSplit(price: number, source: PaySource, game: number, main: number): SplitPreview {
  let g = 0, m = 0;
  if (source === "game") g = price;
  else if (source === "main") m = price;
  else { g = Math.min(game, price); m = price - g; }
  const ok = g <= game && m <= main;
  const error = ok ? undefined : source === "game" ? "Saldo IN tidak cukup" : source === "main" ? "Saldo Utama tidak cukup" : "Saldo tidak cukup";
  return { fromGame: g, fromMain: m, gameAfter: game - g, mainAfter: main - m, ok, error };
}
