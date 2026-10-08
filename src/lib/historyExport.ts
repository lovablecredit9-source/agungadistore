/** Aturan ekspor Riwayat (PDF/CSV/Word) yang bisa diuji tanpa browser. */

export interface ExportableItem {
  amount?: number;
  meta?: Record<string, string | number | undefined>;
}

/** Nama file aman: tanpa karakter ilegal/kontrol, tanpa ekstensi ganda, panjang dibatasi. */
export function sanitizeExportFileName(input: string | null | undefined, fallback: string, ext: string): string {
  const e = ext.replace(/^\./, "").toLowerCase();
  let name = String(input ?? "").trim();
  // Buang ekstensi yang diketik user (mis. "laporan.pdf" atau "laporan.PDF.pdf").
  const extRe = new RegExp(`(\\.${e})+$`, "i");
  name = name.replace(extRe, "");
  name = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/:*?"<>|]+/g, "_")
    .replace(/\s+/g, " ")
    .replace(/^[.\s]+|[.\s]+$/g, "")
    .slice(0, 120)
    .trim();
  if (!name) name = sanitizeExportFileName(fallback, "riwayat", e).replace(extRe, "");
  return `${name}.${e}`;
}

/** Tanggal & jam dalam WIB (Asia/Jakarta), terlepas dari zona waktu perangkat. */
export function formatWib(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  const s = new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(d);
  return `${s.replace(/\./g, ":")} WIB`;
}

/**
 * Nominal untuk ekspor. `counted` = ikut dihitung di total masuk/keluar (hanya `amount` bertanda).
 * Nominal dari meta (mis. deposit yang belum disetujui) ditampilkan tanpa tanda dan tidak dihitung.
 */
export function exportAmountOf(it: ExportableItem): { value: number; counted: boolean } {
  if (typeof it.amount === "number" && it.amount !== 0) return { value: it.amount, counted: true };
  const raw = it.meta?.deposit_amount ?? it.meta?.nominal ?? it.meta?.jumlah;
  if (typeof raw === "number") return { value: Math.abs(raw), counted: false };
  if (typeof raw === "string") {
    const n = Number(raw.replace(/[^0-9-]/g, ""));
    return { value: Number.isFinite(n) ? Math.abs(n) : 0, counted: false };
  }
  return { value: 0, counted: false };
}

export function formatExportAmountText(it: ExportableItem, fmt: (n: number) => string): string {
  const { value, counted } = exportAmountOf(it);
  if (value === 0) return "-";
  if (!counted) return fmt(value);
  return `${value > 0 ? "+" : "-"}${fmt(Math.abs(value))}`;
}

/** Total dari item yang sedang diekspor (hasil filter). */
export function exportTotals(items: ExportableItem[]) {
  let totalIn = 0, totalOut = 0;
  for (const it of items) {
    const a = typeof it.amount === "number" ? it.amount : 0;
    if (a > 0) totalIn += a; else if (a < 0) totalOut += -a;
  }
  return { count: items.length, totalIn, totalOut };
}
