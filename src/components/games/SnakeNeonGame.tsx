import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, Play, Pause, RotateCcw, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints } from "./gameStore";
import RevivePrompt from "./RevivePrompt";

const COLS = 15;
const ROWS = 18;
type Dir = "up" | "down" | "left" | "right";
type Cell = { x: number; y: number };

const opposite: Record<Dir, Dir> = { up: "down", down: "up", left: "right", right: "left" };

function randomFood(snake: Cell[]): Cell {
  while (true) {
    const c = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    if (!snake.some((s) => s.x === c.x && s.y === c.y)) return c;
  }
}

export default function SnakeNeonGame() {
  const [snake, setSnake] = useState<Cell[]>([{ x: 7, y: 9 }, { x: 6, y: 9 }, { x: 5, y: 9 }]);
  const [food, setFood] = useState<Cell>({ x: 10, y: 9 });
  const [dir, setDir] = useState<Dir>("right");
  const [pendingDir, setPendingDir] = useState<Dir>("right");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => parseInt(localStorage.getItem("snake_best") || "0", 10));
  const [running, setRunning] = useState(true);
  const [over, setOver] = useState(false);
  const [reviving, setReviving] = useState(false);
  const tick = useRef<number | null>(null);
  const { toast } = useToast();

  const turn = useCallback((d: Dir) => {
    setPendingDir((cur) => (opposite[cur] === d ? cur : d));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") turn("up");
      else if (e.key === "ArrowDown") turn("down");
      else if (e.key === "ArrowLeft") turn("left");
      else if (e.key === "ArrowRight") turn("right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  useEffect(() => {
    if (!running || over || reviving) return;
    const speed = Math.max(80, 180 - Math.min(score * 2, 100));
    tick.current = window.setInterval(() => {
      setSnake((cur) => {
        const nextDir = pendingDir;
        setDir(nextDir);
        const head = { ...cur[0] };
        if (nextDir === "up") head.y -= 1;
        if (nextDir === "down") head.y += 1;
        if (nextDir === "left") head.x -= 1;
        if (nextDir === "right") head.x += 1;
        if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
          gameOver(cur.length);
          return cur;
        }
        if (cur.some((s) => s.x === head.x && s.y === head.y)) {
          gameOver(cur.length);
          return cur;
        }
        const ate = head.x === food.x && head.y === food.y;
        const next = [head, ...cur];
        if (!ate) next.pop();
        else {
          setScore((s) => s + 1);
          setFood(randomFood(next));
        }
        return next;
      });
    }, speed);
    return () => {
      if (tick.current) window.clearInterval(tick.current);
    };
  }, [running, over, reviving, pendingDir, food, score]);

  const gameOver = (len: number) => {
    if (reviving || over) return;
    setReviving(true);
    setRunning(false);
  };

  const finalizeGameOver = (len: number = snake.length) => {
    setOver(true);
    setRunning(false);
    setReviving(false);
    const pts = Math.max(10, (len - 3) * 6);
    const { awardedPoints } = awardGamePoints(pts);
    const newBest = Math.max(best, len - 3);
    if (newBest !== best) {
      setBest(newBest);
      localStorage.setItem("snake_best", String(newBest));
    }
    toast({
      title: "💥 Game Over",
      description: `+${awardedPoints} poin · skor ${len - 3}`,
    });
  };

  const revive = () => {
    const len = Math.min(Math.max(3, snake.length), COLS - 2);
    const nextSnake = Array.from({ length: len }, (_, i) => ({ x: 7 - i, y: 9 }));
    setSnake(nextSnake);
    setFood(randomFood(nextSnake));
    setDir("right");
    setPendingDir("right");
    setReviving(false);
    setOver(false);
    setRunning(true);
  };

  const reset = () => {
    setSnake([{ x: 7, y: 9 }, { x: 6, y: 9 }, { x: 5, y: 9 }]);
    setFood({ x: 10, y: 9 });
    setDir("right");
    setPendingDir("right");
    setScore(0);
    setRunning(true);
    setOver(false);
    setReviving(false);
  };

  return (
    <div className="space-y-3">
      <Card className="p-3 bg-gradient-to-br from-cyan-500/10 to-fuchsia-500/10 border-cyan-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-bold text-cyan-500">Skor: {score}</span>
            <span className="text-muted-foreground">Best: {best}</span>
          </div>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => setRunning((r) => !r)} disabled={over || reviving}>
              {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      <div
        className="relative mx-auto rounded-xl overflow-hidden bg-slate-950 border-2 border-cyan-500/40"
        style={{
          width: "100%",
          aspectRatio: `${COLS}/${ROWS}`,
          backgroundImage:
            "linear-gradient(rgba(6,182,212,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,.08) 1px, transparent 1px)",
          backgroundSize: `${100 / COLS}% ${100 / ROWS}%`,
        }}
      >
        {snake.map((s, i) => (
          <div
            key={i}
            className="absolute rounded-sm"
            style={{
              left: `${(s.x / COLS) * 100}%`,
              top: `${(s.y / ROWS) * 100}%`,
              width: `${100 / COLS}%`,
              height: `${100 / ROWS}%`,
              background: i === 0 ? "#22d3ee" : "#0891b2",
              boxShadow: i === 0 ? "0 0 12px #22d3ee" : "0 0 4px #0891b2",
            }}
          />
        ))}
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="absolute rounded-full"
          style={{
            left: `${(food.x / COLS) * 100}%`,
            top: `${(food.y / ROWS) * 100}%`,
            width: `${100 / COLS}%`,
            height: `${100 / ROWS}%`,
            background: "#f0abfc",
            boxShadow: "0 0 14px #f0abfc",
          }}
        />
        {reviving ? (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
            <RevivePrompt active={reviving} scoreLabel={`Skor: ${score}`} onRevive={revive} onExpire={() => finalizeGameOver(snake.length)} />
          </div>
        ) : over && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-center p-4">
            <Trophy className="w-10 h-10 text-yellow-400 mb-2" />
            <p className="text-white font-bold text-lg">Game Over</p>
            <p className="text-cyan-300 text-sm mt-1">Skor: {score}</p>
            <Button size="sm" className="mt-3" onClick={reset}>
              Main Lagi
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-1.5 mt-2 select-none">
        <Button size="icon" variant="outline" className="h-11 w-11" onTouchStart={() => turn("up")} onClick={() => turn("up")}>
          <ChevronUp className="w-5 h-5" />
        </Button>
        <div className="flex gap-1.5">
          <Button size="icon" variant="outline" className="h-11 w-11" onTouchStart={() => turn("left")} onClick={() => turn("left")}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button size="icon" variant="outline" className="h-11 w-11" onTouchStart={() => turn("down")} onClick={() => turn("down")}>
            <ChevronDown className="w-5 h-5" />
          </Button>
          <Button size="icon" variant="outline" className="h-11 w-11" onTouchStart={() => turn("right")} onClick={() => turn("right")}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
