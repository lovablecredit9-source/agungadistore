import { Crown, ChevronRight, Lock, Gem } from "lucide-react";
import { motion } from "framer-motion";
import type { PremiumInfo } from "@/hooks/useStorePremium";
import { formatWib, gemMembershipActive, remainingParts, storePremiumHomeState, type GemSub } from "./membershipHomeState";

interface PremiumProps {
  premium: Pick<PremiumInfo, "isPremium" | "isLocked" | "expiresAt" | "planName" | "daysLeft" | "lockedUntil">;
  /** Active benefit count from the admin benefit config; null = unknown, so not shown. */
  activeBenefitCount: number | null;
  onOpen: () => void;
  now?: number;
}

/** 👑 Membership Premium Toko card for Beranda/Saldo. Reads backend state only. */
export function StorePremiumHomeCard({ premium, activeBenefitCount, onOpen, now = Date.now() }: PremiumProps) {
  const state = storePremiumHomeState(premium, now);
  const active = state === "active" || state === "ending";
  const left = remainingParts(premium.expiresAt, now);
  const until = formatWib(premium.expiresAt);

  if (state === "locked") {
    return (
      <button type="button" onClick={onOpen} data-testid="store-premium-card" data-state="locked"
        className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-amber-500/30 bg-card p-3 text-left">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground"><Lock className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-500">Membership Premium</span>
          <span className="block truncate text-sm font-bold text-foreground">Premium dikunci</span>
          {premium.lockedUntil && <span className="block truncate text-[11px] text-muted-foreground">Sampai {formatWib(premium.lockedUntil)}</span>}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    );
  }

  if (!active) {
    return (
      <button type="button" onClick={onOpen} data-testid="store-premium-card" data-state="none"
        className="flex w-full min-w-0 items-center gap-3 rounded-2xl border border-dashed border-amber-500/40 bg-card p-3 text-left transition hover:border-amber-500/70">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-500"><Crown className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-500">Membership Premium</span>
          <span className="block truncate text-sm font-bold text-foreground">Belum aktif</span>
          <span className="block truncate text-[11px] text-muted-foreground">Dapatkan benefit Premium Toko</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-amber-500/40 px-2.5 py-1.5 text-[11px] font-bold text-amber-500">
          Lihat Paket <ChevronRight className="h-3 w-3" />
        </span>
      </button>
    );
  }

  return (
    <motion.button
      type="button" onClick={onOpen} data-testid="store-premium-card" data-state={state}
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} whileTap={{ scale: 0.98 }}
      className="relative block w-full min-w-0 overflow-hidden rounded-2xl p-[1.5px] text-left bg-gradient-to-br from-amber-200 via-amber-500 to-yellow-300 shadow-[0_10px_30px_-12px_rgba(245,158,11,0.55)]"
      aria-label={`Membership Premium ${premium.planName ?? ""} aktif, buka detail`}
    >
      <div className="relative overflow-hidden rounded-[15px] bg-gradient-to-br from-amber-950/95 via-stone-950/95 to-amber-900/90 p-3.5 backdrop-blur-xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-400/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 left-6 h-24 w-24 rounded-full bg-yellow-300/10 blur-2xl" />
        <div className="relative flex items-start gap-3">
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-yellow-200 via-amber-400 to-orange-600 text-amber-950 shadow-lg">
            <Crown className="h-6 w-6" strokeWidth={2.4} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[10px] font-extrabold uppercase tracking-[0.16em] text-amber-300">Membership Premium</span>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black ${state === "ending" ? "bg-orange-500 text-orange-50" : "bg-amber-300 text-amber-950"}`}>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                {state === "ending" ? "SEGERA BERAKHIR" : "AKTIF"}
              </span>
            </div>
            <p className="mt-0.5 truncate text-[15px] font-black text-amber-50">{premium.planName ?? "Premium Toko"}</p>
          </div>
        </div>
        <div className="relative mt-3 grid grid-cols-2 gap-2">
          <div className="min-w-0 rounded-xl border border-amber-300/15 bg-black/20 px-2.5 py-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-amber-200/70">Sisa</p>
            <p className="truncate text-sm font-black text-amber-50">{premium.daysLeft} hari</p>
            <p className="truncate text-[10px] text-amber-100/60">{left.days}h {left.hours}j {left.minutes}m</p>
          </div>
          <div className="min-w-0 rounded-xl border border-amber-300/15 bg-black/20 px-2.5 py-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-amber-200/70">Aktif sampai</p>
            <p className="text-[11px] font-bold leading-tight text-amber-50">{until}</p>
          </div>
        </div>
        <div className="relative mt-2.5 flex items-center justify-between gap-2 text-[11px] font-bold text-amber-200">
          <span className="truncate">{activeBenefitCount && activeBenefitCount > 0 ? `${activeBenefitCount} benefit aktif` : "Membership Premium aktif"}</span>
          <span className="inline-flex shrink-0 items-center gap-0.5">Lihat Membership <ChevronRight className="h-3.5 w-3.5" /></span>
        </div>
      </div>
    </motion.button>
  );
}

interface GemProps { sub: GemSub | null; loaded: boolean; onOpen: () => void; now?: number }

/** 💎 Membership Gem / Streak card — mirrors the existing streak_subscriptions rule. */
export function GemMembershipHomeCard({ sub, loaded, onOpen, now = Date.now() }: GemProps) {
  const active = gemMembershipActive(sub, now);
  const left = remainingParts(sub?.expires_at ?? null, now);
  return (
    <button type="button" onClick={onOpen} data-testid="gem-membership-card" data-state={active ? "active" : "none"}
      className={`flex w-full min-w-0 items-center gap-3 rounded-2xl border p-3 text-left ${active ? "border-cyan-400/40 bg-gradient-to-br from-cyan-500/15 via-blue-600/10 to-violet-600/15" : "border-dashed border-cyan-400/30 bg-card"}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 text-primary-foreground"><Gem className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[10px] font-extrabold uppercase tracking-[0.16em] text-cyan-500">Membership Gem / Streak</span>
          {active && <span className="shrink-0 rounded-full bg-cyan-400 px-1.5 py-0.5 text-[8px] font-black text-cyan-950">AKTIF</span>}
        </span>
        <span className="block truncate text-sm font-bold text-foreground">{!loaded ? "Memuat…" : active ? sub?.plan_name ?? "Membership Gem" : "Belum aktif"}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{active ? `Sisa ${left.days} hari ${left.hours} jam · s/d ${formatWib(sub!.expires_at)}` : "Bonus gem & koin streak"}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
