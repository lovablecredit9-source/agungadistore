// 10 game baru tambahan — ringkas, addictive, mobile-friendly
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints } from "./gameStore";

function Shell({ title, accent, best, children }: { title: string; accent: string; best: number | string; children: React.ReactNode }) {
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
function Btn({ label, onClick, color = "from-amber-500 to-orange-600" }: { label: string; onClick: () => void; color?: string }) {
  return (
    <Button onClick={onClick} className={`w-full bg-gradient-to-r ${color} text-white font-extrabold`}>
      <Play className="w-4 h-4 mr-1" /> {label}
    </Button>
  );
}
function award(toast: any, base: number, label: string) {
  const { awardedPoints } = awardGamePoints(base);
  toast({ title: label, description: `+${awardedPoints} poin` });
}

/* ========== 1. Tic Tac Toe vs AI ========== */
export function TicTacToeGame() {
  const { toast } = useToast();
  const [board, setBoard] = useState<(null | "X" | "O")[]>(Array(9).fill(null));
  const [over, setOver] = useState<string | null>(null);
  const [best, setBest] = useState(() => Number(localStorage.getItem("ttt_best") || 0));
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const win = (b: any[]) => { for (const [a,c,d] of lines) if (b[a] && b[a]===b[c] && b[a]===b[d]) return b[a]; if (b.every(x=>x)) return "draw"; return null; };

  const aiMove = (b: any[]) => {
    // simple: try win, then block, else random
    const empty = b.map((v,i)=>v?-1:i).filter(i=>i>=0);
    for (const i of empty) { const t=[...b]; t[i]="O"; if (win(t)==="O") return i; }
    for (const i of empty) { const t=[...b]; t[i]="X"; if (win(t)==="X") return i; }
    if (b[4]===null) return 4;
    return empty[Math.floor(Math.random()*empty.length)];
  };

  const tap = (i: number) => {
    if (board[i] || over) return;
    const nb = [...board]; nb[i]="X";
    let w = win(nb);
    if (!w) { const m = aiMove(nb); if (m>=0) nb[m]="O"; w = win(nb); }
    setBoard(nb);
    if (w) {
      setOver(w);
      const pts = w==="X"?12:w==="draw"?4:2;
      if (w==="X") { const next = best+1; setBest(next); localStorage.setItem("ttt_best",String(next)); }
      award(toast, pts, w==="X"?"🏆 Menang!":w==="draw"?"🤝 Seri":"😅 Kalah");
    }
  };
  const reset = () => { setBoard(Array(9).fill(null)); setOver(null); };

  return (
    <Shell title="❌⭕ Tic Tac Toe" accent="from-indigo-950 via-purple-900 to-pink-900" best={best}>
      <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto aspect-square">
        {board.map((v,i)=>(
          <button key={i} onClick={()=>tap(i)} className="bg-white/10 hover:bg-white/20 rounded-xl text-4xl font-black active:scale-95 transition flex items-center justify-center">
            <span className={v==="X"?"text-cyan-300":"text-pink-300"}>{v}</span>
          </button>
        ))}
      </div>
      {over && <div className="text-center mt-3 font-black">{over==="draw"?"Seri!":over==="X"?"🏆 Kamu menang!":"😅 AI menang"}</div>}
      <div className="mt-3"><Btn label={over?"Main Lagi":"Reset"} onClick={reset} color="from-indigo-500 to-purple-600" /></div>
    </Shell>
  );
}

/* ========== 2. Higher or Lower ========== */
export function HigherLowerGame() {
  const { toast } = useToast();
  const [card, setCard] = useState(() => Math.floor(Math.random()*13)+1);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("hilo_best") || 0));

  const guess = (h: boolean) => {
    if (over) return;
    const next = Math.floor(Math.random()*13)+1;
    const ok = h ? next > card : next < card;
    setCard(next);
    if (ok) setScore(s=>s+1);
    else {
      setOver(true);
      if (score > best) { setBest(score); localStorage.setItem("hilo_best", String(score)); }
      award(toast, Math.max(3, score*2), "🃏 Game Over");
    }
  };
  const reset = () => { setCard(Math.floor(Math.random()*13)+1); setScore(0); setOver(false); };

  return (
    <Shell title="🃏 Higher or Lower" accent="from-emerald-950 via-teal-900 to-cyan-900" best={best}>
      <div className="text-center mb-3">
        <div className="text-[11px] opacity-80">Skor</div>
        <div className="text-3xl font-black tabular-nums">{score}</div>
      </div>
      <div className="mx-auto w-32 h-44 rounded-2xl bg-white text-slate-900 flex items-center justify-center text-6xl font-black shadow-xl border-4 border-yellow-300">
        {card}
      </div>
      <p className="text-[11px] text-center mt-2 opacity-80">Tebak kartu berikutnya (1-13)</p>
      {!over ? (
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button onClick={()=>guess(true)} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold">⬆ Higher</Button>
          <Button onClick={()=>guess(false)} className="bg-gradient-to-r from-rose-500 to-pink-600 text-white font-extrabold">⬇ Lower</Button>
        </div>
      ) : (
        <div className="mt-3"><Btn label="Main Lagi" onClick={reset} color="from-emerald-500 to-cyan-600" /></div>
      )}
    </Shell>
  );
}

