import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sparkles, Zap, Loader2, Lock, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Duration = { hours: number; price: number };
type Tier = { tier: number; name: string; tagline: string; durations: Duration[] };
type Booster = {
  active_tier: number;
  active_until: string | null;
  highest_tier_owned: number;
};

export function useServerLuck(visitorId: string | null) {
  const [booster, setBooster] = useState<Booster | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [now, setNow] = useState(Date.now());

  const fetchStatus = useCallback(async () => {
    if (!visitorId) return;
    const { data } = await supabase.functions.invoke("server-luck", { body: { action: "status", visitorId } });
    if (data?.booster) setBooster(data.booster);
    if (data?.tiers) setTiers(data.tiers);
  }, [visitorId]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const isActive = !!booster?.active_until && new Date(booster.active_until).getTime() > now;
  const activeTier = isActive ? booster!.active_tier : 1;
  const remainingMs = isActive ? new Date(booster!.active_until!).getTime() - now : 0;

  return { booster, tiers, fetchStatus, isActive, activeTier, remainingMs };
}

function formatRemaining(ms: number) {
  if (ms <= 0) return "—";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const TIER_GRADIENT: Record<number, string> = {
  2:  "from-emerald-500 to-teal-600",
  6:  "from-blue-500 to-indigo-600",
  8:  "from-violet-500 to-purple-600",
  10: "from-amber-500 to-orange-600",
  20: "from-pink-500 via-rose-500 to-red-600",
};

// Hitung keunggulan per tier (sinkron dengan logika edge function)
function tierBenefits(mult: number) {
  // Lucky Draw zonk: base 30%, turun kuadrat → 30 / mult²
  const zonkBase = 30;
  const zonkNew = zonkBase / (mult * mult);
  const zonkReduction = Math.round(((zonkBase - zonkNew) / zonkBase) * 100);
  // Slot reel match bias: (mult-1)*8%, max 70%
  const matchProb = Math.min(70, Math.max(0, (mult - 1) * 8));
  // Jackpot/legendary boost: linear (slot rare symbols) & mult² (lucky draw legendary)
  const rareBoost = Math.round((mult - 1) * 100); // % naik
  const legendaryBoost = Math.round((mult * mult - 1) * 100);
  return { zonkReduction, matchProb: Math.round(matchProb), rareBoost, legendaryBoost };
}

export function ServerLuckCard({ visitorId }: { visitorId: string | null }) {
  const { booster, tiers, fetchStatus, isActive, activeTier, remainingMs } = useServerLuck(visitorId);
  const [open, setOpen] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const { toast } = useToast();

  if (!visitorId) return null;

  const buy = async (tier: number, hours: number) => {
    const key = `${tier}-${hours}`;
    setBuying(key);
    const { data, error } = await supabase.functions.invoke("server-luck", {
      body: { action: "buy", visitorId, tier, hours, paymentSource: "auto" },
    });
    setBuying(null);
    if (error || data?.error) {
      return toast({ title: "Gagal", description: data?.error || "Coba lagi", variant: "destructive" });
    }
    toast({ title: "🍀 Server Luck aktif!", description: `${tiers.find(t => t.tier === tier)?.name} • ${hours} jam` });
    fetchStatus();
    setOpen(false);
  };

  const highest = booster?.highest_tier_owned || 1;
  const tierOrder = tiers.map(t => t.tier);
  const currentIdx = tierOrder.indexOf(highest);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <motion.button
          whileTap={{ scale: 0.97 }}
          className={`w-full rounded-2xl p-3 text-left shadow-lg transition-all bg-gradient-to-r ${
            isActive ? TIER_GRADIENT[activeTier] : "from-slate-700 to-slate-900"
          } text-white`}
        >
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-sm">Server Luck</span>
                {isActive && <span className="text-[9px] font-black bg-white/30 rounded-full px-1.5 py-0.5">x{activeTier}</span>}
              </div>
              <div className="text-[10px] opacity-90 truncate">
                {isActive ? <>Aktif • <Clock className="inline w-2.5 h-2.5" /> {formatRemaining(remainingMs)}</> : "Beli booster untuk hoki ekstra"}
              </div>
            </div>
            <Zap className={`w-5 h-5 ${isActive ? "animate-pulse" : ""}`} />
          </div>
        </motion.button>
      </DialogTrigger>

      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" /> Server Luck Booster
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-xs bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-2.5 text-amber-900 dark:text-amber-100">
            🍀 <strong>Server Luck</strong> meningkatkan peluang menang besar di Slot & Lucky Draw.
            Tier wajib dibeli berurutan (x2 → x6 → x8 → x10 → x20).
            Bayar dari <strong>Saldo IN</strong> dulu, lalu Saldo Utama otomatis.
          </div>

          {tiers.map((t, idx) => {
            const locked = idx > currentIdx + 1;
            const isCurrent = isActive && activeTier === t.tier;
            return (
              <div
                key={t.tier}
                className={`rounded-xl p-3 border-2 ${
                  isCurrent ? "border-amber-500 shadow-md" : "border-border"
                } bg-gradient-to-br ${TIER_GRADIENT[t.tier]} text-white relative overflow-hidden`}
              >
                {locked && (
                  <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center z-10 text-center p-3">
                    <Lock className="w-6 h-6 mb-1" />
                    <div className="text-xs font-bold">Wajib unlock tier sebelumnya</div>
                    <div className="text-[10px] opacity-80 mt-0.5">
                      Beli {tiers[currentIdx + 1]?.name} dulu
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="font-extrabold text-base">{t.name}</div>
                    <div className="text-[10px] opacity-90">{t.tagline}</div>
                  </div>
                  {isCurrent && <span className="text-[9px] font-black bg-white/30 rounded-full px-2 py-0.5">AKTIF</span>}
                </div>
                {/* Benefit pills */}
                {(() => {
                  const b = tierBenefits(t.tier);
                  return (
                    <div className="flex flex-wrap gap-1 mb-2">
                      <span className="text-[9px] font-bold bg-white/25 backdrop-blur rounded-full px-1.5 py-0.5">
                        🚫 Zonk −{b.zonkReduction}%
                      </span>
                      <span className="text-[9px] font-bold bg-white/25 backdrop-blur rounded-full px-1.5 py-0.5">
                        🎰 Match {b.matchProb}%
                      </span>
                      <span className="text-[9px] font-bold bg-white/25 backdrop-blur rounded-full px-1.5 py-0.5">
                        💎 Rare +{b.rareBoost}%
                      </span>
                      <span className="text-[9px] font-bold bg-yellow-300/40 backdrop-blur rounded-full px-1.5 py-0.5">
                        👑 Jackpot +{b.legendaryBoost}%
                      </span>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-3 gap-1.5">
                  {t.durations.map(d => {
                    const k = `${t.tier}-${d.hours}`;
                    return (
                      <Button
                        key={d.hours}
                        size="sm"
                        disabled={!!buying || locked}
                        onClick={() => buy(t.tier, d.hours)}
                        className="bg-white/20 hover:bg-white/30 backdrop-blur text-white border-0 flex flex-col h-auto py-1.5 px-1"
                      >
                        {buying === k ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <span className="text-[10px] font-bold">{d.hours} jam</span>
                            <span className="text-[10px] opacity-90">Rp {d.price.toLocaleString("id-ID")}</span>
                          </>
                        )}
                      </Button>
                    );
                  })}
                  {t.durations.length < 3 && Array.from({ length: 3 - t.durations.length }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
