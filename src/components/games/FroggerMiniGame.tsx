import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trophy, Play, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints } from "./gameStore";
import RevivePrompt from "./RevivePrompt";

const COLS = 7, ROWS = 9;
const CELL = 40;
const W = COLS * CELL, H = ROWS * CELL;

type Car = { x: number; lane: number; vx: number; w: number; color: string };

const COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#a855f7", "#ec4899"];

export default function FroggerMiniGame() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("frogger_best") || 0));

  const stateRef = useRef({
    fx: Math.floor(COLS / 2),
    fy: ROWS - 1,
    cars: [] as Car[],
    score: 0,
    level: 1,
    over: false,
    revivePending: false,
    running: false,
    t: 0,
    hop: 0, hopFrom: { x: 0, y: 0 },
  });

  const buildCars = (level: number): Car[] => {
    const cars: Car[] = [];
    // road lanes: rows 1..7 (rows 0 = goal, 8 = start)
    for (let lane = 1; lane <= ROWS - 2; lane++) {
      if (lane === Math.floor(ROWS / 2)) continue; // safe row middle
      const dir = lane % 2 === 0 ? 1 : -1;
      const speed = (0.6 + level * 0.15 + Math.random() * 0.4) * dir;
      const count = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < count; i++) {
        cars.push({
          x: (i * (W / count)) + Math.random() * 40,
          lane,
          vx: speed,
          w: 50 + Math.random() * 20,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        });
      }
    }
    return cars;
  };

  const reset = useCallback(() => {
    stateRef.current = {
      fx: Math.floor(COLS / 2), fy: ROWS - 1,
      cars: buildCars(1), score: 0, level: 1, over: false, revivePending: false, running: true, t: 0,
      hop: 0, hopFrom: { x: 0, y: 0 },
    };
    setScore(0); setOver(false); setReviving(false); setRunning(true);
  }, []);

  const beginRevive = useCallback(() => {
    const s = stateRef.current;
    if (s.revivePending || s.over) return;
    s.revivePending = true;
    setReviving(true);
    setRunning(false);
  }, []);

  const finalizeGameOver = useCallback(() => {
    const s = stateRef.current;
    s.revivePending = false;
    s.over = true;
    s.running = false;
    setReviving(false);
    setOver(true);
    setRunning(false);
  }, []);

  const revive = useCallback(() => {
    const s = stateRef.current;
    s.fx = Math.floor(COLS / 2);
    s.fy = ROWS - 1;
    s.hop = 0;
    s.hopFrom = { x: s.fx, y: s.fy };
    s.revivePending = false;
    s.over = false;
    s.running = true;
    setReviving(false);
    setOver(false);
    setRunning(true);
  }, []);

  const move = (dx: number, dy: number) => {
    const s = stateRef.current;
    if (!s.running || s.over || s.revivePending || s.hop > 0) return;
    const nx = Math.max(0, Math.min(COLS - 1, s.fx + dx));
    const ny = Math.max(0, Math.min(ROWS - 1, s.fy + dy));
    if (nx === s.fx && ny === s.fy) return;
    s.hopFrom = { x: s.fx, y: s.fy };
    s.fx = nx; s.fy = ny; s.hop = 140;
    if (ny === 0) {
      // reached goal
      s.score += 10 + s.level * 2; setScore(s.score);
      s.level += 1;
      s.fx = Math.floor(COLS / 2); s.fy = ROWS - 1;
      s.cars = buildCars(s.level);
    }
  };

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0; let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(40, now - last); last = now;
      const s = stateRef.current;

      // bg
      ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, W, H);

      // rows
      for (let r = 0; r < ROWS; r++) {
        if (r === 0) { ctx.fillStyle = "#15803d"; }
        else if (r === ROWS - 1) { ctx.fillStyle = "#166534"; }
        else if (r === Math.floor(ROWS / 2)) { ctx.fillStyle = "#166534"; }
        else { ctx.fillStyle = "#1f2937"; }
        ctx.fillRect(0, r * CELL, W, CELL);
        // road dashes
        if (r > 0 && r < ROWS - 1 && r !== Math.floor(ROWS / 2)) {
          ctx.fillStyle = "rgba(250,204,21,0.6)";
          for (let i = 0; i < W; i += 18) ctx.fillRect(i, r * CELL + CELL - 2, 10, 2);
        }
      }

      // goal markers
      ctx.fillStyle = "rgba(255,255,255,0.2)";
      for (let i = 0; i < COLS; i++) {
        ctx.fillRect(i * CELL + 4, 4, CELL - 8, CELL - 8);
      }

      if (s.running && !s.over && !s.revivePending) {
        s.t += dt;
        s.hop = Math.max(0, s.hop - dt);
        s.cars.forEach(car => {
          car.x += car.vx * dt * 0.06;
          if (car.vx > 0 && car.x > W + 30) car.x = -car.w - 10;
          if (car.vx < 0 && car.x < -car.w - 30) car.x = W + 10;
        });
        // collision
        const fxPx = s.fx * CELL + CELL / 2;
        const fyPx = s.fy * CELL + CELL / 2;
        for (const car of s.cars) {
          if (car.lane !== s.fy) continue;
          const cyPx = car.lane * CELL + CELL / 2;
          if (Math.abs(cyPx - fyPx) < CELL / 2 && fxPx > car.x - 4 && fxPx < car.x + car.w + 4) {
            beginRevive(); break;
          }
        }
      }

      // cars
      s.cars.forEach(car => {
        const y = car.lane * CELL + 6;
        ctx.fillStyle = car.color;
        ctx.shadowColor = car.color; ctx.shadowBlur = 6;
        roundRect(ctx, car.x, y, car.w, CELL - 12, 6);
        ctx.fill();
        ctx.shadowBlur = 0;
        // windows
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(car.x + (car.vx > 0 ? car.w - 16 : 6), y + 4, 10, CELL - 20);
      });

      // frog
      const t = 1 - s.hop / 140;
      const fx = (s.hopFrom.x + (s.fx - s.hopFrom.x) * t) * CELL + CELL / 2;
      const fy = (s.hopFrom.y + (s.fy - s.hopFrom.y) * t) * CELL + CELL / 2;
      const lift = Math.sin(t * Math.PI) * 8;
      ctx.save(); ctx.translate(fx, fy - lift);
      ctx.fillStyle = "#22c55e"; ctx.shadowColor = "#22c55e"; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.ellipse(0, 0, 14, 12, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      // eyes
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(-5, -7, 4, 0, Math.PI * 2); ctx.arc(5, -7, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#000"; ctx.beginPath(); ctx.arc(-5, -7, 2, 0, Math.PI * 2); ctx.arc(5, -7, 2, 0, Math.PI * 2); ctx.fill();
      // legs
      ctx.fillStyle = "#16a34a";
      ctx.beginPath(); ctx.ellipse(-12, 4, 5, 3, 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(12, 4, 5, 3, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      if (!s.running && !s.over && !s.revivePending) {
        ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff"; ctx.font = "bold 22px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("Tap untuk Mulai", W / 2, H / 2);
        ctx.font = "13px sans-serif";
        ctx.fillText("Hindari mobil, capai tepi atas 🐸", W / 2, H / 2 + 26);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [beginRevive]);

  useEffect(() => {
    if (!over) return;
    const final = stateRef.current.score;
    if (final > best) { setBest(final); localStorage.setItem("frogger_best", String(final)); }
    const { awardedPoints } = awardGamePoints(Math.max(2, Math.floor(final / 3)));
    toast({ title: "Game Over", description: `Skor ${final} · +${awardedPoints} poin` });
  }, [over]);

  // keyboard + swipe
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") { e.preventDefault(); move(0, -1); }
      else if (e.key === "ArrowDown") { e.preventDefault(); move(0, 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); move(-1, 0); }
      else if (e.key === "ArrowRight") { e.preventDefault(); move(1, 0); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const swipeRef = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault();
    if (!stateRef.current.running && !stateRef.current.over && !stateRef.current.revivePending) { reset(); return; }
    swipeRef.current = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: React.PointerEvent) => {
    if (!swipeRef.current) return;
    const dx = e.clientX - swipeRef.current.x;
    const dy = e.clientY - swipeRef.current.y;
    swipeRef.current = null;
    if (Math.abs(dx) < 12 && Math.abs(dy) < 12) { move(0, -1); return; }
    if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : -1, 0);
    else move(0, dy > 0 ? 1 : -1);
  };

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Skor {score}</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-bold">Lvl {stateRef.current.level}</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-bold flex items-center gap-1"><Trophy className="w-3 h-3" />{best}</span>
        </div>
        <Button size="sm" variant="outline" onClick={reset}><RotateCcw className="w-3.5 h-3.5" /></Button>
      </div>

      <div className="mx-auto" style={{ maxWidth: W }}>
        <canvas
          ref={canvasRef}
          width={W} height={H}
          onPointerDown={onDown}
          onPointerUp={onUp}
          className="rounded-lg border border-border w-full touch-none cursor-pointer"
        />
      </div>

      {/* on-screen controls */}
      <div className="grid grid-cols-3 gap-1.5 max-w-[180px] mx-auto">
        <div />
        <Button size="sm" variant="outline" onClick={() => move(0, -1)}><ArrowUp className="w-4 h-4" /></Button>
        <div />
        <Button size="sm" variant="outline" onClick={() => move(-1, 0)}><ArrowLeft className="w-4 h-4" /></Button>
        <Button size="sm" variant="outline" onClick={() => move(0, 1)}><ArrowDown className="w-4 h-4" /></Button>
        <Button size="sm" variant="outline" onClick={() => move(1, 0)}><ArrowRight className="w-4 h-4" /></Button>
      </div>

      {reviving ? (
        <RevivePrompt active={reviving} scoreLabel={`Skor: ${score}`} onRevive={revive} onExpire={finalizeGameOver} />
      ) : over ? (
        <div className="text-center p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="font-bold text-destructive">Tertabrak!</p>
          <p className="text-xs text-muted-foreground">Skor: {score}</p>
          <Button size="sm" className="mt-2" onClick={reset}><Play className="w-3.5 h-3.5 mr-1" />Main Lagi</Button>
        </div>
      ) : (
        <p className="text-[10px] text-center text-muted-foreground">Swipe / panah untuk hop · capai tepi atas 🐸</p>
      )}
    </Card>
  );
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
}
