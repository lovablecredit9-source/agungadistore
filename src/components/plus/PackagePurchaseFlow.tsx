import { useEffect, useRef, useState } from "react";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import { motion } from "framer-motion";
import { CalendarDays, CheckCircle2, Gift, HardDrive, Loader2, ShieldCheck, Tag, Wallet, XCircle, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { triggerGameBalanceRefresh } from "@/components/games/GameBalance";
import { GAME_CREDITS_REFRESH_EVENT } from "@/components/games/CreditShop";
import { type PaySource, creditErrorMessage, formatRupiah, planPayment } from "@/components/games/creditShopLogic";

export type PackageKind = "streak" | "storage" | "bundle";
export interface PurchasePackage {
  kind: PackageKind; id: string; name: string; price: number;
  days?: number; storageMb?: number; credits?: number; streakDays?: number;
}

const FN: Record<PackageKind, string> = { streak: "purchase-streak-plan", storage: "upgrade-storage", bundle: "purchase-bundle" };
const ICON: Record<PackageKind, typeof Gift> = { streak: CalendarDays, storage: HardDrive, bundle: Gift };
const TITLE: Record<PackageKind, string> = { streak: "Paket Streak", storage: "Storage Musik", bundle: "Paket Bundel" };
const HAS_VOUCHER: Record<PackageKind, boolean> = { streak: true, storage: true, bundle: false };

export const formatStorage = (mb: number) => (mb >= 1024 ? `${+(mb / 1024).toFixed(mb % 1024 ? 1 : 0)} GB` : `${mb} MB`);
const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : "-");

/** Benefit paket hanya dari data database; nilai 0 tidak ditampilkan. */
export function packageBenefits(p: PurchasePackage): string[] {
  if (p.kind === "streak") return p.days ? [`${p.days} Hari Streak`] : [];
  if (p.kind === "storage") return p.storageMb ? [`+${formatStorage(p.storageMb)} Storage`, "Aktif 30 Hari"] : [];
  const out: string[] = [];
  if (p.credits) out.push(`${p.credits} Kredit`);
  if (p.streakDays) out.push(`${p.streakDays} Hari Streak`);
  if (p.storageMb) out.push(`${formatStorage(p.storageMb)} Storage (30 hari)`);
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- respons fungsi server tidak bertipe
type Resp = any;
async function invoke(fn: string, body: Record<string, unknown>): Promise<{ data: Resp; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) {
      if (error instanceof FunctionsFetchError) return { data: null, error: "network" };
      let b: Resp = null;
      if (error instanceof FunctionsHttpError) { try { b = await error.context.clone().json(); } catch { /* abaikan */ } }
      return { data: b, error: b?.error || "server" };
    }
    if (data?.error) return { data, error: data.error };
    return { data, error: null };
  } catch { return { data: null, error: "network" }; }
}

interface Quote { price: number; discount: number; final: number; voucherDiscount: number; flashPct: number }

/**
 * Alur beli Streak / Storage / Bundel yang sama dengan Shop Kredit:
 * konfirmasi (harga dari server, voucher, sumber bayar, saldo sebelum→sesudah) → PIN → sukses (sebelum→sesudah dari server).
 */
