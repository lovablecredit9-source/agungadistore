/**
 * MegaGamesPack — 100 mini-games via 10 reusable mechanics × 10 themed variants.
 * Semua game ringan, no-network, no-AI. Cocok untuk filler.
 */
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Timer, RotateCcw, Sparkles } from "lucide-react";

// ============ Shared UI ============
function GameShell({ title, score, time, children, onRestart, finished, finalScore, finalLabel }: {
  title: string; score?: number; time?: number; children: React.ReactNode;
  onRestart?: () => void; finished?: boolean; finalScore?: number; finalLabel?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-black text-sm flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-amber-500" />{title}</h3>
        <div className="flex items-center gap-2 text-[11px] font-bold">
          {typeof score === "number" && <span className="rounded-full bg-emerald-500/15 text-emerald-600 px-2 py-0.5 flex items-center gap-1"><Trophy className="w-3 h-3" />{score}</span>}
          {typeof time === "number" && <span className="rounded-full bg-blue-500/15 text-blue-600 px-2 py-0.5 flex items-center gap-1"><Timer className="w-3 h-3" />{time}s</span>}
        </div>
      </div>
      {finished ? (
        <div className="text-center py-6 space-y-3">
          <p className="text-3xl">🎉</p>
          <p className="font-black text-lg">Skor: {finalScore ?? score}</p>
          {finalLabel && <p className="text-xs text-muted-foreground">{finalLabel}</p>}
          <Button onClick={onRestart} className="gap-1"><RotateCcw className="w-3.5 h-3.5" />Main lagi</Button>
        </div>
      ) : children}
    </div>
  );
}

// ============ Mechanic 1: TapRush ============
function TapRush({ emoji, duration = 20 }: { emoji: string; duration?: number }) {
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(duration);
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (done) return;
    if (time <= 0) { setDone(true); return; }
    const t = setTimeout(() => setTime(time - 1), 1000);
    return () => clearTimeout(t);
  }, [time, done]);
  const restart = () => { setScore(0); setTime(duration); setDone(false); };
  const move = () => setPos({ x: 5 + Math.random() * 80, y: 5 + Math.random() * 75 });
  return (
    <GameShell title="Tap Rush" score={score} time={time} finished={done} onRestart={restart}>
      <div className="relative h-64 rounded-xl bg-gradient-to-br from-violet-500/20 to-pink-500/20 overflow-hidden">
        <motion.button
          key={`${pos.x}-${pos.y}`}
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          onClick={() => { setScore((s) => s + 1); move(); }}
          className="absolute text-3xl select-none"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        >{emoji}</motion.button>
      </div>
      <p className="text-[10px] text-muted-foreground text-center">Tap {emoji} secepat mungkin!</p>
    </GameShell>
  );
}

// ============ Mechanic 2: Reflex ============
function Reflex({ rounds = 5 }: { rounds?: number }) {
  const [phase, setPhase] = useState<"wait" | "go" | "early" | "result">("wait");
  const [start, setStart] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [done, setDone] = useState(false);
  const timer = useRef<any>(null);
  const begin = useCallback(() => {
    setPhase("wait");
    timer.current = setTimeout(() => { setPhase("go"); setStart(Date.now()); }, 800 + Math.random() * 2200);
  }, []);
  useEffect(() => { begin(); return () => clearTimeout(timer.current); }, [begin]);
  const tap = () => {
    if (phase === "wait") { clearTimeout(timer.current); setPhase("early"); setTimeout(begin, 800); return; }
    if (phase === "go") {
      const t = Date.now() - start;
      const next = [...times, t];
      setTimes(next);
      if (next.length >= rounds) { setDone(true); }
      else { setPhase("result"); setTimeout(begin, 700); }
    }
  };
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const restart = () => { setTimes([]); setDone(false); begin(); };
  return (
    <GameShell title="Reflex Test" score={times.length} finished={done} onRestart={restart} finalScore={avg} finalLabel={`Rata-rata ${avg} ms`}>
      <button onClick={tap} className={`h-56 w-full rounded-xl text-white font-black text-lg ${phase === "go" ? "bg-emerald-500" : phase === "early" ? "bg-rose-500" : "bg-amber-500"}`}>
        {phase === "wait" && "Tunggu hijau..."}
        {phase === "go" && "TAP SEKARANG!"}
        {phase === "early" && "Terlalu cepat! 😅"}
        {phase === "result" && `${times[times.length - 1]} ms`}
      </button>
    </GameShell>
  );
}

