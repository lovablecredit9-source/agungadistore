import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints, resetReviveCount } from "./gameStore";
import RevivePrompt from "./RevivePrompt";

const SIZE = 4;
type Board = number[][];

function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function addRandom(b: Board): Board {
  const empties: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (b[r][c] === 0) empties.push([r, c]);
  if (!empties.length) return b;
  const [r, c] = empties[Math.floor(Math.random() * empties.length)];
  const next = b.map((row) => [...row]);
  next[r][c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function init(): Board {
  return addRandom(addRandom(emptyBoard()));
}

function rotate(b: Board): Board {
  const out = emptyBoard();
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) out[c][SIZE - 1 - r] = b[r][c];
  return out;
}

function slideLeft(b: Board): { board: Board; gained: number; moved: boolean } {
  let gained = 0;
  let moved = false;
  const out = b.map((row) => {
    const nz = row.filter((v) => v !== 0);
    for (let i = 0; i < nz.length - 1; i++) {
      if (nz[i] === nz[i + 1]) {
        nz[i] *= 2;
        gained += nz[i];
        nz.splice(i + 1, 1);
      }
    }
    while (nz.length < SIZE) nz.push(0);
    if (!moved && nz.some((v, i) => v !== row[i])) moved = true;
    return nz;
  });
  return { board: out, gained, moved };
}

function move(b: Board, dir: "left" | "right" | "up" | "down"): { board: Board; gained: number; moved: boolean } {
  let work = b;
  let rot = 0;
  if (dir === "up") rot = 1;
  else if (dir === "right") rot = 2;
  else if (dir === "down") rot = 3;
  for (let i = 0; i < rot; i++) work = rotate(work);
  const { board, gained, moved } = slideLeft(work);
  let result = board;
  for (let i = 0; i < (4 - rot) % 4; i++) result = rotate(result);
  return { board: result, gained, moved };
}

function canMove(b: Board): boolean {
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (b[r][c] === 0) return true;
      if (c < SIZE - 1 && b[r][c] === b[r][c + 1]) return true;
      if (r < SIZE - 1 && b[r][c] === b[r + 1][c]) return true;
    }
  return false;
}

const TILE_COLORS: Record<number, string> = {
  0: "bg-amber-100/40",
  2: "bg-amber-100 text-amber-900",
  4: "bg-amber-200 text-amber-900",
  8: "bg-orange-300 text-white",
  16: "bg-orange-400 text-white",
  32: "bg-orange-500 text-white",
  64: "bg-red-500 text-white",
  128: "bg-yellow-400 text-white",
  256: "bg-yellow-500 text-white",
  512: "bg-yellow-600 text-white",
  1024: "bg-amber-600 text-white",
  2048: "bg-gradient-to-br from-yellow-400 to-orange-500 text-white",
};

export default function Game2048() {
  const [board, setBoard] = useState<Board>(init);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => parseInt(localStorage.getItem("2048_best") || "0", 10));
  const [over, setOver] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [won, setWon] = useState(false);
  const awarded = useRef(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const { toast } = useToast();

  const tryMove = useCallback(
    (dir: "left" | "right" | "up" | "down") => {
      if (over || reviving) return;
      const { board: nb, gained, moved } = move(board, dir);
      if (!moved) return;
      const withRand = addRandom(nb);
      setBoard(withRand);
      setScore((s) => {
        const ns = s + gained;
        if (ns > best) {
          setBest(ns);
          localStorage.setItem("2048_best", String(ns));
        }
        return ns;
      });
      if (!won && withRand.some((row) => row.some((v) => v >= 2048))) {
        setWon(true);
        if (!awarded.current) {
          awarded.current = true;
          const { awardedPoints } = awardGamePoints(300);
          toast({ title: "🏆 2048!", description: `+${awardedPoints} poin` });
        }
      }
      if (!canMove(withRand)) {
        setReviving(true);
      }
    },
    [board, over, reviving, won, best, score, toast]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") tryMove("left");
      else if (e.key === "ArrowRight") tryMove("right");
      else if (e.key === "ArrowUp") tryMove("up");
      else if (e.key === "ArrowDown") tryMove("down");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tryMove]);

  const reset = () => {
    resetReviveCount();
    setBoard(init());
    setScore(0);
    setOver(false);
    setReviving(false);
    setWon(false);
    awarded.current = false;
  };

  const finalizeGameOver = () => {
    setOver(true);
    setReviving(false);
    if (!awarded.current) {
      awarded.current = true;
      const { awardedPoints } = awardGamePoints(Math.floor(score / 50) + 20);
      toast({ title: "Game Over", description: `+${awardedPoints} poin · skor ${score}` });
    }
  };

  const revive = () => {
    setBoard(prev => {
      const next = prev.map(row => [...row]);
      const filled: { r: number; c: number; v: number }[] = [];
      next.forEach((row, r) => row.forEach((v, c) => { if (v) filled.push({ r, c, v }); }));
      filled.sort((a, b) => a.v - b.v);
      filled.slice(0, 2).forEach(({ r, c }) => { next[r][c] = 0; });
      return addRandom(next);
    });
    setReviving(false);
    setOver(false);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
    if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? "right" : "left");
    else tryMove(dy > 0 ? "down" : "up");
    touch.current = null;
  };

  return (
    <div className="space-y-3">
      <Card className="p-3 bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-bold text-orange-600">Skor: {score}</span>
            <span className="text-muted-foreground">Best: {best}</span>
          </div>
          <Button size="sm" variant="ghost" onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-1" /> Ulang
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">Geser layar atau pakai panah keyboard</p>
      </Card>

      <div
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className="relative bg-amber-700/20 p-2 rounded-xl select-none touch-none"
      >
        <div className="grid grid-cols-4 gap-2">
          {board.flat().map((v, i) => (
            <motion.div
              key={`${i}-${v}`}
              initial={{ scale: v ? 0.5 : 1 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.15 }}
              className={`aspect-square rounded-lg flex items-center justify-center font-black shadow ${TILE_COLORS[v] || "bg-purple-600 text-white"}`}
              style={{ fontSize: v >= 1024 ? "0.95rem" : v >= 128 ? "1.1rem" : "1.3rem" }}
            >
              {v !== 0 && v}
            </motion.div>
          ))}
        </div>
        <AnimatePresence>
          {reviving ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center p-3"
            >
              <RevivePrompt active={reviving} scoreLabel={`Skor: ${score}`} onRevive={revive} onExpire={finalizeGameOver} />
            </motion.div>
          ) : over && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/60 rounded-xl flex flex-col items-center justify-center text-center"
            >
              <Trophy className="w-10 h-10 text-yellow-400 mb-2" />
              <p className="text-white font-bold">Game Over</p>
              <p className="text-amber-200 text-sm">Skor: {score}</p>
              <Button size="sm" className="mt-3" onClick={reset}>
                Main Lagi
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
