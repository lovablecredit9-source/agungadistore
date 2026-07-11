import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Loader2, Lightbulb, Check, X, Zap, Timer, Trophy, Star, Brain, ChevronDown, Gift } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getVisitorId } from "@/lib/visitor-id";
import { updateGameStats } from "./GameProfile";
import { useGameCredits, GameCreditsBadge, BuyCreditsDialog, RevealAnswerButton } from "./GameCredits";
import PowerUpsBar, { ReviveButton } from "./PowerUpsBar";
import { useToast } from "@/hooks/use-toast";
import {
  loadGameData, addPoints, awardGamePoints, getPointsForQuestion, getPointMultiplier,
  getLevelFromPoints, getNextLevelThreshold, getCurrentLevelThreshold,
  DIFFICULTIES, type Difficulty, type GameLevel,
} from "./gameStore";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MAX_WRONG = 3;

function getCurrentActiveVisitorId() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("balance_visitor_id") || getVisitorId();
}

export default function TebakKataGame() {
  const [activeVisitorId, setActiveVisitorId] = useState<string | null>(() => getCurrentActiveVisitorId());
  const { credits, isUnlimited, fetchCredits, useCredit } = useGameCredits(activeVisitorId);
  const [word, setWord] = useState("");
  const [hints, setHints] = useState<string[]>([]);
  const [revealedHints, setRevealedHints] = useState(0);
  const [guess, setGuess] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<"correct" | "wrong" | "timeout" | null>(null);
  const [wrongCount, setWrongCount] = useState(0);
  const [gameActive, setGameActive] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [difficulty, setDifficulty] = useState<Difficulty>("sedang");
  const [playerData, setPlayerData] = useState<GameLevel>(loadGameData);
  const [timeLeft, setTimeLeft] = useState(0);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { toast } = useToast();

  const diffConfig = DIFFICULTIES.find(d => d.key === difficulty)!;

  useEffect(() => {
    const syncActiveVisitor = () => setActiveVisitorId(getCurrentActiveVisitorId());
    syncActiveVisitor();
    window.addEventListener("storage", syncActiveVisitor);
    window.addEventListener("focus", syncActiveVisitor);
    window.addEventListener("balance-auth-changed", syncActiveVisitor as EventListener);
    return () => {
      window.removeEventListener("storage", syncActiveVisitor);
      window.removeEventListener("focus", syncActiveVisitor);
      window.removeEventListener("balance-auth-changed", syncActiveVisitor as EventListener);
    };
  }, []);

  // Timer
  useEffect(() => {
    if (gameActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            handleTimeout();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [gameActive, timeLeft > 0]);

  function handleTimeout() {
    setGameActive(false);
    setResult("timeout");
    updateGameStats(activeVisitorId, "tebak", false, 0);
  }

  const startNewGame = useCallback(async () => {

    setLoading(true);
    setResult(null);
    setGuess("");
    setRevealedHints(0);
    setWrongCount(0);
    setGameActive(false);
    setEarnedPoints(0);
    setAnswerRevealed(false);

    try {
      const { data, error } = await supabase.functions.invoke("tebak-kata", {
        body: { action: "new_word", difficulty },
      });
      if (error || data?.error) {
        toast({ title: "Gagal", description: data?.error || "Gagal membuat kata baru", variant: "destructive" });
        return;
      }
      setWord(data.word);
      const h = data.hints || [];
      setHints(h.slice(0, diffConfig.hintCount));
      setRevealedHints(1);
      setQuestionNumber(q => q + 1);
      setTimeLeft(diffConfig.timeSeconds);
      setGameActive(true);
    } catch {
      toast({ title: "Error", description: "Koneksi gagal", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, difficulty, diffConfig, questionNumber, isUnlimited, credits, useCredit]);

  const submitGuess = () => {
    if (!guess.trim() || !gameActive) return;
    const currentVisitorId = getCurrentActiveVisitorId();
    const isCorrect = guess.trim().toUpperCase() === word.toUpperCase();
    if (isCorrect) {
      if (timerRef.current) clearInterval(timerRef.current);
      const basePoints = getPointsForQuestion(questionNumber);
      const { awardedPoints, data } = awardGamePoints(basePoints);
      setEarnedPoints(awardedPoints);
      setPlayerData(data);
      setResult("correct");
      setGameActive(false);
      updateGameStats(currentVisitorId, "tebak", true, awardedPoints, 1, { basePoints }).then((serverAwardedPoints) => {
        if (typeof serverAwardedPoints === "number" && serverAwardedPoints !== awardedPoints) {
          setEarnedPoints(serverAwardedPoints);
          setPlayerData(loadGameData());
        }
      });
    } else {
      const newWrong = wrongCount + 1;
      setWrongCount(newWrong);
      setResult("wrong");
      // Reveal extra hint on wrong answer
      if (revealedHints < hints.length) {
        setRevealedHints(r => r + 1);
      }
      if (newWrong >= MAX_WRONG) {
        if (timerRef.current) clearInterval(timerRef.current);
        setGameActive(false);
        updateGameStats(currentVisitorId, "tebak", false, 0);
      } else {
        setTimeout(() => setResult(null), 1200);
      }
    }
    setGuess("");
  };

  const giveUp = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setGameActive(false);
    setRevealedHints(hints.length);
    setResult(null);
    const newData = addPoints(0);
    setPlayerData(newData);
  };

  const level = playerData.level;
  const nextThreshold = getNextLevelThreshold(level);
  const currentThreshold = getCurrentLevelThreshold(level);
  const levelProgress = ((playerData.totalPoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100;

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const gameOver = result === "wrong" && wrongCount >= MAX_WRONG;
  const timeoutOver = result === "timeout";

  return (
    <div className="space-y-4">
      {/* Player Level Card */}
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl border border-primary/20 p-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Star className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-extrabold">Level {level}</p>
              <p className="text-[10px] text-muted-foreground">{playerData.totalPoints} poin</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground">Menang: {playerData.gamesWon}/{playerData.gamesPlayed}</p>
          </div>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, levelProgress)}%` }}
          />
        </div>
        <p className="text-[9px] text-muted-foreground mt-1">
          {nextThreshold - playerData.totalPoints} poin lagi ke Level {level + 1}
        </p>
      </div>

      {/* Difficulty Selector */}
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-muted-foreground" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1 text-xs">
              <span className={diffConfig.color}>{diffConfig.label}</span>
              <ChevronDown className="w-3 h-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {DIFFICULTIES.map(d => (
              <DropdownMenuItem key={d.key} onClick={() => setDifficulty(d.key)} className="text-xs">
                <span className={d.color}>{d.label}</span>
                <span className="ml-auto text-muted-foreground">{d.timeSeconds}s • {d.hintCount} hint</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!gameActive && !word ? (
        <div className="text-center py-8 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h3 className="font-extrabold text-lg">Tebak Kata AI</h3>
          <p className="text-sm text-muted-foreground">AI beri petunjuk, kamu tebak kata! Maksimal 3x salah.</p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <GameCreditsBadge credits={credits} isUnlimited={isUnlimited} />
          </div>
          <div className="flex gap-2 justify-center">
            <BuyCreditsDialog visitorId={activeVisitorId} onPurchased={fetchCredits} />
          </div>
          <Button onClick={startNewGame} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            Mulai Game
          </Button>
        </div>
      ) : (
        <>
          {/* Timer + Wrong count */}
          {gameActive && (
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-1.5 text-sm font-bold ${timeLeft <= 10 ? "text-red-500 animate-pulse" : timeLeft <= 20 ? "text-orange-500 animate-pulse" : timeLeft <= 30 ? "text-yellow-600" : "text-foreground"}`}>
                <Timer className="w-4 h-4" />
                <motion.span
                  key={timeLeft}
                  initial={timeLeft <= 10 ? { scale: 1.3 } : {}}
                  animate={{ scale: 1 }}
                >
                  {formatTime(timeLeft)}
                </motion.span>
              </div>
              <div className="flex items-center gap-1">
                {[0, 1, 2].map(i => (
                  <X key={i} className={`w-4 h-4 ${i < wrongCount ? "text-destructive" : "text-muted"}`} />
                ))}
              </div>
            </div>
          )}

          {gameActive && (
            <PowerUpsBar
              enabled={gameActive}
              onUseHint={() => setRevealedHints(r => Math.min(hints.length, r + 1))}
              onUseTimeFreeze={(s) => setTimeLeft(t => t + s)}
            />
          )}

          {/* Word display */}
          <div className="bg-muted/50 rounded-2xl p-4 text-center border border-border">
            <p className="text-[10px] text-muted-foreground mb-2">Kata ({word.length} huruf)</p>
            <div className="flex justify-center gap-1.5 flex-wrap">
              {word.split("").map((letter, i) => (
                <motion.div
                  key={i}
                  initial={{ rotateY: 0 }}
                  animate={!gameActive && result !== null ? { rotateY: 360 } : {}}
                  transition={{ delay: i * 0.08 }}
                  className={`w-9 h-11 rounded-lg flex items-center justify-center text-lg font-extrabold ${
                    !gameActive && (result === "correct" || gameOver || timeoutOver)
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border-2 border-border"
                  }`}
                >
                  {!gameActive && (result === "correct" || gameOver || timeoutOver) ? letter : "?"}
                </motion.div>
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
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-green-500/10 text-green-500 border border-green-500/20 rounded-xl p-4 text-center space-y-1"
              >
                <p className="font-extrabold text-lg flex items-center justify-center gap-2">
                  <Trophy className="w-5 h-5" /> Benar!
                </p>
                <p className="text-sm">Kata: <span className="font-bold">{word}</span></p>
                {earnedPoints > 0 && (
                  <motion.p
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="text-xs font-bold text-green-600"
                  >
                    +{earnedPoints} poin!
                  </motion.p>
                )}
              </motion.div>
            )}
            {result === "wrong" && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl p-3 text-center font-bold text-sm"
              >
                <X className="w-4 h-4 inline mr-1" /> Salah! Coba lagi
              </motion.div>
            )}
            {gameOver && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl p-4 text-center"
              >
                <p className="font-extrabold text-lg">Game Over!</p>
                <p className="text-sm">Kata: <span className="font-bold">{word}</span></p>
                <ReviveButton onRevive={() => {
                  setWrongCount(w => Math.max(0, w - 1));
                  setResult(null);
                  setGameActive(true);
                  setTimeLeft(t => Math.max(t, 30));
                }} />
              </motion.div>
            )}
            {timeoutOver && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-xl p-4 text-center"
              >
                <p className="font-extrabold text-lg flex items-center justify-center gap-2">
                  <Timer className="w-5 h-5" /> Waktu Habis!
                </p>
                <p className="text-sm">Kata: <span className="font-bold">{word}</span></p>
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
            {gameActive && !answerRevealed && (
              <RevealAnswerButton
                onReveal={() => { setAnswerRevealed(true); setGuess(word); }}
                visitorId={activeVisitorId}
                useCredit={useCredit}
                credits={credits}
                isUnlimited={isUnlimited}
              />
            )}
            <Button onClick={startNewGame} disabled={loading} className="flex-1 gap-1">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {gameActive ? "Kata Baru" : "Main Lagi"}
            </Button>
          </div>

          {/* Revealed answer */}
          {answerRevealed && gameActive && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-accent/10 border border-accent/20 rounded-xl p-3 text-center"
            >
              <p className="text-xs text-muted-foreground">Jawaban sudah diisi otomatis, tekan tombol Tebak untuk submit!</p>
            </motion.div>
          )}

          {/* Credits info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <GameCreditsBadge credits={credits} isUnlimited={isUnlimited} />
            </div>
            <BuyCreditsDialog visitorId={activeVisitorId} onPurchased={fetchCredits} />
          </div>

          {/* Question info */}
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Soal #{questionNumber}</span>
            <span>+{getPointsForQuestion(questionNumber) * getPointMultiplier()} poin jika benar</span>
          </div>
        </>
      )}
    </div>
  );
}
