import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trophy, Pause, Play, ArrowLeft, ArrowRight, ArrowDown, RotateCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints, resetReviveCount } from "./gameStore";
import RevivePrompt from "./RevivePrompt";

const COLS = 10;
const ROWS = 18;

type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
type Board = Cell[][];

const COLORS: string[] = [
  "transparent",
  "#22d3ee", // I cyan
  "#3b82f6", // J blue
  "#f97316", // L orange
  "#facc15", // O yellow
  "#22c55e", // S green
  "#a855f7", // T purple
  "#ef4444", // Z red
];

const SHAPES: number[][][][] = [
  [], // 0 empty
  [[[1,1,1,1]]], // I
  [[[1,0,0],[1,1,1]]], // J
  [[[0,0,1],[1,1,1]]], // L
  [[[1,1],[1,1]]], // O
  [[[0,1,1],[1,1,0]]], // S
  [[[0,1,0],[1,1,1]]], // T
  [[[1,1,0],[0,1,1]]], // Z
];

function rotateMat(m: number[][]): number[][] {
  const R = m.length, C = m[0].length;
  const out = Array.from({ length: C }, () => Array(R).fill(0));
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) out[c][R - 1 - r] = m[r][c];
  return out;
}

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0)) as Board;
}

function randomPiece() {
  const t = (Math.floor(Math.random() * 7) + 1) as Cell;
  return { type: t, shape: SHAPES[t][0].map(r => [...r]), x: 3, y: 0 };
}

function collide(board: Board, shape: number[][], x: number, y: number) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = x + c, ny = y + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

