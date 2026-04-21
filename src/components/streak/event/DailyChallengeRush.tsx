import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Flame, Zap, Trophy, Clock, Target, Sparkles, Star } from "lucide-react";

interface Props {
  visitorId: string;
  currentStreak: number;
  onUpdate?: () => void;
}

interface Challenge {
  id: string;
  icon: string;
  title: string;
  desc: string;
  target: number;
  reward: number;
  color: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

function getTodayKey() {
  const d = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

function todayChallenges(): Omit<Challenge, "progress" | "completed" | "claimed">[] {
  const day = new Date(Date.now() + 7 * 60 * 60 * 1000).getDay();
  const pool = [
    { id: "tap_50", icon: "👆", title: "Tap Master", desc: "Tap 50 kali di Rush Pad", target: 50, reward: 30, color: "from-pink-500 to-rose-500" },
    { id: "tap_100", icon: "⚡", title: "Speed Demon", desc: "Tap 100 kali super cepat", target: 100, reward: 60, color: "from-yellow-500 to-orange-500" },
    { id: "tap_200", icon: "🔥", title: "Fire Rush", desc: "Tap 200 kali untuk legenda", target: 200, reward: 120, color: "from-red-500 to-orange-600" },
    { id: "tap_75", icon: "✨", title: "Sparkle Touch", desc: "Tap 75 kali untuk poin bonus", target: 75, reward: 45, color: "from-purple-500 to-fuchsia-500" },
    { id: "tap_150", icon: "💎", title: "Gem Tapper", desc: "Tap 150 kali untuk gem aura", target: 150, reward: 90, color: "from-cyan-500 to-blue-500" },
  ];
  // Rotate based on day - 3 challenges per day
  return [pool[day % pool.length], pool[(day + 2) % pool.length], pool[(day + 4) % pool.length]];
}

export default function DailyChallengeRush({ visitorId, currentStreak, onUpdate }: Props) {
  const { toast } = useToast();
  const today = getTodayKey();
  const storageKey = `dcr-${visitorId}-${today}`;

  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(15);
  const [running, setRunning] = useState(false);
  const [combo, setCombo] = useState(0);
  const [floaters, setFloaters] = useState<{ id: number; x: number; y: number; v: string }[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem(storageKey);
    const saved = raw ? JSON.parse(raw) : {};
    const initial = todayChallenges().map((c) => ({
      ...c,
      progress: saved[c.id]?.progress || 0,
      completed: saved[c.id]?.completed || false,
      claimed: saved[c.id]?.claimed || false,
    }));
    setChallenges(initial);
  }, [storageKey]);

  useEffect(() => {
    if (challenges.length === 0) return;
    const map: Record<string, { progress: number; completed: boolean; claimed: boolean }> = {};
    challenges.forEach((c) => { map[c.id] = { progress: c.progress, completed: c.completed, claimed: c.claimed }; });
    localStorage.setItem(storageKey, JSON.stringify(map));
  }, [challenges, storageKey]);

  useEffect(() => {
    if (!running) return;
    if (timeLeft <= 0) { setRunning(false); return; }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [running, timeLeft]);

  const active = challenges.find((c) => c.id === activeId) || null;

  function startChallenge(id: string) {
    setActiveId(id);
    setTapCount(0);
    setTimeLeft(15);
    setRunning(true);
    setCombo(0);
  }

  function handleTap(e: React.MouseEvent<HTMLButtonElement>) {
    if (!running || !active) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newCount = tapCount + 1;
    const newCombo = combo + 1;
    setTapCount(newCount);
    setCombo(newCombo);
    const id = Date.now() + Math.random();
    setFloaters((f) => [...f, { id, x, y, v: newCombo >= 10 ? "+2🔥" : "+1" }]);
    setTimeout(() => setFloaters((f) => f.filter((p) => p.id !== id)), 600);

    if (newCount >= active.target) {
      setRunning(false);
      setChallenges((prev) => prev.map((c) => c.id === active.id ? { ...c, progress: c.target, completed: true } : c));
      toast({ title: "🏆 Challenge Selesai!", description: `Klaim hadiah ${active.reward} koin sekarang!` });
    } else {
      setChallenges((prev) => prev.map((c) => c.id === active.id ? { ...c, progress: newCount } : c));
    }
  }

  function claimReward(c: Challenge) {
    if (!c.completed || c.claimed) return;
    setChallenges((prev) => prev.map((x) => x.id === c.id ? { ...x, claimed: true } : x));
    // Send to global pending bonus log (client-side accumulator)
    try {
      const bonusKey = `dcr-bonus-${visitorId}`;
      const cur = Number(localStorage.getItem(bonusKey) || "0");
      localStorage.setItem(bonusKey, String(cur + c.reward));
    } catch {}
    toast({ title: "💰 Hadiah Diklaim!", description: `+${c.reward} bonus poin telah dicatat di profilmu.` });
    onUpdate?.();
  }

  const totalReward = useMemo(() => challenges.reduce((s, c) => s + (c.claimed ? c.reward : 0), 0), [challenges]);
  const allDone = challenges.every((c) => c.claimed);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-orange-500/15 via-pink-500/15 to-purple-500/15 border-2 border-orange-400/40 p-3 sm:p-4 shadow-2xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-orange-300 animate-pulse" />
          <h3 className="font-bold text-base sm:text-lg bg-gradient-to-r from-orange-200 via-pink-200 to-purple-200 bg-clip-text text-transparent">
            Daily Challenge Rush
          </h3>
          <Badge className="bg-orange-500/40 text-orange-100 border-orange-400/60 text-[9px] h-4 animate-pulse">15s</Badge>
        </div>
        <div className="flex items-center gap-1 text-xs text-amber-300 font-bold">
          <Trophy className="h-3.5 w-3.5" /> {totalReward}
        </div>
      </div>

      {!active && (
        <div className="space-y-2">
          {challenges.map((c) => {
            const pct = (c.progress / c.target) * 100;
            return (
              <motion.div
                key={c.id}
                whileHover={{ scale: 1.01 }}
                className={`rounded-xl bg-gradient-to-r ${c.color} bg-opacity-20 border border-white/20 p-2.5`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="text-2xl">{c.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-xs text-white truncate">{c.title}</p>
                    <p className="text-[10px] text-white/80 truncate">{c.desc}</p>
                  </div>
                  <Badge className="bg-black/40 text-amber-200 text-[9px] h-4 border-amber-400/40">
                    +{c.reward}
                  </Badge>
                </div>
                <Progress value={pct} className="h-1.5 mb-1.5" />
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-white/80">{c.progress}/{c.target}</span>
                  {c.claimed ? (
                    <Badge className="bg-emerald-500/30 text-emerald-100 border-emerald-400/50 text-[9px] h-5">
                      <Star className="h-3 w-3 mr-0.5" /> Diklaim
                    </Badge>
                  ) : c.completed ? (
                    <Button size="sm" onClick={() => claimReward(c)} className="h-6 text-[10px] bg-gradient-to-r from-amber-500 to-orange-500 text-black font-bold px-2">
                      <Sparkles className="h-3 w-3 mr-0.5" /> Klaim
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => startChallenge(c.id)} className="h-6 text-[10px] bg-white/20 hover:bg-white/30 text-white px-2">
                      <Zap className="h-3 w-3 mr-0.5" /> Mulai
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
          {allDone && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-400/40 p-2 text-center"
            >
              <p className="text-xs text-emerald-100 font-bold">✨ Semua challenge hari ini selesai! Kembali besok ya!</p>
            </motion.div>
          )}
        </div>
      )}

      {active && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-sm text-white">{active.icon} {active.title}</p>
              <p className="text-[10px] text-white/70">Target: {active.target} taps</p>
            </div>
            <div className="flex items-center gap-1 text-amber-200 font-bold text-sm">
              <Clock className="h-3.5 w-3.5" /> {timeLeft}s
            </div>
          </div>

          <Progress value={(tapCount / active.target) * 100} className="h-2" />

          <button
            onClick={handleTap}
            disabled={!running}
            className={`relative w-full h-44 rounded-2xl bg-gradient-to-br ${active.color} border-2 border-white/30 shadow-xl overflow-hidden touch-manipulation select-none disabled:opacity-60`}
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.div
                key={tapCount}
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="text-5xl font-black text-white drop-shadow-lg"
              >
                {tapCount}
              </motion.div>
              <p className="text-xs text-white/90 font-bold mt-1">
                {running ? (combo >= 10 ? "🔥 COMBO STREAK!" : "TAP TAP TAP!") : timeLeft <= 0 ? "⏱️ WAKTU HABIS" : "✓ SELESAI!"}
              </p>
            </div>
            <AnimatePresence>
              {floaters.map((f) => (
                <motion.span
                  key={f.id}
                  initial={{ opacity: 1, y: 0, scale: 1 }}
                  animate={{ opacity: 0, y: -40, scale: 1.4 }}
                  transition={{ duration: 0.6 }}
                  style={{ position: "absolute", left: f.x - 10, top: f.y - 10, pointerEvents: "none" }}
                  className="font-black text-yellow-200 text-lg drop-shadow"
                >
                  {f.v}
                </motion.span>
              ))}
            </AnimatePresence>
          </button>

          <div className="flex gap-2">
            <Button onClick={() => { setActiveId(null); setRunning(false); }} variant="outline" className="flex-1 h-8 text-xs border-white/30 text-white bg-black/30">
              Kembali
            </Button>
            {!running && tapCount < active.target && timeLeft <= 0 && (
              <Button onClick={() => startChallenge(active.id)} className="flex-1 h-8 text-xs bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold">
                <Target className="h-3 w-3 mr-1" /> Coba Lagi
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
