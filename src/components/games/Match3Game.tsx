import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, RotateCcw, Trophy, Copy, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGameCredits } from "./GameCredits";
import { awardGamePoints } from "./gameStore";

const GEMS = ["🟥", "🟦", "🟩", "🟨", "🟪", "🟧"];
const SIZE = 6;
const MAX_MOVES = 20;

type Grid = string[][];

function makeGrid(): Grid {
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => GEMS[Math.floor(Math.random() * GEMS.length)])
  );
}

function findMatches(g: Grid): boolean[][] {
  const m = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
  // horizontal
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE - 2; c++) {
      if (g[r][c] && g[r][c] === g[r][c + 1] && g[r][c] === g[r][c + 2]) {
        m[r][c] = m[r][c + 1] = m[r][c + 2] = true;
      }
    }
  }
  // vertical
  for (let c = 0; c < SIZE; c++) {
    for (let r = 0; r < SIZE - 2; r++) {
      if (g[r][c] && g[r][c] === g[r + 1][c] && g[r][c] === g[r + 2][c]) {
        m[r][c] = m[r + 1][c] = m[r + 2][c] = true;
      }
    }
  }
  return m;
}

function applyGravity(g: Grid): Grid {
  const ng = g.map(r => [...r]);
  for (let c = 0; c < SIZE; c++) {
    const col: string[] = [];
    for (let r = SIZE - 1; r >= 0; r--) if (ng[r][c]) col.push(ng[r][c]);
    while (col.length < SIZE) col.push(GEMS[Math.floor(Math.random() * GEMS.length)]);
    for (let r = SIZE - 1; r >= 0; r--) ng[r][c] = col[SIZE - 1 - r];
  }
  return ng;
}

