import { useEffect, useRef, useState } from "react";
import { Check, ChevronLeft, Copy, History, KeyRound, Loader2, QrCode, ScanLine, Sparkles, Wallet, X, MessageCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { DEPOSIT_STEPS, QUICK_AMOUNTS, digitsOnly, formatRupiah, validateDepositAmount } from "./depositLogic";

export interface EwalletConfig { name: string; number: string; holder?: string; logo?: string }
export interface CreatedDeposit { id: string; trx_id: string; amount: number; payment_method: string; status: string; created_at: string; visitor_id: string }
type Preview = { bonus: number; total_saldo_in: number; bonus_percent: number; min_bonus_amount: number } | null;

interface Props {
  ewallets: EwalletConfig[];
  qrisUrl: string;
  hasPin: boolean;
  onClose: () => void;
  onForgotPin: () => void;
  /** Memanggil create-deposit yang sudah ada. Tidak pernah mengubah saldo. */
  onSubmit: (amount: number, methodLabel: string) => Promise<{ deposit?: CreatedDeposit; error?: string }>;
  onViewHistory: (d: CreatedDeposit) => void;
  onSendWa: (d: CreatedDeposit) => void;
}

function useAnimatedNumber(value: number) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now(); const a = from.current; let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 350);
      const v = Math.round(a + (value - a) * (1 - Math.pow(1 - p, 3)));
      setShown(v); if (p < 1) raf = requestAnimationFrame(tick); else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return shown;
}

function Money({ value, className }: { value: number; className?: string }) {
  return <span className={className}>{formatRupiah(useAnimatedNumber(value))}</span>;
}

