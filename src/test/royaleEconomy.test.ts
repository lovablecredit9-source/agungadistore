import { describe, it, expect } from "vitest";
import {
  normalizePool, pickPrize, ratesFor, RARITIES, NORMAL_BUNDLES, SINGLE_COST_GEMS, PREMIUM_PACKS, NORMAL_DAILY_DISCOUNT,
  applyStreakBonus, streakMultiplier, MEGA_POOL, isSpinCreditKind, type Mode,
} from "../../supabase/functions/_shared/royale-economy";
import { RAW_NORMAL_PRIZES, RAW_PREMIUM_PRIZES } from "../../supabase/functions/luck-royale-nyawa/prizePools";

function rng(seed: number) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const NORMAL = normalizePool(RAW_NORMAL_PRIZES);
const PREMIUM = normalizePool(RAW_PREMIUM_PRIZES);

function simulate(mode: Mode, n: number, opts: { lucky?: boolean; streak?: boolean; seed?: number; ticketPaid?: boolean } = {}) {
  const base = mode === "premium" ? PREMIUM : NORMAL;
  const pool = opts.ticketPaid ? base.filter((p) => !isSpinCreditKind(p.kind)) : base;
  const r = rng(opts.seed ?? 42);
  const cnt: Record<string, number> = Object.fromEntries(RARITIES.map((k) => [k, 0]));
  const sum: Record<string, number> = {};
  let ultra = 0, jackpot = 0, streak = 0, megaPool = 5000;
  const cost = mode === "premium" ? PREMIUM_PACKS[1] : SINGLE_COST_GEMS;
  for (let i = 0; i < n; i++) {
    const p = pickPrize(pool, mode, !!opts.lucky, r);
    const value = opts.streak ? applyStreakBonus(p, streak) : p.value;
    cnt[p.rarity]++;
    sum[p.kind] = (sum[p.kind] || 0) + value;
    if (p.ultra) ultra++;
    megaPool += Math.floor(cost * MEGA_POOL.contributionPct);
    if (p.rarity === "mythic" && megaPool >= MEGA_POOL.minBreak && r() < MEGA_POOL.breakChance) {
      const won = Math.floor(megaPool * MEGA_POOL.payoutPct); megaPool -= won; jackpot++; sum.jackpot_gems = (sum.jackpot_gems || 0) + won;
    }
    streak = p.rarity === "common" ? 0 : streak + 1;
  }
  const pct = Object.fromEntries(RARITIES.map((k) => [k, +(cnt[k] / n * 100).toFixed(2)]));
  const avg = (k: string) => +((sum[k] || 0) / n).toFixed(3);
  return {
    n, cost, cnt, pct, ultra, jackpot,
    gemsPerSpin: avg("gems"), jackpotGemsPerSpin: avg("jackpot_gems"),
    nyawa: avg("extra_life"), hint: avg("auto_hint"), coins: avg("streak_coins"), credits: avg("game_credits"),
    saldoInRp: avg("game_balance"),
    normalTickets: avg("spin_ticket_normal"), premiumTickets: avg("spin_ticket_premium"), luckyTokens: avg("lucky_token"),
  };
}

const report: Record<string, unknown> = {};

describe("Lucky Royale economy", () => {
  it("prices: bundles never beat 20% off, daily discount stays sane", () => {
    for (const b of NORMAL_BUNDLES) {
      const per = b.cost / b.count;
      expect(per).toBeGreaterThanOrEqual(SINGLE_COST_GEMS * 0.8);
      expect(per).toBeLessThan(SINGLE_COST_GEMS);
    }
    for (const [c, price] of Object.entries(NORMAL_DAILY_DISCOUNT)) expect(price / Number(c)).toBeGreaterThanOrEqual(35);
    for (const [c, price] of Object.entries(PREMIUM_PACKS)) expect(price / Number(c)).toBeGreaterThanOrEqual(75);
  });

  it("rarity is derived from value: no huge reward in common/rare/epic", () => {
    for (const p of [...NORMAL, ...PREMIUM]) {
      if ((p.kind === "extra_life" || p.kind === "auto_hint") && p.value > 50) expect(p.rarity).toBe("mythic");
      if (p.kind === "gems" && p.value > 150) expect(["legendary", "mythic"]).toContain(p.rarity);
      if (p.ultra) expect(p.rarity).toBe("mythic");
    }
  });

  it("streak bonus is capped and never touches gems/jackpots", () => {
    expect(streakMultiplier(300)).toBe(1.2);
    expect(applyStreakBonus({ kind: "gems", value: 100, rarity: "epic" }, 30)).toBe(100);
    expect(applyStreakBonus({ kind: "extra_life", value: 5000, rarity: "mythic" }, 30)).toBe(5000);
    expect(applyStreakBonus({ kind: "extra_life", value: 10, rarity: "rare" }, 30)).toBe(12);
  });

  it("lucky hour only moves common to rare/epic", () => {
    const a = ratesFor("normal", false), b = ratesFor("normal", true);
    expect(b.legendary).toBe(a.legendary); expect(b.mythic).toBe(a.mythic);
    expect(b.common).toBeLessThan(a.common);
  });

  for (const [mode, n] of [["normal", 10000], ["normal", 100000], ["premium", 10000], ["premium", 100000]] as const) {
    it(`simulate ${n} ${mode} spins`, () => {
      const s = simulate(mode, n, { seed: n + (mode === "premium" ? 7 : 0) });
      report[`${mode}_${n}`] = s;
      const target = ratesFor(mode, false);
      for (const k of RARITIES) expect(Math.abs(s.pct[k] / 100 - target[k])).toBeLessThan(n >= 100000 ? 0.005 : 0.015);
      // Gem economy: gems (incl. mega jackpot share) must stay far below spin cost.
      expect(s.gemsPerSpin + s.jackpotGemsPerSpin).toBeLessThan(s.cost * 0.3);
      // Ticket loop: expected free spins per paid spin must stay small.
      expect(s.normalTickets + s.premiumTickets + s.luckyTokens).toBeLessThan(0.12);
    });
  }

  it("variants: lucky hour, streak, ticket-paid", () => {
    const lucky = simulate("normal", 100000, { lucky: true, seed: 5 });
    const streak = simulate("normal", 100000, { streak: true, seed: 6 });
    const ticket = simulate("normal", 100000, { ticketPaid: true, seed: 8 });
    report.normal_luckyHour = lucky; report.normal_streak = streak; report.normal_ticketPaid = ticket;
    expect(lucky.pct.legendary).toBeLessThan(3);
    expect(lucky.gemsPerSpin).toBeLessThan(25);
    expect(ticket.normalTickets + ticket.premiumTickets + ticket.luckyTokens).toBe(0);
  });

  it("batch size does not change per-spin odds", () => {
    for (const size of [1, 5, 10, 20, 100, 200]) {
      const runs = Math.ceil(20000 / size);
      const s = simulate("normal", runs * size, { seed: size });
      report[`batch_${size}`] = s.pct;
      expect(Math.abs(s.pct.common - 62)).toBeLessThan(1.5);
    }
    // eslint-disable-next-line no-console
    console.log("ROYALE_REPORT " + JSON.stringify(report));
  });
});
