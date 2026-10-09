import { describe, it, expect } from "vitest";
import { sanitizeSearchQuery, userSearchOrFilter, mergeUserResults, extraAccountIds } from "../../supabase/functions/_shared/admin-search";
import { SEARCH_MSG, normalizeSearchInput, classifySearchFailure, isTransientFailure } from "../components/admin/userSearchLogic";

describe("admin user search", () => {
  it("strips filter-breaking characters and trims", () => {
    expect(sanitizeSearchQuery("  adimuy ")).toBe("adimuy");
    expect(sanitizeSearchQuery("a%b,c(d)*e\\f")).toBe("abcdef");
    expect(sanitizeSearchQuery(null)).toBe("");
    expect(sanitizeSearchQuery("x".repeat(200))).toHaveLength(80);
  });
  it("searches username, phone, email and visitor id case-insensitively", () => {
    const f = userSearchOrFilter("Adi");
    expect(f).toBe("username.ilike.%Adi%,phone.ilike.%Adi%,email.ilike.%Adi%,visitor_id.ilike.%Adi%");
    expect(f.match(/ilike/g)).toHaveLength(4);
  });
  it("adds device-history accounts without duplicates", () => {
    const direct = [{ id: "a" }, { id: "b" }];
    const hist = [{ user_balance_id: "b" }, { user_balance_id: "c" }, { user_balance_id: null }, { user_balance_id: "c" }];
    expect(extraAccountIds(hist, direct)).toEqual(["c"]);
    expect(mergeUserResults(direct, [{ id: "c" }, { id: "a" }])).toEqual([{ id: "a" }, { id: "b" }, { id: "c" }]);
  });
  it("caps merged results", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ id: String(i) }));
    expect(mergeUserResults(many, [], 20)).toHaveLength(20);
  });
});

describe("User Control Center search messages", () => {
  it("trims whitespace but keeps the typed case", () => {
    expect(normalizeSearchInput(" Adimuy ")).toBe("Adimuy");
    expect(normalizeSearchInput("   ")).toBe("");
  });
  it("permission failures say the admin has no permission", () => {
    expect(classifySearchFailure(401)).toBe("Anda tidak memiliki izin untuk mencari pengguna.");
    expect(classifySearchFailure(403)).toBe("Anda tidak memiliki izin untuk mencari pengguna.");
  });
  it("server failures say search is having problems", () => {
    expect(classifySearchFailure(500)).toBe("Pencarian sedang bermasalah. Coba lagi.");
    expect(classifySearchFailure(546)).toBe("Pencarian sedang bermasalah. Coba lagi.");
  });
  it("only server/network failures are retried", () => {
    expect(isTransientFailure(503)).toBe(true);
    expect(isTransientFailure(null)).toBe(true);
    expect(isTransientFailure(403)).toBe(false);
  });
  it("not-found and empty messages match the spec", () => {
    expect(SEARCH_MSG.notFound).toBe("Pengguna tidak ditemukan.");
    expect(SEARCH_MSG.empty).toBe("Masukkan username, email, atau ID.");
  });
});

import { previewSplit } from "../components/streak/paymentSplit";
import { presenceLabel } from "../components/support/useAdminOnline";
describe("streak payment split preview (mirror of _account_pay)", () => {
  it("auto uses Saldo IN first then Saldo Utama", () => {
    expect(previewSplit(10000, "auto", 4000, 20000)).toMatchObject({ fromGame: 4000, fromMain: 6000, gameAfter: 0, mainAfter: 14000, ok: true });
  });
  it("single source fails when that balance is short", () => {
    expect(previewSplit(1000, "game", 500, 99999).ok).toBe(false);
    expect(previewSplit(1000, "main", 99999, 999).ok).toBe(false);
  });
});
describe("admin presence label", () => {
  it("null last seen shows 'belum tersedia', never 'belum pernah aktif'", () => {
    expect(presenceLabel({ online: false, lastSeen: null }, "Admin").text).toBe("Status admin belum tersedia");
  });
  it("online shows active now", () => {
    expect(presenceLabel({ online: true, lastSeen: null }, "Admin").text).toBe("Admin aktif sekarang");
  });
});
