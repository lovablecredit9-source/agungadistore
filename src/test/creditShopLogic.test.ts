import { describe, expect, it } from "vitest";
import {
  type CreditQuote, bestValuePackageId, creditErrorMessage, formatRupiah, planPayment, pricePerCredit, savingsPct, shortfallMessage,
} from "@/components/games/creditShopLogic";

const q = (o: Partial<CreditQuote>): CreditQuote => ({
  package_id: "x", label: "x", credits: 10, is_unlimited: false, unlimited_days: 0, price: 10000, flash_pct: 0, flash_discount: 0,
  member_pct: 0, member_discount: 0, voucher_discount: 0, voucher_error: null, final_price: 10000, ...o,
});

describe("tampilan paket dari quote server", () => {
  it("harga per kredit memakai final_price server", () => {
    expect(pricePerCredit(q({ credits: 100, price: 80000, final_price: 64000 }))).toBe(640);
    expect(pricePerCredit(q({ is_unlimited: true, credits: 0 }))).toBe(0);
  });
  it("paket worth it = harga per kredit terendah", () => {
    expect(bestValuePackageId([q({ package_id: "a" }), q({ package_id: "b", credits: 100, final_price: 80000 })])).toBe("b");
  });
  it("tanpa dasar data tidak ada rekomendasi", () => {
    expect(bestValuePackageId([q({ package_id: "a" })])).toBeNull();
    expect(bestValuePackageId([q({ package_id: "a" }), q({ package_id: "b", credits: 20, final_price: 20000 })])).toBeNull();
    expect(bestValuePackageId([q({ package_id: "a" }), q({ package_id: "u", is_unlimited: true, credits: 0, final_price: 1 })])).toBeNull();
  });
  it("hemat hanya bila final_price < price", () => {
    expect(savingsPct(q({ price: 20000, final_price: 16000 }))).toBe(20);
    expect(savingsPct(q({}))).toBe(0);
  });
  it("menjelaskan saldo mana yang kurang", () => {
    expect(shortfallMessage(2000, "game", 1500, 9999)).toBe("Saldo IN kurang Rp500");
    expect(shortfallMessage(2000, "main", 9999, 500)).toBe("Saldo Utama kurang Rp1.500");
    expect(shortfallMessage(10000, "auto", 3000, 2000)).toBe("Saldo IN + Saldo Utama kurang Rp5.000");
    expect(shortfallMessage(2000, "auto", 3000, 0)).toBeNull();
  });
});

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
