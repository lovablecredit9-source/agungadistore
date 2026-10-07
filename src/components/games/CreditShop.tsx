import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Gamepad2, Infinity as InfinityIcon, Key, Loader2, Lock, ShieldCheck, Tag, Wallet, XCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import CountUp from "@/components/CountUp";
import { triggerGameBalanceRefresh } from "./GameBalance";
import {
  type CreditQuote, type PaySource, creditErrorMessage, formatRupiah, planPayment,
} from "./creditShopLogic";

export const GAME_CREDITS_REFRESH_EVENT = "game-credits-refresh";
function refreshEverything() {
  window.dispatchEvent(new CustomEvent(GAME_CREDITS_REFRESH_EVENT));
  triggerGameBalanceRefresh();
  window.dispatchEvent(new CustomEvent("balance-updated"));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- respons fungsi server tidak bertipe
type Resp = any;
async function invokeCredits(body: Record<string, unknown>): Promise<{ data: Resp; error: string | null; network?: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke("purchase-game-credits", { body });
    if (error) {
      if (error instanceof FunctionsFetchError) return { data: null, error: "network", network: true };
      let b: Resp = null;
      if (error instanceof FunctionsHttpError) { try { b = await error.context.clone().json(); } catch { /* ignore */ } }
      return { data: b, error: b?.error || "server" };
    }
    if (data?.error) return { data, error: data.error };
    return { data, error: null };
  } catch {
    return { data: null, error: "network", network: true };
  }
}

interface SuccessInfo {
  label: string; credits: number; added: number; isUnlimited: boolean; unlimitedUntil: string | null;
  paid: number; source: string; mainLeft: number; gameLeft: number; trx: string | null;
}

interface Props {
  visitorId: string | null;
  /** Dipanggil setelah backend mengonfirmasi pembelian. */
  onPurchased?: () => void;
  /** Tombol "Gunakan Kredit" di popup sukses. */
  onUseCredits?: () => void;
  compact?: boolean;
}

