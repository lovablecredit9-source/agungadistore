import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trophy, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints } from "./gameStore";

const W = 320, H = 480;
const PADDLE_W = 70, PADDLE_H = 10;
const BALL_R = 7;
const WIN = 5;

export default function PongClassicGame() {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pScore, setPScore] = useState(0);
  const [aScore, setAScore] = useState(0);
  const [over, setOver] = useState<null | "win" | "lose">(null);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("pong_best") || 0));

  const stateRef = useRef({
    px: W / 2, ax: W / 2,
    bx: W / 2, by: H / 2, vx: 3, vy: 3,
    p: 0, a: 0, over: null as null | "win" | "lose", running: false,
    trail: [] as { x: number; y: number; life: number }[],
  });

  const serve = (dir: 1 | -1) => {
    const s = stateRef.current;
    s.bx = W / 2; s.by = H / 2;
    s.vx = (Math.random() > 0.5 ? 1 : -1) * 2.6;
    s.vy = dir * 3.4;
  };

  const reset = useCallback(() => {
    stateRef.current = {
      px: W / 2, ax: W / 2,
      bx: W / 2, by: H / 2, vx: 2.6, vy: 3.4,
      p: 0, a: 0, over: null, running: true, trail: [],
    };
    setPScore(0); setAScore(0); setOver(null); setRunning(true);
  }, []);

  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    let raf = 0; let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(40, now - last); last = now;
      const s = stateRef.current;

      // bg
      ctx.fillStyle = "#0f0f23"; ctx.fillRect(0, 0, W, H);
      // mid line
      ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke(); ctx.setLineDash([]);

      if (s.running && !s.over) {
        // AI tracks ball
        const target = s.bx;
        const aiSpeed = 2.6;
        if (target > s.ax + 4) s.ax = Math.min(s.ax + aiSpeed, target);
        else if (target < s.ax - 4) s.ax = Math.max(s.ax - aiSpeed, target);
        s.ax = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, s.ax));

        // ball
        s.bx += s.vx; s.by += s.vy;
        s.trail.push({ x: s.bx, y: s.by, life: 200 });

        // wall bounce
        if (s.bx - BALL_R < 0) { s.bx = BALL_R; s.vx *= -1; }
        if (s.bx + BALL_R > W) { s.bx = W - BALL_R; s.vx *= -1; }

        // paddle bounce
        const py = H - 30, ay = 30;
        if (s.vy > 0 && s.by + BALL_R >= py - PADDLE_H / 2 && s.by + BALL_R <= py + PADDLE_H / 2) {
          if (Math.abs(s.bx - s.px) < PADDLE_W / 2 + BALL_R) {
            s.vy = -Math.abs(s.vy) * 1.04;
            s.vx += (s.bx - s.px) * 0.08;
            s.by = py - PADDLE_H / 2 - BALL_R;
          }
        }
        if (s.vy < 0 && s.by - BALL_R <= ay + PADDLE_H / 2 && s.by - BALL_R >= ay - PADDLE_H / 2) {
          if (Math.abs(s.bx - s.ax) < PADDLE_W / 2 + BALL_R) {
            s.vy = Math.abs(s.vy) * 1.04;
            s.vx += (s.bx - s.ax) * 0.08;
            s.by = ay + PADDLE_H / 2 + BALL_R;
          }
        }
        s.vx = Math.max(-7, Math.min(7, s.vx));
        s.vy = Math.max(-7, Math.min(7, s.vy));

        // score
        if (s.by < -10) { s.p += 1; setPScore(s.p); serve(1); }
        else if (s.by > H + 10) { s.a += 1; setAScore(s.a); serve(-1); }

        if (s.p >= WIN) { s.over = "win"; setOver("win"); s.running = false; }
        else if (s.a >= WIN) { s.over = "lose"; setOver("lose"); s.running = false; }
      }

      // trail
      s.trail.forEach(t => { t.life -= dt; });
      s.trail = s.trail.filter(t => t.life > 0).slice(-20);
      s.trail.forEach(t => {
        ctx.fillStyle = `rgba(34,211,238,${t.life / 400})`;
        ctx.beginPath(); ctx.arc(t.x, t.y, BALL_R * (t.life / 200), 0, Math.PI * 2); ctx.fill();
      });

      // ball
      ctx.fillStyle = "#22d3ee"; ctx.shadowColor = "#22d3ee"; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(stateRef.current.bx, stateRef.current.by, BALL_R, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;

      // paddles
      ctx.fillStyle = "#f43f5e"; ctx.shadowColor = "#f43f5e"; ctx.shadowBlur = 12;
      ctx.fillRect(stateRef.current.ax - PADDLE_W / 2, 30 - PADDLE_H / 2, PADDLE_W, PADDLE_H);
      ctx.fillStyle = "#22c55e"; ctx.shadowColor = "#22c55e";
      ctx.fillRect(stateRef.current.px - PADDLE_W / 2, H - 30 - PADDLE_H / 2, PADDLE_W, PADDLE_H);
      ctx.shadowBlur = 0;

      // score
      ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.font = "bold 30px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(String(stateRef.current.a), W / 2, H / 2 - 16);
      ctx.fillText(String(stateRef.current.p), W / 2, H / 2 + 38);

      if (!stateRef.current.running && !stateRef.current.over) {
        ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff"; ctx.font = "bold 22px sans-serif";
        ctx.fillText("Tap untuk Mulai", W / 2, H / 2 + 90);
        ctx.font = "13px sans-serif";
        ctx.fillText("Geser untuk gerakkan paddle hijau", W / 2, H / 2 + 110);
        ctx.fillText(`Pertama capai ${WIN} poin menang`, W / 2, H / 2 + 128);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (!over) return;
    const final = stateRef.current.p;
    const diff = stateRef.current.p - stateRef.current.a;
    if (final > best) { setBest(final); localStorage.setItem("pong_best", String(final)); }
    const base = over === "win" ? 30 + diff * 6 : Math.max(2, final * 4);
    const { awardedPoints } = awardGamePoints(base);
    toast({ title: over === "win" ? "🏆 Menang!" : "Kalah", description: `${final}-${stateRef.current.a} · +${awardedPoints} poin` });
  }, [over]);

  const move = (clientX: number) => {
    const c = canvasRef.current; if (!c) return;
    const r = c.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * W;
    stateRef.current.px = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, x));
  };

  return (
    <Card className="p-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 font-bold">AI {aScore}</span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 font-bold">Kamu {pScore}</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-bold flex items-center gap-1"><Trophy className="w-3 h-3" />{best}</span>
        </div>
        <Button size="sm" variant="outline" onClick={reset}><RotateCcw className="w-3.5 h-3.5" /></Button>
      </div>

      <div className="mx-auto" style={{ maxWidth: W }}>
        <canvas
          ref={canvasRef}
          width={W} height={H}
          onPointerDown={e => { e.preventDefault(); if (!stateRef.current.running && !stateRef.current.over) reset(); else move(e.clientX); }}
          onPointerMove={e => { if (e.buttons) move(e.clientX); }}
          className="rounded-lg border border-border w-full touch-none cursor-pointer"
        />
      </div>

      {over ? (
        <div className={`text-center p-3 rounded-lg ${over === "win" ? "bg-emerald-500/10 border-emerald-500/30" : "bg-destructive/10 border-destructive/30"} border`}>
          <p className={`font-bold ${over === "win" ? "text-emerald-600" : "text-destructive"}`}>{over === "win" ? "Kamu Menang!" : "AI Menang"}</p>
          <p className="text-xs text-muted-foreground">{pScore} - {aScore}</p>
          <Button size="sm" className="mt-2" onClick={reset}><Play className="w-3.5 h-3.5 mr-1" />Main Lagi</Button>
        </div>
      ) : (
        <p className="text-[10px] text-center text-muted-foreground">Geser untuk gerakkan paddle hijau · pertama capai {WIN} menang 🏓</p>
      )}
    </Card>
  );
}
