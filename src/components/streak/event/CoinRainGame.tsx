import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props { visitorId: string; onUpdate?: () => void }

interface Drop { id: number; x: number; type: "coin" | "gem" | "bomb" }

function todayKey() { return new Date(Date.now() + 7 * 3600_000).toISOString().split("T")[0]; }
const DURATION = 15;

export default function CoinRainGame({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [playing, setPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(DURATION);
  const [drops, setDrops] = useState<Drop[]>([]);
  const [played, setPlayed] = useState(false);
  const idRef = useRef(0);

  useEffect(() => {
    if (!visitorId) return;
    try { setPlayed(localStorage.getItem(`coinrain_${visitorId}_${todayKey()}`) === "1"); } catch { /* noop */ }
  }, [visitorId]);

  useEffect(() => {
    if (!playing) return;
    const tickT = setInterval(() => setTime(t => Math.max(0, t - 1)), 1000);
    const tickD = setInterval(() => {
      const id = ++idRef.current;
      const r = Math.random();
      const type: Drop["type"] = r < 0.7 ? "coin" : r < 0.9 ? "gem" : "bomb";
      setDrops(d => [...d, { id, x: Math.random() * 85, type }]);
      setTimeout(() => setDrops(d => d.filter(x => x.id !== id)), 2200);
    }, 350);
    return () => { clearInterval(tickT); clearInterval(tickD); };
  }, [playing]);

  useEffect(() => {
    if (playing && time === 0) finish();
    // eslint-disable-next-line
  }, [time, playing]);

  function tap(d: Drop) {
    setDrops(arr => arr.filter(x => x.id !== d.id));
    if (d.type === "coin") setScore(s => s + 1);
    else if (d.type === "gem") setScore(s => s + 5);
    else setScore(s => Math.max(0, s - 3));
  }

  async function finish() {
    setPlaying(false);
    setPlayed(true);
    try { localStorage.setItem(`coinrain_${visitorId}_${todayKey()}`, "1"); } catch { /* noop */ }
    const reward = Math.min(50, Math.floor(score / 2));
    if (reward > 0 && visitorId) {
      try {
        const { data: s } = await supabase.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
        if (s) await supabase.from("daily_streaks").update({ streak_coins: (s.streak_coins || 0) + reward }).eq("id", s.id);
        onUpdate?.();
      } catch { /* noop */ }
    }
    toast({ title: `🎮 Skor ${score}`, description: `+${reward} streak koin!` });
  }

  function start() {
    if (played) return;
    setScore(0); setTime(DURATION); setDrops([]); setPlaying(true);
  }

  return (
    <div className="cyber-card rounded-2xl p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Coins className="w-4 h-4 text-yellow-300" strokeWidth={2.5} />
        <span className="text-[11px] font-black tracking-widest uppercase neon-text-yellow">Coin Rain</span>
        <span className="ml-auto text-[10px] font-black text-white/70 tabular-nums">{playing ? `⏱ ${time}d` : "15 detik"}</span>
      </div>
      <div className="relative h-44 rounded-xl bg-gradient-to-b from-indigo-950 to-purple-950 border border-purple-400/30 overflow-hidden mb-2">
        {!playing && !played && (
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 text-center">
            <p className="text-[10px] text-white/70 px-3">Tap koin 🪙 (+1) & gem 💎 (+5)<br/>Hindari bom 💣 (-3)</p>
            <Button onClick={start} size="sm" className="h-7 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-black text-[10px]">
              <Play className="w-3 h-3 mr-1" /> MULAI
            </Button>
          </div>
        )}
        {played && !playing && (
          <div className="absolute inset-0 flex items-center justify-center text-center">
            <p className="text-[10px] font-black text-emerald-300">✓ Sudah main hari ini<br/><span className="text-white/60 text-[9px]">Skor terakhir: {score}</span></p>
          </div>
        )}
        <AnimatePresence>
          {drops.map(d => (
            <motion.button
              key={d.id}
              initial={{ y: -30, opacity: 0 }}
              animate={{ y: 180, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 2.2, ease: "linear" }}
              onClick={() => tap(d)}
              className="absolute text-2xl select-none"
              style={{ left: `${d.x}%` }}
            >
              {d.type === "coin" ? "🪙" : d.type === "gem" ? "💎" : "💣"}
            </motion.button>
          ))}
        </AnimatePresence>
        {playing && (
          <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between text-[10px] font-black">
            <span className="text-yellow-300">Skor: {score}</span>
            <span className="text-cyan-300">{time}d</span>
          </div>
        )}
      </div>
    </div>
  );
}
