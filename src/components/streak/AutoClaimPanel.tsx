import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clock, Eye, EyeOff, Flame, History, Loader2, ShieldCheck, Sparkles, Ticket, Wallet, Coins, X, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { previewSplit, type PaySource } from "./paymentSplit";
import { countdownText, previewExtend, remainingDays, reminderKind } from "./autoClaimLogic";

interface Quote { package_id: string; name: string; days: number; price: number; flash_pct: number; flash_discount: number; voucher_discount: number; final_price: number; voucher_expires_at: string | null; voucher_error: string | null }
interface Sub { id: string; plan_name: string; plan_days: number; price_paid: number; starts_at: string; expires_at: string; created_at: string }
interface Tx { description: string; trx_id: string | null; purchase_ref: string; created_at: string }
interface Lucky { purchase_ref: string; reward_type: string; reward_label: string; created_at: string }
interface StatusRes { status: { until: string | null; active_days_total: number; active_packages: number; server_now: string }; subscriptions: Sub[]; lucky: Lucky[]; transactions: Tx[]; balances: { main: number | null; game: number } }
interface BuyResult { plan: string; days: number; final_price: number; discount_amount: number; expires_at: string; streak_until_before: string | null; source_label: string; trx_id: string; lucky: { reward_type: string; reward_label: string } | null }

const rp = (n: number) => "Rp" + Math.round(n).toLocaleString("id-ID");
const wib = (iso: string, withTime = true) =>
  new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", day: "2-digit", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}) }).replace(/\./g, ".") + (withTime ? " WIB" : "");
const SOURCES: { id: PaySource; label: string; icon: typeof Zap }[] = [
  { id: "main", label: "Saldo Utama", icon: Wallet },
  { id: "game", label: "Saldo IN", icon: Coins },
  { id: "auto", label: "Otomatis", icon: Zap },
];
const invoke = (body: Record<string, unknown>) => supabase.functions.invoke("purchase-streak-plan", { body });

