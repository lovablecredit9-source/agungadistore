import { describe, expect, it } from "vitest";
import { creditErrorMessage, formatRupiah, planPayment } from "@/components/games/creditShopLogic";

describe("planPayment (cermin aturan server)", () => {
  it("otomatis: Saldo IN dulu, sisanya Saldo Utama", () => {
    expect(planPayment(20000, "auto", 5000, 50000)).toMatchObject({ fromGame: 5000, fromMain: 15000, insufficient: false, label: "Saldo IN + Saldo Utama" });
  });
  it("otomatis: cukup dari Saldo IN", () => {
    expect(planPayment(2000, "auto", 5000, 0)).toMatchObject({ fromGame: 2000, fromMain: 0, label: "Saldo IN" });
  });
  it("Saldo IN saja: kurang -> insufficient", () => {
    expect(planPayment(2000, "game", 1500, 999999).insufficient).toBe(true);
  });
  it("Saldo Utama saja", () => {
    expect(planPayment(2000, "main", 99999, 2000)).toMatchObject({ fromMain: 2000, fromGame: 0, insufficient: false });
  });
  it("otomatis total kurang", () => {
    expect(planPayment(100000, "auto", 1500, 48000).insufficient).toBe(true);
  });
  it("gratis", () => {
    expect(planPayment(0, "main", 0, 0)).toMatchObject({ insufficient: false, label: "Gratis" });
  });
});

describe("creditErrorMessage", () => {
  it("memetakan error ke pesan ramah", () => {
    expect(creditErrorMessage("PIN salah")).toBe("PIN salah. Silakan coba lagi.");
    expect(creditErrorMessage("network")).toMatch(/Koneksi bermasalah/);
    expect(creditErrorMessage("Voucher sudah habis dipakai.")).toMatch(/Voucher tidak valid/);
    expect(creditErrorMessage("duplicate key value violates unique constraint")).toBe("Transaksi gagal diproses. Silakan coba lagi.");
  });
  it("format rupiah", () => {
    expect(formatRupiah(14139000)).toBe("Rp14.139.000");
  });
});
