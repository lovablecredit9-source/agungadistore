import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getVisitorId } from "@/lib/visitor-id";
import { Loader2, Gem, RefreshCw, Sparkles, Gift, Lock, Tag, ShoppingBag, Info, Copy, PiggyBank, History, Crown, Ticket, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SideItem {
  id: string; label: string; emoji: string; type: string; value: number; gem: number; finalGem: number; days?: number;
}
interface ClaimEntry {
  id: string; label: string; emoji: string; gem: number; saved: number; discount: number; code: string | null; days: number | null; duration?: string | null; at: string;
}
interface SpinData {
  currentDiscount: number;
  spinsUsed: number;
  wonDiscounts: number[];
  allDiscounts: number[];
  remainingDiscounts: number[];
  purchasedItems: string[];
  currentBuys: number;
  perDiscountMax: number;
  totalBought: number;
  totalSaved: number;
  claims: ClaimEntry[];
  gems: number;
  refreshCost: number;
  spinCost: number;
  nextSpinCost: number;
  spinCosts: number[];
  luckyBaseGem: number;
  items: SideItem[];
  segments: number[];
  wonDiscount?: number;
}

const SEGMENT_COLORS = ["#06b6d4", "#10b981", "#84cc16", "#f59e0b", "#f97316", "#ef4444", "#ec4899", "#a855f7", "#fbbf24"];

export default function DiscountWheelTab() {
  const { toast } = useToast();
  const visitorId = getVisitorId();
  const [data, setData] = useState<SpinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const copyCode = (code: string) => {
    navigator.clipboard?.writeText(code);
    toast({ title: "📋 Kode disalin", description: code });
  };

  const call = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    const { data: res, error } = await supabase.functions.invoke("discount-spin", {
      body: { visitorId, action, ...extra },
    });
    if (error) throw new Error(error.message);
    if (res?.error) throw new Error(res.error);
    return res as SpinData;
  }, [visitorId]);

  const load = useCallback(async () => {
    try {
      const res = await call("state");
      setData(res);
    } catch (e) {
      toast({ title: "Gagal memuat", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [call, toast]);

  useEffect(() => { load(); }, [load]);

  const segments = data?.segments || [10, 20, 30, 40, 50, 60, 70, 80, 90];
  const segCount = segments.length;
  const segAngle = 360 / segCount;

  const allWon = (data?.remainingDiscounts?.length ?? 1) === 0;
  const enoughGems = (data?.gems ?? 0) >= (data?.nextSpinCost ?? 100);
  const canSpin = !allWon && enoughGems;
  const buyMaxed = (data?.currentBuys ?? 0) >= (data?.perDiscountMax ?? 10);

  async function handleSpin() {
    if (!data || spinning) return;
    if (allWon) {
      toast({ title: "Semua diskon habis", description: "Kamu sudah dapat semua diskon hari ini. Kembali besok!", variant: "destructive" });
      return;
    }
    if (!enoughGems) {
      toast({ title: "Gem kurang", description: `Butuh ${data.nextSpinCost} gem untuk spin ini.`, variant: "destructive" });
      return;
    }
    setSpinning(true);
    try {
      const res = await call("spin");
      const won = res.wonDiscount ?? res.currentDiscount;
      const idx = Math.max(0, segments.indexOf(won));
      const target = 360 * 6 + (360 - idx * segAngle - segAngle / 2);
      setRotation((prev) => prev - (prev % 360) + target);
      setTimeout(() => {
        setData(res);
        setSpinning(false);
        toast({ title: `🎉 Diskon ${won}%!`, description: "Hadiah samping muncul dengan harga diskon. Beli sampai 10 hadiah!" });
      }, 3600);
    } catch (e) {
      setSpinning(false);
      toast({ title: "Gagal spin", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  }

  async function handleRefresh() {
    if (!data || refreshing) return;
    setRefreshing(true);
    try {
      const res = await call("refresh");
      setData(res);
      toast({ title: "🔄 Hadiah diperbarui", description: `-${data.refreshCost} gem` });
    } catch (e) {
      toast({ title: "Gagal refresh", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  }

  async function handleBuy(item: SideItem) {
    if (busyItem) return;
    setBusyItem(item.id);
    try {
      const res = await call("buy", { itemId: item.id }) as SpinData & { bought?: { code?: string | null } };
      setData(res);
      const code = res.bought?.code;
      toast({
        title: "✅ Pembelian berhasil",
        description: code
          ? `${item.label}. Kode voucher: ${code} (lihat tombol info untuk riwayat).`
          : `${item.label} (${item.finalGem} gem).`,
      });
    } catch (e) {
      toast({ title: "Gagal beli", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setBusyItem(null);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  }

  const hasDiscount = (data?.currentDiscount || 0) > 0;

  return (
    <div className="space-y-4 animate-fade-in pb-8">
      {/* HERO */}
      <div className="relative rounded-3xl overflow-hidden p-[2px] bg-gradient-to-br from-fuchsia-500 via-purple-500 to-cyan-400 shadow-[0_10px_40px_-12px_rgba(168,85,247,0.6)]">
        <div className="relative rounded-3xl bg-gradient-to-br from-background via-background to-background/90 p-5 overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-20">
            {["🎡", "💎", "🎁", "✨", "🏷️", "🔥"].map((e, i) => (
              <span key={i} className="absolute text-3xl" style={{ left: `${(i * 17) % 90}%`, top: `${(i * 29) % 70}%` }}>{e}</span>
            ))}
          </div>
          <div className="relative flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-cyan-400 flex items-center justify-center shadow-lg">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-black bg-gradient-to-r from-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">Roda Diskon</h1>
              <p className="text-[11px] text-muted-foreground font-medium">Diskon 10%–90% • Tiap diskon sekali sehari • Reset 00:00 WIB</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setInfoOpen(true)}
                aria-label="Info hadiah"
                className="w-9 h-9 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 flex items-center justify-center text-fuchsia-300 active:scale-95 transition"
              >
                <Info className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-400/30">
                <Gem className="w-4 h-4 text-cyan-300" />
                <span className="text-sm font-black text-cyan-200">{data?.gems ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* STATS BAR */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-2xl p-2.5 bg-emerald-500/10 border border-emerald-400/30 text-center">
          <PiggyBank className="w-4 h-4 mx-auto text-emerald-300 mb-0.5" />
          <div className="text-sm font-black text-emerald-200 flex items-center justify-center gap-0.5">{data?.totalSaved ?? 0}<Gem className="w-3 h-3" /></div>
          <div className="text-[9px] text-muted-foreground font-medium">Hemat</div>
        </div>
        <div className="rounded-2xl p-2.5 bg-fuchsia-500/10 border border-fuchsia-400/30 text-center">
          <Tag className="w-4 h-4 mx-auto text-fuchsia-300 mb-0.5" />
          <div className="text-sm font-black text-fuchsia-200">{data?.wonDiscounts?.length ?? 0}/{data?.allDiscounts?.length ?? 9}</div>
          <div className="text-[9px] text-muted-foreground font-medium">Diskon didapat</div>
        </div>
        <div className="rounded-2xl p-2.5 bg-cyan-500/10 border border-cyan-400/30 text-center">
          <ShoppingBag className="w-4 h-4 mx-auto text-cyan-300 mb-0.5" />
          <div className="text-sm font-black text-cyan-200">{data?.totalBought ?? 0}</div>
          <div className="text-[9px] text-muted-foreground font-medium">Hadiah dibeli</div>
        </div>
      </div>

      <div className="relative rounded-3xl p-5 bg-gradient-to-br from-purple-950/40 to-background border border-purple-500/20 flex flex-col items-center">
        <div className="relative w-64 h-64">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-yellow-400 z-20 drop-shadow-lg" />
          <motion.div
            animate={{ rotate: rotation }}
            transition={{ duration: 3.5, ease: [0.17, 0.67, 0.23, 0.99] }}
            className="absolute inset-0 rounded-full border-[6px] border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.5)]"
            style={{
              background: `conic-gradient(${segments.map((_, i) => `${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} ${i * segAngle}deg ${(i + 1) * segAngle}deg`).join(", ")})`,
            }}
          >
            {segments.map((s, i) => (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 origin-left text-white font-black text-xs drop-shadow"
                style={{ transform: `rotate(${i * segAngle + segAngle / 2}deg) translateX(64px)` }}
              >
                {s}%
              </div>
            ))}
          </motion.div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-background border-4 border-yellow-400 flex items-center justify-center">
              <Gift className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
        </div>

        {hasDiscount && (
          <div className="mt-4 px-4 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-400/40 flex items-center gap-2">
            <Tag className="w-4 h-4 text-emerald-300" />
            <span className="text-sm font-black text-emerald-200">Diskon aktif: {data?.currentDiscount}%</span>
          </div>
        )}

        <Button
          onClick={handleSpin}
          disabled={spinning || !canSpin}
          className="mt-4 w-full max-w-xs h-12 text-base font-black bg-gradient-to-r from-fuchsia-500 to-cyan-400 text-white"
        >
          {spinning ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Memutar...</>
            : allWon ? "✅ Semua diskon didapat"
            : <>🎡 SPIN ({data?.nextSpinCost}<Gem className="w-4 h-4 mx-1" />)</>}
        </Button>
        {!allWon && (
          <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Spin {(data?.spinsUsed ?? 0) + 1}: {data?.nextSpinCost} gem • makin sering makin mahal
          </p>
        )}
        {allWon && (
          <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1"><Lock className="w-3 h-3" /> Diskon di-reset otomatis tiap 00:00 WIB.</p>
        )}
      </div>

      {/* SIDE PRIZES */}
      {hasDiscount && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black flex items-center gap-1.5"><ShoppingBag className="w-4 h-4 text-fuchsia-400" /> Hadiah Diskon {data?.currentDiscount}% <span className="text-[10px] text-muted-foreground">({data?.currentBuys ?? 0}/{data?.perDiscountMax ?? 10})</span></h2>
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing || buyMaxed} className="h-8 text-xs">
              {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RefreshCw className="w-3 h-3 mr-1" />Refresh {data?.refreshCost}<Gem className="w-3 h-3 ml-0.5" /></>}
            </Button>
          </div>
          {buyMaxed ? (
            <p className="text-center text-xs text-muted-foreground py-6">Diskon {data?.currentDiscount}% sudah maksimal {data?.perDiscountMax} pembelian 🎉 Spin lagi untuk diskon lain!</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {data?.items.map((item) => {
                const off = item.finalGem < item.gem;
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative rounded-2xl p-3 bg-gradient-to-br from-card to-card/60 border border-border/60 overflow-hidden"
                  >
                    {off && (
                      <span className="absolute top-1.5 right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-500 text-white">-{data?.currentDiscount}%</span>
                    )}
                    <div className="text-3xl mb-1">{item.emoji}</div>
                    <div className="text-xs font-bold leading-tight mb-1.5 min-h-[2rem]">{item.label}</div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-sm font-black text-cyan-300 flex items-center gap-0.5">{item.finalGem}<Gem className="w-3 h-3" /></span>
                      {off && <span className="text-[10px] text-muted-foreground line-through">{item.gem}</span>}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleBuy(item)}
                      disabled={busyItem === item.id || (data?.gems ?? 0) < item.finalGem}
                      className="w-full h-8 text-xs font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 text-white"
                    >
                      {busyItem === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Beli"}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          )}
          {!buyMaxed && data?.items.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">Semua item sudah dibeli! Refresh atau spin lagi untuk hadiah baru.</p>
          )}
        </div>
      )}

      {!hasDiscount && (
        <p className="text-center text-sm text-muted-foreground py-4">Putar roda untuk membuka hadiah diskon spesial! 🎁</p>
      )}

      {/* INFO DIALOG */}
      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Info className="w-5 h-5 text-fuchsia-400" /> Info Roda Diskon
            </DialogTitle>
          </DialogHeader>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 mb-1">
            <div className="rounded-xl p-2 bg-emerald-500/10 border border-emerald-400/30 text-center">
              <div className="text-sm font-black text-emerald-200 flex items-center justify-center gap-0.5">{data?.totalSaved ?? 0}<Gem className="w-3 h-3" /></div>
              <div className="text-[9px] text-muted-foreground">Total Hemat</div>
            </div>
            <div className="rounded-xl p-2 bg-fuchsia-500/10 border border-fuchsia-400/30 text-center">
              <div className="text-sm font-black text-fuchsia-200">{data?.spinsUsed ?? 0}</div>
              <div className="text-[9px] text-muted-foreground">Total Spin</div>
            </div>
            <div className="rounded-xl p-2 bg-cyan-500/10 border border-cyan-400/30 text-center">
              <div className="text-sm font-black text-cyan-200">{data?.totalBought ?? 0}</div>
              <div className="text-[9px] text-muted-foreground">Hadiah</div>
            </div>
          </div>

          {/* Cara kerja */}
          <div className="rounded-xl p-3 bg-muted/40 border border-border/50 text-[11px] leading-relaxed text-muted-foreground space-y-1">
            <p className="font-black text-foreground flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-fuchsia-400" /> Cara Kerja</p>
            <p>• Tiap spin memberi <b>1 diskon acak</b> (10%–90%). Persen besar makin langka.</p>
            <p>• Tiap diskon cuma bisa didapat <b>1× per hari</b>. Yang sudah didapat tidak muncul lagi sampai reset.</p>
            <p>• Tiap diskon bisa dipakai beli <b>maksimal {data?.perDiscountMax ?? 10} hadiah</b>, lalu spin lagi untuk diskon lain.</p>
            <p>• Hadiah tampil max 10, bisa di-refresh ({data?.refreshCost} gem).</p>
            <p>• Reset otomatis tiap 00:00 WIB.</p>
          </div>

          {/* Biaya spin bertingkat */}
          <div className="rounded-xl p-3 bg-fuchsia-500/5 border border-fuchsia-400/30 text-[11px] leading-relaxed text-muted-foreground space-y-1">
            <p className="font-black text-foreground flex items-center gap-1"><Gem className="w-3.5 h-3.5 text-fuchsia-400" /> Biaya Spin Bertingkat</p>
            <div className="flex flex-wrap gap-1.5">
              {(data?.spinCosts ?? [100, 200, 500, 1000, 2000]).map((c, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-fuchsia-500/10 border border-fuchsia-400/30 text-foreground font-bold">
                  Spin {i + 1}{i === (data?.spinCosts?.length ?? 5) - 1 ? "+" : ""}: {c} 💎
                </span>
              ))}
            </div>
          </div>

          {/* Daftar semua diskon */}
          <div className="rounded-xl p-3 bg-emerald-500/5 border border-emerald-400/30 text-[11px] leading-relaxed space-y-1.5">
            <p className="font-black text-foreground flex items-center gap-1"><Tag className="w-3.5 h-3.5 text-emerald-400" /> Daftar Diskon Hari Ini</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(data?.allDiscounts ?? [10, 20, 30, 40, 50, 60, 70, 80, 90]).map((d) => {
                const won = data?.wonDiscounts?.includes(d);
                return (
                  <div key={d} className={`rounded-lg px-2 py-1.5 text-center border ${won ? "bg-emerald-500/15 border-emerald-400/40" : "bg-card border-border/60"}`}>
                    <div className="text-sm font-black text-foreground flex items-center justify-center gap-0.5">
                      {won && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}{d}%
                    </div>
                    <div className="text-[8px] text-muted-foreground">{won ? "didapat" : "tersedia"}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cara pakai voucher */}
          <div className="rounded-xl p-3 bg-yellow-500/5 border border-yellow-400/30 text-[11px] leading-relaxed text-muted-foreground space-y-1">
            <p className="font-black text-foreground flex items-center gap-1"><Ticket className="w-3.5 h-3.5 text-yellow-400" /> Cara Pakai / Redeem Voucher</p>
            <p>• Tiap voucher punya <b>kode unik</b> (lihat Riwayat Klaim, tekan ikon salin 📋).</p>
            <p>• <b>Voucher Lucky Royale</b>: buka <b>Lucky Royale</b> → tempel kode di kolom voucher sebelum bayar gem. Diskon -50%/-70%/-80%/-90% dari {(data?.luckyBaseGem ?? 10000).toLocaleString("id-ID")} gem per spin.</p>
            <p>• <b>Voucher Membership</b>: buka tab <b>Premium / Membership</b> toko → saat pilih paket, tempel kode untuk potongan Rp 5rb–15rb.</p>
            <p>• Voucher <b>sekali pakai</b> & hangus bila masa aktif habis.</p>
          </div>

          {/* Daftar hadiah voucher */}
          <div className="space-y-1.5">
            <p className="text-xs font-black flex items-center gap-1"><Ticket className="w-3.5 h-3.5 text-yellow-400" /> Voucher Spesial</p>
            <div className="rounded-lg p-2 bg-yellow-500/10 border border-yellow-400/30 text-[11px] flex items-center gap-2">
              <span className="text-lg">🎰</span>
              <span className="text-foreground">Voucher Lucky Royale <b>-50%/-70%/-80%/-90%</b> harga spin (aktif 2 jam – 1 hari)</span>
            </div>
            <div className="rounded-lg p-2 bg-amber-500/10 border border-amber-400/30 text-[11px] flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-300" />
              <span className="text-foreground">Voucher Membership potongan <b>Rp 5rb–15rb</b> (aktif 7 hari)</span>
            </div>
          </div>

          {/* Riwayat klaim */}
          <div className="space-y-1.5">
            <p className="text-xs font-black flex items-center gap-1"><History className="w-3.5 h-3.5 text-cyan-400" /> Riwayat Klaim Hari Ini</p>
            {(!data?.claims || data.claims.length === 0) ? (
              <p className="text-[11px] text-muted-foreground italic py-2 text-center">Belum ada klaim hari ini.</p>
            ) : (
              <div className="space-y-1.5">
                {data.claims.slice().reverse().map((c, i) => (
                  <div key={i} className="rounded-lg p-2 bg-card border border-border/60 flex items-center gap-2">
                    <span className="text-lg">{c.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold leading-tight truncate">{c.label}</div>
                      <div className="text-[9px] text-muted-foreground">-{c.discount}% • {c.gem} gem • hemat {c.saved}{c.duration ? ` • aktif ${c.duration}` : ""}</div>
                      {c.code && (
                        <div className="mt-0.5 flex items-center gap-1">
                          <code className="text-[10px] font-mono font-black text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded">{c.code}</code>
                          <button onClick={() => copyCode(c.code!)} className="text-muted-foreground active:scale-90"><Copy className="w-3 h-3" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
