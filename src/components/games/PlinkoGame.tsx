import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, Play, RotateCcw, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints } from "./gameStore";

const ROWS = 9;
const SLOTS = ROWS + 1; // 10
const MULTIPLIERS = [10, 4, 2, 1, 0.5, 0.5, 1, 2, 4, 10];
const SLOT_COLORS = [
  "bg-rose-500", "bg-orange-500", "bg-amber-400", "bg-emerald-500", "bg-cyan-500",
  "bg-cyan-500", "bg-emerald-500", "bg-amber-400", "bg-orange-500", "bg-rose-500",
];

export default function PlinkoGame() {
  const [chips, setChips] = useState(50);
  const [bet, setBet] = useState(5);
  const [dropping, setDropping] = useState(false);
  const [ballPath, setBallPath] = useState<{ x: number; y: number }[]>([]);
  const [resultSlot, setResultSlot] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const animRef = useRef<number | null>(null);
  const { toast } = useToast();

  const drop = useCallback(() => {
    if (dropping) return;
    if (chips < bet) {
      toast({ title: "Chip habis", description: "Reset untuk dapat chip lagi", variant: "destructive" });
      return;
    }
    setDropping(true);
    setChips((c) => c - bet);
    setResultSlot(null);

    // simulate path
    let pos = ROWS / 2; // start centered (in slot units)
    const path: { x: number; y: number }[] = [{ x: pos, y: 0 }];
    for (let r = 1; r <= ROWS; r++) {
      pos += Math.random() < 0.5 ? -0.5 : 0.5;
      path.push({ x: pos, y: r });
    }
    const slotIdx = Math.max(0, Math.min(SLOTS - 1, Math.round(path[path.length - 1].x)));
    setBallPath(path);

    // animate step by step
    let step = 0;
    const interval = window.setInterval(() => {
      step++;
      if (step >= path.length) {
        window.clearInterval(interval);
        setResultSlot(slotIdx);
        const mult = MULTIPLIERS[slotIdx];
        const won = Math.round(bet * mult);
        setChips((c) => c + won);
        setHistory((h) => [mult, ...h].slice(0, 6));
        const points = Math.max(5, Math.round(bet * mult * 2));
        const { awardedPoints } = awardGamePoints(points);
        toast({
          title: mult >= 2 ? "🎉 Beruntung!" : mult >= 1 ? "Lumayan" : "Kurang beruntung",
          description: `${mult}x · +${won} chip · +${awardedPoints} poin`,
        });
        setDropping(false);
      }
    }, 120);
    animRef.current = interval;
  }, [dropping, chips, bet, toast]);

  useEffect(() => () => { if (animRef.current) window.clearInterval(animRef.current); }, []);

  const reset = () => {
    setChips(50);
    setHistory([]);
    setResultSlot(null);
    setBallPath([]);
  };

  // current ball position (last in path so far based on slow render)
  const currentBall = ballPath[ballPath.length - 1];

  return (
    <div className="space-y-3">
      <Card className="p-3 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="font-black">{chips}</span>
            <span className="text-xs text-muted-foreground">chip</span>
          </div>
          <Button size="sm" variant="ghost" onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-1" /> Reset
          </Button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs text-muted-foreground">Taruhan:</span>
          {[1, 5, 10].map((b) => (
            <Button
              key={b}
              size="sm"
              variant={bet === b ? "default" : "outline"}
              className="h-7 text-xs px-2"
              onClick={() => setBet(b)}
              disabled={dropping}
            >
              {b}
            </Button>
          ))}
          <Button size="sm" className="ml-auto h-7" onClick={drop} disabled={dropping || chips < bet}>
            <Play className="w-3.5 h-3.5 mr-1" /> Drop
          </Button>
        </div>
      </Card>

      <div
        className="relative mx-auto bg-gradient-to-b from-slate-900 to-purple-950 rounded-xl p-3 border-2 border-purple-500/40 overflow-hidden"
        style={{ aspectRatio: `${SLOTS}/${ROWS + 2.5}` }}
      >
        {/* pegs */}
        <div className="absolute inset-3 bottom-10">
          {Array.from({ length: ROWS }).map((_, r) => {
            const pegs = r + 2;
            return (
              <div
                key={r}
                className="absolute w-full flex justify-around"
                style={{ top: `${(r / (ROWS - 1)) * 100}%` }}
              >
                {Array.from({ length: pegs }).map((_, c) => (
                  <div key={c} className="w-1.5 h-1.5 rounded-full bg-pink-300/70 shadow-[0_0_4px_#f9a8d4]" />
                ))}
              </div>
            );
          })}
          {/* ball */}
          {currentBall && (
            <motion.div
              className="absolute w-3 h-3 rounded-full bg-yellow-300 shadow-[0_0_10px_#fde047] -translate-x-1/2 -translate-y-1/2"
              animate={{
                left: `${(currentBall.x / (SLOTS - 1)) * 100}%`,
                top: `${(currentBall.y / ROWS) * 100}%`,
              }}
              transition={{ duration: 0.12, ease: "easeIn" }}
            />
          )}
        </div>

        {/* slots */}
        <div className="absolute bottom-0 left-0 right-0 flex h-9 px-2 gap-0.5">
          {MULTIPLIERS.map((m, i) => (
            <div
              key={i}
              className={`flex-1 ${SLOT_COLORS[i]} ${resultSlot === i ? "ring-2 ring-white animate-pulse" : ""} flex items-center justify-center text-[10px] font-black text-white rounded-t-md`}
            >
              {m}x
            </div>
          ))}
        </div>
      </div>

      {history.length > 0 && (
        <Card className="p-2 flex items-center gap-1.5 flex-wrap">
          <Trophy className="w-3.5 h-3.5 text-amber-500" />
          <span className="text-[10px] text-muted-foreground mr-1">Riwayat:</span>
          {history.map((m, i) => (
            <span
              key={i}
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                m >= 4 ? "bg-rose-500 text-white" : m >= 2 ? "bg-amber-500 text-white" : m >= 1 ? "bg-emerald-500 text-white" : "bg-muted text-foreground"
              }`}
            >
              {m}x
            </span>
          ))}
        </Card>
      )}
    </div>
  );
}
