import { describe, it, expect } from "vitest";
import { formatRupiah, formatMb, pickBadges } from "@/components/music/musicStorageLogic";

describe("music storage helpers", () => {
  it("format rupiah tanpa spasi", () => {
    expect(formatRupiah(10000)).toBe("Rp10.000");
    expect(formatRupiah(100000)).toBe("Rp100.000");
  });
  it("format kapasitas", () => {
    expect(formatMb(10240)).toBe("10 GB");
    expect(formatMb(512)).toBe("512 MB");
  });
  it("badge hanya bila >1 paket", () => {
    expect(pickBadges([{ id: "a", name: "A", storage_mb: 1024, price: 1 }]).recommendedId).toBeNull();
    const b = pickBadges([
      { id: "a", name: "A", storage_mb: 1024, price: 10000 },
      { id: "b", name: "B", storage_mb: 5120, price: 30000 },
      { id: "c", name: "C", storage_mb: 10240, price: 80000 },
    ]);
    expect(b.recommendedId).toBe("b");
    expect(b.bestValueId).toBe("b");
  });
});