/* ========== 3. Number Order Rush (1→9) ========== */
export function NumberOrderGame() {
  const { toast } = useToast();
  const [nums, setNums] = useState<number[]>([]);
  const [next, setNext] = useState(1);
  const [running, setRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("numord_best") || 9999));
  const startRef = useRef(0);
  const intRef = useRef<number | null>(null);

  const start = () => {
    const arr = Array.from({length:9}, (_,i)=>i+1).sort(()=>Math.random()-0.5);
    setNums(arr); setNext(1); setTime(0); setRunning(true);
    startRef.current = Date.now();
    if (intRef.current) clearInterval(intRef.current);
    intRef.current = window.setInterval(()=> setTime(Date.now()-startRef.current), 50);
  };
  const tap = (n: number) => {
    if (!running) return;
    if (n !== next) return;
    if (n === 9) {
      setRunning(false);
      const t = Date.now()-startRef.current;
      if (intRef.current) clearInterval(intRef.current);
      if (t < best) { setBest(t); localStorage.setItem("numord_best", String(t)); }
      award(toast, Math.max(5, Math.floor(15000/t)), `⏱ ${(t/1000).toFixed(2)}s`);
    } else setNext(n+1);
  };

  return (
    <Shell title="🔢 Number Rush" accent="from-cyan-950 via-blue-900 to-indigo-900" best={best===9999?"-":`${(best/1000).toFixed(2)}s`}>
      <div className="flex items-center justify-between mb-2 text-sm font-bold">
        <span>Tap → <span className="text-yellow-300 text-lg">{next}</span></span>
        <span className="tabular-nums">{(time/1000).toFixed(2)}s</span>
      </div>
      <div className="grid grid-cols-3 gap-2 aspect-square max-w-[280px] mx-auto">
        {(nums.length?nums:Array(9).fill(0)).map((n,i)=>(
          <button key={i} onClick={()=>tap(n)} disabled={!running||n<next}
            className={`rounded-xl text-2xl font-black active:scale-95 transition ${n<next && running ? "bg-emerald-500/30 opacity-40":"bg-white/15 hover:bg-white/25"}`}>
            {n||"·"}
          </button>
        ))}
      </div>
      <div className="mt-3"><Btn label={running?"Reset":"Mulai"} onClick={start} color="from-cyan-500 to-indigo-600" /></div>
    </Shell>
  );
}

