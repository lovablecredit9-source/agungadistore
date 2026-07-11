import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trophy, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints } from "./gameStore";
import RevivePrompt from "./RevivePrompt";

const W = 320, H = 480;
const BLOCK_H = 22;

type Block = { x: number; w: number; color: string };

const COLORS = ["#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#a855f7", "#ec4899"];

export default function StackTowerGame() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("stack_best") || 0));

  const stateRef = useRef({
    stack: [] as Block[],
    moving: null as null | { x: number; w: number; dir: 1 | -1; speed: number; color: string },
    cameraY: 0,
    over: false,
    revivePending: false,
    running: false,
    score: 0,
  });

  const reset = useCallback(() => {
    const baseW = 140;
    stateRef.current = {
      stack: [{ x: (W - baseW) / 2, w: baseW, color: COLORS[0] }],
      moving: { x: 0, w: baseW, dir: 1, speed: 2.4, color: COLORS[1] },
      cameraY: 0, over: false, revivePending: false, running: true, score: 0,
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
    const top = s.stack[s.stack.length - 1];
    const nextColor = COLORS[s.stack.length % COLORS.length];
    s.moving = {
      x: top.x < W / 2 ? W - top.w : 0,
      w: top.w,
      dir: top.x < W / 2 ? -1 : 1,
      speed: Math.min(5.5, 2.4 + s.score * 0.12),
      color: nextColor,
    };
    s.revivePending = false;
    s.over = false;
    s.running = true;
    setReviving(false);
    setOver(false);
    setRunning(true);
  }, []);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0;

    const loop = () => {
      const s = stateRef.current;
      // bg gradient
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#1e1b4b"); g.addColorStop(1, "#0f172a");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      // stars
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      for (let i = 0; i < 30; i++) {
        const sx = (i * 53) % W; const sy = (i * 79 + s.cameraY * 0.3) % H;
        ctx.fillRect(sx, ((sy % H) + H) % H, 1, 1);
      }

      if (s.running && !s.over && !s.revivePending && s.moving) {
        s.moving.x += s.moving.dir * s.moving.speed;
        if (s.moving.x + s.moving.w > W) { s.moving.x = W - s.moving.w; s.moving.dir = -1; }
        if (s.moving.x < 0) { s.moving.x = 0; s.moving.dir = 1; }
      }

      // draw stack with camera shift
      const targetCamera = Math.max(0, s.stack.length * BLOCK_H - H * 0.6);
      s.cameraY += (targetCamera - s.cameraY) * 0.12;

      const baseY = H - 30 + s.cameraY;
      s.stack.forEach((b, i) => {
        const y = baseY - i * BLOCK_H;
        if (y < -BLOCK_H || y > H) return;
        const grd = ctx.createLinearGradient(0, y - BLOCK_H, 0, y);
        grd.addColorStop(0, b.color);
        grd.addColorStop(1, shade(b.color, -25));
        ctx.fillStyle = grd; ctx.fillRect(b.x, y - BLOCK_H, b.w, BLOCK_H);
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.fillRect(b.x, y - BLOCK_H, b.w, 3);
      });

      if (s.moving && s.running && !s.over) {
        const y = baseY - s.stack.length * BLOCK_H;
        const grd = ctx.createLinearGradient(0, y - BLOCK_H, 0, y);
        grd.addColorStop(0, s.moving.color); grd.addColorStop(1, shade(s.moving.color, -25));
        ctx.fillStyle = grd; ctx.fillRect(s.moving.x, y - BLOCK_H, s.moving.w, BLOCK_H);
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(s.moving.x, y - BLOCK_H, s.moving.w, 3);
      }

      // hud
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = "bold 28px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(String(s.score), W / 2, 50);

      if (!s.running && !s.over && !s.revivePending) {
        ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff"; ctx.font = "bold 22px sans-serif";
        ctx.fillText("Tap untuk Mulai", W / 2, H / 2);
        ctx.font = "13px sans-serif";
        ctx.fillText("Tap pada timing yg pas!", W / 2, H / 2 + 26);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!over) return;
    if (stateRef.current.score > best) {
      setBest(stateRef.current.score);
      localStorage.setItem("stack_best", String(stateRef.current.score));
    }
    const { awardedPoints } = awardGamePoints(Math.max(1, stateRef.current.score * 2));
    toast({ title: "Game Over", description: `Tinggi ${stateRef.current.score} · +${awardedPoints} poin` });
  }, [over]);

  const drop = () => {
    const s = stateRef.current;
    if (!s.running) { reset(); return; }
    if (!s.moving || s.over) return;
    const top = s.stack[s.stack.length - 1];
    const left = Math.max(s.moving.x, top.x);
    const right = Math.min(s.moving.x + s.moving.w, top.x + top.w);
    const overlap = right - left;
    if (overlap <= 0) {
      beginRevive();
      return;
    }
    const newBlock: Block = { x: left, w: overlap, color: s.moving.color };
    s.stack.push(newBlock);
    s.score += 1; setScore(s.score);
    const nextColor = COLORS[s.stack.length % COLORS.length];
    s.moving = {
      x: s.stack[s.stack.length - 1].x < W / 2 ? W - overlap : 0,
      w: overlap,
      dir: s.stack[s.stack.length - 1].x < W / 2 ? -1 : 1,
      speed: Math.min(5.5, 2.4 + s.score * 0.12),
      color: nextColor,
    };
    if (overlap < 6) { beginRevive(); }
  };

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Tinggi {score}</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-bold flex items-center gap-1"><Trophy className="w-3 h-3" />{best}</span>
        </div>
        <Button size="sm" variant="outline" onClick={reset}><RotateCcw className="w-3.5 h-3.5" /></Button>
      </div>

      <div className="mx-auto" style={{ maxWidth: W }}>
        <canvas
          ref={canvasRef}
          width={W} height={H}
          onPointerDown={e => { e.preventDefault(); drop(); }}
          className="rounded-lg border border-border w-full touch-none cursor-pointer"
        />
      </div>

      {reviving ? (
        <RevivePrompt active={reviving} scoreLabel={`Tinggi: ${score}`} onRevive={revive} onExpire={finalizeGameOver} />
      ) : over ? (
        <div className="text-center p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="font-bold text-destructive">Tower Runtuh!</p>
          <p className="text-xs text-muted-foreground">Tinggi: {score}</p>
          <Button size="sm" className="mt-2" onClick={reset}><Play className="w-3.5 h-3.5 mr-1" />Main Lagi</Button>
        </div>
      ) : (
        <p className="text-[10px] text-center text-muted-foreground">Tap untuk menjatuhkan blok pas di atas blok bawah 🧱</p>
      )}
    </Card>
  );
}

function shade(hex: string, percent: number): string {
  const f = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((f >> 16) & 0xff) + percent));
  const g = Math.max(0, Math.min(255, ((f >> 8) & 0xff) + percent));
  const b = Math.max(0, Math.min(255, (f & 0xff) + percent));
  return `rgb(${r},${g},${b})`;
}
