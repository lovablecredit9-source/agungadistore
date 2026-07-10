import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Crown, Gift, Sparkles, Check, Copy, Clock, Zap, MessageCircle } from "lucide-react";
import { useStorePremium } from "@/hooks/useStorePremium";

interface Plan {
  id: string;
  name: string;
  duration_days: number;
  price: number;
  description: string | null;
  sort_order: number;
}

interface Props {
  visitorId: string | null;
  onLoginRequired: () => void;
}

const formatPrice = (n: number) => "Rp " + n.toLocaleString("id-ID");

export default function StorePremiumTab({ visitorId, onLoginRequired }: Props) {
  const { toast } = useToast();
  const premium = useStorePremium(visitorId);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [pinDialog, setPinDialog] = useState<Plan | null>(null);
  const [pin, setPin] = useState("");
  const [voucherCode, setVoucherCode] = useState("");
  const [claimedToday, setClaimedToday] = useState<{ code: string; expires: string } | null>(null);
  const [showVoucher, setShowVoucher] = useState<{ code: string; expires: string } | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const loadHistory = async () => {
    if (!visitorId) { setHistory([]); return; }
    const { data: blh } = await supabase
      .from("balance_login_history")
      .select("user_balance_id")
      .eq("visitor_id", visitorId)
      .order("logged_in_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const ubId = blh?.user_balance_id ?? null;
    let query = supabase
      .from("store_premium_subscriptions")
      .select("id, plan_name, duration_days, price_paid, starts_at, expires_at, created_at, is_active")
      .order("created_at", { ascending: false })
      .limit(20);
    query = ubId
      ? query.or(`visitor_id.eq.${visitorId},user_balance_id.eq.${ubId}`)
      : query.eq("visitor_id", visitorId);
    const { data } = await query;
    setHistory(data ?? []);
  };
  useEffect(() => { loadHistory(); }, [visitorId, premium.isPremium, premium.expiresAt]);

  const fmtDateTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " WIB" : "-";

  const countdown = () => {
    if (!premium.expiresAt) return null;
    const diff = new Date(premium.expiresAt).getTime() - now;
    if (diff <= 0) return null;
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return { d, h, m, s };
  };

  const loadPlans = async () => {
    const { data } = await supabase.from("store_premium_plans").select("*").eq("is_active", true).order("sort_order");
    setPlans((data as Plan[]) ?? []);
  };

  const loadClaimToday = async () => {
    if (!visitorId) return;
    const today = new Date(new Date().getTime() + 7 * 60 * 60 * 1000).toISOString().split("T")[0];
    const { data } = await supabase
      .from("store_premium_voucher_claims")
      .select("voucher_code, claim_date")
      .eq("visitor_id", visitorId)
      .eq("claim_date", today)
      .maybeSingle();
    if (data?.voucher_code) {
      const { data: v } = await supabase.from("discount_vouchers").select("expires_at").eq("code", data.voucher_code).maybeSingle();
      setClaimedToday({ code: data.voucher_code, expires: v?.expires_at ?? "" });
    } else {
      setClaimedToday(null);
    }
  };

  useEffect(() => { loadPlans(); }, []);
  useEffect(() => { loadClaimToday(); }, [visitorId, premium.isPremium]);

  const handleBuy = async (plan: Plan) => {
    if (!visitorId) {
      toast({ title: "Login saldo dulu", description: "Masuk ke akun saldo sebelum membeli membership.", variant: "destructive" });
      return onLoginRequired();
    }
    setPin("");
    setVoucherCode("");
    setPinDialog(plan);
  };

  const submitPurchase = async () => {
    if (!pinDialog || !visitorId) return;
    if (pin.length !== 6) return toast({ title: "PIN harus 6 digit", variant: "destructive" });
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("purchase-store-premium", {
        body: { visitorId, planId: pinDialog.id, pin, voucherCode: voucherCode.trim() || undefined },
      });
      if (error) {
        let message = error.message ?? "Pembelian gagal diproses";
        try {
          const ctx = (error as any).context;
          const payload = ctx ? await ctx.clone().json() : null;
          message = payload?.error ?? message;
        } catch {}
        toast({ title: "Gagal", description: message, variant: "destructive" });
        return;
      }
      if ((data as any)?.error) {
        toast({ title: "Gagal", description: (data as any).error, variant: "destructive" });
        return;
      }
      const disc = (data as any).discount_applied ? ` (hemat ${formatPrice((data as any).discount_applied)})` : "";
      toast({ title: "👑 Premium Aktif!", description: `${(data as any).plan_name} sampai ${new Date((data as any).expires_at).toLocaleDateString("id-ID")}${disc}` });
      setPinDialog(null);
      premium.refresh();
    } catch (e: any) {
      toast({ title: "Gagal", description: e?.message ?? "Coba lagi", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!visitorId) return onLoginRequired();
    setClaiming(true);
    try {
      const { data, error } = await (supabase.rpc as any)("claim_daily_premium_voucher", { p_visitor_id: visitorId });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.success) {
        toast({ title: "Tidak bisa klaim", description: row?.message ?? "Coba lagi", variant: "destructive" });
        return;
      }
      setShowVoucher({ code: row.voucher_code, expires: row.expires_at });
      loadClaimToday();
    } catch (e: any) {
      toast({ title: "Gagal", description: e?.message ?? "Coba lagi", variant: "destructive" });
    } finally {
      setClaiming(false);
    }
  };

  const copy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast({ title: "✅ Tersalin!" });
  };

  return (
    <div className="space-y-3">
      {/* Header status — selalu tampil */}
      <div className={`relative rounded-2xl overflow-hidden p-[2px] shadow-lg ${premium.isPremium ? "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 shadow-amber-500/30" : "bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-600"}`}>
        <div className={`absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-[9px] font-black text-white shadow-md ${premium.isPremium ? "bg-green-500" : "bg-slate-500"}`}>
          {premium.isPremium ? "✓ AKTIF SEKARANG" : "BELUM AKTIF"}
        </div>
        <div className="rounded-[14px] bg-card/95 p-3 backdrop-blur-xl">
          <div className="flex items-center gap-2 pr-24">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ring-2 ${premium.isPremium ? "bg-amber-500/15 ring-amber-400/60" : "bg-muted ring-border"}`}>
              <Crown className={`w-6 h-6 ${premium.isPremium ? "text-amber-500 fill-amber-400 drop-shadow" : "text-muted-foreground"}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-black ${premium.isPremium ? "bg-gradient-to-r from-amber-600 to-yellow-500 bg-clip-text text-transparent" : ""}`}>
                {premium.isPremium ? "Membership Premium 👑" : "Membership Premium"}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">
                {premium.isPremium ? `${premium.planName} · sisa ${premium.daysLeft} hari` : "Belum berlangganan — pilih paket di bawah"}
              </p>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 text-[9px]">
            <div className="flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/30 px-1.5 py-1"><Gift className="w-2.5 h-2.5 text-amber-500" /><span className="font-bold">Voucher Rp 2k/hari</span></div>
            <div className="flex items-center gap-1 rounded-lg bg-purple-500/10 border border-purple-500/30 px-1.5 py-1"><MessageCircle className="w-2.5 h-2.5 text-purple-500" /><span className="font-bold">Chat Prioritas</span></div>
            <div className="flex items-center gap-1 rounded-lg bg-pink-500/10 border border-pink-500/30 px-1.5 py-1"><Sparkles className="w-2.5 h-2.5 text-pink-500" /><span className="font-bold">Tampilan Premium</span></div>
            <div className="flex items-center gap-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-1"><Crown className="w-2.5 h-2.5 text-cyan-500" /><span className="font-bold">Badge 👑</span></div>
          </div>
        </div>
      </div>

      {/* Klaim harian — selalu tampil, disabled bila belum aktif */}
      <div className={`rounded-2xl border-2 border-dashed p-3 shadow-lg ${premium.isPremium ? "border-amber-500/50 bg-gradient-to-br from-amber-500/15 via-yellow-500/15 to-orange-500/15 shadow-amber-500/10" : "border-border bg-muted/30 shadow-none"}`}>
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <Gift className={`w-4 h-4 ${premium.isPremium ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`} />
            <p className={`text-xs font-black ${premium.isPremium ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>Voucher Harian Rp 2.000</p>
          </div>
          <span className={`rounded-full px-2 py-0.5 text-[8px] font-black text-white ${premium.isPremium ? "bg-green-500" : "bg-slate-500"}`}>
            {premium.isPremium ? "AKTIF" : "TERKUNCI"}
          </span>
        </div>
        {!premium.isPremium ? (
          <Button disabled size="lg" className="w-full h-14 bg-muted text-muted-foreground font-black text-sm cursor-not-allowed">
            <Crown className="w-5 h-5 mr-2" />
            Aktifkan Membership untuk Klaim
          </Button>
        ) : claimedToday ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/30 px-2 py-1.5">
              <Check className="w-3.5 h-3.5 text-green-600" />
              <span className="text-[10px] font-bold text-green-700 dark:text-green-400 flex-1">Sudah diklaim hari ini</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-card border px-2 py-1.5">
              <code className="text-[11px] font-mono font-black flex-1 truncate">{claimedToday.code}</code>
              <Button size="sm" variant="outline" className="h-6 px-2" onClick={() => copy(claimedToday.code)}><Copy className="w-3 h-3" /></Button>
            </div>
            <p className="text-[9px] text-muted-foreground flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> Besok kamu bisa klaim lagi</p>
          </div>
        ) : (
          <Button onClick={handleClaim} disabled={claiming} size="lg" className="w-full h-14 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 text-white font-black text-sm shadow-lg shadow-amber-500/40 ring-2 ring-amber-300 animate-pulse hover:animate-none">
            <Gift className="w-5 h-5 mr-2" />
            {claiming ? "Mengklaim..." : "KLAIM VOUCHER Rp 2.000"}
          </Button>
        )}
      </div>

      {/* Daftar paket */}
      <div className="space-y-2">
        <p className="text-[11px] font-black text-muted-foreground uppercase tracking-wide px-1">{premium.isPremium ? "Perpanjang Membership" : "Pilih Paket"}</p>
        {plans.map((p, idx) => {
          const perDay = Math.round(p.price / p.duration_days);
          const isHot = idx === 1;
          const isBest = idx === 2;
          return (
            <div key={p.id} className={`relative rounded-2xl p-[2px] ${isBest ? "bg-gradient-to-r from-amber-400 via-pink-500 to-purple-500" : isHot ? "bg-gradient-to-r from-orange-400 to-red-500" : "bg-gradient-to-r from-slate-300 to-slate-400 dark:from-slate-700 dark:to-slate-600"}`}>
              <div className="rounded-[14px] bg-card p-3">
                {(isHot || isBest) && (
                  <span className={`absolute -top-2 left-3 px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${isBest ? "bg-amber-500 text-white" : "bg-red-500 text-white"} shadow-md`}>
                    {isBest ? "✨ Terhemat" : "🔥 Populer"}
                  </span>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black flex items-center gap-1"><Crown className="w-3.5 h-3.5 text-amber-500" />{p.name}</p>
                    {p.description && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>}
                    <p className="text-[9px] text-muted-foreground mt-1">≈ {formatPrice(perDay)}/hari</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-black bg-gradient-to-r from-amber-500 to-pink-500 bg-clip-text text-transparent">{formatPrice(p.price)}</p>
                    <Button size="sm" onClick={() => handleBuy(p)} className="mt-1 h-7 text-[10px] bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-black">
                      <Zap className="w-3 h-3 mr-1" /> Beli
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {plans.length === 0 && <p className="text-center text-[11px] text-muted-foreground py-4">Belum ada paket tersedia</p>}
      </div>

      {/* PIN dialog dibuat sebagai overlay sendiri agar input tidak bentrok dengan modal toko parent */}
      {pinDialog && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onMouseDown={() => !loading && setPinDialog(null)}>
          <form
            className="w-full max-w-sm rounded-2xl border bg-card p-4 shadow-2xl space-y-3"
            onMouseDown={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); submitPurchase(); }}
          >
            <div className="space-y-1">
              <h3 className="flex items-center gap-2 text-base font-black"><Crown className="w-5 h-5 text-amber-500" /> Konfirmasi Pembelian</h3>
              <p className="text-xs text-muted-foreground">
                Bayar <b>{formatPrice(pinDialog.price)}</b> dari saldo untuk <b>{pinDialog.name}</b>.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Kode Voucher Membership (opsional)</Label>
              <Input value={voucherCode} onChange={(e) => setVoucherCode(e.target.value.toUpperCase())} placeholder="MEMBER-XXXXXX" className="text-center font-mono font-bold tracking-wider" />
              <Label className="text-xs">Masukkan PIN 6 digit</Label>
              <Input type="password" inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••••" className="text-center tracking-[0.5em] text-lg font-black" />
              <Button type="submit" disabled={loading || pin.length !== 6} className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-black">
                {loading ? "Memproses..." : "Bayar Sekarang"}
              </Button>
              <Button type="button" variant="outline" disabled={loading} onClick={() => setPinDialog(null)} className="w-full font-bold">
                Batal
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Voucher klaim popup */}
      {showVoucher && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onMouseDown={() => setShowVoucher(null)}>
          <div className="w-full max-w-sm rounded-2xl border bg-card p-4 shadow-2xl space-y-3" onMouseDown={(e) => e.stopPropagation()}>
            <div className="space-y-1">
              <h3 className="flex items-center gap-2 text-base font-black text-amber-600"><Gift className="w-5 h-5" /> Voucher Berhasil Diklaim!</h3>
              <p className="text-xs text-muted-foreground">Voucher diskon Rp 2.000 berlaku 24 jam. Pakai saat checkout produk.</p>
            </div>
          {showVoucher && (
            <div className="space-y-2">
              <div className="rounded-xl bg-gradient-to-br from-amber-100 to-yellow-100 dark:from-amber-950/30 dark:to-yellow-950/30 border-2 border-dashed border-amber-500 p-3 text-center">
                <p className="text-[9px] uppercase font-bold text-amber-700 dark:text-amber-400">Kode Voucher</p>
                <p className="text-base font-mono font-black mt-1">{showVoucher.code}</p>
              </div>
              <Button onClick={() => copy(showVoucher.code)} className="w-full"><Copy className="w-3.5 h-3.5 mr-1.5" /> Salin Kode</Button>
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
