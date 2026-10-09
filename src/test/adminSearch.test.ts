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
