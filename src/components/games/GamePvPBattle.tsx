import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Swords, Loader2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface Props { visitorId: string | null }

type Choice = "rock" | "paper" | "scissors";
const CHOICES: Choice[] = ["rock", "paper", "scissors"];
const EMOJI: Record<Choice, string> = { rock: "✊", paper: "✋", scissors: "✌️" };

export default function GamePvPBattle({ visitorId }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"matchmaking" | "play" | "result">("matchmaking");
  const [opponent, setOpponent] = useState<{ name: string; choice?: Choice } | null>(null);
  const [me, setMe] = useState<Choice | null>(null);
  const [score, setScore] = useState({ me: 0, op: 0 });
  const [round, setRound] = useState(1);

  const opponents = useMemo(() => ["Ryu_88", "AceMaster", "NeonKing", "PixelLord", "ShadowFox", "BlitzGamer"], []);

  function startMatch() {
    setPhase("matchmaking");
    setOpponent(null); setMe(null); setScore({ me: 0, op: 0 }); setRound(1);
    setTimeout(() => {
      const name = opponents[Math.floor(Math.random() * opponents.length)];
      setOpponent({ name });
      setPhase("play");
    }, 1500);
  }

  function play(c: Choice) {
    if (!opponent || phase !== "play") return;
    const op = CHOICES[Math.floor(Math.random() * 3)];
    setMe(c);
    setOpponent({ ...opponent, choice: op });
    let myScore = score.me, opScore = score.op;
    if (c !== op) {
      const wins = (c === "rock" && op === "scissors") || (c === "scissors" && op === "paper") || (c === "paper" && op === "rock");
      if (wins) myScore++; else opScore++;
    }
    setScore({ me: myScore, op: opScore });
    setTimeout(() => {
      if (myScore === 3 || opScore === 3 || round >= 5) {
        setPhase("result");
        const won = myScore > opScore;
        toast({ title: won ? "🏆 KEMENANGAN!" : "💀 Kalah", description: `Skor ${myScore}-${opScore} vs ${opponent.name}` });
      } else {
        setRound(round + 1);
        setMe(null);
        setOpponent({ name: opponent.name });
      }
    }, 1200);
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); startMatch(); }}
        disabled={!visitorId}
        className="w-full cyber-card-pink rounded-2xl p-3 text-left relative overflow-hidden disabled:opacity-50"
      >
        <div className="absolute -right-4 -top-4 w-20 h-20 bg-pink-500/30 rounded-full blur-2xl" />
        <div className="relative flex items-center gap-3">
          <Swords className="w-9 h-9 icon-3d-zap" strokeWidth={2.5} />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black tracking-widest neon-text-pink uppercase">PvP Battle Real-time</div>
            <div className="font-extrabold text-white text-sm">Suit 1v1 — Best of 5</div>
            <div className="text-[10px] text-white/70">Tantang pemain lain di arena!</div>
          </div>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-500 to-purple-600 text-white">PLAY</span>
        </div>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm bg-gradient-to-br from-purple-950 via-slate-950 to-pink-950 border-pink-500/40">
          <DialogHeader><DialogTitle className="neon-gradient-text text-xl font-black flex items-center gap-2"><Swords className="w-5 h-5" /> PvP ARENA</DialogTitle></DialogHeader>

          {phase === "matchmaking" && (
            <div className="py-10 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-pink-400 mx-auto mb-3" />
              <p className="text-white font-bold">Mencari lawan...</p>
              <p className="text-[11px] text-white/60 mt-1">Matchmaking di server arena</p>
            </div>
          )}

          {phase === "play" && opponent && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 items-center text-center">
                <div>
                  <div className="text-[10px] text-white/60">KAMU</div>
                  <div className="text-2xl font-black neon-text-cyan">{score.me}</div>
                </div>
                <div className="text-xs font-black text-white/70">RONDE {round}/5</div>
                <div>
                  <div className="text-[10px] text-white/60 truncate">{opponent.name}</div>
                  <div className="text-2xl font-black neon-text-pink">{score.op}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 py-3">
                <div className="aspect-square rounded-2xl bg-cyan-500/20 border-2 border-cyan-400/40 flex items-center justify-center text-5xl">
                  {me ? EMOJI[me] : "❓"}
                </div>
                <div className="aspect-square rounded-2xl bg-pink-500/20 border-2 border-pink-400/40 flex items-center justify-center text-5xl">
                  {opponent.choice ? EMOJI[opponent.choice] : "❓"}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {CHOICES.map(c => (
                  <Button key={c} onClick={() => play(c)} disabled={!!me} className="h-14 text-3xl bg-black/40 border border-white/20 hover:bg-pink-500/30">
                    {EMOJI[c]}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {phase === "result" && (
            <div className="text-center py-6 space-y-3">
              <Crown className={`w-16 h-16 mx-auto ${score.me > score.op ? "text-yellow-400" : "text-slate-500"}`} />
              <div className="text-2xl font-black text-white">{score.me > score.op ? "VICTORY!" : "DEFEAT"}</div>
              <div className="text-sm text-white/70">Skor akhir: {score.me} - {score.op}</div>
              <Button onClick={startMatch} className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-black">REMATCH</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
