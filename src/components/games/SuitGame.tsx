import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Swords } from "lucide-react";
import { loadSuitScore, saveSuitScore, type SuitScore } from "./gameStore";
import { updateGameStats } from "./GameProfile";
import { getVisitorId } from "@/lib/visitor-id";
import handBatu from "@/assets/hand-batu.png";
import handGunting from "@/assets/hand-gunting.png";
import handKertas from "@/assets/hand-kertas.png";

type RPS = "batu" | "gunting" | "kertas";
type GameResult = "menang" | "kalah" | "seri";

const RPS_CONFIG: Record<RPS, { img: string; label: string; gradient: string }> = {
  batu: { img: handBatu, label: "Batu", gradient: "from-slate-500 to-slate-700" },
  gunting: { img: handGunting, label: "Gunting", gradient: "from-red-500 to-red-700" },
  kertas: { img: handKertas, label: "Kertas", gradient: "from-blue-500 to-blue-700" },
};

function getResult(player: RPS, ai: RPS): GameResult {
  if (player === ai) return "seri";
  if (
    (player === "batu" && ai === "gunting") ||
    (player === "gunting" && ai === "kertas") ||
    (player === "kertas" && ai === "batu")
  ) return "menang";
  return "kalah";
}

function getRandomChoice(): RPS {
  const choices: RPS[] = ["batu", "gunting", "kertas"];
  return choices[Math.floor(Math.random() * choices.length)];
}

