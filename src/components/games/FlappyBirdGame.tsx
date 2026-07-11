import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trophy, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints } from "./gameStore";
import RevivePrompt from "./RevivePrompt";

const W = 320;
const H = 480;
const GRAV = 0.45;
const JUMP = -7.2;
const PIPE_W = 56;
const GAP = 130;
const PIPE_SPEED = 2.2;
const SPAWN_MS = 1500;

type Pipe = { x: number; topH: number; passed: boolean };

export default function FlappyBirdGame() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("flappy_best") || 0));

  const stateRef = useRef({
    y: H / 2,
    vy: 0,
    pipes: [] as Pipe[],
    lastSpawn: 0,
    score: 0,
    over: false,
    running: false,
    revivePending: false,
    t: 0,
  });

  const reset = useCallback(() => {
    stateRef.current = { y: H / 2, vy: 0, pipes: [], lastSpawn: 0, score: 0, over: false, running: true, revivePending: false, t: 0 };
    setScore(0);
    setOver(false);
    setReviving(false);
    setRunning(true);
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
    s.y = H / 2;
    s.vy = 0;
    s.pipes = s.pipes.filter((p) => p.x + PIPE_W < 35 || p.x > 125);
    s.revivePending = false;
    s.over = false;
    s.running = true;
    setReviving(false);
    setOver(false);
    setRunning(true);
  }, []);

  const flap = () => {
    if (stateRef.current.revivePending) return;
    if (!stateRef.current.running) {
      reset();
      return;
    }
    if (stateRef.current.over) return;
    stateRef.current.vy = JUMP;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      const s = stateRef.current;

      // sky gradient
      const grd = ctx.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, "#0ea5e9");
      grd.addColorStop(1, "#7dd3fc");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      if (s.running && !s.over && !s.revivePending) {
        s.t += dt;
        s.vy += GRAV;
        s.y += s.vy;

        // spawn pipes
        s.lastSpawn += dt;
        if (s.lastSpawn > SPAWN_MS) {
          s.lastSpawn = 0;
          const topH = 60 + Math.random() * (H - GAP - 160);
          s.pipes.push({ x: W, topH, passed: false });
        }

        // move pipes
        s.pipes.forEach(p => { p.x -= PIPE_SPEED; });
        s.pipes = s.pipes.filter(p => p.x + PIPE_W > 0);

        // collisions
        const bx = 70, by = s.y, br = 14;
        let crashed = by + br > H - 20 || by - br < 0;
        for (const p of s.pipes) {
          if (bx + br > p.x && bx - br < p.x + PIPE_W) {
            if (by - br < p.topH || by + br > p.topH + GAP) crashed = true;
          }
          if (!p.passed && p.x + PIPE_W < bx - br) {
            p.passed = true;
            s.score += 1;
            setScore(s.score);
          }
        }
        if (crashed) beginRevive();
      }

      // draw pipes
      s.pipes.forEach(p => {
        const grad = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
        grad.addColorStop(0, "#16a34a");
        grad.addColorStop(0.5, "#22c55e");
        grad.addColorStop(1, "#15803d");
        ctx.fillStyle = grad;
        ctx.fillRect(p.x, 0, PIPE_W, p.topH);
        ctx.fillRect(p.x, p.topH + GAP, PIPE_W, H - p.topH - GAP - 20);
        ctx.fillStyle = "#166534";
        ctx.fillRect(p.x - 3, p.topH - 14, PIPE_W + 6, 14);
        ctx.fillRect(p.x - 3, p.topH + GAP, PIPE_W + 6, 14);
      });

      // ground
      ctx.fillStyle = "#a16207";
      ctx.fillRect(0, H - 20, W, 20);
      ctx.fillStyle = "#ca8a04";
      for (let i = 0; i < W; i += 12) ctx.fillRect(i, H - 20, 6, 4);

      // bird
      const by = s.y;
      const angle = Math.max(-0.5, Math.min(1.2, s.vy / 12));
      ctx.save();
      ctx.translate(70, by);
      ctx.rotate(angle);
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.moveTo(10, 0); ctx.lineTo(20, -3); ctx.lineTo(20, 3); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(5, -4, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#000";
      ctx.beginPath(); ctx.arc(6, -4, 2, 0, Math.PI * 2); ctx.fill();
      // wing
      ctx.fillStyle = "#eab308";
      ctx.beginPath();
      ctx.ellipse(-3, 3 + Math.sin(s.t / 80) * 2, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // score
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.font = "bold 36px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(s.score), W / 2 + 1, 56);
      ctx.fillStyle = "#fff";
      ctx.fillText(String(s.score), W / 2, 55);

      if (!s.running && !s.over && !s.revivePending) {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 22px sans-serif";
        ctx.fillText("Tap untuk Mulai", W / 2, H / 2);
        ctx.font = "14px sans-serif";
        ctx.fillText("Tap layar / spasi untuk lompat", W / 2, H / 2 + 26);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [beginRevive]);

  // award on game over
  useEffect(() => {
    if (!over) return;
    const finalScore = stateRef.current.score;
    setBest(prev => {
      if (finalScore > prev) {
        localStorage.setItem("flappy_best", String(finalScore));
        return finalScore;
      }
      return prev;
    });
    const base = Math.max(1, finalScore * 2);
    const { awardedPoints } = awardGamePoints(base);
    toast({ title: "Game Over", description: `Skor ${finalScore} · +${awardedPoints} poin` });
  }, [over]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "ArrowUp") { e.preventDefault(); flap(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Skor {score}</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-bold flex items-center gap-1"><Trophy className="w-3 h-3" />{best}</span>
        </div>
        <Button size="sm" variant="outline" onClick={reset}><RotateCcw className="w-3.5 h-3.5" /></Button>
      </div>

      <div className="mx-auto" style={{ maxWidth: W }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={(e) => { e.preventDefault(); flap(); }}
          className="rounded-lg border border-border w-full touch-none cursor-pointer"
          style={{ background: "#7dd3fc" }}
        />
      </div>

      {reviving ? (
        <RevivePrompt active={reviving} scoreLabel={`Skor: ${score}`} onRevive={revive} onExpire={finalizeGameOver} />
      ) : over ? (
        <div className="text-center p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="font-bold text-destructive">Game Over</p>
          <p className="text-xs text-muted-foreground">Skor: {score}</p>
          <Button size="sm" className="mt-2" onClick={reset}><Play className="w-3.5 h-3.5 mr-1" />Main Lagi</Button>
        </div>
      ) : (
        <p className="text-[10px] text-center text-muted-foreground">Tap layar atau tekan SPASI untuk membuat burung lompat 🐦</p>
      )}
    </Card>
  );
}
