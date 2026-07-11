import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trophy, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints, resetReviveCount } from "./gameStore";
import RevivePrompt from "./RevivePrompt";

const W = 320, H = 480;

type Bullet = { x: number; y: number };
type Enemy = { x: number; y: number; vx: number; hp: number; type: 0 | 1 };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string };

export default function SpaceShooterGame() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [over, setOver] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("space_shooter_best") || 0));

  const stateRef = useRef({
    px: W / 2, py: H - 50,
    bullets: [] as Bullet[],
    enemies: [] as Enemy[],
    particles: [] as Particle[],
    stars: Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 0.5 + Math.random() * 1.5 })),
    fireCool: 0,
    spawnT: 0,
    score: 0,
    lives: 3,
    over: false,
    revivePending: false,
    t: 0,
    iframes: 0,
  });

  const reset = useCallback(() => {
    resetReviveCount();
    stateRef.current = {
      px: W / 2, py: H - 50,
      bullets: [], enemies: [], particles: [],
      stars: Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: 0.5 + Math.random() * 1.5 })),
      fireCool: 0, spawnT: 0, score: 0, lives: 3, over: false, revivePending: false, t: 0, iframes: 0,
    };
    setScore(0); setLives(3); setOver(false); setReviving(false);
  }, []);

  const beginRevive = useCallback(() => {
    const s = stateRef.current;
    if (s.revivePending || s.over) return;
    s.revivePending = true;
    setReviving(true);
  }, []);

  const finalizeGameOver = useCallback(() => {
    const s = stateRef.current;
    s.revivePending = false;
    s.over = true;
    setReviving(false);
    setOver(true);
  }, []);

  const revive = useCallback(() => {
    const s = stateRef.current;
    s.lives = 1;
    s.iframes = 1800;
    s.enemies = s.enemies.filter((e) => Math.abs(e.x - s.px) > 70 || Math.abs(e.y - s.py) > 100);
    s.revivePending = false;
    s.over = false;
    setLives(1);
    setReviving(false);
    setOver(false);
  }, []);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(40, now - last); last = now;
      const s = stateRef.current;

      // bg
      ctx.fillStyle = "#020617"; ctx.fillRect(0, 0, W, H);
      s.stars.forEach(st => {
        st.y += st.s * dt * 0.05;
        if (st.y > H) { st.y = 0; st.x = Math.random() * W; }
        ctx.fillStyle = `rgba(255,255,255,${0.2 + st.s * 0.3})`;
        ctx.fillRect(st.x, st.y, st.s, st.s);
      });

      if (!s.over && !s.revivePending) {
        s.t += dt;
        s.iframes = Math.max(0, s.iframes - dt);
        // auto fire
        s.fireCool -= dt;
        if (s.fireCool <= 0) {
          s.bullets.push({ x: s.px, y: s.py - 14 });
          s.fireCool = 180;
        }
        // bullets
        s.bullets.forEach(b => { b.y -= 6; });
        s.bullets = s.bullets.filter(b => b.y > -10);

        // spawn enemies
        s.spawnT -= dt;
        if (s.spawnT <= 0) {
          const type: 0 | 1 = Math.random() < 0.2 ? 1 : 0;
          s.enemies.push({
            x: 20 + Math.random() * (W - 40),
            y: -20,
            vx: (Math.random() - 0.5) * 1.2,
            hp: type === 1 ? 3 : 1,
            type,
          });
          s.spawnT = Math.max(400, 1200 - s.t / 30);
        }
        const speed = 1 + s.t / 12000;
        s.enemies.forEach(e => {
          e.y += speed * 1.2;
          e.x += e.vx;
          if (e.x < 14 || e.x > W - 14) e.vx *= -1;
        });

        // collisions bullet-enemy
        for (const e of s.enemies) {
          for (const b of s.bullets) {
            const dx = e.x - b.x, dy = e.y - b.y;
            if (dx * dx + dy * dy < (e.type === 1 ? 256 : 196)) {
              e.hp -= 1; b.y = -100;
              for (let i = 0; i < 6; i++) {
                s.particles.push({
                  x: b.x, y: b.y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
                  life: 400, color: e.type === 1 ? "#f59e0b" : "#22d3ee",
                });
              }
            }
          }
        }
        s.bullets = s.bullets.filter(b => b.y > -10);
        const killed = s.enemies.filter(e => e.hp <= 0);
        killed.forEach(e => {
          s.score += e.type === 1 ? 30 : 10;
          for (let i = 0; i < 14; i++) {
            s.particles.push({
              x: e.x, y: e.y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6,
              life: 600, color: ["#f43f5e", "#f59e0b", "#fde047"][i % 3],
            });
          }
        });
        s.enemies = s.enemies.filter(e => e.hp > 0);

        // ship collision
        if (s.iframes <= 0) {
          for (const e of s.enemies) {
            const dx = e.x - s.px, dy = e.y - s.py;
            if (dx * dx + dy * dy < 360) {
              s.lives -= 1;
              s.iframes = 1000;
              for (let i = 0; i < 20; i++) {
                s.particles.push({
                  x: s.px, y: s.py, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
                  life: 700, color: "#f43f5e",
                });
              }
              break;
            }
          }
        }
        // off-screen enemies
        const escaped = s.enemies.filter(e => e.y > H + 20);
        if (escaped.length && s.iframes <= 0) {
          s.lives -= escaped.length;
          s.iframes = 600;
        }
        s.enemies = s.enemies.filter(e => e.y <= H + 20);

        if (s.lives !== lives) setLives(Math.max(0, s.lives));
        if (s.score !== score) setScore(s.score);
        if (s.lives <= 0) beginRevive();
      }

      // particles
      s.particles.forEach(p => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.life -= dt;
      });
      s.particles = s.particles.filter(p => p.life > 0);
      s.particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life / 600);
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
      });
      ctx.globalAlpha = 1;

      // bullets
      s.bullets.forEach(b => {
        ctx.fillStyle = "#22d3ee";
        ctx.shadowColor = "#22d3ee"; ctx.shadowBlur = 8;
        ctx.fillRect(b.x - 1.5, b.y - 8, 3, 10);
      });
      ctx.shadowBlur = 0;

      // enemies
      s.enemies.forEach(e => {
        ctx.fillStyle = e.type === 1 ? "#f59e0b" : "#a855f7";
        ctx.shadowColor = ctx.fillStyle as string; ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y + 12);
        ctx.lineTo(e.x - 14, e.y - 8);
        ctx.lineTo(e.x + 14, e.y - 8);
        ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        if (e.type === 1) {
          ctx.fillStyle = "#fef3c7"; ctx.beginPath();
          ctx.arc(e.x, e.y - 2, 4, 0, Math.PI * 2); ctx.fill();
        }
      });

      // ship
      const blink = s.iframes > 0 && Math.floor(s.iframes / 80) % 2 === 0;
      if (!blink) {
        ctx.save(); ctx.translate(s.px, s.py);
        ctx.fillStyle = "#22d3ee"; ctx.shadowColor = "#22d3ee"; ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.moveTo(0, -16); ctx.lineTo(-14, 12); ctx.lineTo(0, 6); ctx.lineTo(14, 12);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#fde047"; ctx.beginPath();
        ctx.arc(0, -2, 3, 0, Math.PI * 2); ctx.fill();
        // engine flame
        ctx.fillStyle = "#f97316"; ctx.shadowColor = "#f97316";
        ctx.beginPath();
        ctx.moveTo(-4, 12); ctx.lineTo(0, 18 + Math.sin(s.t / 50) * 2); ctx.lineTo(4, 12);
        ctx.closePath(); ctx.fill();
        ctx.restore(); ctx.shadowBlur = 0;
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [beginRevive, lives, score]);

  useEffect(() => {
    if (!over) return;
    const final = stateRef.current.score;
    if (final > best) { setBest(final); localStorage.setItem("space_shooter_best", String(final)); }
    const { awardedPoints } = awardGamePoints(Math.max(1, Math.floor(final / 5)));
    toast({ title: "Game Over", description: `Skor ${final} · +${awardedPoints} poin` });
  }, [over]);

  const move = (clientX: number) => {
    const c = canvasRef.current; if (!c) return;
    const rect = c.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * W;
    stateRef.current.px = Math.max(16, Math.min(W - 16, x));
  };

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Skor {score}</span>
          <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 font-bold flex items-center gap-1">
            <Heart className="w-3 h-3 fill-current" /> {lives}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-bold flex items-center gap-1"><Trophy className="w-3 h-3" />{best}</span>
        </div>
        <Button size="sm" variant="outline" onClick={reset}><RotateCcw className="w-3.5 h-3.5" /></Button>
      </div>

      <div className="mx-auto" style={{ maxWidth: W }}>
        <canvas
          ref={canvasRef}
          width={W} height={H}
          onPointerDown={e => { e.preventDefault(); move(e.clientX); }}
          onPointerMove={e => { if (e.buttons) move(e.clientX); }}
          className="rounded-lg border border-border w-full touch-none cursor-pointer"
          style={{ background: "#020617" }}
        />
      </div>

      <p className="text-[10px] text-center text-muted-foreground">Geser jari untuk gerakkan kapal. Tembakan otomatis 🚀</p>

      {reviving ? (
        <RevivePrompt active={reviving} scoreLabel={`Skor: ${score}`} onRevive={revive} onExpire={finalizeGameOver} />
      ) : over && (
        <div className="text-center p-3 rounded-lg bg-destructive/10 border border-destructive/30">
          <p className="font-bold text-destructive">Game Over</p>
          <p className="text-xs text-muted-foreground">Skor: {score}</p>
          <Button size="sm" className="mt-2" onClick={reset}>Main Lagi</Button>
        </div>
      )}
    </Card>
  );
}