// ============ Mechanic 3: Memory Sequence ============
function MemorySeq({ palette }: { palette: string[] }) {
  const [seq, setSeq] = useState<number[]>([]);
  const [user, setUser] = useState<number[]>([]);
  const [showing, setShowing] = useState(-1);
  const [phase, setPhase] = useState<"show" | "input" | "over">("show");
  const [score, setScore] = useState(0);
  const next = useCallback((s: number[]) => {
    const ns = [...s, Math.floor(Math.random() * palette.length)];
    setSeq(ns); setUser([]); setPhase("show");
    ns.forEach((v, i) => {
      setTimeout(() => setShowing(v), 600 * i + 300);
      setTimeout(() => setShowing(-1), 600 * i + 600);
    });
    setTimeout(() => setPhase("input"), 600 * ns.length + 400);
  }, [palette.length]);
  useEffect(() => { next([]); }, [next]);
  const tap = (i: number) => {
    if (phase !== "input") return;
    const nu = [...user, i];
    if (seq[nu.length - 1] !== i) { setPhase("over"); return; }
    if (nu.length === seq.length) { setScore(nu.length); setTimeout(() => next(seq), 500); }
    else setUser(nu);
  };
  const restart = () => { setScore(0); setSeq([]); setUser([]); next([]); };
  return (
    <GameShell title="Memory Sequence" score={score} finished={phase === "over"} onRestart={restart}>
      <div className="grid grid-cols-2 gap-2 h-56">
        {palette.map((c, i) => (
          <button key={i} onClick={() => tap(i)}
            className={`rounded-xl transition-all ${c} ${showing === i ? "scale-95 brightness-150 ring-4 ring-white" : "brightness-75"}`} />
        ))}
      </div>
      <p className="text-[10px] text-center text-muted-foreground">{phase === "show" ? "Perhatikan urutan..." : phase === "input" ? "Ulangi urutan!" : "Game Over!"}</p>
    </GameShell>
  );
}

// ============ Mechanic 4: Math Quiz ============
function MathQuiz({ ops, max = 12, total = 10 }: { ops: ("+" | "-" | "×" | "÷")[]; max?: number; total?: number }) {
  const gen = useCallback(() => {
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a = Math.floor(Math.random() * max) + 1, b = Math.floor(Math.random() * max) + 1, ans = 0;
    if (op === "+") ans = a + b;
    if (op === "-") { if (b > a) [a, b] = [b, a]; ans = a - b; }
    if (op === "×") ans = a * b;
    if (op === "÷") { ans = a; const c = a * b; a = c; ans = c / b; }
    const opts = new Set<number>([ans]);
    while (opts.size < 4) opts.add(ans + Math.floor(Math.random() * 11) - 5);
    return { q: `${a} ${op} ${b}`, ans, opts: Array.from(opts).sort(() => Math.random() - 0.5) };
  }, [ops, max]);
  const [q, setQ] = useState(gen);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const pick = (n: number) => {
    if (n === q.ans) setScore((s) => s + 1);
    if (i + 1 >= total) setDone(true); else { setI(i + 1); setQ(gen()); }
  };
  const restart = () => { setI(0); setScore(0); setDone(false); setQ(gen()); };
  return (
    <GameShell title="Math Quiz" score={score} finished={done} onRestart={restart} finalLabel={`${score} / ${total} benar`}>
      <div className="rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 p-6 text-center">
        <p className="text-[10px] text-muted-foreground">Soal {i + 1}/{total}</p>
        <p className="text-3xl font-black mt-2">{q.q} = ?</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {q.opts.map((o) => (
          <Button key={o} variant="outline" onClick={() => pick(o)} className="h-12 text-base font-black">{o}</Button>
        ))}
      </div>
    </GameShell>
  );
}

