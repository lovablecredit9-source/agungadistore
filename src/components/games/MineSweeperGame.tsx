import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Bomb, Gem, Loader2, Coins, RotateCcw, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGameCredits } from "./GameCredits";
import { awardGamePoints } from "./gameStore";

const GRID_SIZE = 9;

type TileState = "hidden" | "safe" | "bomb";

export default function MineSweeperGame() {
  const visitorId = typeof window !== "undefined" ? localStorage.getItem("balance_visitor_id") : null;
  const { credits, isUnlimited, fetchCredits } = useGameCredits(visitorId);

  const [bet, setBet] = useState(1);
  const [mines, setMines] = useState(3);
  const [tiles, setTiles] = useState<TileState[]>(Array(GRID_SIZE).fill("hidden"));
  const [active, setActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const [potential, setPotential] = useState(0);
  const [result, setResult] = useState<any>(null);
  const { toast } = useToast();

  const reset = () => {
    setTiles(Array(GRID_SIZE).fill("hidden"));
    setActive(false);
    setMultiplier(1);
    setPotential(0);
    setResult(null);
  };

  const start = async () => {
    if (!visitorId) return toast({ title: "Login dulu", variant: "destructive" });
    if (!isUnlimited && credits < bet) return toast({ title: "Kredit tidak cukup", variant: "destructive" });
    reset();
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("mine-sweeper", { body: { action: "start", visitorId, bet, mines } });
    setBusy(false);
    if (error || data?.error) return toast({ title: "Gagal mulai", description: data?.error, variant: "destructive" });
    setActive(true);
    setMultiplier(1);
    setPotential(bet);
    fetchCredits();
  };

  const reveal = async (idx: number) => {
    if (!active || busy || tiles[idx] !== "hidden") return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("mine-sweeper", { body: { action: "reveal", visitorId, tile: idx } });
    setBusy(false);
    if (error || data?.error) return toast({ title: "Gagal", description: data?.error, variant: "destructive" });

    if (data.status === "lost") {
      const { awardedPoints } = awardGamePoints(Math.max(2, bet));
      const newTiles: TileState[] = Array(GRID_SIZE).fill("hidden");
      data.revealed.forEach((t: number) => (newTiles[t] = "safe"));
      data.minePositions.forEach((t: number) => (newTiles[t] = "bomb"));
      setTiles(newTiles);
      setActive(false);
      setResult({ ...data.payout, awardedPoints });
      toast({ title: "💥 Boom!", description: `Kena bom - +${awardedPoints} poin level`, variant: "destructive" });
      return;
    }

    setTiles(prev => prev.map((t, i) => (i === idx ? "safe" : t)));
    setMultiplier(data.multiplier);
    setPotential(data.potentialCredits);
  };

  const cashout = async () => {
    if (!active || busy) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("mine-sweeper", { body: { action: "cashout", visitorId } });
    setBusy(false);
    if (error || data?.error) return toast({ title: "Gagal", description: data?.error, variant: "destructive" });
    const newTiles = [...tiles];
    data.minePositions.forEach((t: number) => { if (newTiles[t] === "hidden") newTiles[t] = "bomb"; });
    const basePoints = Math.max(5, Math.round(potential + multiplier * 10));
    const { awardedPoints } = awardGamePoints(basePoints);
    setTiles(newTiles);
    setActive(false);
    setResult({ ...data.payout, awardedPoints });
    fetchCredits();
    toast({ title: "💰 Cash Out!", description: `${data.payout.label} · +${awardedPoints} poin level` });
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-700 text-white border-none">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-lg flex items-center gap-2"><Bomb className="w-5 h-5" /> Mine Sweeper</h3>
            <p className="text-xs opacity-90 mt-0.5">Buka tile aman, hindari bom. Cash out kapan saja!</p>
          </div>
          <div className="text-right">
            <div className="text-[10px] opacity-80">MULTIPLIER</div>
            <div className="text-2xl font-black">{multiplier.toFixed(2)}x</div>
          </div>
        </div>
      </Card>

      {!active && !result && (
        <div className="space-y-3 bg-muted/40 rounded-2xl p-4">
          <div>
            <label className="text-xs font-bold text-muted-foreground">Taruhan (kredit)</label>
            <div className="grid grid-cols-5 gap-2 mt-1">
              {[1, 2, 5, 10, 100, 500, 1000, 5000, 10000].map(v => (
                <button key={v} onClick={() => setBet(v)} className={`py-2 rounded-lg font-black text-sm ${bet === v ? "bg-primary text-primary-foreground" : "bg-background border"}`}>
                  {v >= 1000 ? `${v/1000}k` : v}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground">Jumlah Bom (makin banyak, hadiah makin besar)</label>
            <div className="grid grid-cols-5 gap-2 mt-1">
              {[1, 2, 3, 5, 7].map(v => (
                <button key={v} onClick={() => setMines(v)} className={`py-2 rounded-lg font-black text-sm flex items-center justify-center gap-1 ${mines === v ? "bg-rose-500 text-white" : "bg-background border"}`}>
                  💣 {v}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={start} disabled={busy} className="w-full h-12 font-black bg-gradient-to-r from-cyan-500 to-blue-600 text-white">
            {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Gem className="w-4 h-4 mr-2" />}
            Mulai Game ({bet} kredit)
          </Button>
        </div>
      )}

      {active && (
        <div className="bg-gradient-to-b from-slate-900 to-slate-700 rounded-2xl p-4 shadow-xl">
          <div className="grid grid-cols-3 gap-2">
            {tiles.map((t, i) => (
              <motion.button
                key={i}
                whileTap={{ scale: 0.92 }}
                onClick={() => reveal(i)}
                disabled={busy || t !== "hidden"}
                className={`aspect-square rounded-xl flex items-center justify-center text-3xl font-black transition-all ${
                  t === "hidden"
                    ? "bg-gradient-to-br from-slate-300 to-slate-400 hover:from-slate-200 hover:to-slate-300 shadow-md"
                    : t === "safe"
                    ? "bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-inner"
                    : "bg-gradient-to-br from-rose-500 to-red-700 text-white shadow-inner animate-pulse"
                }`}
              >
                {t === "hidden" ? "?" : t === "safe" ? "💎" : "💣"}
              </motion.button>
            ))}
          </div>
          <Button onClick={cashout} disabled={busy} className="w-full mt-3 h-12 font-black bg-gradient-to-r from-emerald-500 to-green-600 text-white">
            <TrendingUp className="w-4 h-4 mr-2" /> Cash Out (~{potential} kredit)
          </Button>
        </div>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl text-center ${result.type === "none" ? "bg-muted" : "bg-gradient-to-r from-emerald-500 to-cyan-600 text-white"}`}>
          <div className="text-3xl mb-1">{result.type === "none" ? "💥" : "🎉"}</div>
          <div className="font-extrabold">{result.label}</div>
          {result.awardedPoints ? <div className="text-xs font-black mt-1">+{result.awardedPoints} poin level</div> : null}
          <Button onClick={reset} variant="outline" className="mt-3" size="sm">
            <RotateCcw className="w-3 h-3 mr-1" /> Main Lagi
          </Button>
        </motion.div>
      )}

      <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg space-y-0.5">
        <div className="font-bold">📋 Aturan:</div>
        <div>• Buka tile aman = multiplier naik</div>
        <div>• Kena bom 💣 = taruhan hangus</div>
        <div>• Cash out kapan saja untuk klaim hadiah</div>
        <div>• Multiplier ≥ 4x & taruhan ≥ 5 → hadiah Saldo Game (bukan kredit)</div>
      </div>
    </div>
  );
}
