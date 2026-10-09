import { useEffect, useState, type ReactNode } from "react";
import { X, Copy, Check, CalendarDays, Clock, ArrowUpCircle, ArrowDownCircle, Landmark, Loader2, Ban, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { depositStatusMeta, bonusForApprovedDeposit } from "@/components/deposit/depositLogic";

const TZ = "Asia/Jakarta";
export function formatTxDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "—", day: "—", time: "—", full: "—" };
  const date = d.toLocaleDateString("id-ID", { timeZone: TZ, day: "numeric", month: "long", year: "numeric" });
  const day = d.toLocaleDateString("id-ID", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = `${d.toLocaleTimeString("id-ID", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).replace(":", ".")} WIB`;
  return { date, day, time, full: `${date}, ${time}` };
}

function Shell({ onClose, children, z = "z-[88]", label }: { onClose: () => void; children: ReactNode; z?: string; label: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={label} className={`fixed inset-0 ${z} flex items-center justify-center bg-background/70 p-4 backdrop-blur-md`} onClick={onClose}>
      <div className="relative max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-3xl border border-border bg-card p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={onClose} aria-label="Tutup" className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        {children}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right text-xs font-semibold text-foreground">{children}</span>
    </div>
  );
}

function CopyId({ id }: { id: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">ID Transaksi</p>
        <p className="truncate font-mono text-xs font-bold text-foreground">{id}</p>
      </div>
      <button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(id); setDone(true); toast({ title: "✓ ID transaksi berhasil disalin" }); setTimeout(() => setDone(false), 1800); }
        catch { toast({ title: "Gagal menyalin ID", variant: "destructive" }); }
      }} className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary">
        {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} {done ? "Disalin" : "Salin"}
      </button>
    </div>
  );
}

function TimeBlock({ iso }: { iso: string }) {
  const f = formatTxDate(iso);
  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-3">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Waktu Transaksi</p>
      <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><CalendarDays className="h-4 w-4 text-primary" /> {f.day}</p>
      <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-foreground"><Clock className="h-4 w-4 text-primary" /> {f.time}</p>
    </div>
  );
}

export interface TxDetail { id: string; type: string; amount: number; description: string | null; created_at: string; trx_id: string | null }

export function TransactionDetailModal({ tx, income, label, formatPrice, onClose }: { tx: TxDetail; income: boolean; label: string; formatPrice: (n: number) => string; onClose: () => void }) {
  const bonus = tx.type === "topup_bonus";
  const tone = bonus ? "text-amber-500" : income ? "text-accent" : "text-destructive";
  const bg = bonus ? "bg-amber-500/15" : income ? "bg-accent/15" : "bg-destructive/10";
  return (
    <Shell onClose={onClose} label="Detail Transaksi" z="z-[70]">
      <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Detail Transaksi</p>
      <div className={`mx-auto mt-3 flex h-16 w-16 items-center justify-center rounded-3xl ${bg}`}>
        {bonus ? <span className="text-3xl">🎁</span> : income ? <ArrowUpCircle className={`h-9 w-9 ${tone}`} /> : <ArrowDownCircle className={`h-9 w-9 ${tone}`} />}
      </div>
      <p className={`mt-3 text-center text-3xl font-extrabold tracking-tight ${tone}`}>{income ? "+" : "-"}{formatPrice(Math.abs(Number(tx.amount) || 0))}</p>
      <p className="mt-1 text-center text-sm font-semibold text-foreground">{label}</p>
      <div className="mt-2 flex justify-center"><span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-[11px] font-bold text-accent">✅ Berhasil</span></div>
      <div className="mt-4 space-y-3">
        <CopyId id={tx.trx_id || tx.id} />
        <TimeBlock iso={tx.created_at} />
        <div className="divide-y divide-border rounded-2xl border border-border px-3">
          <Row label="Jenis Transaksi">{label}</Row>
          <Row label="Arah">{bonus ? "Bonus" : income ? "Pemasukan" : "Pengeluaran"}</Row>
          <Row label="Nominal">{income ? "+" : "-"}{formatPrice(Math.abs(Number(tx.amount) || 0))}</Row>
          <Row label="Sumber">Saldo Utama</Row>
          {tx.description && <Row label="Deskripsi">{tx.description}</Row>}
        </div>
      </div>
      <button type="button" onClick={onClose} className="mt-4 w-full rounded-2xl bg-muted py-2.5 text-sm font-bold text-foreground">Tutup</button>
    </Shell>
  );
}

