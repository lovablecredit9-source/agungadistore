import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, ShieldCheck, X, Zap, Wallet, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { previewSplit, type PaySource } from "./paymentSplit";

interface Quote { price: number; main: number | null; game: number; freeze_count: number }
interface Props { visitorId: string; open: boolean; onClose: () => void; onDone: (r: { freeze_count: number; source_label?: string }) => void; onError: (msg: string) => void }

const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");
const SOURCES: { id: PaySource; label: string; icon: typeof Zap }[] = [
  { id: "main", label: "Saldo Utama", icon: Wallet },
  { id: "game", label: "Saldo IN", icon: Coins },
  { id: "auto", label: "Otomatis", icon: Zap },
];

/** Beli Streak Freeze: harga & saldo dari server (quote), PIN 6 digit, request id untuk mencegah dobel bayar. */
export default function FreezePurchaseModal({ visitorId, open, onClose, onDone, onError }: Props) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [source, setSource] = useState<PaySource>("main");
  const [pin, setPin] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const reqId = useRef("");

  useEffect(() => {
    if (!open) return;
    setPin(""); setErr(null); setQuote(null); setQuoteErr(null);
    reqId.current = crypto.randomUUID();
    supabase.functions.invoke("buy-streak-freeze", { body: { action: "quote", visitorId } }).then(({ data, error }) => {
      if (error || !data || data.error) { setQuoteErr("Harga belum bisa dimuat. Coba lagi."); return; }
      setQuote(data as Quote);
    });
  }, [open, visitorId]);

  if (!open) return null;
  const split = quote && quote.main !== null ? previewSplit(quote.price, source, quote.game, quote.main) : null;

  async function submit() {
    if (busy || pin.length !== 6 || !split?.ok) return;
    setBusy(true); setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("buy-streak-freeze", { body: { visitorId, pin, source, requestId: reqId.current } });
      if (error || data?.error) {
        const msg = data?.error || "Pembelian gagal. Coba lagi.";
        setErr(msg); setPin("");
        if (data?.code === "PIN") { setShake(true); setTimeout(() => setShake(false), 450); }
        else onError(msg);
        return;
      }
      onDone(data);
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center bg-background/70 p-3 backdrop-blur-md sm:items-center" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Konfirmasi Pembayaran"
        className={`pay-glass relative w-full max-w-sm overflow-hidden rounded-3xl p-5 ${shake ? "animate-pin-shake" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-black"><span className="pay-shield grid h-9 w-9 place-items-center rounded-xl"><ShieldCheck className="h-5 w-5" /></span> Konfirmasi Pembayaran</h3>
          <button onClick={onClose} disabled={busy} aria-label="Tutup" className="grid h-9 w-9 place-items-center rounded-full bg-muted"><X className="h-4 w-4" /></button>
        </div>

        {!quote ? (
          <div className="grid place-items-center py-8 text-xs text-muted-foreground">{quoteErr ?? <Loader2 className="h-5 w-5 animate-spin" />}</div>
        ) : quote.main === null ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Login ke akun saldo dulu di tab Saldo.</p>
        ) : (
          <>
            <div className="mt-4 rounded-2xl border border-border/60 bg-background/40 p-3 text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Produk</span><span className="font-bold">🛡️ Streak Freeze ×1</span></div>
              <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Harga</span><span className="font-black">{rp(quote.price)}</span></div>
              <div className="mt-1 flex justify-between"><span className="text-muted-foreground">Freeze dimiliki</span><span className="font-bold">{quote.freeze_count} → {quote.freeze_count + 1}</span></div>
            </div>

            <p className="mt-3 text-[10px] font-black tracking-widest text-muted-foreground">SUMBER PEMBAYARAN</p>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Sumber pembayaran">
              {SOURCES.map((s) => (
                <button key={s.id} type="button" role="radio" aria-checked={source === s.id} onClick={() => setSource(s.id)}
                  className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-[11px] font-bold transition ${source === s.id ? "border-primary bg-primary/15 text-primary" : "border-border bg-background/40"}`}>
                  <s.icon className="h-4 w-4" />{s.label}
                </button>
              ))}
            </div>

            {split && (
              <div className="mt-2 space-y-1 rounded-2xl border border-border/60 bg-background/40 p-3 text-[11px]">
                <div className="flex justify-between"><span>Saldo IN</span><span className="tabular-nums">{rp(quote.game)} → <b className={split.fromGame ? "text-destructive" : ""}>-{rp(split.fromGame)}</b></span></div>
                <div className="flex justify-between"><span>Saldo Utama</span><span className="tabular-nums">{rp(quote.main)} → <b className={split.fromMain ? "text-destructive" : ""}>-{rp(split.fromMain)}</b></span></div>
                <div className="flex justify-between border-t border-border/60 pt-1 font-black"><span>Total</span><span>{rp(quote.price)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Setelah bayar</span><span>IN {rp(Math.max(0, split.gameAfter))} · Utama {rp(Math.max(0, split.mainAfter))}</span></div>
                {!split.ok && <p className="font-bold text-destructive">{split.error}</p>}
              </div>
            )}

            <label className="mt-3 block text-[10px] font-black tracking-widest text-muted-foreground" htmlFor="freeze-pin">PIN 6 DIGIT</label>
            <div className="relative mt-1">
              <input id="freeze-pin" type={show ? "text" : "password"} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={pin} autoFocus
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setErr(null); }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="h-12 w-full rounded-xl border border-border bg-background/60 text-center text-2xl font-black tracking-[0.5em] outline-none focus:border-primary" />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Sembunyikan PIN" : "Tampilkan PIN"} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-muted-foreground">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {err && <p role="alert" className="mt-1.5 text-center text-xs font-bold text-destructive">{err}</p>}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11" onClick={onClose} disabled={busy}>Batalkan</Button>
              <Button className="h-11 font-black" onClick={submit} disabled={busy || pin.length !== 6 || !split?.ok}>
                {busy ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Memproses...</> : "Konfirmasi Pembelian"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