export default function PremiumDepositModal({ ewallets, qrisUrl, hasPin, onClose, onForgotPin, onSubmit, onViewHistory, onSendWa }: Props) {
  const [method, setMethod] = useState<string | null>(null);
  const [raw, setRaw] = useState("");
  const [touched, setTouched] = useState(false);
  const [preview, setPreview] = useState<Preview>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedDeposit | null>(null);
  const [copied, setCopied] = useState(false);
  const inFlight = useRef(false);

  const { amount, error } = validateDepositAmount(raw);
  const isQris = method === "qris";
  const ew = ewallets.find((e) => e.name === method);
  const qrisMissing = isQris && !qrisUrl;
  const step = created ? 3 : !method ? 0 : error ? 1 : 2;

  // Preview bonus dari server (satu sumber aturan dengan approval admin).
  useEffect(() => {
    setPreview(null);
    if (error || !amount) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("get_deposit_bonus_preview" as never, { p_amount: amount } as never);
      if (!cancelled && data) setPreview(data);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [amount, error]);

  async function submit() {
    setTouched(true);
    if (inFlight.current || submitting || error || !method || qrisMissing) return;
    inFlight.current = true; setSubmitting(true); setSubmitError(null);
    try {
      const res = await onSubmit(amount, isQris ? "QRIS" : method);
      if (res.error || !res.deposit) setSubmitError(res.error || "Gagal membuat deposit");
      else setCreated(res.deposit);
    } catch (e) {
      setSubmitError(navigator.onLine ? ((e as Error)?.message || "Terjadi kesalahan server") : "Tidak ada koneksi internet");
    } finally {
      inFlight.current = false; setSubmitting(false);
    }
  }

  const bonus = preview?.bonus ?? 0;
  const total = preview?.total_saldo_in ?? amount;

  return (
    <div className="fixed inset-0 z-[80] bg-background/70 backdrop-blur-md flex items-end sm:items-center justify-center" onClick={submitting ? undefined : onClose}>
      <div
        role="dialog" aria-label="Deposit Saldo"
        className="relative w-full sm:max-w-md max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-3xl sm:rounded-3xl border border-primary/25 bg-card/95 backdrop-blur-2xl shadow-[0_0_60px_-15px_hsl(var(--primary)/0.6)] animate-in slide-in-from-bottom sm:zoom-in-95 duration-300"
        style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pointer-events-none absolute -top-24 -right-16 w-56 h-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 w-56 h-56 rounded-full bg-accent/20 blur-3xl" />

        <div className="relative p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {method && !created && (
                <button aria-label="Kembali" onClick={() => setMethod(null)} className="w-9 h-9 rounded-full bg-muted/70 flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
              )}
              <div>
                <p className="text-[10px] font-bold tracking-[0.2em] text-primary uppercase">Deposit Saldo</p>
                <h3 className="font-extrabold text-lg leading-tight">{created ? "Deposit Dibuat" : !method ? "Pilih Metode" : "Nominal & Bayar"}</h3>
              </div>
            </div>
            <button aria-label="Tutup" disabled={submitting} onClick={onClose} className="w-9 h-9 rounded-full bg-muted/70 flex items-center justify-center"><X className="w-4 h-4" /></button>
          </div>

          {/* Step indicator */}
          <ol className="flex items-center gap-1" aria-label="Langkah deposit">
            {DEPOSIT_STEPS.map((s, i) => (
              <li key={s} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black border transition-all ${failed && i === step ? "bg-destructive text-destructive-foreground border-destructive" : i < step ? "bg-primary text-primary-foreground border-primary shadow-[0_0_10px_hsl(var(--primary)/0.5)]" : i === step ? "dep-step-current border-primary text-primary scale-110" : "border-border text-muted-foreground"}`}>
                  {failed && i === step ? <X className="w-3.5 h-3.5" /> : i < step ? <Check className="w-3.5 h-3.5" /> : String(i + 1).padStart(2, "0")}
                </span>
                <span className={`text-[8.5px] leading-tight text-center truncate w-full ${i === step ? "text-foreground font-bold" : "text-muted-foreground"}`}>{s}</span>
              </li>
            ))}
          </ol>

          {created ? (
            /* ---------- SUCCESS ---------- */
            <div className="relative text-center space-y-4 pt-2">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-32 overflow-hidden">
                {Array.from({ length: 14 }).map((_, i) => (
                  <span key={i} className="dep-confetti absolute w-1.5 h-2.5 rounded-sm" style={{ left: `${6 + i * 6.5}%`, top: -4, animationDelay: `${(i % 5) * 0.08}s`, background: `hsl(var(--${["primary", "accent", "primary", "secondary"][i % 4]}))` }} />
                ))}
              </div>
              <div className="relative mx-auto w-24 h-24">
                <div className="dep-ring absolute inset-0 rounded-full" style={{ background: "conic-gradient(hsl(var(--primary)), hsl(var(--accent)), transparent 70%, hsl(var(--primary)))" }} />
                <div className="absolute inset-[4px] rounded-full bg-card flex items-center justify-center">
                  <div className="dep-pop w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-[0_0_24px_hsl(var(--primary)/0.7)]"><Check className="w-8 h-8" strokeWidth={3} /></div>
                </div>
              </div>
              <div>
                <p className="text-sm font-black tracking-wide">🎉 DEPOSIT BERHASIL DIBUAT</p>
                <p className="text-3xl font-black mt-1">{formatRupiah(created.amount)}</p>
                <span className="inline-block mt-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-muted">{created.payment_method}</span>
              </div>
              <div className="rounded-2xl border border-border bg-muted/40 p-3 space-y-2 text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">ID Transaksi</span>
                  <button className="flex items-center gap-1.5 font-mono text-[11px] font-bold break-all text-right" onClick={() => { navigator.clipboard?.writeText(created.trx_id); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                    {created.trx_id} {copied ? <Check className="w-3.5 h-3.5 text-primary shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                </div>
                <div className="flex items-center justify-between"><span className="text-[11px] text-muted-foreground">Status</span><span className="text-[11px] font-bold text-amber-500">🟡 Menunggu Verifikasi</span></div>
                <p className="text-[10.5px] text-muted-foreground leading-snug">Saldo belum bertambah. Saldo masuk setelah admin memverifikasi pembayaran. Otomatis dibatalkan jika tidak dikonfirmasi dalam 24 jam.</p>
              </div>
              <div className="grid gap-2">
                <Button className="w-full h-11 gap-2 font-bold" onClick={() => onSendWa(created)}><MessageCircle className="w-4 h-4" /> Kirim Bukti via WhatsApp</Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="h-11 gap-2" onClick={() => onViewHistory(created)}><History className="w-4 h-4" /> Lihat Riwayat</Button>
                  <Button variant="outline" className="h-11" onClick={onClose}>Tutup</Button>
                </div>
              </div>
            </div>
          ) : !method ? (
            /* ---------- METHOD ---------- */
            <div className="space-y-3">
              {hasPin && (
                <button onClick={onForgotPin} className="text-xs font-bold text-primary flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5" /> Lupa PIN? Reset dari sini</button>
              )}
              <button onClick={() => setMethod("qris")} className="group relative w-full overflow-hidden rounded-2xl border-2 border-primary/40 bg-gradient-to-br from-primary/15 via-card to-accent/10 p-4 text-left transition-all hover:border-primary active:scale-[0.98] shadow-[0_0_30px_-12px_hsl(var(--primary)/0.8)]">
                <span className="absolute top-3 right-3 text-[9px] font-black uppercase tracking-wider bg-primary text-primary-foreground rounded-full px-2 py-0.5">Recommended</span>
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 shrink-0">
                    <div className="dep-ring absolute inset-0 rounded-full" style={{ background: "conic-gradient(hsl(var(--primary)), transparent 60%, hsl(var(--accent)))" }} />
                    <div className="absolute inset-[3px] rounded-full bg-card flex items-center justify-center"><QrCode className="w-6 h-6 text-primary" /></div>
                  </div>
                  <div>
                    <p className="font-black text-base">QRIS</p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1"><ScanLine className="w-3 h-3" /> Scan QR · semua bank & e-wallet</p>
                  </div>
                </div>
              </button>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pt-1">E-Wallet</p>
              {ewallets.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-3 rounded-xl border border-dashed border-border">Belum ada e-wallet dikonfigurasi admin</div>
              ) : (
                <div className="grid gap-2">
                  {ewallets.map((w) => (
                    <button key={w.name} onClick={() => setMethod(w.name)} className="w-full p-3 rounded-2xl border border-border bg-card/60 hover:border-accent/60 active:scale-[0.98] transition-all text-left flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
                        {w.logo ? <img src={w.logo} alt={w.name} className="w-full h-full object-contain bg-background" /> : <Wallet className="w-5 h-5 text-accent" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-sm">{w.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate font-mono">{w.number}{w.holder ? ` · a/n ${w.holder}` : ""}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ---------- AMOUNT + PAY ---------- */
            <div className="space-y-4">
              <div className={`rounded-2xl border-2 p-4 transition-colors ${touched && error ? "border-destructive/60" : "border-primary/40 shadow-[0_0_24px_-10px_hsl(var(--primary)/0.8)]"} bg-background/40`}>
                <label htmlFor="dep-amount" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Nominal Deposit</label>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-black text-muted-foreground">Rp</span>
                  <input
                    id="dep-amount" inputMode="numeric" autoComplete="off" placeholder="0"
                    value={raw ? Number(digitsOnly(raw) || 0).toLocaleString("id-ID") : ""}
                    onChange={(e) => { setRaw(digitsOnly(e.target.value)); setTouched(true); setSubmitError(null); }}
                    onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 250)}
                    className="flex-1 min-w-0 bg-transparent text-3xl font-black tracking-tight outline-none placeholder:text-muted-foreground/50"
                  />
                </div>
                {touched && error && <p className="text-[11px] text-destructive mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {error}</p>}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {QUICK_AMOUNTS.map((v) => {
                  const active = amount === v;
                  return (
                    <button key={v} onClick={() => { setRaw(String(v)); setTouched(true); setSubmitError(null); }}
                      aria-pressed={active}
                      className={`relative rounded-xl border py-2.5 px-1 text-center transition-all active:scale-95 ${active ? "border-primary bg-primary/15 scale-[1.03] shadow-[0_0_14px_hsl(var(--primary)/0.6)]" : "border-border bg-card/60 hover:border-primary/50"}`}>
                      {active && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center"><Check className="w-2.5 h-2.5" strokeWidth={3} /></span>}
                      <Sparkles className={`w-3.5 h-3.5 mx-auto mb-0.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="block text-[11px] font-black">{v >= 1000000 ? `${v / 1000000}jt` : `${v / 1000}rb`}</span>
                    </button>
                  );
                })}
                <button onClick={() => { setRaw(""); document.getElementById("dep-amount")?.focus(); }}
                  className={`rounded-xl border py-2.5 px-1 text-center transition-all active:scale-95 ${raw && !(QUICK_AMOUNTS as readonly number[]).includes(amount) ? "border-primary bg-primary/15" : "border-dashed border-border"}`}>
                  <span className="block text-base leading-none mb-0.5">✏️</span>
                  <span className="block text-[11px] font-black">Custom</span>
                </button>
              </div>

              {/* Payment card */}
              {isQris ? (
                <div className="relative rounded-3xl border border-primary/30 bg-gradient-to-b from-primary/10 to-card p-4 text-center overflow-hidden">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <span key={i} className="dep-particle pointer-events-none absolute w-1 h-1 rounded-full bg-primary" style={{ left: `${10 + i * 15}%`, top: `${i % 2 ? 12 : 85}%`, animationDelay: `${i * 0.5}s` }} />
                  ))}
                  <p className="text-[10px] font-black tracking-[0.25em] text-primary">QRIS PAYMENT</p>
                  {qrisUrl ? (
                    <div className="relative mx-auto my-3 w-[min(19rem,82vw)] aspect-square">
                      <div className="dep-ring absolute -inset-2 rounded-full opacity-80" style={{ background: "conic-gradient(from 0deg, hsl(var(--primary)), transparent 35%, hsl(var(--accent)), transparent 75%, hsl(var(--primary)))", filter: "blur(1px)" }} />
                      <div className="absolute -inset-1 rounded-full bg-card" />
                      {/* Area QR: putih bersih, tanpa efek di atas gambar kecuali garis scan tipis yang bergerak */}
                      <div className="absolute inset-[6%] rounded-2xl bg-background p-1.5 shadow-xl overflow-hidden">
                        <img src={qrisUrl} alt="Kode QRIS pembayaran" className="w-full h-full object-contain" style={{ imageRendering: "auto" }} />
                        <div className="dep-scan-line" aria-hidden />
                      </div>
                    </div>
                  ) : (
                    <div className="my-3 rounded-2xl bg-destructive/10 border border-destructive/30 p-5 text-xs text-destructive font-semibold">QRIS belum dikonfigurasi admin. Pilih e-wallet atau hubungi admin.</div>
                  )}
                  <p className="text-[11px] font-bold flex items-center justify-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary animate-pulse" /> Scan QRIS untuk melakukan pembayaran</p>
                </div>
              ) : (
                <div className="rounded-3xl border border-accent/30 bg-gradient-to-b from-accent/10 to-card p-4 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden flex items-center justify-center shrink-0">
                      {ew?.logo ? <img src={ew.logo} alt={ew.name} className="w-full h-full object-contain bg-background" /> : <Wallet className="w-5 h-5 text-accent" />}
                    </div>
                    <div><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Transfer ke</p><p className="font-black">{method}</p></div>
                  </div>
                  <button className="w-full flex items-center justify-between rounded-xl bg-background/60 p-3" onClick={() => ew?.number && navigator.clipboard?.writeText(ew.number)}>
                    <span className="font-mono text-lg font-black">{ew?.number || "-"}</span><Copy className="w-4 h-4 text-muted-foreground" />
                  </button>
                  {ew?.holder && <p className="text-xs text-muted-foreground">Atas nama <b className="text-foreground">{ew.holder}</b></p>}
                </div>
              )}

              {/* Summary — pembagian dari server */}
              <DepositSummary amount={error ? 0 : amount} preview={error ? null : preview} loading={previewLoading} />

              {submitError && <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-xs font-semibold text-destructive flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> {submitError}</div>}

              <div className="sticky bottom-0 -mx-5 px-5 pt-2 pb-1 bg-gradient-to-t from-card via-card/95 to-transparent">
                <Button className="dep-cta relative overflow-hidden w-full h-12 text-base font-black gap-2 shadow-[0_0_24px_-6px_hsl(var(--primary)/0.8)] active:scale-[0.98]" disabled={submitting || !!error || qrisMissing} onClick={submit} aria-busy={submitting}>
                  {submitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Memproses...</> : <><Sparkles className="w-5 h-5" /> Buat Deposit</>}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
