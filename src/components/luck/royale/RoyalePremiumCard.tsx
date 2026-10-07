import { Crown } from "lucide-react";

interface Props {
  isActive: boolean;
  activeUntil: string | null;
  price: number;
  onBuy: () => void;
  onEnter?: () => void;
}

/** Nyawa Premium pass — price comes from the server `check` response. */
export default function RoyalePremiumCard({ isActive, activeUntil, price, onBuy, onEnter }: Props) {
  return (
    <div className="royale-gold-border relative overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-500/[0.12] via-black/30 to-amber-500/[0.1] p-4">
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="relative flex items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-amber-200 to-amber-600 shadow-lg shadow-amber-500/30">
          <Crown className="h-6 w-6 text-amber-950" fill="currentColor" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-black tracking-[0.2em] text-white">👑 PREMIUM ROYALE</p>
          <p className="text-[11px] text-white/60">Better rewards. Higher rarity pool.</p>
          {isActive ? (
            <p className="mt-1 text-[10px] font-bold text-emerald-300">
              AKTIF sampai {activeUntil ? new Date(activeUntil).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"} WIB
            </p>
          ) : (
            <p className="mt-1 text-[11px] font-black text-amber-200">Rp {price.toLocaleString("id-ID")} <span className="font-semibold text-white/50">· saldo + PIN</span></p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={isActive ? onEnter : onBuy}
        disabled={isActive && !onEnter}
        className="royale-spin-btn relative mt-3 h-11 w-full rounded-xl text-[12px] font-black tracking-[0.2em] disabled:hidden"
      >
        {isActive ? "ENTER PREMIUM" : "UNLOCK PREMIUM"}
      </button>
    </div>
  );
}