/* ========== 4. Color Match Tap ========== */
export function ColorMatchGame() {
  const { toast } = useToast();
  const COLORS = [
    { name:"MERAH", c:"text-red-400" },
    { name:"HIJAU", c:"text-emerald-400" },
    { name:"BIRU", c:"text-blue-400" },
    { name:"KUNING", c:"text-yellow-400" },
  ];
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(20);
  const [word, setWord] = useState(0);
  const [color, setColor] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("colmatch_best") || 0));
  const intRef = useRef<number | null>(null);

  const next = () => {
    const w = Math.floor(Math.random()*4);
    const c = Math.random()<0.5 ? w : Math.floor(Math.random()*4);
    setWord(w); setColor(c);
  };
  const start = () => {
    setScore(0); setTime(20); setRunning(true); next();
    if (intRef.current) clearInterval(intRef.current);
    intRef.current = window.setInterval(()=> setTime(t=>{
      if (t<=1) {
        clearInterval(intRef.current!);
        setRunning(false);
        setScore(s=>{
          if (s>best) { setBest(s); localStorage.setItem("colmatch_best",String(s)); }
          award(toast, Math.max(3, s), "🎨 Selesai");
          return s;
        });
        return 0;
      }
      return t-1;
    }), 1000);
  };
  const ans = (match: boolean) => {
    if (!running) return;
    if ((word===color)===match) setScore(s=>s+1);
    else setScore(s=>Math.max(0,s-1));
    next();
  };
  useEffect(()=> () => { if (intRef.current) clearInterval(intRef.current); }, []);

  return (
    <Shell title="🎨 Color Match" accent="from-fuchsia-950 via-purple-900 to-rose-900" best={best}>
      <div className="flex justify-between text-sm font-bold mb-2"><span>Skor: <span className="text-yellow-300">{score}</span></span><span>{time}s</span></div>
      <div className="h-32 flex items-center justify-center bg-white/10 rounded-xl">
        <span className={`text-4xl font-black ${COLORS[color].c}`}>{running?COLORS[word].name:"SIAP?"}</span>
      </div>
      <p className="text-[11px] text-center mt-2 opacity-80">Apakah <b>arti kata</b> sama dengan <b>warna</b>?</p>
      {running ? (
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button onClick={()=>ans(true)} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-extrabold">✓ SAMA</Button>
          <Button onClick={()=>ans(false)} className="bg-gradient-to-r from-rose-500 to-red-600 text-white font-extrabold">✗ BEDA</Button>
        </div>
      ) : (
        <div className="mt-3"><Btn label="Mulai 20s" onClick={start} color="from-fuchsia-500 to-pink-600" /></div>
      )}
    </Shell>
  );
}

/* ========== 5. Aim Shooter ========== */
export function AimShooterGame() {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(15);
  const [pos, setPos] = useState({x:50,y:50,size:60});
  const [best, setBest] = useState(() => Number(localStorage.getItem("aim_best") || 0));
  const intRef = useRef<number | null>(null);

  const move = useCallback(() => {
    const sz = Math.max(30, 70 - score*1.5);
    setPos({ x: 5+Math.random()*90, y: 5+Math.random()*80, size: sz });
  }, [score]);

  const start = () => {
    setScore(0); setTime(15); setRunning(true); move();
    if (intRef.current) clearInterval(intRef.current);
    intRef.current = window.setInterval(()=> setTime(t=>{
      if (t<=1) {
        clearInterval(intRef.current!);
        setRunning(false);
        setScore(s=>{
          if (s>best) { setBest(s); localStorage.setItem("aim_best",String(s)); }
          award(toast, Math.max(3, s), "🎯 Selesai");
          return s;
        });
        return 0;
      }
      return t-1;
    }), 1000);
  };
  const hit = () => { if (!running) return; setScore(s=>s+1); move(); };
  useEffect(()=> () => { if (intRef.current) clearInterval(intRef.current); }, []);

  return (
    <Shell title="🎯 Aim Shooter" accent="from-red-950 via-rose-900 to-orange-900" best={best}>
      <div className="flex justify-between text-sm font-bold mb-2"><span>Skor: <span className="text-yellow-300">{score}</span></span><span>{time}s</span></div>
      <div className="relative h-72 bg-gradient-to-br from-slate-900 to-black rounded-xl overflow-hidden">
        {running && (
          <button onClick={hit}
            className="absolute rounded-full bg-gradient-to-br from-red-400 to-rose-700 border-4 border-white shadow-lg active:scale-90 transition"
            style={{ left:`${pos.x}%`, top:`${pos.y}%`, width:pos.size, height:pos.size, transform:"translate(-50%,-50%)" }}>
            <span className="text-2xl">🎯</span>
          </button>
        )}
        {!running && <div className="absolute inset-0 flex items-center justify-center text-white/60 font-black">Tap target!</div>}
      </div>
      {!running && <div className="mt-3"><Btn label="Mulai 15s" onClick={start} color="from-red-500 to-rose-600" /></div>}
    </Shell>
  );
}

