import { describe, it, expect } from "vitest";
import { getFunctionError } from "@/lib/functionError";

describe("getFunctionError", () => {
  it("prefers server data.error", () => {
    expect(getFunctionError(new Error("Edge Function returned a non-2xx status code"), { error: "Gem tidak cukup" })).toBe("Gem tidak cukup");
  });
  it("never surfaces the generic non-2xx text", () => {
    expect(getFunctionError(new Error("Edge Function returned a non-2xx status code"), null)).not.toMatch(/non-2xx/);
  });
  it("keeps specific error messages", () => {
    expect(getFunctionError(new Error("PIN salah"))).toBe("PIN salah");
  });
});
