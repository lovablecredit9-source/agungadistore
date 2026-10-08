import { useEffect, useRef } from "react";
import { Lock, X, Delete, Loader2, KeyRound, ShieldCheck } from "lucide-react";

interface Props {
  productTitle: string;
  total: number;
  balanceAfter: number | null;
  pin: string;
  onPinChange: (pin: string) => void;
  onConfirm: () => void;
  onClose: () => void;
  onForgot: () => void;
  busy: boolean;
  error: string;
  /** Changes on every failed attempt to replay the shake animation. */
  errorKey: number;
}

const rp = (n: number) => "Rp" + Math.max(0, Math.round(n)).toLocaleString("id-ID");

/** Premium payment PIN sheet. Pure UI: PIN verification/payment stays in the caller. */
export default function PaymentPinModal({ productTitle, total, balanceAfter, pin, onPinChange, onConfirm, onClose, onForgot, busy, error, errorKey }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, [errorKey]);

  const press = (d: string) => { if (!busy && pin.length < 6) onPinChange(pin + d); };
  const back = () => { if (!busy) onPinChange(pin.slice(0, -1)); };
  const canSubmit = pin.length === 6 && !busy;

  return (
    <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Konfirmasi Pembayaran"
        className="relative w-full sm:max-w-sm bg-card border border-border/60 rounded-t-3xl sm:rounded-3xl shadow-2xl px-5 pt-5 max-h-[96dvh] overflow-y-auto animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-300"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
        onClick={e => { e.stopPropagation(); inputRef.current?.focus(); }}>
        <button aria-label="Tutup" disabled={busy} onClick={onClose} className="absolute top-3 right-3 w-7 h-7 rounded-full bg-muted/70 text-muted-foreground flex items-center justify-center hover:text-foreground transition disabled:opacity-40"><X className="w-3.5 h-3.5" /></button>

        <div className="flex flex-col items-center text-center gap-1.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
            <Lock className="w-5 h-5 text-primary-foreground" strokeWidth={2.2} />
          </div>
          <h3 className="font-extrabold text-lg leading-tight">Konfirmasi Pembayaran</h3>
          <p className="text-xs text-muted-foreground">Masukkan PIN untuk menyelesaikan pembelian</p>
        </div>

        <div className="mt-4 rounded-2xl bg-muted/50 border border-border/60 p-3 space-y-1.5 text-xs">
          <div className="flex justify-between gap-3"><span className="text-muted-foreground shrink-0">Pembayaran</span><span className="font-semibold">Saldo</span></div>
          <div className="flex justify-between gap-3"><span className="text-muted-foreground shrink-0">Produk</span><span className="font-semibold text-right line-clamp-2 break-words">{productTitle}</span></div>
          <div className="flex justify-between gap-3 border-t border-border/60 pt-1.5"><span className="text-muted-foreground">Total</span><span className="font-extrabold text-primary text-sm">{rp(total)}</span></div>
          {balanceAfter !== null && <div className="flex justify-between gap-3"><span className="text-muted-foreground">Saldo setelah pembayaran</span><span className="font-semibold">{rp(balanceAfter)}</span></div>}
        </div>

        {/* Hidden real input: keyboard typing + numeric keyboard; value never rendered. */}
        <input ref={inputRef} type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={6} aria-label="PIN 6 digit"
          value={pin} disabled={busy}
          onChange={e => onPinChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={e => { if (e.key === "Enter" && canSubmit) onConfirm(); }}
          className="absolute opacity-0 w-px h-px pointer-events-none" />

        <div key={errorKey} className={`mt-4 flex justify-center gap-2 ${error ? "pin-shake" : ""}`}>
          {Array.from({ length: 6 }).map((_, i) => {
            const filled = i < pin.length; const active = i === pin.length && !busy;
            return (
              <div key={i} className={`w-11 h-12 rounded-xl border-2 flex items-center justify-center transition-all duration-150 ${error ? "border-destructive/70" : filled ? "border-primary bg-primary/10" : active ? "border-primary/60" : "border-border"}`}>
                {filled && <span className="w-2.5 h-2.5 rounded-full bg-foreground animate-in zoom-in-50 duration-150" />}
              </div>
            );
          })}
        </div>

        <div className="h-9 flex flex-col items-center justify-center" aria-live="polite">
          {error ? <><p className="text-xs font-bold text-destructive leading-tight">{error}</p><p className="text-[11px] text-muted-foreground leading-tight">Silakan coba lagi.</p></>
            : <p className="text-[11px] text-muted-foreground flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> PIN terenkripsi & tidak disimpan</p>}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map(d => (
            <button key={d} type="button" onClick={() => press(d)} disabled={busy} className="h-12 rounded-2xl bg-muted/60 text-lg font-bold hover:bg-muted active:scale-95 active:bg-primary/15 transition disabled:opacity-50">{d}</button>
          ))}
          <span />
          <button type="button" onClick={() => press("0")} disabled={busy} className="h-12 rounded-2xl bg-muted/60 text-lg font-bold hover:bg-muted active:scale-95 active:bg-primary/15 transition disabled:opacity-50">0</button>
          <button type="button" aria-label="Hapus digit" onClick={back} disabled={busy || !pin} className="h-12 rounded-2xl flex items-center justify-center text-muted-foreground hover:bg-muted active:scale-95 transition disabled:opacity-40"><Delete className="w-5 h-5" /></button>
        </div>

        <button type="button" onClick={onForgot} disabled={busy} className="mx-auto mt-3 flex items-center gap-1 text-xs font-semibold text-accent hover:underline disabled:opacity-50">
          <KeyRound className="w-3.5 h-3.5" /> Lupa PIN?
        </button>

        <button type="button" onClick={onConfirm} disabled={!canSubmit}
          className="mt-3 w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/30 active:scale-[0.98] transition disabled:opacity-50 disabled:shadow-none">
          {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</> : <><Lock className="w-4 h-4" /> Konfirmasi Pembayaran</>}
        </button>
      </div>
    </div>
  );
}
