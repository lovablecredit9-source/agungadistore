import type { CSSProperties, ReactNode } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export type TxTone = "income" | "expense" | "bonus" | "pending" | "failed" | "neutral";

const TONES: Record<TxTone, { a: string; b: string; icon: string; amount: string; chip: string }> = {
  income: { a: "hsl(152 76% 42% / .9)", b: "hsl(172 80% 40% / .6)", icon: "bg-gradient-to-br from-emerald-500 to-teal-500", amount: "text-emerald-600 dark:text-emerald-400", chip: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" },
  expense: { a: "hsl(350 85% 58% / .9)", b: "hsl(15 90% 58% / .55)", icon: "bg-gradient-to-br from-rose-500 to-orange-500", amount: "text-rose-600 dark:text-rose-400", chip: "bg-rose-500/12 text-rose-700 dark:text-rose-300" },
  bonus: { a: "hsl(40 95% 52% / .9)", b: "hsl(25 95% 55% / .6)", icon: "bg-gradient-to-br from-amber-400 to-orange-500", amount: "text-amber-600 dark:text-amber-400", chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  pending: { a: "hsl(40 95% 52% / .85)", b: "hsl(48 95% 55% / .5)", icon: "bg-gradient-to-br from-amber-400 to-yellow-500", amount: "text-muted-foreground", chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  failed: { a: "hsl(350 70% 55% / .7)", b: "hsl(220 10% 55% / .4)", icon: "bg-gradient-to-br from-slate-400 to-rose-500", amount: "text-muted-foreground line-through", chip: "bg-rose-500/12 text-rose-700 dark:text-rose-300" },
  neutral: { a: "hsl(var(--primary) / .8)", b: "hsl(var(--primary) / .4)", icon: "bg-primary", amount: "text-foreground", chip: "bg-muted text-muted-foreground" },
};

interface Props {
  tone: TxTone;
  icon: ReactNode;
  title: string;
  /** label sumber/metode, mis. "Saldo Utama (Pembelian)" */
  source?: string;
  statusLabel?: string;
  trxId?: string | null;
  description?: string | null;
  /** teks nominal sudah terformat, termasuk tanda +/- */
  amountText: string;
  date: string;
  onClick: () => void;
}

/** Kartu transaksi premium untuk Riwayat Saldo & Deposit. Hanya presentasi; data dari pemanggil. */
export default function PremiumTransactionCard({ tone, icon, title, source, statusLabel, trxId, description, amountText, date, onClick }: Props) {
  const t = TONES[tone];
  const d = new Date(date);
  const time = isNaN(+d) ? "" : format(d, "HH:mm");
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ "--hx-a": t.a, "--hx-b": t.b } as CSSProperties}
      className="hx-card hx-in w-full text-left rounded-2xl bg-card/80 backdrop-blur-sm border border-border/40 p-3 flex items-center gap-3 min-w-0"
      aria-label={`${title} ${amountText}${statusLabel ? `, ${statusLabel}` : ""}`}
    >
      <div className={cn("relative shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center text-primary-foreground shadow-md", t.icon)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-bold text-[13px] leading-tight truncate text-foreground">{title}</p>
          <span className={cn("shrink-0 font-extrabold text-[13px] tabular-nums leading-tight", t.amount)}>{amountText}</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 min-w-0">
          {statusLabel && <span className={cn("shrink-0 text-[9.5px] font-bold px-1.5 py-0.5 rounded-full", t.chip)}>{statusLabel}</span>}
          {source && <span className="text-[10px] text-muted-foreground truncate">{source}</span>}
        </div>
        {description && <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{description}</p>}
        <div className="mt-1 flex items-center justify-between gap-2 text-[9.5px] text-muted-foreground">
          {trxId ? <span className="font-mono truncate">ID {trxId}</span> : <span />}
          {time && <span className="shrink-0 tabular-nums">{time}</span>}
        </div>
      </div>
    </button>
  );
}
