import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints, resetReviveCount } from "./gameStore";
import RevivePrompt from "./RevivePrompt";

const COLS = 8;
const ROWS = 10;
const COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#facc15", "#a855f7"];
type Grid = (number | null)[][];

function makeGrid(): Grid {
  const g: Grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < COLS; c++) {
      g[r][c] = Math.floor(Math.random() * COLORS.length);
    }
  }
  return g;
}

function neighbors(r: number, c: number): [number, number][] {
  const odd = r % 2 === 1;
  const list: [number, number][] = [
    [r, c - 1], [r, c + 1],
    [r - 1, odd ? c : c - 1], [r - 1, odd ? c + 1 : c],
    [r + 1, odd ? c : c - 1], [r + 1, odd ? c + 1 : c],
  ];
  return list.filter(([nr, nc]) => nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS);
}

function findCluster(g: Grid, r: number, c: number, color: number): [number, number][] {
  const stack: [number, number][] = [[r, c]];
  const visited = new Set<string>();
  const cluster: [number, number][] = [];
  while (stack.length) {
    const [cr, cc] = stack.pop()!;
    const key = `${cr},${cc}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (g[cr][cc] !== color) continue;
    cluster.push([cr, cc]);
    neighbors(cr, cc).forEach(n => stack.push(n));
  }
  return cluster;
}

function findFloating(g: Grid): [number, number][] {
  const connected = new Set<string>();
  const stack: [number, number][] = [];
  for (let c = 0; c < COLS; c++) if (g[0][c] !== null) stack.push([0, c]);
  while (stack.length) {
    const [r, c] = stack.pop()!;
    const key = `${r},${c}`;
    if (connected.has(key)) continue;
    if (g[r][c] === null) continue;
    connected.add(key);
    neighbors(r, c).forEach(n => stack.push(n));
  }
  const floating: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (g[r][c] !== null && !connected.has(`${r},${c}`)) floating.push([r, c]);
  }
  return floating;
}

export default function BubbleShooterGame() {
  const { toast } = useToast();
  const [grid, setGrid] = useState<Grid>(makeGrid);
  const [score, setScore] = useState(0);
  const [shots, setShots] = useState(20);
  const [over, setOver] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [current, setCurrent] = useState(() => Math.floor(Math.random() * COLORS.length));
  const [next, setNext] = useState(() => Math.floor(Math.random() * COLORS.length));
  const [best, setBest] = useState(() => Number(localStorage.getItem("bubble_best") || 0));
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);

  const reset = useCallback(() => {
    resetReviveCount();
    setGrid(makeGrid());
    setScore(0);
    setShots(20);
    setOver(false);
    setReviving(false);
    setCurrent(Math.floor(Math.random() * COLORS.length));
    setNext(Math.floor(Math.random() * COLORS.length));
  }, []);

  const handleClick = (r: number, c: number) => {
    if (over || reviving) return;
    if (grid[r][c] !== null) return;
    // Check has neighbor with bubble or top row
    const hasNeighbor = r === 0 || neighbors(r, c).some(([nr, nc]) => grid[nr][nc] !== null);
    if (!hasNeighbor) return;

    const ng = grid.map(row => [...row]) as Grid;
    ng[r][c] = current;
    const cluster = findCluster(ng, r, c, current);
    let gained = 0;
    if (cluster.length >= 3) {
      cluster.forEach(([cr, cc]) => { ng[cr][cc] = null; });
      gained += cluster.length * 10;
      const floating = findFloating(ng);
      floating.forEach(([cr, cc]) => { ng[cr][cc] = null; });
      gained += floating.length * 20;
    }
    const ns = shots - 1;
    const empty = ng.every(row => row.every(v => v === null));
    let bonus = 0;
    if (empty) {
      bonus = ns * 50;
      toast({ title: "Bersih! 🎉", description: `Bonus +${bonus} dari sisa peluru` });
    }
    const finalScore = score + gained + bonus;

    setGrid(ng);
    setScore(finalScore);
    setCurrent(next);
    setNext(Math.floor(Math.random() * COLORS.length));
    setShots(ns);

    if (empty) {
      setOver(true);
    } else if (ns <= 0) {
      setReviving(true);
    }
  };

  const finalizeGameOver = useCallback(() => {
    setReviving(false);
    setOver(true);
  }, []);

  const revive = useCallback(() => {
    setShots(5);
    setReviving(false);
    setOver(false);
  }, []);

  useEffect(() => {
    if (!over) return;
    if (score > best) { setBest(score); localStorage.setItem("bubble_best", String(score)); }
    const base = Math.max(1, Math.floor(score / 80));
    const { awardedPoints } = awardGamePoints(base);
    toast({ title: "Selesai", description: `Skor ${score} · +${awardedPoints} poin` });
  }, [over]);

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Skor {score}</span>
          <span className="px-2 py-0.5 rounded-full bg-muted font-semibold">Peluru {shots}</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-bold flex items-center gap-1"><Trophy className="w-3 h-3" />{best}</span>
        </div>
        <Button size="sm" variant="outline" onClick={reset}><RotateCcw className="w-3.5 h-3.5" /></Button>
      </div>

      <div className="bg-background rounded-lg p-2 border border-border max-w-sm mx-auto">
        {grid.map((row, r) => (
          <div key={r} className="flex" style={{ marginLeft: r % 2 === 1 ? "5%" : 0, marginTop: r === 0 ? 0 : -4 }}>
            {row.map((cell, c) => {
              const isEmpty = cell === null;
              const canPlace = isEmpty && (r === 0 || neighbors(r, c).some(([nr, nc]) => grid[nr][nc] !== null));
              return (
                <button
                  key={c}
                  onClick={() => handleClick(r, c)}
                  onMouseEnter={() => setHover({ r, c })}
                  onMouseLeave={() => setHover(null)}
                  disabled={over || reviving || !canPlace}
                  className="rounded-full m-0.5 transition-transform active:scale-90"
                  style={{
                    width: "11%",
                    aspectRatio: "1/1",
                    background: cell !== null ? COLORS[cell] : (canPlace ? "hsl(var(--muted))" : "transparent"),
                    boxShadow: cell !== null ? `0 0 8px ${COLORS[cell]}, inset -2px -2px 4px rgba(0,0,0,0.3), inset 2px 2px 4px rgba(255,255,255,0.4)` : "none",
                    opacity: canPlace && hover?.r === r && hover?.c === c ? 0.6 : 1,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3 pt-1">
        <div className="text-xs text-muted-foreground">Tembak:</div>
        <div className="w-9 h-9 rounded-full" style={{ background: COLORS[current], boxShadow: `0 0 10px ${COLORS[current]}` }} />
        <div className="text-xs text-muted-foreground">Berikut:</div>
        <div className="w-7 h-7 rounded-full opacity-70" style={{ background: COLORS[next] }} />
      </div>
      <p className="text-[10px] text-center text-muted-foreground">Klik sel kosong yang bersentuhan untuk menempatkan bola. Cocokkan 3+ warna sama.</p>

      {reviving ? (
        <RevivePrompt active={reviving} scoreLabel={`Skor: ${score}`} onRevive={revive} onExpire={finalizeGameOver} />
      ) : over && (
        <div className="text-center p-3 rounded-lg bg-primary/10 border border-primary/30">
          <p className="font-bold">Permainan Selesai</p>
          <p className="text-xs text-muted-foreground">Skor: {score}</p>
          <Button size="sm" className="mt-2" onClick={reset}>Main Lagi</Button>
        </div>
      )}
    </Card>
  );
}
