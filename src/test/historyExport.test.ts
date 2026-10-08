import { describe, expect, it } from "vitest";
import { exportAmountOf, exportTotals, formatExportAmountText, formatWib, sanitizeExportFileName } from "@/lib/historyExport";

const fmt = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

describe("nama file ekspor", () => {
  it("menambah .pdf satu kali saja", () => {
    expect(sanitizeExportFileName("riwayat-transaksi-test", "x", "pdf")).toBe("riwayat-transaksi-test.pdf");
    expect(sanitizeExportFileName("laporan.pdf", "x", "pdf")).toBe("laporan.pdf");
    expect(sanitizeExportFileName("laporan.PDF.pdf", "x", "pdf")).toBe("laporan.pdf");
  });
  it("membersihkan karakter ilegal dan nama kosong memakai default", () => {
    expect(sanitizeExportFileName('riwayat:kategori*test', "x", "pdf")).toBe("riwayat_kategori_test.pdf");
    expect(sanitizeExportFileName("   ", "riwayat-saldo-1", "pdf")).toBe("riwayat-saldo-1.pdf");
    expect(sanitizeExportFileName("..", "riwayat-saldo-1", "pdf")).toBe("riwayat-saldo-1.pdf");
  });
});

describe("nominal & total ekspor", () => {
  const rows = [
    { amount: 50000 },
    { amount: -12000 },
    { amount: 0, meta: { deposit_amount: 75000, status: "pending" } },
  ];
  it("deposit belum disetujui tampil tanpa tanda dan tidak dihitung", () => {
    expect(exportAmountOf(rows[2])).toEqual({ value: 75000, counted: false });
    expect(formatExportAmountText(rows[2], fmt)).toBe("Rp 75.000");
    expect(formatExportAmountText(rows[1], fmt)).toBe("-Rp 12.000");
    expect(formatExportAmountText(rows[0], fmt)).toBe("+Rp 50.000");
  });
  it("total hanya dari baris yang diekspor", () => {
    expect(exportTotals(rows)).toEqual({ count: 3, totalIn: 50000, totalOut: 12000 });
    expect(exportTotals(rows.slice(1, 2))).toEqual({ count: 1, totalIn: 0, totalOut: 12000 });
  });
});

describe("waktu WIB", () => {
  it("selalu Asia/Jakarta", () => {
    expect(formatWib("2026-10-06T15:53:00Z")).toBe("06/10/2026, 22:53:00 WIB");
    expect(formatWib("bukan tanggal")).toBe("-");
  });
});
