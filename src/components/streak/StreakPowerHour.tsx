import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Clock, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface Props {
  visitorId: string;
}

interface Status {
  schedule: { hour_start: number; schedule_date: string };
  claim: { success: boolean; bonus_coins: number; hour_claimed: number } | null;
  currentHour: number;
  isActiveNow: boolean;
  minutesUntil: number;
}

function fmtHour(h: number) {
  return `${String(h).padStart(2, "0")}:00 WIB`;
}

export default function StreakPowerHour({ visitorId }: Props) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [now, setNow] = useState(new Date());
  const { toast } = useToast();

  const load = useCallback(async () => {
    if (!visitorId) return;
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke(`streak-power-hour?action=status&visitorId=${visitorId}`, {
        method: "GET" as any,
      });
      if (data && !data.error) setStatus(data);
    } catch {}
    setLoading(false);
  }, [visitorId]);

  useEffect(() => { load(); }, [load]);

  // Tick clock every minute
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Auto-refresh status when hour changes
  useEffect(() => {
    if (!status) return;
    const wib = new Date(now.getTime() + 7 * 3600 * 1000);
    const curHour = wib.getUTCHours();
    if (curHour !== status.currentHour) load();
  }, [now, status, load]);

  async function claim() {
    if (!visitorId || claiming) return;
    setClaiming(true);
    try {
      const { data, error } = await supabase.functions.invoke("streak-power-hour?action=claim", {
        body: { visitorId },
      });
      if (error || data?.error) {
        toast({ title: "Gagal klaim", description: data?.error || error?.message, variant: "destructive" });
      } else if (data?.success) {
        toast({ title: "⚡ Power Hour Sukses!", description: `+${data.bonus} Streak Coin & badge ⚡` });
      } else {
        toast({ title: "Klaim tercatat", description: "Bukan jam Power Hour. Coba besok!", variant: "destructive" });
      }
      await load();
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Gagal", variant: "destructive" });
    }
    setClaiming(false);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/50 p-4 flex items-center justify-center min-h-[120px]">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!status) return null;

  const targetHour = status.schedule.hour_start;
  const claimed = !!status.claim;
  const success = status.claim?.success;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border-2 p-4 ${
        status.isActiveNow && !claimed
          ? "border-yellow-400 bg-gradient-to-br from-yellow-500/20 via-orange-500/15 to-red-500/20 shadow-lg shadow-yellow-500/30 animate-pulse"
          : "border-border/50 bg-card/50"
      }`}
    >
      {/* Bg sparkle */}
      {status.isActiveNow && !claimed && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Zap className="absolute top-2 right-3 w-8 h-8 text-yellow-300/60" />
          <Zap className="absolute bottom-3 left-3 w-6 h-6 text-orange-300/60" />
        </motion.div>
      )}

      <div className="relative">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-yellow-400 to-orange-500 shadow-md">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-bold text-sm">Power Hour Hari Ini</h3>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <Clock className="w-3.5 h-3.5" />
          <span>Jam target: <span className="font-bold text-foreground">{fmtHour(targetHour)}</span></span>
        </div>

        <AnimatePresence mode="wait">
          {claimed ? (
            <motion.div
              key="claimed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`rounded-lg p-3 ${
                success
                  ? "bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/40"
                  : "bg-muted/50 border border-border/50"
              }`}
            >
              <div className="flex items-center gap-2">
                {success ? (
                  <>
                    <div className="p-1 rounded-full bg-green-500/20">
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-green-600 dark:text-green-400">Sukses! +{status.claim?.bonus_coins} 🪙</p>
                      <p className="text-[10px] text-muted-foreground">Badge ⚡ aktif hari ini</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-1 rounded-full bg-muted">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium">Klaim di luar jam target</p>
                      <p className="text-[10px] text-muted-foreground">Coba lagi besok!</p>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="action" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Button
                onClick={claim}
                disabled={claiming || !status.isActiveNow}
                className={`w-full ${
                  status.isActiveNow
                    ? "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white"
                    : ""
                }`}
                size="sm"
              >
                {claiming ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : status.isActiveNow ? (
                  <>
                    <Zap className="w-4 h-4 mr-1" />
                    Klaim Sekarang!
                  </>
                ) : (
                  <>Tunggu jam {fmtHour(targetHour)}</>
                )}
              </Button>
              <p className="text-[10px] text-center text-muted-foreground mt-2">
                Klaim tepat di jam target = +5 🪙 + badge ⚡
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
