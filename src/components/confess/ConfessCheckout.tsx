import { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle2, Crown, Eye, EyeOff, Gift, Loader2, Lock, Pencil, Plus, Rocket, Sparkles, Ticket, Trash2, User as UserIcon, AlertTriangle, Clock,
} from "lucide-react";
import {
  callConfessFn, displayLocalPhone, formatWibDateTime, maskConfessPhone, normalizeConfessPhone, rupiahC,
  type ConfessQuote, type ConfessRecipient, type ConfessSendResult, type SubStatus,
} from "./confessCheckoutLogic";

/* ---------------- Stepper ---------------- */
export function ConfessStepper({ active }: { active: number }) {
  const steps = ["Penerima", "Pesan", "Pembayaran", "Konfirmasi"];
  return (
    <ol className="grid grid-cols-4 gap-1.5" aria-label="Langkah kirim Confess">
      {steps.map((s, i) => {
        const done = i < active;
        const cur = i === active;
        return (
          <li key={s} className={`min-w-0 rounded-xl border px-1 py-1.5 text-center transition-colors ${cur ? "border-primary/50 bg-primary/10" : done ? "border-primary/30 bg-primary/5" : "border-border bg-card/60"}`}>
            <div className={`text-[10px] font-black tabular-nums ${cur || done ? "text-primary" : "text-muted-foreground"}`}>{String(i + 1).padStart(2, "0")}</div>
            <div className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-tight leading-tight break-words">{s}</div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------------- Recipient list ---------------- */
export function RecipientList({
  recipients, onChange, maxNumbers, freeUntil, onUpgrade, subActive,
}: {
  recipients: ConfessRecipient[];
  onChange: (r: ConfessRecipient[]) => void;
  maxNumbers: number;
  freeUntil: Record<string, string>;
  onUpgrade: () => void;
  subActive: boolean;
}) {
  const [editing, setEditing] = useState<number | null>(recipients.length === 1 && !recipients[0].phone ? 0 : null);
  const [draft, setDraft] = useState<ConfessRecipient>({ phone: "", name: "" });
  const [err, setErr] = useState("");
  const phoneRef = useRef<HTMLInputElement>(null);
  const filled = recipients.filter((r) => r.phone.trim());

  useEffect(() => {
    if (editing !== null) {
      setDraft(recipients[editing] || { phone: "", name: "" });
      setErr("");
      setTimeout(() => phoneRef.current?.focus(), 30);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const save = () => {
    const n = normalizeConfessPhone(draft.phone);
    if (!n) { setErr("Nomor WhatsApp tidak valid"); return; }
    const dupe = recipients.some((r, i) => i !== editing && normalizeConfessPhone(r.phone) === n);
    if (dupe) { setErr("Nomor ini sudah ada di daftar"); return; }
    const next = [...recipients];
    next[editing!] = { phone: draft.phone.trim(), name: draft.name.trim().slice(0, 40) };
    onChange(next);
    setEditing(null);
  };
  const cancel = () => {
    if (editing !== null && !recipients[editing]?.phone) {
      const next = recipients.filter((_, i) => i !== editing);
      onChange(next.length ? next : [{ phone: "", name: "" }]);
    }
    setEditing(null);
  };
  const add = () => {
    if (filled.length >= maxNumbers) return;
    const base = recipients.filter((r) => r.phone.trim());
    onChange([...base, { phone: "", name: "" }]);
    setEditing(base.length);
  };
  const remove = (i: number) => {
    const next = recipients.filter((_, j) => j !== i);
    onChange(next.length ? next : [{ phone: "", name: "" }]);
    if (!next.length) setEditing(0);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold">Penerima</span>
        <span className="text-[11px] font-bold tabular-nums text-muted-foreground" aria-live="polite">
          Penerima {Math.max(filled.length, 0)} dari {maxNumbers}
        </span>
      </div>
      <ul className="space-y-2">
        {recipients.map((r, i) => {
          if (editing === i) {
            return (
              <li key={i} className="rounded-2xl border border-primary/40 bg-primary/5 p-3 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <div>
                  <label className="text-[11px] font-semibold" htmlFor={`cf-name-${i}`}>Nama Penerima</label>
                  <Input id={`cf-name-${i}`} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Contoh: Alya" maxLength={40} className="mt-1" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold" htmlFor={`cf-phone-${i}`}>Nomor WhatsApp</label>
                  <Input ref={phoneRef} id={`cf-phone-${i}`} value={draft.phone} onChange={(e) => { setDraft({ ...draft, phone: e.target.value.replace(/[^\d+\s-]/g, "") }); setErr(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} placeholder="08xxxxxxxxxx" inputMode="tel" className="mt-1 font-mono" aria-invalid={!!err} />
                  {err && <p className="text-[11px] text-destructive mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {err}</p>}
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm" className="flex-1" onClick={cancel}>Batal</Button>
                  <Button type="button" size="sm" className="flex-1" onClick={save}>Simpan</Button>
                </div>
              </li>
            );
          }
          if (!r.phone.trim()) return null;
          const n = normalizeConfessPhone(r.phone) || "";
          const free = freeUntil[n];
          return (
            <li key={i} className="flex items-center gap-3 rounded-2xl border bg-card/80 backdrop-blur p-2.5 animate-in fade-in duration-200">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-sm shrink-0" aria-hidden>
                {r.name ? r.name.trim().charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold break-words leading-tight">{r.name || "Tanpa nama"}</div>
                <div className="text-xs font-mono text-muted-foreground">{displayLocalPhone(n || r.phone)}</div>
                {free && <div className="text-[10px] font-bold text-primary flex items-center gap-1 mt-0.5"><Sparkles className="w-3 h-3" /> Gratis sampai {formatWibDateTime(free)}</div>}
              </div>
              <button type="button" onClick={() => setEditing(i)} className="p-2 rounded-lg hover:bg-muted" aria-label={`Ubah ${r.name || displayLocalPhone(r.phone)}`}><Pencil className="w-4 h-4" /></button>
              <button type="button" onClick={() => remove(i)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive" aria-label={`Hapus ${r.name || displayLocalPhone(r.phone)}`}><Trash2 className="w-4 h-4" /></button>
            </li>
          );
        })}
      </ul>
      {editing === null && filled.length < maxNumbers && (
        <Button type="button" variant="outline" className="w-full rounded-xl border-dashed" onClick={add}>
          <Plus className="w-4 h-4 mr-1" /> Tambah penerima
        </Button>
      )}
      {filled.length >= maxNumbers && !subActive && (
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card to-accent/10 p-3 animate-in fade-in duration-300">
          <div className="flex items-start gap-2">
            <Rocket className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-black">Mau kirim ke lebih banyak orang?</div>
              <div className="text-xs text-muted-foreground">Upgrade ke Confess 15 · Rp10.000 / 30 hari · hingga 15 penerima sekaligus</div>
            </div>
          </div>
          <Button type="button" onClick={onUpgrade} className="w-full mt-2 rounded-xl"><Crown className="w-4 h-4 mr-1" /> Upgrade ke 15 Nomor</Button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Voucher card ---------------- */
export function VoucherCard({
  code, onCodeChange, applied, onApply, onRemove, checking, quote,
}: {
  code: string; onCodeChange: (v: string) => void; applied: string | null;
  onApply: () => void; onRemove: () => void; checking: boolean; quote: ConfessQuote | null;
}) {
  const err = applied ? quote?.voucher_error : null;
  const active = applied && !err && quote?.voucher_percent != null;
  return (
    <div className="rounded-2xl border bg-card/80 p-3 space-y-2">
      <div className="text-xs font-semibold flex items-center gap-1.5"><Ticket className="w-4 h-4 text-primary" /> Punya Voucher?</div>
      {active ? (
        <div className="rounded-xl border border-primary/40 bg-primary/10 p-2.5 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-black tracking-wider text-primary">VOUCHER AKTIF</div>
            <div className="font-mono text-sm font-bold truncate">{applied}</div>
            <div className="text-[11px] text-muted-foreground">
              Diskon {quote?.voucher_percent}%{(quote?.voucher_discount || 0) > 0 ? ` · Hemat ${rupiahC(quote?.voucher_discount)}` : " · tidak dipakai karena total sudah Rp0"}
            </div>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onRemove}>Hapus</Button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => onCodeChange(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onApply(); } }} placeholder="Masukkan kode voucher" maxLength={40} className="font-mono uppercase" aria-label="Kode voucher" />
            <Button type="button" variant="outline" onClick={onApply} disabled={checking || !code.trim()}>
              {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : "Terapkan"}
            </Button>
          </div>
          {checking && <p className="text-[11px] text-muted-foreground">Memeriksa voucher…</p>}
          {err && <p className="text-[11px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {err}</p>}
        </>
      )}
    </div>
  );
}

/* ---------------- PIN field ---------------- */
export function PinField({ value, onChange, error, disabled, autoFocus = true }: { value: string; onChange: (v: string) => void; error?: string; disabled?: boolean; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (autoFocus) setTimeout(() => ref.current?.focus(), 80); }, [autoFocus]);
  return (
    <div>
      <label className="text-xs font-semibold flex items-center gap-1.5 mb-1.5" htmlFor="confess-pin"><Lock className="w-3.5 h-3.5" /> Masukkan PIN 6 digit</label>
      <div className="relative" onClick={() => ref.current?.focus()}>
        <div className="grid grid-cols-6 gap-1.5" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`h-11 rounded-xl border flex items-center justify-center text-lg font-black ${error ? "border-destructive" : i === value.length ? "border-primary" : "border-border"} bg-background`}>
              {value[i] ? (show ? value[i] : "•") : ""}
            </div>
          ))}
        </div>
        <input
          ref={ref}
          id="confess-pin"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          type={show ? "text" : "password"}
          maxLength={6}
          disabled={disabled}
          aria-invalid={!!error}
          aria-label="PIN 6 digit"
          className="absolute inset-0 opacity-0 w-full h-full cursor-text"
        />
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[11px] text-destructive min-h-[1em]" role="alert">{error || ""}</span>
        <button type="button" onClick={() => setShow((v) => !v)} className="text-[11px] text-muted-foreground flex items-center gap-1 hover:text-foreground">
          {show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />} {show ? "Sembunyikan" : "Tampilkan"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "muted" | "good" | "strong" }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums text-right ${tone === "good" ? "text-primary font-bold" : tone === "strong" ? "font-black text-base" : "font-semibold"}`}>{value}</span>
    </div>
  );
}

/* ---------------- Checkout dialog ---------------- */
export function ConfessCheckoutDialog({
  open, onOpenChange, recipients, quote, pin, onPinChange, pinError, onConfirm, loading, loadingLabel, scheduledLabel,
}: {
  open: boolean; onOpenChange: (v: boolean) => void; recipients: ConfessRecipient[]; quote: ConfessQuote | null;
  pin: string; onPinChange: (v: string) => void; pinError?: string; onConfirm: () => void; loading: boolean; loadingLabel: string; scheduledLabel?: string | null;
}) {
  const names = recipients.filter((r) => r.phone.trim()).map((r) => r.name || maskConfessPhone(normalizeConfessPhone(r.phone) || r.phone));
  const total = quote?.total || 0;
  const freeCount = quote?.free_count || 0;
  const insufficient = (quote?.balance ?? 0) < total;
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[92dvh] overflow-y-auto rounded-3xl p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">Konfirmasi Confess</DialogTitle>
          <DialogDescription>{scheduledLabel ? `Dijadwalkan ${scheduledLabel}` : "Periksa rincian sebelum membayar."}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-2xl border bg-muted/30 p-3">
            <div className="text-[11px] font-semibold text-muted-foreground mb-1">Penerima</div>
            <div className="text-sm font-bold break-words">
              {names.slice(0, 2).join(", ")}{names.length > 2 ? ` +${names.length - 2} penerima` : ""}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">Jumlah: {names.length} penerima</div>
          </div>
          <div className="rounded-2xl border p-3 space-y-1.5">
            <Row label="Harga normal" value={rupiahC(quote?.price_normal)} />
            {freeCount > 0 && <Row label={`Gratis 24 jam (${freeCount} nomor)`} value="Rp0" tone="good" />}
            {(quote?.trial_discount || 0) > 0 && <Row label="Diskon percobaan" value={`-${rupiahC(quote?.trial_discount)}`} tone="good" />}
            {(quote?.voucher_discount || 0) > 0 && <Row label={`Voucher ${quote?.voucher_code || ""}`} value={`-${rupiahC(quote?.voucher_discount)}`} tone="good" />}
            {quote?.free_send_used && <Row label="Gratis 1x kirim" value={`-${rupiahC(quote?.price_normal)}`} tone="good" />}
            <div className="border-t my-1" />
            <Row label="Total" value={rupiahC(total)} tone="strong" />
            <Row label="Saldo sebelum" value={rupiahC(quote?.balance)} />
            <Row label="Saldo setelah" value={rupiahC(quote?.balance_after)} />
          </div>
          {insufficient && (
            <p className="text-xs text-destructive flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Saldo kamu {rupiahC(quote?.balance)}, sedangkan pembayaran membutuhkan {rupiahC(total)}.</p>
          )}
          {total > 0 && !insufficient && <PinField value={pin} onChange={onPinChange} error={pinError} disabled={loading} />}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Batal</Button>
            <Button type="button" onClick={onConfirm} disabled={loading || insufficient || (total > 0 && pin.length !== 6)} aria-busy={loading}>
              {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> {loadingLabel}</> : total > 0 ? (scheduledLabel ? "Bayar & Jadwalkan" : "Bayar & Kirim") : (scheduledLabel ? "Jadwalkan" : "Kirim Gratis")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Success dialog ---------------- */

export function ConfessSuccessDialog({ result, onClose, onOpenChat }: { result: ConfessSendResult | null; onClose: () => void; onOpenChat: (phone: string) => void }) {
  if (!result) return null;
  const list = result.recipients.filter((r) => r.phone.trim());
  const first = list[0];
  const firstLabel = first ? (first.name || maskConfessPhone(normalizeConfessPhone(first.phone) || first.phone)) : "-";
  return (
    <Dialog open={!!result} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm rounded-3xl p-5 max-h-[92dvh] overflow-y-auto">
        <div className="flex flex-col items-center text-center gap-2 pt-1">
          <div className="w-16 h-16 rounded-full bg-primary/15 text-primary flex items-center justify-center animate-in zoom-in duration-300">
            {result.scheduled ? <Clock className="w-8 h-8" /> : <CheckCircle2 className="w-8 h-8" />}
          </div>
          <DialogTitle className="text-lg font-black">{result.scheduled ? "Confess Dijadwalkan" : "Confess Berhasil Diproses"}</DialogTitle>
          <DialogDescription>
            {result.scheduled ? `Akan dikirim otomatis ${result.scheduledLabel || ""}.` : "Pesan sudah masuk ke antrean pengiriman WhatsApp."}
          </DialogDescription>
        </div>
        <div className="rounded-2xl border p-3 space-y-1.5 mt-2">
          <Row label="Untuk" value={`${firstLabel}${list.length > 1 ? ` +${list.length - 1} penerima` : ""}`} />
          <Row label="TRX" value={result.trx_id} />
          <Row label="Total" value={result.free_send_used ? "Rp0 (gratis 1x kirim)" : rupiahC(result.charged)} tone="strong" />
          {!result.scheduled && <Row label="Gratis chat" value={result.free_until ? `s/d ${formatWibDateTime(result.free_until)}` : "24 jam"} />}
        </div>
        <ul className="text-xs space-y-1 mt-2">
          <li className="flex items-center gap-1.5 text-primary font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /> Berhasil dibuat{result.duplicate ? " (permintaan ganda diabaikan, tidak ada potongan kedua)" : ""}</li>
          <li className="flex items-center gap-1.5 text-muted-foreground"><Clock className="w-3.5 h-3.5" /> {result.scheduled ? "Menunggu waktu jadwal" : "Menunggu konfirmasi pengiriman WhatsApp"}</li>
        </ul>
        {(result.free_sends_granted || 0) > 0 && (
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-2.5 text-xs font-semibold flex items-center gap-2 mt-2">
            <Gift className="w-4 h-4 text-primary" /> Selamat! Kamu dapat {result.free_sends_granted}x gratis kirim Confess.
          </div>
        )}
        <div className="grid grid-cols-2 gap-2 mt-3">
          {!result.scheduled && first ? (
            <Button type="button" variant="outline" onClick={() => onOpenChat(normalizeConfessPhone(first.phone) || first.phone)}>Lihat Chat</Button>
          ) : <span />}
          <Button type="button" onClick={onClose}>Selesai</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Confess 15 subscription checkout ---------------- */
export function SubCheckoutDialog({ open, onOpenChange, visitorId, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; visitorId: string; onDone: () => void }) {
  const [status, setStatus] = useState<{ balance: number | null; price: number; days: number; active: boolean; expires_at: string | null } | null>(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const refRef = useRef<string>("");

  useEffect(() => {
    if (!open) return;
    setPin(""); setErr("");
    refRef.current = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
    callConfessFn<SubStatus>("confess-number-sub", { action: "status", visitor_id: visitorId }).then(({ data }) => {
      setStatus({ balance: data?.balance ?? null, price: data?.price ?? 10000, days: data?.days ?? 30, active: !!data?.active, expires_at: data?.expires_at || null });
    });
  }, [open, visitorId]);

  const price = status?.price ?? 10000;
  const balance = status?.balance;
  const insufficient = balance != null && balance < price;

  const pay = async () => {
    if (loading || pin.length !== 6) return;
    setLoading(true); setErr("");
    const { ok, data } = await callConfessFn<{ code?: string }>("confess-number-sub", { action: "buy", visitor_id: visitorId, pin, requestRef: refRef.current });
    setLoading(false);
    setPin("");
    if (!ok) { setErr(data?.code === "pin" ? "PIN salah. Silakan coba lagi." : (data?.error || "Pembayaran gagal")); return; }
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!loading) onOpenChange(v); }}>
      <DialogContent className="max-w-md rounded-3xl p-5 max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Rocket className="w-5 h-5 text-primary" /> Confess 15</DialogTitle>
          <DialogDescription>Kirim ke hingga 15 penerima sekaligus.</DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border p-3 space-y-1.5">
          <Row label="Akses" value="15 penerima sekaligus" />
          <Row label="Masa aktif" value={`${status?.days ?? 30} hari${status?.active ? " (ditambahkan)" : ""}`} />
          <Row label="Harga" value={rupiahC(price)} tone="strong" />
          <Row label="Saldo saat ini" value={balance == null ? "…" : rupiahC(balance)} />
          <Row label="Saldo setelah pembayaran" value={balance == null ? "…" : rupiahC(balance - price)} />
        </div>
        {insufficient ? (
          <p className="text-xs text-destructive">Saldo kamu {rupiahC(balance)}, sedangkan pembayaran membutuhkan {rupiahC(price)}.</p>
        ) : (
          <PinField value={pin} onChange={(v) => { setPin(v); setErr(""); }} error={err} disabled={loading} />
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Batalkan</Button>
          <Button type="button" onClick={pay} disabled={loading || insufficient || pin.length !== 6 || balance == null}>
            {loading ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Memverifikasi…</> : `Bayar ${rupiahC(price)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
