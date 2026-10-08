export interface SummaryInput { kind: string; rarity: string; value: number; label?: string }

export interface KindTotal { kind: string; title: string; emoji: string; hits: number; total: number; isMoney: boolean }

const KIND_META: Record<string, { title: string; emoji: string; money?: boolean }> = {
  gems: { title: "Gem", emoji: "💎" },
  auto_hint: { title: "Hint", emoji: "💡" },
  extra_life: { title: "Nyawa", emoji: "❤️" },
  time_freeze: { title: "Time Freeze", emoji: "⏱️" },
  streak_freeze: { title: "Streak Freeze", emoji: "🧊" },
  streak_coins: { title: "Koin Streak", emoji: "🪙" },
  game_credits: { title: "Kredit", emoji: "🎮" },
  game_balance: { title: "Saldo IN", emoji: "💵", money: true },
  voucher: { title: "Voucher", emoji: "🎟️" },
  tickets: { title: "Tiket", emoji: "🎫" },
  lucky_token: { title: "Token Shop", emoji: "🎟️" },
};

export const RARITY_ORDER = ["mythic", "legendary", "epic", "rare", "common"] as const;

/** Counts rarities and sums reward values per kind — only from server results. */
export function summarizeSpin(results: SummaryInput[]) {
  const rarity: Record<string, number> = {};
  const map = new Map<string, KindTotal>();
  for (const r of results) {
    rarity[r.rarity] = (rarity[r.rarity] || 0) + 1;
    const meta = KIND_META[r.kind] || { title: r.kind.replace(/_/g, " "), emoji: "🎁" };
    const cur = map.get(r.kind) || { kind: r.kind, title: meta.title, emoji: meta.emoji, hits: 0, total: 0, isMoney: !!meta.money };
    cur.hits += 1;
    cur.total += Number.isFinite(Number(r.value)) ? Number(r.value) : 0;
    map.set(r.kind, cur);
  }
  const kinds = [...map.values()].sort((a, b) => b.hits - a.hits);
  return { count: results.length, rarity, kinds };
}

export function formatKindTotal(k: KindTotal) {
  const n = k.total.toLocaleString("id-ID");
  return k.isMoney ? `+Rp${n}` : `+${n}`;
}
