import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Music2, RotateCcw, Trophy, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints } from "./gameStore";

const LANES = 4;
const DURATION = 40; // detik
const NOTE_TRAVEL_MS = 1600;

interface Note {
  id: number;
  lane: number;
  spawnAt: number; // performance.now()
}

const LANE_COLORS = [
  "from-pink-500 to-rose-600",
  "from-cyan-400 to-blue-600",
  "from-amber-400 to-orange-600",
  "from-emerald-400 to-green-600",
];

export default function TapBeatGame() {
  const { toast } = useToast();
  const [notes, setNotes] = useState<Note[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [time, setTime] = useState(DURATION);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("beat_best") || 0));
  const [feedback, setFeedback] = useState<{ text: string; color: string; key: number } | null>(null);
  const noteIdRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const spawnRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const [, force] = useState(0);

  const reset = () => {
    setNotes([]);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setTime(DURATION);
    setOver(false);
    setRunning(false);
  };

  const start = () => {
    reset();
    setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    tickRef.current = window.setInterval(() => {
      setTime(t => {
        if (t <= 1) { finish(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const baseDelay = 700;
    spawnRef.current = window.setInterval(() => {
      const lane = Math.floor(Math.random() * LANES);
      noteIdRef.current += 1;
      setNotes(prev => [...prev, { id: noteIdRef.current, lane, spawnAt: performance.now() }]);
    }, baseDelay);
    return () => { if (spawnRef.current) clearInterval(spawnRef.current); };
  }, [running]);

  // RAF for animation + miss detection
  useEffect(() => {
    if (!running) return;
    const loop = () => {
      const now = performance.now();
      setNotes(prev => {
        const remaining: Note[] = [];
        let missed = 0;
        for (const n of prev) {
          if (now - n.spawnAt > NOTE_TRAVEL_MS + 250) {
            missed += 1;
          } else {
            remaining.push(n);
          }
        }
        if (missed > 0) {
          setCombo(0);
          setFeedback({ text: "MISS", color: "text-red-400", key: Date.now() });
        }
        return remaining;
      });
      force(x => x + 1);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [running]);

  const finish = async () => {
    setRunning(false);
    setOver(true);
    if (tickRef.current) clearInterval(tickRef.current);
    if (spawnRef.current) clearInterval(spawnRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (score > best) {
      setBest(score);
      localStorage.setItem("beat_best", String(score));
    }
    const pts = Math.max(5, Math.floor(score / 8));
    const { awardedPoints } = awardGamePoints(pts);
    toast({ title: `🎵 Selesai!`, description: `Skor ${score} · combo max ${maxCombo} · +${awardedPoints} poin` });
  };

  const tap = (lane: number) => {
    if (!running) return;
    const now = performance.now();
    // Cari note di lane tersebut yg paling dekat zona hit
    let bestIdx = -1;
    let bestDist = Infinity;
    notes.forEach((n, i) => {
      if (n.lane !== lane) return;
      const progress = (now - n.spawnAt) / NOTE_TRAVEL_MS;
      const dist = Math.abs(progress - 1);
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    });
    if (bestIdx === -1 || bestDist > 0.2) {
      // Miss tap
      setCombo(0);
      setFeedback({ text: "MISS", color: "text-red-400", key: Date.now() });
      return;
    }
    const note = notes[bestIdx];
    setNotes(prev => prev.filter((_, i) => i !== bestIdx));
    let gain = 10;
    let label = "GOOD";
    let color = "text-cyan-300";
    if (bestDist < 0.05) { gain = 30; label = "PERFECT"; color = "text-yellow-300"; }
    else if (bestDist < 0.12) { gain = 20; label = "GREAT"; color = "text-emerald-300"; }
    const newCombo = combo + 1;
    setCombo(newCombo);
    setMaxCombo(m => Math.max(m, newCombo));
    const bonus = Math.floor(newCombo / 5) * 5;
    setScore(s => s + gain + bonus);
    setFeedback({ text: label, color, key: Date.now() });
    void note;
  };

  const now = performance.now();

  return (
    <Card className="p-4 bg-gradient-to-br from-fuchsia-950 via-purple-950 to-indigo-950 border-fuchsia-500/40 text-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Music2 className="w-5 h-5 text-pink-300" />
          <h3 className="font-extrabold">Tap Tap Beat</h3>
        </div>
        <div className="text-xs opacity-80">Best: <span className="font-black text-yellow-300">{best}</span></div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-[11px] mb-3">
        <div className="rounded-lg bg-black/30 p-2"><div className="opacity-70">Skor</div><div className="font-black text-base">{score}</div></div>
        <div className="rounded-lg bg-black/30 p-2"><div className="opacity-70">Waktu</div><div className="font-black text-base">{time}s</div></div>
        <div className="rounded-lg bg-black/30 p-2"><div className="opacity-70">Combo</div><div className="font-black text-base text-pink-300">x{combo}</div></div>
      </div>

      <div className="relative mx-auto rounded-2xl overflow-hidden bg-black/50 border border-white/10" style={{ width: "100%", maxWidth: 320, height: 360 }}>
        {/* Lanes */}
        <div className="absolute inset-0 grid grid-cols-4 gap-0">
          {Array.from({ length: LANES }).map((_, i) => (
            <div key={i} className="border-x border-white/5" />
          ))}
        </div>

        {/* Hit zone */}
        <div className="absolute left-0 right-0 h-12 bottom-12 bg-white/10 border-y-2 border-white/40" />

        {/* Notes */}
        {notes.map(n => {
          const progress = Math.min(1.05, (now - n.spawnAt) / NOTE_TRAVEL_MS);
          const top = progress * (360 - 60); // 360 height - hit area top
          const laneW = 320 / LANES;
          return (
            <div
              key={n.id}
              className={`absolute rounded-xl bg-gradient-to-b ${LANE_COLORS[n.lane]} shadow-lg`}
              style={{
                left: n.lane * laneW + 6,
                width: laneW - 12,
                height: 36,
                top: top - 18,
              }}
            />
          );
        })}

        {/* Feedback */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              key={feedback.key}
              initial={{ opacity: 0, scale: 0.6, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className={`absolute inset-x-0 top-1/3 text-center font-black text-2xl ${feedback.color} drop-shadow-lg`}
            >
              {feedback.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tap zones */}
        <div className="absolute left-0 right-0 bottom-0 h-12 grid grid-cols-4">
          {Array.from({ length: LANES }).map((_, i) => (
            <button
              key={i}
              onClick={() => tap(i)}
              className={`bg-gradient-to-t ${LANE_COLORS[i]} opacity-60 hover:opacity-100 active:opacity-100 active:scale-95 transition border border-white/30`}
            />
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {!running && !over && (
          <Button onClick={start} className="flex-1 bg-gradient-to-r from-pink-500 to-fuchsia-600 text-white font-extrabold">
            <Play className="w-4 h-4 mr-1" /> Mulai
          </Button>
        )}
        {over && (
          <Button onClick={start} className="flex-1 bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white font-extrabold">
            <RotateCcw className="w-4 h-4 mr-1" /> Main Lagi
          </Button>
        )}
      </div>

      {over && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl bg-black/40 p-3 text-center">
          <Trophy className="w-6 h-6 text-yellow-300 mx-auto mb-1" />
          <div className="font-black text-lg">Skor Akhir: {score}</div>
          <div className="text-xs opacity-80">Combo Max: {maxCombo} · {score > best ? "🎉 Rekor baru!" : `Best: ${best}`}</div>
        </motion.div>
      )}

      <p className="mt-3 text-[10px] opacity-70 text-center">PERFECT +30 · GREAT +20 · GOOD +10 · combo +5 tiap 5 hit!</p>
    </Card>
  );
}