export default function SuitGame() {
  const [playerChoice, setPlayerChoice] = useState<RPS | null>(null);
  const [aiChoice, setAiChoice] = useState<RPS | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [score, setScore] = useState<SuitScore>(loadSuitScore);
  const [animating, setAnimating] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => { saveSuitScore(score); }, [score]);

  const play = (choice: RPS) => {
    if (animating) return;
    setAnimating(true);
    setPlayerChoice(choice);
    setAiChoice(null);
    setResult(null);
    setRound(r => r + 1);

    setTimeout(() => {
      const ai = getRandomChoice();
      const res = getResult(choice, ai);
      setAiChoice(ai);
      setResult(res);
      setScore(s => {
        const ns = {
          win: s.win + (res === "menang" ? 1 : 0),
          lose: s.lose + (res === "kalah" ? 1 : 0),
          draw: s.draw + (res === "seri" ? 1 : 0),
        };
        return ns;
      });
      setAnimating(false);
      // Track stats
      if (res !== "seri") {
        const vid = localStorage.getItem("balance_visitor_id") || getVisitorId();
        updateGameStats(vid, "suit", res === "menang", res === "menang" ? 10 : 0);
      }
    }, 900);
  };

  return (
    <div className="space-y-4">
      {/* Score */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-2.5">
          <p className="text-xl font-black text-green-500">{score.win}</p>
          <p className="text-[10px] text-muted-foreground font-medium">Menang</p>
        </div>
        <div className="bg-muted/50 border border-border rounded-xl p-2.5">
          <p className="text-xl font-black text-muted-foreground">{score.draw}</p>
          <p className="text-[10px] text-muted-foreground font-medium">Seri</p>
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-2.5">
          <p className="text-xl font-black text-red-500">{score.lose}</p>
          <p className="text-[10px] text-muted-foreground font-medium">Kalah</p>
        </div>
      </div>

      {/* Battle Area */}
      <div className="relative bg-gradient-to-b from-muted/30 to-muted/60 rounded-2xl p-5 border border-border">
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <motion.div
            className="absolute w-32 h-32 rounded-full bg-primary/5 blur-3xl"
            animate={{ x: [0, 50, 0], y: [0, -30, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            style={{ top: "10%", left: "10%" }}
          />
        </div>

        <div className="relative flex items-center justify-center gap-4">
          {/* Player */}
          <div className="text-center space-y-2 flex-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Kamu</p>
            <motion.div
              className={`w-20 h-20 mx-auto rounded-2xl border-2 flex items-center justify-center transition-all ${
                playerChoice ? `bg-gradient-to-br ${RPS_CONFIG[playerChoice].gradient} text-white border-transparent shadow-lg` : "bg-card border-dashed border-muted-foreground/30"
              }`}
              animate={animating ? { rotate: [0, -15, 15, -10, 0], scale: [1, 1.05, 0.95, 1] } : {}}
              transition={{ duration: 0.7 }}
            >
              {playerChoice ? <img src={RPS_CONFIG[playerChoice].img} alt={RPS_CONFIG[playerChoice].label} className="w-14 h-14 object-contain" /> : <span className="text-muted-foreground text-xs">?</span>}
            </motion.div>
            {playerChoice && !animating && (
              <p className="text-xs font-bold">{RPS_CONFIG[playerChoice].label}</p>
            )}
          </div>

          {/* VS */}
          <motion.div
            className="text-xl font-black text-muted-foreground/50"
            animate={animating ? { scale: [1, 1.3, 1], rotate: [0, 360] } : {}}
            transition={{ duration: 0.7 }}
          >
            VS
          </motion.div>

          {/* AI */}
          <div className="text-center space-y-2 flex-1">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">AI</p>
            <motion.div
              className={`w-20 h-20 mx-auto rounded-2xl border-2 flex items-center justify-center transition-all ${
                aiChoice ? `bg-gradient-to-br ${RPS_CONFIG[aiChoice].gradient} text-white border-transparent shadow-lg` : "bg-card border-dashed border-muted-foreground/30"
              }`}
              animate={animating ? { rotate: [0, 15, -15, 10, 0], scale: [1, 1.05, 0.95, 1] } : {}}
              transition={{ duration: 0.7 }}
            >
              {animating ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.5, repeat: Infinity }}>
                  <Swords className="w-6 h-6 text-muted-foreground" />
                </motion.div>
              ) : aiChoice ? <img src={RPS_CONFIG[aiChoice].img} alt={RPS_CONFIG[aiChoice].label} className="w-14 h-14 object-contain" /> : <span className="text-muted-foreground text-xs">?</span>}
            </motion.div>
            {aiChoice && !animating && (
              <p className="text-xs font-bold">{RPS_CONFIG[aiChoice].label}</p>
            )}
          </div>
        </div>

        {/* Result */}
        <AnimatePresence>
          {result && !animating && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className={`mt-4 text-center py-3 rounded-xl font-extrabold text-base ${
                result === "menang" ? "bg-green-500/10 text-green-500 border border-green-500/20" :
                result === "kalah" ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                "bg-muted text-muted-foreground border border-border"
              }`}
            >
              {result === "menang" ? "Kamu Menang!" : result === "kalah" ? "Kamu Kalah!" : "Seri!"}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Choices */}
      <div className="grid grid-cols-3 gap-3">
        {(["batu", "gunting", "kertas"] as RPS[]).map(choice => (
          <motion.button
            key={choice}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.03 }}
            onClick={() => play(choice)}
            disabled={animating}
            className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
              playerChoice === choice && !animating
                ? `border-primary bg-gradient-to-br ${RPS_CONFIG[choice].gradient} text-white shadow-lg`
                : "border-border hover:border-primary/50 bg-card"
            } disabled:opacity-50`}
          >
            <img src={RPS_CONFIG[choice].img} alt={RPS_CONFIG[choice].label} className="w-12 h-12 object-contain" />
            <span className="text-xs font-bold">{RPS_CONFIG[choice].label}</span>
          </motion.button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="flex-1 gap-2"
          onClick={() => { 
            setScore({ win: 0, lose: 0, draw: 0 }); 
            setPlayerChoice(null); setAiChoice(null); setResult(null); setRound(0);
          }}
        >
          <RefreshCw className="w-4 h-4" /> Reset Skor
        </Button>
      </div>

      {round > 0 && (
        <p className="text-[10px] text-muted-foreground text-center">Ronde ke-{round}</p>
      )}
    </div>
  );
}
