import { describe, expect, it } from "vitest";
import { CONFESS_MESSAGE_MAX, displayLocalPhone, formatWibDateTime, maskConfessPhone, normalizeConfessPhone, rupiahC } from "@/components/confess/confessCheckoutLogic";

describe("confess checkout helpers", () => {
  it("normalizes Indonesian WhatsApp numbers like the server", () => {
    expect(normalizeConfessPhone("0812-3456-7890")).toBe("6281234567890");
    expect(normalizeConfessPhone("+62 812 3456 7890")).toBe("6281234567890");
    expect(normalizeConfessPhone("81234567890")).toBe("6281234567890");
    expect(normalizeConfessPhone("123")).toBeNull();
    expect(normalizeConfessPhone("")).toBeNull();
  });
  it("masks and displays phones without exposing full number", () => {
    expect(displayLocalPhone("6281234567890")).toBe("081234567890");
    expect(maskConfessPhone("6281234567890")).toBe("0812****890");
  });
  it("formats rupiah and WIB time", () => {
    expect(rupiahC(7000)).toBe("Rp7.000");
    expect(rupiahC(null)).toBe("Rp0");
    expect(formatWibDateTime("2026-10-08T07:32:00Z")).toContain("14.32");
    expect(formatWibDateTime("2026-10-08T07:32:00Z")).toContain("WIB");
    expect(formatWibDateTime(null)).toBe("-");
  });
  it("uses the backend message limit", () => {
    expect(CONFESS_MESSAGE_MAX).toBe(800);
  });
});
