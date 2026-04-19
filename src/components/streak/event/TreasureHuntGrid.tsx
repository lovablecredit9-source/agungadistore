import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Gem, MapPin, Skull } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Props { visitorId: string; onUpdate?: () => void }

const SIZE = 16; // 4x4
const TREASURES = 4;
const TRAPS = 3;

function todayKey() { return new Date(Date.now() + 7 * 3600_000).toISOString().split("T")[0]; }
function genBoard(): { type: "treasure" | "trap" | "empty"; reward: number }[] {
  const board: { type: "treasure" | "trap" | "empty"; reward: number }[] = Array(SIZE).fill(null).map(() => ({ type: "empty", reward: 0 }));
  const indices = Array.from({ length: SIZE }, (_, i) => i).sort(() => Math.random() - 0.5);
  for (let i = 0; i < TREASURES; i++) {
    const reward = [5, 10, 15, 25][i] || 5;
    board[indices[i]] = { type: "treasure", reward };
  }
  for (let i = TREASURES; i < TREASURES + TRAPS; i++) {
    board[indices[i]] = { type: "trap", reward: 0 };
  }
  return board;
}

export default function TreasureHuntGrid({ visitorId, onUpdate }: Props) {
  const { toast } = useToast();
  const [board, setBoard] = useState<ReturnType<typeof genBoard>>([]);
  const [revealed, setRevealed] = useState<boolean[]>([]);
  const [picksLeft, setPicksLeft] = useState(3);
  const [done, setDone] = useState(false);
  const [totalWon, setTotalWon] = useState(0);

  useEffect(() => {
    if (!visitorId) return;
    const key = `treasure_${visitorId}_${todayKey()}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const p = JSON.parse(raw);
        setDone(p.done); setTotalWon(p.totalWon);
        setBoard(p.board); setRevealed(p.revealed); setPicksLeft(p.picksLeft);
      } else {
        setBoard(genBoard()); setRevealed(Array(SIZE).fill(false)); setPicksLeft(3); setDone(false); setTotalWon(0);
      }
    } catch { /* noop */ }
  }, [visitorId]);

  function persist(b: any, r: boolean[], picks: number, d: boolean, won: number) {
    if (!visitorId) return;
    try {
      localStorage.setItem(`treasure_${visitorId}_${todayKey()}`, JSON.stringify({ board: b, revealed: r, picksLeft: picks, done: d, totalWon: won }));
    } catch { /* noop */ }
  }

  async function pick(i: number) {
    if (done || revealed[i] || picksLeft <= 0) return;
    const cell = board[i];
    const newRevealed = [...revealed]; newRevealed[i] = true;
    const newPicks = picksLeft - 1;
    let newWon = totalWon;
    if (cell.type === "treasure") {
      newWon += cell.reward;
      toast({ title: `💎 Harta! +${cell.reward} koin` });
      try {
        const { data: streak } = await supabase.from("daily_streaks").select("id, streak_coins").eq("visitor_id", visitorId).maybeSingle();
        if (streak) await supabase.from("daily_streaks").update({ streak_coins: (streak.streak_coins || 0) + cell.reward }).eq("id", streak.id);
        onUpdate?.();
      } catch { /* noop */ }
    } else if (cell.type === "trap") {
      toast({ title: "💀 Jebakan!", description: "Sisa pick berkurang.", variant: "destructive" });
    } else {
      toast({ title: "Kosong", description: "Coba lagi tile lain." });
    }
    const isDone = newPicks <= 0;
    setRevealed(newRevealed); setPicksLeft(newPicks); setTotalWon(newWon); setDone(isDone);
    persist(board, newRevealed, newPicks, isDone, newWon);
  }

  return (
    <div className="cyber-card rounded-2xl p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <MapPin className="w-4 h-4 text-amber-300" strokeWidth={2.5} />
        <span className="text-[11px] font-black tracking-widest uppercase neon-text-yellow">Treasure Hunt</span>
        <span className="ml-auto text-[10px] font-black text-white/70 tabular-nums">Pick: {picksLeft}/3</span>
      </div>
      <p className="text-[10px] text-white/60 mb-2">Pilih 3 dari 16 tile. Hindari 💀 jebakan, kumpulkan 💎 harta!</p>
      <div className="grid grid-cols-4 gap-1.5">
        {board.map((cell, i) => {
          const open = revealed[i];
          return (
            <motion.button
              key={i}
              disabled={done || open || picksLeft <= 0}
              onClick={() => pick(i)}
              whileTap={{ scale: 0.9 }}
              className={`aspect-square rounded-lg border-2 flex items-center justify-center text-base font-black transition ${
                !open ? "bg-gradient-to-br from-purple-700 to-indigo-900 border-purple-400/50 hover:from-purple-600 hover:to-indigo-800" :
                cell.type === "treasure" ? "bg-gradient-to-br from-yellow-400 to-orange-500 border-yellow-200" :
                cell.type === "trap" ? "bg-gradient-to-br from-red-600 to-red-900 border-red-300" :
                "bg-black/40 border-white/10"
              }`}
            >
              {!open ? <span className="text-white/50 text-[10px]">?</span> :
                cell.type === "treasure" ? <Gem className="w-4 h-4 text-white" strokeWidth={2.5} /> :
                cell.type === "trap" ? <Skull className="w-4 h-4 text-white" strokeWidth={2.5} /> :
                <span className="text-white/30">·</span>}
            </motion.button>
          );
        })}
      </div>
      {done && (
        <div className="mt-2 p-2 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-center">
          <div className="text-[10px] font-black text-emerald-200">Total dapat: <span className="text-yellow-300">+{totalWon} koin</span></div>
          <div className="text-[9px] text-white/60 mt-0.5">Reset besok 00:00 WIB</div>
        </div>
      )}
    </div>
  );
}
