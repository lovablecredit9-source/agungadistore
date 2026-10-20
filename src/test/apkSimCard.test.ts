import { describe, it, expect } from "vitest";
import { parseSimCard, simCardText, activationFromTenure } from "@/components/apkpremium/simCard";

// Shapes copied from real provider responses (numbers replaced).
const axisRaw = JSON.stringify({
  statusCode: 200, status: true,
  data: {
    msisdn: "6287700000001", operator: "XL", id_verified: "Sudah", net_type: "4G", tenure: "0 Tahun 11 Bulan",
    active_period: "12-02-2027", grace_period: "12-06-2027", volte_status: "inactive",
    package_name: "Bonus Vidio Platinum FlexMax",
    quota_remaining: "247.8GB, 200 Menit, 1440 Menit, 400GB",
    quota_total: "1KB, 400GB, 200 Menit, 1440 Menit, 400GB",
    packages: [{ name: "FlexMax 400GB, 28hr", expiry: "03-11-2026", quotas: [{ name: "Kuota Utama", percent: 61.95, total: "400GB", remaining: "247.8GB" }] }],
  },
});
const triRaw = JSON.stringify({ statusCode: 200, status: true, msisdn: "6289600000001", status_kartu: "Aktif", status_registrasi: "Sudah Registrasi", tanggal_aktivasi: null, tanggal_berakhir: "31 Oct 2026", sisa_hari_aktif: 11, produk: "SP ONLINE1", distribusi: "National" });

describe("kartu hasil Cek Nomor XL/Axis", () => {
  const c = parseSimCard("tools.cekaxis", axisRaw)!;
  const val = (l: string) => c.rows.find((r) => r.label === l)?.value;
  it("menampilkan nomor, masa aktif, sisa & total kuota, VoLTE, paket seperti contoh", () => {
    expect(c.title).toBe("INFO KARTU AXIS / XL");
    expect(val("Nomor")).toBe("6287700000001");
    expect(val("Masa Aktif")).toBe("12-02-2027");
    expect(val("Sisa Kuota")).toBe("247.8GB, 200 Menit, 1440 Menit, 400GB");
    expect(val("Total Kuota")).toBe("1KB, 400GB, 200 Menit, 1440 Menit, 400GB");
    expect(val("VoLTE")).toBe("❌ Tidak Aktif");
    expect(val("Paket")).toBe("Bonus Vidio Platinum FlexMax");
  });
  it("urutan baris pertama sama dengan format bot", () => {
    expect(c.rows.slice(0, 1).map((r) => r.label)).toEqual(["Nomor"]);
    const t = simCardText(c, "Gadu Torang");
    expect(t.startsWith("📱 *INFO KARTU AXIS / XL*")).toBe(true);
    expect(t).toContain("📦 *Sisa Kuota:* 247.8GB, 200 Menit, 1440 Menit, 400GB");
    expect(t).toContain("📶 *VoLTE:* ❌ Tidak Aktif");
    expect(t.endsWith("✅ *Request by:* Gadu Torang")).toBe(true);
  });
  it("tanggal diaktifkan diperkirakan dari umur kartu (0 Tahun 11 Bulan, dicek Okt 2026 = Nov 2025)", () => {
    const c2 = parseSimCard("tools.cekaxis", axisRaw, new Date(2026, 9, 20))!;
    expect(c2.rows.find((r) => r.label === "Diaktifkan")?.value).toBe("± November 2025 (perkiraan dari umur kartu)");
    expect(activationFromTenure("2 Tahun 3 Bulan", new Date(2026, 9, 20))).toBe("± Juli 2024 (perkiraan dari umur kartu)");
    expect(activationFromTenure("tidak jelas")).toBeNull();
  });
  it("VoLTE aktif ditampilkan Aktif", () => {
    const on = parseSimCard("tools.cekaxis", axisRaw.replace('"inactive"', '"active"'))!;
    expect(on.rows.find((r) => r.label === "VoLTE")?.value).toBe("✅ Aktif");
  });
  it("detail paket memakai sisa kuota asli", () => {
    expect(c.packages[0].quotas[0]).toEqual({ name: "Kuota Utama", percent: 61.95, total: "400GB", remaining: "247.8GB" });
  });
});

describe("kartu hasil Cek Nomor Tri", () => {
  it("menampilkan status, registrasi, masa aktif dengan sisa hari, produk", () => {
    const c = parseSimCard("tools.cekkartutri", triRaw)!;
    const val = (l: string) => c.rows.find((r) => r.label === l)?.value;
    expect(c.title).toBe("INFO KARTU TRI (3)");
    expect(val("Status Kartu")).toBe("Aktif");
    expect(val("Masa Aktif")).toBe("31 Oct 2026 (11 hari lagi)");
    expect(val("Produk")).toBe("SP ONLINE1");
    expect(val("Diaktifkan")).toBe("Tidak diberikan penyedia");
    const withDate = parseSimCard("tools.cekkartutri", triRaw.replace('"tanggal_aktivasi":null', '"tanggal_aktivasi":"12 Jan 2024"'))!;
    expect(withDate.rows.find((r) => r.label === "Diaktifkan")?.value).toBe("12 Jan 2024");
  });
});

describe("tidak membuat kartu palsu", () => {
  it("respons gagal, rusak, atau fitur lain tidak jadi kartu", () => {
    expect(parseSimCard("tools.cekaxis", JSON.stringify({ status: false, message: "x" }))).toBeNull();
    expect(parseSimCard("tools.cekaxis", "bukan json")).toBeNull();
    expect(parseSimCard("tools.cekaxis", JSON.stringify({ status: true, data: {} }))).toBeNull();
    expect(parseSimCard("search.youtube", axisRaw)).toBeNull();
  });
});