export default function PackagePurchaseFlow({ pkg, visitorId, defaultSource, onClose, onPurchased }: {
  pkg: PurchasePackage | null; visitorId: string | null; defaultSource: PaySource;
  onClose: () => void; onPurchased?: () => void;
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteErr, setQuoteErr] = useState("");
  const [mainBal, setMainBal] = useState(0);
  const [gameBal, setGameBal] = useState(0);
  const [source, setSource] = useState<PaySource>(defaultSource);
  const [voucher, setVoucher] = useState("");
  const [voucherState, setVoucherState] = useState<{ ok: boolean; msg: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [paying, setPaying] = useState(false);
  const [flowError, setFlowError] = useState("");
  const [success, setSuccess] = useState<{ pkg: PurchasePackage; r: Resp } | null>(null);
  const busyRef = useRef(false);
  const refRef = useRef("");

  const loadQuote = async (p: PurchasePackage, code: string) => {
    if (p.kind === "bundle") { setQuote({ price: p.price, discount: 0, final: p.price, voucherDiscount: 0, flashPct: 0 }); return null; }
    const r = await invoke(FN[p.kind], { action: "quote", packageId: p.id, voucherCode: code || undefined });
    const q = p.kind === "streak" ? r.data?.quote : r.data;
    if (!q || q.error) { setQuoteErr(creditErrorMessage(q?.error || r.error)); return null; }
    if (p.kind === "streak") {
      setQuote({ price: +q.price, discount: +q.flash_discount + +q.voucher_discount, final: +q.final_price, voucherDiscount: +q.voucher_discount, flashPct: +q.flash_pct || 0 });
    } else {
      setQuote({ price: +q.price, discount: +q.discount || 0, final: +q.final_price, voucherDiscount: +q.discount || 0, flashPct: 0 });
    }
    return q;
  };

  useEffect(() => {
    if (!pkg) return;
    setQuote(null); setQuoteErr(""); setVoucher(""); setVoucherState(null); setFlowError(""); setSource(defaultSource);
    refRef.current = (crypto.randomUUID?.() || `${Date.now()}${Math.random()}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 40);
    void loadQuote(pkg, "");
    if (visitorId) {
      void Promise.all([
        supabase.from("user_balances_public" as never).select("balance").eq("visitor_id", visitorId).maybeSingle(),
        supabase.from("game_balance" as never).select("amount").eq("visitor_id", visitorId).maybeSingle(),
      ]).then(([ub, gb]) => { setMainBal(Number((ub.data as Resp)?.balance) || 0); setGameBal(Number((gb.data as Resp)?.amount) || 0); });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pkg?.kind, pkg?.id]);

  const checkVoucher = async () => {
    if (!pkg || !voucher.trim() || checking) return;
    setChecking(true);
    const q = await loadQuote(pkg, voucher.trim().toUpperCase());
    setChecking(false);
    if (!q) return;
    if (q.voucher_error) { setVoucherState({ ok: false, msg: q.voucher_error }); await loadQuote(pkg, ""); return; }
    const amt = pkg.kind === "streak" ? +q.voucher_discount : +q.discount;
    setVoucherState(amt > 0 ? { ok: true, msg: `Voucher valid • Diskon ${formatRupiah(amt)}` } : { ok: false, msg: "Voucher tidak memberi diskon untuk paket ini" });
  };

  const pay = async () => {
    if (!pkg || !visitorId || busyRef.current || pin.length !== 6) return;
    busyRef.current = true; setPaying(true); setPinError("");
    const r = await invoke(FN[pkg.kind], {
      visitorId, packageId: pkg.id, pin, paymentSource: source,
      voucherCode: voucherState?.ok ? voucher.trim().toUpperCase() : undefined,
      purchaseRef: refRef.current, requestId: refRef.current,
    });
    busyRef.current = false; setPaying(false);
    if (r.error) {
      if (r.data?.needPin) { setPin(""); setPinError(creditErrorMessage(r.error)); return; }
      setPinOpen(false); setPin(""); setFlowError(creditErrorMessage(r.error));
      return;
    }
    setPin(""); setPinOpen(false);
    setSuccess({ pkg, r: r.data });
    onClose();
    triggerGameBalanceRefresh();
    window.dispatchEvent(new CustomEvent("balance-updated"));
    if (pkg.kind === "storage" || (pkg.kind === "bundle" && pkg.storageMb)) window.dispatchEvent(new Event("music-storage-updated"));
    if (pkg.kind === "bundle" && pkg.credits) window.dispatchEvent(new CustomEvent(GAME_CREDITS_REFRESH_EVENT));
    onPurchased?.();
  };

  const plan = quote ? planPayment(quote.final, source, gameBal, mainBal) : null;
  const Icon = pkg ? ICON[pkg.kind] : Gift;

  return (
    <>
      {/* KONFIRMASI */}
      <Dialog open={!!pkg && !pinOpen} onOpenChange={o => { if (!o && !paying) onClose(); }}>
        <DialogContent className="max-w-sm w-[calc(100vw-1.5rem)] max-h-[90dvh] overflow-y-auto rounded-2xl">
          <DialogTitle className="flex items-center gap-2"><Icon className="w-5 h-5 text-primary" /> Konfirmasi Pembelian</DialogTitle>
          <DialogDescription className="sr-only">Periksa rincian sebelum membayar</DialogDescription>
          {pkg && (
            <div className="space-y-3">
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{TITLE[pkg.kind]}</p>
                <p className="text-lg font-black text-foreground">{pkg.name}</p>
                <div className="mt-1 flex flex-wrap justify-center gap-1">
                  {packageBenefits(pkg).map(b => <span key={b} className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{b}</span>)}
                </div>
              </div>

              {quoteErr ? <p role="alert" className="text-xs font-semibold text-destructive">{quoteErr}</p> : !quote || !plan ? (
                <div className="h-28 rounded-xl bg-muted animate-pulse" />
              ) : (
                <>
                  <dl className="space-y-1.5 text-sm">
                    <Row k="Harga Normal" v={formatRupiah(quote.price)} />
                    {quote.discount - quote.voucherDiscount > 0 && <Row k={`Flash Sale ${quote.flashPct}%`} v={`-${formatRupiah(quote.discount - quote.voucherDiscount)}`} good />}
                    {quote.voucherDiscount > 0 && <Row k="Voucher" v={`-${formatRupiah(quote.voucherDiscount)}`} good />}
                    <div className="border-t border-border pt-1.5"><Row k="Total Pembayaran" v={formatRupiah(quote.final)} bold /></div>
                  </dl>

                  <div className="space-y-1.5">
                    <p className="text-[11px] font-bold text-muted-foreground flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> Sumber Pembayaran</p>
                    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Sumber pembayaran">
                      {([{ id: "auto", t: "Otomatis", I: Zap }, { id: "game", t: "Saldo IN", I: Wallet }, { id: "main", t: "Saldo Utama", I: Wallet }] as const).map(o => (
                        <button key={o.id} type="button" role="radio" aria-checked={source === o.id} disabled={paying} onClick={() => setSource(o.id)}
                          className={`min-h-11 rounded-xl border-2 px-1 text-[11px] font-black transition ${source === o.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground"}`}>
                          <o.I className="mx-auto mb-0.5 h-3.5 w-3.5" />{o.t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <dl className="space-y-1 rounded-xl border border-border p-2.5 text-xs">
                    <Row k="Saldo IN" v={`${formatRupiah(gameBal)} → ${formatRupiah(gameBal - plan.fromGame)}`} />
                    <Row k="Saldo Utama" v={`${formatRupiah(mainBal)} → ${formatRupiah(mainBal - plan.fromMain)}`} />
                    {plan.fromGame > 0 && <Row k="Dipakai dari Saldo IN" v={formatRupiah(plan.fromGame)} />}
                    {plan.fromMain > 0 && <Row k="Dipakai dari Saldo Utama" v={formatRupiah(plan.fromMain)} />}
                    <p className="pt-1 text-[10px] text-muted-foreground">Perkiraan. Harga & saldo final dihitung ulang server saat bayar.</p>
                  </dl>

                  {HAS_VOUCHER[pkg.kind] && (
                    <div className="space-y-1.5">
                      <div className="flex gap-2">
                        <div className="relative min-w-0 flex-1">
                          <Tag className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                          <Input aria-label="Kode voucher" placeholder="MASUKKAN KODE" value={voucher} disabled={paying || checking}
                            onChange={e => { setVoucher(e.target.value.toUpperCase()); if (voucherState) { setVoucherState(null); void loadQuote(pkg, ""); } }}
                            className="h-10 pl-8 text-xs uppercase" />
                        </div>
                        <Button variant="outline" className="h-10 text-xs" disabled={!voucher.trim() || checking || paying} onClick={checkVoucher}>
                          {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cek"}
                        </Button>
                      </div>
                      {voucherState && (
                        <p className={`flex items-center gap-1 text-xs font-semibold ${voucherState.ok ? "text-emerald-500" : "text-destructive"}`}>
                          {voucherState.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}{voucherState.msg}
                        </p>
                      )}
                    </div>
                  )}

                  {plan.insufficient && <p role="alert" className="text-xs font-semibold text-destructive">Saldo tidak cukup untuk membeli paket ini.</p>}
                  {flowError && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{flowError}</p>}
                </>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="h-11" onClick={onClose}>Batal</Button>
                <Button className="h-11 font-bold" disabled={!quote || !plan || plan.insufficient || !!quoteErr}
                  onClick={() => { setPin(""); setPinError(""); setFlowError(""); setPinOpen(true); }}>🔐 Beli Sekarang</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PIN */}
      <Dialog open={pinOpen} onOpenChange={o => { if (!o && !paying) { setPinOpen(false); setPin(""); } }}>
        <DialogContent className="max-w-sm w-[calc(100vw-1.5rem)] rounded-2xl">
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" /> Konfirmasi Pembayaran</DialogTitle>
          <DialogDescription>Masukkan PIN 6 digit akun saldo kamu.{quote ? ` Total ${formatRupiah(quote.final)}.` : ""}</DialogDescription>
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); void pay(); }}>
            <Input type="password" inputMode="numeric" autoComplete="off" maxLength={6} autoFocus aria-label="PIN 6 digit"
              placeholder="••••••" value={pin} disabled={paying}
              onChange={e => { setPin(e.target.value.replace(/\D/g, "").slice(0, 6)); setPinError(""); }}
              className="h-12 text-center font-mono text-xl tracking-[0.6em]" />
            {pinError && <p role="alert" className="text-xs font-semibold text-destructive">❌ {pinError}</p>}
            {paying && <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Memproses pembayaran...</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="h-11" disabled={paying} onClick={() => { setPinOpen(false); setPin(""); }}>Batal</Button>
              <Button type="submit" className="h-11 font-bold" disabled={pin.length !== 6 || paying}>
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : "🔒 Bayar Sekarang"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* SUKSES */}
      <Dialog open={!!success} onOpenChange={o => { if (!o) setSuccess(null); }}>
        <DialogContent className="max-w-sm w-[calc(100vw-1.5rem)] max-h-[90dvh] overflow-y-auto rounded-2xl">
          <DialogTitle className="sr-only">Pembelian berhasil</DialogTitle>
          <DialogDescription className="sr-only">Rincian pembelian</DialogDescription>
          {success && <SuccessBody s={success} onClose={() => setSuccess(null)} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function SuccessBody({ s, onClose }: { s: { pkg: PurchasePackage; r: Resp }; onClose: () => void }) {
  const { pkg, r } = s;
  const dup = !!r.duplicate;
  const price = Number(r.price ?? pkg.price);
  const disc = Number(r.discount_amount ?? r.discount ?? 0);
  const paid = Number(r.final_price ?? price - disc);
  const pg = Number(r.paid_from_game || 0), pm = Number(r.paid_from_main || 0);
  const mainAfter = Number(r.balance_remaining ?? r.balance_after ?? 0), gameAfter = Number(r.game_balance_remaining ?? r.game_balance_after ?? 0);
  const mainBefore = Number(r.balance_before ?? mainAfter + pm), gameBefore = Number(r.game_balance_before ?? gameAfter + pg);
  const Icon = ICON[pkg.kind];

  const benefits: { big: string; small?: string }[] = [];
  const changes: { k: string; v: string }[] = [];
  if (pkg.kind === "streak") {
    benefits.push({ big: `+${r.days ?? pkg.days} Hari Streak`, small: `Berakhir ${fmtDate(r.expires_at)}` });
    changes.push({ k: "Masa aktif", v: `${r.streak_until_before ? fmtDate(r.streak_until_before) : "Tidak aktif"} → ${fmtDate(r.expires_at)}` });
  } else if (pkg.kind === "storage") {
    benefits.push({ big: `+${formatStorage(Number(r.storage_mb ?? pkg.storageMb))} Storage`, small: `Berakhir ${fmtDate(r.expires_at)}` });
    if (r.storage_before_mb != null) changes.push({ k: "Storage tambahan aktif", v: `${formatStorage(+r.storage_before_mb)} → ${formatStorage(+r.storage_after_mb)}` });
  } else {
    if (+r.credits_added > 0) { benefits.push({ big: `+${r.credits_added} Kredit` }); changes.push({ k: "Kredit", v: `${r.credits_before} → ${r.credits_after}` }); }
    if (+r.streak_days > 0) { benefits.push({ big: `+${r.streak_days} Hari Streak`, small: `Berakhir ${fmtDate(r.streak_until_after)}` }); changes.push({ k: "Streak aktif s/d", v: `${r.streak_until_before ? fmtDate(r.streak_until_before) : "Tidak aktif"} → ${fmtDate(r.streak_until_after)}` }); }
    if (+r.storage_mb > 0) { benefits.push({ big: `+${formatStorage(+r.storage_mb)} Storage`, small: `Berakhir ${fmtDate(r.storage_expires_at)}` }); changes.push({ k: "Storage tambahan aktif", v: `${formatStorage(+r.storage_before_mb)} → ${formatStorage(+r.storage_after_mb)}` }); }
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3 text-center">
      <div className="relative mx-auto h-20 w-20">
        <div className="absolute inset-0 animate-pulse rounded-full bg-emerald-500/30 blur-xl" />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}
          className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500">
          <CheckCircle2 className="h-11 w-11 text-white" />
        </motion.div>
      </div>
      <p className="text-lg font-black text-foreground">🎉 PEMBELIAN BERHASIL!</p>
      <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-muted-foreground"><Icon className="h-4 w-4" /> {pkg.name}</p>
      {dup ? (
        <p className="text-xs text-muted-foreground">Pembelian ini sudah tercatat sebelumnya — tidak ada potongan saldo kedua.</p>
      ) : (
        <>
          <div className="space-y-1">
            {benefits.map(b => (
              <div key={b.big}><p className="text-2xl font-black text-primary">{b.big}</p>{b.small && <p className="text-xs text-muted-foreground">{b.small}</p>}</div>
            ))}
          </div>
          {changes.length > 0 && (
            <dl className="space-y-1 rounded-xl border border-border p-2.5 text-left text-xs">
              {changes.map(c => <Row key={c.k} k={c.k} v={c.v} />)}
            </dl>
          )}
          <dl className="space-y-1 rounded-xl bg-muted/50 p-3 text-left text-sm">
            <Row k="Harga Normal" v={formatRupiah(price)} />
            {disc > 0 && <Row k="Diskon" v={`-${formatRupiah(disc)}`} good />}
            <Row k="Total Dibayar" v={formatRupiah(paid)} bold />
            <div className="border-t border-border pt-1" />
            <Row k="Saldo IN" v={`${formatRupiah(gameBefore)} → ${formatRupiah(gameAfter)}`} />
            <Row k="Saldo Utama" v={`${formatRupiah(mainBefore)} → ${formatRupiah(mainAfter)}`} />
            <Row k="Pembayaran" v={r.source_label || "-"} />
            {r.trx_id && <Row k="ID Transaksi" v={r.trx_id} />}
          </dl>
        </>
      )}
      <Button className="h-11 w-full font-bold" onClick={onClose}>Selesai</Button>
    </motion.div>
  );
}

function Row({ k, v, good, bold }: { k: string; v: string; good?: boolean; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className={`text-right tabular-nums ${bold ? "font-black text-foreground" : "font-semibold"} ${good ? "text-emerald-500" : "text-foreground"}`}>{v}</dd>
    </div>
  );
}
