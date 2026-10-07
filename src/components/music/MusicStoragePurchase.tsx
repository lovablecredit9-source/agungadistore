import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cloud, Crown, HardDrive, Loader2, Lock, Sparkles, Tag, CheckCircle2, ArrowLeft, Headphones, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import storageBanner from "@/assets/music-storage-banner.jpg";
import { formatRupiah, formatMb, pickBadges, type StoragePkg } from "./musicStorageLogic";

type Step = "select" | "confirm" | "pin" | "success";
type Quote = { discount: number; final_price: number; voucher_error: string | null };
type Source = "auto" | "main" | "game";

const SOURCE_LABEL: Record<Source, string> = { auto: "Otomatis (Saldo IN dulu)", main: "Saldo Utama", game: "Saldo IN" };

export function MusicStorageBanner({ onClick }: { onClick: () => void }) {
  return (
    <div className="ms-banner relative overflow-hidden rounded-2xl border border-primary/30">
      <img src={storageBanner} alt="Headphone dan cloud storage musik" width={1600} height={640} loading="lazy" className="absolute inset-0 h-full w-full object-cover object-right" />
      <div className="ms-banner-shade absolute inset-0" />
      <div className="relative z-10 flex flex-col gap-2 p-4 sm:p-6 max-w-[70%] sm:max-w-[55%]">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary/25 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-primary-foreground border border-primary/40"><Headphones className="h-3 w-3" /> Music Offline</span>
        <h3 className="ms-banner-title text-base sm:text-2xl font-black leading-tight">STORAGE MUSIK PREMIUM</h3>
        <p className="ms-banner-sub text-[11px] sm:text-sm leading-snug">Simpan lebih banyak lagu untuk pengalaman Music Offline.</p>
        <Button size="sm" onClick={onClick} className="mt-1 w-fit gap-1.5 rounded-full text-xs font-bold shadow-lg shadow-primary/40"><Cloud className="h-3.5 w-3.5" /> Tambah Storage</Button>
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  packages: StoragePkg[];
  currentMaxBytes: number;
  usedBytes: number;
  getVisitorId: () => Promise<string>;
  online: boolean;
  onPurchased: () => void;
}

export default function MusicStoragePurchase({ open, onOpenChange, packages, currentMaxBytes, usedBytes, getVisitorId, online, onPurchased }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("select");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [voucher, setVoucher] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [checking, setChecking] = useState(false);
  const [source, setSource] = useState<Source>("auto");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const requestIdRef = useRef<string | null>(null);
  const inFlight = useRef(false);

  const pkgKey = packages.map(p => `${p.id}:${p.price}:${p.storage_mb}`).join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const badges = useMemo(() => pickBadges(packages), [pkgKey]);
  const pkg = packages.find(p => p.id === selectedId) || null;
  const discount = quote && !quote.voucher_error ? quote.discount : 0;
  const finalPrice = pkg ? Math.max(0, pkg.price - discount) : 0;
  const curMb = Math.round(currentMaxBytes / 1048576);
  const usedPct = currentMaxBytes > 0 ? Math.min(100, (usedBytes / currentMaxBytes) * 100) : 0;

  useEffect(() => {
    if (!open) return;
    setStep("select"); setPin(""); setResult(null); requestIdRef.current = null;
    if (!selectedId || !packages.some(p => p.id === selectedId)) setSelectedId(badges.recommendedId || packages[0]?.id || null);
  }, [open, pkgKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setQuote(null); }, [selectedId]);

  async function applyVoucher() {
    if (!pkg || !voucher.trim()) return;
    setChecking(true);
    const { data, error } = await supabase.functions.invoke("upgrade-storage", { body: { action: "quote", packageId: pkg.id, voucherCode: voucher.trim() } });
    setChecking(false);
    if (error || data?.error) { toast({ title: "Gagal cek voucher", description: data?.error || "Coba lagi", variant: "destructive" }); return; }
    setQuote(data);
    if (data.voucher_error) toast({ title: data.voucher_error, variant: "destructive" });
    else toast({ title: `Diskon ${formatRupiah(data.discount)} diterapkan` });
  }

  function toConfirm() {
    if (!pkg) return;
    requestIdRef.current = crypto.randomUUID(); // satu referensi per konfirmasi → klik ganda tidak potong 2x
    setStep("confirm");
  }

  async function purchase() {
    if (!pkg || inFlight.current || pin.length !== 6) return;
    inFlight.current = true; setBusy(true);
    try {
      const visitorId = await getVisitorId();
      const { data, error } = await supabase.functions.invoke("upgrade-storage", {
        body: { visitorId, packageId: pkg.id, voucherCode: discount > 0 ? voucher.trim() : undefined, paymentSource: source, pin, requestId: requestIdRef.current },
      });
      let body = data;
      if (error) body = error instanceof FunctionsHttpError ? await error.context.json().catch(() => ({ error: "Terjadi kesalahan" })) : { error: "Koneksi bermasalah. Cek riwayat sebelum mencoba lagi." };
      if (body?.error) {
        if (body.needPin) setPin("");
        toast({ title: "Pembelian gagal", description: body.error, variant: "destructive" });
        return;
      }
      setResult(body); setStep("success"); setVoucher(""); setQuote(null);
      onPurchased();
    } finally { inFlight.current = false; setBusy(false); }
  }

  const close = (v: boolean) => { if (busy) return; onOpenChange(v); };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="ms-dialog max-w-md max-h-[90vh] overflow-y-auto p-0 gap-0">
        <div className="relative h-28 overflow-hidden">
          <img src={storageBanner} alt="" width={1600} height={640} className="absolute inset-0 h-full w-full object-cover object-right" />
          <div className="ms-banner-shade absolute inset-0" />
          <DialogHeader className="relative z-10 p-4 text-left">
            <DialogTitle className="ms-banner-title flex items-center gap-2 text-lg font-black"><HardDrive className="h-5 w-5" /> Storage Musik Premium</DialogTitle>
            <DialogDescription className="ms-banner-sub text-xs">Setiap paket berlaku 30 hari. Harga dihitung oleh server.</DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 p-4">
          {step === "select" && (<>
            <div className="ms-glass rounded-xl p-3 space-y-1.5">
              <div className="flex justify-between text-xs"><span className="text-muted-foreground">Kuota saat ini</span><span className="font-extrabold text-primary">{formatMb(curMb)}</span></div>
              <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="ms-progress h-full" style={{ width: `${usedPct}%` }} /></div>
              {pkg && <p className="text-[11px] text-muted-foreground">Setelah beli: <b className="text-foreground">{formatMb(curMb + pkg.storage_mb)}</b> (+{formatMb(pkg.storage_mb)})</p>}
            </div>

            {packages.length === 0 && <p className="text-center text-xs text-muted-foreground py-6">Belum ada paket storage aktif.</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {packages.map(p => {
                const sel = p.id === selectedId;
                return (
                  <button key={p.id} type="button" onClick={() => setSelectedId(p.id)} aria-pressed={sel}
                    className={`ms-pkg relative rounded-xl border-2 p-3 text-left transition-all ${sel ? "border-primary ms-pkg-active" : "border-border hover:border-primary/50"}`}>
                    {badges.recommendedId === p.id && <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-primary-foreground">Recommended</span>}
                    {badges.bestValueId === p.id && badges.bestValueId !== badges.recommendedId && <span className="absolute -top-2 right-2 rounded-full bg-accent px-2 py-0.5 text-[9px] font-bold text-accent-foreground">Best Value</span>}
                    <div className="flex items-center gap-1.5 text-xs font-bold"><Crown className="h-3.5 w-3.5 text-primary" />{p.name}</div>
                    <p className="mt-1 text-2xl font-black tracking-tight">{formatMb(p.storage_mb)}</p>
                    <p className="text-sm font-extrabold text-primary">{formatRupiah(p.price)}</p>
                    <p className="text-[10px] text-muted-foreground">30 hari • Aktif • {formatRupiah(Math.round(p.price / Math.max(1, p.storage_mb / 1024)))}/GB</p>
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <p className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"><Tag className="h-3 w-3" /> Kode Diskon (opsional)</p>
              <div className="flex gap-2">
                <Input placeholder="Masukkan kode diskon" value={voucher} onChange={e => { setVoucher(e.target.value.toUpperCase()); setQuote(null); }} className="font-mono text-xs" />
                <Button size="sm" variant="outline" onClick={applyVoucher} disabled={!voucher.trim() || !pkg || checking}>{checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pakai"}</Button>
              </div>
              {discount > 0 && <p className="text-[11px] font-bold text-primary">Diskon {formatRupiah(discount)} diterapkan</p>}
            </div>

            <Button className="w-full gap-2 font-bold" disabled={!pkg || !online} onClick={toConfirm}>
              <Sparkles className="h-4 w-4" /> {online ? `Beli Sekarang • ${formatRupiah(finalPrice)}` : "Offline"}
            </Button>
          </>)}

          {(step === "confirm" || step === "pin") && pkg && (<>
            <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground" onClick={() => !busy && setStep("select")}><ArrowLeft className="h-3 w-3" /> Ganti paket</button>
            <div className="ms-glass rounded-xl p-3 text-xs space-y-1.5">
              <p className="font-bold text-sm">Ringkasan Pembelian</p>
              <Row k="Paket" v={pkg.name} />
              <Row k="Storage" v={`+${formatMb(pkg.storage_mb)}`} />
              <Row k="Durasi" v="30 hari" />
              <Row k="Harga normal" v={formatRupiah(pkg.price)} strike={discount > 0} />
              {discount > 0 && <Row k="Diskon" v={`-${formatRupiah(discount)}`} />}
              <div className="border-t border-border pt-1.5"><Row k="Total dipotong" v={formatRupiah(finalPrice)} bold /></div>
            </div>
            <div className="space-y-1.5">
              <p className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"><Wallet className="h-3 w-3" /> Sumber Pembayaran</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(SOURCE_LABEL) as Source[]).map(s => (
                  <button key={s} type="button" onClick={() => setSource(s)} disabled={busy}
                    className={`rounded-lg border px-1.5 py-2 text-[10px] font-semibold ${source === s ? "border-primary bg-primary/10 text-primary" : "border-border"}`}>{SOURCE_LABEL[s]}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"><Lock className="h-3 w-3" /> PIN 6 digit</p>
              <Input type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} disabled={busy}
                onChange={e => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} className="text-center font-mono tracking-[0.5em]" aria-label="PIN" />
            </div>
            <Button className="w-full gap-2 font-bold" disabled={busy || pin.length !== 6 || !online} onClick={purchase}>
              {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Memproses...</> : <>Konfirmasi & Bayar {formatRupiah(finalPrice)}</>}
            </Button>
          </>)}

          {step === "success" && result && (
            <div className="ms-success text-center space-y-3 py-2">
              <div className="ms-success-icon mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/15"><CheckCircle2 className="h-9 w-9 text-primary" /></div>
              <p className="text-lg font-black">Storage berhasil ditambah!</p>
              <div className="ms-glass rounded-xl p-3 text-xs space-y-1.5 text-left">
                <Row k="ID Transaksi" v={result.trx_id || "-"} />
                <Row k="Paket" v={result.tier_name} />
                <Row k="Storage" v={`+${formatMb(result.storage_mb)}`} />
                <Row k="Dibayar" v={`${formatRupiah(result.final_price)} (${result.source_label})`} />
                <Row k="Aktif sampai" v={new Date(result.expires_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })} />
              </div>
              <Button className="w-full" onClick={() => onOpenChange(false)}>Selesai</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v, bold, strike }: { k: string; v: string; bold?: boolean; strike?: boolean }) {
  return <div className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className={`${bold ? "font-black text-primary text-sm" : "font-semibold"} ${strike ? "line-through opacity-60" : ""} text-right`}>{v}</span></div>;
}
