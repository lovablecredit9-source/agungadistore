import { Crown } from "lucide-react";
import { formatCompactNumber } from "@/lib/utils";

interface Props {
  gems: number;
  nyawa: number | null;
  streak: number;
  tickets: { normal: number; premium: number };
}

export default function RoyaleHero({ gems, nyawa, streak, tickets }: Props) {
  const chips = [
    { icon: "💎", label: "GEM", value: formatCompactNumber(gems) },
    { icon: "❤️", label: "NYAWA", value: nyawa == null ? "–" : formatCompactNumber(nyawa) },
    { icon: "🔥", label: "STREAK", value: String(streak) },
    { icon: "🎟️", label: "TICKET", value: formatCompactNumber(tickets.normal + tickets.premium) },
  ];
  return (
    <section className="relative overflow-hidden rounded-3xl royale-glass royale-gold-border px-4 pb-4 pt-5 text-center">
      <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 h-40 w-64 -translate-x-1/2 rounded-full bg-amber-400/20 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-10 h-40 w-40 rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="relative">
        <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-b from-amber-300/25 to-orange-500/10 ring-1 ring-amber-300/40">
          <Crown className="h-5 w-5 text-amber-300" fill="currentColor" />
        </div>
        <h1 className="royale-title text-[26px] font-black leading-none tracking-[0.06em] sm:text-3xl">LUCK ROYALE</h1>
        <p className="mt-1 text-[11px] font-black tracking-[0.5em] text-amber-200/80">NYAWA</p>
        <p className="mt-1.5 text-[11px] italic text-white/55">Spin your luck. Claim your reward.</p>
        <div className="mt-3.5 grid grid-cols-4 gap-1.5">
          {chips.map((c) => (
            <div key={c.label} className="min-w-0 rounded-xl border border-white/[0.07] bg-black/25 px-1 py-1.5">
              <div className="text-[13px] leading-none">{c.icon}</div>
              <div className="mt-1 truncate text-[12px] font-black tabular-nums text-white">{c.value}</div>
              <div className="text-[8px] font-bold tracking-[0.15em] text-white/45">{c.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
