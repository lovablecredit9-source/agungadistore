import { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Rocket, RotateCcw, Trophy, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints, resetReviveCount } from "./gameStore";
import RevivePrompt from "./RevivePrompt";

const W = 320;
const H = 460;
const PLAYER_W = 28;
const PLAYER_H = 28;
const GRAVITY = 0.35;
const JUMP_V = -9;
const MOVE_SPEED = 4;
const PLAT_W = 60;
const PLAT_H = 10;
const PLAT_COUNT = 8;

type Plat = { x: number; y: number; type: "normal" | "spring" | "moving"; dir?: number; alive: boolean };

function rand(min: number, max: number) { return Math.random() * (max - min) + min; }

function makePlats(): Plat[] {
  const out: Plat[] = [];
  for (let i = 0; i < PLAT_COUNT; i++) {
    const r = Math.random();
    out.push({
      x: rand(10, W - PLAT_W - 10),
      y: H - 40 - i * (H / PLAT_COUNT),
      type: r < 0.1 ? "spring" : r < 0.25 ? "moving" : "normal",
      dir: Math.random() < 0.5 ? -1 : 1,
      alive: true,
    });
  }
  return out;
}

export default function SkyJumperGame() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("jump_best") || 0));
  const stateRef = useRef({
    px: W / 2 - PLAYER_W / 2,
    py: H - 100,
    vx: 0,
    vy: 0,
    plats: makePlats(),
    height: 0,
    revivePending: false,
  });
  const keysRef = useRef({ left: false, right: false });
  const tiltRef = useRef(0);

  const reset = () => {
    resetReviveCount();
    stateRef.current = {
      px: W / 2 - PLAYER_W / 2,
      py: H - 100,
      vx: 0,
      vy: JUMP_V,
      plats: makePlats(),
      height: 0,
      revivePending: false,
    };
    setScore(0);
    setOver(false);
    setReviving(false);
    setRunning(false);
  };

  const start = () => {
    resetReviveCount();
    reset();
    setRunning(true);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent, down: boolean) => {
      if (e.key === "ArrowLeft" || e.key === "a") keysRef.current.left = down;
      if (e.key === "ArrowRight" || e.key === "d") keysRef.current.right = down;
    };
    const kd = (e: KeyboardEvent) => handleKey(e, true);
    const ku = (e: KeyboardEvent) => handleKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  const beginRevive = useCallback(() => {
    const s = stateRef.current;
    if (s.revivePending || over) return;
    s.revivePending = true;
    setRunning(false);
    setReviving(true);
  }, [over]);

  const finalizeGameOver = useCallback(() => {
    const s = stateRef.current;
    s.revivePending = false;
    setRunning(false);
    setOver(true);
    setReviving(false);
    const final = Math.floor(s.height / 10);
    setScore(final);
    if (final > best) {
      setBest(final);
      localStorage.setItem("jump_best", String(final));
    }
    const pts = Math.max(5, Math.floor(final / 6));
    const { awardedPoints } = awardGamePoints(pts);
    toast({ title: `🚀 Game Over!`, description: `Tinggi ${final}m · +${awardedPoints} poin` });
  }, [best, toast]);

  const revive = useCallback(() => {
    const s = stateRef.current;
    s.px = W / 2 - PLAYER_W / 2;
    s.py = H - 105;
    s.vx = 0;
    s.vy = JUMP_V;
    s.plats[0] = { x: W / 2 - PLAT_W / 2, y: H - 45, type: "normal", dir: 1, alive: true };
    s.revivePending = false;
    setOver(false);
    setReviving(false);
    setRunning(true);
  }, []);

  useEffect(() => {
    if (!running) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let lastT = performance.now();

    const tick = () => {
      const s = stateRef.current;
      const dt = Math.min(2, (performance.now() - lastT) / 16);
      lastT = performance.now();

      // Input
      const dirInput = (keysRef.current.right ? 1 : 0) - (keysRef.current.left ? 1 : 0) + tiltRef.current;
      s.vx = dirInput * MOVE_SPEED;
      s.px += s.vx * dt;

      // Wrap horizontally
      if (s.px < -PLAYER_W) s.px = W;
      if (s.px > W) s.px = -PLAYER_W;

      // Gravity
      s.vy += GRAVITY * dt;
      s.py += s.vy * dt;

      // Scroll up when above middle
      const mid = H / 2.5;
      if (s.py < mid) {
        const diff = mid - s.py;
        s.py = mid;
        s.height += diff;
        s.plats.forEach(p => { p.y += diff; });
        setScore(Math.floor(s.height / 10));
      }

      // Move platforms
      s.plats.forEach(p => {
        if (p.type === "moving" && p.alive) {
          p.x += (p.dir || 1) * 1.2 * dt;
          if (p.x < 5 || p.x > W - PLAT_W - 5) p.dir = (p.dir || 1) * -1;
        }
        if (p.y > H) {
          // recycle to top
          p.x = rand(10, W - PLAT_W - 10);
          p.y = rand(-20, 0);
          const r = Math.random();
          p.type = r < 0.12 ? "spring" : r < 0.32 ? "moving" : "normal";
          p.dir = Math.random() < 0.5 ? -1 : 1;
          p.alive = true;
        }
      });

      // Collision (only when falling)
      if (s.vy > 0) {
        for (const p of s.plats) {
          if (!p.alive) continue;
          if (
            s.px + PLAYER_W > p.x &&
            s.px < p.x + PLAT_W &&
            s.py + PLAYER_H > p.y &&
            s.py + PLAYER_H < p.y + PLAT_H + 8
          ) {
            s.vy = p.type === "spring" ? JUMP_V * 1.7 : JUMP_V;
            break;
          }
        }
      }

      // Game over
      if (s.py > H) {
        beginRevive();
        return;
      }

      // Render
      ctx.clearRect(0, 0, W, H);
      // background gradient
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#1e3a8a");
      g.addColorStop(1, "#0f172a");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // stars
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      for (let i = 0; i < 30; i++) {
        const sx = (i * 53) % W;
        const sy = (i * 89 + Math.floor(s.height) * 0.3) % H;
        ctx.fillRect(sx, sy, 2, 2);
      }
      // platforms
      for (const p of s.plats) {
        if (!p.alive) continue;
        ctx.fillStyle = p.type === "spring" ? "#f59e0b" : p.type === "moving" ? "#22d3ee" : "#22c55e";
        ctx.fillRect(p.x, p.y, PLAT_W, PLAT_H);
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.fillRect(p.x, p.y, PLAT_W, 2);
      }
      // player (astronaut blob)
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(s.px + PLAYER_W / 2, s.py + PLAYER_H / 2, PLAYER_W / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#1e3a8a";
      ctx.beginPath();
      ctx.arc(s.px + PLAYER_W / 2, s.py + PLAYER_H / 2 - 2, PLAYER_W / 3, 0, Math.PI * 2);
      ctx.fill();

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, beginRevive]);

  // Touch controls
  const press = (dir: -1 | 0 | 1) => {
    if (dir === -1) { keysRef.current.left = true; keysRef.current.right = false; }
    else if (dir === 1) { keysRef.current.right = true; keysRef.current.left = false; }
    else { keysRef.current.left = false; keysRef.current.right = false; }
  };

  return (
    <Card className="p-4 bg-gradient-to-br from-blue-950 via-indigo-950 to-slate-950 border-blue-500/40 text-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Rocket className="w-5 h-5 text-cyan-300" />
          <h3 className="font-extrabold">Sky Jumper</h3>
        </div>
        <div className="text-xs opacity-80">Best: <span className="font-black text-yellow-300">{best}m</span></div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center text-[11px] mb-3">
        <div className="rounded-lg bg-black/30 p-2"><div className="opacity-70">Tinggi</div><div className="font-black text-base">{score}m</div></div>
        <div className="rounded-lg bg-black/30 p-2"><div className="opacity-70">Best</div><div className="font-black text-base text-yellow-300">{best}m</div></div>
      </div>

      <div className="relative mx-auto rounded-2xl overflow-hidden border border-white/10" style={{ width: W, height: H }}>
        <canvas ref={canvasRef} width={W} height={H} className="block" />
        {!running && !over && !reviving && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <Button onClick={start} className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-extrabold">
              <Play className="w-4 h-4 mr-1" /> Mulai Lompat
            </Button>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 gap-2 mt-3 select-none">
        <button
          onPointerDown={() => press(-1)}
          onPointerUp={() => press(0)}
          onPointerLeave={() => press(0)}
          className="py-3 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10 text-2xl font-black active:scale-95"
        >◀</button>
        <button
          onPointerDown={() => press(1)}
          onPointerUp={() => press(0)}
          onPointerLeave={() => press(0)}
          className="py-3 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-white/10 text-2xl font-black active:scale-95"
        >▶</button>
      </div>

      {reviving ? (
        <div className="mt-3">
          <RevivePrompt active={reviving} scoreLabel={`Tinggi: ${score}m`} onRevive={revive} onExpire={finalizeGameOver} />
        </div>
      ) : over && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl bg-black/40 p-3 text-center">
          <Trophy className="w-6 h-6 text-yellow-300 mx-auto mb-1" />
          <div className="font-black text-lg">Tinggi: {score}m</div>
          <Button onClick={start} className="mt-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-extrabold">
            <RotateCcw className="w-4 h-4 mr-1" /> Main Lagi
          </Button>
        </motion.div>
      )}

      <p className="mt-3 text-[10px] opacity-70 text-center">🟢 platform normal · 🟠 spring (lompat tinggi) · 🔵 platform bergerak</p>
    </Card>
  );
}