// ============ Mechanic 5: Word Scramble ============
function Scramble({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [input, setInput] = useState("");
  const [done, setDone] = useState(false);
  const word = words[i];
  const scrambled = useMemo(() => word.split("").sort(() => Math.random() - 0.5).join(""), [word]);
  const submit = () => {
    if (input.toLowerCase() === word.toLowerCase()) setScore((s) => s + 1);
    if (i + 1 >= words.length) setDone(true); else { setI(i + 1); setInput(""); }
  };
  const restart = () => { setI(0); setScore(0); setInput(""); setDone(false); };
  return (
    <GameShell title="Word Scramble" score={score} finished={done} onRestart={restart} finalLabel={`${score} / ${words.length} benar`}>
      <div className="rounded-xl bg-gradient-to-br from-amber-500/20 to-rose-500/20 p-6 text-center">
        <p className="text-[10px] text-muted-foreground">Kata {i + 1}/{words.length}</p>
        <p className="text-3xl font-black mt-2 tracking-widest">{scrambled.toUpperCase()}</p>
      </div>
      <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Tebakanmu..." className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
      <Button onClick={submit} disabled={!input} className="w-full">Cek</Button>
    </GameShell>
  );
}

// ============ Mechanic 6: Odd One Out ============
function OddOne({ pool, gridSize = 16 }: { pool: [string, string][]; gridSize?: number }) {
  const make = useCallback(() => {
    const [a, b] = pool[Math.floor(Math.random() * pool.length)];
    const arr = Array(gridSize).fill(a);
    const idx = Math.floor(Math.random() * gridSize);
    arr[idx] = b;
    return { arr, idx };
  }, [pool, gridSize]);
  const [{ arr, idx }, setBoard] = useState(make);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(30);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (done) return;
    if (time <= 0) { setDone(true); return; }
    const t = setTimeout(() => setTime(time - 1), 1000);
    return () => clearTimeout(t);
  }, [time, done]);
  const tap = (i: number) => { if (i === idx) { setScore((s) => s + 1); setBoard(make()); } };
  const restart = () => { setScore(0); setTime(30); setDone(false); setBoard(make()); };
  return (
    <GameShell title="Odd One Out" score={score} time={time} finished={done} onRestart={restart}>
      <div className="grid grid-cols-4 gap-1.5">
        {arr.map((e, i) => (
          <button key={i} onClick={() => tap(i)} className="aspect-square rounded-lg bg-muted hover:bg-muted/70 text-2xl flex items-center justify-center">{e}</button>
        ))}
      </div>
      <p className="text-[10px] text-center text-muted-foreground">Cari emoji yang berbeda!</p>
    </GameShell>
  );
}

// ============ Mechanic 7: Stroop / Color Match ============
function Stroop({ rounds = 12 }: { rounds?: number }) {
  const colors = [
    { name: "MERAH", cls: "text-red-500" },
    { name: "BIRU", cls: "text-blue-500" },
    { name: "HIJAU", cls: "text-emerald-500" },
    { name: "KUNING", cls: "text-yellow-500" },
  ];
  const gen = () => {
    const word = colors[Math.floor(Math.random() * colors.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    return { word, color };
  };
  const [q, setQ] = useState(gen);
  const [i, setI] = useState(0);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const pick = (name: string) => {
    if (name === q.color.name) setScore((s) => s + 1);
    if (i + 1 >= rounds) setDone(true); else { setI(i + 1); setQ(gen()); }
  };
  const restart = () => { setI(0); setScore(0); setDone(false); setQ(gen()); };
  return (
    <GameShell title="Color Stroop" score={score} finished={done} onRestart={restart} finalLabel={`${score}/${rounds}`}>
      <div className="rounded-xl bg-muted/40 p-8 text-center">
        <p className={`text-4xl font-black ${q.color.cls}`}>{q.word.name}</p>
        <p className="text-[10px] text-muted-foreground mt-2">Pilih WARNA tulisan, bukan kata-nya!</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {colors.map((c) => <Button key={c.name} variant="outline" onClick={() => pick(c.name)} className="font-black">{c.name}</Button>)}
      </div>
    </GameShell>
  );
}

// ============ Mechanic 8: Count Emoji ============
function CountIt({ emoji }: { emoji: string }) {
  const gen = () => {
    const total = 8 + Math.floor(Math.random() * 25);
    const count = 2 + Math.floor(Math.random() * (total - 3));
    const arr = Array(total).fill("⬜").map((_, i) => i < count ? emoji : "⬜").sort(() => Math.random() - 0.5);
    const opts = new Set<number>([count]);
    while (opts.size < 4) opts.add(Math.max(1, count + Math.floor(Math.random() * 7) - 3));
    return { arr, count, opts: Array.from(opts).sort((a, b) => a - b) };
  };
  const [q, setQ] = useState(gen);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);
  const pick = (n: number) => {
    if (n === q.count) setScore((s) => s + 1);
    if (round + 1 >= 8) setDone(true); else { setRound(round + 1); setQ(gen()); }
  };
  const restart = () => { setRound(0); setScore(0); setDone(false); setQ(gen()); };
  return (
    <GameShell title="Count It" score={score} finished={done} onRestart={restart} finalLabel={`${score}/8 benar`}>
      <div className="rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 p-3 grid grid-cols-8 gap-1 text-xl text-center">
        {q.arr.map((e, i) => <span key={i}>{e}</span>)}
      </div>
      <p className="text-xs text-center font-bold">Berapa {emoji}?</p>
      <div className="grid grid-cols-4 gap-2">
        {q.opts.map((o) => <Button key={o} variant="outline" onClick={() => pick(o)} className="font-black">{o}</Button>)}
      </div>
    </GameShell>
  );
}

// ============ Mechanic 9: Type It ============
function TypeIt({ words }: { words: string[] }) {
  const [i, setI] = useState(0);
  const [input, setInput] = useState("");
  const [time, setTime] = useState(30);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (done) return;
    if (time <= 0) { setDone(true); return; }
    const t = setTimeout(() => setTime(time - 1), 1000);
    return () => clearTimeout(t);
  }, [time, done]);
  useEffect(() => {
    if (input.trim().toLowerCase() === words[i].toLowerCase()) {
      setScore((s) => s + 1); setI((idx) => (idx + 1) % words.length); setInput("");
    }
  }, [input, i, words]);
  const restart = () => { setI(0); setInput(""); setScore(0); setTime(30); setDone(false); };
  return (
    <GameShell title="Type It" score={score} time={time} finished={done} onRestart={restart} finalLabel={`${score} kata`}>
      <div className="rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-purple-500/20 p-6 text-center">
        <p className="text-3xl font-black tracking-wide">{words[i]}</p>
      </div>
      <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Ketik di sini..." />
    </GameShell>
  );
}