/* ========== 6. Maze Runner ========== */
export function MazeRunnerGame() {
  const { toast } = useToast();
  const SIZE = 8;
  const [grid, setGrid] = useState<number[][]>([]);
  const [pos, setPos] = useState({x:0,y:0});
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("maze_best") || 9999));

  const gen = () => {
    // simple random walls
    const g: number[][] = Array.from({length:SIZE},()=>Array.from({length:SIZE},()=>Math.random()<0.25?1:0));
    g[0][0]=0; g[SIZE-1][SIZE-1]=0;
    // ensure path: clear row + column
    for (let i=0;i<SIZE;i++){ g[0][i]=Math.random()<0.4?1:0; g[i][SIZE-1]=Math.random()<0.4?1:0; }
    g[0][0]=0; g[SIZE-1][SIZE-1]=0; g[0][SIZE-1]=0;
    setGrid(g); setPos({x:0,y:0}); setMoves(0); setDone(false);
  };
  useEffect(()=>{ gen(); }, []);

  const step = (dx:number,dy:number) => {
    if (done) return;
    const nx = pos.x+dx, ny = pos.y+dy;
    if (nx<0||nx>=SIZE||ny<0||ny>=SIZE) return;
    if (grid[ny][nx]===1) return;
    setPos({x:nx,y:ny});
    setMoves(m=>m+1);
    if (nx===SIZE-1 && ny===SIZE-1) {
      setDone(true);
      const m = moves+1;
      if (m<best) { setBest(m); localStorage.setItem("maze_best",String(m)); }
      award(toast, Math.max(5, 30-m), `🏁 ${m} langkah`);
    }
  };

  return (
    <Shell title="🌀 Maze Runner" accent="from-slate-950 via-zinc-900 to-stone-900" best={best===9999?"-":`${best} mv`}>
      <div className="flex justify-between text-sm font-bold mb-2"><span>Langkah: {moves}</span><span>Goal 🏁</span></div>
      <div className="grid gap-[2px] mx-auto bg-black/40 p-1 rounded-lg" style={{ gridTemplateColumns:`repeat(${SIZE},1fr)`, maxWidth:280 }}>
        {grid.map((row,y)=>row.map((v,x)=>{
          const me = pos.x===x && pos.y===y;
          const goal = x===SIZE-1 && y===SIZE-1;
          return <div key={`${x},${y}`} className={`aspect-square rounded-sm ${v?"bg-zinc-700":"bg-white/15"} flex items-center justify-center text-xs`}>
            {me?"🟡":goal?"🏁":""}
          </div>;
        }))}
      </div>
      <div className="grid grid-cols-3 gap-1 mt-3 max-w-[180px] mx-auto">
        <div></div>
        <Button onClick={()=>step(0,-1)} className="bg-white/15">▲</Button>
        <div></div>
        <Button onClick={()=>step(-1,0)} className="bg-white/15">◀</Button>
        <Button onClick={gen} className="bg-amber-500/80"><RotateCcw className="w-4 h-4"/></Button>
        <Button onClick={()=>step(1,0)} className="bg-white/15">▶</Button>
        <div></div>
        <Button onClick={()=>step(0,1)} className="bg-white/15">▼</Button>
        <div></div>
      </div>
    </Shell>
  );
}

