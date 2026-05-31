import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getVisitorId } from "@/lib/visitor-id";
import { Loader2, Gem, RefreshCw, Sparkles, Gift, Lock, Tag, ShoppingBag } from "lucide-react";

interface SideItem {
  id: string; label: string; emoji: string; type: string; value: number; gem: number; finalGem: number;
}
interface SpinData {
  currentDiscount: number;
  spinsUsed: number;
  boughtSinceSpin: boolean;
  purchasedItems: string[];
  gems: number;
  refreshCost: number;
  items: SideItem[];
  segments: number[];
  wonDiscount?: number;
}

const SEGMENT_COLORS = ["#06b6d4", "#10b981", "#f59e0b", "#a855f7", "#ef4444", "#fbbf24"];

export default function DiscountWheelTab() {
  const { toast } = useToast();
  const visitorId = getVisitorId();
  const [data, setData] = useState<SpinData | null>(null);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const segments = data?.segments || [5, 10, 25, 50, 80, 90];
  const segCount = segments.length;
  const segAngle = 360 / segCount;

  async function handleSpin() {
    if (!data || spinning) return;
    if (data.spinsUsed > 0 && !data.boughtSinceSpin) {
      toast({ title: "Belum bisa spin", description: "Beli dulu salah satu item diskon untuk spin lagi.", variant: "destructive" });
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
        toast({ title: `🎉 Diskon ${won}%!`, description: "Hadiah samping muncul dengan harga diskon. Beli 1 untuk bisa spin lagi." });
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
      const res = await call("buy", { itemId: item.id });
      setData(res);
      toast({ title: "✅ Pembelian berhasil", description: `${item.label} (${item.finalGem} gem). Sekarang kamu bisa spin lagi!` });
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
  const canSpin = data?.spinsUsed === 0 || data?.boughtSinceSpin;

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
              <p className="text-[11px] text-muted-foreground font-medium">Spin pertama GRATIS • Event harian • Reset 00:00 WIB</p>
            </div>
            <div className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/15 border border-cyan-400/30">
              <Gem className="w-4 h-4 text-cyan-300" />
              <span className="text-sm font-black text-cyan-200">{data?.gems ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* WHEEL */}
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
                className="absolute left-1/2 top-1/2 origin-left text-white font-black text-sm drop-shadow"
                style={{ transform: `rotate(${i * segAngle + segAngle / 2}deg) translateX(58px)` }}
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
            : data?.spinsUsed === 0 ? "🎡 SPIN GRATIS!"
            : canSpin ? "🎡 SPIN LAGI" : "🔒 Beli 1 item dulu"}
        </Button>
        {!canSpin && (
          <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1"><Lock className="w-3 h-3" /> Wajib beli salah satu item diskon untuk spin berikutnya.</p>
        )}
      </div>

      {/* SIDE PRIZES */}
      {hasDiscount && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-black flex items-center gap-1.5"><ShoppingBag className="w-4 h-4 text-fuchsia-400" /> Hadiah Diskon {data?.currentDiscount}%</h2>
            <Button size="sm" variant="outline" onClick={handleRefresh} disabled={refreshing} className="h-8 text-xs">
              {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><RefreshCw className="w-3 h-3 mr-1" />Refresh {data?.refreshCost}<Gem className="w-3 h-3 ml-0.5" /></>}
            </Button>
          </div>
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
          {data?.items.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-6">Semua item sudah dibeli! Refresh atau spin lagi untuk hadiah baru.</p>
          )}
        </div>
      )}

      {!hasDiscount && (
        <p className="text-center text-sm text-muted-foreground py-4">Putar roda untuk membuka hadiah diskon spesial! 🎁</p>
      )}
    </div>
  );
}
