import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Swords, Calendar, Crown, Coins, Users, Zap, Trophy } from "lucide-react";

interface Props { visitorId: string; displayName?: string; onUpdate?: () => void; }

const COLOR_MAP: Record<string, string> = {
  yellow: "from-yellow-500/30 to-amber-500/30 border-yellow-400/50",
  green: "from-emerald-500/30 to-teal-500/30 border-emerald-400/50",
  blue: "from-sky-500/30 to-blue-500/30 border-sky-400/50",
  purple: "from-purple-500/30 to-violet-500/30 border-purple-400/50",
  orange: "from-orange-500/30 to-red-500/30 border-orange-400/50",
  red: "from-red-500/40 to-rose-600/40 border-red-400/60",
  pink: "from-pink-500/30 to-rose-500/30 border-pink-400/50",
};

export default function MegaEventHub({ visitorId, displayName = "Pemain", onUpdate }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [attackCount, setAttackCount] = useState(1);
  const [hitFx, setHitFx] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const { data: res } = await supabase.functions.invoke("boss-raid", { body: { action: "status", visitorId } });
      setData(res || null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (visitorId) load(); }, [visitorId]);

  // Realtime subscribe to boss HP for live community feel
  useEffect(() => {
    if (!data?.raid?.id) return;
    const ch = supabase
      .channel(`boss-${data.raid.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "streak_boss_raids", filter: `id=eq.${data.raid.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [data?.raid?.id]);

  async function attack() {
    if (!data?.raid) return;
    setBusy(true);
    try {
      const { data: res } = await supabase.functions.invoke("boss-raid", {
        body: { action: "attack", visitorId, raidId: data.raid.id, attacks: attackCount, displayName },
      });
      if (res?.error) {
        toast({ title: "Gagal serang", description: res.error, variant: "destructive" });
      } else {
        setHitFx(true);
        setTimeout(() => setHitFx(false), 700);
        toast({
          title: res.victory ? "🏆 BOSS KALAH!" : `⚔️ -${res.damage} HP!`,
          description: res.boost_active ? `Boost ${res.boost_multiplier}x aktif!` : (res.victoryMessage || "Serangan berhasil!"),
        });
        await load();
        onUpdate?.();
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-400/30 p-6 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-red-300" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* TODAY EVENT BANNER */}
      {data?.today_event && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl bg-gradient-to-r ${COLOR_MAP[data.today_event.color_theme] || COLOR_MAP.red} border-2 p-3 sm:p-4 shadow-xl relative overflow-hidden`}
        >
          <div className="absolute -top-4 -right-4 text-6xl opacity-30 animate-pulse">{data.today_event.event_icon}</div>
          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="h-4 w-4 text-white" />
              <Badge className="bg-white/20 text-white border-white/30 text-[9px] h-4">EVENT HARI INI</Badge>
            </div>
            <p className="font-bold text-base sm:text-lg text-white">{data.today_event.event_name}</p>
            <p className="text-xs text-white/90">{data.today_event.event_description}</p>
            {data.today_event.multiplier > 1 && (
              <Badge className="mt-1 bg-yellow-300 text-black text-[10px] h-4 font-bold">
                <Zap className="h-2.5 w-2.5 mr-0.5" />{data.today_event.multiplier}x BOOST
              </Badge>
            )}
          </div>
        </motion.div>
      )}

      {/* WEEK CALENDAR */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-500/10 via-red-500/10 to-pink-500/10 border-2 border-amber-400/40 p-2.5">
        <div className="flex items-center gap-1.5 mb-2">
          <Calendar className="h-4 w-4 text-amber-300" />
          <p className="font-bold text-xs text-amber-100">Kalender Event Mingguan</p>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const evt = data?.calendar?.find((c: any) => c.day_of_week === d);
            const isToday = data?.today_event?.day_of_week === d;
            return (
              <div
                key={d}
                className={`rounded-lg p-1 text-center border ${isToday ? "bg-gradient-to-br from-amber-400 to-red-500 border-yellow-300 scale-105" : `bg-gradient-to-br ${evt ? COLOR_MAP[evt.color_theme] || "from-white/5 to-white/5" : "from-white/5 to-white/5"} border-white/10`}`}
              >
                <p className={`text-[8px] font-bold ${isToday ? "text-black" : "text-white/70"}`}>
                  {["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][d]}
                </p>
                <div className="text-base">{evt?.event_icon || "-"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* BOSS RAID */}
      {data?.raid && (
        <div className="rounded-2xl bg-gradient-to-br from-red-600/20 via-rose-700/20 to-orange-600/20 border-2 border-red-400/50 p-3 sm:p-4 shadow-2xl relative overflow-hidden">
          <AnimatePresence>
            {hitFx && (
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: [0, 1, 0], scale: [0.5, 2, 3] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
              >
                <span className="text-6xl">💥</span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Swords className="h-5 w-5 text-red-300" />
              <p className="font-bold text-base text-red-100">Boss Raid Komunitas</p>
            </div>
            <Badge className="bg-red-500/40 text-red-100 border-red-400/60 text-[9px] h-4 animate-pulse">LIVE</Badge>
          </div>

          <motion.div
            animate={{ rotate: [0, -3, 3, -3, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
            className="text-center text-6xl my-2"
          >
            {data.raid.boss_emoji}
          </motion.div>
          <p className="text-center font-bold text-lg text-red-100">{data.raid.boss_name}</p>
          <p className="text-center text-[10px] text-red-200/80 mb-2">{data.raid.boss_description}</p>

          <div className="space-y-1 mb-2">
            <div className="flex justify-between text-[10px] text-red-100">
              <span>HP Boss</span>
              <span className="font-bold">{Number(data.raid.current_hp).toLocaleString()} / {Number(data.raid.total_hp).toLocaleString()}</span>
            </div>
            <Progress value={(Number(data.raid.current_hp) / Number(data.raid.total_hp)) * 100} className="h-3" />
          </div>

          <div className="grid grid-cols-3 gap-1 mb-2 text-center">
            <div className="rounded bg-black/30 p-1">
              <p className="text-[9px] text-white/60">Pemain</p>
              <p className="font-bold text-sm text-white"><Users className="inline h-3 w-3" /> {data.participants}</p>
            </div>
            <div className="rounded bg-black/30 p-1">
              <p className="text-[9px] text-white/60">Damage Anda</p>
              <p className="font-bold text-sm text-amber-300">{(data.my_attack?.total_damage || 0).toLocaleString()}</p>
            </div>
            <div className="rounded bg-black/30 p-1">
              <p className="text-[9px] text-white/60">Reward Pool</p>
              <p className="font-bold text-sm text-amber-300"><Coins className="inline h-3 w-3" /> {data.raid.victory_reward_pool}</p>
            </div>
          </div>

          {data.raid.current_hp > 0 ? (
            <>
              <div className="flex items-center gap-1 mb-2">
                {[1, 5, 10].map((n) => (
                  <Button
                    key={n}
                    size="sm"
                    variant={attackCount === n ? "default" : "outline"}
                    onClick={() => setAttackCount(n)}
                    className={`h-7 flex-1 text-[10px] ${attackCount === n ? "bg-amber-500 text-black" : "bg-black/20 text-white border-white/20"}`}
                  >
                    x{n}
                  </Button>
                ))}
              </div>
              <Button
                disabled={busy}
                onClick={attack}
                className="w-full h-10 bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold shadow-lg"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <><Swords className="h-4 w-4 mr-1" /> SERANG ({data.raid.attack_cost_coins * attackCount}<Coins className="h-3 w-3 ml-0.5" />)</>
                )}
              </Button>
            </>
          ) : (
            <div className="text-center py-3">
              <Trophy className="h-10 w-10 mx-auto text-amber-300 mb-1" />
              <p className="font-bold text-amber-200">Boss Sudah Dikalahkan!</p>
              <p className="text-[10px] text-amber-100/80">Reward sudah dibagikan ke semua peserta</p>
            </div>
          )}

          {/* LEADERBOARD */}
          {data.leaderboard.length > 0 && (
            <div className="mt-3 pt-3 border-t border-red-400/30">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Crown className="h-3.5 w-3.5 text-amber-300" />
                <p className="text-[11px] font-bold text-amber-200">Top Penyerang</p>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {data.leaderboard.slice(0, 10).map((p: any, i: number) => (
                  <div
                    key={p.visitor_id}
                    className={`flex items-center gap-2 rounded px-1.5 py-1 text-[10px] ${
                      i === 0 ? "bg-amber-500/30" : i === 1 ? "bg-slate-300/20" : i === 2 ? "bg-amber-700/30" : "bg-black/20"
                    } ${p.visitor_id === visitorId ? "ring-1 ring-amber-300" : ""}`}
                  >
                    <span className="font-bold w-4 text-white">#{i + 1}</span>
                    <span className="flex-1 truncate text-white">{p.display_name}</span>
                    <span className="font-bold text-amber-200">{p.total_damage.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