export default function TetrisNeonGame() {
  const { toast } = useToast();
  const [board, setBoard] = useState<Board>(emptyBoard());
  const [piece, setPiece] = useState(randomPiece());
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [level, setLevel] = useState(1);
  const [over, setOver] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [paused, setPaused] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("tetris_best") || 0));
  const tickRef = useRef<number | null>(null);
  const stateRef = useRef({ board, piece, over, paused, level });
  stateRef.current = { board, piece, over, paused, level };

  const reset = useCallback(() => {
    resetReviveCount();
    setBoard(emptyBoard());
    setPiece(randomPiece());
    setScore(0);
    setLines(0);
    setLevel(1);
    setOver(false);
    setReviving(false);
    setPaused(false);
  }, []);

  const beginRevive = useCallback(() => {
    setPaused(true);
    setReviving(true);
  }, []);

  const finalizeGameOver = useCallback(() => {
    setReviving(false);
    setPaused(false);
    setOver(true);
  }, []);

  const revive = useCallback(() => {
    setBoard(prev => prev.map((row, idx) => idx < 3 ? Array(COLS).fill(0) as Cell[] : [...row]) as Board);
    setPiece(randomPiece());
    setReviving(false);
    setPaused(false);
    setOver(false);
  }, []);

  const merge = (b: Board, p: typeof piece): Board => {
    const out = b.map(r => [...r]) as Board;
    p.shape.forEach((row, r) => row.forEach((v, c) => {
      if (v && p.y + r >= 0) out[p.y + r][p.x + c] = p.type;
    }));
    return out;
  };

  const clearLines = (b: Board): { board: Board; cleared: number } => {
    const kept = b.filter(r => r.some(v => !v));
    const cleared = ROWS - kept.length;
    const newRows = Array.from({ length: cleared }, () => Array(COLS).fill(0)) as Board;
    return { board: [...newRows, ...kept] as Board, cleared };
  };

  const drop = useCallback(() => {
    const { board: b, piece: p, over: ov, paused: pa } = stateRef.current;
    if (ov || pa) return;
    if (!collide(b, p.shape, p.x, p.y + 1)) {
      setPiece({ ...p, y: p.y + 1 });
      return;
    }
    // lock
    const merged = merge(b, p);
    const { board: cleared, cleared: lc } = clearLines(merged);
    if (lc > 0) {
      const pts = [0, 40, 100, 300, 1200][lc] * level;
      setScore(s => s + pts);
      setLines(l => {
        const nl = l + lc;
        const newLevel = Math.floor(nl / 8) + 1;
        if (newLevel !== stateRef.current.level) setLevel(newLevel);
        return nl;
      });
    }
    const next = randomPiece();
    if (collide(cleared, next.shape, next.x, next.y)) {
      setBoard(cleared);
      beginRevive();
      return;
    }
    setBoard(cleared);
    setPiece(next);
  }, [level, beginRevive]);

  const move = (dx: number) => {
    const { board: b, piece: p, over: ov, paused: pa } = stateRef.current;
    if (ov || pa || reviving) return;
    if (!collide(b, p.shape, p.x + dx, p.y)) setPiece({ ...p, x: p.x + dx });
  };

  const rotate = () => {
    const { board: b, piece: p, over: ov, paused: pa } = stateRef.current;
    if (ov || pa || reviving) return;
    const ns = rotateMat(p.shape);
    let nx = p.x;
    if (collide(b, ns, nx, p.y)) {
      if (!collide(b, ns, nx - 1, p.y)) nx--;
      else if (!collide(b, ns, nx + 1, p.y)) nx++;
      else return;
    }
    setPiece({ ...p, shape: ns, x: nx });
  };

  const hardDrop = () => {
    const { board: b, piece: p, over: ov, paused: pa } = stateRef.current;
    if (ov || pa || reviving) return;
    let ny = p.y;
    while (!collide(b, p.shape, p.x, ny + 1)) ny++;
    setPiece({ ...p, y: ny });
    setTimeout(drop, 0);
  };

  // game loop
  useEffect(() => {
    if (over || paused || reviving) return;
    const speed = Math.max(120, 700 - (level - 1) * 60);
    tickRef.current = window.setInterval(drop, speed);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [over, paused, reviving, level, drop]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") move(-1);
      else if (e.key === "ArrowRight") move(1);
      else if (e.key === "ArrowDown") drop();
      else if (e.key === "ArrowUp") rotate();
      else if (e.key === " ") { e.preventDefault(); hardDrop(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drop]);

  // game over reward
  useEffect(() => {
    if (!over) return;
    if (score > best) {
      setBest(score);
      localStorage.setItem("tetris_best", String(score));
    }
    const base = Math.max(1, Math.floor(score / 100));
    const { awardedPoints } = awardGamePoints(base);
    toast({ title: "Game Over", description: `Skor ${score} · +${awardedPoints} poin` });
  }, [over]);

  // render board with active piece
  const display = board.map(r => [...r]) as Board;
  piece.shape.forEach((row, r) => row.forEach((v, c) => {
    if (v && piece.y + r >= 0 && piece.y + r < ROWS) display[piece.y + r][piece.x + c] = piece.type;
  }));

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Skor {score}</span>
          <span className="px-2 py-0.5 rounded-full bg-muted font-semibold">Lv {level}</span>
          <span className="px-2 py-0.5 rounded-full bg-muted">Lines {lines}</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-bold flex items-center gap-1"><Trophy className="w-3 h-3" />{best}</span>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setPaused(p => !p)} disabled={over || reviving}>
            {paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </Button>
          <Button size="sm" variant="outline" onClick={reset}><RotateCcw className="w-3.5 h-3.5" /></Button>
        </div>
      </div>

      <div className="mx-auto bg-background rounded-lg p-2 border border-border" style={{ maxWidth: 320 }}>
        <div className="grid gap-px bg-border rounded" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
          {display.flat().map((cell, i) => (
            <div
              key={i}
              className="aspect-square rounded-[2px]"
              style={{
                background: cell ? COLORS[cell] : "hsl(var(--muted))",
                boxShadow: cell ? `0 0 6px ${COLORS[cell]}, inset 0 0 4px rgba(255,255,255,0.3)` : "none",
              }}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto">
        <Button size="sm" variant="secondary" onClick={() => move(-1)} disabled={over || paused || reviving}><ArrowLeft className="w-4 h-4" /></Button>
        <Button size="sm" variant="secondary" onClick={rotate} disabled={over || paused || reviving}><RotateCw className="w-4 h-4" /></Button>
        <Button size="sm" variant="secondary" onClick={() => move(1)} disabled={over || paused || reviving}><ArrowRight className="w-4 h-4" /></Button>
        <Button size="sm" variant="secondary" onClick={hardDrop} disabled={over || paused || reviving}><ArrowDown className="w-4 h-4" /></Button>
      </div>

      {reviving ? (
        <RevivePrompt active={reviving} scoreLabel={`Skor akhir: ${score}`} onRevive={revive} onExpire={finalizeGameOver} />
      ) : over && (
        <div className="text-center p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="font-bold text-destructive">Game Over</p>
          <p className="text-xs text-muted-foreground">Skor akhir: {score}</p>
          <Button size="sm" className="mt-2" onClick={reset}>Main Lagi</Button>
        </div>
      )}
    </Card>
  );
}
