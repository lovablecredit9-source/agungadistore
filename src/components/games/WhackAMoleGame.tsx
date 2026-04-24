import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Hammer, RotateCcw, Trophy, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints } from "./gameStore";

const HOLES = 9;
const DURATION = 30; // detik

type Cell = { mole: boolean; bomb: boolean; bonus: boolean };

const empty = (): Cell => ({ mole: false, bomb: false, bonus: false });

export default function WhackAMoleGame() {
  const { toast } = useToast();
  const [cells, setCells] = useState<Cell[]>(() => Array.from({ length: HOLES }, empty));
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(DURATION);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("mole_best") || 0));
  const [combo, setCombo] = useState(0);
  const tickRef = useRef<number | null>(null);
  const spawnRef = useRef<number | null>(null);

  const reset = () => {
    setCells(Array.from({ length: HOLES }, empty));
    setScore(0);
    setTime(DURATION);
    setOver(false);
    setRunning(false);
    setCombo(0);
  };

  const start = () => {
    reset();
    setRunning(true);
  };

  // Timer
  useEffect(() => {
    if (!running) return;
    tickRef.current = window.setInterval(() => {
      setTime(t => {
        if (t <= 1) {
          finish();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [running]);

  // Spawner
  useEffect(() => {
    if (!running) return;
    const spawn = () => {
      setCells(prev => {
        const idx = Math.floor(Math.random() * HOLES);
        if (prev[idx].mole || prev[idx].bomb || prev[idx].bonus) return prev;
        const r = Math.random();
        const next = [...prev];
        if (r < 0.15) next[idx] = { mole: false, bomb: true, bonus: false };
        else if (r < 0.28) next[idx] = { mole: false, bomb: false, bonus: true };
        else next[idx] = { mole: true, bomb: false, bonus: false };
        // Auto disappear
        const ttl = 700 + Math.random() * 600;
        setTimeout(() => {
          setCells(p => {
            const c = [...p];
            if (c[idx]?.mole || c[idx]?.bomb || c[idx]?.bonus) {
              c[idx] = empty();
              if (next[idx].mole) setCombo(0);
            }
            return c;
          });
        }, ttl);
        return next;
      });
    };
    const baseDelay = Math.max(280, 600 - (DURATION - time) * 8);
    spawnRef.current = window.setInterval(spawn, baseDelay);
    return () => { if (spawnRef.current) clearInterval(spawnRef.current); };
  }, [running, time]);

  const finish = async () => {
    setRunning(false);
    setOver(true);
    if (tickRef.current) clearInterval(tickRef.current);
    if (spawnRef.current) clearInterval(spawnRef.current);
    setCells(Array.from({ length: HOLES }, empty));
    if (score > best) {
      setBest(score);
      localStorage.setItem("mole_best", String(score));
    }
    const pts = Math.max(5, Math.floor(score / 4));
    const { awardedPoints } = awardGamePoints(pts);
    toast({ title: `🔨 Selesai!`, description: `Skor ${score} · +${awardedPoints} poin` });
  };

  const hit = (idx: number) => {
    if (!running) return;
    const c = cells[idx];
    if (c.bomb) {
      setScore(s => Math.max(0, s - 15));
      setCombo(0);
      setCells(prev => { const n = [...prev]; n[idx] = empty(); return n; });
      toast({ title: "💣 Bom!", description: "-15 poin", variant: "destructive" });
    } else if (c.bonus) {
      const gain = 25;
      setScore(s => s + gain);
      setCells(prev => { const n = [...prev]; n[idx] = empty(); return n; });
    } else if (c.mole) {
      const newCombo = combo + 1;
      setCombo(newCombo);
      const gain = 10 + Math.min(20, newCombo * 2);
      setScore(s => s + gain);
      setCells(prev => { const n = [...prev]; n[idx] = empty(); return n; });
    }
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-emerald-950 via-green-900 to-lime-900 border-emerald-500/40 text-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Hammer className="w-5 h-5 text-amber-300" />
          <h3 className="font-extrabold">Whack-a-Mole</h3>
        </div>
        <div className="text-xs opacity-80">Best: <span className="font-black text-yellow-300">{best}</span></div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-[11px] mb-3">
        <div className="rounded-lg bg-black/30 p-2"><div className="opacity-70">Skor</div><div className="font-black text-base">{score}</div></div>
        <div className="rounded-lg bg-black/30 p-2"><div className="opacity-70">Waktu</div><div className="font-black text-base">{time}s</div></div>
        <div className="rounded-lg bg-black/30 p-2"><div className="opacity-70">Combo</div><div className="font-black text-base text-amber-300">x{combo}</div></div>
      </div>

      <div className="grid grid-cols-3 gap-2 aspect-square max-w-[320px] mx-auto">
        {cells.map((c, i) => (
          <button
            key={i}
            onClick={() => hit(i)}
            disabled={!running}
            className="relative rounded-2xl bg-gradient-to-b from-emerald-700 to-green-900 border-2 border-emerald-500/50 overflow-hidden flex items-center justify-center active:scale-95 transition shadow-inner"
          >
            <div className="absolute inset-x-2 bottom-1 h-2 rounded-full bg-black/40" />
            <AnimatePresence>
              {(c.mole || c.bomb || c.bonus) && (
                <motion.div
                  initial={{ y: 30, scale: 0.8 }}
                  animate={{ y: 0, scale: 1 }}
                  exit={{ y: 30, scale: 0.6, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 18 }}
                  className="text-3xl select-none"
                >
                  {c.bomb ? "💣" : c.bonus ? "⭐" : "🐹"}
                </motion.div>
              )}
            </AnimatePresence>
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        {!running && !over && (
          <Button onClick={start} className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-extrabold">
            <Play className="w-4 h-4 mr-1" /> Mulai
          </Button>
        )}
        {over && (
          <Button onClick={start} className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white font-extrabold">
            <RotateCcw className="w-4 h-4 mr-1" /> Main Lagi
          </Button>
        )}
      </div>

      {over && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl bg-black/40 p-3 text-center">
          <Trophy className="w-6 h-6 text-yellow-300 mx-auto mb-1" />
          <div className="font-black text-lg">Skor Akhir: {score}</div>
          <div className="text-xs opacity-80">{score > best ? "🎉 Rekor baru!" : `Best: ${best}`}</div>
        </motion.div>
      )}

      <p className="mt-3 text-[10px] opacity-70 text-center">🐹 +10 · ⭐ +25 · 💣 -15 · combo bonus!</p>
    </Card>
  );
}