export default function Match3Game() {
  const visitorId = typeof window !== "undefined" ? localStorage.getItem("balance_visitor_id") : null;
  const { credits, isUnlimited, useCredit, fetchCredits } = useGameCredits(visitorId);
  const [grid, setGrid] = useState<Grid>(makeGrid());
  const [score, setScore] = useState(0);
  const [moves, setMoves] = useState(MAX_MOVES);
  const [combo, setCombo] = useState(0);
  const [comboMax, setComboMax] = useState(0);
  const [selected, setSelected] = useState<{ r: number; c: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);
  const [payout, setPayout] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const resolveMatches = useCallback(async (g: Grid, currentCombo = 0): Promise<{ grid: Grid; gained: number; combo: number }> => {
    const matches = findMatches(g);
    const count = matches.flat().filter(Boolean).length;
    if (count === 0) return { grid: g, gained: 0, combo: currentCombo };
    const gained = count * 10 * (currentCombo + 1);
    const cleared: Grid = g.map((row, r) => row.map((cell, c) => (matches[r][c] ? "" : cell)));
    const after = applyGravity(cleared);
    await new Promise(res => setTimeout(res, 300));
    const next = await resolveMatches(after, currentCombo + 1);
    return { grid: next.grid, gained: gained + next.gained, combo: next.combo };
  }, []);

  const swap = async (r1: number, c1: number, r2: number, c2: number) => {
    if (busy || finished) return;
    const ng = grid.map(r => [...r]);
    [ng[r1][c1], ng[r2][c2]] = [ng[r2][c2], ng[r1][c1]];
    if (findMatches(ng).flat().every(v => !v)) {
      // invalid swap, revert visually
      setSelected(null);
      return;
    }
    setBusy(true);
    setGrid(ng);
    const newMoves = moves - 1;
    setMoves(newMoves);
    setSelected(null);

    const result = await resolveMatches(ng);
    setGrid(result.grid);
    setScore(s => s + result.gained);
    setCombo(result.combo);
    setComboMax(c => Math.max(c, result.combo));
    setBusy(false);

    if (newMoves <= 0) finishGame();
  };

  const handleCellClick = (r: number, c: number) => {
    if (busy || finished) return;
    if (!selected) { setSelected({ r, c }); return; }
    const dr = Math.abs(selected.r - r), dc = Math.abs(selected.c - c);
    if (dr + dc === 1) {
      swap(selected.r, selected.c, r, c);
    } else {
      setSelected({ r, c });
    }
  };

  const finishGame = async () => {
    setFinished(true);
    const basePoints = Math.max(10, Math.floor(score / 25) + comboMax * 5);
    const { awardedPoints } = awardGamePoints(basePoints);
    const { data } = await supabase.functions.invoke("match3-submit", {
      body: { visitorId, score, moves: MAX_MOVES, comboMax },
    });
    if (data?.payout) setPayout({ ...data.payout, awardedPoints });
    else setPayout({ label: "Skor tersimpan", awardedPoints, type: "points" });
  };

  const startGame = async () => {
    if (!visitorId) return toast({ title: "Login dulu", variant: "destructive" });
    if (!isUnlimited && credits < 1) return toast({ title: "Kredit habis", variant: "destructive" });
    const ok = await useCredit();
    if (!ok) return;
    fetchCredits();
    let g = makeGrid();
    // ensure no initial matches
    while (findMatches(g).flat().some(v => v)) g = makeGrid();
    setGrid(g);
    setScore(0); setMoves(MAX_MOVES); setCombo(0); setComboMax(0);
    setStarted(true); setFinished(false); setPayout(null); setSelected(null);
  };

  const reset = () => { setStarted(false); setFinished(false); setPayout(null); };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gradient-to-br from-cyan-500 via-teal-500 to-emerald-600 text-white border-none text-center">
        <h3 className="font-extrabold text-lg">🧩 Puzzle Match-3</h3>
        <p className="text-xs opacity-80 mt-1">Cocokkan 3+ permata sama. 20 langkah, raih skor tinggi!</p>
      </Card>

      {!started ? (
        <Button onClick={startGame} className="w-full h-12 text-base font-bold">Mulai Game (1 kredit)</Button>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-muted rounded-lg p-2"><div className="text-muted-foreground">Skor</div><div className="font-black text-lg">{score}</div></div>
            <div className="bg-muted rounded-lg p-2"><div className="text-muted-foreground">Langkah</div><div className="font-black text-lg">{moves}</div></div>
            <div className="bg-muted rounded-lg p-2"><div className="text-muted-foreground">Combo Max</div><div className="font-black text-lg">x{comboMax}</div></div>
          </div>

          <div className="bg-slate-900 p-2 rounded-xl">
            <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}>
              {grid.map((row, r) => row.map((cell, c) => (
                <motion.button
                  key={`${r}-${c}`}
                  onClick={() => handleCellClick(r, c)}
                  whileTap={{ scale: 0.9 }}
                  className={`aspect-square text-2xl rounded-lg flex items-center justify-center transition ${
                    selected?.r === r && selected?.c === c ? "bg-yellow-400 ring-2 ring-yellow-200" : "bg-slate-800"
                  }`}
                >
                  {cell}
                </motion.button>
              )))}
            </div>
          </div>

          {finished && (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white p-4 rounded-2xl text-center">
              <Trophy className="w-10 h-10 mx-auto mb-2" />
              <div className="font-black text-xl">Game Over!</div>
              <div className="text-sm mt-1">Skor akhir: {score}</div>
              {payout && (
                <>
                  <div className="mt-3 font-bold">{payout.label}</div>
                  {payout.awardedPoints ? <div className="text-xs font-black mt-1">+{payout.awardedPoints} poin level</div> : null}
                  {payout.voucher_code && (
                    <button
                      onClick={() => { navigator.clipboard.writeText(payout.voucher_code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="mt-2 inline-flex items-center gap-1 text-xs bg-white/20 backdrop-blur rounded-full px-3 py-1 font-mono font-bold"
                    >
                      {payout.voucher_code} {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  )}
                </>
              )}
              <Button onClick={reset} className="mt-3 bg-white/20 hover:bg-white/30" size="sm"><RotateCcw className="w-4 h-4 mr-1" /> Main Lagi</Button>
            </motion.div>
          )}

          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
            🏆 Skor 5000+ → Voucher Rp 15.000 · 2500+ → Saldo Rp 3.000 · 1000+ → 15 Gems · 300+ → 10 Coins
          </div>
        </>
      )}
    </div>
  );
}
