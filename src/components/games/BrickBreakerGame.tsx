import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trophy, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints, resetReviveCount } from "./gameStore";
import RevivePrompt from "./RevivePrompt";

const W = 320;
const H = 460;
const PADDLE_W = 70;
const PADDLE_H = 10;
const BALL_R = 7;
const ROWS = 5;
const COLS = 8;
const BRICK_W = 36;
const BRICK_H = 14;
const BRICK_PAD = 4;
const BRICK_OFFSET_TOP = 40;
const BRICK_OFFSET_LEFT = (W - (COLS * (BRICK_W + BRICK_PAD) - BRICK_PAD)) / 2;
const COLORS = ["#ef4444", "#f97316", "#facc15", "#22c55e", "#3b82f6"];

type Brick = { x: number; y: number; alive: boolean; color: string; hp: number };

function makeBricks(): Brick[] {
  const out: Brick[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      out.push({
        x: BRICK_OFFSET_LEFT + c * (BRICK_W + BRICK_PAD),
        y: BRICK_OFFSET_TOP + r * (BRICK_H + BRICK_PAD),
        alive: true,
        color: COLORS[r % COLORS.length],
        hp: 1,
      });
    }
  }
  return out;
}

export default function BrickBreakerGame() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [over, setOver] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [running, setRunning] = useState(false);
  const [won, setWon] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("brick_best") || 0));

  const stateRef = useRef({
    paddleX: W / 2 - PADDLE_W / 2,
    bx: W / 2,
    by: H - 40,
    vx: 2.4,
    vy: -2.8,
    bricks: makeBricks(),
    score: 0,
    lives: 3,
    over: false,
    revivePending: false,
    running: false,
    won: false,
    onPaddle: true,
  });

  const reset = useCallback(() => {
    resetReviveCount();
    stateRef.current = {
      paddleX: W / 2 - PADDLE_W / 2,
      bx: W / 2,
      by: H - 40,
      vx: 2.4 * (Math.random() > 0.5 ? 1 : -1),
      vy: -2.8,
      bricks: makeBricks(),
      score: 0,
      lives: 3,
      over: false,
      revivePending: false,
      running: true,
      won: false,
      onPaddle: true,
    };
    setScore(0);
    setLives(3);
    setOver(false);
    setReviving(false);
    setRunning(true);
    setWon(false);
  }, []);

  const launch = () => {
    if (stateRef.current.revivePending) return;
    if (!stateRef.current.running) {
      reset();
      return;
    }
    if (stateRef.current.onPaddle) stateRef.current.onPaddle = false;
  };

  const beginRevive = useCallback(() => {
    const s = stateRef.current;
    if (s.revivePending || s.over || s.won) return;
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
    s.lives = 1;
    s.onPaddle = true;
    s.bx = s.paddleX + PADDLE_W / 2;
    s.by = H - 20 - PADDLE_H - BALL_R - 1;
    s.vx = 2.4 * (Math.random() > 0.5 ? 1 : -1);
    s.vy = -2.8;
    s.revivePending = false;
    s.over = false;
    s.running = true;
    setLives(1);
    setReviving(false);
    setOver(false);
    setRunning(true);
  }, []);

  const movePaddle = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = W / rect.width;
    const x = (clientX - rect.left) * scale;
    stateRef.current.paddleX = Math.max(0, Math.min(W - PADDLE_W, x - PADDLE_W / 2));
    if (stateRef.current.onPaddle) {
      stateRef.current.bx = stateRef.current.paddleX + PADDLE_W / 2;
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    const loop = () => {
      const s = stateRef.current;

      // bg
      const grd = ctx.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, "#1e1b4b");
      grd.addColorStop(1, "#0f172a");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      if (s.running && !s.over && !s.won && !s.revivePending) {
        if (!s.onPaddle) {
          s.bx += s.vx;
          s.by += s.vy;

          // walls
          if (s.bx - BALL_R < 0) { s.bx = BALL_R; s.vx = Math.abs(s.vx); }
          if (s.bx + BALL_R > W) { s.bx = W - BALL_R; s.vx = -Math.abs(s.vx); }
          if (s.by - BALL_R < 0) { s.by = BALL_R; s.vy = Math.abs(s.vy); }

          // paddle
          if (
            s.by + BALL_R > H - 20 - PADDLE_H &&
            s.by + BALL_R < H - 20 + 4 &&
            s.bx > s.paddleX &&
            s.bx < s.paddleX + PADDLE_W &&
            s.vy > 0
          ) {
            s.vy = -Math.abs(s.vy);
            const hit = (s.bx - (s.paddleX + PADDLE_W / 2)) / (PADDLE_W / 2);
            s.vx = hit * 3.6;
            s.by = H - 20 - PADDLE_H - BALL_R;
          }

          // bottom out
          if (s.by - BALL_R > H) {
            s.lives -= 1;
            setLives(s.lives);
            if (s.lives <= 0) {
              beginRevive();
            } else {
              s.onPaddle = true;
              s.bx = s.paddleX + PADDLE_W / 2;
              s.by = H - 40;
              s.vx = 2.4 * (Math.random() > 0.5 ? 1 : -1);
              s.vy = -2.8;
            }
          }

          // bricks
          for (const b of s.bricks) {
            if (!b.alive) continue;
            if (s.bx + BALL_R > b.x && s.bx - BALL_R < b.x + BRICK_W && s.by + BALL_R > b.y && s.by - BALL_R < b.y + BRICK_H) {
              b.alive = false;
              s.score += 10;
              setScore(s.score);
              // bounce direction
              const prevX = s.bx - s.vx;
              const prevY = s.by - s.vy;
              const wasOutsideX = prevX + BALL_R <= b.x || prevX - BALL_R >= b.x + BRICK_W;
              if (wasOutsideX) s.vx = -s.vx; else s.vy = -s.vy;
              break;
            }
          }

          // win
          if (s.bricks.every(b => !b.alive)) {
            s.won = true;
            s.score += s.lives * 50;
            setScore(s.score);
            setWon(true);
            setOver(true);
            setRunning(false);
          }
        } else {
          s.bx = s.paddleX + PADDLE_W / 2;
          s.by = H - 20 - PADDLE_H - BALL_R - 1;
        }
      }

      // draw bricks
      for (const b of s.bricks) {
        if (!b.alive) continue;
        ctx.fillStyle = b.color;
        ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H);
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(b.x, b.y, BRICK_W, 3);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(b.x, b.y + BRICK_H - 3, BRICK_W, 3);
      }

      // paddle
      const pgrad = ctx.createLinearGradient(s.paddleX, 0, s.paddleX + PADDLE_W, 0);
      pgrad.addColorStop(0, "#f472b6");
      pgrad.addColorStop(1, "#a855f7");
      ctx.fillStyle = pgrad;
      ctx.fillRect(s.paddleX, H - 20 - PADDLE_H, PADDLE_W, PADDLE_H);
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillRect(s.paddleX, H - 20 - PADDLE_H, PADDLE_W, 3);

      // ball
      ctx.beginPath();
      ctx.arc(s.bx, s.by, BALL_R, 0, Math.PI * 2);
      const bg = ctx.createRadialGradient(s.bx - 2, s.by - 2, 1, s.bx, s.by, BALL_R);
      bg.addColorStop(0, "#fef9c3");
      bg.addColorStop(1, "#facc15");
      ctx.fillStyle = bg;
      ctx.fill();

      // HUD
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`♥ ${s.lives}`, 10, 22);
      ctx.textAlign = "right";
      ctx.fillText(`${s.score}`, W - 10, 22);

      if (!s.running && !s.over && !s.revivePending) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 22px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Tap untuk Mulai", W / 2, H / 2);
        ctx.font = "12px sans-serif";
        ctx.fillText("Geser untuk gerakkan paddle", W / 2, H / 2 + 24);
      } else if (s.running && s.onPaddle) {
        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Tap untuk LUNCURKAN", W / 2, H / 2);
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
        localStorage.setItem("brick_best", String(finalScore));
        return finalScore;
      }
      return prev;
    });
    const base = Math.max(1, Math.floor(finalScore / 10));
    const { awardedPoints } = awardGamePoints(base);
    toast({
      title: stateRef.current.won ? "Menang! 🎉" : "Game Over",
      description: `Skor ${finalScore} · +${awardedPoints} poin`,
    });
  }, [over]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (e.key === "ArrowLeft") s.paddleX = Math.max(0, s.paddleX - 18);
      if (e.key === "ArrowRight") s.paddleX = Math.min(W - PADDLE_W, s.paddleX + 18);
      if (e.key === " ") { e.preventDefault(); launch(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Skor {score}</span>
          <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 font-bold">♥ {lives}</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-bold flex items-center gap-1"><Trophy className="w-3 h-3" />{best}</span>
        </div>
        <Button size="sm" variant="outline" onClick={reset}><RotateCcw className="w-3.5 h-3.5" /></Button>
      </div>

      <div className="mx-auto" style={{ maxWidth: W }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={(e) => { e.preventDefault(); movePaddle(e.clientX); launch(); }}
          onPointerMove={(e) => { if (e.buttons > 0 || e.pointerType === "touch") movePaddle(e.clientX); }}
          className="rounded-lg border border-border w-full touch-none cursor-pointer"
          style={{ background: "#0f172a" }}
        />
      </div>

      {reviving ? (
        <RevivePrompt active={reviving} scoreLabel={`Skor: ${score}`} onRevive={revive} onExpire={finalizeGameOver} />
      ) : over ? (
        <div className={`text-center p-3 rounded-lg ${won ? "bg-primary/10 border border-primary/30" : "bg-destructive/10 border border-destructive/30"}`}>
          <p className={`font-bold ${won ? "text-primary" : "text-destructive"}`}>{won ? "Menang! 🎉" : "Game Over"}</p>
          <p className="text-xs text-muted-foreground">Skor: {score}</p>
          <Button size="sm" className="mt-2" onClick={reset}><Play className="w-3.5 h-3.5 mr-1" />Main Lagi</Button>
        </div>
      ) : (
        <p className="text-[10px] text-center text-muted-foreground">Geser jari untuk gerakkan paddle, tap untuk launch 🧱</p>
      )}
    </Card>
  );
}
