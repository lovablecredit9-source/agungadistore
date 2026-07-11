// 10 mini-games tambahan, ringkas dan addictive
import { useEffect, useRef, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RotateCcw, Trophy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints } from "./gameStore";
import RevivePrompt from "./RevivePrompt";

/* ========== Shared UI ========== */
function GameShell({ title, accent, best, children }: { title: string; accent: string; best: number | string; children: React.ReactNode }) {
  return (
    <Card className={`p-4 bg-gradient-to-br ${accent} border-white/10 text-white`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-extrabold text-base drop-shadow">{title}</h3>
        <div className="text-[11px] opacity-80">Best: <span className="font-black text-yellow-300">{best}</span></div>
      </div>
      {children}
    </Card>
  );
}

function StartButton({ label, onClick, color = "from-amber-500 to-orange-600" }: { label: string; onClick: () => void; color?: string }) {
  return (
    <Button onClick={onClick} className={`w-full bg-gradient-to-r ${color} text-white font-extrabold`}>
      <Play className="w-4 h-4 mr-1" /> {label}
    </Button>
  );
}

function awardAndToast(toast: any, basePts: number, label: string) {
  const { awardedPoints } = awardGamePoints(basePts);
  toast({ title: label, description: `+${awardedPoints} poin` });
}

/* ========== 1. Piano Tiles (tap tiles hitam) ========== */
export function PianoTilesGame() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("piano_best") || 0));
  const [rows, setRows] = useState<number[]>([]);
  const speedRef = useRef(900);
  const intRef = useRef<number | null>(null);

  const start = () => {
    setScore(0); setOver(false); setRunning(true); setRows([]);
    speedRef.current = 900;
  };

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      setRows(prev => {
        const next = [...prev, Math.floor(Math.random() * 4)];
        if (next.length > 5) next.shift();
        return next;
      });
    };
    tick();
    intRef.current = window.setInterval(() => {
      tick();
      speedRef.current = Math.max(280, speedRef.current - 8);
      if (intRef.current) {
        clearInterval(intRef.current);
        intRef.current = window.setInterval(tick, speedRef.current);
      }
    }, speedRef.current);
    return () => { if (intRef.current) clearInterval(intRef.current); };
  }, [running]);

  const tap = (lane: number) => {
    if (!running) return;
    const bottom = rows[0];
    if (bottom === lane) {
      setRows(prev => prev.slice(1));
      setScore(s => s + 1);
    } else {
      finish();
    }
  };

  const finish = () => {
    setRunning(false); setOver(true);
    if (intRef.current) clearInterval(intRef.current);
    if (score > best) { setBest(score); localStorage.setItem("piano_best", String(score)); }
    awardAndToast(toast, Math.max(3, Math.floor(score / 3)), "🎹 Game Over");
  };

  return (
    <GameShell title="🎹 Piano Tiles" accent="from-violet-950 via-fuchsia-900 to-purple-900" best={best}>
      <div className="text-center mb-2 font-black text-xl tabular-nums">{score}</div>
      <div className="grid grid-cols-4 gap-1 h-72 bg-white rounded-xl p-1">
        {[4,3,2,1,0].map((rowIdx) => (
          <div key={rowIdx} className="contents">
            {[0,1,2,3].map(lane => {
              const r = rows[rowIdx];
              const isTile = r === lane;
              return (
                <button
                  key={lane}
                  onClick={() => rowIdx === 0 && tap(lane)}
                  className={`rounded ${isTile ? "bg-gradient-to-br from-slate-800 to-black" : "bg-white"} ${rowIdx === 0 ? "active:scale-95" : ""} transition`}
                  style={{ gridColumn: lane + 1, gridRow: 5 - rowIdx }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3">
        {(!running || over) && <StartButton label={over ? "Main Lagi" : "Mulai"} onClick={start} color="from-fuchsia-500 to-purple-600" />}
      </div>
      <p className="mt-2 text-[10px] opacity-70 text-center">Tap tile hitam paling bawah · jangan salah!</p>
    </GameShell>
  );
}

/* ========== 2. Block Stacker (tower) ========== */
export function BlockStackerGame() {
  const { toast } = useToast();
  const W = 280, H = 360, BLOCK_H = 22;
  const [blocks, setBlocks] = useState<{ x: number; w: number }[]>([{ x: 80, w: 120 }]);
  const [moving, setMoving] = useState<{ x: number; w: number; dir: 1 | -1 } | null>(null);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("tower_best") || 0));
  const rafRef = useRef(0);

  const start = () => {
    setBlocks([{ x: 80, w: 120 }]);
    setScore(0); setOver(false); setRunning(true);
    setMoving({ x: 0, w: 120, dir: 1 });
  };

  useEffect(() => {
    if (!running || !moving) return;
    const speed = 2.2 + Math.min(3, score * 0.15);
    const loop = () => {
      setMoving(m => {
        if (!m) return m;
        let nx = m.x + m.dir * speed;
        let nd: 1 | -1 = m.dir;
        if (nx + m.w > W) { nx = W - m.w; nd = -1; }
        if (nx < 0) { nx = 0; nd = 1; }
        return { x: nx, w: m.w, dir: nd };
      });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, moving?.w, score]);

  const drop = () => {
    if (!moving || !running) return;
    const last = blocks[blocks.length - 1];
    const overlapL = Math.max(moving.x, last.x);
    const overlapR = Math.min(moving.x + moving.w, last.x + last.w);
    const overlap = overlapR - overlapL;
    if (overlap <= 0) {
      setRunning(false); setOver(true);
      if (score > best) { setBest(score); localStorage.setItem("tower_best", String(score)); }
      awardAndToast(toast, Math.max(3, score * 2), "🧱 Tower runtuh!");
      return;
    }
    const newBlock = { x: overlapL, w: overlap };
    setBlocks(b => [...b, newBlock]);
    setScore(s => s + 1);
    setMoving({ x: 0, w: overlap, dir: 1 });
  };

  return (
    <GameShell title="🧱 Block Stacker" accent="from-orange-950 via-red-900 to-pink-900" best={best}>
      <div className="text-center mb-2 font-black text-xl tabular-nums">Tinggi: {score}</div>
      <div className="relative mx-auto bg-gradient-to-b from-sky-700 to-indigo-900 rounded-xl overflow-hidden" style={{ width: W, height: H }}>
        {blocks.map((b, i) => {
          const y = H - (i + 1) * BLOCK_H;
          const visibleY = Math.max(0, y);
          const hue = (i * 35) % 360;
          if (y < -BLOCK_H) return null;
          return <div key={i} className="absolute rounded shadow-lg border border-white/30" style={{ left: b.x, top: visibleY, width: b.w, height: BLOCK_H, background: `hsl(${hue} 80% 55%)` }} />;
        })}
        {moving && running && (
          <div className="absolute rounded shadow-xl border border-white/40" style={{
            left: moving.x, top: H - (blocks.length + 1) * BLOCK_H, width: moving.w, height: BLOCK_H,
            background: `hsl(${(blocks.length * 35) % 360} 80% 60%)`,
          }} />
        )}
      </div>
      <div className="mt-3 flex gap-2">
        {!running && !over && <StartButton label="Mulai" onClick={start} color="from-orange-500 to-red-600" />}
        {running && <Button onClick={drop} className="flex-1 bg-gradient-to-r from-emerald-500 to-cyan-600 font-extrabold text-white">DROP!</Button>}
        {over && <StartButton label="Main Lagi" onClick={start} color="from-rose-500 to-pink-600" />}
      </div>
    </GameShell>
  );
}

/* ========== 3. Hoop Shot (basket) ========== */
export function HoopShotGame() {
  const { toast } = useToast();
  const W = 300, H = 380;
  const [score, setScore] = useState(0);
  const [shots, setShots] = useState(10);
  const [over, setOver] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("hoop_best") || 0));
  const [hoopX, setHoopX] = useState(W / 2);
  const [ball, setBall] = useState<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const dirRef = useRef(1);
  const rafRef = useRef(0);
  const [aim, setAim] = useState(50); // power %
  const [aiming, setAiming] = useState(false);

  // Move hoop
  useEffect(() => {
    if (over) return;
    let raf = 0;
    const loop = () => {
      setHoopX(x => {
        let nx = x + dirRef.current * 1.6;
        if (nx < 40) { nx = 40; dirRef.current = 1; }
        if (nx > W - 40) { nx = W - 40; dirRef.current = -1; }
        return nx;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [over]);

  // Aim oscillator
  useEffect(() => {
    if (!aiming) return;
    let raf = 0;
    let dir = 1;
    const loop = () => {
      setAim(a => {
        let n = a + dir * 2.5;
        if (n >= 100) { n = 100; dir = -1; }
        if (n <= 10) { n = 10; dir = 1; }
        return n;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [aiming]);

  const start = () => {
    setScore(0); setShots(10); setOver(false); setBall(null); setAim(50);
  };

  const shoot = () => {
    if (over || ball) return;
    setAiming(false);
    const power = aim / 100;
    const vx = (hoopX - W / 2) * 0.04 + (Math.random() - 0.5) * 0.5;
    const vy = -(8 + power * 6);
    setBall({ x: W / 2, y: H - 30, vx, vy });
  };

  // Ball physics
  useEffect(() => {
    if (!ball) return;
    const loop = () => {
      setBall(b => {
        if (!b) return b;
        const nb = { ...b, x: b.x + b.vx, y: b.y + b.vy, vy: b.vy + 0.35 };
        // hoop position fixed at top y=80
        const hoopY = 80;
        if (nb.y > hoopY - 5 && nb.y < hoopY + 10 && Math.abs(nb.x - hoopX) < 18 && nb.vy > 0) {
          // SCORED!
          setScore(s => s + 1);
          setShots(s => s - 1);
          setTimeout(() => setBall(null), 50);
          return null;
        }
        if (nb.y > H + 30) {
          setShots(s => s - 1);
          return null;
        }
        return nb;
      });
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [ball, hoopX]);

  useEffect(() => {
    if (shots <= 0 && !over) {
      setOver(true);
      if (score > best) { setBest(score); localStorage.setItem("hoop_best", String(score)); }
      awardAndToast(toast, score * 5, `🏀 Selesai! ${score}/10`);
    }
  }, [shots]);

  return (
    <GameShell title="🏀 Hoop Shot" accent="from-orange-950 via-amber-900 to-yellow-900" best={best}>
      <div className="grid grid-cols-3 gap-2 text-center text-[11px] mb-2">
        <div className="rounded bg-black/30 p-1.5"><div className="opacity-70">Skor</div><div className="font-black">{score}</div></div>
        <div className="rounded bg-black/30 p-1.5"><div className="opacity-70">Sisa</div><div className="font-black">{shots}</div></div>
        <div className="rounded bg-black/30 p-1.5"><div className="opacity-70">Best</div><div className="font-black text-yellow-300">{best}</div></div>
      </div>
      <div className="relative mx-auto bg-gradient-to-b from-sky-600 to-indigo-800 rounded-xl overflow-hidden" style={{ width: W, height: H }}>
        {/* Hoop */}
        <div className="absolute" style={{ left: hoopX - 22, top: 70, width: 44, height: 6, background: "#ef4444", borderRadius: 4 }} />
        <div className="absolute border-x-2 border-b-2 border-white/70" style={{ left: hoopX - 18, top: 76, width: 36, height: 18, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 }} />
        {/* Ball */}
        {ball && <div className="absolute rounded-full bg-orange-500 border-2 border-orange-900 shadow-lg" style={{ left: ball.x - 12, top: ball.y - 12, width: 24, height: 24 }} />}
        {/* Floor */}
        <div className="absolute bottom-0 left-0 right-0 h-3 bg-amber-900/70" />
        {/* Aim bar */}
        {!ball && !over && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-8 w-40 h-3 bg-black/40 rounded-full overflow-hidden border border-white/30">
            <div className="h-full bg-gradient-to-r from-emerald-400 via-yellow-400 to-red-500" style={{ width: `${aim}%` }} />
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        {!aiming && !ball && !over && shots > 0 && <Button onClick={() => setAiming(true)} className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 font-extrabold text-white">Bidik</Button>}
        {aiming && <Button onClick={shoot} className="flex-1 bg-gradient-to-r from-red-500 to-rose-600 font-extrabold text-white">TEMBAK!</Button>}
        {(over || shots === 0) && <StartButton label="Main Lagi" onClick={start} color="from-orange-500 to-red-600" />}
      </div>
    </GameShell>
  );
}

/* ========== 4. Lane Racer (mobil hindari rintangan) ========== */
export function LaneRacerGame() {
  const { toast } = useToast();
  const W = 240, H = 380, LANES = 3, LANE_W = W / LANES;
  const [lane, setLane] = useState(1);
  const [obs, setObs] = useState<{ id: number; lane: number; y: number; type: "car" | "coin" }[]>([]);
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("racer_best") || 0));
  const idRef = useRef(0);
  const rafRef = useRef(0);

  const start = () => {
    setLane(1); setObs([]); setScore(0); setOver(false); setReviving(false); setRunning(true);
  };

  const finishCrash = () => {
    const final = Math.floor(score);
    setReviving(false); setOver(true); setRunning(false);
    if (final > best) { setBest(final); localStorage.setItem("racer_best", String(final)); }
    awardAndToast(toast, Math.max(3, Math.floor(final / 4)), "🚗 Crash!");
  };

  const revive = () => {
    setLane(1);
    setObs(prev => prev.filter(o => o.y < H - 120));
    setReviving(false); setOver(false); setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let spawnT = 0;
    const speed = () => 2.5 + Math.min(4, score / 30);
    const loop = (t: number) => {
      const dt = (t - last) / 16;
      last = t;
      spawnT += dt;
      if (spawnT > 35) {
        spawnT = 0;
        idRef.current += 1;
        const isCoin = Math.random() < 0.3;
        setObs(o => [...o, { id: idRef.current, lane: Math.floor(Math.random() * LANES), y: -40, type: isCoin ? "coin" : "car" }]);
      }
      setObs(prev => {
        const next: typeof prev = [];
        for (const o of prev) {
          const ny = o.y + speed() * dt;
          // collision check at car y range
          if (ny > H - 70 && ny < H - 20 && o.lane === lane) {
            if (o.type === "coin") {
              setScore(s => s + 5);
              continue; // pickup
            } else {
              // car crash
              setRunning(false); setReviving(true);
              return prev;
            }
          }
          if (ny > H + 20) continue;
          next.push({ ...o, y: ny });
        }
        return next;
      });
      setScore(s => s + 0.05 * dt);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, lane]);

  return (
    <GameShell title="🚗 Lane Racer" accent="from-slate-950 via-zinc-900 to-stone-900" best={best}>
      <div className="text-center mb-2 font-black text-xl tabular-nums">Skor: {Math.floor(score)}</div>
      <div className="relative mx-auto bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-xl overflow-hidden border-2 border-yellow-500/30" style={{ width: W, height: H }}>
        {/* Road dividers */}
        {[1, 2].map(i => (
          <div key={i} className="absolute top-0 bottom-0 w-0.5 bg-yellow-300/40" style={{ left: i * LANE_W }} />
        ))}
        {/* Player car */}
        <div className="absolute rounded-md bg-gradient-to-b from-red-400 to-red-700 border border-white/30 shadow-lg" style={{
          left: lane * LANE_W + 14, bottom: 20, width: LANE_W - 28, height: 44,
        }} />
        {/* Obstacles */}
        {obs.map(o => (
          <div key={o.id} className={`absolute rounded ${o.type === "coin" ? "bg-yellow-300 border border-yellow-700" : "bg-gradient-to-b from-cyan-400 to-blue-700 border border-white/30"}`} style={{
            left: o.lane * LANE_W + (o.type === "coin" ? LANE_W / 2 - 10 : 14),
            top: o.y, width: o.type === "coin" ? 20 : LANE_W - 28, height: o.type === "coin" ? 20 : 40,
            borderRadius: o.type === "coin" ? 999 : 6,
          }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <button onPointerDown={() => setLane(l => Math.max(0, l - 1))} disabled={!running || reviving} className="py-3 rounded-xl bg-slate-700 border border-white/10 text-2xl font-black active:scale-95 disabled:opacity-50">◀</button>
        <button onPointerDown={() => setLane(l => Math.min(LANES - 1, l + 1))} disabled={!running || reviving} className="py-3 rounded-xl bg-slate-700 border border-white/10 text-2xl font-black active:scale-95 disabled:opacity-50">▶</button>
      </div>
      <div className="mt-3">
        {reviving ? <RevivePrompt active={reviving} scoreLabel={`Skor: ${Math.floor(score)}`} onRevive={revive} onExpire={finishCrash} /> : (!running) && <StartButton label={over ? "Main Lagi" : "Mulai"} onClick={start} color="from-red-500 to-rose-600" />}
      </div>
    </GameShell>
  );
}

/* ========== 5. Ninja Slice (potong buah) ========== */
export function NinjaSliceGame() {
  const { toast } = useToast();
  const { useState: _useState } = { useState };
  const W = 300, H = 380;
  type Obj = { id: number; x: number; y: number; vx: number; vy: number; type: "fruit" | "bomb"; emoji: string };
  const [objs, setObjs] = useState<Obj[]>([]);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("ninja_best") || 0));
  const idRef = useRef(0);

  const start = () => {
    setObjs([]); setScore(0); setLives(3); setOver(false); setReviving(false); setRunning(true);
  };

  const finishNinja = (label = "🥷 Game Over") => {
    setRunning(false); setReviving(false); setOver(true);
    if (score > best) { setBest(score); localStorage.setItem("ninja_best", String(score)); }
    awardAndToast(toast, Math.max(3, score), label);
  };

  const revive = () => {
    setObjs([]); setLives(1); setReviving(false); setOver(false); setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    const spawn = () => {
      idRef.current += 1;
      const isBomb = Math.random() < 0.18;
      const fruits = ["🍎", "🍊", "🍓", "🍇", "🍉", "🥭", "🍍"];
      const x = 30 + Math.random() * (W - 60);
      setObjs(o => [...o, {
        id: idRef.current, x, y: H + 20, vx: (Math.random() - 0.5) * 3, vy: -10 - Math.random() * 3,
        type: isBomb ? "bomb" : "fruit",
        emoji: isBomb ? "💣" : fruits[Math.floor(Math.random() * fruits.length)],
      }]);
    };
    const i = setInterval(spawn, 700);
    return () => clearInterval(i);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const loop = () => {
      setObjs(prev => prev.map(o => ({ ...o, x: o.x + o.vx, y: o.y + o.vy, vy: o.vy + 0.3 })).filter(o => {
        if (o.y > H + 50) {
          if (o.type === "fruit") {
            setLives(l => Math.max(0, l - 1));
          }
          return false;
        }
        return true;
      }));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  useEffect(() => {
    if (lives <= 0 && running) {
      setRunning(false); setReviving(true);
    }
  }, [lives]);

  const slice = (o: Obj) => {
    if (!running || reviving || over) return;
    if (o.type === "bomb") {
      setRunning(false); setReviving(true);
      return;
    }
    setScore(s => s + 1);
    setObjs(prev => prev.filter(x => x.id !== o.id));
  };

  return (
    <GameShell title="🥷 Ninja Slice" accent="from-zinc-950 via-red-950 to-orange-950" best={best}>
      <div className="grid grid-cols-3 gap-2 text-center text-[11px] mb-2">
        <div className="rounded bg-black/30 p-1.5"><div className="opacity-70">Skor</div><div className="font-black">{score}</div></div>
        <div className="rounded bg-black/30 p-1.5"><div className="opacity-70">Nyawa</div><div className="font-black text-red-300">{"❤️".repeat(lives) || "—"}</div></div>
        <div className="rounded bg-black/30 p-1.5"><div className="opacity-70">Best</div><div className="font-black text-yellow-300">{best}</div></div>
      </div>
      <div className="relative mx-auto bg-gradient-to-b from-red-900/50 to-black rounded-xl overflow-hidden" style={{ width: W, height: H }}>
        {objs.map(o => (
          <button key={o.id} onPointerEnter={() => slice(o)} onPointerDown={() => slice(o)} className="absolute text-3xl select-none" style={{ left: o.x - 16, top: o.y - 16 }}>
            {o.emoji}
          </button>
        ))}
      </div>
      <div className="mt-3">
        {reviving ? <RevivePrompt active={reviving} scoreLabel={`Skor: ${score}`} onRevive={revive} onExpire={() => finishNinja(lives <= 0 ? "🥷 Game Over" : "💣 BOOM!")} /> : (!running) && <StartButton label={over ? "Main Lagi" : "Mulai"} onClick={start} color="from-red-500 to-orange-600" />}
      </div>
      <p className="mt-2 text-[10px] opacity-70 text-center">Geser jari di atas buah · jangan kena bom 💣</p>
    </GameShell>
  );
}

/* ========== 6. Simon Says (urutan warna) ========== */
export function SimonSaysGame() {
  const { toast } = useToast();
  const COLORS = [
    { c: "bg-red-500", a: "bg-red-300" },
    { c: "bg-emerald-500", a: "bg-emerald-300" },
    { c: "bg-blue-500", a: "bg-blue-300" },
    { c: "bg-yellow-500", a: "bg-yellow-300" },
  ];
  const [seq, setSeq] = useState<number[]>([]);
  const [userIdx, setUserIdx] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [showing, setShowing] = useState(false);
  const [over, setOver] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("simon_best") || 0));

  const start = () => {
    setSeq([]); setUserIdx(0); setOver(false); setReviving(false); setRunning(true);
    setTimeout(() => addStep([]), 500);
  };

  const finishSimon = () => {
    const score = seq.length - 1;
    setRunning(false); setReviving(false); setOver(true);
    if (score > best) { setBest(score); localStorage.setItem("simon_best", String(score)); }
    awardAndToast(toast, Math.max(3, score * 3), "🎯 Salah!");
  };

  const revive = () => {
    setUserIdx(0); setOver(false); setReviving(false); setRunning(true);
    setTimeout(() => playSeq(seq), 250);
  };

  const addStep = (current: number[]) => {
    const next = [...current, Math.floor(Math.random() * 4)];
    setSeq(next);
    playSeq(next);
  };

  const playSeq = async (s: number[]) => {
    setShowing(true);
    for (const x of s) {
      setActive(x);
      await new Promise(r => setTimeout(r, 500));
      setActive(null);
      await new Promise(r => setTimeout(r, 200));
    }
    setShowing(false);
    setUserIdx(0);
  };

  const tap = (i: number) => {
    if (showing || over || reviving || !running) return;
    setActive(i); setTimeout(() => setActive(null), 200);
    if (seq[userIdx] === i) {
      const ni = userIdx + 1;
      if (ni === seq.length) {
        setTimeout(() => addStep(seq), 600);
      } else {
        setUserIdx(ni);
      }
    } else {
      setRunning(false); setReviving(true);
    }
  };

  return (
    <GameShell title="🎯 Simon Says" accent="from-purple-950 via-indigo-900 to-blue-900" best={best}>
      <div className="text-center mb-2 font-black text-xl">Level: {seq.length}</div>
      <div className="grid grid-cols-2 gap-2 mx-auto" style={{ width: 240 }}>
        {COLORS.map((c, i) => (
          <button key={i} onClick={() => tap(i)} className={`h-24 rounded-2xl border-2 border-white/20 ${active === i ? c.a : c.c} active:scale-95 transition`} />
        ))}
      </div>
      <div className="mt-3">
        {reviving ? <RevivePrompt active={reviving} scoreLabel={`Level: ${seq.length}`} onRevive={revive} onExpire={finishSimon} /> : !running && <StartButton label={over ? "Main Lagi" : "Mulai"} onClick={start} color="from-indigo-500 to-purple-600" />}
      </div>
      <p className="mt-2 text-[10px] opacity-70 text-center">{showing ? "👀 Perhatikan urutan..." : running ? "Tirukan urutannya!" : "Tekan Mulai"}</p>
    </GameShell>
  );
}

/* ========== 7. Fishing (klik saat tepat) ========== */
export function FishingGame() {
  const { toast } = useToast();
  const [pos, setPos] = useState(0);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [tries, setTries] = useState(8);
  const [over, setOver] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("fish_best") || 0));
  const [target, setTarget] = useState({ start: 40, end: 60 });
  const dirRef = useRef(1);

  const start = () => {
    setScore(0); setTries(8); setOver(false); setRunning(true); setPos(0);
    setTarget({ start: 30 + Math.random() * 40, end: 0 });
  };

  useEffect(() => {
    setTarget(t => ({ start: t.start, end: t.start + 18 }));
  }, [tries]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const loop = () => {
      setPos(p => {
        let n = p + dirRef.current * 1.6;
        if (n >= 100) { n = 100; dirRef.current = -1; }
        if (n <= 0) { n = 0; dirRef.current = 1; }
        return n;
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const cast = () => {
    if (!running || over) return;
    const isCatch = pos >= target.start && pos <= target.end;
    if (isCatch) {
      const isBig = Math.abs(pos - (target.start + target.end) / 2) < 4;
      setScore(s => s + (isBig ? 25 : 10));
    }
    setTries(t => t - 1);
    if (tries - 1 <= 0) {
      setRunning(false); setOver(true);
      if (score > best) { setBest(score); localStorage.setItem("fish_best", String(score)); }
      awardAndToast(toast, Math.max(3, Math.floor(score / 5)), "🎣 Selesai!");
    } else {
      setTarget({ start: 10 + Math.random() * 70, end: 0 });
    }
  };

  return (
    <GameShell title="🎣 Fishing Master" accent="from-cyan-950 via-blue-900 to-indigo-900" best={best}>
      <div className="grid grid-cols-3 gap-2 text-center text-[11px] mb-3">
        <div className="rounded bg-black/30 p-1.5"><div className="opacity-70">Skor</div><div className="font-black">{score}</div></div>
        <div className="rounded bg-black/30 p-1.5"><div className="opacity-70">Sisa</div><div className="font-black">{tries}</div></div>
        <div className="rounded bg-black/30 p-1.5"><div className="opacity-70">Best</div><div className="font-black text-yellow-300">{best}</div></div>
      </div>
      <div className="relative w-full h-12 rounded-full bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500 border border-white/20 overflow-hidden">
        <div className="absolute top-0 bottom-0 bg-emerald-400/80 border-x-2 border-emerald-200" style={{ left: `${target.start}%`, width: `${target.end - target.start}%` }} />
        <div className="absolute top-0 bottom-0 w-1 bg-yellow-300 shadow-[0_0_8px_#fde047]" style={{ left: `calc(${pos}% - 2px)` }} />
      </div>
      <div className="mt-4 flex gap-2">
        {!running && <StartButton label={over ? "Main Lagi" : "Mulai"} onClick={start} color="from-cyan-500 to-blue-600" />}
        {running && <Button onClick={cast} className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 font-extrabold text-white">PANCING!</Button>}
      </div>
      <p className="mt-2 text-[10px] opacity-70 text-center">Tap saat panah masuk zona hijau · pas tengah = ikan besar 🐟+25</p>
    </GameShell>
  );
}

/* ========== 8. Crossy Chicken (bergerak hindari mobil) ========== */
export function CrossyChickenGame() {
  const { toast } = useToast();
  const W = 280, H = 380, ROWS = 9, ROW_H = H / ROWS;
  const [pos, setPos] = useState({ r: ROWS - 1, c: 3 });
  const [cars, setCars] = useState<{ row: number; x: number; v: number; w: number }[]>([]);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("chicken_best") || 0));

  const start = () => {
    setPos({ r: ROWS - 1, c: 3 }); setScore(0); setOver(false); setReviving(false); setRunning(true);
    const init: typeof cars = [];
    for (let r = 1; r < ROWS - 1; r++) {
      const v = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 1.5);
      init.push({ row: r, x: Math.random() * W, v, w: 40 + Math.random() * 30 });
      init.push({ row: r, x: Math.random() * W, v, w: 40 + Math.random() * 30 });
    }
    setCars(init);
  };

  const finishChicken = () => {
    setRunning(false); setReviving(false); setOver(true);
    if (score > best) { setBest(score); localStorage.setItem("chicken_best", String(score)); }
    awardAndToast(toast, Math.max(3, score), "🐔 Tertabrak!");
  };

  const revive = () => {
    setPos({ r: ROWS - 1, c: 3 }); setReviving(false); setOver(false); setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const loop = () => {
      setCars(prev => prev.map(c => {
        let nx = c.x + c.v;
        if (nx > W + c.w) nx = -c.w;
        if (nx < -c.w) nx = W + c.w;
        return { ...c, x: nx };
      }));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  // Collision
  useEffect(() => {
    if (!running) return;
    const cellW = W / 7;
    const px = pos.c * cellW + cellW / 2;
    const py = pos.r * ROW_H + ROW_H / 2;
    for (const c of cars) {
      if (c.row === pos.r) {
        if (Math.abs(px - (c.x + c.w / 2)) < c.w / 2 + 10 && Math.abs(py - (c.row * ROW_H + ROW_H / 2)) < ROW_H / 2) {
          setRunning(false); setReviving(true);
          return;
        }
      }
    }
  }, [cars, pos, running]);

  const move = (dr: number, dc: number) => {
    if (!running || over || reviving) return;
    setPos(p => {
      const nr = Math.max(0, Math.min(ROWS - 1, p.r + dr));
      const nc = Math.max(0, Math.min(6, p.c + dc));
      if (nr < p.r) setScore(s => s + 1);
      return { r: nr, c: nc };
    });
  };

  return (
    <GameShell title="🐔 Crossy Chicken" accent="from-yellow-950 via-amber-900 to-orange-950" best={best}>
      <div className="text-center mb-2 font-black text-xl">Skor: {score}</div>
      <div className="relative mx-auto rounded-xl overflow-hidden border-2 border-white/10" style={{ width: W, height: H }}>
        {Array.from({ length: ROWS }).map((_, r) => (
          <div key={r} className={`absolute left-0 right-0 ${r === 0 ? "bg-emerald-700" : r === ROWS - 1 ? "bg-emerald-700" : "bg-zinc-800"}`} style={{ top: r * ROW_H, height: ROW_H }}>
            {r > 0 && r < ROWS - 1 && <div className="h-full border-y border-dashed border-yellow-300/40" />}
          </div>
        ))}
        {cars.map((c, i) => (
          <div key={i} className="absolute rounded-md bg-gradient-to-b from-cyan-400 to-blue-700 border border-white/30" style={{
            left: c.x, top: c.row * ROW_H + 6, width: c.w, height: ROW_H - 12,
          }} />
        ))}
        <div className="absolute text-2xl text-center" style={{
          left: pos.c * (W / 7), top: pos.r * ROW_H + 2, width: W / 7, height: ROW_H,
        }}>🐔</div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 max-w-[240px] mx-auto">
        <div />
        <button onClick={() => move(-1, 0)} disabled={!running || reviving} className="py-2 rounded-xl bg-emerald-600 font-black text-white active:scale-95 disabled:opacity-50">▲</button>
        <div />
        <button onClick={() => move(0, -1)} disabled={!running || reviving} className="py-2 rounded-xl bg-slate-700 font-black text-white active:scale-95 disabled:opacity-50">◀</button>
        <button onClick={() => move(1, 0)} disabled={!running || reviving} className="py-2 rounded-xl bg-slate-700 font-black text-white active:scale-95 disabled:opacity-50">▼</button>
        <button onClick={() => move(0, 1)} disabled={!running || reviving} className="py-2 rounded-xl bg-slate-700 font-black text-white active:scale-95 disabled:opacity-50">▶</button>
      </div>
      <div className="mt-3">
        {reviving ? <RevivePrompt active={reviving} scoreLabel={`Skor: ${score}`} onRevive={revive} onExpire={finishChicken} /> : !running && <StartButton label={over ? "Main Lagi" : "Mulai"} onClick={start} color="from-amber-500 to-orange-600" />}
      </div>
    </GameShell>
  );
}

/* ========== 9. Spin Win (mini-roulette with luck) ========== */
export function SpinWinGame() {
  const { toast } = useToast();
  const SLOTS = [
    { label: "+10", color: "#22c55e", val: 10 },
    { label: "x2", color: "#facc15", val: 0 },
    { label: "+5", color: "#3b82f6", val: 5 },
    { label: "💀", color: "#ef4444", val: -10 },
    { label: "+20", color: "#a855f7", val: 20 },
    { label: "+15", color: "#f97316", val: 15 },
    { label: "💎", color: "#06b6d4", val: 50 },
    { label: "+5", color: "#10b981", val: 5 },
  ];
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [score, setScore] = useState(100);
  const [best, setBest] = useState(() => Number(localStorage.getItem("spin_best") || 100));
  const [lastSlot, setLastSlot] = useState<number | null>(null);
  const lastValRef = useRef(0);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    const slot = Math.floor(Math.random() * SLOTS.length);
    const sliceA = 360 / SLOTS.length;
    const targetAngle = 360 * 5 + (360 - slot * sliceA - sliceA / 2);
    setAngle(a => a + targetAngle);
    setTimeout(() => {
      setSpinning(false); setLastSlot(slot);
      const s = SLOTS[slot];
      let next = score;
      if (s.label === "x2") next = score * 2;
      else next = Math.max(0, score + s.val);
      lastValRef.current = next - score;
      setScore(next);
      if (next > best) { setBest(next); localStorage.setItem("spin_best", String(next)); }
      awardAndToast(toast, Math.max(0, Math.floor((next - score) / 2)), `🎡 ${s.label}`);
    }, 3200);
  };

  return (
    <GameShell title="🎡 Spin & Win" accent="from-rose-950 via-fuchsia-900 to-pink-900" best={best}>
      <div className="text-center mb-2 font-black text-xl tabular-nums">💰 {score}</div>
      <div className="relative mx-auto" style={{ width: 240, height: 240 }}>
        {/* Wheel */}
        <motion.div
          animate={{ rotate: angle }}
          transition={{ duration: 3.2, ease: "easeOut" }}
          className="absolute inset-0 rounded-full border-4 border-white/30 shadow-2xl overflow-hidden"
          style={{
            background: `conic-gradient(${SLOTS.map((s, i) => `${s.color} ${i * (360 / SLOTS.length)}deg ${(i + 1) * (360 / SLOTS.length)}deg`).join(",")})`,
          }}
        >
          {SLOTS.map((s, i) => {
            const a = i * (360 / SLOTS.length) + (360 / SLOTS.length) / 2;
            return (
              <div key={i} className="absolute left-1/2 top-1/2 text-white font-black text-sm drop-shadow" style={{
                transform: `translate(-50%, -50%) rotate(${a}deg) translateY(-80px) rotate(${-a}deg)`,
              }}>{s.label}</div>
            );
          })}
        </motion.div>
        {/* Pointer */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-[14px] border-l-transparent border-r-transparent border-t-yellow-300 z-10" />
        {/* Center */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-yellow-300 to-orange-500 border-4 border-white shadow-lg" />
      </div>
      <div className="mt-4">
        <Button onClick={spin} disabled={spinning} className="w-full bg-gradient-to-r from-fuchsia-500 to-pink-600 font-extrabold text-white">
          {spinning ? "Berputar..." : "🎡 PUTAR!"}
        </Button>
      </div>
      <p className="mt-2 text-[10px] opacity-70 text-center">💎 = +50 · x2 = double · 💀 = -10</p>
    </GameShell>
  );
}

/* ========== 10. Balloon Pop (target speed) ========== */
export function BalloonPopGame() {
  const { toast } = useToast();
  const W = 300, H = 380;
  type Bln = { id: number; x: number; y: number; v: number; color: string; type: "normal" | "bonus" | "bomb" };
  const [bs, setBs] = useState<Bln[]>([]);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(35);
  const [running, setRunning] = useState(false);
  const [over, setOver] = useState(false);
  const [reviving, setReviving] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("balloon_best") || 0));
  const idRef = useRef(0);

  const start = () => {
    setBs([]); setScore(0); setTime(35); setOver(false); setReviving(false); setRunning(true);
  };

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTime(s => s <= 1 ? (finish(), 0) : s - 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    const spawn = () => {
      idRef.current += 1;
      const r = Math.random();
      const colors = ["#f43f5e", "#3b82f6", "#facc15", "#22c55e", "#a855f7", "#06b6d4"];
      setBs(b => [...b, {
        id: idRef.current, x: 30 + Math.random() * (W - 60), y: H + 30,
        v: 1.2 + Math.random() * 1.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        type: r < 0.1 ? "bonus" : r < 0.18 ? "bomb" : "normal",
      }]);
    };
    const i = setInterval(spawn, 600);
    return () => clearInterval(i);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const loop = () => {
      setBs(prev => prev.map(b => ({ ...b, y: b.y - b.v })).filter(b => b.y > -40));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const finish = () => {
    setRunning(false); setReviving(false); setOver(true);
    if (score > best) { setBest(score); localStorage.setItem("balloon_best", String(score)); }
    awardAndToast(toast, Math.max(3, Math.floor(score / 4)), "🎈 Selesai!");
  };

  const revive = () => {
    setBs(prev => prev.filter(b => b.type !== "bomb"));
    setReviving(false); setOver(false); setRunning(true);
  };

  const pop = (b: Bln) => {
    if (!running || reviving || over) return;
    if (b.type === "bomb") {
      setRunning(false); setReviving(true);
      return;
    }
    setScore(s => s + (b.type === "bonus" ? 15 : 5));
    setBs(prev => prev.filter(x => x.id !== b.id));
  };

  return (
    <GameShell title="🎈 Balloon Pop" accent="from-pink-950 via-rose-900 to-red-900" best={best}>
      <div className="grid grid-cols-3 gap-2 text-center text-[11px] mb-2">
        <div className="rounded bg-black/30 p-1.5"><div className="opacity-70">Skor</div><div className="font-black">{score}</div></div>
        <div className="rounded bg-black/30 p-1.5"><div className="opacity-70">Waktu</div><div className="font-black">{time}s</div></div>
        <div className="rounded bg-black/30 p-1.5"><div className="opacity-70">Best</div><div className="font-black text-yellow-300">{best}</div></div>
      </div>
      <div className="relative mx-auto rounded-xl overflow-hidden bg-gradient-to-b from-sky-400 to-indigo-600" style={{ width: W, height: H }}>
        {bs.map(b => (
          <button key={b.id} onPointerDown={() => pop(b)} className="absolute" style={{ left: b.x - 18, top: b.y - 22, width: 36, height: 44 }}>
            <div className="w-9 h-10 rounded-full shadow-lg" style={{
              background: b.type === "bomb" ? "#1e1b4b" : b.type === "bonus" ? "linear-gradient(135deg,#facc15,#f59e0b)" : b.color,
            }}>
              <div className="text-center text-white text-sm leading-10 font-black">
                {b.type === "bomb" ? "💣" : b.type === "bonus" ? "⭐" : ""}
              </div>
            </div>
            <div className="w-px h-3 bg-white/60 mx-auto" />
          </button>
        ))}
      </div>
      <div className="mt-3">
        {reviving ? <RevivePrompt active={reviving} scoreLabel={`Skor: ${score}`} onRevive={revive} onExpire={finish} /> : !running && <StartButton label={over ? "Main Lagi" : "Mulai"} onClick={start} color="from-pink-500 to-rose-600" />}
      </div>
      <p className="mt-2 text-[10px] opacity-70 text-center">⭐ +15 · normal +5 · 💣 = game over</p>
    </GameShell>
  );
}