// ============ Mechanic 10: Sort Order ============
function SortOrder({ size = 6 }: { size?: number }) {
  const make = () => {
    const nums = Array.from({ length: size }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
    return { nums, expect: 1 };
  };
  const [{ nums, expect }, setBoard] = useState(make);
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(30);
  const [done, setDone] = useState(false);
  const [tapped, setTapped] = useState<number[]>([]);
  useEffect(() => {
    if (done) return;
    if (time <= 0) { setDone(true); return; }
    const t = setTimeout(() => setTime(time - 1), 1000);
    return () => clearTimeout(t);
  }, [time, done]);
  const tap = (n: number) => {
    if (tapped.includes(n)) return;
    if (n === expect) {
      const nt = [...tapped, n];
      if (n === size) { setScore((s) => s + 1); setBoard(make()); setTapped([]); }
      else { setTapped(nt); setBoard({ nums, expect: expect + 1 }); }
    }
  };
  const restart = () => { setBoard(make()); setScore(0); setTime(30); setDone(false); setTapped([]); };
  return (
    <GameShell title="Sort 1→N" score={score} time={time} finished={done} onRestart={restart}>
      <div className="grid grid-cols-3 gap-2">
        {nums.map((n) => (
          <button key={n} onClick={() => tap(n)} disabled={tapped.includes(n)}
            className={`aspect-square rounded-xl text-xl font-black ${tapped.includes(n) ? "bg-emerald-500 text-white" : "bg-muted hover:bg-muted/70"}`}>{n}</button>
        ))}
      </div>
      <p className="text-[10px] text-center text-muted-foreground">Tap berurut 1 s/d {size}</p>
    </GameShell>
  );
}

// ============ Game Catalog (100) ============
type Kind = "tap" | "reflex" | "memory" | "math" | "scramble" | "odd" | "stroop" | "count" | "type" | "sort";
export interface MegaGame {
  mode: string; title: string; desc: string; emoji: string; gradient: string; kind: Kind; params?: any;
}

const PALETTES = [
  ["bg-red-500", "bg-blue-500", "bg-yellow-500", "bg-green-500"],
  ["bg-fuchsia-500", "bg-cyan-500", "bg-amber-500", "bg-emerald-500"],
  ["bg-pink-500", "bg-indigo-500", "bg-orange-500", "bg-teal-500"],
  ["bg-rose-500", "bg-sky-500", "bg-lime-500", "bg-violet-500"],
];

const WORDS_ID = ["KUCING", "GUNUNG", "PANTAI", "MOBIL", "SEPATU", "MATAHARI", "BUNGA", "GAJAH"];
const WORDS_EN = ["LIGHT", "PIZZA", "ROCKET", "GUITAR", "WINTER", "DRAGON", "BASKET", "PLANET"];
const WORDS_FOOD = ["NASI", "BAKSO", "SATE", "GADO", "SOTO", "RENDANG", "PEMPEK", "MARTABAK"];
const WORDS_ANIMAL = ["HARIMAU", "JERAPAH", "BURUNG", "SINGA", "ZEBRA", "KOALA", "PANDA", "RUSA"];
const TYPE_FAST = ["cepat", "kilat", "hebat", "juara", "neon", "kosmik", "petir", "badai", "mantap", "keren"];

const themes: { emoji: string; label: string; gradient: string }[] = [
  { emoji: "🍕", label: "Pizza", gradient: "from-orange-500 to-red-600" },
  { emoji: "🚀", label: "Roket", gradient: "from-indigo-500 to-purple-700" },
  { emoji: "⭐", label: "Bintang", gradient: "from-amber-400 to-yellow-600" },
  { emoji: "🎈", label: "Balon", gradient: "from-pink-500 to-rose-600" },
  { emoji: "🐶", label: "Anjing", gradient: "from-amber-600 to-orange-700" },
  { emoji: "🐱", label: "Kucing", gradient: "from-zinc-500 to-zinc-700" },
  { emoji: "🦄", label: "Unicorn", gradient: "from-fuchsia-400 to-violet-600" },
  { emoji: "🍩", label: "Donat", gradient: "from-pink-400 to-rose-600" },
  { emoji: "💎", label: "Permata", gradient: "from-cyan-400 to-blue-600" },
  { emoji: "👻", label: "Hantu", gradient: "from-slate-500 to-slate-700" },
];

const ODD_PAIRS: [string, string][] = [
  ["🍎", "🍏"], ["😀", "😃"], ["🐶", "🐺"], ["⚽", "🏀"], ["🌞", "⭐"],
  ["🌹", "🌷"], ["🐟", "🐠"], ["🚗", "🚙"], ["🍕", "🍔"], ["🎈", "🎀"],
];

export const MEGA_GAMES: MegaGame[] = [
  // 10x TapRush themed
  ...themes.map((t, i): MegaGame => ({
    mode: `mg_tap_${i}`, title: `Tap ${t.label}`, desc: `Tap ${t.emoji} sebanyak mungkin`, emoji: t.emoji,
    gradient: t.gradient, kind: "tap", params: { emoji: t.emoji, duration: 20 },
  })),
  // 10x Reflex variations
  ...themes.map((t, i): MegaGame => ({
    mode: `mg_reflex_${i}`, title: `Reflex ${t.label}`, desc: `Refleks tap pas sinyal hijau`, emoji: "⚡",
    gradient: t.gradient, kind: "reflex", params: { rounds: 5 },
  })),
  // 10x Memory variations
  ...Array.from({ length: 10 }, (_, i): MegaGame => ({
    mode: `mg_mem_${i}`, title: `Memory ${i + 1}`, desc: "Ingat & ulangi urutan warna", emoji: "🧠",
    gradient: themes[i].gradient, kind: "memory", params: { palette: PALETTES[i % PALETTES.length] },
  })),
  // 10x Math variations
  ...[
    { ops: ["+"], label: "Tambah", emoji: "➕" },
    { ops: ["-"], label: "Kurang", emoji: "➖" },
    { ops: ["×"], label: "Kali", emoji: "✖️" },
    { ops: ["÷"], label: "Bagi", emoji: "➗" },
    { ops: ["+", "-"], label: "Tambah/Kurang", emoji: "🔢" },
    { ops: ["×", "÷"], label: "Kali/Bagi", emoji: "🧮" },
    { ops: ["+", "-", "×"], label: "Mix Mudah", emoji: "📐" },
    { ops: ["+", "-", "×", "÷"], label: "Mix Lengkap", emoji: "📊" },
    { ops: ["×"], label: "Perkalian Kilat", emoji: "🚀", max: 9 },
    { ops: ["+"], label: "Tambah Cepat", emoji: "⚡", max: 20 },
  ].map((m, i): MegaGame => ({
    mode: `mg_math_${i}`, title: `Math ${m.label}`, desc: "Jawab 10 soal dengan cepat", emoji: m.emoji,
    gradient: themes[i].gradient, kind: "math", params: { ops: m.ops, max: m.max ?? 12 },
  })),
  // 10x Scramble variations
  ...[
    { w: WORDS_ID, label: "ID 1", emoji: "🇮🇩" },
    { w: WORDS_ID.slice().reverse(), label: "ID 2", emoji: "📚" },
    { w: WORDS_EN, label: "EN 1", emoji: "🔤" },
    { w: WORDS_EN.slice().reverse(), label: "EN 2", emoji: "🆎" },
    { w: WORDS_FOOD, label: "Makanan", emoji: "🍜" },
    { w: WORDS_ANIMAL, label: "Hewan", emoji: "🦁" },
    { w: ["LOVABLE", "AGUNG", "STORE", "MURAH", "GAME"], label: "Brand", emoji: "🛍️" },
    { w: ["PADI", "JAGUNG", "TEBU", "KOPI", "TEH"], label: "Tani", emoji: "🌾" },
    { w: ["LARI", "RENANG", "SEPAK", "BASKET", "TENIS"], label: "Olahraga", emoji: "🏃" },
    { w: ["MERAH", "HIJAU", "BIRU", "KUNING", "UNGU"], label: "Warna", emoji: "🎨" },
  ].map((m, i): MegaGame => ({
    mode: `mg_scr_${i}`, title: `Scramble ${m.label}`, desc: "Susun huruf jadi kata", emoji: m.emoji,
    gradient: themes[i].gradient, kind: "scramble", params: { words: m.w },
  })),
  // 10x OddOne variations
  ...ODD_PAIRS.map((p, i): MegaGame => ({
    mode: `mg_odd_${i}`, title: `Odd ${p[0]}vs${p[1]}`, desc: "Cari yang beda dari grid", emoji: p[1],
    gradient: themes[i].gradient, kind: "odd", params: { pool: [p], gridSize: 16 },
  })),
  // 10x Stroop variations (different round counts)
  ...Array.from({ length: 10 }, (_, i): MegaGame => ({
    mode: `mg_stroop_${i}`, title: `Stroop ${i + 1}`, desc: "Pilih warna, abaikan tulisan", emoji: "🎨",
    gradient: themes[i].gradient, kind: "stroop", params: { rounds: 8 + i },
  })),
  // 10x Count emoji variations
  ...themes.map((t, i): MegaGame => ({
    mode: `mg_count_${i}`, title: `Count ${t.label}`, desc: `Hitung ${t.emoji} di grid`, emoji: t.emoji,
    gradient: t.gradient, kind: "count", params: { emoji: t.emoji },
  })),
  // 10x Type It variations
  ...Array.from({ length: 10 }, (_, i): MegaGame => ({
    mode: `mg_type_${i}`, title: `Type Speed ${i + 1}`, desc: "Ketik kata 30 detik", emoji: "⌨️",
    gradient: themes[i].gradient, kind: "type",
    params: { words: TYPE_FAST.slice().sort(() => Math.random() - 0.5) },
  })),
  // 10x Sort variations
  ...Array.from({ length: 10 }, (_, i): MegaGame => ({
    mode: `mg_sort_${i}`, title: `Sort ${4 + i}`, desc: `Tap angka 1 s/d ${4 + i}`, emoji: "🔢",
    gradient: themes[i % themes.length].gradient, kind: "sort", params: { size: 4 + i },
  })),
];

// Factory: build a no-arg component for a given config
export function makeMegaComponent(g: MegaGame): React.ComponentType {
  const Comp = () => {
    switch (g.kind) {
      case "tap": return <TapRush {...g.params} />;
      case "reflex": return <Reflex {...g.params} />;
      case "memory": return <MemorySeq {...g.params} />;
      case "math": return <MathQuiz {...g.params} />;
      case "scramble": return <Scramble {...g.params} />;
      case "odd": return <OddOne {...g.params} />;
      case "stroop": return <Stroop {...g.params} />;
      case "count": return <CountIt {...g.params} />;
      case "type": return <TypeIt {...g.params} />;
      case "sort": return <SortOrder {...g.params} />;
    }
  };
  Comp.displayName = `Mega_${g.mode}`;
  return Comp;
}
