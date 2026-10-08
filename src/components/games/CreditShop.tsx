import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Coins, Gamepad2, Infinity as InfinityIcon, Key, Loader2, Lock,
  ShieldCheck, Sparkles, Star, Tag, Wallet, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import CountUp from "@/components/CountUp";
import { triggerGameBalanceRefresh } from "./GameBalance";
import {
  type CreditQuote, type PaySource, bestValuePackageId, creditErrorMessage, formatRupiah, planPayment,
  pricePerCredit, savingsPct, shortfallMessage,
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

const SOURCE_LABEL: Record<PaySource, string> = { auto: "Otomatis (Saldo IN dulu)", game: "Saldo IN", main: "Saldo Utama" };
const HERO_PARTICLES = [
  { l: "12%", t: "70%", d: "0s" }, { l: "28%", t: "30%", d: "1.4s" }, { l: "46%", t: "78%", d: "2.6s" },
  { l: "64%", t: "22%", d: "0.8s" }, { l: "80%", t: "64%", d: "2s" }, { l: "90%", t: "34%", d: "3.2s" },
];
const CONFETTI = Array.from({ length: 10 }, (_, i) => ({ x: Math.cos((i / 10) * Math.PI * 2) * 70, y: Math.sin((i / 10) * Math.PI * 2) * 52 }));

const fmtDate = (s: string) => new Date(s).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

/** Satu-satunya alur beli Kredit Jawaban: dipakai Shop Kredit (dialog game) dan Plus Hub. */
export default function CreditShopPanel({ visitorId, onPurchased, onUseCredits, compact }: Props) {
  const reduce = useReducedMotion();
  const [quotes, setQuotes] = useState<CreditQuote[]>([]);
  const [loadingPkgs, setLoadingPkgs] = useState(true);
  const [mainBal, setMainBal] = useState(0);
  const [gameBal, setGameBal] = useState(0);
  const [credits, setCredits] = useState(0);
  const [unlimitedUntil, setUnlimitedUntil] = useState<string | null>(null);
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
    if (!cr.error) {
      setCredits(Number(cr.data?.credits) || 0);
      setUnlimitedUntil(cr.data?.is_unlimited && cr.data?.unlimited_until ? String(cr.data.unlimited_until) : null);
    }
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
    if (pkg.is_unlimited && d.unlimited_until) setUnlimitedUntil(String(d.unlimited_until));
    if (voucherState?.ok) { setVoucher(""); setVoucherState(null); }
    refreshEverything();
    onPurchased?.();
    loadBalances();
  };

  if (!visitorId) {
    return (
      <div className="credit-shop rounded-2xl border border-border bg-card p-5 text-center space-y-2">
        <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Login ke akun saldo untuk membeli kredit</p>
      </div>
    );
  }

  const plan = confirm ? planPayment(confirm.final_price, source, gameBal, mainBal) : null;
  const flashPct = quotes.reduce((m, q) => Math.max(m, q.flash_pct || 0), 0);
  const bestId = bestValuePackageId(quotes);
  const isUnlimitedActive = !!unlimitedUntil && new Date(unlimitedUntil).getTime() > Date.now();
  // Urutan tampil: paket worth it di atas, paket biasa di grid, unlimited di bawah (data & harga tetap dari server).
  const ordered = [
    ...quotes.filter(q => q.package_id === bestId),
    ...quotes.filter(q => q.package_id !== bestId && !q.is_unlimited),
    ...quotes.filter(q => q.package_id !== bestId && q.is_unlimited),
  ];
  const normalCount = quotes.filter(q => q.package_id !== bestId && !q.is_unlimited).length;
  const gridCols = normalCount >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  const confirmDiscount = confirm ? confirm.flash_discount + confirm.member_discount + confirm.voucher_discount : 0;

  return (
    <div className="credit-shop mx-auto w-full max-w-3xl space-y-3 min-w-0" data-testid="credit-shop">
      {/* HERO */}
      {!compact && (
        <section className="credit-hero relative overflow-hidden rounded-2xl p-4" aria-labelledby="credit-hero-title">
          <span className="credit-hero-beam" aria-hidden />
          {HERO_PARTICLES.map((p, i) => (
            <span key={i} className="credit-hero-particle" style={{ left: p.l, top: p.t, animationDelay: p.d }} aria-hidden />
          ))}
          <div className="relative flex items-center gap-3">
            <div className="credit-hero-icon relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl">
              <Gamepad2 className="h-7 w-7" />
              <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full credit-gold-chip">
                <Key className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="min-w-0">
              <h3 id="credit-hero-title" className="text-lg font-black leading-tight credit-hero-title">Beli Kredit Game</h3>
              <p className="text-xs credit-hero-sub">Siapkan kredit untuk membuka bantuan dan fitur game.</p>
              <p className="mt-1 text-[10px] font-semibold credit-hero-sub">1 kredit = 1× lihat kunci jawaban</p>
            </div>
          </div>
        </section>
      )}

      {/* WALLET */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="credit-wallet-key col-span-2 sm:col-span-1 sm:order-3 relative overflow-hidden rounded-2xl p-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-black tracking-wide credit-wallet-key-label flex items-center gap-1"><Key className="h-3.5 w-3.5" /> KREDIT GAME</p>
            {isUnlimitedActive && (
              <span className="credit-gold-chip rounded-full px-2 py-0.5 text-[9px] font-black flex items-center gap-0.5">
                <InfinityIcon className="h-3 w-3" /> UNLIMITED
              </span>
            )}
          </div>
          <p className="mt-0.5 text-2xl font-black tabular-nums text-foreground" data-testid="credit-count">
            <CountUp value={credits} />
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {isUnlimitedActive ? `Unlimited sampai ${fmtDate(unlimitedUntil!)}` : "Kredit tersedia"}
          </p>
        </div>
        <WalletMini icon={<Gamepad2 className="h-3.5 w-3.5" />} label="Saldo Game (IN)" value={formatRupiah(gameBal)} />
        <WalletMini icon={<Coins className="h-3.5 w-3.5" />} label="Saldo Utama" value={formatRupiah(mainBal)} />
      </div>

      {/* PROMO */}
      {flashPct > 0 && (
        <div className="credit-flash relative overflow-hidden rounded-2xl px-3 py-2.5 flex items-center gap-2" role="status">
          <Zap className="h-5 w-5 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-black tracking-wide">⚡ FLASH OFFER • Hemat hingga {flashPct}%</p>
            <p className="text-[10px] opacity-90">Harga di bawah sudah termasuk diskon dari server.</p>
          </div>
        </div>
      )}
      {flowError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />{flowError}
        </div>
      )}

      {/* PAKET */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-black text-foreground flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> Pilih Paket</p>
        {voucherState?.ok && <span className="text-[10px] font-bold text-primary">Voucher dihitung saat konfirmasi</span>}
      </div>
      {loadingPkgs ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 rounded-2xl bg-muted animate-pulse" />)}</div>
      ) : quotes.length === 0 ? (
        <p className="text-center text-xs text-muted-foreground py-6 rounded-2xl border border-dashed border-border">Paket kredit belum tersedia.</p>
      ) : (
        <div className={`grid grid-cols-2 gap-2.5 ${gridCols}`}>
          {ordered.map((q, i) => {
            const perCredit = pricePerCredit(q);
            const isBest = bestId === q.package_id;
            const featured = isBest || q.is_unlimited;
            const pct = savingsPct(q);
            const short = shortfallMessage(q.final_price, source, gameBal, mainBal);
            const loading = quoting === q.package_id;
            return (
              <motion.button key={q.package_id} type="button" disabled={busy}
                initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduce ? 0 : Math.min(i, 6) * 0.05, duration: 0.3 }}
                whileHover={reduce || busy ? undefined : { y: -2 }} whileTap={reduce || busy ? undefined : { scale: 0.97 }}
                data-testid="credit-package" data-best={isBest || undefined}
                aria-label={`Beli ${q.label}, ${q.is_unlimited ? `unlimited ${q.unlimited_days} hari` : `${q.credits} kredit`}, ${formatRupiah(q.final_price)}`}
                onClick={() => openConfirm(q)}
                className={`credit-pkg group relative flex flex-col text-left rounded-2xl p-3 min-w-0 disabled:opacity-60 disabled:cursor-not-allowed
                  ${featured ? "col-span-full credit-pkg-featured" : ""} ${q.is_unlimited ? "credit-pkg-unlimited" : ""}`}>
                {isBest && (
                  <span className="credit-best-badge absolute -top-px left-1/2 -translate-x-1/2 rounded-b-xl px-3 py-0.5 text-[10px] font-black flex items-center gap-1 whitespace-nowrap">
                    <Star className="h-3 w-3" /> PALING WORTH IT
                  </span>
                )}
                <div className={`flex flex-wrap gap-1 ${isBest ? "mt-4" : ""}`}>
                  {q.is_unlimited && <Chip className="credit-gold-chip">♾ UNLIMITED</Chip>}
                  {q.flash_pct > 0 && <Chip className="credit-chip-flash">⚡ -{q.flash_pct}%</Chip>}
                  {q.member_pct > 0 && <Chip className="credit-chip-member">👑 Premium -{q.member_pct}%</Chip>}
                </div>

                <div className={`mt-1.5 flex ${featured ? "items-center gap-3" : "flex-col gap-1.5"}`}>
                  <div className={`credit-pkg-icon grid shrink-0 place-items-center rounded-xl ${featured ? "h-12 w-12" : "h-10 w-10"}`}>
                    {q.is_unlimited ? <InfinityIcon className="h-6 w-6" /> : <Key className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className={`font-black text-foreground leading-tight ${featured ? "text-lg" : "text-xl"} tabular-nums`}>
                      {q.is_unlimited ? `${q.unlimited_days} Hari` : q.credits.toLocaleString("id-ID")}
                      <span className="ml-1 text-[11px] font-bold text-muted-foreground">{q.is_unlimited ? "tanpa batas" : "kredit"}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground break-words">{q.label}</p>
                  </div>
                </div>

                <div className="mt-2 flex-1">
                  {pct > 0 && (
                    <p className="text-[10px] tabular-nums">
                      <span className="text-muted-foreground line-through">{formatRupiah(q.price)}</span>
                      <span className="ml-1 font-black text-primary">Hemat {pct}%</span>
                    </p>
                  )}
                  <p className={`font-black text-foreground tabular-nums break-all ${featured ? "text-xl" : "text-base"}`}>{formatRupiah(q.final_price)}</p>
                  {perCredit > 0 && <p className="text-[10px] text-muted-foreground tabular-nums">≈ {formatRupiah(Math.round(perCredit))} / kredit</p>}
                  {short && <p className="mt-0.5 text-[10px] font-semibold text-destructive">{short}</p>}
                </div>

                <span className={`credit-cta mt-2 flex h-10 items-center justify-center gap-1.5 rounded-xl text-xs font-black ${featured ? "sm:max-w-xs sm:self-end sm:w-56" : ""}`}>
                  {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Memproses...</> : <>Beli Sekarang <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* VOUCHER */}
      <div className="rounded-2xl border border-border bg-card/70 p-3 space-y-2">
        <label htmlFor="credit-voucher" className="text-xs font-black text-foreground flex items-center gap-1.5">
          <Tag className="h-4 w-4 text-primary" /> Punya kode voucher?
        </label>
        <div className="flex gap-2">
          <Input id="credit-voucher" placeholder="MASUKKAN KODE PROMO" value={voucher} disabled={busy} autoComplete="off"
            onChange={e => { setVoucher(e.target.value.toUpperCase()); setVoucherState(null); }}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); checkVoucher(); } }}
            className={`h-11 text-xs uppercase font-mono tracking-wider min-w-0 ${voucherState ? (voucherState.ok ? "border-primary" : "border-destructive") : ""}`} />
          <Button className="h-11 px-4 text-xs font-black" disabled={!voucher.trim() || checkingVoucher || busy} onClick={checkVoucher}>
            {checkingVoucher ? <Loader2 className="w-4 h-4 animate-spin" /> : "Terapkan"}
          </Button>
        </div>
        <AnimatePresence initial={false}>
          {voucherState && (
            <motion.p key={voucherState.ok ? "ok" : "bad"} initial={reduce ? false : { opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              role="status" className={`rounded-lg px-2.5 py-1.5 text-xs font-bold flex items-center gap-1.5 ${voucherState.ok ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}>
              {voucherState.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
              {voucherState.ok ? `✓ Voucher aktif • Hemat ${formatRupiah(voucherState.amount)}` : `⚠ ${voucherState.msg}`}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* SUMBER PEMBAYARAN */}
      <div className="rounded-2xl border border-border bg-card/70 p-3 space-y-2">
        <p className="text-xs font-black text-foreground flex items-center gap-1.5"><Wallet className="w-4 h-4 text-primary" /> Bayar dengan</p>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Sumber pembayaran">
          {([
            { id: "auto", t: "Otomatis", s: "Saldo IN dulu", I: Zap },
            { id: "game", t: "Saldo IN", s: formatRupiah(gameBal), I: Gamepad2 },
            { id: "main", t: "Saldo Utama", s: formatRupiah(mainBal), I: Coins },
          ] as const).map(o => {
            const on = source === o.id;
            return (
              <button key={o.id} type="button" role="radio" aria-checked={on} disabled={busy} onClick={() => setSource(o.id)}
                className={`relative min-h-14 rounded-xl border-2 px-2 py-1.5 pr-5 text-left transition min-w-0 ${on ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-card hover:border-primary/40"}`}>
                {on && <CheckCircle2 className="absolute right-1 top-1 w-3.5 h-3.5 text-primary" aria-hidden />}
                <span className={`flex items-start gap-1 text-[11px] font-black leading-tight ${on ? "text-primary" : "text-foreground"}`}>
                  <o.I className="w-3.5 h-3.5 shrink-0" /><span className="min-w-0">{o.t}</span>
                </span>
                <span className="block text-[10px] leading-tight text-muted-foreground break-words tabular-nums">{o.s}</span>
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Pembayaran aman dengan PIN 6 digit • harga dihitung server</p>
      </div>

      {/* KONFIRMASI */}
      <Dialog open={!!confirm && !pinOpen} onOpenChange={o => { if (!o && !busy) setConfirm(null); }}>
        <DialogContent className="credit-shop max-w-sm w-[calc(100vw-1.5rem)] max-h-[90dvh] overflow-y-auto rounded-2xl">
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Konfirmasi Pembelian</DialogTitle>
          <DialogDescription>Periksa rincian sebelum membayar.</DialogDescription>
          {confirm && plan && (
            <div className="space-y-3">
              <div className="credit-hero relative overflow-hidden rounded-xl p-3 flex items-center gap-3">
                <div className="credit-hero-icon grid h-11 w-11 shrink-0 place-items-center rounded-xl">
                  {confirm.is_unlimited ? <InfinityIcon className="h-6 w-6" /> : <Key className="h-5 w-5" />}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-black credit-hero-title truncate">{confirm.label}</p>
                  <p className="text-[11px] credit-hero-sub">{confirm.is_unlimited ? `Unlimited ${confirm.unlimited_days} hari` : `+${confirm.credits.toLocaleString("id-ID")} kredit`}</p>
                </div>
              </div>
              <dl className="space-y-1.5 text-sm">
                <Row k="Paket" v={confirm.label} />
                <Row k="Kredit" v={confirm.is_unlimited ? `Unlimited ${confirm.unlimited_days} hari` : `${confirm.credits.toLocaleString("id-ID")} kredit`} />
                <Row k="Harga" v={formatRupiah(confirm.price)} />
                {confirm.flash_discount > 0 && <Row k={`⚡ Flash Sale ${confirm.flash_pct}%`} v={`-${formatRupiah(confirm.flash_discount)}`} good />}
                {confirm.member_discount > 0 && <Row k={`👑 Premium ${confirm.member_pct}%`} v={`-${formatRupiah(confirm.member_discount)}`} good />}
                {confirm.voucher_discount > 0 && <Row k="🏷️ Voucher" v={`-${formatRupiah(confirm.voucher_discount)}`} good />}
                {confirmDiscount > 0 && <Row k="Total diskon" v={`-${formatRupiah(confirmDiscount)}`} good />}
                <div className="border-t border-border pt-1.5"><Row k="Total bayar" v={formatRupiah(confirm.final_price)} bold /></div>
                <Row k="Sumber dipilih" v={SOURCE_LABEL[source]} />
                <Row k="Dipotong dari" v={plan.label} />
                <Row k="Saldo IN setelah" v={formatRupiah(gameBal - plan.fromGame)} />
                <Row k="Saldo Utama setelah" v={formatRupiah(mainBal - plan.fromMain)} />
              </dl>
              {confirm.voucher_error && <p className="text-xs font-semibold text-destructive">⚠ Voucher tidak dipakai: {creditErrorMessage(confirm.voucher_error)}</p>}
              {plan.insufficient && (
                <p role="alert" className="rounded-lg bg-destructive/10 px-2.5 py-1.5 text-xs font-semibold text-destructive">
                  {shortfallMessage(confirm.final_price, source, gameBal, mainBal)}. Pilih sumber lain atau isi saldo.
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-11" onClick={() => setConfirm(null)}>Batal</Button>
                <Button className="h-11 font-black gap-1" disabled={plan.insufficient} onClick={goToPin}>Lanjutkan <ArrowRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PIN */}
      <Dialog open={pinOpen} onOpenChange={o => { if (!o && stage === "idle") { setPinOpen(false); setPin(""); setPinError(""); } }}>
        <DialogContent className="credit-shop max-w-sm w-[calc(100vw-1.5rem)] max-h-[90dvh] overflow-y-auto rounded-2xl">
          <div className="credit-hero-icon mx-auto grid h-14 w-14 place-items-center rounded-2xl"><Lock className="h-7 w-7" /></div>
          <DialogTitle className="text-center">Konfirmasi Pembelian</DialogTitle>
          <DialogDescription className="text-center">Masukkan PIN akun untuk melanjutkan.</DialogDescription>
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); pay(); }}>
            {confirm && (
              <p className="text-center text-xs text-muted-foreground">{confirm.label} • <span className="font-black text-foreground tabular-nums">{formatRupiah(confirm.final_price)}</span></p>
            )}
            <Input type="password" inputMode="numeric" autoComplete="off" maxLength={6} autoFocus aria-label="PIN 6 digit"
              placeholder="••••••" value={pin} disabled={stage !== "idle"}
              onChange={e => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setPinError(""); }}
              className="h-12 text-center font-mono text-xl tracking-[0.6em]" />
            <div className="flex justify-center gap-1.5" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <span key={i} className={`h-1.5 w-6 rounded-full transition-colors ${i < pin.length ? "bg-primary" : "bg-muted"}`} />
              ))}
            </div>
            {pinError && <p role="alert" className="text-xs font-semibold text-destructive text-center">{pinError}</p>}
            {stage !== "idle" ? (
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5" role="status"><Loader2 className="w-3.5 h-3.5 animate-spin" />
                {stage === "verifying" ? "Memverifikasi PIN..." : "Memproses pembelian..."}</p>
            ) : (
              <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Transaksi diproses secara aman</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-11" disabled={stage !== "idle"} onClick={() => { setPinOpen(false); setPin(""); }}>Batal</Button>
              <Button type="submit" className="h-11 font-black gap-1" disabled={pin.length !== 6 || stage !== "idle"}>
                {stage !== "idle" ? <><Loader2 className="w-4 h-4 animate-spin" /> Memproses...</> : <><Lock className="h-4 w-4" /> Bayar Sekarang</>}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* SUKSES */}
      <Dialog open={!!success} onOpenChange={o => { if (!o) setSuccess(null); }}>
        <DialogContent className="credit-shop max-w-sm w-[calc(100vw-1.5rem)] max-h-[90dvh] overflow-y-auto rounded-2xl overflow-x-hidden">
          <DialogTitle className="sr-only">Pembelian berhasil</DialogTitle>
          <DialogDescription className="sr-only">Rincian pembelian kredit</DialogDescription>
          <AnimatePresence>
            {success && (
              <motion.div initial={reduce ? false : { opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3 text-center">
                <div className="relative mx-auto h-24 w-24">
                  <div className="credit-success-glow absolute inset-0 rounded-full" />
                  {!reduce && CONFETTI.map((c, i) => (
                    <motion.span key={i} className={`absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full ${i % 3 === 0 ? "credit-gold-chip" : "bg-primary"}`}
                      initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: c.x, y: c.y, opacity: 0 }} transition={{ duration: 0.9, delay: 0.15 }} aria-hidden />
                  ))}
                  <motion.div initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}
                    className="credit-hero-icon relative grid h-24 w-24 place-items-center rounded-full">
                    <CheckCircle2 className="h-12 w-12" />
                  </motion.div>
                </div>
                <p className="text-lg font-black text-foreground">✨ PEMBELIAN BERHASIL!</p>
                {success.isUnlimited ? (
                  <div>
                    <p className="text-2xl font-black text-primary">♾ UNLIMITED AKTIF</p>
                    {success.unlimitedUntil && <p className="text-xs text-muted-foreground">Berlaku sampai {fmtDate(success.unlimitedUntil)}</p>}
                  </div>
                ) : (
                  <div>
                    <p className="text-3xl font-black text-primary">+{success.added.toLocaleString("id-ID")} Kredit</p>
                    <p className="text-xs text-muted-foreground">Kredit sekarang: <CountUp value={success.credits} className="font-black text-foreground" /> Kredit</p>
                  </div>
                )}
                <dl className="rounded-xl bg-muted/50 p-3 space-y-1 text-sm text-left">
                  <Row k="Paket" v={success.label} />
                  <Row k="Pembayaran" v={formatRupiah(success.paid)} />
                  <Row k="Dibayar dengan" v={success.source} />
                  <Row k="Sisa Saldo IN" v={formatRupiah(success.gameLeft)} />
                  <Row k="Sisa Saldo Utama" v={formatRupiah(success.mainLeft)} />
                  {success.trx && <Row k="ID Transaksi" v={success.trx} />}
                </dl>
                <div className="grid grid-cols-2 gap-2">
                  <Button className="h-11 font-black gap-1" onClick={() => { setSuccess(null); onUseCredits?.(); }}><Gamepad2 className="w-4 h-4" /> Gunakan Kredit</Button>
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

function WalletMini({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/80 p-2.5 min-w-0">
      <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1 truncate">{icon}{label}</p>
      <p className="text-sm font-black tabular-nums text-foreground truncate">{value}</p>
    </div>
  );
}

function Chip({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black ${className}`}>{children}</span>;
}

function Row({ k, v, good, bold }: { k: string; v: string; good?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="text-muted-foreground shrink-0">{k}</dt>
      <dd className={`tabular-nums text-right break-words min-w-0 ${bold ? "font-black text-foreground" : "font-semibold"} ${good ? "text-primary" : "text-foreground"}`}>{v}</dd>
    </div>
  );
}