/* ========== 7. Defuse Sequence ========== */
export function DefuseGame() {
  const { toast } = useToast();
  const [seq, setSeq] = useState<number[]>([]);
  const [step, setStep] = useState(0);
  const [time, setTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("defuse_best") || 0));
  const intRef = useRef<number | null>(null);

  const start = () => {
    const len = 5 + Math.floor(Math.random()*4);
    setSeq(Array.from({length:len}, ()=>Math.floor(Math.random()*6)+1));
    setStep(0); setTime(15); setRunning(true);
    if (intRef.current) clearInterval(intRef.current);
    intRef.current = window.setInterval(()=> setTime(t=>{
      if (t<=1) { clearInterval(intRef.current!); setRunning(false); award(toast,2,"💥 BOOM!"); return 0; }
      return t-1;
    }), 1000);
  };
  const tap = (n: number) => {
    if (!running) return;
    if (seq[step]!==n) { setRunning(false); if (intRef.current) clearInterval(intRef.current); award(toast,2,"💥 Salah!"); return; }
    const ns = step+1;
    if (ns>=seq.length) {
      setRunning(false); if (intRef.current) clearInterval(intRef.current);
      const score = seq.length*10 + time;
      if (score>best) { setBest(score); localStorage.setItem("defuse_best",String(score)); }
      award(toast, Math.max(8, score), "🛡 DEFUSED!");
    }
    setStep(ns);
  };

  return (
    <Shell title="💣 Defuse" accent="from-yellow-950 via-amber-900 to-red-950" best={best}>
      <div className="flex justify-between text-sm font-bold mb-2"><span>⏱ {time}s</span><span>{step}/{seq.length||"-"}</span></div>
      <div className="bg-black/40 rounded-xl p-3 min-h-[60px] flex items-center justify-center gap-1.5 flex-wrap">
        {running ? seq.map((n,i)=>(
          <span key={i} className={`w-8 h-10 rounded-md flex items-center justify-center font-black text-lg ${i<step?"bg-emerald-500/40":"bg-white/15"}`}>
            {i<step?n:"?"}
          </span>
        )) : <span className="text-white/60 font-bold">Hafalkan urutan & tekan tombol!</span>}
      </div>
      {running && step<seq.length && <div className="text-center mt-2 text-xs">Berikutnya: <span className="text-yellow-300 font-black text-lg">{seq[step]}</span></div>}
      <div className="grid grid-cols-3 gap-2 mt-3">
        {[1,2,3,4,5,6].map(n=>(
          <Button key={n} onClick={()=>tap(n)} className="bg-gradient-to-br from-amber-500 to-red-600 text-white font-black text-xl">{n}</Button>
        ))}
      </div>
      {!running && <div className="mt-3"><Btn label="Mulai" onClick={start} color="from-amber-500 to-red-600" /></div>}
    </Shell>
  );
}

