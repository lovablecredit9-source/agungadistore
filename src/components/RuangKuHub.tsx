import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import {
  Target, Gift, Trophy, Loader2, Check, ShoppingBag, Wallet, Sparkles,
  Users, Crown, Star, PartyPopper,
} from "lucide-react";

interface Mission {
  key: string; title: string; desc: string; icon: string;
  target: number; reward: number; current: number; completed: boolean; claimed: boolean;
}
interface LB { me: boolean; username: string; value: number; }
interface Status {
  weekStart: string;
  missions: Mission[];
  dailyBoxAvailable: boolean;
  weekBonusUnlocked: boolean;
  leaderboard: LB[];
}

const rp = (n: number) => "Rp " + Number(n || 0).toLocaleString("id-ID");

const ICONS: Record<string, any> = {
  shopping: ShoppingBag, wallet: Wallet, spin: Sparkles, users: Users,
};

interface Props {
  visitorId: string;
  onBalanceChange?: () => void;
}

export default function RuangKuHub({ visitorId, onBalanceChange }: Props) {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [boxOpening, setBoxOpening] = useState<null | "daily" | "weekly_bonus">(null);
  const [reveal, setReveal] = useState<number | null>(null);

  const load = async () => {
    try {
      const { data } = await supabase.functions.invoke("ruangku-hub", {
        body: { action: "status", visitorId },
      });
      if ((data as any)?.missions) setStatus(data as Status);
    } catch { /* noop */ } finally { setLoading(false); }
  };

  useEffect(() => { if (visitorId) load(); }, [visitorId]);

  const claimMission = async (key: string) => {
    setBusy(key);
    try {
      const { data } = await supabase.functions.invoke("ruangku-hub", {
        body: { action: "claim_mission", visitorId, missionKey: key },
      });
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "🎯 Misi selesai!", description: `+${rp((data as any).reward)} Saldo IN` });
      onBalanceChange?.();
      await load();
    } catch (e) {
      toast({ title: "Gagal", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    } finally { setBusy(null); }
  };

  const openBox = async (kind: "daily" | "weekly_bonus") => {
    setBoxOpening(kind);
    setReveal(null);
    try {
      const { data } = await supabase.functions.invoke("ruangku-hub", {
        body: { action: "open_box", visitorId, kind },
      });
      if ((data as any)?.error) throw new Error((data as any).error);
      // little suspense
      await new Promise((r) => setTimeout(r, 900));
      setReveal((data as any).reward);
      onBalanceChange?.();
      await load();
    } catch (e) {
      setBoxOpening(null);
      toast({ title: "Gagal buka kotak", description: e instanceof Error ? e.message : "Error", variant: "destructive" });
    }
  };

  const closeBox = () => { setBoxOpening(null); setReveal(null); };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!status) return null;

  const doneCount = status.missions.filter((m) => m.claimed).length;

  return (
    <div className="space-y-5">
      {/* ===== Misi Mingguan ===== */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 grid place-items-center text-white shadow-md">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold leading-tight">Misi Mingguan</h3>
              <p className="text-[10px] text-muted-foreground">Reset tiap Senin • Hadiah Saldo IN</p>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            {doneCount}/{status.missions.length}
          </span>
        </div>

        <div className="space-y-2">
          {status.missions.map((m) => {
            const Icon = ICONS[m.icon] || Star;
            const pct = Math.min(100, Math.round((m.current / m.target) * 100));
            return (
              <div key={m.key} className="rounded-2xl border border-border/60 bg-card/60 p-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 grid place-items-center text-white shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12px] font-bold truncate">{m.title}</span>
                      <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 shrink-0">+{rp(m.reward)}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{m.desc}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground w-9 text-right">{m.current}/{m.target}</span>
                  {m.claimed ? (
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5"><Check className="w-3 h-3" />Klaim</span>
                  ) : (
                    <button
                      disabled={!m.completed || busy === m.key}
                      onClick={() => claimMission(m.key)}
                      className="text-[11px] font-bold px-3 py-1.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-emerald-500 to-teal-600 text-white active:scale-95 transition"
                    >
                      {busy === m.key ? <Loader2 className="w-3 h-3 animate-spin" /> : "Klaim"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===== Lucky Box ===== */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          onClick={() => status.dailyBoxAvailable && openBox("daily")}
          disabled={!status.dailyBoxAvailable}
          className="relative overflow-hidden rounded-2xl p-3 text-left text-white bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-600 disabled:opacity-60 active:scale-[0.98] transition"
        >
          <Gift className="w-6 h-6 mb-1.5" />
          <div className="text-[12px] font-extrabold">Lucky Box Harian</div>
          <div className="text-[10px] opacity-90">{status.dailyBoxAvailable ? "Buka gratis sekarang!" : "Sudah dibuka hari ini"}</div>
          {status.dailyBoxAvailable && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-yellow-300 animate-ping" />}
        </button>

        <button
          onClick={() => status.weekBonusUnlocked && openBox("weekly_bonus")}
          disabled={!status.weekBonusUnlocked}
          className="relative overflow-hidden rounded-2xl p-3 text-left text-white bg-gradient-to-br from-amber-500 via-orange-500 to-red-500 disabled:opacity-60 active:scale-[0.98] transition"
        >
          <Crown className="w-6 h-6 mb-1.5" />
          <div className="text-[12px] font-extrabold">Kotak Bonus</div>
          <div className="text-[10px] opacity-90">{status.weekBonusUnlocked ? "Terbuka! Hadiah besar 🎉" : "Selesaikan semua misi"}</div>
          {status.weekBonusUnlocked && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-yellow-200 animate-ping" />}
        </button>
      </div>

      {/* ===== Leaderboard Saldo IN ===== */}
      {status.leaderboard.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-600 grid place-items-center text-white shadow-md">
              <Trophy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold leading-tight">Top Saldo IN</h3>
              <p className="text-[10px] text-muted-foreground">Peringkat pengumpul Saldo IN terbanyak</p>
            </div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/60 divide-y divide-border/50">
            {status.leaderboard.map((r, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2 ${r.me ? "bg-emerald-500/10" : ""}`}>
                <span className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-extrabold ${i === 0 ? "bg-yellow-400 text-black" : i === 1 ? "bg-slate-300 text-black" : i === 2 ? "bg-amber-700 text-white" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                <span className="flex-1 text-[12px] font-semibold truncate">{r.username}{r.me && <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">(kamu)</span>}</span>
                <span className="text-[12px] font-extrabold text-emerald-600 dark:text-emerald-400">{rp(r.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== Box open modal ===== */}
      <AnimatePresence>
        {boxOpening && (
          <motion.div
            className="fixed inset-0 z-[999] grid place-items-center bg-black/70 backdrop-blur-sm p-6"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={reveal !== null ? closeBox : undefined}
          >
            <motion.div
              initial={{ scale: 0.7, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="w-full max-w-xs rounded-3xl bg-card border border-border p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              {reveal === null ? (
                <>
                  <motion.div
                    animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.1, 1] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="mx-auto w-20 h-20 rounded-2xl grid place-items-center text-white bg-gradient-to-br from-fuchsia-500 to-purple-600 mb-3"
                  >
                    <Gift className="w-10 h-10" />
                  </motion.div>
                  <p className="text-sm font-bold">Membuka kotak...</p>
                </>
              ) : (
                <>
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="mx-auto w-20 h-20 rounded-full grid place-items-center text-white bg-gradient-to-br from-emerald-500 to-teal-600 mb-3">
                    <PartyPopper className="w-10 h-10" />
                  </motion.div>
                  <p className="text-xs text-muted-foreground">Kamu mendapatkan</p>
                  <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 my-1">{rp(reveal)}</p>
                  <p className="text-[11px] text-muted-foreground mb-4">Saldo IN otomatis masuk ✨</p>
                  <button onClick={closeBox} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm active:scale-95 transition">
                    Mantap!
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
