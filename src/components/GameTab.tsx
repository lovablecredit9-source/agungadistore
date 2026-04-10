import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, Hand, Scissors, Circle, HelpCircle, RefreshCw, Loader2, Lightbulb, Check, X, Trophy, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type RPS = "batu" | "gunting" | "kertas";
type GameResult = "menang" | "kalah" | "seri";

const RPS_ICONS: Record<RPS, React.ReactNode> = {
  batu: <Circle className="w-8 h-8" />,
  gunting: <Scissors className="w-8 h-8" />,
  kertas: <Hand className="w-8 h-8" />,
};

const RPS_EMOJI: Record<RPS, string> = {
  batu: "✊",
  gunting: "✌️",
  kertas: "🖐️",
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

// Suit Game
function SuitGame() {
  const [playerChoice, setPlayerChoice] = useState<RPS | null>(null);
  const [aiChoice, setAiChoice] = useState<RPS | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [score, setScore] = useState({ win: 0, lose: 0, draw: 0 });
  const [animating, setAnimating] = useState(false);

  const play = (choice: RPS) => {
    if (animating) return;
    setAnimating(true);
    setPlayerChoice(choice);
    setAiChoice(null);
    setResult(null);

    setTimeout(() => {
      const ai = getRandomChoice();
      const res = getResult(choice, ai);
      setAiChoice(ai);
      setResult(res);
      setScore(s => ({
        win: s.win + (res === "menang" ? 1 : 0),
        lose: s.lose + (res === "kalah" ? 1 : 0),
        draw: s.draw + (res === "seri" ? 1 : 0),
      }));
      setAnimating(false);
    }, 800);
  };

  return (
    <div className="space-y-4">
      {/* Score */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-green-500/10 rounded-xl p-2">
          <p className="text-lg font-extrabold text-green-500">{score.win}</p>
          <p className="text-[10px] text-muted-foreground">Menang</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-2">
          <p className="text-lg font-extrabold text-muted-foreground">{score.draw}</p>
          <p className="text-[10px] text-muted-foreground">Seri</p>
        </div>
        <div className="bg-red-500/10 rounded-xl p-2">
          <p className="text-lg font-extrabold text-red-500">{score.lose}</p>
          <p className="text-[10px] text-muted-foreground">Kalah</p>
        </div>
      </div>

      {/* Battle Area */}
      <div className="flex items-center justify-center gap-6 py-4">
        <div className="text-center space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground">KAMU</p>
          <motion.div
            className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-4xl"
            animate={animating ? { rotate: [0, -20, 20, -20, 0] } : {}}
            transition={{ duration: 0.6 }}
          >
            {playerChoice ? RPS_EMOJI[playerChoice] : "❓"}
          </motion.div>
        </div>
        <div className="text-2xl font-extrabold text-muted-foreground">VS</div>
        <div className="text-center space-y-1">
          <p className="text-[10px] font-bold text-muted-foreground">AI</p>
          <motion.div
            className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center text-4xl"
            animate={animating ? { rotate: [0, 20, -20, 20, 0] } : {}}
            transition={{ duration: 0.6 }}
          >
            {animating ? "🤔" : aiChoice ? RPS_EMOJI[aiChoice] : "🤖"}
          </motion.div>
        </div>
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className={`text-center py-3 rounded-xl font-extrabold text-lg ${
              result === "menang" ? "bg-green-500/10 text-green-500" :
              result === "kalah" ? "bg-red-500/10 text-red-500" :
              "bg-muted text-muted-foreground"
            }`}
          >
            {result === "menang" ? "🎉 Kamu Menang!" : result === "kalah" ? "😢 Kamu Kalah!" : "🤝 Seri!"}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Choices */}
      <div className="grid grid-cols-3 gap-3">
        {(["batu", "gunting", "kertas"] as RPS[]).map(choice => (
          <motion.button
            key={choice}
            whileTap={{ scale: 0.9 }}
            onClick={() => play(choice)}
            disabled={animating}
            className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${
              playerChoice === choice && !animating
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/50 bg-card"
            } disabled:opacity-50`}
          >
            <span className="text-3xl">{RPS_EMOJI[choice]}</span>
            <span className="text-xs font-bold capitalize">{choice}</span>
          </motion.button>
        ))}
      </div>

      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={() => { setScore({ win: 0, lose: 0, draw: 0 }); setPlayerChoice(null); setAiChoice(null); setResult(null); }}
      >
        <RefreshCw className="w-4 h-4" /> Reset Skor
      </Button>
    </div>
  );
}

// Tebak Kata Game
function TebakKataGame() {
  const [word, setWord] = useState<string>("");
  const [hints, setHints] = useState<string[]>([]);
  const [revealedHints, setRevealedHints] = useState(0);
  const [guess, setGuess] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [wins, setWins] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const { toast } = useToast();

  const startNewGame = useCallback(async () => {
    setLoading(true);
    setResult(null);
    setGuess("");
    setRevealedHints(0);
    setAttempts(0);
    setGameActive(false);
    try {
      const { data, error } = await supabase.functions.invoke("tebak-kata", {
        body: { action: "new_word" },
      });
      if (error || data?.error) {
        toast({ title: "Gagal", description: data?.error || "Gagal membuat kata baru", variant: "destructive" });
        return;
      }
      setWord(data.word);
      setHints(data.hints);
      setRevealedHints(1);
      setGameActive(true);
    } catch {
      toast({ title: "Error", description: "Koneksi gagal", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const submitGuess = () => {
    if (!guess.trim()) return;
    const isCorrect = guess.trim().toUpperCase() === word.toUpperCase();
    setAttempts(a => a + 1);
    if (isCorrect) {
      setResult("correct");
      setWins(w => w + 1);
      setGameActive(false);
    } else {
      setResult("wrong");
      if (revealedHints < hints.length) {
        setRevealedHints(r => r + 1);
      }
      setTimeout(() => setResult(null), 1500);
    }
    setGuess("");
  };

  const giveUp = () => {
    setGameActive(false);
    setRevealedHints(hints.length);
    setResult(null);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center justify-center gap-4">
        <div className="bg-primary/10 rounded-xl px-4 py-2 text-center">
          <p className="text-lg font-extrabold text-primary">{wins}</p>
          <p className="text-[10px] text-muted-foreground">Berhasil</p>
        </div>
      </div>

      {!gameActive && !word ? (
        <div className="text-center py-8 space-y-4">
          <div className="text-5xl">🧠</div>
          <h3 className="font-extrabold text-lg">Tebak Kata AI</h3>
          <p className="text-sm text-muted-foreground">AI akan memberikan petunjuk, kamu tebak katanya!</p>
          <Button onClick={startNewGame} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Mulai Game
          </Button>
        </div>
      ) : (
        <>
          {/* Word display */}
          <div className="bg-muted/50 rounded-2xl p-4 text-center">
            <p className="text-[10px] text-muted-foreground mb-2">Kata ({word.length} huruf)</p>
            <div className="flex justify-center gap-1.5">
              {word.split("").map((letter, i) => (
                <div key={i} className={`w-8 h-10 rounded-lg flex items-center justify-center text-lg font-extrabold ${
                  !gameActive ? "bg-primary text-primary-foreground" : "bg-card border-2 border-border"
                }`}>
                  {!gameActive ? letter : "?"}
                </div>
              ))}
            </div>
          </div>

          {/* Hints */}
          <div className="space-y-2">
            <p className="text-xs font-bold flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5 text-yellow-500" />
              Petunjuk ({revealedHints}/{hints.length})
            </p>
            {hints.slice(0, revealedHints).map((hint, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 text-sm"
              >
                <span className="font-bold text-yellow-600 mr-2">#{i + 1}</span>
                {hint}
              </motion.div>
            ))}
          </div>

          {/* Result feedback */}
          <AnimatePresence>
            {result === "correct" && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-green-500/10 text-green-500 rounded-xl p-4 text-center font-extrabold text-lg"
              >
                🎉 Benar! Kata: {word}
              </motion.div>
            )}
            {result === "wrong" && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="bg-red-500/10 text-red-500 rounded-xl p-3 text-center font-bold text-sm"
              >
                ❌ Salah! Coba lagi...
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input */}
          {gameActive && (
            <div className="flex gap-2">
              <Input
                placeholder="Tebak kata..."
                value={guess}
                onChange={e => setGuess(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") submitGuess(); }}
                className="flex-1 font-bold uppercase"
                autoFocus
              />
              <Button onClick={submitGuess} disabled={!guess.trim()} className="gap-1">
                <Check className="w-4 h-4" /> Tebak
              </Button>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {gameActive && (
              <Button variant="outline" onClick={giveUp} className="flex-1 gap-1 text-destructive">
                <X className="w-4 h-4" /> Menyerah
              </Button>
            )}
            <Button onClick={startNewGame} disabled={loading} className="flex-1 gap-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {gameActive ? "Kata Baru" : "Main Lagi"}
            </Button>
          </div>

          {attempts > 0 && (
            <p className="text-[10px] text-muted-foreground text-center">Percobaan: {attempts}</p>
          )}
        </>
      )}
    </div>
  );
}

// Main GameTab
type GameMode = "menu" | "suit" | "tebak";

export default function GameTab() {
  const [mode, setMode] = useState<GameMode>("menu");

  if (mode === "suit") {
    return (
      <div className="space-y-4 p-4 pb-24">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMode("menu")}>← Kembali</Button>
          <h2 className="font-extrabold text-lg">✊ Suit AI</h2>
        </div>
        <SuitGame />
      </div>
    );
  }

  if (mode === "tebak") {
    return (
      <div className="space-y-4 p-4 pb-24">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setMode("menu")}>← Kembali</Button>
          <h2 className="font-extrabold text-lg">🧠 Tebak Kata AI</h2>
        </div>
        <TebakKataGame />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pb-24">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="font-extrabold text-xl flex items-center gap-2 mb-4">
          <Gamepad2 className="w-6 h-6 text-primary" /> Game
        </h2>

        <div className="grid grid-cols-1 gap-3">
          <motion.div whileTap={{ scale: 0.97 }}>
            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setMode("suit")}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-3xl">
                  ✊
                </div>
                <div className="flex-1">
                  <h3 className="font-extrabold text-base">Suit AI</h3>
                  <p className="text-xs text-muted-foreground">Batu, Gunting, Kertas melawan AI!</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileTap={{ scale: 0.97 }}>
            <Card className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setMode("tebak")}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-3xl">
                  🧠
                </div>
                <div className="flex-1">
                  <h3 className="font-extrabold text-base">Tebak Kata AI</h3>
                  <p className="text-xs text-muted-foreground">AI beri petunjuk, kamu tebak kata!</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
