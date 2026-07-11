import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trophy, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints } from "./gameStore";
import RevivePrompt from "./RevivePrompt";

const W = 320, H = 480;
const SLICE = 6;

type Slice = { top: number; bot: number };

export default function HelicopterCaveGame() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("heli_best") || 0));
  const heldRef = useRef(false);

  const stateRef = useRef({
    y: H / 2, vy: 0,
    slices: [] as Slice[],
    score: 0,
    over: false,
    running: false,
    revivePending: false,
    t: 0,
    obstacles: [] as { x: number; y: number; h: number }[],
    obsT: 0,
  });

  const initSlices = () => {
    const arr: Slice[] = [];
    let mid = H / 2, gap = 280;
    for (let i = 0; i <= W / SLICE + 4; i++) {
      arr.push({ top: mid - gap / 2, bot: mid + gap / 2 });
    }
    return arr;
  };

  const reset = useCallback(() => {
    stateRef.current = {
      y: H / 2, vy: 0, slices: initSlices(), score: 0, over: false, running: true,
      revivePending: false, t: 0, obstacles: [], obsT: 2000,
    };
    setScore(0); setOver(false); setReviving(false); setRunning(true);
  }, []);

  const beginRevive = useCallback(() => {
    const s = stateRef.current;
    if (s.revivePending || s.over) return;
    s.revivePending = true;
    heldRef.current = false;
    setReviving(true);
    setRunning(false);
  }, []);

  const finalizeGameOver = useCallback(() => {
    const s = stateRef.current;
    s.revivePending = false;
    s.over = true;
    s.running = false;
    heldRef.current = false;
    setReviving(false);
    setOver(true);
    setRunning(false);
  }, []);

  const revive = useCallback(() => {
    const s = stateRef.current;
    const idx = Math.floor(60 / SLICE);
    const sl = s.slices[idx];
    s.y = sl ? (sl.top + sl.bot) / 2 : H / 2;
    s.vy = 0;
    s.obstacles = s.obstacles.filter((o) => o.x < 20 || o.x > 140);
    s.revivePending = false;
    s.over = false;
    s.running = true;
    heldRef.current = false;
    setReviving(false);
    setOver(false);
    setRunning(true);
  }, []);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0; let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(40, now - last); last = now;
      const s = stateRef.current;

      // sky
      const grd = ctx.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, "#0c4a6e"); grd.addColorStop(1, "#082f49");
      ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);

      if (s.running && !s.over && !s.revivePending) {
        s.t += dt;
        // physics
        s.vy += heldRef.current ? -0.35 : 0.42;
        s.vy = Math.max(-6, Math.min(7, s.vy));
        s.y += s.vy;

        // scroll cave
        const speed = 2 + s.t / 12000;
        const last = s.slices[s.slices.length - 1];
        const newMid = (last.top + last.bot) / 2 + (Math.random() - 0.5) * 14;
        const minGap = Math.max(140, 240 - s.t / 60);
        const newGap = Math.max(minGap, last.bot - last.top + (Math.random() - 0.5) * 8);
        const clampedMid = Math.max(newGap / 2 + 20, Math.min(H - newGap / 2 - 20, newMid));
        s.slices.shift();
        s.slices.push({ top: clampedMid - newGap / 2, bot: clampedMid + newGap / 2 });

        s.obsT -= dt;
        if (s.obsT <= 0) {
          const sl = s.slices[Math.floor(s.slices.length / 2)];
          const oy = sl.top + 20 + Math.random() * (sl.bot - sl.top - 60);
          s.obstacles.push({ x: W + 20, y: oy, h: 30 });
          s.obsT = 1500 + Math.random() * 1500;
        }
        s.obstacles.forEach(o => { o.x -= speed; });
        s.obstacles = s.obstacles.filter(o => o.x > -20);

        s.score += dt * 0.02;
        setScore(Math.floor(s.score));

        // collide with cave
        const idx = Math.floor(60 / SLICE);
        const sl = s.slices[idx];
        let crashed = false;
        if (sl && (s.y - 10 < sl.top || s.y + 10 > sl.bot)) { crashed = true; }
        // collide obstacles
        for (const o of s.obstacles) {
          if (Math.abs(o.x - 60) < 20 && Math.abs(o.y - s.y) < o.h / 2 + 12) { crashed = true; break; }
        }
        if (crashed) beginRevive();
      }

      // draw cave
      ctx.fillStyle = "#1e293b";
      s.slices.forEach((sl, i) => {
        const x = i * SLICE;
        ctx.fillRect(x, 0, SLICE, sl.top);
        ctx.fillRect(x, sl.bot, SLICE, H - sl.bot);
      });
      // edge glow
      ctx.fillStyle = "#06b6d4";
      s.slices.forEach((sl, i) => {
        const x = i * SLICE;
        ctx.fillRect(x, sl.top - 2, SLICE, 2);
        ctx.fillRect(x, sl.bot, SLICE, 2);
      });

      // obstacles
      s.obstacles.forEach(o => {
        ctx.fillStyle = "#dc2626"; ctx.shadowColor = "#dc2626"; ctx.shadowBlur = 8;
        ctx.fillRect(o.x - 6, o.y - o.h / 2, 12, o.h);
        ctx.shadowBlur = 0;
      });

      // helicopter
      const y = s.y;
      ctx.save(); ctx.translate(60, y);
      const tilt = Math.max(-0.4, Math.min(0.4, s.vy / 12));
      ctx.rotate(tilt);
      // body
      ctx.fillStyle = "#facc15";
      ctx.beginPath(); ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2); ctx.fill();
      // tail
      ctx.fillRect(-22, -2, 12, 4);
      ctx.fillRect(-24, -6, 4, 8);
      // window
      ctx.fillStyle = "#0ea5e9"; ctx.beginPath(); ctx.arc(4, -1, 5, 0, Math.PI * 2); ctx.fill();
      // skids
      ctx.fillStyle = "#475569"; ctx.fillRect(-10, 9, 20, 2);
      // rotor
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      const rotW = 30 + Math.sin(s.t / 20) * 6;
      ctx.fillRect(-rotW / 2, -12, rotW, 2);
      ctx.restore();

      // hud score
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 22px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(String(Math.floor(s.score)), W / 2, 30);

      if (!s.running && !s.over && !s.revivePending) {
        ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff"; ctx.font = "bold 22px sans-serif";
        ctx.fillText("Tahan untuk Mulai", W / 2, H / 2);
        ctx.font = "13px sans-serif";
        ctx.fillText("Tahan = naik · Lepas = turun", W / 2, H / 2 + 26);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [beginRevive]);

  useEffect(() => {
    if (!over) return;
    const final = stateRef.current.score | 0;
    if (final > best) { setBest(final); localStorage.setItem("heli_best", String(final)); }
    const { awardedPoints } = awardGamePoints(Math.max(1, Math.floor(final / 8)));
    toast({ title: "Game Over", description: `Skor ${final} · +${awardedPoints} poin` });
  }, [over]);

  const onDown = () => {
    if (!stateRef.current.running) { reset(); }
    heldRef.current = true;
  };
  const onUp = () => { heldRef.current = false; };

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === " ") { e.preventDefault(); onDown(); }
    };
    const ku = (e: KeyboardEvent) => { if (e.key === " ") onUp(); };
    window.addEventListener("keydown", k); window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", k); window.removeEventListener("keyup", ku); };
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

      <div className="mx-auto select-none" style={{ maxWidth: W }}>
        <canvas
          ref={canvasRef}
          width={W} height={H}
          onPointerDown={e => { e.preventDefault(); onDown(); }}
          onPointerUp={e => { e.preventDefault(); onUp(); }}
          onPointerLeave={onUp}
          className="rounded-lg border border-border w-full touch-none cursor-pointer"
        />
      </div>

      {reviving ? (
        <RevivePrompt active={reviving} scoreLabel={`Skor: ${score}`} onRevive={revive} onExpire={finalizeGameOver} />
      ) : over ? (
        <div className="text-center p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="font-bold text-destructive">Crashed!</p>
          <p className="text-xs text-muted-foreground">Skor: {score}</p>
          <Button size="sm" className="mt-2" onClick={reset}><Play className="w-3.5 h-3.5 mr-1" />Main Lagi</Button>
        </div>
      ) : (
        <p className="text-[10px] text-center text-muted-foreground">Tahan layar / SPASI agar heli naik 🚁</p>
      )}
    </Card>
  );
}
