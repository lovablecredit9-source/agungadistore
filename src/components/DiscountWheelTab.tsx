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
  eventDays?: number;
  wheelActive?: boolean;
  wheelNote?: string;
  wonDiscount?: number;
  milestones?: { count: number; gem: number }[];
  claimedMilestones?: number[];
  baseMax?: number;
  upgradedMax?: number;
  upgradeTier?: "none" | "month" | "permanent";
  upgradeExpiresAt?: string | null;
  upgradeMonthCost?: number;
  upgradeMonthDays?: number;
  upgradePermanentCost?: number;
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
  const [claimingMs, setClaimingMs] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Hitung mundur menuju 00:00 WIB berikutnya (untuk tampilan event ditutup).
  const msUntilMidnightWIB = (() => {
    const wibNow = now + 7 * 3600 * 1000;
    const d = new Date(wibNow);
    const nextMidnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1, 0, 0, 0);
    return nextMidnight - wibNow;
  })();
  const fmtCountdown = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}j ${m}m ${sec}d`;
  };

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
  const eventDays = data?.eventDays ?? 1;
  const resetLabel = eventDays > 1 ? `Reset tiap ${eventDays} hari` : "Reset 00:00 WIB";

  const allWon = (data?.remainingDiscounts?.length ?? 1) === 0;
  const enoughGems = (data?.gems ?? 0) >= (data?.nextSpinCost ?? 100);
  const hasDiscountNow = (data?.currentDiscount || 0) > 0;
  const mustBuyFirst = hasDiscountNow && (data?.currentBuys ?? 0) === 0;
  const canSpin = !allWon && enoughGems && !mustBuyFirst;
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
    if (mustBuyFirst) {
      toast({ title: "Beli dulu", description: "Beli minimal 1 hadiah samping dulu sebelum spin lagi.", variant: "destructive" });
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
        toast({ title: `🎉 Diskon ${won}%!`, description: "Hadiah samping muncul dengan harga diskon. Beli sampai 30 hadiah!" });
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

  async function handleClaimMilestone(count: number, gem: number) {
    if (claimingMs !== null) return;
    setClaimingMs(count);
    try {
      const res = await call("claim_milestone", { milestoneCount: count });
      setData(res);
      toast({ title: "🎁 Hadiah diklaim!", description: `+${gem} gem dari beli ${count} barang.` });
    } catch (e) {
      toast({ title: "Gagal klaim", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setClaimingMs(null);
    }
  }

  const [upgrading, setUpgrading] = useState<"month" | "permanent" | null>(null);
  async function handleBuyUpgrade(tier: "month" | "permanent") {
    if (upgrading) return;
    setUpgrading(tier);
    try {
      const res = await call("buy_upgrade", { itemId: tier });
      setData(res);
      toast({
        title: "⬆️ Upgrade berhasil!",
        description: tier === "permanent" ? "Batas 30/30 aktif PERMANEN." : "Batas 30/30 aktif 30 hari.",
      });
    } catch (e) {
      toast({ title: "Gagal upgrade", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setUpgrading(null);
    }
  }



  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-primary" /></div>;
  }

  // Event dinonaktifkan admin → tampilkan layar "tunggu info admin" + catatan admin.
  if (data && data.wheelActive === false) {
    return (
      <div className="animate-fade-in pb-[calc(9rem+env(safe-area-inset-bottom))]">
        <div className="relative rounded-[28px] overflow-hidden p-[1.5px] bg-gradient-to-br from-fuchsia-500 via-purple-500 to-cyan-400 shadow-[0_18px_50px_-14px_rgba(168,85,247,0.65)]">
          <div className="relative rounded-[27px] bg-gradient-to-br from-purple-950/70 via-background to-fuchsia-950/40 p-7 overflow-hidden flex flex-col items-center text-center">
            <div className="pointer-events-none absolute -top-12 -right-8 w-44 h-44 rounded-full bg-fuchsia-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-14 -left-6 w-40 h-40 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-yellow-200 via-amber-400 to-yellow-600 flex items-center justify-center shadow-[0_6px_18px_-4px_rgba(250,204,21,0.6),inset_0_2px_4px_rgba(255,255,255,0.6)] mb-4">
              <Lock className="w-9 h-9 text-purple-900" />
            </div>
            <h1 className="relative text-xl font-black bg-gradient-to-r from-fuchsia-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">Roda Diskon Belum Aktif</h1>
            <p className="relative mt-2 text-sm text-muted-foreground max-w-xs">
              Event roda diskon sedang tidak berlangsung. 🎡
            </p>

            {/* Hitung mundur menuju jam 00:00 WIB */}
            <div className="relative mt-4 w-full max-w-sm rounded-2xl p-4 bg-cyan-500/10 border border-cyan-400/30">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Sparkles className="w-4 h-4 text-cyan-300" />
                <span className="text-xs font-black text-cyan-200 uppercase tracking-wide">Terbuka lagi dalam</span>
              </div>
              <div className="text-3xl font-black tabular-nums bg-gradient-to-r from-cyan-300 to-fuchsia-300 bg-clip-text text-transparent">
                {fmtCountdown(msUntilMidnightWIB)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">Roda spin di-reset & dibuka otomatis tiap 00:00 WIB</p>
            </div>

            {data.wheelNote && data.wheelNote.trim() !== "" && (
              <div className="relative mt-4 w-full max-w-sm rounded-2xl p-4 bg-fuchsia-500/10 border border-fuchsia-400/30 text-left">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Info className="w-4 h-4 text-fuchsia-300" />
                  <span className="text-xs font-black text-fuchsia-200 uppercase tracking-wide">Catatan Admin</span>
                </div>
                <p className="text-sm text-foreground/90 whitespace-pre-line">{data.wheelNote}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }



  const hasDiscount = (data?.currentDiscount || 0) > 0;

  return (
    <div className="space-y-4 animate-fade-in pb-[calc(9rem+env(safe-area-inset-bottom))]">
      {/* HERO */}
      <div className="relative rounded-[28px] overflow-hidden p-[1.5px] bg-gradient-to-br from-fuchsia-500 via-purple-500 to-cyan-400 shadow-[0_18px_50px_-14px_rgba(168,85,247,0.65)]">
        <div className="relative rounded-[27px] bg-gradient-to-br from-purple-950/70 via-background to-fuchsia-950/40 p-5 overflow-hidden">
          <div className="pointer-events-none absolute -top-12 -right-8 w-44 h-44 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-14 -left-6 w-40 h-40 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="absolute inset-0 pointer-events-none opacity-[0.12]">
            {["🎡", "💎", "🎁", "✨", "🏷️", "🔥"].map((e, i) => (
              <span key={i} className="absolute text-3xl" style={{ left: `${(i * 17) % 90}%`, top: `${(i * 29) % 70}%` }}>{e}</span>
            ))}
          </div>
          <div className="relative flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-200 via-amber-400 to-yellow-600 flex items-center justify-center shadow-[0_6px_18px_-4px_rgba(250,204,21,0.6),inset_0_2px_4px_rgba(255,255,255,0.6)]">
              <Sparkles className="w-7 h-7 text-purple-900" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-black bg-gradient-to-r from-fuchsia-300 via-pink-300 to-cyan-300 bg-clip-text text-transparent">Roda Diskon</h1>
                <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950">Premium</span>
              </div>
              <p className="text-[11px] text-muted-foreground font-medium">Diskon 10%–90% • Tiap diskon sekali per event • {resetLabel}</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setInfoOpen(true)}
                aria-label="Info hadiah"
                className="w-9 h-9 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/40 flex items-center justify-center text-fuchsia-300 active:scale-95 transition"
              >
                <Info className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-400/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                <Gem className="w-4 h-4 text-cyan-300" />
                <span className="text-sm font-black text-cyan-200">{data?.gems ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CATATAN ADMIN */}
      {data?.wheelNote && data.wheelNote.trim() !== "" && (
        <div className="rounded-2xl p-3.5 bg-fuchsia-500/10 border border-fuchsia-400/30 flex gap-2.5">
          <Info className="w-4 h-4 text-fuchsia-300 shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-black text-fuchsia-200 uppercase tracking-wide mb-0.5">Catatan Admin</p>
            <p className="text-xs text-foreground/90 whitespace-pre-line">{data.wheelNote}</p>
          </div>
        </div>
      )}


      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl p-3 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 border border-emerald-400/30 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <PiggyBank className="w-4 h-4 mx-auto text-emerald-300 mb-1" />
          <div className="text-sm font-black text-emerald-200 flex items-center justify-center gap-0.5">{data?.totalSaved ?? 0}<Gem className="w-3 h-3" /></div>
          <div className="text-[9px] text-muted-foreground font-medium">Hemat</div>
        </div>
        <div className="rounded-2xl p-3 bg-gradient-to-br from-fuchsia-500/15 to-fuchsia-500/5 border border-fuchsia-400/30 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <Tag className="w-4 h-4 mx-auto text-fuchsia-300 mb-1" />
          <div className="text-sm font-black text-fuchsia-200">{data?.wonDiscounts?.length ?? 0}/{data?.allDiscounts?.length ?? 9}</div>
          <div className="text-[9px] text-muted-foreground font-medium">Diskon didapat</div>
        </div>
        <div className="rounded-2xl p-3 bg-gradient-to-br from-cyan-500/15 to-cyan-500/5 border border-cyan-400/30 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <ShoppingBag className="w-4 h-4 mx-auto text-cyan-300 mb-1" />
          <div className="text-sm font-black text-cyan-200">{data?.totalBought ?? 0}</div>
          <div className="text-[9px] text-muted-foreground font-medium">Hadiah dibeli</div>
        </div>
      </div>

      {/* HADIAH MILESTONE — bonus gem dari jumlah barang dibeli */}
      {(data?.milestones?.length ?? 0) > 0 && (
        <div className="rounded-2xl p-4 bg-gradient-to-br from-amber-500/15 via-background to-yellow-500/5 border border-amber-400/30">
          <div className="flex items-center gap-1.5 mb-3">
            <Gift className="w-4 h-4 text-amber-300" />
            <h2 className="text-sm font-black text-amber-200">Bonus Gem — Beli Barang</h2>
            <span className="ml-auto text-[10px] text-muted-foreground">Reset 00:00 WIB</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {data!.milestones!.map((m) => {
              const reached = (data?.totalBought ?? 0) >= m.count;
              const claimed = (data?.claimedMilestones ?? []).includes(m.count);
              return (
                <div
                  key={m.count}
                  className={`rounded-xl p-2.5 text-center border ${claimed ? "bg-emerald-500/10 border-emerald-400/30" : reached ? "bg-amber-500/15 border-amber-400/40" : "bg-muted/20 border-border"}`}
                >
                  <div className="text-[11px] font-bold text-foreground/80">Beli {m.count}</div>
                  <div className="text-sm font-black text-amber-200 flex items-center justify-center gap-0.5 my-1">
                    +{m.gem}<Gem className="w-3 h-3" />
                  </div>
                  {claimed ? (
                    <div className="flex items-center justify-center gap-0.5 text-[10px] font-black text-emerald-300">
                      <CheckCircle2 className="w-3 h-3" /> Diklaim
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      disabled={!reached || claimingMs === m.count}
                      onClick={() => handleClaimMilestone(m.count, m.gem)}
                      className="w-full h-7 text-[11px] font-bold rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 text-amber-950 disabled:opacity-50"
                    >
                      {claimingMs === m.count ? <Loader2 className="w-3 h-3 animate-spin" /> : reached ? "Klaim" : `${data?.totalBought ?? 0}/${m.count}`}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}




      <div className="relative rounded-[28px] p-6 bg-gradient-to-br from-purple-950/60 via-background to-fuchsia-950/40 border border-purple-500/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_20px_50px_-20px_rgba(168,85,247,0.55)] flex flex-col items-center overflow-hidden">
        {/* ambient glow */}
        <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 right-0 w-56 h-56 rounded-full bg-cyan-400/10 blur-3xl" />

        <div className="relative w-72 h-72">
          {/* Pointer */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center">
            <div className="w-0 h-0 border-l-[13px] border-r-[13px] border-t-[26px] border-l-transparent border-r-transparent border-t-yellow-300 drop-shadow-[0_3px_6px_rgba(250,204,21,0.7)]" />
          </div>

          {/* Outer gold ring with studs */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-200 via-amber-400 to-yellow-600 p-[10px] shadow-[0_0_40px_rgba(250,204,21,0.45),inset_0_2px_6px_rgba(255,255,255,0.6)]">
            <div className="relative w-full h-full rounded-full bg-purple-950 p-[3px]">
              {/* studs */}
              {Array.from({ length: 16 }).map((_, i) => {
                const a = (i / 16) * 360;
                return (
                  <span
                    key={i}
                    className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full bg-yellow-100 shadow-[0_0_4px_rgba(255,255,255,0.9)]"
                    style={{ transform: `rotate(${a}deg) translateY(-138px)`, transformOrigin: "center" }}
                  />
                );
              })}

              <motion.svg
                viewBox="0 0 200 200"
                animate={{ rotate: rotation }}
                transition={{ duration: 3.5, ease: [0.17, 0.67, 0.23, 0.99] }}
                className="w-full h-full drop-shadow-[0_0_20px_rgba(168,85,247,0.35)]"
              >
                <defs>
                  {segments.map((_, i) => {
                    const base = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
                    return (
                      <radialGradient key={i} id={`seg-${i}`} cx="50%" cy="50%" r="75%">
                        <stop offset="0%" stopColor={base} stopOpacity="0.75" />
                        <stop offset="100%" stopColor={base} />
                      </radialGradient>
                    );
                  })}
                </defs>
                {segments.map((s, i) => {
                  const a0 = (i * segAngle - 90) * (Math.PI / 180);
                  const a1 = ((i + 1) * segAngle - 90) * (Math.PI / 180);
                  const R = 100;
                  const x0 = 100 + R * Math.cos(a0), y0 = 100 + R * Math.sin(a0);
                  const x1 = 100 + R * Math.cos(a1), y1 = 100 + R * Math.sin(a1);
                  const large = segAngle > 180 ? 1 : 0;
                  const path = `M100 100 L ${x0} ${y0} A ${R} ${R} 0 ${large} 1 ${x1} ${y1} Z`;
                  const la = (i * segAngle + segAngle / 2 - 90) * (Math.PI / 180);
                  const lx = 100 + 66 * Math.cos(la), ly = 100 + 66 * Math.sin(la);
                  return (
                    <g key={i}>
                      <path d={path} fill={`url(#seg-${i})`} stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
                      <text
                        x={lx} y={ly}
                        textAnchor="middle" dominantBaseline="middle"
                        transform={`rotate(${i * segAngle + segAngle / 2} ${lx} ${ly})`}
                        fill="#fff" fontSize="13" fontWeight="900"
                        style={{ textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}
                      >
                        {s}%
                      </text>
                    </g>
                  );
                })}
                <circle cx="100" cy="100" r="98" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="2" />
              </motion.svg>
            </div>
          </div>

          {/* Center hub */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-yellow-200 via-amber-400 to-yellow-600 flex items-center justify-center shadow-[0_4px_14px_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(255,255,255,0.6)]">
              <div className="w-12 h-12 rounded-full bg-purple-950 flex items-center justify-center border border-yellow-300/40">
                <Sparkles className="w-6 h-6 text-yellow-300" />
              </div>
            </div>
          </div>
        </div>

        {hasDiscount && (
          <div className="mt-5 px-5 py-2 rounded-full bg-gradient-to-r from-emerald-500/25 to-cyan-500/25 border border-emerald-400/40 flex items-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
            <Tag className="w-4 h-4 text-emerald-300" />
            <span className="text-sm font-black text-emerald-200">Diskon aktif: {data?.currentDiscount}%</span>
          </div>
        )}

        <Button
          onClick={handleSpin}
          disabled={spinning || !canSpin}
          className="mt-5 w-full max-w-xs h-14 text-base font-black rounded-2xl bg-gradient-to-r from-fuchsia-500 via-purple-500 to-cyan-400 text-white shadow-[0_8px_24px_-6px_rgba(168,85,247,0.7)] hover:brightness-110"
        >
          {spinning ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Memutar...</>
            : allWon ? "✅ Semua diskon didapat"
            : mustBuyFirst ? "🛍️ Beli 1 hadiah dulu"
            : <>🎡 SPIN ({data?.nextSpinCost}<Gem className="w-4 h-4 mx-1" />)</>}
        </Button>
        {mustBuyFirst && !allWon && (
          <p className="mt-2.5 text-[11px] text-amber-300 flex items-center gap-1">
            <ShoppingBag className="w-3 h-3" /> Wajib beli minimal 1 hadiah samping sebelum bisa spin lagi.
          </p>
        )}
        {!allWon && !mustBuyFirst && (
          <p className="mt-2.5 text-[11px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> Spin {(data?.spinsUsed ?? 0) + 1}: {data?.nextSpinCost} gem • biaya tetap tiap spin
          </p>
        )}
        {allWon && (
          <p className="mt-2.5 text-[11px] text-muted-foreground flex items-center gap-1"><Lock className="w-3 h-3" /> {eventDays > 1 ? `Diskon di-reset otomatis tiap ${eventDays} hari.` : "Diskon di-reset otomatis tiap 00:00 WIB."}</p>
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
                    className="relative rounded-2xl p-3 bg-gradient-to-br from-purple-950/50 via-card to-fuchsia-950/30 border border-fuchsia-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_20px_-12px_rgba(168,85,247,0.5)] overflow-hidden"
                  >
                    <div className="pointer-events-none absolute -top-8 -right-6 w-20 h-20 rounded-full bg-fuchsia-500/10 blur-2xl" />
                    {off && (
                      <span className="absolute top-1.5 right-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-[0_2px_8px_rgba(239,68,68,0.5)]">-{data?.currentDiscount}%</span>
                    )}
                    <div className="text-3xl mb-1 drop-shadow">{item.emoji}</div>
                    <div className="text-xs font-bold leading-tight mb-1.5 min-h-[2rem]">{item.label}</div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <span className="text-sm font-black text-cyan-300 flex items-center gap-0.5">{item.finalGem}<Gem className="w-3 h-3" /></span>
                      {off && <span className="text-[10px] text-muted-foreground line-through">{item.gem}</span>}
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleBuy(item)}
                      disabled={busyItem === item.id || (data?.gems ?? 0) < item.finalGem}
                      className="w-full h-8 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-[0_4px_12px_-4px_rgba(16,185,129,0.6)] hover:brightness-110"
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
            <p>• Tiap diskon bisa dipakai beli <b>maksimal {data?.perDiscountMax ?? 30} hadiah</b>, lalu spin lagi untuk diskon lain.</p>
            <p>• <b>Wajib beli min. 1 hadiah</b> dulu sebelum bisa spin lagi.</p>
            <p>• Hadiah tampil sampai 30, bisa di-refresh ({data?.refreshCost} gem) tanpa beli.</p>
            <p>• Reset otomatis tiap 00:00 WIB.</p>
          </div>

          {/* Bonus gem milestone */}
          <div className="rounded-xl p-3 bg-amber-500/5 border border-amber-400/30 text-[11px] leading-relaxed text-muted-foreground space-y-1">
            <p className="font-black text-foreground flex items-center gap-1"><Gift className="w-3.5 h-3.5 text-amber-400" /> Bonus Gem (beli barang)</p>
            <div className="flex flex-wrap gap-1.5">
              {(data?.milestones ?? [{ count: 3, gem: 30 }, { count: 5, gem: 60 }, { count: 10, gem: 200 }]).map((m, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-400/30 text-foreground font-bold">
                  Beli {m.count}: +{m.gem} 💎
                </span>
              ))}
            </div>
          </div>

          {/* Biaya spin tetap */}
          <div className="rounded-xl p-3 bg-fuchsia-500/5 border border-fuchsia-400/30 text-[11px] leading-relaxed text-muted-foreground space-y-1">
            <p className="font-black text-foreground flex items-center gap-1"><Gem className="w-3.5 h-3.5 text-fuchsia-400" /> Biaya Spin</p>
            <p>Biaya tetap <b>{data?.spinCost ?? 500} 💎</b> setiap kali spin.</p>
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
