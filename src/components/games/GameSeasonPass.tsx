import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Star, Lock, Check, Crown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props { visitorId: string | null }

const TIERS = Array.from({ length: 30 }, (_, i) => {
  const lvl = i + 1;
  const isPremium = lvl % 3 === 0;
  const reward = isPremium ? `+${lvl * 10} Coins ⭐` : `+${lvl * 3} Coins`;
  const value = isPremium ? lvl * 10 : lvl * 3;
  return { lvl, reward, value, isPremium, xpRequired: lvl * 50 };
});

export default function GameSeasonPass({ visitorId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [xp, setXp] = useState(0);
  const [claimed, setClaimed] = useState<number[]>([]);
  const [premium, setPremium] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);

  const seasonKey = "season_2026Q2";

  useEffect(() => {
    if (!visitorId) return;
    try {
      const raw = localStorage.getItem(`pass_${visitorId}_${seasonKey}`);
      if (raw) {
        const p = JSON.parse(raw);
        setClaimed(p.claimed || []); setPremium(!!p.premium);
      }
    } catch { /* noop */ }
    // Estimate XP from game stats
    (async () => {
      try {
        const { data } = await supabase.from("game_stats").select("points").eq("visitor_id", visitorId);
        if (data) {
          const total = data.reduce((s, r: any) => s + (r.points || 0), 0);
          setXp(total);
        }
      } catch { /* noop */ }
    })();
  }, [visitorId]);

  function persist(c: number[], p: boolean) {
    if (!visitorId) return;
    try { localStorage.setItem(`pass_${visitorId}_${seasonKey}`, JSON.stringify({ claimed: c, premium: p })); } catch { /* noop */ }
  }

  const currentLvl = TIERS.filter(t => xp >= t.xpRequired).length;

  async function claim(t: typeof TIERS[number]) {
    if (xp < t.xpRequired || claimed.includes(t.lvl)) return;
    if (t.isPremium && !premium) { toast({ title: "Premium Pass", description: "Reward ini butuh Premium Pass!", variant: "destructive" }); return; }
    setBusy(t.lvl);
    if (visitorId) {
      try {
        const { data: streak } = await supabase.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
        if (streak) await supabase.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) + t.value }).eq("id", streak.id);
      } catch { /* noop */ }
    }
    const next = [...claimed, t.lvl];
    setClaimed(next); persist(next, premium);
    toast({ title: `⭐ Tier ${t.lvl} diklaim!`, description: t.reward });
    setBusy(null);
  }

  function unlockPremium() {
    setPremium(true); persist(claimed, true);
    toast({ title: "👑 Premium Pass aktif (demo)", description: "Reward premium kini bisa diklaim." });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} disabled={!visitorId}
        className="w-full rounded-2xl p-3 text-left relative overflow-hidden bg-gradient-to-r from-yellow-500 via-pink-600 to-purple-700 disabled:opacity-50">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative flex items-center gap-3">
          <Crown className="w-9 h-9 text-yellow-300 drop-shadow-lg" strokeWidth={2.5} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black tracking-widest text-white/90 uppercase">Season Pass — Q2 2026</div>
            <div className="font-extrabold text-white text-sm">Tier {currentLvl}/30 • {xp.toLocaleString("id-ID")} XP</div>
            <div className="text-[10px] text-white/80">30 tier hadiah eksklusif</div>
          </div>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white text-black">{premium ? "PREMIUM" : "FREE"}</span>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md bg-gradient-to-br from-yellow-950 via-purple-950 to-pink-950 border-yellow-500/40 max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-xl font-black text-white flex items-center gap-2"><Crown className="w-5 h-5 text-yellow-300" /> SEASON PASS Q2 2026</DialogTitle></DialogHeader>
          <div className="rounded-xl bg-black/40 border border-yellow-500/30 p-3">
            <div className="flex items-center justify-between text-[11px] font-bold text-white/80 mb-1">
              <span>Tier {currentLvl}/30</span><span>{xp.toLocaleString("id-ID")} XP</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${(currentLvl / 30) * 100}%` }} className="h-full bg-gradient-to-r from-yellow-400 to-pink-500" />
            </div>
          </div>
          {!premium && (
            <Button onClick={unlockPremium} className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-black">
              <Crown className="w-4 h-4 mr-1" /> Aktifkan Premium Pass (Demo)
            </Button>
          )}
          <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
            {TIERS.map(t => {
              const unlocked = xp >= t.xpRequired;
              const done = claimed.includes(t.lvl);
              const ready = unlocked && !done && (!t.isPremium || premium);
              return (
                <div key={t.lvl} className={`rounded-lg p-2 flex items-center gap-2 border ${done ? "bg-emerald-500/10 border-emerald-500/40" : t.isPremium ? "bg-gradient-to-r from-yellow-500/10 to-pink-500/10 border-yellow-500/40" : "bg-black/30 border-white/10"}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs ${t.isPremium ? "bg-gradient-to-br from-yellow-400 to-pink-500 text-black" : "bg-cyan-500/30 text-cyan-200"}`}>{t.lvl}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-extrabold text-white flex items-center gap-1">
                      {t.isPremium && <Star className="w-3 h-3 text-yellow-300 fill-yellow-300" />}
                      {t.reward}
                    </div>
                    <div className="text-[9px] text-white/60">{t.xpRequired} XP {t.isPremium && "• Premium"}</div>
                  </div>
                  {!unlocked ? <Lock className="w-3.5 h-3.5 text-white/40" /> : done ? <Check className="w-4 h-4 text-emerald-300" strokeWidth={3} /> : ready ? (
                    <Button size="sm" disabled={busy === t.lvl} onClick={() => claim(t)} className="h-6 text-[10px] bg-gradient-to-r from-yellow-400 to-pink-500 text-black font-black">
                      {busy === t.lvl ? <Loader2 className="w-3 h-3 animate-spin" /> : "KLAIM"}
                    </Button>
                  ) : t.isPremium && !premium ? <span className="text-[9px] font-black text-yellow-300">PREMIUM</span> : null}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
