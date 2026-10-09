// Aturan pesan pencarian User Control Center (murni, diuji di src/test/adminSearch.test.ts).

export const SEARCH_MSG = {
  empty: "Masukkan username, email, atau ID.",
  notFound: "Pengguna tidak ditemukan.",
  forbidden: "Anda tidak memiliki izin untuk mencari pengguna.",
  backend: "Pencarian sedang bermasalah. Coba lagi.",
  network: "Koneksi ke server gagal. Periksa internet lalu coba lagi.",
} as const;

/** Trim spasi di awal/akhir; huruf besar/kecil dibiarkan (server mencocokkan tanpa beda huruf). */
export function normalizeSearchInput(raw: string): string {
  return String(raw ?? "").trim();
}

/** Ubah status HTTP gagal menjadi pesan aman untuk admin (tanpa SQL/stack trace). */
export function classifySearchFailure(status: number | null | undefined): string {
  if (status === 401 || status === 403) return SEARCH_MSG.forbidden;
  if (!status) return SEARCH_MSG.network;
  return SEARCH_MSG.backend;
}

/** Gagal sementara (server sibuk/timeout/jaringan) boleh dicoba ulang sekali. */
export function isTransientFailure(status: number | null | undefined): boolean {
  return !status || status >= 500;
}