/* ========== 8. Coin Flip Streak ========== */
export function CoinFlipGame() {
  const { toast } = useToast();
  const [streak, setStreak] = useState(0);
  const [last, setLast] = useState<"H"|"T"|null>(null);
  const [over, setOver] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("coin_best") || 0));
  const [flipping, setFlipping] = useState(false);

  const flip = (pick: "H"|"T") => {
    if (flipping || over) return;
    setFlipping(true);
    setTimeout(()=>{
      const r = Math.random()<0.5?"H":"T";
      setLast(r); setFlipping(false);
      if (r===pick) setStreak(s=>s+1);
      else {
        setOver(true);
        if (streak>best) { setBest(streak); localStorage.setItem("coin_best",String(streak)); }
        award(toast, Math.max(2, streak*3), `🪙 Streak ${streak}`);
      }
    }, 600);
  };
  const reset = () => { setStreak(0); setLast(null); setOver(false); };

  return (
    <Shell title="🪙 Coin Flip" accent="from-amber-950 via-yellow-900 to-orange-900" best={best}>
      <div className="text-center mb-3">
        <div className="text-[11px] opacity-80">Streak</div>
        <div className="text-4xl font-black tabular-nums text-yellow-300">{streak}</div>
      </div>
      <div className="mx-auto w-32 h-32 rounded-full bg-gradient-to-br from-yellow-300 to-amber-600 flex items-center justify-center text-5xl font-black text-yellow-950 shadow-xl border-4 border-yellow-200" style={{ transform: flipping?"rotateY(720deg)":"none", transition:"transform 0.6s" }}>
        {flipping?"?":last==="H"?"H":last==="T"?"T":"?"}
      </div>
      {!over ? (
        <div className="grid grid-cols-2 gap-2 mt-3">
          <Button disabled={flipping} onClick={()=>flip("H")} className="bg-gradient-to-r from-amber-500 to-orange-600 text-white font-extrabold">HEADS</Button>
          <Button disabled={flipping} onClick={()=>flip("T")} className="bg-gradient-to-r from-zinc-500 to-zinc-700 text-white font-extrabold">TAILS</Button>
        </div>
      ) : (
        <div className="mt-3"><Btn label="Coba Lagi" onClick={reset} color="from-amber-500 to-orange-600" /></div>
      )}
    </Shell>
  );
}

/* ========== 9. Word Scramble Speed ========== */
export function WordScrambleGame() {
  const { toast } = useToast();
  const WORDS = ["KUCING","KOMPUTER","JAKARTA","SEPATU","BUKU","MOBIL","PISANG","RUMAH","INDONESIA","HANDPHONE","KELUARGA","SEKOLAH","PANTAI","GUNUNG","MUSIK"];
  const [target, setTarget] = useState("");
  const [scram, setScram] = useState("");
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(45);
  const [running, setRunning] = useState(false);
  const [best, setBest] = useState(() => Number(localStorage.getItem("scram_best") || 0));
  const intRef = useRef<number | null>(null);

  const next = () => {
    const w = WORDS[Math.floor(Math.random()*WORDS.length)];
    setTarget(w);
    setScram(w.split("").sort(()=>Math.random()-0.5).join(""));
    setInput("");
  };
  const start = () => {
    setScore(0); setTime(45); setRunning(true); next();
    if (intRef.current) clearInterval(intRef.current);
    intRef.current = window.setInterval(()=> setTime(t=>{
      if (t<=1) {
        clearInterval(intRef.current!); setRunning(false);
        setScore(s=>{
          if (s>best) { setBest(s); localStorage.setItem("scram_best",String(s)); }
          award(toast, Math.max(3, s*2), "🔤 Selesai");
          return s;
        });
        return 0;
      }
      return t-1;
    }), 1000);
  };
  useEffect(()=> () => { if (intRef.current) clearInterval(intRef.current); }, []);
  const submit = () => {
    if (!running) return;
    if (input.toUpperCase()===target) { setScore(s=>s+1); next(); }
    else setInput("");
  };

  return (
    <Shell title="🔤 Word Scramble" accent="from-teal-950 via-cyan-900 to-blue-900" best={best}>
      <div className="flex justify-between text-sm font-bold mb-2"><span>Skor: <span className="text-yellow-300">{score}</span></span><span>{time}s</span></div>
      <div className="bg-white/15 rounded-xl p-4 text-center font-black text-2xl tracking-[0.3em]">{running?scram:"SIAP?"}</div>
      {running && (
        <>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}
            placeholder="Tulis jawaban..." className="mt-2 w-full bg-white/10 rounded-lg p-2 text-white placeholder-white/40 outline-none border border-white/20 uppercase tracking-wider"/>
          <Button onClick={submit} className="mt-2 w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-extrabold">Submit</Button>
        </>
      )}
      {!running && <div className="mt-3"><Btn label="Mulai 45s" onClick={start} color="from-teal-500 to-cyan-600" /></div>}
    </Shell>
  );
}

