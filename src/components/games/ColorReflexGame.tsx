import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trophy, Play, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints } from "./gameStore";
import { motion, AnimatePresence } from "framer-motion";

type ColorKey = "red" | "blue" | "green" | "yellow";

const COLORS: { key: ColorKey; label: string; bg: string; glow: string }[] = [
  { key: "red", label: "MERAH", bg: "bg-red-500", glow: "shadow-red-500/50" },
  { key: "blue", label: "BIRU", bg: "bg-blue-500", glow: "shadow-blue-500/50" },
  { key: "green", label: "HIJAU", bg: "bg-green-500", glow: "shadow-green-500/50" },
  { key: "yellow", label: "KUNING", bg: "bg-yellow-400", glow: "shadow-yellow-400/50" },
];

const COLOR_HEX: Record<ColorKey, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  yellow: "#facc15",
};

const TOTAL_ROUNDS = 20;

type Round = {
  textColor: ColorKey; // arti tulisan
  inkColor: ColorKey; // warna tinta
  matchInk: boolean; // jawaban benar = ink? (true) atau text? (false)
};

function makeRound(): Round {
  const t = COLORS[Math.floor(Math.random() * 4)].key;
  let i = COLORS[Math.floor(Math.random() * 4)].key;
  // bias supaya 60% berbeda untuk lebih sulit
  if (Math.random() < 0.6) {
    while (i === t) i = COLORS[Math.floor(Math.random() * 4)].key;
  }
  return { textColor: t, inkColor: i, matchInk: Math.random() < 0.5 };
}

