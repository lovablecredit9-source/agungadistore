import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Gem, Coins, RefreshCw, Clock, Check, Zap } from "lucide-react";

interface Props {
  visitorId: string;
  onUpdate?: () => void;
}

function discountColor(p: number) {
  if (p >= 70) return "from-amber-400 via-orange-500 to-rose-600";
  if (p >= 40) return "from-fuchsia-500 to-purple-700";
  if (p >= 20) return "from-sky-500 to-blue-700";
  return "from-slate-500 to-slate-700";
}

export default function MysteryDiscountShop({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [flash, setFlash] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [{ data: res }, { data: f }] = await Promise.all([
        supabase.functions.invoke("mystery-shop", { body: { action: "list", visitorId } }),
        supabase.functions.invoke("mystery-shop", { body: { action: "flash_status", visitorId } }),
      ]);
      setData(res || null);
      setFlash(f || null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (visitorId) load(); }, [visitorId]);

  async function call(action: string, payload: any, key: string) {
    setBusy(key);
    try {
      const { data: res } = await supabase.functions.invoke("mystery-shop", { body: { action, visitorId, ...payload } });
      if (res?.error) toast({ title: "Gagal", description: res.error, variant: "destructive" });
      else {
        toast({ title: "🎉 Berhasil!", description: res?.message || "" });
        await load();
        onUpdate?.();
      }
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-fuchsia-500/30 bg-black/40 p-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-fuchsia-300" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border-2 border-fuchsia-400/40 bg-gradient-to-br from-fuchsia-600/15 via-purple-700/10 to-amber-500/10 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-fuchsia-300 animate-pulse" />
            <span className="text-[11px] font-black tracking-widest text-fuchsia-100">MYSTERY SHOP MINGGUAN</span>
          </div>
          <Badge className="bg-black/50 border-white/20 text-white text-[9px] gap-1">
            <Clock className="h-3 w-3" /> {data.week}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground mb-2">
          Setiap minggu kamu dapat 6 penawaran acak dengan diskon <b>0%–90%</b>. Beli pakai Gem atau Koin Streak.
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-cyan-500/20 border-cyan-400/50 text-cyan-100 text-[10px] gap-1">
            <Gem className="h-3 w-3" /> {Number(data.gems || 0).toLocaleString("id-ID")}
          </Badge>
          <Badge className="bg-yellow-500/20 border-yellow-400/50 text-yellow-100 text-[10px] gap-1">
            <Coins className="h-3 w-3" /> {Number(data.coins || 0).toLocaleString("id-ID")}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] gap-1 ml-auto"
            disabled={busy === "reroll"}
            onClick={() => call("reroll", {}, "reroll")}
          >
            {busy === "reroll" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Reroll {data.rerollCost} 💎
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(data.rolls || []).map((r: any) => {
          const mult = (100 - r.discount_percent) / 100;
          const pg = Math.round(r.base_price_gems * mult);
          const pc = Math.round(r.base_price_coins * mult);
          return (
            <motion.div
              key={r.id}
              whileHover={{ scale: r.purchased ? 1 : 1.02 }}
              className={`relative overflow-hidden rounded-xl border-2 p-2.5 ${
                r.purchased ? "border-white/10 bg-black/40 opacity-60" : "border-fuchsia-400/30 bg-black/50"
              }`}
            >
              <div className={`absolute top-0 right-0 px-1.5 py-0.5 rounded-bl-lg bg-gradient-to-r ${discountColor(r.discount_percent)} text-white text-[9px] font-black`}>
                -{r.discount_percent}%
              </div>
              <div className="text-[11px] font-black text-foreground pr-10 leading-tight mb-1.5 min-h-[28px]">
                {r.item_label}
              </div>
              {r.purchased ? (
                <div className="flex items-center gap-1 text-[10px] text-emerald-300 font-bold">
                  <Check className="h-3 w-3" /> Sudah dibeli
                </div>
              ) : (
                <div className="space-y-1">
                  {r.base_price_gems > 0 && (
                    <Button
                      size="sm"
                      className="w-full h-7 text-[10px] font-black bg-gradient-to-r from-cyan-500 to-blue-600"
                      disabled={busy === r.id + "gem"}
                      onClick={() => call("buy", { rollId: r.id, payWith: "gem" }, r.id + "gem")}
                    >
                      {busy === r.id + "gem" ? <Loader2 className="h-3 w-3 animate-spin" /> : (
                        <span className="flex items-center gap-1">
                          💎 {pg.toLocaleString("id-ID")}
                          {r.discount_percent > 0 && (
                            <s className="opacity-60 font-normal">{Number(r.base_price_gems).toLocaleString("id-ID")}</s>
                          )}
                        </span>
                      )}
                    </Button>
                  )}
                  {r.base_price_coins > 0 && (
                    <Button
                      size="sm"
                      className="w-full h-7 text-[10px] font-black bg-gradient-to-r from-yellow-500 to-amber-600"
                      disabled={busy === r.id + "coin"}
                      onClick={() => call("buy", { rollId: r.id, payWith: "coin" }, r.id + "coin")}
                    >
                      {busy === r.id + "coin" ? <Loader2 className="h-3 w-3 animate-spin" /> : (
                        <span className="flex items-center gap-1">
                          🪙 {pc.toLocaleString("id-ID")}
                          {r.discount_percent > 0 && (
                            <s className="opacity-60 font-normal">{Number(r.base_price_coins).toLocaleString("id-ID")}</s>
                          )}
                        </span>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Reset diskon kilat harian */}
      <div className="rounded-xl border-2 border-amber-400/40 bg-gradient-to-br from-amber-500/10 to-rose-600/10 p-3">
        <div className="flex items-center gap-2 mb-1">
          <Zap className="h-4 w-4 text-amber-300" />
          <span className="text-[11px] font-black tracking-widest text-amber-100">RESET DISKON KILAT HARIAN</span>
        </div>
        <p className="text-[10px] text-muted-foreground mb-2">
          Sudah klaim diskon kilat hari ini? Reset sekarang tanpa nunggu jam 00:00 WIB.
          Terpakai hari ini: <b>{flash?.usedToday ?? 0}</b> slot.
        </p>
        <Button
          size="sm"
          className="w-full h-8 text-[11px] font-black bg-gradient-to-r from-amber-500 to-rose-600"
          disabled={busy === "reset" || !(flash?.usedToday > 0)}
          onClick={() => call("reset_flash_daily", {}, "reset")}
        >
          {busy === "reset" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `♻️ Reset — 500 💎`}
        </Button>
      </div>
    </div>
  );
}