/* ========== 10. Doodle Climb ========== */
export function DoodleClimbGame() {
  const { toast } = useToast();
  const ref = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem("doodle_best") || 0));
  const stateRef = useRef<any>({});
  const dirRef = useRef<-1|0|1>(0);

  const start = () => {
    setScore(0); setRunning(true);
    const W=300,H=400;
    const platforms = Array.from({length:8},(_,i)=>({x:Math.random()*(W-60), y:H-i*55, w:60}));
    stateRef.current = { W,H, x:W/2-15, y:H-100, vy:-8, platforms };
  };

  useEffect(()=>{
    if (!running) return;
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const loop = () => {
      const s = stateRef.current;
      // physics
      s.vy += 0.4;
      s.y += s.vy;
      s.x += dirRef.current * 5;
      if (s.x<0) s.x = s.W-30; if (s.x>s.W-30) s.x=0;
      // scroll
      if (s.y < s.H/2) {
        const dy = s.H/2 - s.y;
        s.y = s.H/2;
        s.platforms.forEach((p:any)=>p.y += dy);
        setScore(v=>v+Math.floor(dy));
      }
      // collision
      s.platforms.forEach((p:any)=>{
        if (s.vy>0 && s.x+30>p.x && s.x<p.x+p.w && s.y+30>p.y && s.y+30<p.y+10) s.vy = -10;
      });
      // recycle
      s.platforms = s.platforms.map((p:any)=>{
        if (p.y > s.H) return { x: Math.random()*(s.W-60), y: p.y-s.H, w:60 };
        return p;
      });
      // game over
      if (s.y > s.H+30) {
        setRunning(false);
        setScore(v=>{
          if (v>best) { setBest(v); localStorage.setItem("doodle_best",String(v)); }
          award(toast, Math.max(3, Math.floor(v/30)), "🪂 Jatuh");
          return v;
        });
        return;
      }
      // draw
      ctx.fillStyle = "#0f172a"; ctx.fillRect(0,0,s.W,s.H);
      ctx.fillStyle = "#22c55e";
      s.platforms.forEach((p:any)=> ctx.fillRect(p.x, p.y, p.w, 8));
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath(); ctx.arc(s.x+15, s.y+15, 15, 0, Math.PI*2); ctx.fill();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return ()=> cancelAnimationFrame(raf);
  }, [running, best, toast]);

  return (
    <Shell title="🦘 Doodle Climb" accent="from-emerald-950 via-green-900 to-teal-900" best={best}>
      <div className="flex justify-between text-sm font-bold mb-2"><span>Skor: <span className="text-yellow-300 tabular-nums">{score}</span></span></div>
      <div className="bg-black/40 rounded-xl overflow-hidden flex justify-center">
        <canvas ref={ref} width={300} height={400} className="bg-slate-900" />
      </div>
      <div className="grid grid-cols-2 gap-2 mt-3">
        <Button onTouchStart={()=>dirRef.current=-1} onTouchEnd={()=>dirRef.current=0}
          onMouseDown={()=>dirRef.current=-1} onMouseUp={()=>dirRef.current=0} onMouseLeave={()=>dirRef.current=0}
          className="bg-white/15 text-white font-black text-xl">◀ Kiri</Button>
        <Button onTouchStart={()=>dirRef.current=1} onTouchEnd={()=>dirRef.current=0}
          onMouseDown={()=>dirRef.current=1} onMouseUp={()=>dirRef.current=0} onMouseLeave={()=>dirRef.current=0}
          className="bg-white/15 text-white font-black text-xl">Kanan ▶</Button>
      </div>
      {!running && <div className="mt-3"><Btn label="Mulai" onClick={start} color="from-emerald-500 to-teal-600" /></div>}
    </Shell>
  );
}