/** Paket Auto-Klaim: status bertumpuk, harga/voucher/flash sale dari server, sumber saldo, PIN, Lucky Bonus & riwayat. */
export default function AutoClaimPanel({ visitorId, onPurchased }: { visitorId: string; onPurchased: () => void }) {
  const [st, setSt] = useState<StatusRes | null>(null);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [flashEnd, setFlashEnd] = useState<string | null>(null);
  const [flashLabel, setFlashLabel] = useState<string | null>(null);
  const [offset, setOffset] = useState(0); // jam server - jam perangkat
  const [now, setNow] = useState(Date.now());
  const [voucher, setVoucher] = useState("");
  const [voucherQuote, setVoucherQuote] = useState<Quote | null>(null);
  const [voucherErr, setVoucherErr] = useState<string | null>(null);
  const [voucherBusy, setVoucherBusy] = useState(false);
  const [checkout, setCheckout] = useState<Quote | null>(null);
  const [result, setResult] = useState<BuyResult | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [snooze, setSnooze] = useState(false);

  const load = useCallback(async () => {
    const [s, q] = await Promise.all([invoke({ action: "status", visitorId }), invoke({ action: "quote_all" })]);
    if (s.data && !s.data.error) { setSt(s.data as StatusRes); setOffset(Date.parse((s.data as StatusRes).status.server_now) - Date.now()); }
    if (q.data && !q.data.error) { setQuotes(q.data.quotes || []); setFlashEnd(q.data.flash_sale_end || null); setFlashLabel(q.data.flash_sale_label || null); }
    else setQuotes([]);
  }, [visitorId]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const serverNow = now + offset;
  const until = st?.status.until ?? null;
  const left = remainingDays(until, serverNow);
  const total = st?.status.active_days_total ?? 0;
  const reminder = reminderKind(until, serverNow);
  const flashActive = !!flashEnd && Date.parse(flashEnd) > serverNow;
  const expiredBefore = !until && (st?.subscriptions.length ?? 0) > 0;

  // Flash sale berakhir saat halaman terbuka → muat ulang harga normal dari server
  const flashWas = useRef(flashActive);
  useEffect(() => { if (flashWas.current && !flashActive) void load(); flashWas.current = flashActive; }, [flashActive, load]);

  async function applyVoucher() {
    const code = voucher.trim().toUpperCase();
    if (!code || !quotes?.[0]) return;
    setVoucherBusy(true); setVoucherErr(null);
    const { data } = await invoke({ action: "quote", packageId: quotes[0].package_id, voucherCode: code });
    setVoucherBusy(false);
    const q = data?.quote as Quote | undefined;
    if (!q || q.voucher_error || !q.voucher_discount) { setVoucherQuote(null); setVoucherErr(q?.voucher_error || "Voucher tidak valid"); return; }
    setVoucherQuote(q);
  }

  return (
    <section className="streak-premium-card space-y-3 rounded-3xl p-4" aria-labelledby="autoclaim-title">
      <header className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary"><Flame className="h-6 w-6" /></span>
        <div className="min-w-0">
          <h4 id="autoclaim-title" className="text-base font-black">🔥 Auto-Klaim Streak</h4>
          <p className="text-[11px] text-muted-foreground">Klaim streak otomatis setiap hari tanpa harus membuka aplikasi.</p>
        </div>
      </header>

      {/* Status */}
      {!st ? <div className="grid place-items-center py-4"><Loader2 className="h-5 w-5 animate-spin opacity-60" /></div> : until ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black tracking-widest text-primary">🟢 AKTIF</span>
            <span className="text-[10px] text-muted-foreground">{st.status.active_packages} paket bertumpuk</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-background/50 p-2"><p className="text-[10px] text-muted-foreground">Total masa aktif</p><p className="text-lg font-black">{total} hari</p></div>
            <div className="rounded-xl bg-background/50 p-2"><p className="text-[10px] text-muted-foreground">Sisa</p><p className="text-lg font-black text-primary">{left} hari</p></div>
          </div>
          <p className="mt-2 text-[11px]"><b>Berakhir:</b> {wib(until)}</p>
          <p className="text-[11px] text-muted-foreground"><b>Klaim otomatis berikutnya:</b> 00:00 WIB</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-muted/30 p-3 text-[11px]">
          <p className="font-black">{expiredBefore ? "🔴 Auto-Klaim Berakhir" : "⚪ Belum ada paket aktif"}</p>
          <p className="mt-0.5 text-muted-foreground">{expiredBefore ? "Paket tidak diperpanjang otomatis. Beli paket baru atau klaim manual hari ini." : "Pilih paket di bawah untuk mulai."}</p>
        </div>
      )}

      {/* Pengingat (notifikasi resmi dikirim server; ini pengingat di halaman) */}
      {reminder && !snooze && (
        <div role="status" className="rounded-2xl border border-destructive/30 bg-destructive/10 p-3 text-[11px]">
          <p className="font-black">{reminder === "3d" ? `⏰ Auto-Klaim hampir habis — sisa ${left} hari` : reminder === "1d" ? "⚠️ Auto-Klaim berakhir besok." : "🚨 Auto-Klaim berakhir dalam 1 jam."}</p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" className="h-9 flex-1" onClick={() => quotes?.[0] && setCheckout(voucherQuote ?? quotes[0])}>{reminder === "1h" ? "Beli Paket" : "Perpanjang Sekarang"}</Button>
            <Button size="sm" variant="outline" className="h-9 flex-1" onClick={() => setSnooze(true)}>Ingatkan Nanti</Button>
          </div>
        </div>
      )}

      {/* Flash sale */}
      {flashActive && flashEnd && (
        <div className="flex items-center justify-between rounded-2xl border border-primary/40 bg-gradient-to-r from-primary/20 to-accent/20 p-3">
          <div><p className="text-[11px] font-black">🔥 FLASH SALE{flashLabel ? ` · ${flashLabel}` : ""}</p><p className="text-[10px] text-muted-foreground">Diskon {quotes?.[0]?.flash_pct ?? 0}%</p></div>
          <div className="text-right"><p className="text-[9px] text-muted-foreground">Berakhir</p><p className="font-mono text-sm font-black tabular-nums">{countdownText(flashEnd, serverNow)}</p></div>
        </div>
      )}

      {/* Voucher diskon streak (bukan voucher produk) */}
      <div className="rounded-2xl border border-border/60 bg-background/40 p-3">
        <p className="flex items-center gap-1.5 text-[11px] font-black"><Ticket className="h-3.5 w-3.5" /> Kode Voucher Streak</p>
        <div className="mt-2 flex gap-2">
          <Input value={voucher} onChange={(e) => { setVoucher(e.target.value.toUpperCase()); setVoucherQuote(null); setVoucherErr(null); }} placeholder="Masukkan kode..." aria-label="Kode voucher streak" className="h-10 text-xs" />
          {voucherQuote ? <Button variant="outline" className="h-10" onClick={() => { setVoucher(""); setVoucherQuote(null); }}>Hapus</Button>
            : <Button className="h-10" onClick={applyVoucher} disabled={voucherBusy || !voucher.trim()}>{voucherBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Gunakan"}</Button>}
        </div>
        {voucherErr && <p className="mt-1 text-[10px] font-bold text-destructive">{voucherErr}</p>}
        {voucherQuote && <p className="mt-1 text-[10px] font-bold text-primary">🎉 Voucher aktif · diskon -{rp(voucherQuote.voucher_discount)}{voucherQuote.voucher_expires_at ? ` · berlaku s/d ${wib(voucherQuote.voucher_expires_at)}` : ""}. Harga akhir dihitung server saat checkout.</p>}
      </div>

      {/* Paket */}
      <div className="grid grid-cols-2 gap-2">
        {quotes === null ? <Loader2 className="h-5 w-5 animate-spin opacity-60" /> : quotes.length === 0 ? <p className="col-span-2 text-xs text-muted-foreground">Belum ada paket aktif.</p> : quotes.map((q) => (
          <button key={q.package_id} type="button" onClick={() => setCheckout(q)}
            className="min-h-[72px] rounded-2xl border border-border bg-background/50 p-2.5 text-left transition hover:border-primary/60 active:scale-[0.98]">
            <p className="text-sm font-black">{q.name}</p>
            <p className="text-[10px] text-muted-foreground">+{q.days} hari</p>
            {q.flash_discount > 0 && <p className="text-[10px] text-muted-foreground line-through">{rp(q.price)}</p>}
            <p className="text-sm font-black text-primary">{rp(q.price - q.flash_discount)}</p>
          </button>
        ))}
      </div>

      {/* Benefit (sesuai yang dilakukan server) */}
      <div className="rounded-2xl border border-border/60 bg-background/30 p-3 text-[11px]">
        <p className="mb-1 flex items-center gap-1 font-black"><Sparkles className="h-3.5 w-3.5" /> Kenapa pakai Auto-Klaim?</p>
        <ul className="space-y-0.5 text-muted-foreground">
          <li>✓ Tidak perlu buka aplikasi setiap hari</li>
          <li>✓ Klaim otomatis setiap 00:00 WIB</li>
          <li>✓ Streak tetap berjalan</li>
          <li>✓ Bisa diperpanjang sebelum habis — sisa hari tetap dihitung</li>
          <li>✓ Freeze tetap bisa jadi perlindungan tambahan</li>
        </ul>
      </div>

      {/* Riwayat */}
      <button type="button" onClick={() => setShowHistory((v) => !v)} className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-border/60 px-3 text-[12px] font-black">
        <span className="flex items-center gap-1.5"><History className="h-4 w-4" /> 📜 Riwayat Auto-Klaim</span><span className="text-muted-foreground">{st?.subscriptions.length ?? 0}</span>
      </button>
      {showHistory && st && (
        <ul className="space-y-2">
          {st.subscriptions.length === 0 && <li className="text-center text-[11px] text-muted-foreground">Belum ada pembelian.</li>}
          {st.subscriptions.map((s) => {
            const tx = st.transactions.find((t) => Math.abs(Date.parse(t.created_at) - Date.parse(s.created_at)) < 5000); // dibuat dalam satu transaksi DB
            const src = tx?.description.match(/\[(.+?)\]/)?.[1];
            const disc = tx?.description.match(/diskon (Rp[\d.]+)/)?.[1];
            const lucky = tx ? st.lucky.find((l) => l.purchase_ref === tx.purchase_ref) : undefined;
            return (
              <li key={s.id} className="rounded-2xl border border-border/60 bg-background/40 p-3 text-[11px]">
                <div className="flex justify-between gap-2"><span className="text-muted-foreground">{wib(s.created_at)}</span><span className="font-bold text-primary">Berhasil</span></div>
                <p className="mt-0.5 font-black">Auto-Klaim {s.plan_name} · +{s.plan_days} hari</p>
                <p>{rp(s.price_paid)}{disc ? ` (diskon ${disc})` : ""}{src ? ` · ${src}` : ""}</p>
                <p className="text-muted-foreground">Berlaku {wib(s.starts_at, false)} → {wib(s.expires_at)}</p>
                {lucky && <p className="mt-0.5">🍀 {lucky.reward_type === "none" ? "Tanpa bonus" : lucky.reward_label}</p>}
              </li>
            );
          })}
          {st.subscriptions.length > 0 && <li className="text-center text-[11px] font-bold">Total dibeli: +{st.subscriptions.reduce((a, s) => a + s.plan_days, 0)} hari</li>}
        </ul>
      )}

      {checkout && st && (
        <AutoClaimCheckout visitorId={visitorId} base={checkout} voucher={voucherQuote ? voucher.trim().toUpperCase() : ""} until={until} serverNow={serverNow} balances={st.balances}
          onClose={() => setCheckout(null)} onDone={(r) => { setCheckout(null); setResult(r); setVoucher(""); setVoucherQuote(null); void load(); onPurchased(); }} />
      )}

      {result && (
        <div className="fixed inset-0 z-[97] flex items-center justify-center bg-background/70 p-4 backdrop-blur-md" onClick={() => setResult(null)}>
          <div role="dialog" aria-modal="true" className="pay-glass relative w-full max-w-sm rounded-3xl p-5 text-center" onClick={(e) => e.stopPropagation()}>
            <p className="text-3xl">🎉</p>
            <h3 className="mt-1 text-lg font-black">{result.streak_until_before ? "Auto-Klaim diperpanjang!" : "Auto-Klaim aktif!"}</h3>
            <p className="text-sm font-bold text-primary">+{result.days} hari</p>
            <p className="mt-1 text-xs">Total sisa masa aktif: <b>{remainingDays(result.expires_at, serverNow)} hari</b></p>
            <p className="text-[11px] text-muted-foreground">Berakhir {wib(result.expires_at)} · {rp(result.final_price)} dari {result.source_label}</p>
            <div className="mt-3 rounded-2xl border border-border/60 bg-background/40 p-3">
              {result.lucky && result.lucky.reward_type !== "none"
                ? <><p className="text-sm font-black">🍀 HOKI!</p><p className="text-xs">Kamu mendapatkan bonus {result.lucky.reward_label}.</p></>
                : <p className="text-xs text-muted-foreground">Pembelian berhasil. Belum mendapatkan bonus kali ini.</p>}
            </div>
            <Button className="mt-4 h-11 w-full" onClick={() => setResult(null)}>Oke</Button>
          </div>
        </div>
      )}
    </section>
  );
}

function AutoClaimCheckout({ visitorId, base, voucher, until, serverNow, balances, onClose, onDone }: {
  visitorId: string; base: Quote; voucher: string; until: string | null; serverNow: number; balances: { main: number | null; game: number };
  onClose: () => void; onDone: (r: BuyResult) => void;
}) {
  const [q, setQ] = useState<Quote | null>(null);
  const [source, setSource] = useState<PaySource>("auto");
  const [pin, setPin] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const ref = useRef(crypto.randomUUID());

  useEffect(() => {
    invoke({ action: "quote", packageId: base.package_id, voucherCode: voucher || undefined }).then(({ data }) => {
      if (data?.quote && !data.quote.error) setQ(data.quote as Quote); else setErr("Harga belum bisa dimuat. Coba lagi.");
    });
  }, [base.package_id, voucher]);

  const split = q && balances.main !== null ? previewSplit(q.final_price, source, balances.game, balances.main) : null;
  const ext = q ? previewExtend(until, q.days, serverNow) : null;

  async function submit() {
    if (busy || pin.length !== 6 || !q || !split?.ok) return;
    setBusy(true); setErr(null);
    try {
      const { data, error } = await invoke({ action: "buy", visitorId, packageId: q.package_id, voucherCode: voucher || undefined, paymentSource: source, pin, purchaseRef: ref.current });
      if (error || data?.error) {
        setErr(data?.error || "Pembelian gagal. Saldo tidak terpotong."); setPin("");
        if (data?.needPin) { setShake(true); setTimeout(() => setShake(false), 450); }
        return;
      }
      onDone(data as BuyResult);
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[96] flex items-end justify-center bg-background/70 p-3 backdrop-blur-md sm:items-center" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Konfirmasi Pembayaran" className={`pay-glass relative max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-3xl p-5 ${shake ? "animate-pin-shake" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-base font-black"><span className="pay-shield grid h-9 w-9 place-items-center rounded-xl"><ShieldCheck className="h-5 w-5" /></span> Konfirmasi Pembayaran</h3>
          <button onClick={onClose} disabled={busy} aria-label="Tutup" className="grid h-9 w-9 place-items-center rounded-full bg-muted"><X className="h-4 w-4" /></button>
        </div>
        {!q ? <div className="grid place-items-center py-8 text-xs text-muted-foreground">{err ?? <Loader2 className="h-5 w-5 animate-spin" />}</div> : balances.main === null ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Login ke akun saldo dulu di tab Saldo.</p>
        ) : (
          <>
            <div className="mt-4 space-y-1 rounded-2xl border border-border/60 bg-background/40 p-3 text-xs">
              <p className="text-[10px] font-black tracking-widest text-muted-foreground">AUTO-KLAIM {q.name.toUpperCase()}</p>
              <div className="flex justify-between"><span>Harga</span><span>{rp(q.price)}</span></div>
              {q.flash_discount > 0 && <div className="flex justify-between text-primary"><span>Promo {q.flash_pct}%</span><span>-{rp(q.flash_discount)}</span></div>}
              {q.voucher_discount > 0 && <div className="flex justify-between text-primary"><span>Voucher</span><span>-{rp(q.voucher_discount)}</span></div>}
              <div className="flex justify-between border-t border-border/60 pt-1 font-black"><span>Total</span><span>{rp(q.final_price)}</span></div>
            </div>
            {ext && (
              <div className="mt-2 rounded-2xl border border-primary/30 bg-primary/10 p-3 text-[11px]">
                <p className="flex items-center gap-1 font-black"><Clock className="h-3.5 w-3.5" /> {ext.before > 0 ? `Perpanjangan +${ext.add} hari` : `Aktivasi ${ext.add} hari`}</p>
                <p>Masa aktif: {ext.before > 0 ? `${ext.before} + ${ext.add} = ` : ""}<b>{ext.total} hari</b></p>
                <p className="text-muted-foreground">Berakhir ± {wib(ext.newUntil)}</p>
              </div>
            )}
            <p className="mt-3 text-[10px] font-black tracking-widest text-muted-foreground">PEMBAYARAN</p>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Sumber pembayaran">
              {SOURCES.map((s) => (
                <button key={s.id} type="button" role="radio" aria-checked={source === s.id} onClick={() => setSource(s.id)}
                  className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-[11px] font-bold ${source === s.id ? "border-primary bg-primary/15 text-primary" : "border-border bg-background/40"}`}>
                  <s.icon className="h-4 w-4" />{s.label}
                </button>
              ))}
            </div>
            {split && (
              <div className="mt-2 space-y-1 rounded-2xl border border-border/60 bg-background/40 p-3 text-[11px]">
                <div className="flex justify-between"><span>Saldo IN</span><span className="tabular-nums">-{rp(split.fromGame)} → {rp(Math.max(0, split.gameAfter))}</span></div>
                <div className="flex justify-between"><span>Saldo Utama</span><span className="tabular-nums">-{rp(split.fromMain)} → {rp(Math.max(0, split.mainAfter))}</span></div>
                {!split.ok && <p className="font-bold text-destructive">{split.error}</p>}
              </div>
            )}
            <label className="mt-3 block text-[10px] font-black tracking-widest text-muted-foreground" htmlFor="ac-pin">PIN 6 DIGIT</label>
            <div className="relative mt-1">
              <input id="ac-pin" type={show ? "text" : "password"} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={pin} autoFocus
                onChange={(e) => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setErr(null); }} onKeyDown={(e) => e.key === "Enter" && submit()}
                className="h-12 w-full rounded-xl border border-border bg-background/60 text-center text-2xl font-black tracking-[0.5em] outline-none focus:border-primary" />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Sembunyikan PIN" : "Tampilkan PIN"} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-muted-foreground">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {err && <p role="alert" className="mt-1.5 text-center text-xs font-bold text-destructive">{err}</p>}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11" onClick={onClose} disabled={busy}>Batalkan</Button>
              <Button className="h-11 font-black" onClick={submit} disabled={busy || pin.length !== 6 || !split?.ok}>
                {busy ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Memproses...</> : <><Check className="mr-1 h-4 w-4" />Konfirmasi Pembelian</>}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