export default function ColorReflexGame() {
  const { toast } = useToast();
  const [round, setRound] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [over, setOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [current, setCurrent] = useState<Round>(() => makeRound());
  const [feedback, setFeedback] = useState<"ok" | "bad" | null>(null);
  const [timeLeft, setTimeLeft] = useState(2500);
  const [best, setBest] = useState(() => Number(localStorage.getItem("reflex_best") || 0));
  const startRef = useRef(0);
  const tickRef = useRef<number | null>(null);

  const ROUND_MS = 2500;

  const start = useCallback(() => {
    setRound(0);
    setScore(0);
    setStreak(0);
    setOver(false);
    setRunning(true);
    setCurrent(makeRound());
    setFeedback(null);
    setTimeLeft(ROUND_MS);
    startRef.current = performance.now();
  }, []);

  // timer per round
  useEffect(() => {
    if (!running || over) return;
    startRef.current = performance.now();
    setTimeLeft(ROUND_MS);
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const left = ROUND_MS - elapsed;
      if (left <= 0) {
        // miss
        setFeedback("bad");
        setStreak(0);
        setTimeout(() => {
          setFeedback(null);
          if (round + 1 >= TOTAL_ROUNDS) {
            setOver(true);
            setRunning(false);
          } else {
            setRound(r => r + 1);
            setCurrent(makeRound());
          }
        }, 350);
        return;
      }
      setTimeLeft(left);
      tickRef.current = requestAnimationFrame(tick);
    };
    tickRef.current = requestAnimationFrame(tick);
    return () => { if (tickRef.current) cancelAnimationFrame(tickRef.current); };
  }, [running, round, over]);

  const answer = (chosen: ColorKey) => {
    if (!running || over || feedback) return;
    const correct = current.matchInk ? current.inkColor : current.textColor;
    const isOk = chosen === correct;
    if (isOk) {
      const elapsed = performance.now() - startRef.current;
      const speedBonus = Math.max(0, Math.floor((ROUND_MS - elapsed) / 50));
      const newStreak = streak + 1;
      const streakBonus = Math.floor(newStreak / 3) * 5;
      const gain = 10 + speedBonus + streakBonus;
      setScore(s => s + gain);
      setStreak(newStreak);
      setFeedback("ok");
    } else {
      setFeedback("bad");
      setStreak(0);
      setScore(s => Math.max(0, s - 5));
    }
    setTimeout(() => {
      setFeedback(null);
      if (round + 1 >= TOTAL_ROUNDS) {
        setOver(true);
        setRunning(false);
      } else {
        setRound(r => r + 1);
        setCurrent(makeRound());
      }
    }, 250);
  };

  // award on over
  useEffect(() => {
    if (!over) return;
    setBest(prev => {
      if (score > prev) {
        localStorage.setItem("reflex_best", String(score));
        return score;
      }
      return prev;
    });
    const base = Math.max(1, Math.floor(score / 12));
    const { awardedPoints } = awardGamePoints(base);
    toast({ title: "Selesai", description: `Skor ${score} · +${awardedPoints} poin` });
  }, [over]);

  const target = current.matchInk ? "WARNA TULISAN" : "ARTI KATA";
  const pct = (timeLeft / ROUND_MS) * 100;

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Skor {score}</span>
          <span className="px-2 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-600 font-bold flex items-center gap-1"><Zap className="w-3 h-3" />Streak {streak}</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-bold flex items-center gap-1"><Trophy className="w-3 h-3" />{best}</span>
        </div>
        <Button size="sm" variant="outline" onClick={start}><RotateCcw className="w-3.5 h-3.5" /></Button>
      </div>

      {!running && !over && (
        <div className="text-center p-6 rounded-xl bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/10 border border-border space-y-3">
          <h3 className="font-extrabold text-lg">⚡ Color Reflex</h3>
          <div className="text-xs text-muted-foreground space-y-1.5 max-w-xs mx-auto">
            <p>Akan muncul kata seperti <span className="font-bold text-red-500">BIRU</span> (kata "BIRU" tapi warna tinta merah).</p>
            <p>Petunjuk akan minta kamu memilih: <strong>arti kata</strong> atau <strong>warna tinta</strong>.</p>
            <p>Tekan tombol warna yang sesuai sebelum waktu habis. Makin cepat, makin banyak poin!</p>
          </div>
          <Button onClick={start} className="w-full"><Play className="w-4 h-4 mr-1" />Mulai Main</Button>
        </div>
      )}

      {running && !over && (
        <>
          <div className="text-center space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Ronde {round + 1}/{TOTAL_ROUNDS}</span>
              <span className="font-bold text-primary">Pilih: {target}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500 transition-[width] duration-100"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="relative h-32 flex items-center justify-center rounded-xl bg-card border border-border overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${round}-${current.textColor}-${current.inkColor}`}
                initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: "spring", stiffness: 280, damping: 18 }}
                className="font-black text-5xl tracking-wider drop-shadow-lg"
                style={{ color: COLOR_HEX[current.inkColor] }}
              >
                {COLORS.find(c => c.key === current.textColor)!.label}
              </motion.div>
            </AnimatePresence>
            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={{ opacity: 0, scale: 1.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className={`absolute inset-0 flex items-center justify-center font-black text-3xl ${feedback === "ok" ? "text-emerald-500" : "text-rose-500"}`}
                  style={{ background: feedback === "ok" ? "rgba(16,185,129,0.15)" : "rgba(244,63,94,0.15)" }}
                >
                  {feedback === "ok" ? "✓ BENAR" : "✗ SALAH"}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {COLORS.map(c => (
              <motion.button
                key={c.key}
                whileTap={{ scale: 0.92 }}
                onClick={() => answer(c.key)}
                disabled={!!feedback}
                className={`${c.bg} ${c.glow} text-white font-extrabold py-4 rounded-xl shadow-lg disabled:opacity-60 transition-all`}
              >
                {c.label}
              </motion.button>
            ))}
          </div>
        </>
      )}

      {over && (
        <div className="text-center p-4 rounded-lg bg-primary/10 border border-primary/30 space-y-2">
          <p className="font-extrabold text-primary text-lg">Selesai! 🎉</p>
          <p className="text-sm">Skor akhir: <strong>{score}</strong></p>
          <p className="text-xs text-muted-foreground">Streak terbaik: {streak}</p>
          <Button size="sm" className="mt-2" onClick={start}><Play className="w-3.5 h-3.5 mr-1" />Main Lagi</Button>
        </div>
      )}
    </Card>
  );
}
