import { describe, it, expect } from "vitest";
import { validateDepositAmount, digitsOnly, depositStatusMeta, bonusForApprovedDeposit, QUICK_AMOUNTS } from "@/components/deposit/depositLogic";

describe("deposit nominal validation", () => {
  it.each(QUICK_AMOUNTS.map((v) => [v]))("quick amount %i is valid", (v) => expect(validateDepositAmount(String(v))).toEqual({ amount: v, error: null }));
  it("custom amount", () => expect(validateDepositAmount("75000").error).toBeNull());
  it("empty", () => expect(validateDepositAmount("").error).toMatch(/Masukkan/));
  it("zero", () => expect(validateDepositAmount("0").error).toBeTruthy());
  it("negative sign stripped, below min rejected", () => { expect(digitsOnly("-500")).toBe("500"); expect(validateDepositAmount("-500").error).toMatch(/Minimal/); });
  it("letters ignored", () => { expect(digitsOnly("abc")).toBe(""); expect(validateDepositAmount("abc").error).toMatch(/Masukkan/); expect(validateDepositAmount("5o000").amount).toBe(5000); });
  it("very large rejected", () => expect(validateDepositAmount("999999999").error).toMatch(/Maksimal/));
  it("status meta", () => { expect(depositStatusMeta("pending").dot).toBe("🟡"); expect(depositStatusMeta("approved").dot).toBe("🟢"); expect(depositStatusMeta("rejected").dot).toBe("🔴"); expect(depositStatusMeta("cancelled").dot).toBe("⚪"); });
  it("bonus mirrors server rule", () => { expect(bonusForApprovedDeposit(9999)).toBe(0); expect(bonusForApprovedDeposit(50000)).toBe(5000); });
});
