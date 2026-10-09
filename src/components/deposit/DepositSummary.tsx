import { useEffect, useState } from "react";
import { Gift, Loader2, Wallet, ShieldCheck, Clock, XCircle, Ban } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatRupiah } from "./depositLogic";

export type BonusPreview = { amount?: number; bonus: number; total_saldo_in: number; bonus_percent: number; min_bonus_amount: number };

/** Preview pembagian dari server (`get_deposit_bonus_preview` = aturan yang sama dengan `admin_approve_deposit`). */
export function useDepositPreview(amount: number, enabled = true) {
  const [preview, setPreview] = useState<BonusPreview | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setPreview(null);
    if (!enabled || !amount || amount <= 0) return;
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("get_deposit_bonus_preview" as never, { p_amount: amount } as never);
      if (!cancelled) { setPreview((data as BonusPreview) ?? null); setLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); setLoading(false); };
  }, [amount, enabled]);
  return { preview, loading };
}

const STATUS: Record<string, { label: string; saldo: string; icon: typeof Clock; tone: string }> = {
  pending: { label: "Menunggu Verifikasi", saldo: "Belum bertambah", icon: Clock, tone: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30" },
  approved: { label: "Pembayaran Terverifikasi", saldo: "Sudah masuk", icon: ShieldCheck, tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  rejected: { label: "Pembayaran Ditolak", saldo: "Tidak bertambah", icon: XCircle, tone: "text-destructive bg-destructive/10 border-destructive/30" },
  cancelled: { label: "Deposit Dibatalkan", saldo: "Tidak bertambah", icon: Ban, tone: "text-muted-foreground bg-muted border-border" },
};

interface Props {
  amount: number;
  preview: BonusPreview | null;
  loading?: boolean;
  /** status deposit dari server; kosong = belum dibuat */
  status?: string;
}

export default function DepositSummary({ amount, preview, loading, status }: Props) {
  const bonus = preview?.bonus ?? 0;
  const st = status ? STATUS[status] ?? STATUS.pending : null;
  const received = status === "rejected" || status === "cancelled";
  return (
    <div className="dep-summary relative rounded-2xl p-[1px]">
      <div className="relative rounded-2xl bg-card/90 backdrop-blur-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-black tracking-[0.2em] text-primary uppercase">Deposit Summary</p>
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" aria-label="Menghitung" />}
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-xs text-muted-foreground">Total Pembayaran</span>
          <span className="text-lg font-black tabular-nums text-foreground">{formatRupiah(amount)}</span>
        </div>
        <div className="space-y-2 rounded-xl bg-muted/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-xs text-foreground min-w-0"><span className="w-7 h-7 shrink-0 rounded-lg bg-emerald-500/15 flex items-center justify-center"><Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /></span><span className="truncate">Masuk Saldo Utama</span></span>
            <span className="text-sm font-extrabold tabular-nums text-emerald-600 dark:text-emerald-400">+{formatRupiah(amount)}</span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-xs text-foreground min-w-0"><span className="w-7 h-7 shrink-0 rounded-lg bg-cyan-500/15 flex items-center justify-center"><Gift className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" /></span><span className="truncate">Bonus Saldo IN{preview && preview.bonus > 0 ? ` (${preview.bonus_percent}%)` : ""}</span></span>
            <span className="text-sm font-extrabold tabular-nums text-cyan-600 dark:text-cyan-400">{preview ? `+${formatRupiah(bonus)}` : "—"}</span>
          </div>
          {preview && bonus === 0 && amount > 0 && (
            <p className="text-[10px] text-muted-foreground">Bonus Saldo IN berlaku untuk deposit minimal {formatRupiah(preview.min_bonus_amount)}.</p>
          )}
        </div>
        <div className="border-t border-dashed border-border pt-3 flex items-baseline justify-between gap-3">
          <span className="text-xs font-black uppercase tracking-wide text-foreground">Total Diterima</span>
          <span className={`text-xl font-black tabular-nums ${received ? "text-muted-foreground line-through" : "text-foreground"}`}>{preview ? formatRupiah(amount + bonus) : formatRupiah(amount)}</span>
        </div>
        {st ? (
          <div className={`rounded-xl border px-3 py-2 text-[11px] ${st.tone}`}>
            <p className="flex items-center gap-1.5 font-bold"><st.icon className="w-3.5 h-3.5" /> {st.label}</p>
            <p className="mt-0.5 opacity-90">Saldo: {st.saldo}</p>
          </div>
        ) : (
          <p className="text-[10.5px] text-muted-foreground leading-snug">Saldo akan bertambah setelah pembayaran diverifikasi admin. Bonus dihitung oleh server saat disetujui.</p>
        )}
      </div>
    </div>
  );
}
