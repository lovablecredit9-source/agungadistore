import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { summarizeSpin, formatKindTotal } from "@/components/luck/royale/spinSummary";
import RoyaleSpinControls, { type SpinOption } from "@/components/luck/royale/RoyaleSpinControls";

const opt = (count: number): SpinOption => ({ count, label: `${count} SPIN`, gemCost: count * 40, ticketUsed: 0 });

describe("summarizeSpin", () => {
  it("separates hit count from total value and counts rarities", () => {
    const s = summarizeSpin([
      { kind: "gems", rarity: "rare", value: 50 },
      { kind: "gems", rarity: "common", value: 50 },
      { kind: "gems", rarity: "common", value: 50 },
      { kind: "game_balance", rarity: "epic", value: 2500 },
      { kind: "game_balance", rarity: "legendary", value: 2500 },
    ]);
    expect(s.count).toBe(5);
    expect(s.rarity).toEqual({ rare: 1, common: 2, epic: 1, legendary: 1 });
    const gem = s.kinds.find((k) => k.kind === "gems")!;
    expect(gem.hits).toBe(3);
    expect(gem.total).toBe(150);
    expect(formatKindTotal(gem)).toBe("+150");
    expect(formatKindTotal(s.kinds.find((k) => k.kind === "game_balance")!)).toBe("+Rp5.000");
  });

  it("rarity counts sum to result length for 500 results", () => {
    const rs = Array.from({ length: 500 }, (_, i) => ({ kind: "gems", rarity: ["common", "rare", "epic"][i % 3], value: 1 }));
    const s = summarizeSpin(rs);
    expect(Object.values(s.rarity).reduce((a, b) => a + b, 0)).toBe(500);
    expect(s.kinds[0].total).toBe(500);
  });
});

describe("RoyaleSpinControls", () => {
  for (const n of [5, 100, 500, 1000]) {
    it(`selecting ${n} sends count ${n}`, () => {
      const onSpin = vi.fn();
      render(<RoyaleSpinControls single={opt(1)} bundles={[5, 10, 100, 500, 1000].map(opt)} spinning={false} onSpin={onSpin} />);
      fireEvent.click(screen.getByRole("radio", { name: new RegExp(`^${n} SPIN`) }));
      const cta = screen.getByRole("button", { name: new RegExp(`SPIN ${n.toLocaleString("id-ID")}×`) });
      fireEvent.click(cta);
      expect(onSpin).toHaveBeenCalledWith(n);
    });
  }
  it("defaults to 1 spin", () => {
    const onSpin = vi.fn();
    render(<RoyaleSpinControls single={opt(1)} bundles={[opt(5)]} spinning={false} onSpin={onSpin} />);
    fireEvent.click(screen.getByRole("button", { name: /SPIN 1×/ }));
    expect(onSpin).toHaveBeenCalledWith(1);
  });
});