export interface DepositDetail { id: string; visitor_id: string; amount: number; payment_method: string; trx_id: string; status: string; created_at: string; cancel_reason?: string | null }

const REASONS = ["Salah nominal", "Salah metode pembayaran", "Tidak jadi melakukan deposit", "Ingin membuat deposit baru", "Lainnya"];

export function DepositDetailModal({ deposit, formatPrice, onClose, onCancelled }: {
  deposit: DepositDetail; formatPrice: (n: number) => string; onClose: () => void; onCancelled: (d: DepositDetail) => void;
}) {
  const [step, setStep] = useState<"detail" | "confirm" | "success" | "error">("detail");
  const [reason, setReason] = useState(REASONS[2]);
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [cancelledAt, setCancelledAt] = useState("");
  const meta = depositStatusMeta(deposit.status);
  const amt = Number(deposit.amount) || 0;
  const b = bonusForApprovedDeposit(amt);

  const doCancel = async () => {
    if (busy) return;
    setBusy(true);
    const finalReason = `Dibatalkan oleh pengguna: ${reason === "Lainnya" ? (other.trim() || "Lainnya") : reason}`.slice(0, 200);
    try {
      const { data, error } = await supabase.functions.invoke("cancel-deposit", { body: { depositId: deposit.id, visitorId: deposit.visitor_id, reason: finalReason } });
      const serverErr = (data as { error?: string } | null)?.error;
      if (error || serverErr) {
        setErrMsg(serverErr && serverErr.length < 160 ? serverErr : "Deposit tidak dapat dibatalkan saat ini. Coba lagi nanti.");
        setStep("error");
        return;
      }
      setCancelledAt(new Date().toISOString());
      onCancelled({ ...deposit, status: "cancelled", cancel_reason: finalReason });
      setStep("success");
    } catch {
      setErrMsg("Koneksi bermasalah. Periksa internet lalu coba lagi.");
      setStep("error");
    } finally { setBusy(false); }
  };

  if (step === "confirm") return (
    <Shell onClose={() => !busy && setStep("detail")} label="Batalkan Deposit" z="z-[90]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-destructive/10"><Ban className="h-7 w-7 text-destructive" /></div>
      <h3 className="mt-3 text-center text-lg font-extrabold text-foreground">Batalkan Deposit?</h3>
      <p className="mt-1 text-center text-xs text-muted-foreground">Apakah kamu yakin ingin membatalkan deposit ini?</p>
      <div className="mt-4 divide-y divide-border rounded-2xl border border-border px-3">
        <Row label="ID"><span className="font-mono">{deposit.trx_id}</span></Row>
        <Row label="Nominal">{formatPrice(amt)}</Row>
        <Row label="Metode">{deposit.payment_method}</Row>
      </div>
      <fieldset className="mt-3 space-y-1.5" disabled={busy}>
        <legend className="mb-1 text-[11px] font-bold text-muted-foreground">Alasan pembatalan</legend>
        {REASONS.map((r) => (
          <label key={r} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs ${reason === r ? "border-primary bg-primary/5 text-foreground" : "border-border text-muted-foreground"}`}>
            <input type="radio" name="cancel-reason" className="accent-primary" checked={reason === r} onChange={() => setReason(r)} /> {r}
          </label>
        ))}
        {reason === "Lainnya" && (
          <input value={other} onChange={(e) => setOther(e.target.value)} maxLength={120} placeholder="Tulis alasan…" className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground" />
        )}
      </fieldset>
      <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] font-semibold text-amber-600 dark:text-amber-400"><AlertTriangle className="h-3.5 w-3.5" /> Tindakan ini tidak dapat dibatalkan.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={() => setStep("detail")} className="rounded-2xl bg-muted py-2.5 text-sm font-bold text-foreground disabled:opacity-50">Kembali</button>
        <button type="button" disabled={busy} onClick={doCancel} className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-destructive py-2.5 text-sm font-bold text-destructive-foreground disabled:opacity-70">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Membatalkan…</> : "Ya, Batalkan"}
        </button>
      </div>
    </Shell>
  );

  if (step === "success") return (
    <Shell onClose={onClose} label="Deposit dibatalkan" z="z-[90]">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-accent/15 animate-in zoom-in-50 duration-300"><Check className="h-9 w-9 text-accent" strokeWidth={3} /></div>
      <h3 className="mt-3 text-center text-lg font-extrabold uppercase tracking-wide text-foreground">Deposit Dibatalkan</h3>
      <p className="mt-1 text-center text-xs text-muted-foreground">Deposit berhasil dibatalkan.</p>
      <div className="mt-4 divide-y divide-border rounded-2xl border border-border px-3">
        <Row label="Nominal">{formatPrice(amt)}</Row>
        <Row label="ID"><span className="font-mono">{deposit.trx_id}</span></Row>
        <Row label="Status">🚫 Dibatalkan</Row>
        <Row label="Waktu">{formatTxDate(cancelledAt).time}</Row>
      </div>
      <button type="button" onClick={onClose} className="mt-4 w-full rounded-2xl bg-primary py-2.5 text-sm font-bold text-primary-foreground">Selesai</button>
    </Shell>
  );

  if (step === "error") return (
    <Shell onClose={() => setStep("detail")} label="Gagal membatalkan" z="z-[90]">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-destructive/10 animate-in zoom-in-75 duration-200"><X className="h-7 w-7 text-destructive" /></div>
      <h3 className="mt-3 text-center text-lg font-extrabold text-foreground">Gagal Membatalkan</h3>
      <p className="mt-2 rounded-xl bg-destructive/10 px-3 py-2 text-center text-xs text-destructive">{errMsg}</p>
      <button type="button" onClick={() => setStep("detail")} className="mt-4 w-full rounded-2xl bg-muted py-2.5 text-sm font-bold text-foreground">Tutup</button>
    </Shell>
  );

  return (
    <Shell onClose={onClose} label="Detail Deposit">
      <p className="text-center text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Detail Deposit</p>
      <div className="mx-auto mt-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10"><Landmark className="h-8 w-8 text-primary" /></div>
      <p className="mt-3 text-center text-3xl font-extrabold tracking-tight text-foreground">{formatPrice(amt)}</p>
      <div className="mt-2 flex justify-center"><span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${meta.tone}`}>{meta.dot} {meta.labelId}</span></div>
      <div className="mt-4 space-y-3">
        <CopyId id={deposit.trx_id} />
        <TimeBlock iso={deposit.created_at} />
        <div className="divide-y divide-border rounded-2xl border border-border px-3">
          <Row label="Nominal">{formatPrice(amt)}</Row>
          <Row label="Metode">{deposit.payment_method}</Row>
          <Row label="Status">{meta.dot} {meta.labelId}</Row>
          <Row label="Dibuat">{formatTxDate(deposit.created_at).full}</Row>
        </div>
        <DepositSummary amount={amt} preview={preview} status={deposit.status} />
        <DepositProofUpload depositId={deposit.id} visitorId={deposit.visitor_id} status={deposit.status} />
        {deposit.cancel_reason && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{deposit.status === "rejected" ? "Alasan Penolakan" : "Alasan Pembatalan"}</p>
            <p className="mt-0.5 text-xs font-semibold text-destructive">{deposit.cancel_reason}</p>
          </div>
        )}
        {deposit.status === "pending" && (
          <div className="rounded-2xl bg-amber-500/10 p-3 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            <p>⏰ Deposit sedang menunggu konfirmasi admin.</p>
            <p className="mt-0.5">Otomatis dibatalkan jika tidak dikonfirmasi admin dalam 24 jam.</p>
          </div>
        )}
      </div>
      <div className="mt-4 space-y-2">
        {deposit.status === "pending" && (
          <button type="button" onClick={() => setStep("confirm")} className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-destructive/40 bg-destructive/10 py-2.5 text-sm font-bold text-destructive">
            <Ban className="h-4 w-4" /> Batalkan Deposit
          </button>
        )}
        <button type="button" onClick={onClose} className="w-full rounded-2xl bg-muted py-2.5 text-sm font-bold text-foreground">Tutup</button>
      </div>
    </Shell>
  );
}
