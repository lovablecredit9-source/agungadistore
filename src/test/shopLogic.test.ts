import { describe, it, expect } from "vitest";
import { toggleCompare, unitPrice, cartPromo, recommend, flashProgress } from "@/components/seller/shopLogic";

describe("shop rules", () => {
  it("bandingkan maksimal 3 produk", () => {
    const r = toggleCompare(["a", "b", "c"], "d");
    expect(r.list).toEqual(["a", "b", "c"]);
    expect(r.error).toBeTruthy();
    expect(toggleCompare(["a", "b"], "c").list).toEqual(["a", "b", "c"]);
  });
  it("harga satuan: flash > promo > normal", () => {
    expect(unitPrice({ id: "1", price: 10000, promo_price: 8000 }, { flash_price: 5000 })).toBe(5000);
    expect(unitPrice({ id: "1", price: 10000, promo_price: 8000 })).toBe(8000);
    expect(unitPrice({ id: "1", price: 10000, promo_price: 12000 })).toBe(10000);
  });
  it("promo keranjang: tambah Rp kekurangan menuju minimum voucher", () => {
    const r = cartPromo(40000, [{ code: "HEMAT", min_purchase: 50000, discount_type: "fixed", discount_value: 5000 }]);
    expect(r.next).toEqual({ code: "HEMAT", need: 10000 });
    expect(r.best).toBeNull();
  });
  it("rekomendasi kosong bila tak ada produk (tanpa dummy)", () => {
    expect(recommend([], {}).items).toEqual([]);
  });
  it("badge hampir habis saat terjual >= 80%", () => {
    expect(flashProgress({ sold: 8, flash_stock: 10 }).almostGone).toBe(true);
    expect(flashProgress({ sold: 7, flash_stock: 10 }).almostGone).toBe(false);
  });
});
