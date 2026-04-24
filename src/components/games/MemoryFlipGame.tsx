import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, RotateCcw, Trophy, Timer, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { awardGamePoints } from "./gameStore";

const EMOJIS = ["🍎", "🍌", "🍇", "🍓", "🍒", "🥝", "🍍", "🥑"];

interface Tile {
  id: number;
  emoji: string;
  flipped: boolean;
  matched: boolean;
}

function buildDeck(): Tile[] {
  const pairs = [...EMOJIS, ...EMOJIS];
  const shuffled = pairs
    .map((e) => ({ e, r: Math.random() }))
    .sort((a, b) => a.r - b.r)
    .map(({ e }, i) => ({ id: i, emoji: e, flipped: false, matched: false }));
  return shuffled;
}

export default function MemoryFlipGame() {
  const [tiles, setTiles] = useState<Tile[]>(buildDeck);
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(true);
  const [done, setDone] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (selected.length !== 2) return;
    const [a, b] = selected;
    setMoves((m) => m + 1);
    if (tiles[a].emoji === tiles[b].emoji) {
      setTimeout(() => {
        setTiles((prev) =>
          prev.map((t, i) => (i === a || i === b ? { ...t, matched: true } : t))
        );
        setMatches((m) => m + 1);
        setSelected([]);
      }, 350);
    } else {
      setTimeout(() => {
        setTiles((prev) =>
          prev.map((t, i) => (i === a || i === b ? { ...t, flipped: false } : t))
        );
        setSelected([]);
      }, 700);
    }
  }, [selected, tiles]);

  useEffect(() => {
    if (matches === EMOJIS.length && !done) {
      setRunning(false);
      setDone(true);
      const timeBonus = Math.max(0, 60 - seconds);
      const movePenalty = Math.max(0, moves - EMOJIS.length) * 2;
      const base = Math.max(20, 100 + timeBonus - movePenalty);
      const { awardedPoints } = awardGamePoints(base);
      toast({
        title: "🎉 Selesai!",
        description: `+${awardedPoints} poin · ${moves} langkah · ${seconds} detik`,
      });
    }
  }, [matches, done, moves, seconds, toast]);

  const flip = (idx: number) => {
    if (!running || tiles[idx].flipped || tiles[idx].matched || selected.length === 2) return;
    setTiles((prev) => prev.map((t, i) => (i === idx ? { ...t, flipped: true } : t)));
    setSelected((s) => [...s, idx]);
  };

  const reset = () => {
    setTiles(buildDeck());
    setSelected([]);
    setMoves(0);
    setMatches(0);
    setSeconds(0);
    setRunning(true);
    setDone(false);
  };

  const accuracy = useMemo(() => {
    if (moves === 0) return 100;
    return Math.round((matches / moves) * 100);
  }, [matches, moves]);

  return (
    <div className="space-y-3">
      <Card className="p-3 bg-gradient-to-br from-indigo-500/10 to-pink-500/10 border-indigo-500/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-500" />
            <span className="font-bold text-sm">Memory Flip</span>
          </div>
          <Button size="sm" variant="ghost" onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-1" /> Ulang
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <div className="bg-background/50 rounded-lg px-2 py-1.5 text-center">
            <Timer className="w-3 h-3 inline mr-1" />
            <span className="font-bold">{seconds}s</span>
          </div>
          <div className="bg-background/50 rounded-lg px-2 py-1.5 text-center">
            <Sparkles className="w-3 h-3 inline mr-1" />
            <span className="font-bold">{moves} langkah</span>
          </div>
          <div className="bg-background/50 rounded-lg px-2 py-1.5 text-center">
            <Trophy className="w-3 h-3 inline mr-1" />
            <span className="font-bold">{accuracy}%</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-4 gap-2">
        {tiles.map((tile, i) => (
          <motion.button
            key={tile.id}
            whileTap={{ scale: 0.92 }}
            onClick={() => flip(i)}
            className="relative aspect-square rounded-xl overflow-hidden"
            style={{ perspective: 600 }}
          >
            <motion.div
              animate={{ rotateY: tile.flipped || tile.matched ? 180 : 0 }}
              transition={{ duration: 0.35 }}
              className="relative w-full h-full"
              style={{ transformStyle: "preserve-3d" }}
            >
              <div
                className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500 to-pink-600 flex items-center justify-center text-2xl font-black text-white shadow-md"
                style={{ backfaceVisibility: "hidden" }}
              >
                ?
              </div>
              <div
                className={`absolute inset-0 rounded-xl flex items-center justify-center text-3xl shadow-md ${
                  tile.matched ? "bg-emerald-500/30 border-2 border-emerald-400" : "bg-white"
                }`}
                style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
              >
                {tile.emoji}
              </div>
            </motion.div>
          </motion.button>
        ))}
      </div>

      {done && (
        <Card className="p-4 bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border-emerald-500/40 text-center">
          <Trophy className="w-10 h-10 mx-auto text-yellow-500 mb-2" />
          <p className="font-bold text-lg">Mantap! Semua pasangan ketemu</p>
          <p className="text-xs text-muted-foreground mt-1">
            {moves} langkah dalam {seconds} detik
          </p>
          <Button size="sm" className="mt-3" onClick={reset}>
            Main lagi
          </Button>
        </Card>
      )}
    </div>
  );
}