/** Satu-satunya alur beli Kredit Jawaban: dipakai Shop Kredit (dialog game) dan Plus Hub. */
export default function CreditShopPanel({ visitorId, onPurchased, onUseCredits, compact }: Props) {
  const [quotes, setQuotes] = useState<CreditQuote[]>([]);
  const [loadingPkgs, setLoadingPkgs] = useState(true);
  const [mainBal, setMainBal] = useState(0);
  const [gameBal, setGameBal] = useState(0);
  const [credits, setCredits] = useState(0);
  const [source, setSource] = useState<PaySource>("auto");
  const [voucher, setVoucher] = useState("");
  const [voucherState, setVoucherState] = useState<{ ok: boolean; amount: number; msg: string } | null>(null);
  const [checkingVoucher, setCheckingVoucher] = useState(false);

  const [confirm, setConfirm] = useState<CreditQuote | null>(null);
  const [quoting, setQuoting] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [stage, setStage] = useState<"idle" | "verifying" | "processing">("idle");
  const [success, setSuccess] = useState<SuccessInfo | null>(null);
  const [flowError, setFlowError] = useState("");
  const busyRef = useRef(false);
  const refRef = useRef<string | null>(null);
  const busy = stage !== "idle" || !!quoting;

  const loadBalances = useCallback(async () => {
    if (!visitorId) return;
    const [{ data: ub }, { data: gb }, cr] = await Promise.all([
      supabase.from("user_balances_public" as never).select("balance").eq("visitor_id", visitorId).maybeSingle(),
      supabase.from("game_balance" as never).select("amount").eq("visitor_id", visitorId).maybeSingle(),
      invokeCredits({ action: "get_credits", visitorId }),
    ]);
    setMainBal(Number((ub as Resp)?.balance) || 0);
    setGameBal(Number((gb as Resp)?.amount) || 0);
    if (!cr.error) setCredits(Number(cr.data?.credits) || 0);
  }, [visitorId]);

  const loadPackages = useCallback(async () => {
    setLoadingPkgs(true);
    const r = await invokeCredits({ action: "quote_all", visitorId: visitorId || "" });
    setQuotes(r.error ? [] : (r.data?.quotes as CreditQuote[]) || []);
    setLoadingPkgs(false);
  }, [visitorId]);

  useEffect(() => { loadPackages(); loadBalances(); }, [loadPackages, loadBalances]);

  const checkVoucher = async () => {
    const code = voucher.trim().toUpperCase();
    if (!code || checkingVoucher) return;
    setCheckingVoucher(true);
    const r = await invokeCredits({ action: "check_voucher", voucherCode: code });
    setCheckingVoucher(false);
    if (r.error) setVoucherState({ ok: false, amount: 0, msg: r.network ? creditErrorMessage("network") : "Voucher tidak valid atau sudah tidak berlaku." });
    else setVoucherState({ ok: true, amount: Number(r.data?.discount_amount) || 0, msg: "Voucher aktif" });
  };

  const openConfirm = async (q: CreditQuote) => {
    if (!visitorId || busyRef.current) return;
    setFlowError("");
    setQuoting(q.package_id);
    const r = await invokeCredits({ action: "quote", visitorId, packageId: q.package_id, voucherCode: voucherState?.ok ? voucher.trim() : "" });
    setQuoting(null);
    if (r.error) { setFlowError(creditErrorMessage(r.error)); return; }
    refRef.current = (crypto.randomUUID?.() || `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
    setConfirm(r.data.quote as CreditQuote);
  };

  const goToPin = () => { setPin(""); setPinError(""); setPinOpen(true); };

  const pay = async () => {
    if (!confirm || !visitorId || busyRef.current || pin.length !== 6) return;
    busyRef.current = true;
    setPinError("");
    setStage("verifying");
    const t = window.setTimeout(() => setStage("processing"), 600);
    const r = await invokeCredits({
      action: "purchase", visitorId, packageId: confirm.package_id, pin,
      voucherCode: voucherState?.ok ? voucher.trim() : "", paymentSource: source, purchaseRef: refRef.current,
    });
    window.clearTimeout(t);
    setStage("idle");
    busyRef.current = false;
    if (r.error) {
      if (r.data?.needPin) { setPin(""); setPinError(creditErrorMessage(r.error)); return; }
      setPinOpen(false);
      setFlowError(creditErrorMessage(r.error));
      if (/voucher/i.test(r.error)) setVoucherState({ ok: false, amount: 0, msg: "Voucher tidak valid atau sudah tidak berlaku." });
      return;
    }
    const d = r.data;
    setPin("");
    setPinOpen(false);
    const pkg = confirm;
    setConfirm(null);
    setSuccess({
      label: d.package?.label || pkg.label, credits: Number(d.credits) || 0, added: pkg.is_unlimited ? 0 : pkg.credits,
      isUnlimited: !!pkg.is_unlimited, unlimitedUntil: d.unlimited_until || null, paid: Number(d.final_price ?? pkg.final_price) || 0,
      source: d.source_label || "-", mainLeft: Number(d.balance_remaining) || 0, gameLeft: Number(d.game_balance_remaining) || 0, trx: d.trx_id || null,
    });
    setCredits(Number(d.credits) || 0);
    setMainBal(Number(d.balance_remaining) || 0);
    setGameBal(Number(d.game_balance_remaining) || 0);
    if (voucherState?.ok) { setVoucher(""); setVoucherState(null); }
    refreshEverything();
    onPurchased?.();
    loadBalances();
  };

  if (!visitorId) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 text-center space-y-2">
        <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Login ke akun saldo untuk membeli kredit</p>
      </div>
    );
  }

  const plan = confirm ? planPayment(confirm.final_price, source, gameBal, mainBal) : null;
  const flashPct = quotes.find(q => q.flash_pct > 0)?.flash_pct || 0;

  return (
    <div className="space-y-3 min-w-0" data-testid="credit-shop">
      {!compact && (
        <div>
          <h3 className="text-base font-black text-foreground flex items-center gap-2">🔑 Beli Kredit Jawaban</h3>
          <p className="text-xs text-muted-foreground">1 kredit = 1x lihat kunci jawaban game</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {[
          { l: "Saldo IN", v: formatRupiah(gameBal), c: "text-emerald-500" },
          { l: "Saldo Utama", v: formatRupiah(mainBal), c: "text-primary" },
          { l: "Kredit", v: credits.toLocaleString("id-ID"), c: "text-amber-500" },
        ].map(b => (
          <div key={b.l} className="rounded-xl border border-border bg-card/70 p-2 min-w-0">
            <p className="text-[10px] font-semibold text-muted-foreground">{b.l}</p>
            <p className={`text-xs sm:text-sm font-black tabular-nums truncate ${b.c}`}>{b.v}</p>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <div className="flex gap-2">
          <div className="relative flex-1 min-w-0">
            <Tag className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Kode voucher" placeholder="Kode voucher" value={voucher} disabled={busy}
              onChange={e => { setVoucher(e.target.value.toUpperCase()); setVoucherState(null); }}
              className="pl-8 h-10 text-xs uppercase" />
          </div>
          <Button variant="outline" className="h-10 text-xs" disabled={!voucher.trim() || checkingVoucher || busy} onClick={checkVoucher}>
            {checkingVoucher ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Cek"}
          </Button>
        </div>
        {voucherState && (
          <p className={`text-xs font-semibold flex items-center gap-1 ${voucherState.ok ? "text-emerald-500" : "text-destructive"}`}>
            {voucherState.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            {voucherState.ok ? `Voucher aktif • Diskon ${formatRupiah(voucherState.amount)}` : voucherState.msg}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Sumber Pembayaran</p>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Sumber pembayaran">
          {([
            { id: "auto", t: "Otomatis", s: "Prioritas Saldo IN", I: Zap },
            { id: "game", t: "Saldo IN", s: formatRupiah(gameBal), I: Wallet },
            { id: "main", t: "Saldo Utama", s: formatRupiah(mainBal), I: Wallet },
          ] as const).map(o => {
            const on = source === o.id;
            return (
              <button key={o.id} type="button" role="radio" aria-checked={on} disabled={busy} onClick={() => setSource(o.id)}
                className={`min-h-12 rounded-xl border-2 px-1.5 py-1.5 text-left transition min-w-0 ${on ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-card"}`}>
                <span className={`flex items-center gap-1 text-[11px] font-black ${on ? "text-primary" : "text-foreground"}`}>
                  <o.I className="w-3 h-3 shrink-0" />{o.t}{on && <CheckCircle2 className="w-3 h-3 ml-auto shrink-0" />}
                </span>
                <span className="block text-[9px] text-muted-foreground truncate tabular-nums">{o.s}</span>
              </button>
            );
          })}
        </div>
      </div>

      {flashPct > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-600 dark:text-amber-400">
          🔥 FLASH SALE • Diskon {flashPct}% semua paket
        </div>
      )}
      {flowError && (
        <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{flowError}</div>
      )}

      {loadingPkgs ? (
        <div className="grid grid-cols-2 gap-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : quotes.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-4">Paket kredit belum tersedia.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {quotes.map(q => {
            const perCredit = !q.is_unlimited && q.credits > 0 ? q.final_price / q.credits : 0;
            const finite = quotes.filter(x => !x.is_unlimited && x.credits > 0);
            const best = finite.length ? finite.reduce((a, b) => (a.final_price / a.credits <= b.final_price / b.credits ? a : b)) : null;
            const isBest = !!best && best.package_id === q.package_id;
            const isPopular = !q.is_unlimited && q.credits === 500 && !isBest;
            const promo = q.final_price < q.price;
            const pct = q.price > 0 ? Math.round(((q.price - q.final_price) / q.price) * 100) : 0;
            const short = planPayment(q.final_price, source, gameBal, mainBal).insufficient;
            return (
              <motion.button key={q.package_id} type="button" whileTap={{ scale: 0.97 }} disabled={busy}
                data-testid="credit-package" onClick={() => openConfirm(q)}
                className={`relative text-left rounded-2xl border p-3 min-w-0 transition disabled:opacity-60 ${q.is_unlimited
                  ? "col-span-2 border-amber-400/60 bg-gradient-to-br from-amber-500/15 via-card to-rose-500/10"
                  : "border-border bg-gradient-to-br from-card to-muted/40 hover:border-primary/50"}`}>
                <div className="flex flex-wrap gap-1 mb-1">
                  {q.is_unlimited && <span className="rounded-full bg-amber-500 px-1.5 text-[9px] font-black text-white">UNLIMITED</span>}
                  {isBest && <span className="rounded-full bg-emerald-600 px-1.5 text-[9px] font-black text-white">💎 BEST VALUE</span>}
                  {isPopular && <span className="rounded-full bg-orange-500 px-1.5 text-[9px] font-black text-white">🔥 PALING POPULER</span>}
                  {q.flash_pct > 0 && <span className="rounded-full bg-rose-500 px-1.5 text-[9px] font-black text-white">FLASH SALE</span>}
                  {q.member_pct > 0 && <span className="rounded-full bg-violet-600 px-1.5 text-[9px] font-black text-white">👑 Premium -{q.member_pct}%</span>}
                </div>
                <p className="text-sm font-black text-foreground flex items-center gap-1.5">
                  {q.is_unlimited ? <InfinityIcon className="w-4 h-4 text-amber-500" /> : <Key className="w-4 h-4 text-primary" />}
                  <span className="truncate">{q.label}</span>
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {q.is_unlimited ? `Tanpa batas • ${q.unlimited_days} hari` : `Lihat ${q.credits.toLocaleString("id-ID")}× kunci jawaban`}
                </p>
                <div className="mt-2 flex items-end justify-between gap-1">
                  <div className="min-w-0">
                    {promo && <p className="text-[10px] text-muted-foreground line-through tabular-nums">{formatRupiah(q.price)}</p>}
                    <p className="text-sm font-black text-foreground tabular-nums">{formatRupiah(q.final_price)}</p>
                    {promo && <p className="text-[9px] font-bold text-emerald-500">Hemat {pct}%</p>}
                    {perCredit > 0 && <p className="text-[9px] text-muted-foreground tabular-nums">≈ {formatRupiah(Math.round(perCredit))}/kredit</p>}
                  </div>
                  <span className="text-[10px] font-black text-primary shrink-0">
                    {quoting === q.package_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "BELI →"}
                  </span>
                </div>
                {short && <p className="mt-1 text-[9px] font-semibold text-destructive">Saldo tidak cukup</p>}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* KONFIRMASI */}
      <Dialog open={!!confirm && !pinOpen} onOpenChange={o => { if (!o && !busy) setConfirm(null); }}>
        <DialogContent className="max-w-sm w-[calc(100vw-1.5rem)] rounded-2xl">
          <DialogTitle className="flex items-center gap-2">🔑 Konfirmasi Pembelian</DialogTitle>
          <DialogDescription className="sr-only">Periksa rincian sebelum membayar</DialogDescription>
          {confirm && plan && (
            <div className="space-y-3">
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-lg font-black text-foreground">{confirm.label}</p>
                <p className="text-[11px] text-muted-foreground">{confirm.is_unlimited ? `Unlimited ${confirm.unlimited_days} hari` : `+${confirm.credits} kredit jawaban`}</p>
              </div>
              <dl className="space-y-1.5 text-sm">
                <Row k="Harga" v={formatRupiah(confirm.price)} />
                {confirm.flash_discount > 0 && <Row k={`Flash Sale ${confirm.flash_pct}%`} v={`-${formatRupiah(confirm.flash_discount)}`} good />}
                {confirm.member_discount > 0 && <Row k={`👑 Premium ${confirm.member_pct}%`} v={`-${formatRupiah(confirm.member_discount)}`} good />}
                {confirm.voucher_discount > 0 && <Row k="Voucher" v={`-${formatRupiah(confirm.voucher_discount)}`} good />}
                <div className="border-t border-border pt-1.5"><Row k="Total" v={formatRupiah(confirm.final_price)} bold /></div>
                <Row k="Bayar dengan" v={plan.label} />
                <Row k="Saldo IN setelah" v={formatRupiah(gameBal - plan.fromGame)} />
                <Row k="Saldo Utama setelah" v={formatRupiah(mainBal - plan.fromMain)} />
              </dl>
              {plan.insufficient && <p role="alert" className="text-xs font-semibold text-destructive">Saldo tidak cukup untuk membeli paket ini.</p>}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-11" onClick={() => setConfirm(null)}>Batal</Button>
                <Button className="h-11 font-bold" disabled={plan.insufficient} onClick={goToPin}>🔑 Lanjutkan</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PIN */}
      <Dialog open={pinOpen} onOpenChange={o => { if (!o && stage === "idle") { setPinOpen(false); setPin(""); setPinError(""); } }}>
        <DialogContent className="max-w-sm w-[calc(100vw-1.5rem)] rounded-2xl">
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary" /> Masukkan PIN</DialogTitle>
          <DialogDescription>Untuk keamanan, masukkan PIN akun saldo kamu.</DialogDescription>
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); pay(); }}>
            <Input type="password" inputMode="numeric" autoComplete="off" maxLength={6} autoFocus aria-label="PIN 6 digit"
              placeholder="••••••" value={pin} disabled={stage !== "idle"}
              onChange={e => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setPinError(""); }}
              className="h-12 text-center font-mono text-xl tracking-[0.6em]" />
            {pinError && <p role="alert" className="text-xs font-semibold text-destructive">{pinError}</p>}
            {stage !== "idle" && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />
                {stage === "verifying" ? "Memverifikasi PIN..." : "Memproses pembelian..."}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-11" disabled={stage !== "idle"} onClick={() => { setPinOpen(false); setPin(""); }}>Batal</Button>
              <Button type="submit" className="h-11 font-bold" disabled={pin.length !== 6 || stage !== "idle"}>
                {stage !== "idle" ? <Loader2 className="w-4 h-4 animate-spin" /> : "🔒 Bayar Sekarang"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* SUKSES */}
      <Dialog open={!!success} onOpenChange={o => { if (!o) setSuccess(null); }}>
        <DialogContent className="max-w-sm w-[calc(100vw-1.5rem)] rounded-2xl overflow-hidden">
          <DialogTitle className="sr-only">Pembelian berhasil</DialogTitle>
          <DialogDescription className="sr-only">Rincian pembelian kredit</DialogDescription>
          <AnimatePresence>
            {success && (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3 text-center">
                <div className="relative mx-auto w-20 h-20">
                  <div className="absolute inset-0 rounded-full bg-emerald-500/30 blur-xl animate-pulse" />
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}
                    className="relative w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center">
                    <CheckCircle2 className="w-11 h-11 text-white" />
                  </motion.div>
                </div>
                <p className="text-lg font-black text-foreground">🎉 PEMBELIAN BERHASIL!</p>
                {success.isUnlimited ? (
                  <div>
                    <p className="text-2xl font-black text-amber-500">♾ UNLIMITED AKTIF</p>
                    {success.unlimitedUntil && <p className="text-xs text-muted-foreground">Berlaku sampai {new Date(success.unlimitedUntil).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>}
                  </div>
                ) : (
                  <div>
                    <p className="text-3xl font-black text-primary">+{success.added.toLocaleString("id-ID")} Kredit</p>
                    <p className="text-xs text-muted-foreground">Kredit kamu sekarang: <CountUp value={success.credits} className="font-black text-foreground" /> Kredit</p>
                  </div>
                )}
                <dl className="rounded-xl bg-muted/50 p-3 space-y-1 text-sm text-left">
                  <Row k="Pembayaran" v={formatRupiah(success.paid)} />
                  <Row k="Dibayar dengan" v={success.source} />
                  <Row k="Sisa Saldo IN" v={formatRupiah(success.gameLeft)} />
                  <Row k="Sisa Saldo Utama" v={formatRupiah(success.mainLeft)} />
                  {success.trx && <Row k="ID Transaksi" v={success.trx} />}
                </dl>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="h-11 font-bold gap-1" onClick={() => { setSuccess(null); onUseCredits?.(); }}><Gamepad2 className="w-4 h-4" /> Gunakan Kredit</Button>
                  <Button variant="outline" className="h-11" onClick={() => setSuccess(null)}>Tutup</Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ k, v, good, bold }: { k: string; v: string; good?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={`tabular-nums text-right ${bold ? "font-black text-foreground" : "font-semibold"} ${good ? "text-emerald-500" : "text-foreground"}`}>{v}</dd>
    </div>
  );
}
