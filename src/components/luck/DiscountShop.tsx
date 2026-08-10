import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Ticket, Gem, Wallet, Clock, ShieldCheck, Percent } from "lucide-react";

interface Props {
  visitorId: string;
  onUpdate?: () => void;
}

function fmtRp(n: number) {
  return "Rp " + Number(n || 0).toLocaleString("id-ID");
}

function countdown(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "berakhir";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}j ${m}m` : `${m}m`;
}

export default function DiscountShop({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [confirmBuy, setConfirm] = useState<{ pkg: any; payWith: "gem" | "balance" } | null>(null);
  const [voucherCode, setVoucherCode] = useState("");
  const [tick, setTick] = useState(0);


  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 30000);
    return () => clearInterval(t);
  }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await supabase.functions.invoke("luck-royale-nyawa", {
        body: { action: "discount_list", visitorId },
      });
      setData(res || null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (visitorId) load(); }, [visitorId]);

  async function buy(pkg: any, payWith: "gem" | "balance", pinValue?: string) {
    setBusy(pkg.id + payWith);
    try {
      const { data: res } = await supabase.functions.invoke("luck-royale-nyawa", {
        body: { action: "discount_buy", visitorId, packageId: pkg.id, payWith, pin: pinValue },
      });
      if (res?.needPin) {
        setPinFor(pkg.id);
        if (pinValue) toast({ title: "PIN salah", description: res.error, variant: "destructive" });
        return;
      }
      if (res?.error) {
        toast({ title: "Gagal", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "🎟️ Voucher aktif!", description: res?.message || "Diskon berhasil dibeli" });
      setPinFor(null);
      setPin("");
      await load();
      onUpdate?.();
    } finally {
      setBusy(null);
    }
  }

  // Kalau sudah ada voucher aktif, wajib konfirmasi karena voucher lama akan diganti
  function requestBuy(pkg: any, payWith: "gem" | "balance") {
    const act = data?.activeDiscount;
    if (act) {
      setConfirm({ pkg, payWith });
      return;
    }
    if (payWith === "balance") setPinFor(pkg.id);
    else buy(pkg, "gem");
  }

  async function activateVoucher(code: string) {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setBusy(`activate-${clean}`);
    try {
      const { data: res } = await supabase.functions.invoke("luck-royale-nyawa", {
        body: { action: "activate_lucky_voucher", visitorId, voucherCode: clean },
      });
      if (res?.error) {
        toast({ title: "Gagal mengaktifkan", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Voucher aktif!", description: `Diskon ${res?.pct}% berlaku ${res?.hours} jam.` });
      setVoucherCode("");
      await load();
      onUpdate?.();
    } finally {
      setBusy(null);
    }
  }


  if (loading) {
    return (
      <div className="rounded-xl border border-orange-500/30 bg-black/40 p-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-amber-300" />
      </div>
    );
  }
  if (!data) return null;

  const active = data.activeDiscount;

  return (
    <div className="space-y-3">
      {/* Header status */}
      <div className="rounded-xl border-2 border-amber-400/40 bg-gradient-to-br from-amber-500/15 via-orange-600/10 to-rose-600/15 p-3 shadow-[0_0_24px_rgba(251,146,60,0.2)]">
        <div className="flex items-center gap-2 mb-2">
          <Percent className="h-4 w-4 text-amber-300" />
          <span className="text-[11px] font-black tracking-widest text-amber-100">VOUCHER DISKON LUCKY ROYALE</span>
        </div>
        {active ? (
          <motion.div
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="rounded-lg bg-emerald-500/20 border border-emerald-400/50 p-2.5"
          >
            <div className="text-[13px] font-black text-emerald-200">
              Aktif: Diskon {active.discount_percent}% · sisa {countdown(active.expires_at)}
            </div>
            <div className="text-[10px] text-emerald-100/80">Berlaku untuk semua pembelian Lucky Royale.</div>
          </motion.div>
        ) : (
          <div className="rounded-lg bg-black/40 border border-white/10 p-2.5 text-[11px] text-muted-foreground">
            Belum ada voucher diskon aktif. Beli paket di bawah untuk potongan harga semua pembelian Lucky Royale.
          </div>
        )}
        <div className="flex gap-2 mt-2">
          <Badge className="bg-cyan-500/20 border-cyan-400/50 text-cyan-100 text-[10px] gap-1">
            <Gem className="h-3 w-3" /> {Number(data.gems || 0).toLocaleString("id-ID")}
          </Badge>
          <Badge className="bg-emerald-500/20 border-emerald-400/50 text-emerald-100 text-[10px] gap-1">
            <Wallet className="h-3 w-3" /> {fmtRp(data.balance)}
          </Badge>
        </div>
      </div>

      {/* Paket */}
      <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-3">
        <div className="mb-2 text-[11px] font-black text-cyan-100">AKTIFKAN KODE VOUCHER</div>
        <div className="flex gap-2">
          <Input value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} placeholder="LR-XXXXXXXXXXXX" className="h-9 font-mono text-xs" />
          <Button size="sm" className="h-9" disabled={!voucherCode.trim() || busy?.startsWith("activate-")} onClick={() => activateVoucher(voucherCode)}>
            {busy?.startsWith("activate-") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Aktifkan"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(data.packages || []).map((pkg: any) => (
          <div
            key={pkg.id}
            className="rounded-xl border-2 border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-600/10 to-purple-800/20 p-3"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[15px] font-black text-amber-200">{pkg.discount_percent}% OFF</div>
              <Badge className="bg-black/50 border-white/20 text-white text-[9px] gap-1">
                <Clock className="h-3 w-3" /> {pkg.duration_hours} jam
              </Badge>
            </div>
            <div className="text-[11px] text-muted-foreground mb-2">{pkg.name}</div>
            <div className="grid grid-cols-2 gap-1.5">
              <Button
                size="sm"
                disabled={busy === pkg.id + "gem"}
                onClick={() => requestBuy(pkg, "gem")}
                className="h-8 text-[10px] font-black bg-gradient-to-r from-cyan-500 to-blue-600"
              >
                {busy === pkg.id + "gem" ? <Loader2 className="h-3 w-3 animate-spin" /> : <>💎 {Number(pkg.price_gems).toLocaleString("id-ID")}</>}
              </Button>
              <Button
                size="sm"
                disabled={busy === pkg.id + "balance"}
                onClick={() => (pinFor === pkg.id ? undefined : requestBuy(pkg, "balance"))}

                className="h-8 text-[10px] font-black bg-gradient-to-r from-emerald-500 to-teal-600"
              >
                {busy === pkg.id + "balance" ? <Loader2 className="h-3 w-3 animate-spin" /> : fmtRp(pkg.price_balance)}
              </Button>
            </div>
            {pinFor === pkg.id && (
              <div className="mt-2 rounded-lg border border-emerald-400/40 bg-black/50 p-2 space-y-1.5">
                <div className="flex items-center gap-1 text-[10px] text-emerald-200 font-bold">
                  <ShieldCheck className="h-3 w-3" /> Masukkan PIN 6 digit
                </div>
                <Input
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  placeholder="••••••"
                  className="h-8 text-center tracking-[0.4em] text-sm"
                />
                <div className="grid grid-cols-2 gap-1.5">
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => { setPinFor(null); setPin(""); }}>
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    className="h-7 text-[10px] font-black bg-emerald-600"
                    disabled={pin.length !== 6 || busy === pkg.id + "balance"}
                    onClick={() => buy(pkg, "balance", pin)}
                  >
                    Bayar
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Riwayat voucher aktif */}
      {(data.vouchers || []).length > 0 && (
        <div className="rounded-xl border border-white/10 bg-black/40 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Ticket className="h-3.5 w-3.5 text-amber-300" />
            <span className="text-[10px] font-black tracking-widest text-amber-100">VOUCHER SAYA</span>
          </div>
          <div className="space-y-1.5">
            {data.vouchers.map((v: any) => (
              <div key={v.id} className="flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-foreground">{v.discount_percent}% · {v.name}</div>
                  <div className="font-mono text-[9px] text-cyan-200">{v.code}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[9px]" onClick={() => navigator.clipboard.writeText(v.code)}>Salin</Button>
                  {!v.active_expires_at && <Button size="sm" className="h-7 px-2 text-[9px]" onClick={() => activateVoucher(v.code)}>Aktifkan</Button>}
                  {v.active_expires_at && <span className="text-[10px] text-muted-foreground tabular-nums">{countdown(v.active_expires_at)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Konfirmasi ganti voucher aktif */}
      {confirmBuy && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/80 p-4" onClick={() => setConfirm(null)}>
          <div className="w-full max-w-xs rounded-2xl border border-amber-400/40 bg-[#0b0616] p-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-[13px] font-black text-amber-200 mb-1">Ganti voucher aktif?</div>
            <p className="text-[11px] text-white/70 leading-snug mb-3">
              Kamu masih punya voucher <b>{active?.discount_percent}%</b> (sisa {active ? countdown(active.expires_at) : "-"}).
              Membeli voucher baru akan <b>menghapus & menggantikan</b> voucher lamamu. Yakin lanjut?
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="h-9 text-[11px]" onClick={() => setConfirm(null)}>Batal</Button>
              <Button
                size="sm"
                className="h-9 text-[11px] font-black bg-gradient-to-r from-amber-500 to-rose-600"
                onClick={() => {
                  const c = confirmBuy;
                  setConfirm(null);
                  if (!c) return;
                  if (c.payWith === "balance") setPinFor(c.pkg.id);
                  else buy(c.pkg, "gem");
                }}
              >
                Ya, ganti
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
}
