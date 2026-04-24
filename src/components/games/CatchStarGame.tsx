import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trophy, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints } from "./gameStore";

const W = 320;
const H = 460;
const BASKET_W = 64;
const BASKET_H = 18;
const GAME_TIME = 45000; // 45 detik

type Item = {
  x: number;
  y: number;
  vy: number;
  type: "star" | "gem" | "bomb";
  rot: number;
  vrot: number;
};

const COLORS = {
  star: "#facc15",
  gem: "#a855f7",
  bomb: "#1f2937",
};

export default function CatchStarGame() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [over, setOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("catch_best") || 0));

  const stateRef = useRef({
    basketX: W / 2 - BASKET_W / 2,
    items: [] as Item[],
    score: 0,
    timeLeft: GAME_TIME,
    over: false,
    running: false,
    spawnTimer: 0,
    lastFrame: 0,
  });

  const reset = useCallback(() => {
    stateRef.current = {
      basketX: W / 2 - BASKET_W / 2,
      items: [],
      score: 0,
      timeLeft: GAME_TIME,
      over: false,
      running: true,
      spawnTimer: 0,
      lastFrame: performance.now(),
    };
    setScore(0);
    setTimeLeft(GAME_TIME);
    setOver(false);
    setRunning(true);
  }, []);

  const moveBasket = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = W / rect.width;
    const x = (clientX - rect.left) * scale;
    stateRef.current.basketX = Math.max(0, Math.min(W - BASKET_W, x - BASKET_W / 2));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;

    const drawStar = (cx: number, cy: number, r: number, color: string, rot: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const ang = (Math.PI / 5) * i - Math.PI / 2;
        const rad = i % 2 === 0 ? r : r / 2.3;
        const px = Math.cos(ang) * rad;
        const py = Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fill();
      ctx.restore();
    };

    const drawGem = (cx: number, cy: number, r: number, color: string, rot: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.4, -r * 0.3);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const drawBomb = (cx: number, cy: number, r: number) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = "#1f2937";
      ctx.beginPath();
      ctx.arc(0, 2, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(-2, -r - 4, 4, 6);
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.arc(0, -r - 6, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const loop = (now: number) => {
      const s = stateRef.current;
      const dt = s.lastFrame ? now - s.lastFrame : 16;
      s.lastFrame = now;

      // bg
      const grd = ctx.createLinearGradient(0, 0, 0, H);
      grd.addColorStop(0, "#1e3a8a");
      grd.addColorStop(1, "#312e81");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      // stars background
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < 30; i++) {
        const x = (i * 53) % W;
        const y = (i * 79 + (now / 50)) % H;
        ctx.fillRect(x, y, 1.5, 1.5);
      }

      if (s.running && !s.over) {
        s.timeLeft -= dt;
        if (s.timeLeft <= 0) {
          s.timeLeft = 0;
          s.over = true;
          setOver(true);
          setRunning(false);
        }
        setTimeLeft(Math.max(0, Math.floor(s.timeLeft)));

        // spawn
        s.spawnTimer += dt;
        const spawnRate = 600 - Math.min(300, (GAME_TIME - s.timeLeft) / 200);
        if (s.spawnTimer > spawnRate) {
          s.spawnTimer = 0;
          const r = Math.random();
          const type: Item["type"] = r < 0.15 ? "bomb" : r < 0.55 ? "gem" : "star";
          s.items.push({
            x: 20 + Math.random() * (W - 40),
            y: -20,
            vy: 2 + Math.random() * 2.5 + (GAME_TIME - s.timeLeft) / 15000,
            type,
            rot: 0,
            vrot: (Math.random() - 0.5) * 0.1,
          });
        }

        // update items
        for (const it of s.items) {
          it.y += it.vy;
          it.rot += it.vrot;
        }

        // collision with basket
        const bx = s.basketX;
        const by = H - 30;
        s.items = s.items.filter(it => {
          if (it.y > by - 6 && it.y < by + BASKET_H && it.x > bx && it.x < bx + BASKET_W) {
            if (it.type === "star") s.score += 10;
            else if (it.type === "gem") s.score += 25;
            else s.score = Math.max(0, s.score - 20);
            setScore(s.score);
            return false;
          }
          return it.y < H + 20;
        });
      }

      // draw items
      for (const it of s.items) {
        if (it.type === "star") drawStar(it.x, it.y, 10, COLORS.star, it.rot);
        else if (it.type === "gem") drawGem(it.x, it.y, 9, COLORS.gem, it.rot);
        else drawBomb(it.x, it.y, 9);
      }

      // basket
      const bx = s.basketX;
      const by = H - 30;
      const bg = ctx.createLinearGradient(bx, by, bx, by + BASKET_H);
      bg.addColorStop(0, "#fb923c");
      bg.addColorStop(1, "#c2410c");
      ctx.fillStyle = bg;
      ctx.fillRect(bx, by, BASKET_W, BASKET_H);
      // weave
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(bx + i * 11, by);
        ctx.lineTo(bx + i * 11, by + BASKET_H);
        ctx.stroke();
      }
      ctx.strokeStyle = "#7c2d12";
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, BASKET_W, BASKET_H);
      // handle
      ctx.beginPath();
      ctx.arc(bx + BASKET_W / 2, by, BASKET_W / 2 - 4, Math.PI, 0);
      ctx.stroke();

      // ground
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, H - 12, W, 12);

      // HUD
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`⭐ ${s.score}`, 10, 24);
      ctx.textAlign = "right";
      const sec = Math.ceil(s.timeLeft / 1000);
      ctx.fillStyle = sec <= 10 ? "#fca5a5" : "#fff";
      ctx.fillText(`${sec}s`, W - 10, 24);

      if (!s.running && !s.over) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 22px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Tangkap Bintang!", W / 2, H / 2 - 10);
        ctx.font = "12px sans-serif";
        ctx.fillText("⭐ +10  💎 +25  💣 -20", W / 2, H / 2 + 14);
        ctx.fillText("Tap untuk Mulai", W / 2, H / 2 + 36);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // award on game over
  useEffect(() => {
    if (!over) return;
    const finalScore = stateRef.current.score;
    setBest(prev => {
      if (finalScore > prev) {
        localStorage.setItem("catch_best", String(finalScore));
        return finalScore;
      }
      return prev;
    });
    const base = Math.max(1, Math.floor(finalScore / 8));
    const { awardedPoints } = awardGamePoints(base);
    toast({ title: "Selesai", description: `Skor ${finalScore} · +${awardedPoints} poin` });
  }, [over]);

  // keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (e.key === "ArrowLeft") s.basketX = Math.max(0, s.basketX - 22);
      if (e.key === "ArrowRight") s.basketX = Math.min(W - BASKET_W, s.basketX + 22);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Skor {score}</span>
          <span className="px-2 py-0.5 rounded-full bg-muted font-semibold">{Math.ceil(timeLeft / 1000)}s</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-bold flex items-center gap-1"><Trophy className="w-3 h-3" />{best}</span>
        </div>
        <Button size="sm" variant="outline" onClick={reset}><RotateCcw className="w-3.5 h-3.5" /></Button>
      </div>

      <div className="mx-auto" style={{ maxWidth: W }}>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onPointerDown={(e) => { e.preventDefault(); if (!stateRef.current.running) reset(); moveBasket(e.clientX); }}
          onPointerMove={(e) => { if (e.buttons > 0 || e.pointerType === "touch") moveBasket(e.clientX); }}
          className="rounded-lg border border-border w-full touch-none cursor-pointer"
          style={{ background: "#1e3a8a" }}
        />
      </div>

      {over ? (
        <div className="text-center p-3 rounded-lg bg-primary/10 border border-primary/30">
          <p className="font-bold text-primary">Waktu Habis!</p>
          <p className="text-xs text-muted-foreground">Skor: {score}</p>
          <Button size="sm" className="mt-2" onClick={reset}><Play className="w-3.5 h-3.5 mr-1" />Main Lagi</Button>
        </div>
      ) : (
        <p className="text-[10px] text-center text-muted-foreground">Geser keranjang untuk tangkap ⭐💎, hindari 💣</p>
      )}
    </Card>
  );
}
